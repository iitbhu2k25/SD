import os
import io
import uuid
import base64
import logging
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch, cm, mm
from datetime import datetime
from shapely.geometry import MultiPolygon
from shapely.ops import unary_union
import requests
from contextlib import contextmanager
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from celery import chord
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
from reportlab.platypus import BaseDocTemplate, PageTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from celery import group, chord
import math
import shutil
from app.conf.celery import app 
from app.conf.settings import Settings
from app.api.schema.stp_schema import StpReportInput

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
    
    def __post_init__(self):
        if self.margins is None:
            self.margins = {
                'top': 2.5*cm,
                'bottom': 2.5*cm,
                'left': 2.5*cm,
                'right': 2.5*cm
            }
        
        if self.output_folder is None:
            # Use a default temp directory if Settings not available
            self.output_folder = "/tmp/stp_reports"
        
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
    weight_details: str = ""
    village_analysis: str = ""
    priority_map_analysis: str = ""

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
    """Generate styled tables for the report."""
    
    @staticmethod
    def create_styled_table(data: List[List[str]], col_widths: Optional[List[float]] = None) -> Optional[Table]:
        """Create a styled table from data."""
        try:
            if not data or len(data) < 2:
                logger.warning("Insufficient data for table creation")
                return None
            
            # Set default column widths if not provided
            if col_widths is None:
                num_cols = len(data[0])
                available_width = 6 * inch  # Total available width
                col_widths = [available_width / num_cols] * num_cols
            
            table = Table(data, colWidths=col_widths)
            
            # Define table style
            table_style = TableStyle([
                # Header style
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                
                # Body style
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                
                # Grid style
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                
                # Alternating row colors
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.beige, colors.lightgrey]),
            ])
            
            table.setStyle(table_style)
            return table
            
        except Exception as e:
            logger.error(f"Failed to create table: {e}")
            return None

class ImageManager:
    """Manage image insertion and placeholders."""
    
    @staticmethod
    def insert_actual_image(image_path: str, width: float = 6*inch, height: float = 4*inch) -> List:
        """Insert an actual image from file path."""
        try:
            if not os.path.exists(image_path):
                logger.warning(f"Image file not found: {image_path}")
                return ImageManager.create_image_placeholder(f"Missing: {os.path.basename(image_path)}")
            
            # Create image element
            img = Image(image_path, width=width, height=height)
            return [img, Spacer(1, 12)]
            
        except Exception as e:
            logger.error(f"Failed to insert image {image_path}: {e}")
            return ImageManager.create_image_placeholder(f"Error: {os.path.basename(image_path) if image_path else 'Unknown'}")
    
    @staticmethod
    def insert_image_from_bytes(image_bytes: BytesIO, width: float = 6*inch, height: float = 4*inch) -> List:
        """Insert image from BytesIO object."""
        try:
            img = Image(ImageReader(image_bytes), width=width, height=height)
            return [img, Spacer(1, 12)]
        except Exception as e:
            logger.error(f"Failed to insert image from bytes: {e}")
            return ImageManager.create_image_placeholder("Error: Invalid image data")
    
    @staticmethod
    def create_image_placeholder(text: str) -> List:
        """Create a placeholder for missing images."""
        try:
            style_manager = StyleManager()
            placeholder = Paragraph(f"[{text}]", style_manager.styles['FigureCaption'])
            return [placeholder, Spacer(1, 12)]
        except Exception as e:
            logger.error(f"Failed to create placeholder: {e}")
            return [Spacer(1, 12)]

class ReportGenerator:
    """Main report generation class with improved error handling."""
    
    def __init__(self, config: ReportConfig, static_data: StaticTextData, 
                 table_data: TableData, dpi: int = 100):
        
        self.config = config
        self.static_data = static_data
        self.table_data = table_data
        self.style_manager = StyleManager()
        self.elements = []
        self.dpi = max(50, min(dpi, 600))  # Constrain DPI
        
        # Default logo paths - adjust these to your actual paths
        self.iit_bhu_logo = "media/images/iitbhu.png"
        self.slcr_logo = "media/images/slcr.png"
    
    def _draw_logos(self, canvas, doc):
        """Draw logos on every page."""
        try:
            logo_y_position = letter[1] - 1*inch
            logo_size = 0.8*inch
            
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
            logger.error(f"Error drawing logos: {e}")
    
    def _create_page_template(self, canvas, doc):
        """Create unified page template for all pages."""
        canvas.saveState()
        
        page_num = canvas.getPageNumber()
        
        try:
            # Draw logos on all pages
            self._draw_logos(canvas, doc)
            
            # Add page number at bottom (skip on first page)
            if page_num > 1:
                text = f"Page {page_num}"
                canvas.setFont('Helvetica', 9)
                canvas.drawRightString(letter[0] - inch, 0.75*inch, text)
                
        except Exception as e:
            logger.error(f"Error in page template: {e}")
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
            logger.error(f"Error adding title page: {e}")
    
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
    
    def _add_study_area_overview(self, study_area_description: str = None):
        """Add study area overview section."""
        try:
            self.elements.append(Paragraph("2. Study Area Overview", 
                                         self.style_manager.styles['SectionHeader']))
            
            if study_area_description:
                overview_text = study_area_description
            else:
                overview_text = """
                The study area encompasses selected villages and urban settlements characterized by varied 
                physiographic and hydrological conditions. Rapid urbanization and increased population 
                density in certain zones have further strained the existing sanitation infrastructure, 
                making sewage management critically important for downstream water quality.
                """
            
            self.elements.append(Paragraph(overview_text, self.style_manager.styles['JustifiedBody']))
            self.elements.append(Spacer(1, 20))
        except Exception as e:
            logger.error(f"Failed to add study area overview: {e}")
    
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
            <b>(a) Data Reclassification:</b> Each factor raster was reclassified into suitability scores ranging from 1 (least priority) to 5 (highest priority). The classification thresholds were derived based on standard guidelines and quantile statistics.<br/><br/>
            <b>(b) Data Normalization:</b> To ensure comparability among heterogeneous datasets, min-max normalization was applied to all continuous variables. Categorical variables were mapped using fixed priority schemes based on expert consultation.<br/><br/>
            <b>(c) Confusion Matrix:</b> To validate the predictive robustness of the prioritization output, confusion matrices were generated by comparing known high-priority sites with the predicted scores.<br/><br/>
            <b>(d) Weighted Overlay:</b> A Weighted Linear Combination (WLC) model was used, integrating all the thematic layers. The final priority score was computed using a weighted sum approach.<br/><br/>
            """
            
            self.elements.append(Paragraph(methodology_text, self.style_manager.styles['JustifiedBody']))
            self.elements.append(PageBreak())
            
        except Exception as e:
            logger.error(f"Failed to add methodology section: {e}")
    
    def _add_results_section(self, layer_results: List[Dict[str, Any]] = None):
        """Add results section with factor maps and analysis."""
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
            
            # Add factor maps if available
            if layer_results:
                figure_num = 1
                for result in layer_results:
                    try:
                        factor_name = result.get('file_name', 'Unknown Factor')
                        file_path = result.get('file_path', '')
                        
                        self.elements.append(Paragraph(f"({chr(96 + figure_num)}) {factor_name}", 
                                                     self.style_manager.styles['SubsectionHeader']))
                        
                        # Add corresponding static text if available
                        factor_key = factor_name.replace(' ', '_').replace('(', '').replace(')', '')
                        static_text = getattr(self.static_data, factor_key, "")
                        if static_text.strip():
                            self.elements.append(Paragraph(static_text, self.style_manager.styles['JustifiedBody']))
                        
                        # Add figure caption
                        self.elements.append(Paragraph(f"Figure {figure_num}: {factor_name} Map", 
                                                     self.style_manager.styles['FigureCaption']))
                        
                        # Add image
                        if file_path and os.path.exists(file_path + ".png"):
                            image_elements = ImageManager.insert_actual_image(file_path + ".png")
                            self.elements.extend(image_elements)
                        else:
                            self.elements.extend(ImageManager.create_image_placeholder(f"Figure {figure_num}: {factor_name} Map"))
                        
                        self.elements.append(Spacer(1, 15))
                        if figure_num % 2 == 0:  # Page break every 2 figures
                            self.elements.append(PageBreak())
                        
                        figure_num += 1
                        
                    except Exception as e:
                        logger.error(f"Error processing factor result: {e}")
                        continue
            
            # Weights details
            self.elements.append(Paragraph("4.2 Details of the Assigned Weights", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            if self.static_data.weight_details.strip():
                self.elements.append(Paragraph(self.static_data.weight_details, 
                                             self.style_manager.styles['JustifiedBody']))
            else:
                default_weight_text = """
                The weights for each factor were assigned based on their relative importance in determining 
                STP priority. Higher weights were given to factors that directly impact public health and 
                environmental quality.
                """
                self.elements.append(Paragraph(default_weight_text, self.style_manager.styles['JustifiedBody']))
            
            # Weights table
            weights_table = TableGenerator.create_styled_table(self.table_data.weights_table)
            if weights_table:
                self.elements.append(weights_table)
                self.elements.append(Paragraph("Table 1: Details of the Used Weights", 
                                             self.style_manager.styles['FigureCaption']))
            
            self.elements.append(Spacer(1, 20))
            
            # Village-wise analysis
            self.elements.append(Paragraph("4.3 Village-wise Analysis of the STP Priority", 
                                         self.style_manager.styles['SubsectionHeader']))
            
            if self.static_data.village_analysis.strip():
                self.elements.append(Paragraph(self.static_data.village_analysis, 
                                             self.style_manager.styles['JustifiedBody']))
            else:
                default_village_text = """
                The village-wise analysis shows the distribution of priority levels across different settlements. 
                Villages with higher priority scores require immediate attention for STP development.
                """
                self.elements.append(Paragraph(default_village_text, self.style_manager.styles['JustifiedBody']))
            
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
    
    def generate_report(self, layer_names: List = None, study_area_description: str = None) -> str:
        """Generate the complete report with comprehensive error handling."""
        try:
            from reportlab.platypus import SimpleDocTemplate
            
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
            self._add_study_area_overview(study_area_description)
            self._add_methodology_section()
            self._add_results_section(layer_names)
            self._add_references()
            
            # Build the document
            doc.build(
                self.elements,
                onFirstPage=self._create_page_template,
                onLaterPages=self._create_page_template
            )
            
            logger.info(f"Report generated successfully: {full_output_path}")
            return full_output_path
            
        except Exception as e:
            logger.error(f"Failed to generate report: {e}")
            raise STRPReportError(f"Report generation failed: {e}")

class StpDocument:
    """Main document class with improved error handling and resource management."""
    
    def __init__(self, folder_path: str = None):
        try:
            # Use default paths if Settings not available
            self.document_path = "/tmp/stp_documents"
            self.folder_path = folder_path
            
            os.makedirs(self.document_path, exist_ok=True)
            if self.folder_path is not None:
                os.makedirs(folder_path, exist_ok=True)
                os.makedirs(folder_path + "/geoserver", exist_ok=True)
                os.makedirs(folder_path + "/image", exist_ok=True)
            
        except Exception as e:
            logger.error(f"Failed to initialize StpDocument: {e}")
            raise STRPReportError(f"Initialization failed: {e}")
    
    def _geoserver_load(self, layer_names: List) -> List:
        """Load data from geoserver with error handling."""
        response = []
        for layer in layer_names:
            try:
                if hasattr(layer, 'layer_name'):
                    # Simulate geoserver download - replace with actual implementation
                    resp = {
                        'raster_path': f"{self.folder_path}/geoserver/{layer.layer_name}.tif",
                        'sld_path': f"{self.folder_path}/geoserver/{layer.layer_name}.sld"
                    }
                    response.append(resp)
                else:
                    logger.warning(f"Invalid layer object: {layer}")
                    response.append(None)
            except Exception as e:
                logger.error(f"Failed to download layer {getattr(layer, 'layer_name', 'unknown')}: {e}")
                response.append(None)
        return response
   
    def static_pdf(self, folder_path: list, csv_data: List) -> str:
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
                weight_details="The weights for each factor were assigned based on their relative importance in determining STP priority. Higher weights were given to factors that directly impact public health and environmental quality.",
                village_analysis="The village-wise analysis shows the distribution of priority levels across different settlements. Villages with higher priority scores require immediate attention for STP development.",
                priority_map_analysis="The priority map integrates all factors to show the overall STP priority across the study area."
            )
            
            table_data = TableData(village_raw_data=csv_data)
            generator = ReportGenerator(config, static_data, table_data)
            return generator.generate_report(layer_names=folder_path)
            
        except Exception as e:
            logger.error(f"Failed to generate static PDF: {e}")
            raise STRPReportError(f"PDF generation failed: {e}")

    def report_generator(self, layer_names: List, csv_data: List) -> str:
        """Generate complete report with automatic cleanup."""
        try:
            if not layer_names:
                raise ValidationError("Layer names list cannot be empty")
            
            try:
                # Generate PDF
                pdf_path = self.static_pdf(folder_path=layer_names, csv_data=csv_data)
                
                logger.info(f"Report generated successfully: {pdf_path}")
                return pdf_path
            except Exception as e:
                logger.error(f"Report generation error: {e}")
                raise
                
        except Exception as e:
            logger.error(f"Report generation failed: {e}")
            raise STRPReportError(f"Report generation failed: {e}")

# Additional utility functions for your existing code

@contextmanager
def managed_figure(figsize=(12, 10), dpi=100):
    """Context manager for matplotlib figures."""
    fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
    try:
        yield fig, ax
    finally:
        plt.close(fig)

def calculate_zoom_level(polygon, map_width, map_height):
    """Calculate zoom level for map display."""
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

    return zoom_level, polygon.centroid.x, polygon.centroid.y

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

class SpatialDataset:
    """Handle spatial dataset operations."""
    
    def __init__(self):
        self.village_path = "path/to/villages.shp"  # Update with actual path
    
    def find_village(self, clip: list) -> gpd.GeoDataFrame:
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

    def _save_plot(self, fig, file_path: str) -> None:
        """Save plot to file with error handling."""
        try:
            fig.savefig(
                file_path + ".png",
                format='png', 
                dpi=self.dpi,
                bbox_inches='tight', 
                pad_inches=0.1,
                facecolor='white',
                edgecolor='none'
            )
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
                   filtered_vector: list) -> Optional[str]:
        """Generate map image and save to file."""
        try:
            validate_file_exists(raster_path, "Raster file")
            validate_file_exists(sld_path, "SLD file") 
            
            # Get filtered villages - replace with actual implementation
            spatial_dataset = SpatialDataset()
            filtered = spatial_dataset.find_village(clip=filtered_vector)
            filtered_new = filtered.to_crs("EPSG:4326")
            single_polygon = unary_union(filtered_new.geometry)
            validate_geodataframe(filtered, "Filtered vector")
            
            if isinstance(single_polygon, MultiPolygon):
                single_polygon = single_polygon.geoms[0]

            color_map = self._parse_color_map_entries(sld_path)
            values, hex_colors, labels = zip(*color_map)
            rgb_colors = [self._hex_to_rgb_tuple(c) for c in hex_colors]
            cmap = ListedColormap(rgb_colors)
            norm = BoundaryNorm(list(values) + [max(values)+1], len(values))
            
            # Create figure with context manager
            with managed_figure(figsize=(25, 25), dpi=self.dpi) as (fig, ax):
                with rasterio.open(raster_path) as src:
                    raster_crs = src.crs
                    raster_bounds = src.bounds
                
                zoom, latitude, longitude = calculate_zoom_level(single_polygon, src.width, src.height)

                # Optional: Get satellite base map (comment out if service unavailable)
                try:
                    resp = requests.get("http://docker-staticmaps:3000/staticmaps", 
                                      params={
                                          "width": src.width,
                                          "height": src.height,
                                          "basemap": "satellite",
                                          "center": f"{longitude},{latitude}",
                                          "zoom": zoom,
                                      }, timeout=10)
                    resp.raise_for_status()
                    
                    satellite_img = PILImage.open(BytesIO(resp.content))
                    ax.imshow(satellite_img, extent=[raster_bounds.left, raster_bounds.right, 
                                                   raster_bounds.bottom, raster_bounds.top],
                             aspect='auto', alpha=0.7)
                except Exception as e:
                    logger.warning(f"Failed to load satellite base map: {e}")
                
                # Overlay colored raster data
                bounds, im = self._color_raster(ax, cmap, norm, raster_path)
                
                # Reproject vector to match raster CRS if needed
                if filtered_new.crs != raster_crs:
                    try:
                        filtered_new = filtered_new.to_crs(raster_crs)
                    except Exception as e:
                        logger.warning(f"Failed to reproject vector: {e}")
                
                # Overlay vector data
                filtered_new.plot(
                    ax=ax, 
                    facecolor='none', 
                    edgecolor='black', 
                    linewidth=0.5,
                    alpha=0.95,
                    linestyle='-'
                )
                
                # Set axis properties
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
                    title="Legends", 
                    loc='upper center',
                    bbox_to_anchor=(0.5, -0.12),
                    fontsize=20,
                    title_fontsize=34,
                    framealpha=0.9
                )

                plt.tight_layout()
                self._save_plot(fig, file_path=file_path[:-4])
                return file_path
                    
        except Exception as e:
            logger.error(f"Failed to generate image: {e}")
            raise ResourceError(f"Image generation failed: {e}")

# Example usage function
def generate_stp_report_example():
    """Example function showing how to use the STP report generator."""
    try:
        # Example data
        sample_csv_data = [
            {
                'Village_Name': 'Village A',
                'Very_Low': 10.5,
                'Low': 20.3,
                'Medium': 35.2,
                'High': 25.0,
                'Very_High': 9.0
            },
            {
                'Village_Name': 'Village B', 
                'Very_Low': 5.2,
                'Low': 15.8,
                'Medium': 30.1,
                'High': 35.9,
                'Very_High': 13.0
            }
        ]
        
        # Create document generator
        doc_generator = StpDocument()
        
        # Generate report (replace with actual layer data)
        sample_layers = [
            {'file_name': 'Population Density', 'file_path': '/path/to/population_map'},
            {'file_name': 'Groundwater Depth', 'file_path': '/path/to/groundwater_map'}
        ]
        
        report_path = doc_generator.report_generator(
            layer_names=sample_layers,
            csv_data=sample_csv_data
        )
        
        print(f"Report generated successfully: {report_path}")
        return report_path
        
    except Exception as e:
        logger.error(f"Failed to generate example report: {e}")
        return None


@app.task(bind=True,pydantic=True,name="main pdf generation")
def document_gen(self,payload: StpReportInput):
    unique_folder_path=f"{Settings().TEMP_DIR}/{str(uuid.uuid4())}"
    try:
        file_paths=StpDocument(unique_folder_path)._geoserver_load(layer_names=payload.raster)
        tasks = []
        for item in file_paths:
            file_name = os.path.basename(item["raster_path"])  # Gets the file name from the full path
            file_path = os.path.join(unique_folder_path, "image", file_name)  
            tasks.append(
            celery_currency.s(
            file_path=file_path,
            raster_path=item["raster_path"],
            sld_path=item["sld_path"],
            clip=payload.clip ) # Ensure it's serializable
        )
        table_data = [item.model_dump() for item in payload.table]
        job = chord(group(tasks))(final_step.s(table_data=table_data))
        

    except Exception as e:
        logger.error(f"Failed to load raster data: {e}")
        raise STRPReportError(f"PDF generation failed: {e}")

@app.task(bind=True,pydantic=True,name="celery_currency")
def celery_currency(self,file_path:str,raster_path:str,sld_path:str,clip:List[str])-> dict:
    file_path=MapGenerator(dpi=10).make_image(file_path=file_path,raster_path=raster_path,sld_path=sld_path,filtered_vector=clip)
    return{
        "file_path":file_path,
        "file_name":(os.path.splitext(os.path.basename(file_path))[0]).replace("_", " ")
    }

@app.task(bind=True,pydantic=True,name="pdf_generation_start")
def final_step(self,results: List[dict],table_data:list)->None:
    pass
    # pdf_path=StpDocument().report_generator(layer_names=results, csv_data=table_data)
    # print(pdf_path)