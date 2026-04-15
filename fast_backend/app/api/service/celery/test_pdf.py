# import os
# import io
# import uuid
# import string
# from reportlab.platypus import  Frame, Paragraph, Spacer, PageBreak, Table, TableStyle
# from reportlab.lib import colors
# from reportlab.lib.pagesizes import letter
# from reportlab.lib.units import inch
# from datetime import datetime
# from shapely.geometry import mapping
# from rasterio.io import MemoryFile
# from shapely.ops import unary_union
# from rasterio.mask import mask 
# from contextlib import contextmanager
# from datetime import datetime
# from typing import Dict, List, Optional, Tuple, Any, Union
# from dataclasses import dataclass, field, asdict
# from io import BytesIO
# from pathlib import Path
# from celery import chord
# import numpy as np
# import geopandas as gpd
# import matplotlib.pyplot as plt
# import contextily as ctx
# import rasterio
# from matplotlib.colors import ListedColormap, BoundaryNorm
# from matplotlib.patches import Patch
# from matplotlib_scalebar.scalebar import ScaleBar
# from lxml import etree
# from PIL import Image as PILImage
# from reportlab.platypus import (
#     SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
#     PageBreak, Image, HRFlowable, KeepTogether
# )
# from reportlab.lib.styles import getSampleStyleSheet
# from datetime import datetime
# from reportlab.lib import colors
# from reportlab.lib.pagesizes import A4, letter
# from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
# from reportlab.lib.units import inch, cm, mm
# from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
# from reportlab.platypus import (
#     SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
#     PageBreak, Image
# )
# from reportlab.platypus.frames import Frame
# from celery import group, chord
# from app.conf.settings import Settings
# from app.api.service.geoserver_svc.geoserver import Geoserver
# from app.conf.celery import app
# from app.api.schema.stp_schema import  StpsuitabilityAdminReport
# import math
# from reportlab.platypus import Frame
# from reportlab.lib.units import inch
# from reportlab.lib.pagesizes import letter
# import rasterio
# import contextily as ctx
# import matplotlib.pyplot as plt
# from rasterio.warp import calculate_default_transform, reproject
# import numpy as np
# import rasterio
# import matplotlib.pyplot as plt
# from app.utils.network_conf import GeoConfig
# from celery_progress.backend import ProgressRecorder
# import time
# from reportlab.pdfbase import pdfmetrics
# from reportlab.pdfbase.ttfonts import TTFont
# from app.conf.logging import logger
# from reportlab.pdfbase.pdfmetrics import registerFontFamily
# registerFontFamily(
#     'TimesNewRoman',
#     normal='TimesNewRoman',
#     bold='TimesNewRoman-Bold',
#     italic='TimesNewRoman-Italic',
#     boldItalic='TimesNewRoman-BoldItalic'
# )


# FONT_PATH = '/usr/share/fonts/truetype/msttcorefonts/'

# pdfmetrics.registerFont(TTFont('TNR',         f'{FONT_PATH}Times_New_Roman.ttf'))
# pdfmetrics.registerFont(TTFont('TNR-Bold',    f'{FONT_PATH}Times_New_Roman_Bold.ttf'))
# pdfmetrics.registerFont(TTFont('TNR-Italic',  f'{FONT_PATH}Times_New_Roman_Italic.ttf'))
# pdfmetrics.registerFont(TTFont('TNR-BI',      f'{FONT_PATH}Times_New_Roman_Bold_Italic.ttf'))


# # ─────────────────────────────────────────────
# # DESIGN TOKENS  – change here to retheme the whole doc
# # ─────────────────────────────────────────────
# class Theme:
#     # Primary palette
#     PRIMARY       = colors.HexColor("#1B3A6B")   # deep navy
#     SECONDARY     = colors.HexColor("#2E6DA4")   # medium blue
#     ACCENT        = colors.HexColor("#4A9FD4")   # light blue
#     SUCCESS       = colors.HexColor("#2D6A4F")   # forest green

#     # Neutrals
#     DARK          = colors.HexColor("#1A1A1A")
#     MID           = colors.HexColor("#4A4A4A")
#     LIGHT         = colors.HexColor("#7A7A7A")
#     RULE          = colors.HexColor("#D0D7E2")
#     BG_LIGHT      = colors.HexColor("#F4F7FB")   # soft blue-white
#     BG_ALT        = colors.HexColor("#EBF0F8")
#     WHITE         = colors.white

#     # Table
#     TBL_HEADER    = PRIMARY
#     TBL_ROW_A     = colors.white
#     TBL_ROW_B     = colors.HexColor("#F0F4FA")
#     TBL_BORDER    = colors.HexColor("#C8D3E6")

#     # Typography scale
#     SIZE_HERO     = 26
#     SIZE_H1       = 15
#     SIZE_H2       = 13
#     SIZE_H3       = 11
#     SIZE_BODY     = 10.5
#     SIZE_SMALL    = 9
#     SIZE_CAPTION  = 9

#     FONT          = 'TNR'
#     FONT_BOLD     = 'TNR-Bold'
#     FONT_ITALIC   = 'TNR-Italic'
#     FONT_BI       = 'TNR-BI'

#     # Page geometry
#     PAGE          = A4
#     MARGIN_TOP    = 3.5 * cm
#     MARGIN_BOTTOM = 2.5 * cm
#     MARGIN_LEFT   = 2.8 * cm
#     MARGIN_RIGHT  = 2.8 * cm
#     HEADER_H      = 1.1 * cm   # coloured banner height
#     FOOTER_H      = 0.9 * cm

# # Register font family for easier usage

# from app.conf.redis.redis_manager import redis_manager

# PILImage.MAX_IMAGE_PIXELS = 500000000
# class STRPReportError(Exception):
#     """Custom exception for STP report generation errors."""
#     pass

# class ValidationError(STRPReportError):
#     """Raised when input validation fails."""
#     pass

# class ResourceError(STRPReportError):
#     """Raised when resource operations fail."""
#     pass



# @dataclass
# class ReportConfig:
#     """Configuration for report generation with validation."""
#     title: str = "Comprehensive Report on the STP suitability"
#     author: str = "IIT BHU"
#     subject: str = "STP suitability Analysis"
#     output_filename: str = field(default_factory=lambda: f"STP_suitability_Report_{uuid.uuid4()}.pdf")
#     page_size: Tuple = A4
#     margins: Optional[Dict[str, float]] = None
#     output_folder: Optional[str] = None
#     frame = Frame(
#             inch, inch,
#             letter[0] - 2*inch,
#             letter[1] - 2*inch,
#             leftPadding=0, bottomPadding=0,
#             rightPadding=0, topPadding=0,
#             id='normal'
#         )
    
#     def __post_init__(self):
#         if self.margins is None:
#             self.margins = {
#                 'top': 4.7*cm,
#                 'bottom': 2.5*cm,
#                 'left': 2.5*cm,
#                 'right': 3.2*cm
#             }
        
#         if self.output_folder is None:
#             self.output_folder = Settings().BASE_DIR
        
#         # Ensure output folder exists
#         Path(self.output_folder).mkdir(parents=True, exist_ok=True)
    
#     def get_full_output_path(self) -> str:
#         return str(Path(self.output_folder) / self.output_filename)

# @dataclass
# class StaticTextData:
#     Distance_from_Builtup: str = ""
#     Distance_from_Waterbody: str = ""
#     Elevation: str = ""
#     Geomorphology: str = ""
#     Groundwater_Depth: str = "" 
#     Groundwater_Quality: str = ""
#     Land_Availability: str = ""
#     Land_Use_Land_Cover: str = ""
#     Population_Density: str = ""
#     Slope: str = ""
#     Soil_Texture: str = ""
#     ASI_Sites_constraint: str = ""
#     Builtup_constraint: str = ""
#     Flood_Plain_constraint: str = ""
#     Groundwater_Depth_constraint: str = ""
#     Highway_constraint: str = ""
#     Railway_constraint: str = ""
#     STP_constraint: str = ""
#     Water_Body_constraint: str = ""
#     STP_suitability: str = ""
    
   
# @dataclass
# class TableData:
#     """Table data with validation and conversion."""
#     weights_table: Optional[List[List[str]]] = None
#     village_suitability_table: Optional[List[List[str]]] = None
#     village_raw_data: Optional[List[Dict[str, Any]]] = None
    
#     def __post_init__(self):
#         if self.village_raw_data and not self.village_suitability_table:
#             try:
#                 self.village_suitability_table = self._convert_raw_data_to_table()
#             except Exception as e:
#                 logger.error(f"Failed to convert raw village data: {e}")
#                 self.village_suitability_table = [
#                     ["Village Name", "Very Low (%)", "Low (%)", "Medium (%)", "High (%)", "Very High (%)"]
#                 ]
#         elif self.village_suitability_table is None:
#             self.village_suitability_table = [
#                 ["Village Name", "Very Low (%)", "Low (%)", "Medium (%)", "High (%)", "Very High (%)"]
#             ]
    
#     def _convert_raw_data_to_table(self) -> List[List[str]]:
#         """Convert raw dictionary data to table format with error handling."""
#         if not self.village_raw_data:
#             return []
        
#         headers = ["Village Name", "Very Low (%)", "Low (%)", "Medium (%)", "High (%)", "Very High (%)"]
#         table_data = [headers]
        
#         try:
#             # Sort by Very_High value in descending order
#             sorted_data = sorted(
#                 self.village_raw_data, 
#                 key=lambda x: x.get('Very_High', 0) if isinstance(x, dict) else getattr(x, 'Very_High', 0), 
#                 reverse=True
#             )
            
#             for village_data in sorted_data:
#                 try:
#                     # Handle both dict and object types
#                     if hasattr(village_data, 'dict'):
#                         data_dict = village_data.dict()
#                     else:
#                         data_dict = village_data
                    
#                     village_name = data_dict.get('Village_Name', 'Unknown')
#                     very_low = f"{data_dict.get('Very_Low', 0):.2f}"
#                     low = f"{data_dict.get('Low', 0):.2f}"
#                     medium = f"{data_dict.get('Medium', 0):.2f}"
#                     high = f"{data_dict.get('High', 0):.2f}"
#                     very_high = f"{data_dict.get('Very_High', 0):.2f}"
                    
#                     row = [village_name, very_low, low, medium, high, very_high]
#                     table_data.append(row)
                    
#                 except Exception as e:
#                     logger.warning(f"Skipping invalid village data: {e}")
#                     continue
                    
#         except Exception as e:
#             logger.error(f"Error processing village data: {e}")
            
#         return table_data

# @contextmanager
# def managed_figure(figsize=(12, 10), dpi=200):
   
#     fig, ax = plt.subplots(figsize=figsize, dpi=dpi)
#     try:
#         yield fig, ax
#     finally:
#         plt.close(fig)
        
# def calculate_zoom_level(polygon, map_width, map_height):
#     # Get the bounds of the polygon
#     minx, miny, maxx, maxy = polygon.bounds

#     # Calculate the width and height of the bounding box
#     bbox_width = maxx - minx
#     bbox_height = maxy - miny

#     # Determine the maximum dimension
#     max_dim = max(bbox_width, bbox_height)

#     # Calculate zoom level based on the maximum dimension
#     zoom_level = math.floor(math.log(360 / max_dim) / math.log(2))

#     # Ensure zoom level is within the valid range
#     zoom_level = max(1, min(21, zoom_level))

#     return zoom_level,polygon.centroid.x,polygon.centroid.y

# def validate_file_exists(filepath: Union[str, Path], description: str = "File") -> Path:
#     """Validate that a file exists and return Path object."""
#     path = Path(filepath)
#     if not path.exists():
#         raise ResourceError(f"{description} does not exist: {filepath}")
#     return path

# def validate_geodataframe(gdf: gpd.GeoDataFrame, name: str = "GeoDataFrame") -> None:
#     """Validate GeoDataFrame input."""
#     if gdf is None:
#         raise ValidationError(f"{name} cannot be None")
#     if gdf.empty:
#         raise ValidationError(f"{name} cannot be empty")
#     if gdf.crs is None:
#         raise ValidationError(f"{name} must have a defined CRS")
    
# class ImageManager:
#     @staticmethod
#     def insert_actual_image(
#         image_stream: BytesIO,
#         width: float = 5.5 * inch,
#         height: float = 3.8 * inch
#     ) -> Optional[List]:
#         try:
#             if not isinstance(image_stream, BytesIO):
#                 return None
#             image_stream.seek(0)
#             img = Image(image_stream, width=width, height=height, hAlign='CENTER')
#             return [img]
#         except Exception as e:
#             logger.error(f"Failed to insert image: {e}")
#             return None


# class StyleManager:
#     _instance = None
#     _styles   = None

#     def __new__(cls):
#         if cls._instance is None:
#             cls._instance = super().__new__(cls)
#         return cls._instance

#     def __init__(self):
#         if StyleManager._styles is None:
#             self.styles = getSampleStyleSheet()
#             self._build()
#             StyleManager._styles = self.styles
#         else:
#             self.styles = StyleManager._styles

#     def _add(self, name, **kw):
#         parent_name = kw.pop('parent', 'Normal')
#         parent = self.styles[parent_name]
#         if name not in self.styles:
#             self.styles.add(ParagraphStyle(name=name, parent=parent, **kw))

#     def _build(self):
#         T = Theme

#         # ── Cover title ──────────────────────────────────────────────
#         self._add('CoverTitle',
#             parent='Title',
#             fontName=T.FONT_BOLD, fontSize=T.SIZE_HERO,
#             textColor=T.WHITE, alignment=TA_CENTER,
#             leading=T.SIZE_HERO * 1.25, spaceAfter=8)

#         self._add('CoverSubtitle',
#             fontName=T.FONT_ITALIC, fontSize=13,
#             textColor=colors.HexColor("#BDD5F0"), alignment=TA_CENTER,
#             leading=18, spaceAfter=6)

#         self._add('CoverMeta',
#             fontName=T.FONT, fontSize=11,
#             textColor=colors.HexColor("#D0E4F7"), alignment=TA_CENTER,
#             leading=16, spaceBefore=4)

#         # ── Section headers ──────────────────────────────────────────
#         self._add('H1',
#             parent='Heading1',
#             fontName=T.FONT_BOLD, fontSize=T.SIZE_H1,
#             textColor=T.PRIMARY,
#             spaceBefore=18, spaceAfter=6, leading=20,
#             borderPadding=(0, 0, 4, 0))

#         self._add('H2',
#             parent='Heading2',
#             fontName=T.FONT_BOLD, fontSize=T.SIZE_H2,
#             textColor=T.SECONDARY,
#             spaceBefore=14, spaceAfter=4, leading=18)

#         self._add('H3',
#             parent='Heading3',
#             fontName=T.FONT_BOLD, fontSize=T.SIZE_H3,
#             textColor=T.SUCCESS,
#             spaceBefore=10, spaceAfter=3, leading=15)

#         # ── Body ─────────────────────────────────────────────────────
#         self._add('Body',
#             fontName=T.FONT, fontSize=T.SIZE_BODY,
#             textColor=T.DARK, alignment=TA_JUSTIFY,
#             leading=16, spaceAfter=8)

#         self._add('BodyLeft',
#             fontName=T.FONT, fontSize=T.SIZE_BODY,
#             textColor=T.DARK, alignment=TA_LEFT,
#             leading=16, spaceAfter=8)

#         # ── Caption / label ──────────────────────────────────────────
#         self._add('Caption',
#             fontName=T.FONT_ITALIC, fontSize=T.SIZE_CAPTION,
#             textColor=T.LIGHT, alignment=TA_CENTER,
#             leading=12, spaceBefore=4, spaceAfter=10)

#         self._add('TableLabel',
#             fontName=T.FONT_BOLD, fontSize=T.SIZE_CAPTION,
#             textColor=T.MID, alignment=TA_LEFT,
#             leading=12, spaceBefore=12, spaceAfter=3)

#         # ── Reference list ───────────────────────────────────────────
#         self._add('RefItem',
#             fontName=T.FONT, fontSize=T.SIZE_SMALL,
#             textColor=T.MID, alignment=TA_JUSTIFY,
#             leading=13, spaceAfter=5, leftIndent=14, firstLineIndent=-14)

#         # ── Table cell text ──────────────────────────────────────────
#         self._add('TblCell',
#             fontName=T.FONT, fontSize=T.SIZE_SMALL,
#             textColor=T.DARK, alignment=TA_LEFT, leading=12)

#         self._add('TblHeader',
#             fontName=T.FONT_BOLD, fontSize=T.SIZE_SMALL,
#             textColor=T.WHITE, alignment=TA_CENTER, leading=12)


# class TableGenerator:
#     @staticmethod
#     def create_styled_table(
#         data: List[List[str]],
#         col_widths: Optional[List[float]] = None
#     ) -> Optional[Table]:
#         if not data or len(data) < 2:
#             return None
#         try:
#             T = Theme
#             sm = StyleManager()

#             # Inject S.No column
#             header = ["S. No"] + list(data[0])
#             rows   = [[str(i)] + list(r) for i, r in enumerate(data[1:], 1)]
#             table_data = [header] + rows

#             # Render header cells as styled Paragraphs
#             table_data[0] = [
#                 Paragraph(str(cell), sm.styles['TblHeader'])
#                 for cell in table_data[0]
#             ]
#             for ri, row in enumerate(table_data[1:], 1):
#                 table_data[ri] = [
#                     Paragraph(str(cell), sm.styles['TblCell'])
#                     for cell in row
#                 ]

#             tbl = Table(table_data, colWidths=col_widths, hAlign='LEFT', repeatRows=1)

#             style = TableStyle([
#                 # Header band
#                 ('BACKGROUND',    (0, 0), (-1,  0), T.TBL_HEADER),
#                 ('TEXTCOLOR',     (0, 0), (-1,  0), T.WHITE),
#                 ('FONTNAME',      (0, 0), (-1,  0), T.FONT_BOLD),
#                 ('FONTSIZE',      (0, 0), (-1,  0), T.SIZE_SMALL),
#                 ('TOPPADDING',    (0, 0), (-1,  0), 8),
#                 ('BOTTOMPADDING', (0, 0), (-1,  0), 8),
#                 ('ALIGN',         (0, 0), (-1,  0), 'CENTER'),

#                 # Data rows
#                 ('FONTNAME',      (0, 1), (-1, -1), T.FONT),
#                 ('FONTSIZE',      (0, 1), (-1, -1), T.SIZE_SMALL),
#                 ('TOPPADDING',    (0, 1), (-1, -1), 6),
#                 ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
#                 ('LEFTPADDING',   (0, 0), (-1, -1), 8),
#                 ('RIGHTPADDING',  (0, 0), (-1, -1), 8),
#                 ('ALIGN',         (0, 1), ( 0, -1), 'CENTER'),   # S.No centred
#                 ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),

#                 # Alternating rows
#                 ('ROWBACKGROUNDS', (0, 1), (-1, -1), [T.TBL_ROW_A, T.TBL_ROW_B]),

#                 # Grid
#                 ('GRID',          (0, 0), (-1, -1), 0.4, T.TBL_BORDER),
#                 ('LINEBELOW',     (0, 0), (-1,  0), 1.5, T.SECONDARY),  # bold header bottom
#             ])
#             tbl.setStyle(style)
#             return tbl

#         except Exception as e:
#             logger.error(f"Failed to create table: {e}")
#             return None

# # ─────────────────────────────────────────────
# def _draw_page_chrome(canvas, doc, iit_logo: str, slcr_logo: str, is_cover=False):
#     """Draw header strip, footer rule, logos, and page number."""
#     canvas.saveState()
#     T = Theme
#     W, H = T.PAGE

#     # ── Header strip ──────────────────────────────────────────────
#     strip_h = T.HEADER_H
#     canvas.setFillColor(T.PRIMARY)
#     canvas.rect(0, H - strip_h, W, strip_h, fill=1, stroke=0)

#     # Logos inside the header strip (vertically centred)
#     logo_h   = strip_h * 0.82
#     logo_pad = 6 * mm
#     logo_y   = H - strip_h + (strip_h - logo_h) / 2

#     if os.path.exists(iit_logo):
#         canvas.drawImage(iit_logo, logo_pad, logo_y,
#                          width=logo_h, height=logo_h,
#                          preserveAspectRatio=True, mask='auto')

#     if os.path.exists(slcr_logo):
#         canvas.drawImage(slcr_logo, W - logo_h - logo_pad, logo_y,
#                          width=logo_h, height=logo_h,
#                          preserveAspectRatio=True, mask='auto')

#     # Institution label centred in strip
#     if not is_cover:
#         canvas.setFont(T.FONT_BOLD, 8)
#         canvas.setFillColor(T.WHITE)
#         canvas.drawCentredString(W / 2, H - strip_h + 3 * mm, "IIT BHU · STP Suitability Analysis")

#     # ── Footer ─────────────────────────────────────────────────────
#     footer_y = T.MARGIN_BOTTOM * 0.45
#     canvas.setStrokeColor(T.RULE)
#     canvas.setLineWidth(0.5)
#     canvas.line(T.MARGIN_LEFT, footer_y + 5 * mm,
#                 W - T.MARGIN_RIGHT, footer_y + 5 * mm)

#     if not is_cover:
#         page_num = canvas.getPageNumber()
#         canvas.setFont(T.FONT, 8)
#         canvas.setFillColor(T.LIGHT)
#         canvas.drawRightString(W - T.MARGIN_RIGHT, footer_y,
#                                f"Page {page_num}")
#         canvas.drawString(T.MARGIN_LEFT, footer_y,
#                           "Comprehensive Report on STP Suitability")

#     canvas.restoreState()


# # ─────────────────────────────────────────────
# # SECTION DIVIDERS  (reusable helpers)
# # ─────────────────────────────────────────────
# def section_rule() -> HRFlowable:
#     """Thin coloured rule below a section heading."""
#     return HRFlowable(
#         width="100%", thickness=1.2,
#         color=Theme.ACCENT, spaceAfter=6
#     )


# def light_rule() -> HRFlowable:
#     return HRFlowable(
#         width="100%", thickness=0.4,
#         color=Theme.RULE, spaceAfter=4
#     )


# # ─────────────────────────────────────────────
# # COVER PAGE BUILDER
# # ─────────────────────────────────────────────
# def build_cover(elements: list, config, sm: StyleManager):
#     T = Theme
#     W, H = T.PAGE

#     # Deep-navy full-page background drawn via canvas (see onFirstPage callback).
#     # Here we position Platypus content for the text block.

#     elements.append(Spacer(1, 2.6 * inch))

#     elements.append(Paragraph(config.title, sm.styles['CoverTitle']))
#     elements.append(Spacer(1, 0.15 * inch))
#     elements.append(Paragraph(
#         "A Geospatial &amp; Multi-Criteria Analysis for<br/>"
#         "Prioritizing Sewage Treatment Infrastructure",
#         sm.styles['CoverSubtitle']
#     ))
#     elements.append(Spacer(1, 0.5 * inch))

#     # Thin gold divider
#     elements.append(HRFlowable(
#         width="55%", thickness=1.5,
#         color=colors.HexColor("#E8C84A"),
#         hAlign='CENTER', spaceAfter=18
#     ))

#     meta_lines = (
#         f"<b>Prepared by:</b>  {config.author}<br/>"
#         f"<b>Date:</b>  {datetime.now():%B %d, %Y}<br/>"
#         f"<b>Subject:</b>  {config.subject}"
#     )
#     elements.append(Paragraph(meta_lines, sm.styles['CoverMeta']))
#     elements.append(PageBreak())


# def _cover_background(canvas, doc, iit_logo, slcr_logo):
#     """Paint the navy cover background + logos on page 1."""
#     canvas.saveState()
#     T = Theme
#     W, H = T.PAGE

#     # Full-bleed navy
#     canvas.setFillColor(T.PRIMARY)
#     canvas.rect(0, 0, W, H, fill=1, stroke=0)

#     # Lighter accent band at top
#     canvas.setFillColor(T.SECONDARY)
#     canvas.rect(0, H * 0.88, W, H * 0.12, fill=1, stroke=0)

#     # Gold accent strip at bottom
#     canvas.setFillColor(colors.HexColor("#E8C84A"))
#     canvas.rect(0, 0, W, 6, fill=1, stroke=0)

#     # Logos in top band
#     logo_h   = H * 0.07
#     logo_pad = 8 * mm
#     logo_y   = H * 0.90

#     if os.path.exists(iit_logo):
#         canvas.drawImage(iit_logo, logo_pad, logo_y,
#                          width=logo_h, height=logo_h,
#                          preserveAspectRatio=True, mask='auto')
#     if os.path.exists(slcr_logo):
#         canvas.drawImage(slcr_logo, W - logo_h - logo_pad, logo_y,
#                          width=logo_h, height=logo_h,
#                          preserveAspectRatio=True, mask='auto')

#     canvas.restoreState()



# class SpatialDataset(GeoConfig):
#     def __init__(self):
#         super().__init__()
#         self.village_path = self.villages_shapefile
#         self.town_path = self.town_shapefile
    
#     def find_sub_village(self,clip:list)->gpd.GeoDataFrame:
#         try:
#             if not clip:
#                 raise ValidationError("Clip list cannot be empty")
            
#             validate_file_exists(self.village_path, "Village file")
            
#             gdf = gpd.read_file(self.village_path).to_crs(epsg=3857)
#             gdf = gdf[gdf['subdis_cod'].isin(clip)]
            
#             if gdf.empty:
#                 raise ValidationError(f"No village polygon found for clip IDs: {clip}")
            
#             return gdf
#         except Exception as e:
#             logger.error(f"Failed to filter villages: {e}")
#             raise
    
#     def find_village(self,clip:list)->gpd.GeoDataFrame:
#         try:
#             if not clip:
#                 raise ValidationError("Clip list cannot be empty")
            
#             validate_file_exists(self.village_path, "Village file")
            
#             gdf = gpd.read_file(self.village_path).to_crs(epsg=3857)
#             gdf = gdf[gdf['ID'].isin(clip)]
            
#             if gdf.empty:
#                 raise ValidationError(f"No village polygon found for clip IDs: {clip}")
            
#             return gdf
#         except Exception as e:
#             logger.error(f"Failed to filter villages: {e}")
#             raise
#     def find_towns(self,clip:list)->gpd.GeoDataFrame:
#         try:
#             if not clip:
#                 raise ValidationError("Clip list cannot be empty")
            
#             validate_file_exists(self.town_shapefile, "Village file")
            
#             gdf = gpd.read_file(self.town_shapefile).to_crs(epsg=3857)
#             gdf = gdf[gdf['ID'].isin(clip)]
            
#             if gdf.empty:
#                 raise ValidationError(f"No village polygon found for clip IDs: {clip}")
            
#             return gdf
#         except Exception as e:
#             logger.error(f"Failed to filter villages: {e}")
#             raise
        
# class MapGenerator:
#     """Generates maps with improved error handling and resource management."""
    
#     def __init__(self, dpi: int = 100):
#         self.dpi = max(50, min(dpi, 600))  # Constrain DPI to reasonable range
    
#     def _set_axis_limits(self, ax, bounds):
#         """Set axis limits with margin."""
#         try:
#             xmin, ymin, xmax, ymax = bounds
#             margin_x = (xmax - xmin) * 0.05
#             margin_y = (ymax - ymin) * 0.05
#             ax.set_xlim(xmin - margin_x, xmax + margin_x)
#             ax.set_ylim(ymin - margin_y, ymax + margin_y)
#         except Exception as e:
#             logger.warning(f"Failed to set axis limits: {e}")

#     def _color_raster(self, ax, cmap, norm, raster_path: str):
#         """Color raster with error handling."""
#         try:
#             with rasterio.open(raster_path) as src:
#                 data = src.read(1, masked=True)
#                 bounds = src.bounds
                
#                 logger.debug(f"Raster CRS: {src.crs}, bounds: {bounds}, shape: {data.shape}")

#                 if np.ma.is_masked(data):
#                     valid_data = data[~data.mask]
#                 else:
#                     valid_data = data

#                 if valid_data.size == 0:
#                     raise ValueError("Raster contains no valid data")

#                 im = ax.imshow(
#                     data,
#                     cmap=cmap,
#                     norm=norm,
#                     extent=[bounds.left, bounds.right, bounds.bottom, bounds.top],
#                     origin='upper',
#                     interpolation='bilinear',
#                     aspect='equal',
#                     alpha=0.9
#                 )

#                 return bounds, im
#         except Exception as e:
#             logger.error(f"Failed to color raster {raster_path}: {e}")
#             raise ResourceError(f"Raster processing failed: {e}")

#     def _save_plot(self, fig,file_path:str) -> None:
#         file_path=file_path+".png"
#         try:
#             fig.savefig(
#                 file_path,
#                 format='png', 
#                 dpi=self.dpi,
#                 bbox_inches='tight', 
#                 pad_inches=0.1,
#                 facecolor='white',
#                 edgecolor='none'
#             )
#             return file_path
#         except Exception as e:
#             logger.error(f"Failed to save plot: {e}")
#             raise ResourceError(f"Plot saving failed: {e}")
    
#     def _parse_color_map_entries(self, sld_path: str):
#         """Parse SLD color map entries with error handling."""
#         try:
#             tree = etree.parse(sld_path)
#             entries = tree.findall(".//{http://www.opengis.net/sld}ColorMapEntry")

#             color_map = []
#             for entry in entries:
#                 try:
#                     quantity = float(entry.attrib.get("quantity"))
#                     color = entry.attrib.get("color")
#                     label = entry.attrib.get("label", "")
#                     color_map.append((quantity, color, label))
#                 except (ValueError, TypeError) as e:
#                     logger.warning(f"Skipping invalid color map entry: {e}")
#                     continue

#             if not color_map:
#                 raise ValueError("No valid color map entries found")

#             return sorted(color_map, key=lambda x: x[0])
#         except Exception as e:
#             logger.error(f"Failed to parse SLD file {sld_path}: {e}")
#             raise ResourceError(f"SLD parsing failed: {e}")

#     def _hex_to_rgb_tuple(self, hex_color: str):
#         """Convert hex color to RGB tuple with validation."""
#         try:
#             hex_color = hex_color.lstrip("#")
#             if len(hex_color) != 6:
#                 raise ValueError(f"Invalid hex color length: {hex_color}")
#             return tuple(int(hex_color[i:i+2], 16)/255.0 for i in (0, 2, 4))
#         except Exception as e:
#             logger.warning(f"Failed to convert hex color {hex_color}: {e}")
#             return (0.5, 0.5, 0.5)  # Default gray
    

#     def make_image(self, file_path: str, raster_path: str, sld_path: str, 
#                filtered_vector: list) -> Optional[BytesIO]:
    
#         try:
#             validate_file_exists(raster_path, "Raster file")
#             validate_file_exists(sld_path, "SLD file") 
#             filtered = SpatialDataset().find_village(clip=filtered_vector)
#             filtered_new = filtered.to_crs("EPSG:3857")
#             single_polygon = unary_union(filtered_new.geometry)
#             validate_geodataframe(filtered, "Filtered vector")

#             color_map = self._parse_color_map_entries(sld_path)
#             values, hex_colors, labels = zip(*color_map)
#             rgb_colors = [self._hex_to_rgb_tuple(c) for c in hex_colors]
#             cmap = ListedColormap(rgb_colors)
#             norm = BoundaryNorm(list(values) + [max(values) + 1], len(values))
            
#             # Create figure with context manager
#             with rasterio.open(raster_path) as src:
#                 raster_data = src.read(1)  # Read first band
#                 raster_crs = src.crs
#                 raster_bounds = src.bounds
#                 width, height = src.width, src.height
#                 raster_transform = src.transform
            

#             transform, new_width, new_height = calculate_default_transform(
#                 raster_crs, 'EPSG:3857', width, height, *raster_bounds
#             )
            
#             new_data = np.empty((new_height, new_width), dtype="float32")
#             reproject(
#                 source=raster_data,
#                 destination=new_data,
#                 src_transform=raster_transform,
#                 src_crs=raster_crs,
#                 dst_transform=transform,
#                 dst_crs='EPSG:3857',
#             )
            
#             geojson_polygon = [mapping(single_polygon)]
#             meta = {
#                 'driver': 'GTiff',
#                 'dtype': new_data.dtype,
#                 'nodata': -9999,  # Set nodata value (adjust if needed)
#                 'width': new_width,
#                 'height': new_height,
#                 'count': 1,  # Single-band raster
#                 'crs': 'EPSG:3857',
#                 'transform': transform
#             }
            
#             # Create in-memory raster for masking
#             with MemoryFile() as memfile:
#                 with memfile.open(**meta) as dataset:
#                     dataset.write(new_data, 1)  # Write reprojected data to band 1
#                     masked_data, masked_transform = mask(
#                         dataset=dataset,
#                         shapes=geojson_polygon,
#                         crop=True,
#                         nodata=-9999
#                     )
#             masked_array = np.where(masked_data[0] == -9999, np.nan, masked_data[0])
            
#             # Create visualization
#             with managed_figure(figsize=(25, 25), dpi=self.dpi) as (fig, ax):
#                 # Calculate bounds of reprojected raster
#                 raster_bounds_reproj = rasterio.transform.array_bounds(new_height, new_width, transform)
                
#                 # Set axis limits
#                 self._set_axis_limits(ax, raster_bounds_reproj)
                
#                 # Add basemap
#                 ctx.add_basemap(
#                     ax,
#                     crs='EPSG:3857',
#                     source=ctx.providers.Esri.WorldImagery,
#                     attribution="© Esri",
#                     alpha=0.7
#                 )
                
#                 # Overlay masked raster data
#                 ax.imshow(
#                     masked_array,
#                     extent=[
#                         masked_transform[2],
#                         masked_transform[2] + masked_array.shape[1] * masked_transform[0],
#                         masked_transform[5] + masked_array.shape[0] * masked_transform[4],
#                         masked_transform[5]
#                     ],
#                     cmap=cmap,
#                     norm=norm,
#                     alpha=0.7
#                 )

                
#                 # Overlay vector data
#                 vector_gs = filtered_new.geometry
#                 vector_gs.plot(
#                     ax=ax,
#                     facecolor='none',
#                     edgecolor='black',
#                     linewidth=2,
#                     alpha=0.95,
#                     linestyle='-'
#                 )
                
#                 # Set axis properties
#                 ax.set_xlabel("Longitude", fontsize=18)
#                 ax.set_ylabel("Latitude", fontsize=18)
#                 ax.tick_params(labelsize=14)    
#                 legend_elements = [
#                     Patch(facecolor=c, edgecolor='black', label=l.strip())
#                     for c, l in zip(rgb_colors, labels)
#                 ]
                
#                 ax.legend(
#                     handles=legend_elements,
#                     title="Legends",
#                     loc='upper center',
#                     bbox_to_anchor=(0.5, -0.12),

#                     fontsize=20,
#                     title_fontsize=34,

#                     framealpha=0.95,
                    
#                     # 🔽 HEIGHT (keep as-is)
#                     handleheight=3.5,
#                     labelspacing=0.8,
#                     borderpad=1.2,

#                     # 🔽 WIDTH CONTROLS (important)
#                     handlelength=1.8,     # ↓ smaller color box width
#                     columnspacing=1.0,    # ↓ space between columns / text
#                 )
                
#                 # Add scale bar for GIS data
#                 # EPSG:3857 is in meters, so we use 'm' as the unit
#                 scalebar = ScaleBar(
#                     dx=1,  # 1 pixel = 1 meter in EPSG:3857
#                     units='m',
#                     location='lower right',
#                     length_fraction=0.25,  # Scale bar will be 25% of the plot width
#                     width_fraction=0.01,  # Thickness of the scale bar
#                     box_alpha=0.7,  # Semi-transparent background
#                     color='black',
#                     box_color='white',
#                     font_properties={'size': 16, 'weight': 'bold'},
#                     scale_loc='top',  # Location of the scale text
#                     pad=0.5,
#                     border_pad=0.5,
#                     sep=5,
#                     frameon=True
#                 )
#                 ax.add_artist(scalebar)

#                 plt.tight_layout()
#                 return self._save_plot(fig, file_path=file_path[:-4])
                    
#         except Exception as e:
#             logger.error(f"Failed to generate image: {e}")
#             raise ResourceError(f"Image generation failed: {e}")
            
# class StpDocument:
#     """Main document class with improved error handling and resource management."""
    
#     def __init__(self,folder_path: str=None):
#         try:
#             settings = Settings()
#             self.raster_url = settings.GEOSERVER_EX_URL
#             self.sld_url = settings.GEOSERVER_EX_URL
#             self.document_path = settings.TEMP_DIR+"/documents"
#             self.folder_path = folder_path
#             os.makedirs(self.document_path, exist_ok=True)
#             if self.folder_path is not None:
#                 os.makedirs(folder_path, exist_ok=True)
#                 os.makedirs(folder_path+"/geoserver", exist_ok=True)
#                 os.makedirs(folder_path+"/image", exist_ok=True)
            
#         except Exception as e:
#             logger.error(f"Failed to initialize StpDocument: {e}")
#             raise STRPReportError(f"Initialization failed: {e}")
    
#     def _geoserver_load(self, layer_names: List) -> List:
#         """Load data from geoserver with error handling."""
#         response = []
#         for layer in layer_names:
#             try:
#                 if hasattr(layer, 'layer_name'):
#                     resp = Geoserver().celery_raster_download(
#                         temp_path=self.folder_path+"/geoserver", 
#                         layer_name=layer.layer_name
#                     )
#                     response.append(resp)
#                 else:
#                     logger.warning(f"Invalid layer object: {layer}")
#                     response.append(None)
#             except Exception as e:
#                 logger.error(f"Failed to download layer {getattr(layer, 'layer_name', 'unknown')}: {e}")
#                 response.append(None)
#         return response
   
#     def static_pdf(self, folder_path: list, csv_data: List,location_data:list,weight_data:list) -> str:
#         """Generate static PDF with error handling."""
#         try:
#             config = ReportConfig(
#                 title="Comprehensive Report on the STP suitability",
#                 author="IIT BHU",
#                 output_folder=str(self.document_path)
#             )
            
#             static_data = StaticTextData(
#                Distance_from_Builtup="Maintaining an optimal distance from built-up areas is vital for minimizing public health risks and odor nuisances from STPs, while ensuring feasible connection tosewage networks (Mansouri et al., 2013). Siting too close to residential zones can cause discomfort and opposition, but excessive distance may raise infrastructural costs. Map for the distance from built-up",
#                Distance_from_Waterbody="",
#                Elevation="Elevation governs the functionality of sewage flow and influences flooding potential at a site. Favorable elevation ensures gravity-based sewage conveyance and mitigates energy expenditure, while low or high elevation sites can complicate network design (Baquero-Rodríguez et al., 2022)",
#                Geomorphology="Geomorphological stability is key for foundation reliability, impacts groundwater movement, and affects construction costs. Flat and stable terrains are preferred for STP siting as they lower risk of erosion or land subsidence (Chaabane et al., 2024).",
#                Groundwater_Depth="Deeper groundwater tables lower contamination risks from STPs; shallow water tables require additional protection to prevent leachate migration (Ahmadi et al., 2017).",
#                Groundwater_Quality="Assessment of groundwater quality ensures that siting minimizes environmental risks and promotes remediation in degraded areas, aligning with regulatory requirements for aquifer protection (Jia et al., 2022).",
#                Land_Availability="",
#                Land_Use_Land_Cover="Land use/land cover (LULC) considerations help minimize environmental impact and avoid areas of valuable agricultural, ecological, or recreational use, favoring vacant or industrial lands suitable for STPs (Deepa et al., 2012).",
#                Population_Density="Population density guides site placement by highlighting areas with greater sewage volumes, ensuring efficient resource use, and facilitating public health benefits where the need is highest (Lehner et al., 2022).",
#                Slope="Slope influences drainage and construction stability; gentle slopes are optimal for gravity-based sewage flow, while steep slopes entail erosion risk and higher construction costs (Mansouri et al., 2013).",
#                Soil_Texture="Soil texture affects the infiltration rate, retention of effluent, and risk of groundwater contamination. Well-balanced soils (loam) support safe operation, while sandy soils heighten risk of contaminant migration, and clay impedes drainage (US EPA, 1987).",
#                ASI_Sites_constraint="Locations protected by ASI must be excluded to safeguard cultural heritage and comply with legal requirements, as construction activities can damage irreplaceable monuments and violate national preservation laws (Mansouri et al., 2013).",
#                Builtup_constraint="Highly built-up zones must be masked due to land scarcity, community opposition, and incompatibility with local land use and public health protection. STP construction in developed urban areas is generally not feasible (Mansouri et al., 2013).",
#                Flood_Plain_constraint="Active flood plains are highly unsuitable for STP siting due to elevated risk of inundation, which can cause catastrophic equipment failure and contamination of surface waters. Regulatory and engineering standards require excluding these zones (Mansouri et al., 2013).",
#                Groundwater_Depth_constraint="Sites with shallow groundwater tables are masked as unsuitable due to high risk of aquifer contamination by seepage, aligning with requirements for vadose zone thickness and sustainable hydrogeology (Ahmadi et al., 2017). In Varuna River Basin, depth < 2m is considered as the constraint zone to prevent the development of any treatment infrastructure",
#                Highway_constraint="Highways require exclusion zones to prevent interference with traffic flow, infrastructure risks, and exposure of travelers to possible odor and accidental releases. Buffering highways ensures the plant's activities do not diminish road safety and environmental quality (Awawdeh, 2024). 60 m, as Right of Way (RoW) on either side of the highway is used to protect any development.",
#                Railway_constraint="Safety and infrastructure constraints necessitate avoiding railway corridors, as STP construction near railways can disrupt operations, pose accident risks, and violate regulatory setbacks for pollution control and vibration impact (Awawdeh, 2024). Therefore 100 m of distance on either of the side of the railway should not be considered as the suitable zone for the development.",
#                STP_constraint="The presence of existing STPs serves as a constraint for new plant siting to prevent redundancy, operational conflicts, and potential cumulative environmental impacts. This is standard to avoid overburdening infrastructure in a locale and promote spatialcoverage (Awawdeh, 2024).",
#                Water_Body_constraint="Proximity to rivers, lakes, or ponds is a constraint, since STPs can be a source of accidental pollution and must avoid flood-prone areas. Siting too close violates environmental regulations aimed at protecting aquatic ecosystems and human health due to waterborne exposure risks (Mansouri et al., 2013)"
#             )
            
#             table_data = TableData(village_raw_data=csv_data,weights_table=weight_data)
#             generator = ReportGenerator(config, static_data, table_data)
#             return generator.generate_report(layer_names=folder_path,location_data=location_data)
            
#         except Exception as e:
#             logger.error(f"Failed to generate static PDF: {e}")
#             raise STRPReportError(f"PDF generation failed: {e}")

#     def _raster_loader(self, folder_path: str, layer_names: List) -> List:
#         """Load raster data with error handling."""
#         try:
#             return self._geoserver_load(folder_path, layer_names)
#         except Exception as e:
#             logger.error(f"Failed to load raster data: {e}")
#             return []

#     def report_generator(self, layer_names: List, csv_data: List,location_data:list,weight_data:list) -> str:
#         """Generate complete report with automatic cleanup."""
#         try:
#             if not layer_names:
#                 raise ValidationError("Layer names list cannot be empty")
            
#             try:
#                 pdf_path = self.static_pdf(folder_path=layer_names, csv_data=csv_data,location_data=location_data,weight_data=weight_data)
#                 logger.info(f"Report generated successfully: {pdf_path}")
#                 return pdf_path
#             except Exception as e:
#                 pass
#         except Exception as e:
#             logger.error(f"Report generation failed: {e}")
#             raise STRPReportError(f"Report generation failed: {e}")

# class ReportGenerator:
#     """
#     Clean, professional PDF generator.
#     API is identical to the original – only presentation is changed.
#     """

#     def __init__(self, config, static_data, table_data, dpi: int = 50):
#         from app.conf.settings import Settings
#         self.config          = config
#         self.static_data     = static_data
#         self.table_data      = table_data
#         self.sm              = StyleManager()
#         self.elements        = []
#         self.dpi             = max(50, min(dpi, 600))
#         s                    = Settings()
#         self.iit_logo        = f"{s.BASE_DIR}/media/images/iitbhu.png"
#         self.slcr_logo       = f"{s.BASE_DIR}/media/images/slcr.png"
#         self.methodology_fig = f"{s.BASE_DIR}/media/images/Flowchart_STP.png"

#     # ── internal helpers ─────────────────────────────────────────

#     def _h1(self, text: str):
#         self.elements.append(Spacer(1, 4))
#         self.elements.append(Paragraph(text, self.sm.styles['H1']))
#         self.elements.append(section_rule())

#     def _h2(self, text: str):
#         self.elements.append(Paragraph(text, self.sm.styles['H2']))
#         self.elements.append(light_rule())

#     def _h3(self, text: str):
#         self.elements.append(Paragraph(text, self.sm.styles['H3']))

#     def _body(self, text: str):
#         self.elements.append(Paragraph(text, self.sm.styles['Body']))

#     def _spacer(self, pts: float = 10):
#         self.elements.append(Spacer(1, pts))

#     def _page_break(self):
#         self.elements.append(PageBreak())

#     def _caption(self, text: str):
#         self.elements.append(Paragraph(text, self.sm.styles['Caption']))

#     # ── cover ────────────────────────────────────────────────────

#     def _add_title_page(self):
#         try:
#             build_cover(self.elements, self.config, self.sm)
#         except Exception as e:
#             logger.error(f"Cover page error: {e}")

#     # ── 1. executive summary ─────────────────────────────────────

#     def _add_executive_summary(self):
#         try:
#             self._h1("1. Executive Summary")
#             self._body(
#                 "This report presents a robust GIS-based multi-criteria module for identifying "
#                 "optimal sites for Sewage Treatment Plants (STPs) according to diverse treatment "
#                 "technologies. By harnessing several important conditioning and constraint raster "
#                 "datasets, the module evaluates environmental, infrastructural, and technological "
#                 "factors to delineate locations that will enable efficient and sustainable STP "
#                 "deployment. The outputs serve policy makers and urban planners by ensuring "
#                 "strategic alignment with Sustainable Development Goal (SDG) 6: "
#                 "<i>Ensure availability and sustainable management of water and sanitation for "
#                 "all.</i> Specifically, the module supports SDG target 6.3 by facilitating water "
#                 "quality improvements, reducing pollution, minimising hazardous releases, and "
#                 "increasing the proportion of safely treated and reused wastewater. This work also "
#                 "contributes to SDG 3 (Good Health), SDG 11 (Sustainable Cities), and SDG 12 "
#                 "(Responsible Consumption) through better resource management and support for "
#                 "circular-economy principles."
#             )
#             self._spacer(12)
#         except Exception as e:
#             logger.error(f"Executive summary error: {e}")

#     # ── 2. study area ────────────────────────────────────────────

#     def _add_study_area_overview(self, location_data):
#         try:
#             self._h1("2. Study Area Overview")
#             self._body(
#                 "The study area encompasses selected towns and cities characterised by varied "
#                 "physiographic and hydrological conditions."
#             )
#             self._spacer(6)

#             # Location detail card (light-background table)
#             T = Theme
#             card_data = [
#                 [Paragraph("<b>Attribute</b>", self.sm.styles['TblHeader']),
#                  Paragraph("<b>Detail</b>",    self.sm.styles['TblHeader'])],
#                 [Paragraph("State",            self.sm.styles['TblCell']),
#                  Paragraph(str(location_data[0][1]), self.sm.styles['TblCell'])],
#                 [Paragraph("District(s)",      self.sm.styles['TblCell']),
#                  Paragraph(', '.join(location_data[1][1]), self.sm.styles['TblCell'])],
#                 [Paragraph("Sub-District(s)",  self.sm.styles['TblCell']),
#                  Paragraph(', '.join(location_data[2][1]), self.sm.styles['TblCell'])],
#                 [Paragraph("Towns",            self.sm.styles['TblCell']),
#                  Paragraph(', '.join(location_data[3][1]), self.sm.styles['TblCell'])],
#                 [Paragraph("Total Population", self.sm.styles['TblCell']),
#                  Paragraph(str(location_data[4][1]), self.sm.styles['TblCell'])],
#             ]

#             page_w = A4[0] - Theme.MARGIN_LEFT - Theme.MARGIN_RIGHT
#             card = Table(card_data, colWidths=[page_w * 0.32, page_w * 0.68], hAlign='LEFT')
#             card.setStyle(TableStyle([
#                 ('BACKGROUND',    (0, 0), (-1, 0),  T.TBL_HEADER),
#                 ('TEXTCOLOR',     (0, 0), (-1, 0),  T.WHITE),
#                 ('BACKGROUND',    (0, 1), (-1, -1), T.BG_LIGHT),
#                 ('ROWBACKGROUNDS',(0, 1), (-1, -1), [T.TBL_ROW_A, T.TBL_ROW_B]),
#                 ('GRID',          (0, 0), (-1, -1), 0.4, T.TBL_BORDER),
#                 ('LINEBELOW',     (0, 0), (-1,  0), 1.2, T.SECONDARY),
#                 ('TOPPADDING',    (0, 0), (-1, -1), 7),
#                 ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
#                 ('LEFTPADDING',   (0, 0), (-1, -1), 10),
#                 ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
#             ]))
#             self.elements.append(card)
#             self._page_break()
#         except Exception as e:
#             logger.error(f"Study area error: {e}")

#     # ── 3. methodology ───────────────────────────────────────────

#     def _add_methodology_section(self, layer_names: List[str]):
#         try:
#             self._h1("3. Database and Methodology")

#             # 3.1 Database
#             self._h2("3.1 Database")
#             self._body(
#                 "A range of spatial and non-spatial datasets were integrated for the STP "
#                 "prioritisation analysis. All factors are categorised into two groups: "
#                 "<b>conditioning factors</b> and <b>constraint factors</b>."
#             )

#             # 3.1.1 Conditioning
#             self._h3("3.1.1 Conditioning Factors")
#             self._body(
#                 "Conditioning factors describe the relative suitability of a location for "
#                 "treatment plant placement. Several factors were considered to delineate "
#                 "favourable zones."
#             )

#             factors = [
#                 ("Distance_from_Builtup",   self.static_data.Distance_from_Builtup),
#                 ("Distance_from_Waterbody", self.static_data.Distance_from_Waterbody),
#                 ("Elevation",               self.static_data.Elevation),
#                 ("Geomorphology",           self.static_data.Geomorphology),
#                 ("Groundwater_Depth",       self.static_data.Groundwater_Depth),
#                 ("Groundwater_Quality",     self.static_data.Groundwater_Quality),
#                 ("Land_Availability",       self.static_data.Land_Availability),
#                 ("Land_Use_Land_Cover",     self.static_data.Land_Use_Land_Cover),
#                 ("Population_Density",      self.static_data.Population_Density),
#                 ("Slope",                   self.static_data.Slope),
#                 ("Soil_Texture",            self.static_data.Soil_Texture),
#             ]
#             self._render_factor_blocks(factors, layer_names, start_alpha=0)

#             # 3.1.2 Constraint
#             self._h3("3.1.2 Constraint Factors")
#             self._body(
#                 "Constraint factors identify locations where STP construction is not feasible "
#                 "in binary terms, masking unsuitable areas from further analysis."
#             )
#             constraints = [
#                 ("ASI_Sites_constraint",        self.static_data.ASI_Sites_constraint),
#                 ("Builtup_constraint",           self.static_data.Builtup_constraint),
#                 ("Flood_Plain_constraint",       self.static_data.Flood_Plain_constraint),
#                 ("Groundwater_Depth_constraint", self.static_data.Groundwater_Depth_constraint),
#                 ("Highway_constraint",           self.static_data.Highway_constraint),
#                 ("Railway_constraint",           self.static_data.Railway_constraint),
#                 ("STP_constraint",               self.static_data.STP_constraint),
#                 ("Water_Body_constraint",        self.static_data.Water_Body_constraint),
#             ]
#             self._render_factor_blocks(constraints, layer_names, start_alpha=0)

#             # 3.2 Methodology
#             self._h2("3.2 Methodology")
#             self._body(
#                 "The methodology details the systematic approach for processing, analysing, "
#                 "and integrating multiple spatial datasets to assess STP site suitability "
#                 "using GIS and remote-sensing techniques. The workflow incorporates data "
#                 "preparation, transformation, multi-criteria decision analysis (MCDA), and "
#                 "final suitability mapping. The working flowchart is shown below."
#             )

#             if os.path.exists(self.methodology_fig):
#                 self.elements.append(Image(self.methodology_fig,
#                                            width=5.5 * inch, height=3.5 * inch,
#                                            hAlign='CENTER'))
#                 self._caption("Figure: STP Site Suitability Methodology Flowchart")
#             self._spacer(8)

#             # Sub-sections 3.2.1 – 3.2.4
#             subsections = [
#                 ("3.2.1 Pre-processing",
#                  "All spatial datasets are projected to a common CRS (WGS 1984 UTM Zone 44N, "
#                  "EPSG:32644) at 30 m spatial resolution. Resampling (nearest-neighbour), "
#                  "radiometric corrections, DEM smoothing, and missing-data gap-filling are "
#                  "applied as necessary."),
#                 ("3.2.2 Reclassification",
#                  "Continuous and categorical datasets are transformed into standardised suitability "
#                  "classes based on defined thresholds (e.g., <i>Highly Suitable</i>, "
#                  "<i>Moderately Suitable</i>, <i>Unsuitable</i>). This harmonises heterogeneous "
#                  "data scales for multi-criteria integration (Malczewski, 2006)."),
#                 ("3.2.3 Normalisation",
#                  "Reclassified parameters are scaled to [0, 1] using fuzzy membership functions, "
#                  "which capture uncertainty and gradual transitions between suitability classes."),
#             ]
#             for title, text in subsections:
#                 self._h3(title)
#                 self._body(text)

#             # 3.2.4 MCDA
#             self._h3("3.2.4 Multi-Criteria Decision Analysis (MCDA)")
#             self._body(
#                 "MCDA provides a structured approach for evaluating STP suitability based on "
#                 "multiple, often conflicting, criteria. It quantifies each parameter's influence "
#                 "and integrates them into a unified assessment framework."
#             )

#             mcda_parts = [
#                 ("3.2.4.1 Parameter Influence",
#                  "The relative impact of each criterion is quantified using the Analytic Hierarchy "
#                  "Process (AHP) or expert elicitation to determine importance weights."),
#                 ("3.2.4.2 Pairwise Comparison Matrix (PCM)",
#                  "Decision-makers assign comparative scores to criterion pairs. The matrix is "
#                  "analysed for the Consistency Index (CI) and Consistency Ratio (CR); if CR "
#                  "exceeds 0.10, comparisons are revised (Saaty, 1980)."),
#             ]
#             for title, text in mcda_parts:
#                 self._h3(title)
#                 self._body(text)

#             # 3.2.4.3 Consistency Index
#             self._h3("3.2.4.3 Consistency Index and Criteria Weight")
#             self._body(
#                 "The Consistency Index is defined as "
#                 "<b>CI = (\u03bb<sub>max</sub> \u2013 n) / (n \u2013 1)</b>, where "
#                 "\u03bb<sub>max</sub> is the principal eigenvalue and n is the number of criteria. "
#                 "The Consistency Ratio <b>CR = CI / RI</b> (where RI is the Random Consistency "
#                 "Index from Saaty, 1980) must be &lt; 0.10. In this module the weights were "
#                 "determined at CR = 0.073."
#             )

#             # 3.2.4.4 SAW
#             self._h3("3.2.4.4 Simple Additive Weighting (SAW) Method")
#             self._body(
#                 "The SAW suitability score is computed as "
#                 "<b>S<sub>j</sub> = \u03a3 \u03c9<sub>i</sub> \u00b7 S<sub>ij</sub></b>, "
#                 "where \u03c9<sub>i</sub> is the weight of criterion <i>i</i> and "
#                 "S<sub>ij</sub> is the normalised score of criterion <i>i</i> for "
#                 "alternative <i>j</i>."
#             )

#             self._page_break()

#         except Exception as e:
#             logger.error(f"Methodology section error: {e}")

#     def _render_factor_blocks(self, factors, layer_names, start_alpha=0):
#         """Render each factor as a labelled block: heading → text → figure."""
#         alpha_idx = start_alpha
#         for key, text in factors:
#             match = next((d for d in layer_names if d.get("file_name") == key), None)
#             if not match:
#                 continue

#             label = f"({string.ascii_lowercase[alpha_idx]}) {key.replace('_', ' ')}"
#             alpha_idx += 1

#             block = []
#             block.append(Paragraph(label, self.sm.styles['H3']))
#             if text and text.strip():
#                 block.append(Paragraph(text, self.sm.styles['Body']))

#             figure_path = match.get("file_path")
#             if figure_path and os.path.exists(figure_path):
#                 try:
#                     with open(figure_path, 'rb') as f:
#                         img_stream = io.BytesIO(f.read())
#                     imgs = ImageManager.insert_actual_image(img_stream)
#                     if imgs:
#                         block.extend(imgs)
#                 except Exception as e:
#                     logger.warning(f"Could not load figure {figure_path}: {e}")

#             block.append(Paragraph(
#                 f"<i>Figure: {key.replace('_', ' ')}</i>",
#                 self.sm.styles['Caption']
#             ))
#             block.append(PageBreak())
#             self.elements.extend(block)

#     # ── 4. results ───────────────────────────────────────────────

#     def _add_results_section(self, layer_names: List):
#         try:
#             self._h1("4. Results")

#             # 4.1 Suitability map
#             self._h2("4.1 STP Suitability Map")
#             self._body(
#                 "The final STP Suitability map provides a spatial visualisation of zones "
#                 "categorised as <i>Low</i>, <i>Medium</i>, <i>High</i>, and <i>Very High</i> "
#                 "suitability, based on integrated GIS analysis of multiple conditioning and "
#                 "constraint factors. The map distinguishes areas prioritised for construction, "
#                 "balancing environmental safeguards, infrastructure accessibility, and "
#                 "regulatory compliance (Mansouri et al., 2013)."
#             )

#             match = next(
#                 (d for d in layer_names if d.get("file_name") == "STP_suitability"), None
#             )
#             if match:
#                 fp = match.get("file_path")
#                 if fp and os.path.exists(fp):
#                     try:
#                         with open(fp, 'rb') as f:
#                             img_stream = io.BytesIO(f.read())
#                         imgs = ImageManager.insert_actual_image(img_stream)
#                         if imgs:
#                             self.elements.extend(imgs)
#                         self._caption("Figure: STP Site Suitability Map")
#                     except Exception as e:
#                         logger.warning(f"Suitability map load failed: {e}")
#             self._spacer(12)

#             # 4.2 Weights
#             self._h2("4.2 Assigned Weights")
#             self._body(
#                 "The selected weights reflect the relative importance of each criterion, "
#                 "ensuring that environmental, infrastructural, and regulatory priorities are "
#                 "appropriately balanced."
#             )
#             self.elements.append(Paragraph("Table 1: Conditioning Factor Weights",
#                                             self.sm.styles['TableLabel']))
#             wt = TableGenerator.create_styled_table(self.table_data.weights_table)
#             if wt:
#                 self.elements.append(wt)
#             self._spacer(16)

#             # 4.3 Village-wise
#             self._h2("4.3 Village-wise STP Suitability Analysis")
#             self.elements.append(Paragraph(
#                 "Table 2: Village-wise STP Suitability Distribution (%)",
#                 self.sm.styles['TableLabel']
#             ))
#             vt = TableGenerator.create_styled_table(self.table_data.village_suitability_table)
#             if vt:
#                 self.elements.append(vt)
#             self._page_break()

#         except Exception as e:
#             logger.error(f"Results section error: {e}")

#     # ── 5. references ────────────────────────────────────────────

#     def _add_references(self):
#         try:
#             self._h1("5. References")
#             refs = [
#                 "Ahmadi, M. M., Mahdavirad, H., & Bakhtiari, B. (2017). Multi-criteria analysis of site selection for groundwater recharge with treated municipal wastewater. <i>Water Science and Technology, 76</i>(4), 909–922.",
#                 "Awawdeh, M. (2024). Wastewater treatment plant site selection using GIS and MCDA. <i>Agricultural Journal of Science and Research, 42</i>(4), 1504–1517.",
#                 "Baquero-Rodríguez, G. A., et al. (2022). How elevation dictates technology selection in biological wastewater treatment systems. <i>Journal of Environmental Management, 319</i>, 115699.",
#                 "Chaabane, S., Moslah, B., & Abdelhadi, M. (2024). Multi-criteria site selection for wastewater treatment plant in Bent Saidane. <i>Journal of Environmental Engineering and Science, 19</i>(4), 262–272.",
#                 "Deepa, K., Elango, L., & Hemalatha, K. (2012). Suitable site selection of decentralized treatment plants using GIS techniques. <i>Journal of Water Resource and Protection, 4</i>(6), 507–514.",
#                 "Jia, R., et al. (2022). Site prioritization and performance assessment of groundwater monitoring near wastewater treatment plants. <i>Environmental Research, 212</i>, 113418.",
#                 "Lehner, B., et al. (2022). Distribution and characteristics of wastewater treatment plants within HydroSHEDS. <i>Earth System Science Data, 14</i>, 559–573.",
#                 "Malczewski, J. (1999). <i>GIS and Multicriteria Decision Analysis.</i> John Wiley &amp; Sons.",
#                 "Mansouri, Z., Hafezi Moghaddas, N., & Dahrazma, B. (2013). Wastewater treatment plant site selection using AHP and GIS. <i>Geopersia, 3</i>(1), 61–71.",
#                 "US EPA (1987). <i>Guide to Soil Suitability and Site Selection for Beneficial Use of Sewage Sludge.</i> EPA/530-SW-87-001.",
#             ]
#             for i, ref in enumerate(refs, 1):
#                 self.elements.append(
#                     Paragraph(f"{i}.&nbsp;&nbsp;{ref}", self.sm.styles['RefItem'])
#                 )
#         except Exception as e:
#             logger.error(f"References error: {e}")

#     # ── main entry point ─────────────────────────────────────────

#     def generate_report(self, layer_names: List, location_data: list) -> str:
#         try:
#             T = Theme
#             output_path = self.config.get_full_output_path()

#             doc = SimpleDocTemplate(
#                 output_path,
#                 pagesize=T.PAGE,
#                 topMargin=T.MARGIN_TOP,
#                 bottomMargin=T.MARGIN_BOTTOM,
#                 leftMargin=T.MARGIN_LEFT,
#                 rightMargin=T.MARGIN_RIGHT,
#             )
#             doc.title   = self.config.title
#             doc.author  = self.config.author
#             doc.subject = self.config.subject

#             # Build content
#             self._add_title_page()
#             self._add_executive_summary()
#             self._add_study_area_overview(location_data)
#             self._add_methodology_section(layer_names)
#             self._add_results_section(layer_names)
#             self._add_references()

#             # Canvas callbacks
#             iit, slcr = self.iit_logo, self.slcr_logo

#             def first_page(canvas, doc):
#                 _cover_background(canvas, doc, iit, slcr)

#             def later_pages(canvas, doc):
#                 _draw_page_chrome(canvas, doc, iit, slcr, is_cover=False)

#             doc.build(self.elements,
#                       onFirstPage=first_page,
#                       onLaterPages=later_pages)

#             logger.info(f"Report generated: {output_path}")
#             return output_path

#         except Exception as e:
#             logger.error(f"Report generation failed: {e}")
#             raise
# @app.task(bind=True,pydantic=True,name="stp_suitability_admin_generation_start")
# def document_gen2(self,payload: StpsuitabilityAdminReport):
#     progress_recorder = ProgressRecorder(self)
#     total = 100
#     try:
#         progress_recorder.set_progress(1, total, description="Starting task")
#         unique_folder_path = f"{Settings().TEMP_DIR}/{str(uuid.uuid4())}"
#         table_data = [item.model_dump() for item in payload.table]
#         location_data =[item for item in payload.location]
#         weight_data= [["Factor", "Weight"]] + [[d.file_name, str(d.weight)] for d in payload.weight_data]
        
#         progress_recorder.set_progress(5, total, description="Data loaded")
        
#         file_paths=StpDocument(unique_folder_path)._geoserver_load(layer_names=payload.raster)
#         progress_recorder.set_progress(15, total, description="Raster data downloaded")
#         tasks = []
#         total_images = len(file_paths)
#         for idx, item in enumerate(file_paths):
#             file_name = os.path.basename(item["raster_path"])
#             file_path = os.path.join(unique_folder_path, "image", file_name.replace(" ","_"))  
#             tasks.append(
#             celery_currency_image.s(
#             file_path=file_path,
#             raster_path=item["raster_path"],
#             sld_path=item["sld_path"],
#             clip=payload.clip,
#             task_index=idx,
#             total_tasks=total_images,
#             parent_task_id=self.request.id) 
#         )
#         progress_recorder.set_progress(20, total, description="Launching parallel image processing")
#         job = chord(group(tasks))(
#             final_step.s(table_data=table_data,location_data=location_data,
#                         weight_data=weight_data,parent_task_id=self.request.id))
#         redis_manager.setex(
#             f"chord:{self.request.id}",
#             3600,  
#             job.id
#         )
#         while not job.ready():
#             completed_count = 0
#             for i in range(total_images):
#                 if redis_manager.get(f"image_complete:{self.request.id}:{i}"):
#                     completed_count += 1
            
#             progress_pct = 20 + int((completed_count / total_images) * 60)
#             progress_recorder.set_progress(
#                 progress_pct,
#                 total,
#                 description=f"Processing images: {completed_count}/{total_images} complete"
#             )

#             time.sleep(1)
               
#         progress_recorder.set_progress(100, total, description="Complete")
#         for i in range(total_images):
#             redis_manager.delete(f"image_complete:{self.request.id}:{i}")
#         redis_manager.delete(f"chord:{self.request.id}")
#         return {"chord_id": job.id}
        
#     except Exception as e:
#         logger.error(f"Task failed: {e}")
#         progress_recorder.set_progress(total, total, description=f"Error: {str(e)}")
#         raise STRPReportError(f"PDF generation failed: {e}")


# @app.task(bind=True,pydantic=True,name="stp_suitability_admin_currency_image")
# def celery_currency_image(self,file_path:str,raster_path:str,sld_path:str,clip:List[str], task_index: int, total_tasks: int, parent_task_id: str) -> dict:
#     try:
#         file_path=MapGenerator(dpi=100).make_image(file_path=file_path,raster_path=raster_path,sld_path=sld_path,filtered_vector=clip)
#         redis_manager.setex(
#             f"image_complete:{parent_task_id}:{task_index}",
#             3600,
#             "1"
#         )
        
#         return {
#             "file_path": file_path,
#             "file_name": os.path.splitext(os.path.basename(file_path))[0]
#         }
#     except Exception as e:
#         logger.error(f"Image processing failed for task {task_index}: {e}")
#         raise

# @app.task(bind=True,pydantic=True,name="stp_suitability_admin_generation_starts")
# def final_step(self,results: List[dict],table_data:list,location_data:list,weight_data:list, parent_task_id: str) -> str:
#     try:
        
#         redis_manager.setex(
#             f"pdf_generation:{parent_task_id}",
#             3600,
#             "started"
#         )
        
#         pdf_path=StpDocument().report_generator(layer_names=results, csv_data=table_data,location_data=location_data,weight_data=weight_data)
#         redis_manager.delete(f"pdf_generation:{parent_task_id}")
#         return pdf_path
#     except Exception as e:
#         logger.error(f"PDF generation failed: {e}")
#         raise