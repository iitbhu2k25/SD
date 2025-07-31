import os
import io
import uuid
import base64
import logging
import tempfile
import shutil
from contextlib import contextmanager
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path

import numpy as np
import geopandas as gpd
import matplotlib.pyplot as plt
import contextily as ctx
import rasterio
from pyproj import Transformer
from matplotlib.colors import ListedColormap, BoundaryNorm
from matplotlib.patches import Patch
from matplotlib import cm as matplotlib_cm
from lxml import etree
from PIL import Image as PILImage

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm, mm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    PageBreak, Image, KeepTogether, NextPageTemplate, PageTemplate
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus.frames import Frame

from celery import group, chord, chain
from app.conf.settings import Settings
from app.api.service.geoserver import Geoserver
from app.conf.celery import app

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set PIL safety limit but with a reasonable maximum
PILImage.MAX_IMAGE_PIXELS = 500000000  # 500MP limit instead of None

class STRPReportError(Exception):
    """Custom exception for STP report generation errors."""
    pass

class ValidationError(STRPReportError):
    """Raised when input validation fails."""
    pass

class ResourceError(STRPReportError):
    """Raised when resource operations fail."""
    pass

@contextmanager
def managed_figure(figsize=(12, 10), dpi=100):
   
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    try:
        yield fig, ax
    finally:
        plt.close(fig)

@contextmanager
def temporary_directory(prefix="stp_report_"):
    """Context manager for temporary directories with automatic cleanup."""
    temp_dir = tempfile.mkdtemp(prefix=prefix)
    try:
        yield temp_dir
    finally:
        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            logger.warning(f"Failed to cleanup temporary directory {temp_dir}: {e}")

def validate_geodataframe(gdf: gpd.GeoDataFrame, name: str = "GeoDataFrame") -> None:
    """Validate GeoDataFrame input."""
    if gdf is None:
        raise ValidationError(f"{name} cannot be None")
    if gdf.empty:
        raise ValidationError(f"{name} cannot be empty")
    if gdf.crs is None:
        raise ValidationError(f"{name} must have a defined CRS")

def validate_file_exists(filepath: Union[str, Path], description: str = "File") -> Path:
    """Validate that a file exists and return Path object."""
    path = Path(filepath)
    if not path.exists():
        raise ResourceError(f"{description} does not exist: {filepath}")
    return path

@app.task(bind=True)
def generate_celery_image(self, *, dpi: int, name: str, folder_path: str, gdf_json: str) -> Dict[str, Any]:
    """Generate map image and save to disk, return file path."""
    result = {
        'success': False,
        'image_path': None,
        'error': None,
        'factor_name': name
    }
    
    try:
        if not name or not folder_path or not gdf_json:
            error_msg = f"Invalid parameters for image generation: name={name}, folder_path={folder_path}"
            logger.error(error_msg)
            result['error'] = error_msg
            return result
            
        # Clean and prepare name
        clean_name = name[4:] if name.startswith("(") and len(name) > 4 else name
        clean_name = clean_name.replace(" ", "_").replace("(", "").replace(")", "")
        
        raster_path = Path(folder_path) / f"{clean_name}.tif"
        sld_path = Path(folder_path) / f"{clean_name}.sld"
        
        # Validate files exist
        try:
            validate_file_exists(raster_path, "Raster file")
            validate_file_exists(sld_path, "SLD file")
        except ResourceError as e:
            error_msg = f"Missing files for {name}: {e}"
            logger.error(error_msg)
            result['error'] = error_msg
            return result
        
        # Parse GeoDataFrame
        try:
            gdf = gpd.read_file(io.StringIO(gdf_json))
            validate_geodataframe(gdf, f"GeoDataFrame for {name}")
        except Exception as e:
            error_msg = f"Failed to parse GeoDataFrame for {name}: {e}"
            logger.error(error_msg)
            result['error'] = error_msg
            return result
        
        # Generate image and save to disk
        try:
            image_bytes = MapGenerator(dpi=dpi).make_image(
                clean_name, str(raster_path), str(sld_path), filtered_vector=gdf
            )
            
            if image_bytes:
                # Save image to disk
                output_image_path = Path(folder_path) / f"{clean_name}_map.png"
                with open(output_image_path, 'wb') as f:
                    f.write(image_bytes.getvalue())
                
                result['success'] = True
                result['image_path'] = str(output_image_path)
                logger.info(f"Successfully generated image for {name}: {output_image_path}")
            else:
                result['error'] = f"No image generated for {name}"
                
        except Exception as e:
            error_msg = f"Failed to generate image for {name}: {e}"
            logger.error(error_msg)
            result['error'] = error_msg
            
    except Exception as e:
        error_msg = f"Unexpected error in generate_celery_image for {name}: {e}"
        logger.error(error_msg)
        result['error'] = error_msg
    
    return result

@app.task
def process_images(image_results: List[Dict[str, Any]], factors_data: List[Tuple[str, str, str]]) -> Dict[str, Any]:
    """Process image generation results and return file paths for element creation."""
    result_data = {
        'success': True,
        'processed_factors': [],
        'error_message': None
    }
    
    try:
        if len(image_results) != len(factors_data):
            error_msg = f"Mismatch between image results ({len(image_results)}) and factors ({len(factors_data)})"
            logger.error(error_msg)
            result_data['success'] = False
            result_data['error_message'] = error_msg
            return result_data
        
        for image_result, (factor_title, static_text, figure_title) in zip(image_results, factors_data):
            try:
                factor_data = {
                    'factor_title': factor_title,
                    'static_text': static_text,
                    'figure_title': figure_title,
                    'image_path': None,
                    'has_image': False,
                    'error': None
                }
                
                if image_result and image_result.get('success', False):
                    image_path = image_result.get('image_path')
                    if image_path and Path(image_path).exists():
                        factor_data['image_path'] = image_path
                        factor_data['has_image'] = True
                        logger.info(f"Image available for {factor_title}: {image_path}")
                    else:
                        error_msg = f"Image file not found for {factor_title}: {image_path}"
                        logger.warning(error_msg)
                        factor_data['error'] = error_msg
                else:
                    error_msg = image_result.get('error', 'Unknown error') if image_result else 'No result'
                    logger.warning(f"No image generated for {factor_title}: {error_msg}")
                    factor_data['error'] = error_msg
                
                result_data['processed_factors'].append(factor_data)
                
            except Exception as e:
                logger.error(f"Error processing factor {factor_title}: {e}")
                factor_data = {
                    'factor_title': factor_title,
                    'static_text': static_text,
                    'figure_title': figure_title,
                    'image_path': None,
                    'has_image': False,
                    'error': str(e)
                }
                result_data['processed_factors'].append(factor_data)
        
        return result_data
        
    except Exception as e:
        logger.error(f"Unexpected error in process_images: {e}")
        result_data['success'] = False
        result_data['error_message'] = str(e)
        return result_data

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
    
    def __post_init__(self):
        if self.margins is None:
            self.margins = {
                'top': 2.5*cm,
                'bottom': 2.5*cm,
                'left': 2.5*cm,
                'right': 2.5*cm
            }
        
        if self.output_folder is None:
            self.output_folder = Settings().BASE_DIR
        
        # Ensure output folder exists
        Path(self.output_folder).mkdir(parents=True, exist_ok=True)
    
    def get_full_output_path(self) -> str:
        return str(Path(self.output_folder) / self.output_filename)

@dataclass
class StaticTextData:
    """Static text data with defaults."""
    downstream_effect_of_drain: str = ""
    drainage_distance: str = ""
    groundwater_depth: str = ""
    groundwater_quality: str = ""
    lulc_analysis: str = ""
    major_city_risk: str = ""
    population_analysis: str = ""
    proximity_river_quality: str = ""
    weight_details: str = ""
    priority_map_analysis: str = ""
    village_analysis: str = ""
    study_area_details: str = ""
    methodology_details: str = ""

@dataclass
class TableData:
    """Table data with validation and conversion."""
    weights_table: Optional[List[List[str]]] = None
    village_priority_table: Optional[List[List[str]]] = None
    village_raw_data: Optional[List[Dict[str, Any]]] = None
    
    def __post_init__(self):
        if self.weights_table is None:
            self.weights_table = [
                ["Factor", "Weight"],
                ["Downstream Effect of Drain", "0.20"],
                ["Drainage Distance", "0.15"],
                ["Groundwater Depth", "0.12"],
                ["LULC", "0.18"],
                ["Major City Risk", "0.10"],
                ["Population", "0.15"],
                ["Proximity to River Quality", "0.10"]
            ]
        
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

class StyleManager:
    """Manages document styles with caching."""
    
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

    def color_raster(self, ax, cmap, norm, raster_path: str):
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

    def _save_plot(self, fig) -> BytesIO:
        """Save plot to BytesIO with error handling."""
        try:
            buf = BytesIO()
            fig.savefig(
                buf, 
                format='png', 
                dpi=self.dpi,
                bbox_inches='tight', 
                pad_inches=0.1,
                facecolor='white',
                edgecolor='none'
            )
            buf.seek(0)  
            return buf
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
    
    def make_image(self, name: str, raster_path: str, sld_path: str, 
                   filtered_vector: gpd.GeoDataFrame) -> Optional[BytesIO]:
        """Generate map image with comprehensive error handling."""
        try:
            # Validate inputs
            validate_file_exists(raster_path, "Raster file")
            validate_file_exists(sld_path, "SLD file")
            validate_geodataframe(filtered_vector, "Filtered vector")
            
            # Parse color map
            color_map = self._parse_color_map_entries(sld_path)
            values, hex_colors, labels = zip(*color_map)
            rgb_colors = [self._hex_to_rgb_tuple(c) for c in hex_colors]
            cmap = ListedColormap(rgb_colors)
            norm = BoundaryNorm(list(values) + [max(values)+1], len(values))
            
            # Create figure with context manager
            with managed_figure(figsize=(25, 25), dpi=self.dpi) as (fig, ax):
                # Color raster
                bounds, im = self.color_raster(ax, cmap, norm, raster_path)
                
                # Reproject vector to match raster CRS if needed
                with rasterio.open(raster_path) as src:
                    raster_crs = src.crs
                
                if filtered_vector.crs != raster_crs:
                    try:
                        filtered_vector = filtered_vector.to_crs(raster_crs)
                    except Exception as e:
                        logger.warning(f"Failed to reproject vector: {e}")
                
                # Plot vector
                filtered_vector.plot(
                    ax=ax, 
                    facecolor='none', 
                    edgecolor='red', 
                    linewidth=0.5,
                    alpha=0.8,
                    linestyle='-'
                )
                
                self._set_axis_limits(ax, bounds)
                ax.set_xlabel("Longitude", fontsize=18)
                ax.set_ylabel("Latitude", fontsize=18)
                
                # Add legend
                legend_elements = [
                    Patch(facecolor=c, edgecolor='black', label=l.strip())
                    for c, l in zip(rgb_colors, labels)
                ]
                
                ax.legend(
                    handles=legend_elements, 
                    title="Priority Score", 
                    loc='upper center',
                    bbox_to_anchor=(0.5, -0.12),
                    fontsize=20,
                    title_fontsize=34,
                    framealpha=0.9
                )

                plt.tight_layout()
                return self._save_plot(fig)
                
        except Exception as e:
            logger.error(f"Failed to generate image for {name}: {e}")
            return None

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
            return [Image(image_stream, width=600, height=400, hAlign='CENTER')]
        except Exception as e:
            logger.error(f"Failed to insert image: {e}")
            return None

class ReportGenerator:
    """Main report generation class with improved error handling."""
    
    def __init__(self, config: ReportConfig, static_data: StaticTextData, 
                 table_data: TableData, folder_path: str, dpi: int = 100):
        self.config = config
        self.static_data = static_data
        self.table_data = table_data
        self.style_manager = StyleManager()
        self.elements = []
        self.village_file = Settings().villages_path
        self.folder_path = Path(folder_path)
        self.dpi = max(50, min(dpi, 600))  # Constrain DPI
        
        # Validate folder path
        if not self.folder_path.exists():
            raise ResourceError(f"Folder path does not exist: {folder_path}")
    
    def _filter_village(self, clip: List[str] = None) -> gpd.GeoDataFrame:
        """Filter villages with error handling."""
        try:
            if not clip:
                raise ValidationError("Clip list cannot be empty")
            
            validate_file_exists(self.village_file, "Village file")
            
            gdf = gpd.read_file(self.village_file).to_crs(epsg=3857)
            gdf = gdf[gdf['subdis_cod'].isin(clip)]
            
            if gdf.empty:
                raise ValidationError(f"No village polygon found for clip IDs: {clip}")
            
            return gdf
        except Exception as e:
            logger.error(f"Failed to filter villages: {e}")
            raise

    def _insert_village_map(self, basemap: str = "satellite", 
                           gdf: gpd.GeoDataFrame = None) -> Optional[str]:
        """Insert village map and save to disk, return file path."""
        try:
            validate_geodataframe(gdf, "Village GeoDataFrame")
            
            with managed_figure(figsize=(12, 10), dpi=self.dpi) as (fig, ax):
                # Project GeoDataFrame to EPSG:3857 for basemap
                gdf_3857 = gdf.to_crs(epsg=3857)
                gdf_3857.plot(ax=ax, edgecolor='red', facecolor='none', 
                             linewidth=2.0, alpha=0.8)

                bounds = gdf_3857.total_bounds
                logger.debug(f"Transformed bounds (EPSG:3857): {bounds}")

                # Try to add basemap
                try:
                    # Placeholder for basemap - replace with actual implementation
                    ax.set_facecolor("lightgray")
                    logger.info("Basemap placeholder added")
                except Exception as e:
                    logger.warning(f"Could not add basemap: {e}")
                    ax.set_facecolor("lightgray")

                ax.set_axis_off()

                # Set bounds with margin
                margin_x = (bounds[2] - bounds[0]) * 0.05
                margin_y = (bounds[3] - bounds[1]) * 0.05
                ax.set_xlim(bounds[0] - margin_x, bounds[2] + margin_x)
                ax.set_ylim(bounds[1] - margin_y, bounds[3] + margin_y)

                # Save to disk
                map_filename = f"village_map_{basemap}_{uuid.uuid4().hex[:8]}.png"
                map_path = self.folder_path / map_filename
                
                plt.savefig(map_path, format="png", dpi=self.dpi, bbox_inches="tight", 
                           pad_inches=0.1, facecolor="white")
                
                logger.info(f"Village map saved: {map_path}")
                return str(map_path)
                
        except Exception as e:
            logger.error(f"Failed to create village map: {e}")
            return None

    def _add_title_page(self):
        """Add title page to the report."""
        try:
            title = Paragraph(self.config.title, self.style_manager.styles['CustomTitle'])
            self.elements.append(title)
            self.elements.append(Spacer(1, 50))
            
            subtitle = Paragraph(
                "A Geospatial and Multi-Criteria Analysis for Prioritizing Sewage Treatment Infrastructure",
                self.style_manager.styles['Heading2']
            )
            self.elements.append(subtitle)
            self.elements.append(Spacer(1, 100))
            
            details = f"""
            <para align="center">
            <b>Prepared by:</b> {self.config.author}<br/>
            <b>Date:</b> {datetime.now().strftime("%B %d, %Y")}<br/>
            <b>Subject:</b> {self.config.subject}
            </para>
            """
            self.elements.append(Paragraph(details, self.style_manager.styles['Normal']))
            self.elements.append(PageBreak())
        except Exception as e:
            logger.error(f"Failed to add title page: {e}")

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

    def _add_study_area_overview(self, clip: List[str] = None) -> Optional[gpd.GeoDataFrame]:
        """Add study area overview with error handling."""
        try:
            self.elements.append(Paragraph("2. Study Area Overview", 
                                         self.style_manager.styles['SectionHeader']))
            
            overview_text = f"""
            The study area encompasses selected villages and urban settlements within [Insert District/State], 
            characterized by varied physiographic and hydrological conditions. It is bounded by [insert geographical 
            features or coordinates] and falls within the catchment area of the [Insert River Name], making sewage 
            management critically important for downstream water quality. Rapid urbanization and increased population 
            density in certain zones have further strained the existing sanitation infrastructure.
            
            {self.static_data.study_area_details}
            """
            
            self.elements.append(Paragraph(overview_text, self.style_manager.styles['JustifiedBody']))
            
            # Filter villages and add maps
            gdf = self._filter_village(clip)
            
            # Satellite map
            sat_map_path = self._insert_village_map(basemap="satellite", gdf=gdf)
            if sat_map_path and Path(sat_map_path).exists():
                try:
                    with open(sat_map_path, 'rb') as f:
                        image_bytes = io.BytesIO(f.read())
                    self.elements.append(Image(image_bytes, width=15*cm, height=10*cm))
                    self.elements.append(Paragraph("Figure 1: Study Area Map (Satellite)", 
                                                 self.style_manager.styles['FigureCaption']))
                    self.elements.append(Spacer(1, 20))
                except Exception as e:
                    logger.error(f"Failed to read satellite map: {e}")
                    self.elements.extend(ImageManager.create_image_placeholder("Figure 1: Study Area Map"))
            else:
                self.elements.extend(ImageManager.create_image_placeholder("Figure 1: Study Area Map"))

            # Street map
            street_map_path = self._insert_village_map(basemap="street", gdf=gdf)
            if street_map_path and Path(street_map_path).exists():
                try:
                    with open(street_map_path, 'rb') as f:
                        image_bytes = io.BytesIO(f.read())
                    self.elements.append(Image(image_bytes, width=15*cm, height=10*cm))
                    self.elements.append(Paragraph("Figure 2: Study Area Map (Street)", 
                                                 self.style_manager.styles['FigureCaption']))
                    self.elements.append(Spacer(1, 20))
                except Exception as e:
                    logger.error(f"Failed to read street map: {e}")
                    self.elements.extend(ImageManager.create_image_placeholder("Figure 2: Study Area Map"))
            else:
                self.elements.extend(ImageManager.create_image_placeholder("Figure 2: Study Area Map"))
            
            return gdf
            
        except Exception as e:
            logger.error(f"Failed to add study area overview: {e}")
            return None

    def _add_methodology_section(self):
        """Add methodology section."""
        try:
            self.elements.append(Paragraph("3. Database and Methodology", 
                                         self.style_manager.styles['SectionHeader']))
            
            # Database subsection
            self.elements.append(Paragraph("3.1 Database", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            database_text = f"""
            A range of spatial and non-spatial datasets were integrated for the STP prioritization analysis. 
            The following thematic layers were used:
            
            {self.static_data.methodology_details}
            """
            
            self.elements.append(Paragraph(database_text, self.style_manager.styles['JustifiedBody']))
            
            # Factor descriptions
            factors = [
                ("Downstream Effect of Drain", self.static_data.downstream_effect_of_drain),
                ("Drainage Distance", self.static_data.drainage_distance),
                ("Groundwater Depth", self.static_data.groundwater_depth),
                ("Groundwater Quality", self.static_data.groundwater_quality),
                ("LULC", self.static_data.lulc_analysis),
                ("Major City Risk", self.static_data.major_city_risk),
                ("Population", self.static_data.population_analysis),
                ("Proximity to River Quality", self.static_data.proximity_river_quality),
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

    def _process_celery_results(self, celery_result: Dict[str, Any]):
        """Process Celery results and create ReportLab elements by reading images from disk."""
        try:
            processed_factors = celery_result.get('processed_factors', [])
            
            for factor_data in processed_factors:
                try:
                    # Add factor title and text
                    self.elements.append(Paragraph(
                        factor_data['factor_title'], 
                        self.style_manager.styles['SubsectionHeader']
                    ))
                    
                    if factor_data['static_text'].strip():
                        self.elements.append(Paragraph(
                            factor_data['static_text'], 
                            self.style_manager.styles['JustifiedBody']
                        ))
                    
                    self.elements.append(Paragraph(
                        factor_data['figure_title'], 
                        self.style_manager.styles['FigureCaption']
                    ))

                    # Handle image by reading from disk
                    if factor_data['has_image'] and factor_data['image_path']:
                        try:
                            image_path = Path(factor_data['image_path'])
                            if image_path.exists():
                                # Read image from disk
                                with open(image_path, 'rb') as f:
                                    image_bytes = io.BytesIO(f.read())
                                
                                image_elements = ImageManager.insert_actual_image(image_bytes)
                                if image_elements:
                                    self.elements.extend(image_elements)
                                    logger.info(f"Successfully added image for {factor_data['factor_title']}")
                                else:
                                    self.elements.extend(ImageManager.create_image_placeholder(
                                        f"Error: {factor_data['figure_title']}"
                                    ))
                            else:
                                logger.warning(f"Image file not found: {image_path}")
                                self.elements.extend(ImageManager.create_image_placeholder(
                                    f"Missing: {factor_data['figure_title']}"
                                ))
                        except Exception as e:
                            logger.error(f"Failed to read image for {factor_data['factor_title']}: {e}")
                            self.elements.extend(ImageManager.create_image_placeholder(
                                f"Error: {factor_data['figure_title']}"
                            ))
                    else:
                        error_info = factor_data.get('error', 'Unknown error')
                        logger.warning(f"No valid image for {factor_data['factor_title']}: {error_info}")
                        self.elements.extend(ImageManager.create_image_placeholder(
                            f"Missing: {factor_data['figure_title']}"
                        ))

                    self.elements.append(Spacer(1, 15))
                    self.elements.append(PageBreak())
                    
                except Exception as e:
                    logger.error(f"Error processing factor data {factor_data.get('factor_title', 'unknown')}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error processing Celery results: {e}")
            raise
    
    def _add_fallback_elements(self, factors_data: List[Tuple[str, str, str]]):
        """Add fallback elements when Celery processing fails."""
        try:
            for factor_title, static_text, figure_title in factors_data:
                self.elements.append(Paragraph(factor_title, self.style_manager.styles['SubsectionHeader']))
                if static_text.strip():
                    self.elements.append(Paragraph(static_text, self.style_manager.styles['JustifiedBody']))
                self.elements.extend(ImageManager.create_image_placeholder(figure_title))
                self.elements.append(Spacer(1, 15))
                self.elements.append(PageBreak())
        except Exception as e:
            logger.error(f"Error adding fallback elements: {e}")

    def _generate_image_safely(self, name: str, gdf: gpd.GeoDataFrame) -> Optional[str]:
        """Generate image and save to disk, return file path."""
        try:
            clean_name = name[4:] if name.startswith("(") else name
            clean_name = clean_name.replace(" ", "_").replace("(", "").replace(")", "")
            
            raster_path = self.folder_path / f"{clean_name}.tif"
            sld_path = self.folder_path / f"{clean_name}.sld"
            
            if raster_path.exists() and sld_path.exists():
                # Generate image
                image_bytes = MapGenerator(dpi=self.dpi).make_image(
                    clean_name, str(raster_path), str(sld_path), filtered_vector=gdf
                )
                
                if image_bytes:
                    # Save to disk
                    output_image_path = self.folder_path / f"{clean_name}_priority_map.png"
                    with open(output_image_path, 'wb') as f:
                        f.write(image_bytes.getvalue())
                    
                    logger.info(f"Generated and saved priority map: {output_image_path}")
                    return str(output_image_path)
                else:
                    logger.warning(f"No image bytes generated for {name}")
                    return None
            else:
                logger.warning(f"Missing files for {name}: raster={raster_path.exists()}, sld={sld_path.exists()}")
                return None
        except Exception as e:
            logger.error(f"Failed to generate image for {name}: {e}")
            return None

    def _add_results_section(self, gdf: gpd.GeoDataFrame):
        """Add results section with comprehensive error handling."""
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
            
            # Define factors data
            factors_data = [
                ("(a) Downstream Effect of Drain", self.static_data.downstream_effect_of_drain, "Figure 1: Downstream Effect Map"),
                ("(b) Drainage Distance", self.static_data.drainage_distance, "Figure 2: Drainage Distance Map"),
                ("(c) Groundwater Depth", self.static_data.groundwater_depth, "Figure 3: Groundwater Depth Map"),
                ("(d) Groundwater Quality", self.static_data.groundwater_quality, "Figure 4: Groundwater Quality Map"),
                ("(e) LULC", self.static_data.lulc_analysis, "Figure 5: LULC Map"),
                ("(f) Major City Risk", self.static_data.major_city_risk, "Figure 6: Major City Risk Map"),
                ("(g) Population", self.static_data.population_analysis, "Figure 7: Population Map"),
                ("(h) Proximity River Quality", self.static_data.proximity_river_quality, "Figure 8: Proximity River Quality Map")
            ]
            
            # Generate images using Celery
            try:
                gdf_json = gdf.to_json()
                
                task_group = group(
                    generate_celery_image.s(
                        dpi=self.dpi,
                        name=factor_title,
                        folder_path=str(self.folder_path),
                        gdf_json=gdf_json 
                    )
                    for factor_title, static_text, figure_title in factors_data
                )
                
                workflow = chain(task_group | process_images.s(factors_data))
                result = workflow.apply_async() 
                
                # Get serializable data from Celery and convert to elements locally
                celery_result = result.get(timeout=600)
                
                if celery_result and celery_result.get('success', False):
                    self._process_celery_results(celery_result)
                else:
                    error_msg = celery_result.get('error_message', 'Unknown error') if celery_result else 'No result returned'
                    logger.warning(f"Celery workflow returned unsuccessful result: {error_msg}")
                    self._add_fallback_elements(factors_data)
                        
            except Exception as e:
                logger.error(f"Celery workflow failed: {e}")
                self._add_fallback_elements(factors_data)
            
            # Priority map
            self.elements.append(Paragraph("4.2 STP Priority Map", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            if self.static_data.priority_map_analysis.strip():
                self.elements.append(Paragraph(self.static_data.priority_map_analysis, 
                                             self.style_manager.styles['JustifiedBody']))
            
            self.elements.append(Paragraph("Figure 9: STP Priority Map", 
                                         self.style_manager.styles['FigureCaption']))
            
            # Generate priority map
            priority_image_path = self._generate_image_safely("(i) STP Priority", gdf)
            if priority_image_path and Path(priority_image_path).exists():
                try:
                    with open(priority_image_path, 'rb') as f:
                        image_bytes = io.BytesIO(f.read())
                    
                    image_elements = ImageManager.insert_actual_image(image_bytes)
                    if image_elements:
                        self.elements.extend(image_elements)
                        logger.info("Successfully added priority map")
                    else:
                        self.elements.extend(ImageManager.create_image_placeholder("Figure 9: STP Priority Map"))
                except Exception as e:
                    logger.error(f"Failed to read priority map image: {e}")
                    self.elements.extend(ImageManager.create_image_placeholder("Figure 9: STP Priority Map"))
            else:
                logger.warning("Priority map not generated or file not found")
                self.elements.extend(ImageManager.create_image_placeholder("Figure 9: STP Priority Map"))
            
            self.elements.append(Spacer(1, 15))
            self.elements.append(PageBreak())
            
            # Weights details
            self.elements.append(Paragraph("4.3 Details of the Assigned Weights", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            if self.static_data.weight_details.strip():
                self.elements.append(Paragraph(self.static_data.weight_details, 
                                             self.style_manager.styles['JustifiedBody']))
            
            # Weights table
            weights_table = TableGenerator.create_styled_table(self.table_data.weights_table)
            if weights_table:
                self.elements.append(weights_table)
                self.elements.append(Paragraph("Table 1: Details of the Used Weights", 
                                             self.style_manager.styles['FigureCaption']))
            
            self.elements.append(Spacer(1, 20))
            
            # Village-wise analysis
            self.elements.append(Paragraph("4.4 Village-wise Analysis of the STP Priority", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            if self.static_data.village_analysis.strip():
                self.elements.append(Paragraph(self.static_data.village_analysis, 
                                             self.style_manager.styles['JustifiedBody']))
            
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

    def generate_report(self, clip: List[str] = None) -> str:
        """Generate the complete report with comprehensive error handling."""
        try:
            if not clip:
                raise ValidationError("Clip list is required")
            
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
            
            gdf = self._add_study_area_overview(clip=clip)
            if gdf is None:
                raise ResourceError("Failed to generate study area overview")
            
            self._add_methodology_section()
            self._add_results_section(gdf=gdf)
            self._add_references()
            
            # Build the PDF
            doc.build(self.elements)
            
            # Clean up temporary images after successful PDF generation
            self._cleanup_temp_images()
            
            logger.info(f"Report generated successfully: {full_output_path}")
            return full_output_path
            
        except Exception as e:
            logger.error(f"Failed to generate report: {e}")
            raise STRPReportError(f"Report generation failed: {e}")

class StpDocument:
    """Main document class with improved error handling and resource management."""
    
    def __init__(self):
        try:
            settings = Settings()
            self.raster_url = settings.GEOSERVER_EX_URL
            self.sld_url = settings.GEOSERVER_EX_URL
            self.folder_path = None
            
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
                        temp_path=self.folder_path, 
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
   
    def static_pdf(self, folder_path: str, csv_data: List, 
                   clip: List[str] = None, dpi: int = 100) -> str:
        """Generate static PDF with error handling."""
        try:
            if not clip:
                raise ValidationError("Clip list is required")
            
            config = ReportConfig(
                title="Comprehensive Report on the STP Priority",
                author="IIT BHU",
                output_folder=str(self.pdf_dir)
            )
            
            static_data = StaticTextData(
                downstream_effect_of_drain="This factor identifies locations where untreated sewage could severely impact downstream populations and ecosystems. Drains were analyzed using flow direction and accumulation models to quantify their potential downstream influence (cf. Esri, 2020; Paul & Meyer, 2001).",
                drainage_distance="Drainage distance was calculated using Euclidean and cost-distance algorithms to determine village proximity to the nearest major drain. Villages located closer to these drains are prioritized to reduce unregulated discharge (USEPA, 2004).",
                groundwater_depth="Depth-to-groundwater data were used to assess contamination risk. Shallow aquifers are more vulnerable to pollution, especially where STPs are absent or underperforming (CGWB, 2022)",
                groundwater_quality="Groundwater quality data were used to identify areas of potential contamination. Aquifers with poor groundwater quality were given greater priority (CGWB, 2022).",
                lulc_analysis="The influence of land use was examined using classified satellite imagery to identify dense built-up zones, agricultural fields, and open areas. Urban clusters with high impervious surfaces were given greater priority due to higher sewage production and runoff (Anderson et al., 1976; NRSC, 2021).",
                major_city_risk="Villages in close proximity to major cities are at higher risk of pollution load migration and infrastructure overload. This proximity buffer was used to highlight peri-urban villages lacking STPs but within the influence zone of major urban nodes.",
                population_analysis="Population data were sourced from Census 2011 and projected using appropriate demographic models. Higher population zones were weighted more heavily under the assumption of greater sewage load (National Commission on Population, 2019).",
                proximity_river_quality="Proximity to poor-quality river segments (based on BOD and DO from CPCB datasets) was considered a critical factor. Villages draining into these segments were prioritized for immediate intervention to mitigate ecological degradation (CPCB, 2020).",
            )
            
            table_data = TableData(village_raw_data=csv_data)
            generator = ReportGenerator(config, static_data, table_data, folder_path, dpi=dpi)
            return generator.generate_report(clip=clip)
            
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

    def report_generator(self, layer_names: List, csv_data: List, 
                        clip: List[str] = None, dpi: int = 100) -> str:
        """Generate complete report with automatic cleanup."""
        try:
            if not layer_names:
                raise ValidationError("Layer names list cannot be empty")
            if not clip:
                raise ValidationError("Clip list is required")
            
            # Create temporary folder with unique ID
            temp_folder_name = f"stp_report_{uuid.uuid4().hex[:8]}"
            temp_folder = self.base_dir / temp_folder_name
            temp_folder.mkdir(parents=True, exist_ok=True)
            
            try:
                # Load raster data
                self._raster_loader(str(temp_folder), layer_names)
                
                # Generate PDF
                pdf_path = self.static_pdf(str(temp_folder), csv_data, clip, dpi=dpi)
                
                logger.info(f"Report generated successfully: {pdf_path}")
                return pdf_path
                
            finally:
                # Optional: Clean up temp folder after PDF generation
                # Comment this out if you want to keep images for debugging
                try:
                    shutil.rmtree(temp_folder)
                    logger.info(f"Cleaned up temporary folder: {temp_folder}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup temporary folder {temp_folder}: {e}")
                
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            raise STRPReportError(f"Report generation failed: {e}")
    def report_generator(self,layer_name:list,csv_data:list,clip:list=[],dpi:int=100):
        folder_path=Settings().BASE_DIR+"/temp/"+str(uuid.uuid4())
        os.makedirs(folder_path,exist_ok=True)
        self._raster_loader(folder_path,layer_names=layer_name)
        return self.static_pdf(folder_path,csv_data,clip,dpi=dpi)
