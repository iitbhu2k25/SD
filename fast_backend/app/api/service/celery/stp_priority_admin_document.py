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
from app.api.schema.stp_schema import  StpPriorityAdminReport
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
    title: str = "Comprehensive Report on the STP Priority"
    author: str = "IIT BHU"
    subject: str = "STP Priority Analysis"
    output_filename: str = field(default_factory=lambda: f"STP_Priority_Report_{uuid.uuid4()}.pdf")
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
    Downstream_Effect_of_Drain: str = ""
    Drainage_Distance: str = ""
    Groundwater_Depth: str = ""
    Groundwater_Quality: str = ""
    LULC: str = ""
    Major_City_Risk: str = ""
    Population: str = ""
    Proximity_River_Quality: str = ""
    STP_Priority: str = ""

    
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
    
    def find_sub_village(self,clip:list)->gpd.GeoDataFrame:
        try:
            if not clip:
                raise ValidationError("Clip list cannot be empty")
            
            validate_file_exists(self.village_path, "Village file")
            
            gdf = gpd.read_file(self.village_path).to_crs(epsg=3857)
            gdf = gdf[gdf['subdis_cod'].isin(clip)]
            
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
            filtered = SpatialDataset().find_sub_village(clip=filtered_vector)
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
                title="Comprehensive Report on the STP Priority",
                author="IIT BHU",
                output_folder=str(self.document_path)
            )
            
            static_data = StaticTextData(
                Downstream_Effect_of_Drain="This factor identifies locations where untreated sewage could severely impact downstream populations and ecosystems. Drains were analyzed using flow direction and accumulation models to quantify their potential downstream influence (cf. Esri, 2020; Paul & Meyer, 2001).",
                Drainage_Distance="Drainage distance was calculated using Euclidean and cost-distance algorithms to determine village proximity to the nearest major drain. Villages located closer to these drains are prioritized to reduce unregulated discharge (USEPA, 2004).",
                Groundwater_Depth="Depth-to-groundwater data were used to assess contamination risk. Shallow aquifers are more vulnerable to pollution, especially where STPs are absent or underperforming (CGWB, 2022)",
                Groundwater_Quality="Groundwater quality data were used to identify areas of potential contamination. Aquifers with poor groundwater quality were given greater priority (CGWB, 2022).",
                LULC="The influence of land use was examined using classified satellite imagery to identify dense built-up zones, agricultural fields, and open areas. Urban clusters with high impervious surfaces were given greater priority due to higher sewage production and runoff (Anderson et al., 1976; NRSC, 2021).",
                Major_City_Risk="Villages in close proximity to major cities are at higher risk of pollution load migration and infrastructure overload. This proximity buffer was used to highlight peri-urban villages lacking STPs but within the influence zone of major urban nodes.",
                Population="Population data were sourced from Census 2011 and projected using appropriate demographic models. Higher population zones were weighted more heavily under the assumption of greater sewage load (National Commission on Population, 2019).",
                Proximity_River_Quality="Proximity to poor-quality river segments (based on BOD and DO from CPCB datasets) was considered a critical factor. Villages draining into these segments were prioritized for immediate intervention to mitigate ecological degradation (CPCB, 2020).",
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
                pdf_path = self.static_pdf(folder_path=layer_names, csv_data=csv_data,location_data=location_data,weight_data=weight_data)
                logger.info(f"Report generated successfully: {pdf_path}")
                return pdf_path
            except Exception as e:
                pass
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            raise STRPReportError(f"Report generation failed: {e}")

class ReportGenerator:
    """Main report generation class with improved error handling."""
    
    def __init__(self, config: 'ReportConfig', static_data: 'StaticTextData', 
                 table_data: 'TableData', dpi: int = 50):
        
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
                "A Geospatial and Multi-Criteria Analysis for Prioritizing Sewage Treatment Infrastructure",
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
            This report presents a geospatial and multi-criteria analysis for prioritizing villages and towns 
            for the development or upgrading of Sewage Treatment Plants (STPs). The analysis integrates 
            environmental, infrastructural, and demographic indicators to identify high-need areas within 
            the study region. The outcomes are intended to support policy makers and urban planners in 
            aligning sanitation interventions with SDG 6 targets on water and sanitation access.
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
            f"State: {location_data[0][1]}",
            f"District(s): {', '.join(location_data[1][1])}",
            f"SubDistrict(s): {', '.join(location_data[2][1])}"
        ]
        content = "<br/>".join(lines)

        self.elements.append(Paragraph(content, self.style_manager.styles['JustifiedBody']))
        self.elements.append(PageBreak())
    
    def _add_methodology_section(self):
        """Add methodology section."""
        try:
            self.elements.append(Paragraph("3. Database and Methodology", 
                                         self.style_manager.styles['SectionHeader']))
            
            # Database subsection
            self.elements.append(Paragraph("3.1 Database", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            database_text = """
            A range of spatial and non-spatial datasets were integrated for the STP prioritization analysis. 
            The following thematic layers were used:
            """
            
            self.elements.append(Paragraph(database_text, self.style_manager.styles['JustifiedBody']))
            
            # Factor descriptions
            factors = [
                ("Downstream Effect of Drain", self.static_data.Downstream_Effect_of_Drain),
                ("Drainage Distance", self.static_data.Drainage_Distance),
                ("Groundwater Depth", self.static_data.Groundwater_Depth),
                ("Groundwater Quality", self.static_data.Groundwater_Quality),
                ("LULC", self.static_data.LULC),
                ("Major City Risk", self.static_data.Major_City_Risk),
                ("Population", self.static_data.Population),
                ("Proximity to River Quality", self.static_data.Proximity_River_Quality),
            ]
            
            for factor_name, description in factors:
                if description.strip():
                    self.elements.append(Paragraph(f"<b>{factor_name}:</b> {description}", 
                                                 self.style_manager.styles['JustifiedBody']))
            
            # Methodology subsection
            self.elements.append(Paragraph("3.2 Methodology", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            methodology_text = """
            <b>(a) Data Reclassification:</b> Each factor raster was reclassified into suitability scores ranging from 1 (least priority) to 5 (highest priority). The classification thresholds were derived based on standard guidelines and quantile statistics (Malczewski, 1999).<br/><br/>
            <b>(b) Data Normalization:</b> To ensure comparability among heterogeneous datasets, min-max normalization was applied to all continuous variables. Categorical variables were mapped using fixed priority schemes based on expert consultation.<br/><br/>
            <b>(c) Confusion Matrix:</b> To validate the predictive robustness of the prioritization output, confusion matrices were generated by comparing known high-priority sites (e.g., existing STPs or identified hotspots) with the predicted scores.<br/><br/>
            <b>(d) Weighted Overlay:</b> A Weighted Linear Combination (WLC) model was used, integrating all the thematic layers. The final priority score was computed using a weighted sum approach.<br/><br/>
            """
            
            self.elements.append(Paragraph(methodology_text, self.style_manager.styles['JustifiedBody']))
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
            self.elements.append(Paragraph("4.1 STP Priority Factors", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            factors_text = """
            The analysis reveals that factors such as downstream drain effect, proximity to polluted river segments, 
            and population size exert the most significant influence on STP prioritization. Villages with high sewage 
            potential but lacking treatment infrastructure clustered in specific zones.
            """
            
            self.elements.append(Paragraph(factors_text, self.style_manager.styles['JustifiedBody']))

            factors_data = []
            for key, value in asdict(self.static_data).items():
                name = key.replace("_", " ")
                match = next(filter(lambda d: d.get("file_name") == key, layer_names), None)
                if match:
                    factors_data.append((name,
                        value,
                        match["file_path"]
                    ))
            self._add_fallback_elements(factors_data)
            self.elements.append(Spacer(1, 15))
            
            # Weights details
            self.elements.append(Paragraph("4.2 Details of the Assigned Weights", 
                                         self.style_manager.styles['SubsectionHeader']))
            

            # Weights table
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
                "Anderson, J.R., Hardy, E.E., Roach, J.T., & Witmer, R.E. (1976). A Land Use and Land Cover Classification System for Use with Remote Sensor Data. USGS Professional Paper 964.",
                "Central Pollution Control Board (CPCB). (2020). River Water Quality Assessment – Annual Report.",
                "CGWB. (2022). Groundwater Yearbook – India 2021–22. Central Ground Water Board, Ministry of Jal Shakti.",
                "Esri. (2020). Understanding Drainage Patterns Using Flow Direction and Accumulation.",
                "Malczewski, J. (1999). GIS and Multicriteria Decision Analysis. John Wiley & Sons.",
                "National Commission on Population. (2019). Population Projections for India and States 2011–2036. Ministry of Health & Family Welfare.",
                "USEPA. (2004). Primer for Municipal Wastewater Treatment Systems."
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
            self._add_methodology_section()
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


@app.task(bind=True,pydantic=True,name="stp_priority_admin_document")
def document_gen(self,payload: StpPriorityAdminReport):
    progress_recorder = ProgressRecorder(self)
    total = 100
    try:
        progress_recorder.set_progress(1, total, description="Starting task")
        
        unique_folder_path = f"{Settings().TEMP_DIR}/{str(uuid.uuid4())}"
        table_data = [item.model_dump() for item in payload.table]
        location_data = [item for item in payload.location]
        weight_data = [["Factor", "Weight"]] + [[d.file_name, str(d.weight)] for d in payload.weight_data]
        
        progress_recorder.set_progress(5, total, description="Data loaded")
        
        file_paths = StpDocument(unique_folder_path)._geoserver_load(layer_names=payload.raster)
        
        progress_recorder.set_progress(15, total, description="Raster data downloaded")
        

        tasks = []
        total_images = len(file_paths)
        
        for idx, item in enumerate(file_paths):
            file_name = os.path.basename(item["raster_path"])
            file_path = os.path.join(unique_folder_path, "image", file_name.replace(" ", "_"))
            
            tasks.append(
                celery_currency_image.s(
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
        

        job = chord(group(tasks))(
            final_step.s(
                table_data=table_data,
                location_data=location_data,
                weight_data=weight_data,
                parent_task_id=self.request.id
            )
        )
        
     
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
        
        # Cleanup Redis keys
        for i in range(total_images):
            redis_client.delete(f"image_complete:{self.request.id}:{i}")
        redis_client.delete(f"chord:{self.request.id}")
        return {"chord_id": job.id}
        
    except Exception as e:
        logger.error(f"Task failed: {e}")
        progress_recorder.set_progress(total, total, description=f"Error: {str(e)}")
        raise STRPReportError(f"PDF generation failed: {e}")


@app.task(bind=True,pydantic=True,name="stp_priority_currency_image")
def celery_currency_image(self,file_path:str,raster_path:str,sld_path:str,clip:List[str], task_index: int, total_tasks: int, 
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



@app.task(bind=True,pydantic=True,name="stp_priority_admin_generation_start")
def final_step(self,results: List[dict],table_data:list,location_data:list,weight_data:list, parent_task_id: str) -> str:
    try:
        
        redis_client.setex(
            f"pdf_generation:{parent_task_id}",
            3600,
            "started"
        )
        
        pdf_path = StpDocument().report_generator(
            layer_names=results,
            csv_data=table_data,
            location_data=location_data,
            weight_data=weight_data
        )
        
        redis_client.delete(f"pdf_generation:{parent_task_id}")
        
        return pdf_path
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise