
from __future__ import annotations
from app.conf.celery import app
import math
from app.api.schema.stp_schema import RasterVisual
from dataclasses import dataclass, field
from enum import Enum
from io import BytesIO
from pathlib import Path
from typing import List, Optional, Protocol, Tuple
import xml.etree.ElementTree as ET
from pathlib import Path
from app.utils.name import Unique_name
from app.api.service.geoserver import Geoserver
import numpy as np
import rasterio
import rasterio.coords
import rasterio.crs
from matplotlib import pyplot as plt
from matplotlib.colors import BoundaryNorm, ListedColormap
from PIL import Image
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from app.conf.settings import Settings
from matplotlib.colors import ListedColormap, NoNorm
import uuid


@dataclass(frozen=True)
class Bounds:
    left: float
    bottom: float
    right: float
    top: float

    @classmethod
    def from_rasterio(cls, bounds: rasterio.coords.BoundingBox) -> Bounds:
        return cls(
            left=bounds.left,
            bottom=bounds.bottom,
            right=bounds.right,
            top=bounds.top
        )


@dataclass(frozen=True)
class RasterMetadata:

    bounds: Bounds
    crs: str
    width: int
    height: int
    nodata: Optional[float]

    @property
    def aspect_ratio(self) -> float:
        """Calculate aspect ratio of the raster."""
        return self.width / self.height


@dataclass(frozen=True)
class RasterData:
    """Complete raster data with metadata."""
    data: np.ma.MaskedArray
    metadata: RasterMetadata

    @property
    def aspect_ratio(self) -> float:
        """Delegate to metadata."""
        return self.metadata.aspect_ratio


@dataclass(frozen=True)
class LegendItem:
    """Single legend entry with color, label, and quantity."""
    color: str
    label: str
    quantity: float

    def to_rgb_tuple(self) -> Tuple[float, float, float]:
        """Convert hex color to RGB tuple (0-1 range)."""
        r = int(self.color[1:3], 16) / 255.0
        g = int(self.color[3:5], 16) / 255.0
        b = int(self.color[5:7], 16) / 255.0
        return (r, g, b)


@dataclass(frozen=True)
class MapConfig:
    """Configuration for map layout."""
    page_width: float
    page_height: float
    dpi: int = 150
    map_margin_left: int = 200
    map_margin_right: int = 20
    map_margin_top: int = 100
    map_margin_bottom: int = 80

    @property
    def map_width(self) -> float:
        """Calculate usable map width."""
        return self.page_width - self.map_margin_left - self.map_margin_right

    @property
    def map_height(self) -> float:
        """Calculate usable map height."""
        return self.page_height - self.map_margin_top - self.map_margin_bottom


@dataclass(frozen=True)
class LogoConfig:
    """Configuration for logo placement."""
    left_logo_path: Optional[Path] = None
    right_logo_path: Optional[Path] = None
    logo_height: float = 60.0
    logo_margin_top: float = 20.0
    logo_margin_side: float = 30.0


@dataclass(frozen=True)
class MapDocument:
    """Complete map document configuration."""
    title: str
    subtitle: str
    output_path: Path
    config: MapConfig
    logo_config: LogoConfig = field(default_factory=LogoConfig)


@dataclass(frozen=True)
class RenderedImage:
    """Result of raster rendering."""
    image: Image.Image
    width_points: float
    height_points: float



class IRasterReader(Protocol):
    """Interface for reading raster data."""
    
    def read(self, path: Path) -> RasterData:
        """Read raster data from file."""
        ...


class IStyleParser(Protocol):
    """Interface for parsing style definitions."""
    
    def parse(self, path: Path) -> List[LegendItem]:
        """Parse style file and extract legend items."""
        ...


class IRenderer(Protocol):
    """Interface for rendering rasters."""
    
    def render(
        self,
        raster_data: RasterData,
        cmap: ListedColormap,
        norm: BoundaryNorm
    ) -> RenderedImage:
        """Render raster data to image."""
        ...

def is_classified_raster(path, max_classes=50):
    with rasterio.open(path) as ds:
        # Read a small sample (center window) for speed
        data = ds.read(1, out_shape=(500, 500), masked=True)

        # Must be integer-like
        if not np.issubdtype(data.dtype, np.integer):
            return False

        # Count unique valid values
        unique_vals = np.unique(data.compressed())

        return len(unique_vals) <= max_classes

class IMapElementDrawer(Protocol):
    """Interface for drawing map elements."""
    
    def draw(self, canvas_obj: canvas.Canvas) -> None:
        """Draw element on canvas."""
        ...

class GISMapGeneratorError(Exception):
    """Base exception for GIS map generator."""
    pass


class StyleParsingError(GISMapGeneratorError):
    """Error parsing style definition."""
    pass


class RasterReadError(GISMapGeneratorError):
    """Error reading raster data."""
    pass


class RenderingError(GISMapGeneratorError):
    """Error rendering map elements."""
    pass




class SLDNamespace(Enum):
    """XML namespaces for SLD parsing."""
    SLD = "http://www.opengis.net/sld"


class SLDStyleParser:
    """Parse SLD (Styled Layer Descriptor) files for legend information."""

    def __init__(self, namespace: str = SLDNamespace.SLD.value):
        self.namespace = {'sld': namespace}

    def parse(self, path: Path) -> List[LegendItem]:

        if not path.exists():
            raise StyleParsingError(f"SLD file not found: {path}")

        try:
            tree = ET.parse(path)
        except ET.ParseError as e:
            raise StyleParsingError(f"Invalid XML in SLD file: {e}")

        legend_items = self._extract_legend_items(tree)
        
        if not legend_items:
            raise StyleParsingError("No valid ColorMapEntry found in SLD")

        return sorted(legend_items, key=lambda x: x.quantity)

    def _extract_legend_items(self, tree: ET.ElementTree) -> List[LegendItem]:
        """Extract legend items from parsed XML tree."""
        items = []
        
        for entry in tree.findall('.//sld:ColorMapEntry', self.namespace):
            try:
                item = self._parse_color_map_entry(entry)
                items.append(item)
            except (TypeError, ValueError, KeyError):
                # Skip invalid entries
                continue
        
        return items

    @staticmethod
    def _parse_color_map_entry(entry: ET.Element) -> LegendItem:
        """Parse a single ColorMapEntry element."""
        color = entry.attrib.get('color')
        label = entry.attrib.get('label', '')
        quantity = float(entry.attrib.get('quantity'))
        
        if not color:
            raise ValueError("Missing color attribute")
        
        return LegendItem(color=color, label=label, quantity=quantity)


class ColormapFactory:
    """Factory for creating matplotlib colormaps from legend items."""

    @staticmethod
    def create_colormap(
        legend_items: List[LegendItem]
    ) -> Tuple[ListedColormap, BoundaryNorm]:

        quantities = sorted([item.quantity for item in legend_items])
        colors = [item.color for item in legend_items]
        
        # Create boundaries with negative infinity at start
        boundaries = [-float("inf")] + quantities
        
        # Create colormap and normalization
        cmap = ListedColormap(colors)
        norm = BoundaryNorm(boundaries, ncolors=len(colors), clip=True)
        
        # Set appearance for no-data values
        cmap.set_bad(color="white", alpha=0)
        
        return cmap, norm
    
    @staticmethod
    def create_colormap_classfied(legend_items):

        # Sort by class ID
        legend_items = sorted(legend_items, key=lambda x: x.quantity)

        # Extract class IDs and colors
        class_values = [int(item.quantity) for item in legend_items]
        colors = [item.color for item in legend_items]

        # Build lookup table
        max_class = max(class_values)
        lut = np.zeros((max_class + 1, 4))  # RGBA

        # Fill with transparent (for undefined classes)
        lut[:] = [0, 0, 0, 0]

        # Assign colors by exact class value
        for cls, color in zip(class_values, colors):
            lut[cls] = ListedColormap([color])(0)

        cmap = ListedColormap(lut)
        cmap.set_bad(color="white", alpha=0)

        # No normalization – direct value lookup
        norm = NoNorm()

        return cmap, norm



class RasterDataReader:
    """Read and process raster data files."""

    def __init__(self, nodata_threshold: float = -9999.0):
        self.nodata_threshold = nodata_threshold

    def read(self, path: Path) -> RasterData:
        """
        Read raster data from file.
        
        Args:
            path: Path to raster file
            
        Returns:
            RasterData object
            
        Raises:
            RasterReadError: If reading fails
        """
        if not path.exists():
            raise RasterReadError(f"Raster file not found: {path}")

        try:
            with rasterio.open(path) as src:
                data = src.read(1)
                bounds = Bounds.from_rasterio(src.bounds)
                crs = str(src.crs)
                nodata = src.nodata
                width = src.width
                height = src.height

                masked_data = self._apply_nodata_mask(data, nodata)
                
                metadata = RasterMetadata(
                    bounds=bounds,
                    crs=crs,
                    width=width,
                    height=height,
                    nodata=nodata
                )
                
                return RasterData(data=masked_data, metadata=metadata)
                
        except Exception as e:
            raise RasterReadError(f"Error reading raster: {e}")

    def _apply_nodata_mask(
        self,
        data: np.ndarray,
        nodata: Optional[float]
    ) -> np.ma.MaskedArray:
        """Apply masking for no-data values."""
        if nodata is not None:
            masked = np.ma.masked_equal(data, nodata)
        else:
            masked = np.ma.masked_invalid(data)
        
        # Additional masking for extreme values
        masked = np.ma.masked_where(
            (data < self.nodata_threshold) | (data > 1e10),
            masked
        )
        
        return masked


# ============================================================================
# Rendering
# ============================================================================


class DimensionCalculator:
    """Calculate appropriate dimensions for rendering."""

    def __init__(self, config: MapConfig):
        self.config = config

    def calculate_dimensions(
        self,
        aspect_ratio: float
    ) -> Tuple[int, int]:
        """
        Calculate pixel dimensions that fit within map bounds.
        
        Args:
            aspect_ratio: Width/height ratio of raster
            
        Returns:
            Tuple of (width_px, height_px)
        """
        map_aspect = self.config.map_width / self.config.map_height
        
        if aspect_ratio > map_aspect:
            # Width-constrained
            width_px = int(self.config.map_width / 72 * self.config.dpi)
            height_px = int(width_px / aspect_ratio)
        else:
            # Height-constrained
            height_px = int(self.config.map_height / 72 * self.config.dpi)
            width_px = int(height_px * aspect_ratio)
        
        return width_px, height_px


class MatplotlibRasterRenderer:
    """Render raster data using matplotlib."""

    def __init__(self, config: MapConfig):
        self.config = config
        self.dimension_calculator = DimensionCalculator(config)

    def render(
        self,
        raster_data: RasterData,
        cmap: ListedColormap,
        norm: BoundaryNorm
    ) -> RenderedImage:
        """
        Render raster data to PIL Image.
        
        Args:
            raster_data: Raster data to render
            cmap: Matplotlib colormap
            norm: Boundary normalization
            
        Returns:
            RenderedImage with image and dimensions
            
        Raises:
            RenderingError: If rendering fails
        """
        try:
            width_px, height_px = self.dimension_calculator.calculate_dimensions(
                raster_data.aspect_ratio
            )
            
            # Create figure with exact dimensions
            fig, ax = plt.subplots(
                figsize=(width_px / self.config.dpi, height_px / self.config.dpi),
                dpi=self.config.dpi
            )
            
            # Set white background
            fig.patch.set_facecolor('white')
            ax.set_facecolor('white')
            
            # Render raster
            ax.imshow(
                raster_data.data,
                cmap=cmap,
                norm=norm,
                aspect='equal',
                interpolation='nearest'
            )
            ax.axis('off')
            plt.tight_layout(pad=0)
            
            # Save to buffer
            buffer = BytesIO()
            plt.savefig(
                buffer,
                format='png',
                dpi=self.config.dpi,
                transparent=False,
                bbox_inches='tight',
                pad_inches=0,
                facecolor='white'
            )
            plt.close(fig)
            
            # Convert to PIL Image
            buffer.seek(0)
            image = Image.open(buffer).convert("RGBA")
            
            # Calculate dimensions in points (1/72 inch)
            width_points = width_px * 72 / self.config.dpi
            height_points = height_px * 72 / self.config.dpi
            
            return RenderedImage(
                image=image,
                width_points=width_points,
                height_points=height_points
            )
            
        except Exception as e:
            raise RenderingError(f"Failed to render raster: {e}")


# ============================================================================
# Map Elements
# ============================================================================


class CompassRoseDrawer:
    """Draw a decorative compass rose on the map."""

    def __init__(self, x: float, y: float, radius: float = 45.0):
        self.x = x
        self.y = y
        self.radius = radius

    def draw(self, canvas_obj: canvas.Canvas) -> None:
        """Draw complete compass rose."""
        self._draw_circles(canvas_obj)
        self._draw_cardinal_directions(canvas_obj)
        self._draw_intermediate_directions(canvas_obj)
        self._draw_center_star(canvas_obj)

    def _draw_circles(self, c: canvas.Canvas) -> None:
        """Draw outer and inner circles."""
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(2)
        c.circle(self.x, self.y, self.radius, fill=0)
        
        c.setLineWidth(1)
        c.circle(self.x, self.y, self.radius * 0.2, fill=0)

    def _draw_cardinal_directions(self, c: canvas.Canvas) -> None:
        """Draw N, E, S, W directions with arrows."""
        directions = [
            ('N', 0, True),
            ('E', 90, False),
            ('S', 180, True),
            ('W', 270, False)
        ]
        
        for label, angle, has_arrow in directions:
            rad = math.radians(angle)
            
            # Calculate line endpoints
            outer_x = self.x + self.radius * 0.85 * math.sin(rad)
            outer_y = self.y + self.radius * 0.85 * math.cos(rad)
            inner_x = self.x + self.radius * 0.25 * math.sin(rad)
            inner_y = self.y + self.radius * 0.25 * math.cos(rad)
            
            # Draw line with appropriate style
            if has_arrow:
                c.setLineWidth(3)
                c.setStrokeColorRGB(0, 0, 0)
            else:
                c.setLineWidth(1.5)
                c.setStrokeColorRGB(0.4, 0.4, 0.4)
            
            c.line(inner_x, inner_y, outer_x, outer_y)
            
            # Draw arrow head for N/S
            if has_arrow:
                self._draw_arrow_head(c, rad)
            
            # Draw label
            self._draw_label(c, label, rad, is_north=(label == 'N'))

    def _draw_arrow_head(self, c: canvas.Canvas, rad: float) -> None:
        """Draw triangular arrow head."""
        c.setFillColorRGB(0, 0, 0)
        arrow_path = c.beginPath()
        
        # Arrow tip
        tip_x = self.x + self.radius * 0.95 * math.sin(rad)
        tip_y = self.y + self.radius * 0.95 * math.cos(rad)
        
        # Left wing
        left_rad = rad + math.radians(150)
        left_x = tip_x + 8 * math.sin(left_rad)
        left_y = tip_y + 8 * math.cos(left_rad)
        
        # Right wing
        right_rad = rad - math.radians(150)
        right_x = tip_x + 8 * math.sin(right_rad)
        right_y = tip_y + 8 * math.cos(right_rad)
        
        arrow_path.moveTo(tip_x, tip_y)
        arrow_path.lineTo(left_x, left_y)
        arrow_path.lineTo(right_x, right_y)
        arrow_path.close()
        c.drawPath(arrow_path, fill=1, stroke=0)

    def _draw_label(
        self,
        c: canvas.Canvas,
        label: str,
        rad: float,
        is_north: bool
    ) -> None:
        """Draw direction label."""
        label_x = self.x + self.radius * 1.15 * math.sin(rad)
        label_y = self.y + self.radius * 1.15 * math.cos(rad)
        
        c.setFillColorRGB(0, 0, 0)
        font_name = "Helvetica-Bold" if is_north else "Helvetica"
        font_size = 14 if is_north else 11
        c.setFont(font_name, font_size)
        
        text_width = c.stringWidth(label, font_name, font_size)
        c.drawString(label_x - text_width / 2, label_y - 4, label)

    def _draw_intermediate_directions(self, c: canvas.Canvas) -> None:
        """Draw NE, SE, SW, NW directions."""
        intermediate = [('NE', 45), ('SE', 135), ('SW', 225), ('NW', 315)]
        
        c.setLineWidth(0.8)
        c.setStrokeColorRGB(0.6, 0.6, 0.6)
        
        for label, angle in intermediate:
            rad = math.radians(angle)
            
            inner_x = self.x + self.radius * 0.25 * math.sin(rad)
            inner_y = self.y + self.radius * 0.25 * math.cos(rad)
            outer_x = self.x + self.radius * 0.75 * math.sin(rad)
            outer_y = self.y + self.radius * 0.75 * math.cos(rad)
            
            c.line(inner_x, inner_y, outer_x, outer_y)
            
            # Draw label
            label_x = self.x + self.radius * 1.2 * math.sin(rad)
            label_y = self.y + self.radius * 1.2 * math.cos(rad)
            
            c.setFont("Helvetica", 8)
            c.setFillColorRGB(0.3, 0.3, 0.3)
            text_width = c.stringWidth(label, "Helvetica", 8)
            c.drawString(label_x - text_width / 2, label_y - 3, label)

    def _draw_center_star(self, c: canvas.Canvas) -> None:
        """Draw decorative star at center."""
        c.setFillColorRGB(0, 0, 0)
        star_path = c.beginPath()
        
        for i in range(8):
            angle = math.radians(i * 45)
            r = self.radius * 0.15 if i % 2 == 0 else self.radius * 0.08
            x = self.x + r * math.sin(angle)
            y = self.y + r * math.cos(angle)
            
            if i == 0:
                star_path.moveTo(x, y)
            else:
                star_path.lineTo(x, y)
        
        star_path.close()
        c.drawPath(star_path, fill=1, stroke=0)


class LegendDrawer:
    """Draw map legend with color boxes and labels."""

    def __init__(
        self,
        x: float,
        y_start: float,
        box_size: int = 18,
        spacing: int = 25
    ):
        self.x = x
        self.y_start = y_start
        self.box_size = box_size
        self.spacing = spacing

    def draw(
        self,
        canvas_obj: canvas.Canvas,
        legend_items: List[LegendItem]
    ) -> None:
        """Draw complete legend."""
        legend_height = len(legend_items) * self.spacing + 50
        
        # Draw frame
        self._draw_frame(canvas_obj, legend_height)
        
        # Draw title
        self._draw_title(canvas_obj)
        
        # Draw items
        for i, item in enumerate(legend_items):
            self._draw_item(canvas_obj, item, i)

    def _draw_frame(self, c: canvas.Canvas, height: float) -> None:
        """Draw legend frame."""
        c.setStrokeColorRGB(0.3, 0.3, 0.3)
        c.setFillColorRGB(1, 1, 1)
        c.roundRect(
            self.x - 10,
            self.y_start - height + 10,
            170,
            height,
            5,
            fill=1,
            stroke=1
        )

    def _draw_title(self, c: canvas.Canvas) -> None:
        """Draw legend title."""
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(self.x, self.y_start + 15, "Legend")
        c.line(self.x, self.y_start, self.x + 140, self.y_start)

    def _draw_item(
        self,
        c: canvas.Canvas,
        item: LegendItem,
        index: int
    ) -> None:
        """Draw single legend item."""
        y_pos = self.y_start - 20 - index * self.spacing
        
        # Draw colored box
        r, g, b = item.to_rgb_tuple()
        c.setFillColorRGB(r, g, b)
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(0.5)
        c.rect(self.x, y_pos, self.box_size, self.box_size, fill=1, stroke=1)
        
        # Draw label
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica", 9)
        c.drawString(self.x + self.box_size + 8, y_pos + 4, item.label)


class LogoDrawer:
    """Draw logos on the map."""

    def __init__(
        self,
        logo_config: LogoConfig,
        page_width: float,
        page_height: float
    ):
        self.config = logo_config
        self.page_width = page_width
        self.page_height = page_height

    def draw(self, canvas_obj: canvas.Canvas) -> None:
        """Draw all configured logos."""
        if self.config.left_logo_path:
            self._draw_logo(
                canvas_obj,
                self.config.left_logo_path,
                is_left=True
            )
        
        if self.config.right_logo_path:
            self._draw_logo(
                canvas_obj,
                self.config.right_logo_path,
                is_left=False
            )

    def _draw_logo(
        self,
        c: canvas.Canvas,
        logo_path: Path,
        is_left: bool
    ) -> None:
        """Draw a single logo."""
        if not logo_path.exists():
            print(f"Warning: Logo not found at {logo_path}")
            return

        try:
            img = Image.open(logo_path)
            img_width, img_height = img.size
            aspect_ratio = img_width / img_height
            logo_width = self.config.logo_height * aspect_ratio
            
            if is_left:
                x = self.config.logo_margin_side
            else:
                x = self.page_width - self.config.logo_margin_side - logo_width
            
            y = (self.page_height - self.config.logo_margin_top - 
                 self.config.logo_height)
            
            c.drawImage(
                str(logo_path),
                x, y,
                width=logo_width,
                height=self.config.logo_height,
                preserveAspectRatio=True,
                mask='auto'
            )
        except Exception as e:
            print(f"Error drawing logo: {e}")


# ============================================================================
# PDF Composition
# ============================================================================


class PDFMapComposer:
    """Compose complete PDF map with all elements."""

    def __init__(self, document: MapDocument):
        self.document = document

    def compose(
        self,
        rendered_image: RenderedImage,
        raster_data: RasterData,
        legend_items: List[LegendItem]
    ) -> None:
        """
        Compose and save complete PDF map.
        
        Args:
            rendered_image: Rendered raster image
            raster_data: Original raster data for metadata
            legend_items: Legend items for the map
        """
        c = canvas.Canvas(
            str(self.document.output_path),
            pagesize=landscape(A4)
        )
        
        # Draw background and frame
        self._draw_background(c)
        self._draw_map_frame(c)
        
        # Draw main raster image
        self._draw_raster_image(c, rendered_image)
        
        # Draw decorative elements
        self._draw_logos(c)
        self._draw_title(c)
        self._draw_compass(c)
        self._draw_legend(c, legend_items)
        self._draw_metadata(c, raster_data)
        self._draw_footer(c)
        
        c.showPage()
        c.save()

    def _draw_background(self, c: canvas.Canvas) -> None:
        """Draw light gray background."""
        c.setFillColorRGB(0.98, 0.98, 0.98)
        c.rect(
            0, 0,
            self.document.config.page_width,
            self.document.config.page_height,
            fill=1
        )

    def _draw_map_frame(self, c: canvas.Canvas) -> None:
        """Draw white frame for the map."""
        c.setStrokeColorRGB(0.2, 0.2, 0.2)
        c.setFillColorRGB(1, 1, 1)
        c.setLineWidth(2)
        c.rect(
            self.document.config.map_margin_left,
            self.document.config.map_margin_bottom,
            self.document.config.map_width,
            self.document.config.map_height,
            fill=1,
            stroke=1
        )

    def _draw_raster_image(
        self,
        c: canvas.Canvas,
        rendered: RenderedImage
    ) -> None:
        """Draw centered raster image."""
        # Center image in map area
        img_x = (self.document.config.map_margin_left +
                (self.document.config.map_width - rendered.width_points) / 2)
        img_y = (self.document.config.map_margin_bottom +
                (self.document.config.map_height - rendered.height_points) / 2)
        
        c.drawInlineImage(
            rendered.image,
            img_x, img_y,
            width=rendered.width_points,
            height=rendered.height_points
        )

    def _draw_logos(self, c: canvas.Canvas) -> None:
        """Draw logos."""
        logo_drawer = LogoDrawer(
            self.document.logo_config,
            self.document.config.page_width,
            self.document.config.page_height
        )
        logo_drawer.draw(c)

    def _draw_title(self, c: canvas.Canvas) -> None:
        """Draw map title and subtitle."""
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(
            self.document.config.page_width / 2,
            self.document.config.page_height - 50,
            self.document.title
        )
        
        c.setFont("Helvetica", 10)
        c.drawCentredString(
            self.document.config.page_width / 2,
            self.document.config.page_height - 70,
            self.document.subtitle
        )

    def _draw_compass(self, c: canvas.Canvas) -> None:
        """Draw compass rose."""
        compass = CompassRoseDrawer(
            x=85,
            y=self.document.config.page_height - 160,
            radius=25
        )
        compass.draw(c)

    def _draw_legend(
        self,
        c: canvas.Canvas,
        legend_items: List[LegendItem]
    ) -> None:
        """Draw legend."""
        legend = LegendDrawer(
            x=30,
            y_start=self.document.config.page_height - 300
        )
        legend.draw(c, legend_items)

    def _draw_metadata(
        self,
        c: canvas.Canvas,
        raster_data: RasterData
    ) -> None:
        """Draw map metadata."""
        meta_x = 30
        meta_y = 50
        
        c.setFont("Helvetica-Bold", 10)
        c.drawString(meta_x, meta_y + 20, "Map Information")
        
        c.setFont("Helvetica", 8)
        c.drawString(meta_x, meta_y, f"CRS: {raster_data.metadata.crs}")
        c.drawString(
            meta_x,
            meta_y - 15,
            f"Bounds: {raster_data.metadata.bounds.left:.2f}, "
            f"{raster_data.metadata.bounds.bottom:.2f}"
        )

    def _draw_footer(self, c: canvas.Canvas) -> None:
        """Draw footer."""
        c.setFont("Helvetica", 8)
        c.drawCentredString(
            self.document.config.page_width / 2,
            20,
            "© 2026 | SLCR IITBHU | Decision Support System Tool"
        )


# ============================================================================
# Service Layer
# ============================================================================


class MapGenerationService:
    """Service for generating complete maps from raster data."""

    def __init__(
        self,
        style_parser: IStyleParser,
        raster_reader: IRasterReader,
        renderer: IRenderer
    ):
        self.style_parser = style_parser
        self.raster_reader = raster_reader
        self.renderer = renderer

    def generate_map(
        self,
        raster_path: Path,
        style_path: Path,
        document: MapDocument
    ) -> None:
        # Parse style
        legend_items = self.style_parser.parse(style_path)
        cmap, norm = ColormapFactory.create_colormap(legend_items)
        
        # Read raster
        raster_data = self.raster_reader.read(raster_path)
        
        # Render
        rendered_image = self.renderer.render(raster_data, cmap, norm)
        
        # Compose PDF
        composer = PDFMapComposer(document)
        composer.compose(rendered_image, raster_data, legend_items)


# ============================================================================
# Factory
# ============================================================================


class MapGenerationServiceFactory:
    """Factory for creating map generation services."""

    @staticmethod
    def create(config: MapConfig) -> MapGenerationService:
        """Create a fully configured map generation service."""
        style_parser = SLDStyleParser()
        raster_reader = RasterDataReader()
        renderer = MatplotlibRasterRenderer(config)
        
        return MapGenerationService(
            style_parser=style_parser,
            raster_reader=raster_reader,
            renderer=renderer
        )


# ============================================================================
# Facade
# ============================================================================


class GISMapGenerator:
    def __init__(
        self,
        raster_path: str | Path,
        sld_path: str | Path,
        output_path: str | Path,
        title: str,
        subtitle: str,
        left_logo_path: Optional[str | Path] = None,
        right_logo_path: Optional[str | Path] = None
    ):

        self.raster_path = Path(raster_path)
        self.sld_path = Path(sld_path)
        
        # Create configuration
        page_width, page_height = landscape(A4)
        config = MapConfig(page_width, page_height)
        
        logo_config = LogoConfig(
            left_logo_path=Path(left_logo_path) if left_logo_path else None,
            right_logo_path=Path(right_logo_path) if right_logo_path else None
        )
        
        self.document = MapDocument(
            title=title,
            subtitle=subtitle,
            output_path=Path(output_path),
            config=config,
            logo_config=logo_config
        )
        
        # Create service
        self.service = MapGenerationServiceFactory.create(config)

    def generate(self) -> None:
        """Generate the map PDF."""
        self.service.generate_map(
            self.raster_path,
            self.sld_path,
            self.document
        )


@app.task(bind=True,pydantic=True,name="raster_visual")
def raster_visual(self,payload:RasterVisual):
    try:
        temp_folder = Settings().TEMP_DIR+"/"+uuid.uuid4().hex
        Path(temp_folder).mkdir(parents=True, exist_ok=True)
        output_pdf = Path(temp_folder,Unique_name.unique_name_with_ext("raster","pdf"))
        resp=Geoserver().raster_download(Settings().TEMP_DIR,payload.rasterName,"dss_raster")
        generator = GISMapGenerator(resp["raster_path"], 
                                    resp["sld_path"], 
                                    str(output_pdf),
                                    payload.fileName,
                                    payload.moduleName,
                                    left_logo_path=f"{Settings().BASE_DIR}/media/images/iitbhu.png",
                                    right_logo_path=f"{Settings().BASE_DIR}/media/images/slcr.png",
                        )
        generator.generate()
        return str(output_pdf)

    except Exception as e:
        print("error occue is ",e)