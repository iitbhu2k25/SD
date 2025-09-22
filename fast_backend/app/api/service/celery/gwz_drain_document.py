import os
import io
import uuid
import logging
from reportlab.platypus import  Frame, Paragraph, Spacer, PageBreak
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from datetime import datetime
from shapely.geometry import mapping
from rasterio.io import MemoryFile
from shapely.ops import unary_union
from rasterio.mask import mask 
from contextlib import contextmanager
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field, asdict
from io import BytesIO
from pathlib import Path
from celery import chord
import numpy as np
import geopandas as gpd
import matplotlib.pyplot as plt
import contextily as ctx
import rasterio
from matplotlib.colors import ListedColormap, BoundaryNorm
from matplotlib.patches import Patch
from lxml import etree
from PIL import Image as PILImage
from reportlab.platypus import  Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    PageBreak, Image
)
from reportlab.platypus.frames import Frame
from celery import group, chord
from app.conf.settings import Settings
from app.api.service.geoserver import Geoserver
from app.conf.celery import app
from app.api.schema.stp_schema import  StpPriorityDrainReport
import math
from reportlab.platypus import Frame
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import letter
import rasterio
import contextily as ctx
import matplotlib.pyplot as plt
from rasterio.warp import calculate_default_transform, reproject
import numpy as np
import rasterio
import matplotlib.pyplot as plt
from celery_progress.backend import ProgressRecorder
import time
redis_client = Settings().redis_client

PILImage.MAX_IMAGE_PIXELS = 500000000
class STRPReportError(Exception):
    """Custom exception for STP report generation errors."""
    pass

class ValidationError(STRPReportError):
    """Raised when input validation fails."""
    pass

class ResourceError(STRPReportError):
    """Raised when resource operations fail."""
    pass


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)



@dataclass
class ReportConfig:
    """Configuration for report generation with validation."""
    title: str = "Comprehensive Report on the Groundwater Potential Zone "
    author: str = "IIT BHU"
    subject: str = "Groundwater Potential Zone Analysis"
    output_filename: str = field(default_factory=lambda: f"GWPZ_Report_{uuid.uuid4()}.pdf")
    page_size: Tuple = A4
    margins: Optional[Dict[str, float]] = None
    output_folder: Optional[str] = None
    frame = Frame(
            inch, inch,
            letter[0] - 2*inch,
            letter[1] - 2*inch,
            leftPadding=0, bottomPadding=0,
            rightPadding=0, topPadding=0,
            id='normal'
        )
    
    def __post_init__(self):
        if self.margins is None:
            self.margins = {
                'top': 4.7*cm,
                'bottom': 2.5*cm,
                'left': 2.5*cm,
                'right': 3.2*cm
            }
        
        if self.output_folder is None:
            self.output_folder = Settings().BASE_DIR
        
        # Ensure output folder exists
        Path(self.output_folder).mkdir(parents=True, exist_ok=True)
    
    def get_full_output_path(self) -> str:
        return str(Path(self.output_folder) / self.output_filename)

@dataclass
class StaticTextData:
    Drainage_Density: str = ""
    Elevation: str = ""
    Geomorphology: str = ""
    Groundwater_Recharge: str = ""
    Groundwater_Table: str = ""
    Lineament_Density: str = ""
    LULC: str = ""
    NDVI: str = ""
    Rainfall: str = ""
    Slope: str = ""
    Soil_Texture: str = ""
    TPI: str = ""
    Ground_water_Potential: str = ""

    
@dataclass
class TableData:
    """Table data with validation and conversion."""
    weights_table: Optional[List[List[str]]] = None
    village_priority_table: Optional[List[List[str]]] = None
    village_raw_data: Optional[List[Dict[str, Any]]] = None
    
    def __post_init__(self):
        if self.village_raw_data and not self.village_priority_table:
            try:
                self.village_priority_table = self._convert_raw_data_to_table()
            except Exception as e:
                logger.error(f"Failed to convert raw village data: {e}")
                self.village_priority_table = [
                    ["Village Name", "Very Low (%)", "Low (%)", "Medium (%)", "High (%)", "Very High (%)"]
                ]
        elif self.village_priority_table is None:
            self.village_priority_table = [
                ["Village Name", "Very Low (%)", "Low (%)", "Medium (%)", "High (%)", "Very High (%)"]
            ]
    
    def _convert_raw_data_to_table(self) -> List[List[str]]:
        """Convert raw dictionary data to table format with error handling."""
        if not self.village_raw_data:
            return []
        
        headers = ["Village Name", "Very Low (%)", "Low (%)", "Medium (%)", "High (%)", "Very High (%)"]
        table_data = [headers]
        
        try:
            # Sort by Very_High value in descending order
            sorted_data = sorted(
                self.village_raw_data, 
                key=lambda x: x.get('Very_High', 0) if isinstance(x, dict) else getattr(x, 'Very_High', 0), 
                reverse=True
            )
            
            for village_data in sorted_data:
                try:
                    # Handle both dict and object types
                    if hasattr(village_data, 'dict'):
                        data_dict = village_data.dict()
                    else:
                        data_dict = village_data
                    
                    village_name = data_dict.get('Village_Name', 'Unknown')
                    very_low = f"{data_dict.get('Very_Low', 0):.2f}"
                    low = f"{data_dict.get('Low', 0):.2f}"
                    medium = f"{data_dict.get('Medium', 0):.2f}"
                    high = f"{data_dict.get('High', 0):.2f}"
                    very_high = f"{data_dict.get('Very_High', 0):.2f}"
                    
                    row = [village_name, very_low, low, medium, high, very_high]
                    table_data.append(row)
                    
                except Exception as e:
                    logger.warning(f"Skipping invalid village data: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error processing village data: {e}")
            
        return table_data

@contextmanager
def managed_figure(figsize=(12, 10), dpi=200):
   
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    try:
        yield fig, ax
    finally:
        plt.close(fig)
        
def calculate_zoom_level(polygon, map_width, map_height):
    # Get the bounds of the polygon
    minx, miny, maxx, maxy = polygon.bounds

    # Calculate the width and height of the bounding box
    bbox_width = maxx - minx
    bbox_height = maxy - miny

    # Determine the maximum dimension
    max_dim = max(bbox_width, bbox_height)

    # Calculate zoom level based on the maximum dimension
    zoom_level = math.floor(math.log(360 / max_dim) / math.log(2))

    # Ensure zoom level is within the valid range
    zoom_level = max(1, min(21, zoom_level))

    return zoom_level,polygon.centroid.x,polygon.centroid.y

def validate_file_exists(filepath: Union[str, Path], description: str = "File") -> Path:
    """Validate that a file exists and return Path object."""
    path = Path(filepath)
    if not path.exists():
        raise ResourceError(f"{description} does not exist: {filepath}")
    return path

def validate_geodataframe(gdf: gpd.GeoDataFrame, name: str = "GeoDataFrame") -> None:
    """Validate GeoDataFrame input."""
    if gdf is None:
        raise ValidationError(f"{name} cannot be None")
    if gdf.empty:
        raise ValidationError(f"{name} cannot be empty")
    if gdf.crs is None:
        raise ValidationError(f"{name} must have a defined CRS")
    
class ImageManager:
    """Manages image insertion and placeholder creation."""
    
    @staticmethod
    def create_image_placeholder(figure_name: str) -> List:
        """Create image placeholder with error handling."""
        try:
            elements = []
            placeholder_text = f"[ {figure_name} will be inserted here ]"

            style = ParagraphStyle(
                'PlaceholderStyle',
                parent=getSampleStyleSheet()['Normal'],
                alignment=1,
                fontSize=11,
                textColor=colors.HexColor("#201E1E"),
                borderPadding=6,
                spaceAfter=6,
                spaceBefore=16,
                leading=14
            )

            placeholder = Paragraph(f"<b>{placeholder_text}</b>", style)
            elements.append(placeholder)
            elements.append(Spacer(1, 6))
            return elements
        except Exception as e:
            logger.error(f"Failed to create placeholder for {figure_name}: {e}")
            return [Spacer(1, 20)]
    
    @staticmethod
    def insert_actual_image(image_stream: BytesIO) -> Optional[List[Image]]:
        """Insert actual image with validation."""
        try:
            if not isinstance(image_stream, BytesIO):
                logger.error(f"Expected BytesIO, got {type(image_stream)}")
                return None
            
            image_stream.seek(0)
            return [Image(image_stream, width=550, height=400, hAlign='CENTER')]
        except Exception as e:
            logger.error(f"Failed to insert image: {e}")
            return None

class StyleManager:    
    _instance = None
    _styles = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._styles is None:
            self.styles = getSampleStyleSheet()
            self._create_custom_styles()
            StyleManager._styles = self.styles
        else:
            self.styles = StyleManager._styles
    
    def _create_custom_styles(self):
        """Create custom styles for the document."""
        custom_styles = [
            ('CustomTitle', {
                'parent': self.styles['Title'],
                'fontSize': 24,
                'spaceAfter': 30,
                'alignment': TA_CENTER,
                'textColor': colors.darkblue,
                'fontName': 'Helvetica-Bold'
            }),
            ('SectionHeader', {
                'parent': self.styles['Heading1'],
                'fontSize': 16,
                'spaceAfter': 12,
                'spaceBefore': 20,
                'textColor': colors.darkblue,
                'fontName': 'Helvetica-Bold',
                'borderWidth': 1,
                'borderColor': colors.darkblue,
                'borderPadding': 5
            }),
            ('SubsectionHeader', {
                'parent': self.styles['Heading2'],
                'fontSize': 14,
                'spaceAfter': 8,
                'spaceBefore': 15,
                'textColor': colors.darkgreen,
                'fontName': 'Helvetica-Bold'
            }),
            ('JustifiedBody', {
                'parent': self.styles['Normal'],
                'fontSize': 11,
                'spaceAfter': 12,
                'alignment': TA_JUSTIFY,
                'leftIndent': 0,
                'rightIndent': 0
            }),
            ('FigureCaption', {
                'parent': self.styles['Normal'],
                'fontSize': 10,
                'spaceAfter': 12,
                'spaceBefore': 6,
                'alignment': TA_CENTER,
                'fontName': 'Helvetica-Oblique',
                'textColor': colors.grey
            }),
            ('TableHeader', {
                'parent': self.styles['Normal'],
                'fontSize': 10,
                'alignment': TA_CENTER,
                'fontName': 'Helvetica-Bold',
                'textColor': colors.white
            })
        ]
        
        for name, kwargs in custom_styles:
            self.styles.add(ParagraphStyle(name=name, **kwargs))

class TableGenerator:
    """Handles table creation and styling."""
    
    @staticmethod
    def create_styled_table(data: List[List[str]]) -> Optional[Table]:
        """Create a styled table with headers and error handling."""
        if not data or len(data) < 2:
            logger.warning("Insufficient data for table creation")
            return None
        
        try:
            table = Table(data, hAlign='LEFT')
            
            table_style = [
                # Header row styling
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                
                # Data rows styling
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('ALIGN', (0, 1), (-1, -1), 'LEFT'),
                
                # Grid and borders
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                
                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
            ]
            
            table.setStyle(TableStyle(table_style))
            return table
            
        except Exception as e:
            logger.error(f"Failed to create table: {e}")
            return None

class SpatialDataset:
    def __init__(self):
        self.village_path = Settings().villages_path
    
    def find_village_from_catchment(self,clip:list)->gpd.GeoDataFrame:
        try:
            if not clip:
                raise ValidationError("Clip list cannot be empty")
            
            validate_file_exists(self.village_path, "Village file")
            
            gdf = gpd.read_file(self.village_path).to_crs(epsg=3857)
            gdf = gdf[gdf['ID'].isin(clip)]
            
            if gdf.empty:
                raise ValidationError(f"No village polygon found for clip IDs: {clip}")
            
            return gdf
        except Exception as e:
            logger.error(f"Failed to filter villages: {e}")
            raise
        
class MapGenerator:
    """Generates maps with improved error handling and resource management."""
    
    def __init__(self, dpi: int = 100):
        self.dpi = max(50, min(dpi, 600))  # Constrain DPI to reasonable range
    
    def _set_axis_limits(self, ax, bounds):
        """Set axis limits with margin."""
        try:
            xmin, ymin, xmax, ymax = bounds
            margin_x = (xmax - xmin) * 0.05
            margin_y = (ymax - ymin) * 0.05
            ax.set_xlim(xmin - margin_x, xmax + margin_x)
            ax.set_ylim(ymin - margin_y, ymax + margin_y)
        except Exception as e:
            logger.warning(f"Failed to set axis limits: {e}")

    def _color_raster(self, ax, cmap, norm, raster_path: str):
        """Color raster with error handling."""
        try:
            with rasterio.open(raster_path) as src:
                data = src.read(1, masked=True)
                bounds = src.bounds
                
                logger.debug(f"Raster CRS: {src.crs}, bounds: {bounds}, shape: {data.shape}")

                if np.ma.is_masked(data):
                    valid_data = data[~data.mask]
                else:
                    valid_data = data

                if valid_data.size == 0:
                    raise ValueError("Raster contains no valid data")

                im = ax.imshow(
                    data,
                    cmap=cmap,
                    norm=norm,
                    extent=[bounds.left, bounds.right, bounds.bottom, bounds.top],
                    origin='upper',
                    interpolation='bilinear',
                    aspect='equal',
                    alpha=0.9
                )

                return bounds, im
        except Exception as e:
            logger.error(f"Failed to color raster {raster_path}: {e}")
            raise ResourceError(f"Raster processing failed: {e}")

    def _save_plot(self, fig,file_path:str) -> None:
        file_path=file_path+".png"
        try:
            fig.savefig(
                file_path,
                format='png', 
                dpi=self.dpi,
                bbox_inches='tight', 
                pad_inches=0.1,
                facecolor='white',
                edgecolor='none'
            )
            return file_path
            logger.info(f"Plot saved to file: {file_path}")
        except Exception as e:
            logger.error(f"Failed to save plot: {e}")
            raise ResourceError(f"Plot saving failed: {e}")
    
    def _parse_color_map_entries(self, sld_path: str):
        """Parse SLD color map entries with error handling."""
        try:
            tree = etree.parse(sld_path)
            entries = tree.findall(".//{http://www.opengis.net/sld}ColorMapEntry")

            color_map = []
            for entry in entries:
                try:
                    quantity = float(entry.attrib.get("quantity"))
                    color = entry.attrib.get("color")
                    label = entry.attrib.get("label", "")
                    color_map.append((quantity, color, label))
                except (ValueError, TypeError) as e:
                    logger.warning(f"Skipping invalid color map entry: {e}")
                    continue

            if not color_map:
                raise ValueError("No valid color map entries found")

            return sorted(color_map, key=lambda x: x[0])
        except Exception as e:
            logger.error(f"Failed to parse SLD file {sld_path}: {e}")
            raise ResourceError(f"SLD parsing failed: {e}")

    def _hex_to_rgb_tuple(self, hex_color: str):
        """Convert hex color to RGB tuple with validation."""
        try:
            hex_color = hex_color.lstrip("#")
            if len(hex_color) != 6:
                raise ValueError(f"Invalid hex color length: {hex_color}")
            return tuple(int(hex_color[i:i+2], 16)/255.0 for i in (0, 2, 4))
        except Exception as e:
            logger.warning(f"Failed to convert hex color {hex_color}: {e}")
            return (0.5, 0.5, 0.5)  # Default gray
    

    def make_image(self, file_path: str, raster_path: str, sld_path: str, 
               filtered_vector: list) -> Optional[BytesIO]:
    
        try:
            validate_file_exists(raster_path, "Raster file")
            validate_file_exists(sld_path, "SLD file") 
            filtered = SpatialDataset().find_village_from_catchment(clip=filtered_vector)
            filtered_new = filtered.to_crs("EPSG:3857")
            single_polygon = unary_union(filtered_new.geometry)
            validate_geodataframe(filtered, "Filtered vector")

            color_map = self._parse_color_map_entries(sld_path)
            values, hex_colors, labels = zip(*color_map)
            rgb_colors = [self._hex_to_rgb_tuple(c) for c in hex_colors]
            cmap = ListedColormap(rgb_colors)
            norm = BoundaryNorm(list(values) + [max(values) + 1], len(values))
            
            # Create figure with context manager
            with rasterio.open(raster_path) as src:
                raster_data = src.read(1)  # Read first band
                raster_crs = src.crs
                raster_bounds = src.bounds
                width, height = src.width, src.height
                raster_transform = src.transform
            

            transform, new_width, new_height = calculate_default_transform(
                raster_crs, 'EPSG:3857', width, height, *raster_bounds
            )
            
            new_data = np.empty((new_height, new_width), dtype="float32")
            reproject(
                source=raster_data,
                destination=new_data,
                src_transform=raster_transform,
                src_crs=raster_crs,
                dst_transform=transform,
                dst_crs='EPSG:3857',
            )
            
            geojson_polygon = [mapping(single_polygon)]
            meta = {
                'driver': 'GTiff',
                'dtype': new_data.dtype,
                'nodata': -9999,  # Set nodata value (adjust if needed)
                'width': new_width,
                'height': new_height,
                'count': 1,  # Single-band raster
                'crs': 'EPSG:3857',
                'transform': transform
            }
            
            # Create in-memory raster for masking
            with MemoryFile() as memfile:
                with memfile.open(**meta) as dataset:
                    dataset.write(new_data, 1)  # Write reprojected data to band 1
                    masked_data, masked_transform = mask(
                        dataset=dataset,
                        shapes=geojson_polygon,
                        crop=True,
                        nodata=-9999
                    )
            masked_array = np.where(masked_data[0] == -9999, np.nan, masked_data[0])
            
            # Create visualization
            with managed_figure(figsize=(25, 25), dpi=self.dpi) as (fig, ax):
                # Calculate bounds of reprojected raster
                raster_bounds_reproj = rasterio.transform.array_bounds(new_height, new_width, transform)
                
                # Set axis limits
                self._set_axis_limits(ax, raster_bounds_reproj)
                
                # Add basemap
                ctx.add_basemap(
                    ax,
                    crs='EPSG:3857',
                    source=ctx.providers.Esri.WorldImagery,
                    attribution="© Esri",
                    alpha=0.7
                )
                
                # Overlay masked raster data
                ax.imshow(
                    masked_array,
                    extent=[
                        masked_transform[2],
                        masked_transform[2] + masked_array.shape[1] * masked_transform[0],
                        masked_transform[5] + masked_array.shape[0] * masked_transform[4],
                        masked_transform[5]
                    ],
                    cmap=cmap,
                    norm=norm,
                    alpha=0.7
                )

                
                # Overlay vector data
                vector_gs = filtered_new.geometry
                vector_gs.plot(
                    ax=ax,
                    facecolor='none',
                    edgecolor='black',
                    linewidth=2,
                    alpha=0.95,
                    linestyle='-'
                )
                
                # Set axis properties
                ax.set_xlabel("Longitude", fontsize=18)
                ax.set_ylabel("Latitude", fontsize=18)
                ax.tick_params(labelsize=14)    
                legend_elements = [
                    Patch(facecolor=c, edgecolor='black', label=l.strip())
                    for c, l in zip(rgb_colors, labels)
                ]
                
                ax.legend(
                    handles=legend_elements, 
                    title="Legends", 
                    loc='upper center',
                    bbox_to_anchor=(0.5, -0.12),
                    fontsize=20,
                    title_fontsize=34,
                    framealpha=0.9
                )

                plt.tight_layout()
                return self._save_plot(fig, file_path=file_path[:-4])
                    
        except Exception as e:
            logger.error(f"Failed to generate image: {e}")
            raise ResourceError(f"Image generation failed: {e}")
class StpDocument:
    """Main document class with improved error handling and resource management."""
    
    def __init__(self,folder_path: str=None):
        try:
            settings = Settings()
            self.raster_url = settings.GEOSERVER_EX_URL
            self.sld_url = settings.GEOSERVER_EX_URL
            self.document_path = settings.TEMP_DIR+"/documents"
            self.folder_path = folder_path
            os.makedirs(self.document_path, exist_ok=True)
            if self.folder_path is not None:
                os.makedirs(folder_path, exist_ok=True)
                os.makedirs(folder_path+"/geoserver", exist_ok=True)
                os.makedirs(folder_path+"/image", exist_ok=True)
            
        except Exception as e:
            logger.error(f"Failed to initialize StpDocument: {e}")
            raise STRPReportError(f"Initialization failed: {e}")
    
    def _geoserver_load(self, layer_names: List) -> List:
        """Load data from geoserver with error handling."""
        response = []
        for layer in layer_names:
            try:
                if hasattr(layer, 'layer_name'):
                    resp = Geoserver().raster_download(
                        temp_path=self.folder_path+"/geoserver", 
                        layer_name=layer.layer_name
                    )
                    response.append(resp)
                else:
                    logger.warning(f"Invalid layer object: {layer}")
                    response.append(None)
            except Exception as e:
                logger.error(f"Failed to download layer {getattr(layer, 'layer_name', 'unknown')}: {e}")
                response.append(None)
        return response
   
    def static_pdf(self, folder_path: list, csv_data: List,location_data:list,weight_data:list) -> str:
        """Generate static PDF with error handling."""
        try:
            config = ReportConfig(
                title="Comprehensive Report on the  Groundwater Potential Zone <br/>(GWPZ)",
                author="IIT BHU",
                output_folder=str(self.document_path)
            )
            
            static_data = StaticTextData(
                Drainage_Density = "Drainage density refers to the total length of streams per unit area, derived from DEMbased flow accumulation models. Regions with high drainage density exhibit efficient runoff removal, reducing infiltration capacity and limiting groundwater recharge. On the other hand, low drainage density indicates subdued runoff, increasing infiltration and recharge potential. Drainage density is also related to lithology and permeability, as highly fractured terrains may develop dense drainage but still support recharge. This parameter therefore reflects the balance between runoff concentration and groundwater percolation. Integrating drainage density helps distinguish recharge-prone valleys from runoff-dominated hilly terrains (Magesh et al., 2012; Chowdhury et al., 2009).",
                Elevation = "Elevation and slope derived from a DEM play a vital role in hydrological analysis as they control runoff, infiltration, and watershed delineation. Areas with higher elevation and steep slopes generally favor runoff, resulting in reduced infiltration opportunities. Conversely, lower elevation zones with gentle slopes promote water stagnation and infiltration, enhancing recharge potential. Elevation data also helps in identifying depressions, valleys, and floodplains where aquifers are more likely to be recharged. DEM-based slope and topographic indices are widely used in groundwater studies to identify suitable recharge zones. Thus, DEM provides the foundational layer for delineating hydrological processes in groundwater modeling (Machiwal et al., 2011; Jha et al., 2007).",
                Geomorphology = "Geomorphological features such as pediplains, alluvial plains, valley fills, and structural hills directly reflect hydrogeological conditions. Features like pediments and buried pediplains often serve as productive groundwater zones due to enhanced infiltration and storage. In contrast, structural hills and ridges are poor groundwater potential zones because of shallow weathered layers and high runoff. Alluvial plains and floodplains typically contain thick, unconsolidated sediments, making them excellent aquifer zones. Geomorphological mapping thus provides direct evidence of recharge and storage conditions of an area. Incorporating this layer helps in classifying terrains based on groundwater favorability (Krishnamurthy et al., 1996; Chowdhury et al., 2009). ",
                Groundwater_Recharge = "Recharge estimation quantifies the replenishment of aquifers through rainfall infiltration, seepage from rivers, and percolation from irrigation return flows. The water table fluctuation method and specific yield approaches are commonly used for recharge estimation. High recharge zones are more sustainable for groundwater development, while low recharge areas require conservation or artificial recharge interventions. Recharge mapping integrates multiple parameters such as rainfall, soil, and geomorphology to assess sustainability. Thus, groundwater recharge is a critical layer that validates and refines the overall groundwater potential zonation output. It provides a measure of the aquifer’s resilience to extraction and long-term sustainability (Healy & Cook, 2002; Patra et al., 2018).",
                Groundwater_Table = "Depth-to-water level data provides direct evidence of aquifer storage and availability. Shallow water tables typically indicate higher groundwater potential, while deeper water tables reflect limited storage or over-extraction. Seasonal fluctuations in water levels also provide insights into recharge and extraction dynamics. Areas with consistent shallow water tables may serve as priority zones for groundwater development, while declining trends highlight over-stressed aquifers. Groundwater table mapping also allows validation of potential zonation derived from indirect indicators. This parameter therefore acts as both a diagnostic and validation tool in GWPZ studies (Singh et al., 2013; CGWB, 2014).",
                Lineament_Density = "Lineaments represent linear features such as faults, fractures, and joints, which act as conduits for groundwater movement. Areas with high lineament density generally have greater secondary porosity, enhancing infiltration and storage. Lineament density mapping helps to identify zones of structural weakness where recharge and groundwater flow are more pronounced. In hard rock terrains, groundwater availability is almost entirely controlled by fracture and fault zones. Hence, mapping lineaments provides valuable input for identifying recharge-prone areas in crystalline rock formations. This layer is particularly important for groundwater exploration in semiarid and hard-rock terrains (Edet et al., 1998; Sander, 2007).",
                LULC = "LULC strongly influences the hydrological cycle by controlling infiltration, runoff, and evapotranspiration. Vegetated surfaces such as forests and agricultural lands enhance infiltration and groundwater recharge, while built-up areas limit infiltration and increase surface runoff. Water bodies act as recharge sources where seepage occurs, while barren lands may either promote infiltration or runoff depending on soil and slope conditions. LULC also provides indirect information on anthropogenic extraction pressure, as agricultural zones generally rely on groundwater irrigation. Seasonal changes in cropping intensity and urban expansion alter recharge and extraction dynamics over time. Therefore, LULC classification is vital for evaluating the human– natural interactions affecting groundwater systems (Kumar et al., 2014; Rahmati et al., 2015)",
                NDVI = "NDVI is derived from remote sensing data and indicates vegetation density and vigor. Higher NDVI values are generally associated with increased infiltration and reduced surface runoff due to better canopy cover and root structures. Dense vegetation also enhances soil organic matter and porosity, indirectly improving recharge potential.  Conversely, low NDVI areas with sparse vegetation are more prone to runoff and less infiltration. NDVI also serves as a proxy for evapotranspiration demand, linking vegetation growth with water use. Thus, NDVI is an important ecological indicator for groundwater zonation studies (Panda et al., 2010; Magesh et al., 2012).",
                Rainfall = "Rainfall is the primary source of groundwater recharge, contributing to both direct infiltration and surface water percolation. Areas receiving high rainfall generally have greater recharge potential, provided the terrain and soil conditions permit infiltration. Long-term rainfall records are crucial to capture spatial variability and inter-annual fluctuations influencing recharge. Rainfall also influences runoff, evapotranspiration, and soil moisture balance, making it a fundamental input in groundwater modeling. Interpolation of rainfall station data allows spatial mapping of recharge potential across the study area. Hence, rainfall data forms the baseline for evaluating recharge-driven zonation (Nag & Ghosh, 2013; Kumar et al., 2007).",
                Slope = "",
                Soil_Texture = "Soil texture governs infiltration rates, soil moisture retention, and percolation into deeper strata. Coarse-textured soils such as sandy and loamy soils allow rapid infiltration, enhancing groundwater recharge, while fine-textured clay soils restrict water movement. Soil depth also influences recharge, as deeper profiles promote greater percolation compared to shallow rocky soils. Soil permeability, porosity, and hydraulic conductivity directly impact the availability of groundwater recharge zones. In agricultural areas, soil also determines irrigation water demand, influencing the balance between extraction and recharge. Hence, soil mapping is crucial in groundwater studies to identify zones with high infiltration capacity (Das & Pardeshi, 2018; Todd &Mays, 2005)",
                TPI = "",
                Ground_water_Potential= "The final GWPZ map (Figure 14) provides a spatial representation of areas classified into very low, low, moderate, high, and very high groundwater potential categories, based on the integrated GIS–AHP analysis of multiple conditioning factors. This map distinctly highlights zones with higher recharge and storage capacity, offering critical insights for groundwater development, artificial recharge, and sustainable resource management. The classified zonation supports strategic decision-making for water resource planners, enabling prioritization of interventions such as well drilling, recharge structure placement, and conservation initiatives. The potential values depicted on the map reflect the cumulative weighted influence of geomorphology, drainage density, soil, lineament density,rainfall, and other relevant parameters, ensuring a comprehensive evaluation of groundwater availability. Thus, the GWPZ map serves as a valuable decision-support tool for policymakers, engineers, and stakeholders engaged in sustainable groundwater management (cf. Jha et al., 2007; Magesh et al., 2012)."


            )
                           
            table_data = TableData(village_raw_data=csv_data,weights_table=weight_data)
            generator = ReportGenerator(config, static_data, table_data)
            return generator.generate_report(layer_names=folder_path,location_data=location_data)
            
        except Exception as e:
            logger.error(f"Failed to generate static PDF: {e}")
            raise STRPReportError(f"PDF generation failed: {e}")

    def _raster_loader(self, folder_path: str, layer_names: List) -> List:
        """Load raster data with error handling."""
        try:
            return self._geoserver_load(folder_path, layer_names)
        except Exception as e:
            logger.error(f"Failed to load raster data: {e}")
            return []

    def report_generator(self, layer_names: List, csv_data: List,location_data:list,weight_data:list) -> str:
        """Generate complete report with automatic cleanup."""
        try:
            if not layer_names:
                raise ValidationError("Layer names list cannot be empty")
            
            try:

                # Generate PDF
                pdf_path = self.static_pdf(folder_path=layer_names, csv_data=csv_data,location_data=location_data,weight_data=weight_data)
                
                logger.info(f"Report generated successfully: {pdf_path}")
                return pdf_path
            except Exception as e:
                pass
            # finally:
            #     # Optional: Clean up temp folder after PDF generation
            #     # Comment this out if you want to keep images for debugging
            #     try:
            #         shutil.rmtree(temp_folder)
            #         logger.info(f"Cleaned up temporary folder: {temp_folder}")
            #     except Exception as e:
            #         logger.warning(f"Failed to cleanup temporary folder {temp_folder}: {e}")
                
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            raise STRPReportError(f"Report generation failed: {e}")

class ReportGenerator:
    """Main report generation class with improved error handling."""
    
    def __init__(self, config: 'ReportConfig', static_data: 'StaticTextData', 
                 table_data: 'TableData', dpi: int = 100):
        
        self.config = config
        self.static_data = static_data
        self.table_data = table_data
        self.style_manager = StyleManager()
        self.elements = []
        self.village_file = Settings().villages_path
        self.dpi = max(50, min(dpi, 600))  # Constrain DPI
        self.iit_bhu_logo = f"{Settings().BASE_DIR}/media/images/iitbhu.png"
        self.slcr_logo = f"{Settings().BASE_DIR}/media/images/slcr.png"

    def _draw_logos(self, canvas, doc):
        """Draw logos on every page."""
        try:
            logo_y_position = letter[1] - 1*inch  # Move logos higher
            logo_size = 0.8*inch  # Make logos smaller to fit better
            
            # Check if logo files exist before drawing
            if os.path.exists(self.iit_bhu_logo):
                canvas.drawImage(
                    self.iit_bhu_logo,
                    0.5*inch,
                    logo_y_position,
                    width=logo_size, 
                    height=logo_size,
                    preserveAspectRatio=True,
                    mask='auto'
                )
                logging.info(f"Drew IIT BHU logo from: {self.iit_bhu_logo}")
            else:
                logging.warning(f"IIT BHU logo not found at: {self.iit_bhu_logo}")
            
            if os.path.exists(self.slcr_logo):
                canvas.drawImage(
                    self.slcr_logo,
                    letter[0] - (logo_size + 0.5*inch),
                    logo_y_position,
                    width=logo_size, 
                    height=logo_size,
                    preserveAspectRatio=True,
                    mask='auto'
                )
                logging.info(f"Drew SLCR logo from: {self.slcr_logo}")
            else:
                logging.warning(f"SLCR logo not found at: {self.slcr_logo}")
            
        except Exception as e:
            logging.error(f"Error drawing logos: {str(e)}")
           
            logging.error(f"Current working directory: {os.getcwd()}")
            logging.error(f"IIT BHU logo path: {self.iit_bhu_logo}")
            logging.error(f"SLCR logo path: {self.slcr_logo}")

    def _create_header_footer(self, canvas, doc):
        """Create header and footer for each page including logos."""
        canvas.saveState()
        
        try:

            self._draw_logos(canvas, doc)
            page_num = canvas.getPageNumber()
            text = f"Page {page_num}"
            canvas.setFont('Helvetica', 9)
            canvas.drawRightString(letter[0] - inch, 0.75*inch, text)
        except Exception as e:
            logging.error(f"Error creating header/footer: {str(e)}")
        finally:
            canvas.restoreState()

    def _create_title_page_header(self, canvas, doc):
        """Create header for title page with logos positioned to avoid overlap."""
        canvas.saveState()
        
        try:
            # Draw logos on title page in header area
            logo_y_position = letter[1] - 0.8*inch  # Higher position for title page
            logo_size = 1*inch  # Slightly larger for title page
            
            if os.path.exists(self.iit_bhu_logo):
                canvas.drawImage(
                    self.iit_bhu_logo,
                    0.5*inch,
                    logo_y_position,
                    width=logo_size, 
                    height=logo_size,
                    preserveAspectRatio=True,
                    mask='auto'
                )
            
            if os.path.exists(self.slcr_logo):
                canvas.drawImage(
                    self.slcr_logo,
                    letter[0] - (logo_size + 0.5*inch),
                    logo_y_position,
                    width=logo_size, 
                    height=logo_size,
                    preserveAspectRatio=True,
                    mask='auto'
                )
        except Exception as e:
            logging.error(f"Error drawing title page logos: {str(e)}")
        finally:
            canvas.restoreState()

    def _add_title_page(self):
        """Add title page to the report."""
        try:
            self.elements.append(Spacer(1, 1.5*inch))
            title = Paragraph(self.config.title, self.style_manager.styles['CustomTitle'])
            subtitle = Paragraph(
                "A Geospatial and Multi-Criteria Analysis for Groundwater Zone Prioritization",
                self.style_manager.styles['Heading2']
            )
            
            details = f"""
            <para align="center">
            <b>Prepared by:</b> {self.config.author}<br/>
            <b>Date:</b> {datetime.now():%B %d, %Y}<br/>
            <b>Subject:</b> {self.config.subject}
            </para>
            """
            
            content = [
                title, 
                Spacer(1, 50),
                subtitle, 
                Spacer(1, 100),
                Paragraph(details, self.style_manager.styles['Normal']),
                PageBreak()
            ]
            
            self.elements.extend(content)
        except Exception as e:
            logging.error(f"Error adding title page: {str(e)}")

    def _add_executive_summary(self):
        """Add executive summary section."""
        try:
            self.elements.append(Paragraph("1. Executive Summary", 
                                         self.style_manager.styles['SectionHeader']))
            
            summary_text = """
            This report presents a GIS-based multi-criteria evaluation (MCE) framework for
            groundwater potential zonation (GWPZ). The module integrates all those layers which are
            mentioned in the CPHEEO manual for the groundwater potential zonation, and some
            additional layers to provide the robust result. Thus, ten thematic raster layers topography
            (DEM, slope, drainage density), soil and geomorphology, land use/land cover (LULC),
            rainfall, vegetation index (NDVI), lineament and fracture density, groundwater table depth,
            and recharge estimate to generate a composite groundwater potential map. The outputs
            serve as a decision-support tool for water resource managers, planners, and policymakers,
            guiding interventions such as site selection for recharge structures, irrigation well planning,
            and water conservation measures tailored to local hydrogeological conditions. Importantly,
            the module supports the achievement of Sustainable Development Goal (SDG) 6: “Ensure
            availability and sustainable management of water and sanitation for all”, especially Target
            6.4, which emphasizes sustainable withdrawals and water-use efficiency to combat water
            scarcity (United Nations, 2015). By strengthening groundwater management, the module
            also contributes to SDG 2 (Zero Hunger) through agricultural water security, SDG 11
            (Sustainable Cities and Communities) via resilient water infrastructure, and SDG 13
            (Climate Action) by enhancing adaptation to climate variability.
            The effectiveness of GIS-MCE techniques in groundwater potential zonation has been
            demonstrated in several studies across India and globally (Jha, Chowdary, & Chowdhury,
            2007; Magesh, Chandrasekar, & Soundranayagam, 2012; Rahmati, Nazari Samani,
            Mahmoodi, & Mahdavi, 2016). By embedding this module into the broader Decision
            Support System (DSS), the present work provides a reliable scientific basis for integrated
            water resources management (IWRM), ensuring equitable and sustainable utilization of
            groundwater resources in the study region.
            """
            
            self.elements.append(Paragraph(summary_text, self.style_manager.styles['JustifiedBody']))
            self.elements.append(Spacer(1, 20))
        except Exception as e:
            logger.error(f"Failed to add executive summary: {e}")

    def _add_study_area_overview(self, location_data) -> None:
        self.elements.append(Paragraph("2. Study Area Overview",
                                    self.style_manager.styles['SectionHeader']))
        self.elements.append(Spacer(1, 0.2 * inch))

        # Compose your narrative and location details
        narrative = ("The study area encompasses selected villages and urban settlements "
                    "characterized by varied physiographic and hydrological conditions.")

        lines = [
            narrative,
            "",
            f"River: {location_data[0][1]}",
            f"Stretch(s): {', '.join(str(location_data[1][1]))}",
            f"Drain(s): {', '.join(str(location_data[2][1]))}",
            f"Catchment(s): {', '.join(location_data[3][1])}"
        ]
        content = "<br/>".join(lines)

        self.elements.append(Paragraph(content, self.style_manager.styles['JustifiedBody']))
        self.elements.append(PageBreak())
    
    def _add_methodology_section(self,layer_names: List[str]):
        """Add methodology section."""
        try:
            self.elements.append(Paragraph("3. Database and Methodology", 
                                         self.style_manager.styles['SectionHeader']))
            
            # Database subsection
            self.elements.append(Paragraph("3.1 Database", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            database_text = """
            A range of spatial and non-spatial datasets were integrated for the analysis
            of the groundwater potential zonation. Details of these factors are mentioned below:
            """
            
            self.elements.append(Paragraph(database_text, self.style_manager.styles['JustifiedBody']))
            

            factors = [
                ("Drainage_Density", self.static_data.Drainage_Density),
                ("Elevation", self.static_data.Elevation),
                ("Groundwater_Recharge", self.static_data.Groundwater_Recharge),
                ("Groundwater_Table", self.static_data.Groundwater_Table),
                ("Lineament_Density", self.static_data.Lineament_Density),
                ("LULC", self.static_data.LULC),
                ("NDVI", self.static_data.NDVI),
                ("Rainfall", self.static_data.Rainfall),
                ("Slope", self.static_data.Slope),
                ("Soil_Texture", self.static_data.Soil_Texture),
                ("TPI", self.static_data.TPI),
                ("Ground_water_Potential", self.static_data.Ground_water_Potential),
            ]
            
            factors_data = []
            for factor_name, description in factors:
                name = factor_name.replace("_", " ")
                match = next(filter(lambda d: d.get("file_name") == factor_name, layer_names), None)
                if match:
                    factors_data.append((name,
                        description,
                        match["file_path"]
                    ))
            self._add_fallback_elements(factors_data)
            self.elements.append(Spacer(1, 15))
            # Methodology subsection
            self.elements.append(Paragraph("3.2 Methodology", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            methodology_text = """
            The methodology section details the systematic approach employed to process, analyze,
            and integrate multiple spatial datasets for assessing groundwater potential zonation using
            GIS and remote sensing techniques. The workflow incorporates data preparation,
            transformation, multi-criteria decision analysis (MCDA), and final potentiality mapping.
            Working flowchart of the stepwise methodology for this module is shown in the Figure 13
            below:
            """
            
            self.elements.append(Paragraph(methodology_text, self.style_manager.styles['JustifiedBody']))
            
            self.elements.append(Paragraph("3.2.1 Pre-processing", 
                                        self.style_manager.styles['SubsectionHeader']))
            preprocessing_text = """Pre-processing involves the preparation and conditioning of raw spatial data to ensure consistency, accuracy, and compatibility for analysis. All spatial datasets including satellite imagery, digital elevation models (SRTM), and ancillary vector data are projected into a common coordinate reference system to maintain spatial coherence; specifically, the WGS 1984 UTM Zone 44N projection system (EPSG: 32644) and at 30 m of spatial resolution is used to ensure precise georeferencing aligned with the study region. Maintaining spatial resolution integrity is critical; therefore, resampling techniques such as nearest neighbor are selectively applied to harmonize dataset resolutions without compromising data quality. Additional pre-processing steps include radiometric and geometric corrections for satellite imagery, DEM smoothing, and addressing missing data gaps."""
            self.elements.append(Paragraph(preprocessing_text, self.style_manager.styles['JustifiedBody']))

            # 3.2.2 Reclassification
            self.elements.append(Paragraph("3.2.2 Reclassification", 
                                        self.style_manager.styles['SubsectionHeader']))
            reclassification_text = """Reclassification transforms continuous and categorical input datasets into standardized suitability classes based on defined thresholds. For example, land use types may be reclassified into suitability categories such as 'Highly Suitable', 'Moderately Suitable', and 'Unsuitable' according to their environmental impact and construction feasibility. This step is critical to harmonize heterogeneous data scales and to facilitate integration in multi-criteria evaluation (Malczewski, 2006)."""
            self.elements.append(Paragraph(reclassification_text, self.style_manager.styles['JustifiedBody']))

            # 3.2.3 Normalization
            self.elements.append(Paragraph("3.2.3 Normalization", 
                                        self.style_manager.styles['SubsectionHeader']))
            normalization_text = """Normalization standardizes the reclassified parameters to a common numeric scale, typically ranging from 0 to 1, to enable unbiased comparison and combination of different criteria. A widely used approach in spatial decision support is fuzzy membership functions, which translate input variable values into membership grades reflecting degrees of suitability or preference. These functions capture uncertainty and gradual transitions between classes, improving the modeling of continuous environmental factors."""
            self.elements.append(Paragraph(normalization_text, self.style_manager.styles['JustifiedBody']))

            # 3.2.4 Multi-Criteria Decision Analysis (MCDA)
            self.elements.append(Paragraph("3.2.4 Multi-Criteria Decision Analysis (MCDA)", 
                                        self.style_manager.styles['SubsectionHeader']))
            mcda_text = """Multi-Criteria Decision Analysis (MCDA) provides a structured approach for evaluating the suitability of groundwater potential zonation based on multiple, often conflicting, criteria. In the context of wastewater treatment, MCDA facilitates objective decision-making by quantifying the influence of each parameter and integrating them into a unified assessment framework."""
            self.elements.append(Paragraph(mcda_text, self.style_manager.styles['JustifiedBody']))

            # 3.2.4.1 Parameter Influence
            self.elements.append(Paragraph("3.2.4.1 Parameter Influence", 
                                        self.style_manager.styles['SubsectionHeader']))
            param_influence_text = """The influence of each parameter is quantified to determine its relative impact on groundwater potential zonation. Parameters may include influent quality, treatment capacity, land requirement, cost, environmental impact, and regulatory compliance. The importance (weight) of each parameter is determined using methods such as Analytic Hierarchy Process (AHP) or expert elicitation in the subsequent steps."""
            self.elements.append(Paragraph(param_influence_text, self.style_manager.styles['JustifiedBody']))

            # 3.2.4.2 Pairwise Comparison Matrix (PCM)
            self.elements.append(Paragraph("3.2.4.2 Pairwise Comparison Matrix (PCM)", 
                                        self.style_manager.styles['SubsectionHeader']))
            pcm_text = """Within the MCDA-AHP framework, the pairwise comparison matrix serves as a key instrument for systematically evaluating the relative importance of each criterion in relation to the others. Decision-makers assign comparative scores to each criterion pair according to their influence, indicating the degree of preference for one over the other. These evaluations construct the matrix, which is then analyzed to calculate the weight assigned to each respective criterion. The logical consistency of these judgments is assessed using the Consistency Index (CI) and Consistency Ratio (CR). If the CR surpasses the commonly accepted threshold (usually 0.10), the pairwise comparisons are revisited and adjusted until satisfactory consistency is achieved (Saaty, 1980). This approach strengthens the objectivity, clarity, and robustness of the multi-criteria decision-making process."""
            self.elements.append(Paragraph(pcm_text, self.style_manager.styles['JustifiedBody']))

            # 3.2.4.3 Consistency Index and Criteria Weight
            self.elements.append(Paragraph(
            "3.2.4.3 Consistency Index and Criteria Weight", 
            self.style_manager.styles['SubsectionHeader']
            ))

            consistency_text = """In AHP, the consistency index quantifies the logical consistency of pairwise 
            comparison matrices. It is defined as:<br/><br/>

                        <b>CI = (λ<sub>max</sub> - n) / (n - 1)</b><br/><br/>

            Where:<br/>
            - λ<sub>max</sub>: Principal eigenvalue of the comparison matrix<br/><br/>
            
            - n: Number of criteria<br/><br/>

            A Consistency Ratio (CR) is also calculated to assess acceptability:<br/><br/>

            <b>CR = CI / RI</b><br/><br/>

            where RI is the Random Consistency Index, dependent on n. CR values less than 0.1 are generally considered acceptable.<br/><br/>

            Again, RI was calculated as per the index provided by <b>Saaty, T.L., 1980 in Table 8</b>.<br/><br/>

            In the present module, the weight of each condition factor was determined 
            based on the CR value 0.073. The weight of each condition factor is shown in the table below.
            """

            self.elements.append(Paragraph(consistency_text, self.style_manager.styles['JustifiedBody']))
            self.elements.append(Paragraph(
                "3.2.4.4 Simple Additive Weighting (SAW) Method", 
                self.style_manager.styles['SubsectionHeader']
            ))

            saw_text = """While, if the Simple Additive Weighting (SAW) method is used:<br/><br/>

            <b>S<sub>j</sub> = Σ<sup>n</sup><sub>i=1</sub> ω<sub>i</sub> · S<sub>ij</sub></b><br/><br/>

            Where:<br/>
            <i>S<sub>j</sub></i>: Suitability score for alternative <i>j</i>,<br/>
            <i>ω<sub>i</sub></i>: Weight of Criterion <i>i</i>,<br/>
            <i>S<sub>ij</sub></i>: Normalized score of criterion <i>i</i> for alternative <i>j</i>
            """

            self.elements.append(Paragraph(saw_text, self.style_manager.styles['JustifiedBody']))

            self.elements.append(PageBreak())

        except Exception as e:
            logger.error(f"Failed to add methodology section: {e}")
      
    
    def _add_fallback_elements(self, processed_factors: List[Tuple[str, str, str]]):
        try:
            for factor_title, static_text, figure_path in processed_factors:
                    # Add factor title and text
                    self.elements.append(Paragraph(
                        factor_title, 
                        self.style_manager.styles['SubsectionHeader']
                    ))
                    
                    if static_text.strip():
                        self.elements.append(Paragraph(
                            static_text, 
                            self.style_manager.styles['JustifiedBody']
                        ))
                    
                    self.elements.append(Paragraph(
                        factor_title, 
                        self.style_manager.styles['FigureCaption']
                    ))

                    if figure_path:
                        with open(figure_path, 'rb') as f:
                            print("read image")
                            image_bytes = io.BytesIO(f.read())
                            image_elements = ImageManager.insert_actual_image(image_bytes)
                            if image_elements:
                                self.elements.extend(image_elements)
                    self.elements.append(Spacer(1, 15))
                    self.elements.append(PageBreak())
        except Exception as e:
            logger.error(f"Error processing Celery results: {e}")
            raise

    def _add_results_section(self,layer_names: List):
        try:
            self.elements.append(Paragraph("4. Results", self.style_manager.styles['SectionHeader']))
            
            # Priority factors subsection
            self.elements.append(Paragraph("4.1 Details of the Assigned Weights:", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            factors_text = """
            The selected weights, derived through the Analytic Hierarchy Process (AHP), represent the
            relative significance of each thematic layer in controlling groundwater occurrence and
            recharge potential. These weights ensure that critical factors such as geomorphology, soil
            texture, lineament density, and rainfall are appropriately emphasized in the multi-criteria
            evaluation. The MCDA results provide a spatially explicit prioritization of groundwater
            potential zones, effectively distinguishing areas into very high, high, moderate, low, and
            very low categories. This zonation supports informed, transparent, and scientifically robust
            decision-making for groundwater exploration, development, and management.
            """
            
            try:
                factors_data = []
                key = "Ground_water_Potential"
                name=key.replace("_", " ")
                match = next((d for d in layer_names if d.get("file_name") == key), None)
                if match:
                    factors_data.append((name,factors_text, match["file_path"]))
                self._add_fallback_elements(factors_data)
                self.elements.append(Spacer(1, 15))
            except Exception as e:
                logger.error(f"Failed to add factors section: {e}")
                print(e)
            
            # Weights details
            self.elements.append(Paragraph("4.2 Details of the Assigned Weights", 
                                         self.style_manager.styles['SubsectionHeader']))
            

            weight_text="""The selected weights, derived through the Analytic Hierarchy Process (AHP), represent the
            relative significance of each thematic layer in controlling groundwater occurrence and
            recharge potential. These weights ensure that critical factors such as geomorphology, soil
            texture, lineament density, and rainfall are appropriately emphasized in the multi-criteria
            evaluation. The MCDA results provide a spatially explicit prioritization of groundwater
            potential zones, effectively distinguishing areas into very high, high, moderate, low, and
            very low categories. This zonation supports informed, transparent, and scientifically robust
            decision-making for groundwater exploration, development, and management."""
            self.elements.append(Paragraph(weight_text, self.style_manager.styles['JustifiedBody']))
            weights_table = TableGenerator.create_styled_table(self.table_data.weights_table)
            if weights_table:
                self.elements.append(weights_table)
            
            self.elements.append(Spacer(1, 20))
            
            # Village-wise analysis
            self.elements.append(Paragraph("4.3 Village-wise Analysis of the STP Priority", 
                                         self.style_manager.styles['SubsectionHeader']))
            
        
            # Village analysis table
            village_table = TableGenerator.create_styled_table(self.table_data.village_priority_table)
            if village_table:
                self.elements.append(village_table)
                self.elements.append(Paragraph("Table 2: Details of the Village-wise STP Priority Analysis", 
                                             self.style_manager.styles['FigureCaption']))
            
            self.elements.append(PageBreak())
            
        except Exception as e:
            logger.error(f"Failed to add results section: {e}")

    def _add_references(self):
        """Add references section."""
        try:
            self.elements.append(Paragraph("5. References", self.style_manager.styles['SectionHeader']))
            
            references = [
                "CGWB. (2014). Ground Water Year Book – India 2013–14. Central Ground Water Board, Ministry of Water Resources, Government of India.",
                "Chowdhury, A., Jha, M. K., & Chowdary, V. M. (2009). Delineation of groundwater recharge zones and identification of artificial recharge sites in West Medinipur district, West Bengal, using remote sensing and GIS. Hydrogeology Journal, 17(6), 1199–1212. https://doi.org/10.1007/s10040-009-0446-6",
                "Das, S., & Pardeshi, S. D. (2018). Morphometric analysis of watershed in semi-arid region: A remote sensing and GIS perspective. Applied Water Science, 8(7), 1–16. https://doi.org/10.1007/s13201-018-0810-4",
                "Edet, A., Okereke, C. S., Teme, S. C., & Esu, E. O. (1998). Application of remote sensing data to groundwater exploration: A case study of the Cross River State, SE Nigeria. Hydrogeology Journal, 6(3), 394–404. https://doi.org/10.1007/s100400050157",
                "Healy, R. W., & Cook, P. G. (2002). Using groundwater levels to estimate recharge. Hydrogeology Journal, 10(1), 91–109. https://doi.org/10.1007/s10040-001-0178-0",
                "Jha, M. K., Chowdary, V. M., & Chowdhury, A. (2007). Groundwater assessment in Salboni Block, West Bengal (India) using remote sensing, geographical information system and multi-criteria decision analysis techniques. Hydrogeology Journal, 15(7), 1397–1410. https://doi.org/10.1007/s10040-007-0160-7",
                "Krishnamurthy, J., Mani, A., Jayaraman, V., & Manivel, M. (1996). Groundwater resources development in hard rock terrain—An approach using remote sensing and GIS techniques. International Journal of Applied Earth Observation and Geoinformation, 18(3), 173–183. https://doi.org/10.1016/0924-2716(95)00015-1",
                "Kumar, C. P., Singh, R. D., & Seethapathi, P. V. (2007). Assessment of natural groundwater recharge in Upper Ganga Canal Command area. Hydrological Sciences Journal, 52(2), 292–304. https://doi.org/10.1623/hysj.52.2.292",
                "Kumar, T., Jha, M. K., & Chowdary, V. M. (2014). Assessment of groundwater potential zones in a semi-arid region of India using remote sensing, GIS and MCDM techniques. Water Resources Management, 28(8), 2179–2196. https://doi.org/10.1007/s11269-014-0598-9",
                "Machiwal, D., Jha, M. K., & Mal, B. C. (2011). Assessment of groundwater potential in a semi-arid region of India using remote sensing, GIS and MCDM techniques. Water Resources Management, 25(5), 1359–1386. https://doi.org/10.1007/s11269-010-9749-y",
                "Magesh, N. S., Chandrasekar, N., & Soundranayagam, J. P. (2012). Delineation of groundwater potential zones in Theni district, Tamil Nadu, using remote sensing, GIS and MIF techniques. Geoscience Frontiers, 3(2), 189–196. https://doi.org/10.1016/j.gsf.2011.10.007",
                "Panda, R. K., Kumar, R., & Mohanty, S. (2010). Delineation of groundwater potential zones in Mahanadi Basin, Orissa using remote sensing and GIS. International Journal of Remote Sensing, 31(1), 1–20. https://doi.org/10.1080/01431160903263980",
                "Patra, S., Mishra, P., Mahapatra, S. C., & Mahalik, G. (2018). Estimation of groundwater recharge using water table fluctuation method: A case study in Odisha, India. Journal of the Geological Society of India, 92(4), 457–462. https://doi.org/10.1007/s12594-018-1070-3",
                "Rahmati, O., Nazari Samani, A., Mahmoodi, M., & Mahdavi, M. (2015). Groundwater potential mapping at Kurdistan region of Iran using analytic hierarchy process and GIS. Arabian Journal of Geosciences, 8(8), 7059–7071. https://doi.org/10.1007/s12517-014-1669-y",
                "Sander, P. (2007). Lineaments in groundwater exploration: A review of applications and limitations. Hydrogeology Journal, 15(1), 71–74. https://doi.org/10.1007/s10040-006-0138-6",
                "Singh, S. K., Panda, R. K., & Satapathy, D. R. (2013). Delineation of groundwater potential zones in Orissa, India using remote sensing and GIS. International Journal of Earth Sciences and Engineering, 6(1), 30–40.",
                "United Nations. (2015). Transforming our world: The 2030 agenda for sustainable development. United Nations General Assembly. https://sdgs.un.org/2030agenda"
            ]

            
            for i, ref in enumerate(references, 1):
                self.elements.append(Paragraph(f"{i}. {ref}", self.style_manager.styles['JustifiedBody']))
        except Exception as e:
            logger.error(f"Failed to add references: {e}")


    def _cleanup_temp_images(self):
        """Clean up temporary image files after PDF generation."""
        try:
            if hasattr(self, 'folder_path') and self.folder_path:
                image_files = list(self.folder_path.glob("*.png"))
                for image_file in image_files:
                    try:
                        image_file.unlink()
                        logger.debug(f"Cleaned up image: {image_file}")
                    except Exception as e:
                        logger.warning(f"Failed to delete image {image_file}: {e}")
                
                if image_files:
                    logger.info(f"Cleaned up {len(image_files)} temporary image files")
        except Exception as e:
            logger.warning(f"Error during image cleanup: {e}")

    def generate_report(self, layer_names: List,location_data:list) -> str:
        """Generate the complete report with comprehensive error handling."""
        try:
            full_output_path = self.config.get_full_output_path()
            
            doc = SimpleDocTemplate(
                full_output_path,
                pagesize=self.config.page_size,
                topMargin=self.config.margins['top'],
                bottomMargin=self.config.margins['bottom'],
                leftMargin=self.config.margins['left'],
                rightMargin=self.config.margins['right']
            )
            
            # Set document metadata
            doc.title = self.config.title
            doc.author = self.config.author
            doc.subject = self.config.subject
            
            # Build document sections
            self._add_title_page()
            self._add_executive_summary()
            self._add_study_area_overview(location_data=location_data)
            self._add_methodology_section(layer_names=layer_names)
            self._add_results_section(layer_names=layer_names)  
            self._add_references()
            
            doc.build(self.elements, onFirstPage=self._create_title_page_header, 
                     onLaterPages=self._create_header_footer)
            
            # Clean up temporary images after successful PDF generation
            self._cleanup_temp_images()
            
            logger.info(f"Report generated successfully: {full_output_path}")
            return full_output_path
            
        except Exception as e:
            logger.error(f"Failed to generate report: {e}")
            raise STRPReportError(f"Report generation failed: {e}")


@app.task(bind=True,pydantic=True,name="GWPZ_drain_document_gen")
def document_gen5(self,payload: StpPriorityDrainReport):
    progress_recorder = ProgressRecorder(self)
    total = 100
   
    try:
        progress_recorder.set_progress(1, total, description="Starting task")
        unique_folder_path=f"{Settings().TEMP_DIR}/{str(uuid.uuid4())}"
        table_data = [item.model_dump() for item in payload.table]
        location_data =[item for item in payload.location]
        weight_data= [["Factor", "Weight"]] + [[d.file_name, str(d.weight)] for d in payload.weight_data]
        progress_recorder.set_progress(5, total, description="Data loaded")
        file_paths=StpDocument(unique_folder_path)._geoserver_load(layer_names=payload.raster)
        tasks = []
        total_images = len(file_paths)
        progress_recorder.set_progress(15, total, description="Raster data downloaded")
        for idx, item in enumerate(file_paths):
            file_name = os.path.basename(item["raster_path"])  # Gets the file name from the full path
            file_path = os.path.join(unique_folder_path, "image", file_name.replace(" ","_"))  
            tasks.append(
            celery_currency_image5.s(
            file_path=file_path,
            raster_path=item["raster_path"],
            sld_path=item["sld_path"],
            clip=payload.clip,
            task_index=idx,
            total_tasks=total_images,
            parent_task_id=self.request.id
            ) 
        )
        progress_recorder.set_progress(20, total, description="Launching parallel image processing")
        job = chord(group(tasks))(final_step5.s(table_data=table_data,location_data=location_data,weight_data=weight_data,parent_task_id=self.request.id))
        redis_client.setex(
            f"chord:{self.request.id}",
            3600,  
            job.id
        )
        while not job.ready():
            completed_count = 0
            for i in range(total_images):
                if redis_client.get(f"image_complete:{self.request.id}:{i}"):
                    completed_count += 1
            
            progress_pct = 20 + int((completed_count / total_images) * 60)
            progress_recorder.set_progress(
                progress_pct,
                total,
                description=f"Processing images: {completed_count}/{total_images} complete"
            )

            time.sleep(1)
        
        
        progress_recorder.set_progress(100, total, description="Complete")
        

        for i in range(total_images):
            redis_client.delete(f"image_complete:{self.request.id}:{i}")
        redis_client.delete(f"chord:{self.request.id}")
        return {"chord_id": job.id}

    except Exception as e:
        logger.error(f"Task failed: {e}")
        progress_recorder.set_progress(total, total, description=f"Error: {str(e)}")
        raise STRPReportError(f"PDF generation failed: {e}")

@app.task(bind=True,pydantic=True,name="GWPZ_drain_currency_image")
def celery_currency_image5(self,file_path:str,raster_path:str,sld_path:str,clip:List[str],task_index: int, total_tasks: int, 
                          parent_task_id: str) -> dict:
    try:
        file_path = MapGenerator(dpi=100).make_image(
            file_path=file_path,
            raster_path=raster_path,
            sld_path=sld_path,
            filtered_vector=clip
        )

        redis_client.setex(
            f"image_complete:{parent_task_id}:{task_index}",
            3600,
            "1"
        )
        
        return {
            "file_path": file_path,
            "file_name": os.path.splitext(os.path.basename(file_path))[0]
        }
    except Exception as e:
        logger.error(f"Image processing failed for task {task_index}: {e}")
        raise
   

@app.task(bind=True,pydantic=True,name="GWPZ_drain_generation_start")
def final_step5(self,results: List[dict],table_data:list,location_data:list,weight_data:list,parent_task_id: str)->None:
    try:
        redis_client.setex(
            f"pdf_generation:{parent_task_id}",
            3600,
            "started"
        )
        pdf_path=StpDocument().report_generator(layer_names=results, csv_data=table_data,location_data=location_data,weight_data=weight_data)
        redis_client.delete(f"pdf_generation:{parent_task_id}")
        
        return pdf_path
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise