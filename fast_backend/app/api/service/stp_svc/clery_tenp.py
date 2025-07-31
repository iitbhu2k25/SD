from app.conf.settings import Settings
from app.api.service.geoserver import Geoserver
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from io import BytesIO
from pyproj import Transformer
import geopandas as gpd
import matplotlib.pyplot as plt
import contextily as ctx
import os
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
import uuid
from app.conf.settings import Settings
from rasterio.plot import reshape_as_image
from matplotlib.colors import ListedColormap
import numpy as np
import rasterio
from matplotlib.colors import ListedColormap
from matplotlib import cm as matplotlib_cm
from reportlab.platypus import Image
from reportlab.lib.units import cm
from lxml import etree
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
import rasterio
import geopandas as gpd
from io import BytesIO
from matplotlib.patches import Patch
from PIL import Image as PILImage
PILImage.MAX_IMAGE_PIXELS = None
from app.conf.celery import app
import io, os, base64
import geopandas as gpd
from celery import group,chord
    
# making the celery task



@app.task(bind=True)
def generate_celery_image(self,*,dpi:int,name:str,folder_path:str,gdf_json: str)-> str:
    name=name[4:]
    name=name.replace(" ","_")
    raster_path = os.path.join(folder_path, f"{name}.tif")
    sld_path = os.path.join(folder_path, f"{name}.sld")
    if os.path.exists(raster_path) and os.path.exists(sld_path):
        gdf = gpd.read_file(io.StringIO(gdf_json))
        image_bytes= MapGenerator(dpi=400).make_image(name,raster_path,sld_path,filtered_vector=gdf)
        return base64.b64encode(image_bytes.getvalue()).decode("utf-8")
    return None


@app.task(bind=True)
def process_images_and_continue(self,base64_images, metadata):
    folder_path = metadata["folder_path"]
    factors_data = metadata["factors_data"]
    styles = metadata["styles"]

    elements = []

    for (factor_title, static_text, figure_title), base64_img in zip(factors_data, base64_images):
        elements.append(Paragraph(factor_title, styles['SubsectionHeader']))
        elements.append(Paragraph(figure_title, styles['FigureCaption']))

        if base64_img is None:
            print(f"[Image error for: {factor_title}]")
            continue

        image_bytes = io.BytesIO(base64.b64decode(base64_img))
        elements.extend(ImageManager.insert_actual_image(image_bytes))
        elements.append(Spacer(1, 15))
        elements.append(PageBreak())

    return elements

@dataclass
class ReportConfig:
    title: str = "Comprehensive Report on the STP Priority"
    author: str = "IIT BHU"
    subject: str = "STP Priority Analysis"
    output_filename: str = f"STP_Priority_Report{uuid.uuid4()}.pdf"
    page_size: Tuple = A4
    margins: Dict[str, float] = None
    output_folder: str = Settings().BASE_DIR
    
    def __post_init__(self):
        if self.margins is None:
            self.margins = {
                'top': 2.5*cm,
                'bottom': 2.5*cm,
                'left': 2.5*cm,
                'right': 2.5*cm
            }
    def get_full_output_path(self) -> str:
        return os.path.join(self.output_folder, self.output_filename)

@dataclass
class StaticTextData:
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
    weights_table: List[List[str]] = None
    village_priority_table: List[List[str]] = None
    village_raw_data: List[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.weights_table is None:
            self.weights_table = [
                ["Factor", "Weight", ],
                ["Downstream Effect of Drain", "0.20"],
                ["Drainage Distance", "0.15"],
                ["Groundwater Depth", "0.12"],
                ["LULC", "0.18" ],
                ["Major City Risk", "0.10" ],
                ["Population", "0.15" ],
                ["Proximity to River Quality", "0.10" ]
            ]
            
        if self.village_raw_data and not self.village_priority_table:
            self.village_priority_table = self._convert_raw_data_to_table()
        elif self.village_priority_table is None:
            self.village_priority_table = [
                ["Village Name", "Very Low (%)", "Low (%)", "Medium (%)", "High (%)", "Very High (%)"]
            ]
            
    def _convert_raw_data_to_table(self) -> List[List[str]]:
        """Convert raw dictionary data to table format."""
        if not self.village_raw_data:
            return []
        
        # Create header row
        headers = ["Village Name", "Very Low (%)", "Low (%)", "Medium (%)", "High (%)", "Very High (%)"]
        table_data = [headers]
        
        # Process each village data
        for village_data in sorted(self.village_raw_data, key=lambda x: x.Very_High, reverse=True):

            row = []
            
            village_data=village_data.dict()
            village_name = village_data.get('Village_Name', 'Unknown')
            row.append(village_name)
            
            # Priority percentages
            very_low = f"{village_data.get('Very_Low', 0):.2f}"
            low = f"{village_data.get('Low', 0):.2f}"
            medium = f"{village_data.get('Medium', 0):.2f}"
            high = f"{village_data.get('High', 0):.2f}"
            very_high = f"{village_data.get('Very_High', 0):.2f}"
            
            row.extend([very_low, low, medium, high,very_high])
            table_data.append(row)
        
        return table_data
    
    
class StyleManager:
   
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._create_custom_styles()
    
    def _create_custom_styles(self):
       
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Title'],
            fontSize=24,
            spaceAfter=30,
            alignment=TA_CENTER,
            textColor=colors.darkblue,
            fontName='Helvetica-Bold'
        ))
        
        # Section header style
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading1'],
            fontSize=16,
            spaceAfter=12,
            spaceBefore=20,
            textColor=colors.darkblue,
            fontName='Helvetica-Bold',
            borderWidth=1,
            borderColor=colors.darkblue,
            borderPadding=5
        ))
        
        # Subsection header style
        self.styles.add(ParagraphStyle(
            name='SubsectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceAfter=8,
            spaceBefore=15,
            textColor=colors.darkgreen,
            fontName='Helvetica-Bold'
        ))
        
        # Body text with justification
        self.styles.add(ParagraphStyle(
            name='JustifiedBody',
            parent=self.styles['Normal'],
            fontSize=11,
            spaceAfter=12,
            alignment=TA_JUSTIFY,
            leftIndent=0,
            rightIndent=0
        ))
        
        # Figure caption style
        self.styles.add(ParagraphStyle(
            name='FigureCaption',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=12,
            spaceBefore=6,
            alignment=TA_CENTER,
            fontName='Helvetica-Oblique',
            textColor=colors.grey
        ))
        
        # Table header style
        self.styles.add(ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontSize=10,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold',
            textColor=colors.white
        ))


class TableGenerator:
    """Handles table creation and styling."""
    
    @staticmethod
    def create_styled_table(data: List[List[str]]) -> Table:
        """Create a styled table with headers."""
        if not data:
            return None
        
        table = Table(data, hAlign='LEFT')
        
        # Define table style
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

class MapGenerator:
    def __init__(self,dpi=100):
        self.dpi=dpi
    
    
    def _set_axis_limits(self, ax, bounds):
        xmin, ymin, xmax, ymax = bounds
        margin_x = (xmax - xmin) * 0.05
        margin_y = (ymax - ymin) * 0.05
        ax.set_xlim(xmin - margin_x, xmax + margin_x)
        ax.set_ylim(ymin - margin_y, ymax + margin_y)

    def color_raster(self, ax, cmap, norm, raster_path: str):
        with rasterio.open(raster_path) as src:
            data = src.read(1, masked=True)
            bounds = src.bounds
            
            # Print raster info for debugging
            print(f"Raster CRS: {src.crs}")
            print(f"Raster bounds: {bounds}")
            print(f"Raster shape: {data.shape}")

            if np.ma.is_masked(data):
                valid_data = data[~data.mask]
            else:
                valid_data = data

            if valid_data.size == 0:
                raise ValueError("Raster contains no valid data")

            # IMPROVED RASTER DISPLAY
            im = ax.imshow(
                data,
                cmap=cmap,
                norm=norm,
                extent=[bounds.left, bounds.right, bounds.bottom, bounds.top],
                origin='upper',
                interpolation='bilinear',  # Better interpolation
                aspect='equal',            # Maintain aspect ratio
                alpha=0.9                  # Slight transparency to see vector overlay
            )

            return bounds, im   
    def _save_plot(self, fig) -> BytesIO:
        buf = BytesIO()
        fig.savefig(
            buf, 
            format='png', 
            dpi=self.dpi,              # Increased from 250
            bbox_inches='tight', 
            pad_inches=0.1,       # Reduced padding
            facecolor='white',    # Ensure white background
            edgecolor='none',     # No edge color         # High quality for PNG
        )
        buf.seek(0)  
        return buf         
    
    def _parse_color_map_entries(self,sld_path):
        tree = etree.parse(sld_path)
        entries = tree.findall(".//{http://www.opengis.net/sld}ColorMapEntry")

        color_map = []
        for entry in entries:
            quantity = float(entry.attrib.get("quantity"))
            color = entry.attrib.get("color")
            label = entry.attrib.get("label", "")
            color_map.append((quantity, color, label))

        return sorted(color_map, key=lambda x: x[0])  # Sort by quantity

# --- Step 2: Convert hex to RGB ---
    def _hex_to_rgb_tuple(self,hex_color):
        hex_color = hex_color.lstrip("#")
        return tuple(int(hex_color[i:i+2], 16)/255.0 for i in (0, 2, 4))
    
    def make_image(self, name: str, raster_path: str, sld_path: str, filtered_vector: gpd.GeoDataFrame) -> BytesIO:
        color_map = self._parse_color_map_entries(sld_path)
        values, hex_colors, labels = zip(*color_map)
        rgb_colors = [self._hex_to_rgb_tuple(c) for c in hex_colors]
        cmap = ListedColormap(rgb_colors)
        norm = BoundaryNorm(values + (max(values)+1,), len(values))
        
        # INCREASE FIGURE SIZE AND DPI FOR BETTER RESOLUTION
        fig, ax = plt.subplots(figsize=(25, 25), dpi=self.dpi)  # Increased from (15,15) and dpi=default
        
        bounds, im = self.color_raster(ax, cmap, norm, raster_path)
        
        # ENSURE VECTOR IS IN SAME CRS AS RASTER
        with rasterio.open(raster_path) as src:
            raster_crs = src.crs
        
        # Reproject vector to match raster CRS if needed
        if filtered_vector.crs != raster_crs:
            filtered_vector = filtered_vector.to_crs(raster_crs)
        
        # PLOT VECTOR WITH MORE VISIBLE STYLING
        filtered_vector.plot(
            ax=ax, 
            facecolor='none', 
            edgecolor='red', 
            linewidth=0.5,  # Increased from 0.5
            alpha=0.8,      # Added transparency
            linestyle='-'   # Solid line
        )
        
        self._set_axis_limits(ax, bounds)
        ax.set_xlabel("Longitude", fontsize=18)
        ax.set_ylabel("Latitude", fontsize=18)
        
        
        
        # IMPROVE LEGEND
        legend_elements = [
            Patch(facecolor=c, edgecolor='black', label=l.strip())
            for c, l in zip(rgb_colors, labels)
        ]
        box = ax.get_position()
        ax.legend(
            handles=legend_elements, 
            title="Priority Score", 
            loc='upper center',
            bbox_to_anchor=(0.5, -0.12),
            fontsize=20,
            title_fontsize=34,
            framealpha=0.9)  # Semi-transparent background

        plt.tight_layout()
        image_bytes = self._save_plot(fig)
        plt.close(fig)
        return image_bytes
class ImageManager:
   
    
    @staticmethod
    def create_image_placeholder(figure_name: str) -> List:
       
        elements = []

        placeholder_text = f"[ {figure_name} will be inserted here ]"

        style = ParagraphStyle(
            'PlaceholderStyle',
            parent=getSampleStyleSheet()['Normal'],
            alignment=1,  # center
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
    
    @staticmethod
    def insert_actual_image(image_stream: BytesIO) -> List[Image]:
        if isinstance(image_stream, BytesIO):
            image_stream.seek(0)
        
            return [Image(image_stream, width=600, height=400, hAlign='CENTER')]
        else:
            return None  # Or raise ValueError("Expected BytesIO stream")


class ReportGenerator:
    """Main report generation class."""
    
    def __init__(self, config: ReportConfig, static_data: StaticTextData, table_data: TableData,folder_path:str,dpi:int=100):
        self.config = config
        self.static_data = static_data
        self.table_data = table_data
        self.style_manager = StyleManager()
        self.elements = []
        self.village_file=Settings().villages_path
        self.folder_path=folder_path
        self.dpi=dpi
    
    def _filter_village(self,clip:list=[]):
        gdf=gpd.read_file(self.village_file).to_crs(epsg=3857)
        gdf=gdf[gdf['subdis_cod'].isin(clip)]
        if gdf.empty:
            raise ValueError("No village polygon found for the provided clip ID(s)")
        return gdf
    def _insert_village_map(self, basemap: str = "satellite", gdf: gpd.GeoDataFrame = None) -> BytesIO:
        if gdf is None or gdf.empty:
            print("No GeoDataFrame provided or it's empty.")
            return None

        fig, ax = plt.subplots(figsize=(12, 10), dpi=self.dpi)

        # Project GeoDataFrame to EPSG:3857 for basemap
        gdf_3857 = gdf.to_crs(epsg=3857)
        gdf_3857.plot(ax=ax, edgecolor='red', facecolor='none', linewidth=2.0, alpha=0.8)

        try:
            print("Start downloading basemap...")

            # Use bounds of the reprojected gdf, not ax.get_xlim() which may still be in 32644
            bounds = gdf_3857.total_bounds  # (minx, miny, maxx, maxy)

            print(f"Transformed bounds (EPSG:3857): {bounds}")
            # img, ext = ctx.bounds2img(*bounds, source=ctx.providers.OpenStreetMap.Mapnik)
            # ax.imshow(img, extent=ext, alpha=0.8)
            print("Basemap downloaded.")
        except Exception as e:
            print(f"Warning: Could not add basemap: {e}")
            ax.set_facecolor("lightgray")

        ax.set_axis_off()

        # Expand plot limits sligh
        margin_x = (bounds[2] - bounds[0]) * 0.05
        margin_y = (bounds[3] - bounds[1]) * 0.05
        ax.set_xlim(bounds[0] - margin_x, bounds[2] + margin_x)
        ax.set_ylim(bounds[1] - margin_y, bounds[3] + margin_y)

        buf = BytesIO()
        plt.savefig(buf, format="png", dpi=self.dpi, bbox_inches="tight", pad_inches=0.1, facecolor="white")
        buf.seek(0)
        plt.close()
        return buf
    def _add_title_page(self):
        """Add title page to the report."""
        # Main title
        title = Paragraph(self.config.title, self.style_manager.styles['CustomTitle'])
        self.elements.append(title)
        self.elements.append(Spacer(1, 50))
        
        # Subtitle
        subtitle = Paragraph(
            "A Geospatial and Multi-Criteria Analysis for Prioritizing Sewage Treatment Infrastructure",
            self.style_manager.styles['Heading2']
        )
        self.elements.append(subtitle)
        self.elements.append(Spacer(1, 100))
        
        # Report details
        details = f"""
        <para align="center">
        <b>Prepared by:</b> {self.config.author}<br/>
        <b>Date:</b> {datetime.now().strftime("%B %d, %Y")}<br/>
        <b>Subject:</b> {self.config.subject}
        </para>
        """
        self.elements.append(Paragraph(details, self.style_manager.styles['Normal']))
        self.elements.append(PageBreak())
    
    def _add_executive_summary(self):
        """Add executive summary section."""
        self.elements.append(Paragraph("1. Executive Summary", self.style_manager.styles['SectionHeader']))
        
        summary_text = """
        This report presents a geospatial and multi-criteria analysis for prioritizing villages and towns 
        for the development or upgrading of Sewage Treatment Plants (STPs). The analysis integrates 
        environmental, infrastructural, and demographic indicators to identify high-need areas within 
        the study region. The outcomes are intended to support policy makers and urban planners in 
        aligning sanitation interventions with SDG 6 targets on water and sanitation access.
        """
        
        self.elements.append(Paragraph(summary_text, self.style_manager.styles['JustifiedBody']))
        self.elements.append(Spacer(1, 20))
    
    def _add_study_area_overview(self,clip:list=[]):
       
        self.elements.append(Paragraph("2. Study Area Overview", self.style_manager.styles['SectionHeader']))
        
        overview_text = f"""
        The study area encompasses selected villages and urban settlements within [Insert District/State], 
        characterized by varied physiographic and hydrological conditions. It is bounded by [insert geographical 
        features or coordinates] and falls within the catchment area of the [Insert River Name], making sewage 
        management critically important for downstream water quality. Rapid urbanization and increased population 
        density in certain zones have further strained the existing sanitation infrastructure.
        
        {self.static_data.study_area_details}
        """
        
        self.elements.append(Paragraph(overview_text, self.style_manager.styles['JustifiedBody']))
        gdf=self._filter_village(clip)
        # Add study area map placeholder
        self.elements.extend(ImageManager.create_image_placeholder("Figure 1: Study Area Map"))
        self.elements.append(Spacer(1, 20))
        sat_map_buf = self._insert_village_map(basemap="satellite",gdf=gdf)
        self.elements.append(Image(sat_map_buf, width=15*cm, height=10*cm))
        self.elements.append(Paragraph("Figure 1: Study Area Map (Satellite)", self.style_manager.styles['FigureCaption']))
        self.elements.append(Spacer(1, 20))

        # Street map
        street_map_buf = self._insert_village_map(basemap="street",gdf=gdf)
        self.elements.append(Image(street_map_buf, width=15*cm, height=10*cm))
        self.elements.append(Paragraph("Figure 2: Study Area Map (Street)", self.style_manager.styles['FigureCaption']))
        self.elements.append(Spacer(1, 20))
        return gdf
        
    
    def _add_methodology_section(self):
        """Add database and methodology section."""
        self.elements.append(Paragraph("3. Database and Methodology", self.style_manager.styles['SectionHeader']))
        
        # Database subsection
        self.elements.append(Paragraph("3.1 Database", self.style_manager.styles['SubsectionHeader']))
        
        database_text = f"""
        A range of spatial and non-spatial datasets were integrated for the STP prioritization analysis. 
        The following thematic layers were used:
        
        {self.static_data.methodology_details}
        """
        
        self.elements.append(Paragraph(database_text, self.style_manager.styles['JustifiedBody']))
        
        # Add methodology details for each factor
        factors = [
            ("Downstream Effect of Drain", self.static_data.downstream_effect_of_drain),
            ("Drainage Distance",self.static_data.drainage_distance),
            ("Groundwater Depth",self.static_data.groundwater_depth),
            ("Groundwater Quality",self.static_data.groundwater_depth),
            ("LULC",self.static_data.lulc_analysis),
            ("Major City Risk",self.static_data.major_city_risk),
            ("Population",self.static_data.population_analysis),
            ("Proximity to River Quality",self.static_data.proximity_river_quality),
        ]
        
        for factor_name, description in factors:
            self.elements.append(Paragraph(f"<b>{factor_name}:</b> {description}", self.style_manager.styles['JustifiedBody']))
        
        # Methodology subsection
        self.elements.append(Paragraph("3.2 Methodology", self.style_manager.styles['SubsectionHeader']))
        
        methodology_text = """
        <b>(a) Data Reclassification:</b> Each factor raster was reclassified into suitability scores ranging from 1 (least priority) to 5 (highest priority). The classification thresholds were derived based on standard guidelines and quantile statistics (Malczewski, 1999).<br/><br/>
        <b>(b) Data Normalization:</b> To ensure comparability among heterogeneous datasets, min-max normalization was applied to all continuous variables. Categorical variables were mapped using fixed priority schemes based on expert consultation.<br/><br/>
        <b>(c) Confusion Matrix:</b> To validate the predictive robustness of the prioritization output, confusion matrices were generated by comparing known high-priority sites (e.g., existing STPs or identified hotspots) with the predicted scores.<br/><br/>
        <b>(d) Weighted Overlay:</b> A Weighted Linear Combination (WLC) model was used, integrating all the thematic layers. The final priority score was computed using:
        STP Priority Index = <br/> 
        where wiw_iwi is the weight and xix_ixi is the normalized value of the iii-th criterion.<br/><br/>
        """
        
        self.elements.append(Paragraph(methodology_text, self.style_manager.styles['JustifiedBody']))
        self.elements.append(PageBreak())
    
    def __image_maker(self,name:str,folder_path:str,gdf:gpd.GeoDataFrame) -> BytesIO:
        name=name[4:]
        name=name.replace(" ","_")
        raster_path = os.path.join(folder_path, f"{name}.tif")
        sld_path = os.path.join(folder_path, f"{name}.sld")
        if os.path.exists(raster_path) and os.path.exists(sld_path):
            return MapGenerator(dpi=self.dpi).make_image(name,raster_path,sld_path,filtered_vector=gdf)
        else:
           
            return None
    def _add_results_section(self,gdf:gpd.GeoDataFrame):
        """Add results section with all factors and analysis."""
        self.elements.append(Paragraph("4. Results", self.style_manager.styles['SectionHeader']))
        
        # Priority factors subsection
        self.elements.append(Paragraph("4.1 STP Priority Factors", self.style_manager.styles['SubsectionHeader']))
        
        factors_text = """
        The analysis reveals that factors such as downstream drain effect, proximity to polluted river segments, 
        and population size exert the most significant influence on STP prioritization. Villages with high sewage 
        potential but lacking treatment infrastructure clustered in [insert zones].
        """
        
        self.elements.append(Paragraph(factors_text, self.style_manager.styles['JustifiedBody']))
        
        # Add each factor with its analysis and map
        factors_data = [
            ("(a) Downstream Effect of Drain", self.static_data.downstream_effect_of_drain, "Figure 1: Downstream Effect Map"),
            ("(b) Drainage Distance", self.static_data.drainage_distance, "Figure 2: Drainage Distance Map"),
            ("(c) Groundwater Depth", self.static_data.groundwater_depth, "Figure 3: Groundwater Depth Map"),
            ("(d) Groundwater Quality", self.static_data.groundwater_quality, "Figure 4: Groundwater Quality Map"),
            ("(e) LULC", self.static_data.lulc_analysis, "Figure 5: LULC Map"),
            ("(f) Major City Risk", self.static_data.major_city_risk, "Figure 6: Major City Risk Map"),
            ("(g) Population", self.static_data.population_analysis, "Figure 7: Population Map"),
            ("(h) Proximity River Quality", self.static_data.proximity_river_quality, "Figure 8: Proximity  River Quality Map")
        ]
        gdf_json=gdf.to_json()
        dpi=self.dpi
        task_group = group(
            generate_celery_image.s(
                dpi=dpi,
                name=factor_title,
                folder_path=self.folder_path,
                gdf_json=gdf_json 
            )
            for factor_title, static_text, figure_title in factors_data
        )
        metadata = {
            "folder_path": self.folder_path,
            "factors_data": factors_data,
            "styles": self.style_manager.styles,
            "extra_gdf_json": gdf_json,
            # If needed, you can pass flags/other sections too
        }

        self.elements = chord(task_group)(process_images_and_continue.s(metadata))
       
       
        
        # Priority map
        self.elements.append(Paragraph("4.2 STP Priority Map", self.style_manager.styles['SubsectionHeader']))
        
        #priority_text = self.static_data.priority_map_analysis if self.static_data.priority_map_analysis else "[Static text will be added here]"
        #self.elements.append(Paragraph(priority_text, self.style_manager.styles['JustifiedBody']))
        
        self.elements.append(Paragraph("Figure 9: STP Priority Map", self.style_manager.styles['FigureCaption']))
        self.elements.append(Spacer(1, 20))

        
        image_bytes=self.__image_maker(folder_path=self.folder_path,name="(i) STP Priority",gdf=gdf)
        
        self.elements.extend(ImageManager.insert_actual_image(image_bytes))
        self.elements.append(Spacer(1, 15))
        self.elements.append(PageBreak())
         
        # Weights details
        self.elements.append(Paragraph("4.3 Details of the Assigned Weights", self.style_manager.styles['SubsectionHeader']))
        
        weights_text = self.static_data.weight_details if self.static_data.weight_details else "[weight static data ]"
        self.elements.append(Paragraph(weights_text, self.style_manager.styles['JustifiedBody']))
        
        # Weights table
        weights_table = TableGenerator.create_styled_table(self.table_data.weights_table)
        self.elements.append(weights_table)
        self.elements.append(Paragraph("Table 1: Details of the Used Weights", self.style_manager.styles['FigureCaption']))
        self.elements.append(Spacer(1, 20))
        # Village-wise analysis
        self.elements.append(Paragraph("4.4 Village-wise Analysis of the STP Priority", self.style_manager.styles['SubsectionHeader']))
        
        village_text = self.static_data.village_analysis if self.static_data.village_analysis else "[Static text will be added here]"
        self.elements.append(Paragraph(village_text, self.style_manager.styles['JustifiedBody']))
        
        # Village analysis table
        village_table = TableGenerator.create_styled_table(self.table_data.village_priority_table)
        self.elements.append(village_table)
        self.elements.append(Paragraph("Table 2: Details of the Village-wise STP Priority Analysis", self.style_manager.styles['FigureCaption']))
        self.elements.append(PageBreak())
    
    def _add_references(self):
        """Add references section."""
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
    
    def generate_report(self,clip:list=[]) -> str:
       
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
     
        gdf=self._add_study_area_overview(clip=clip)
      
        self._add_methodology_section()
     
        self._add_results_section(gdf=gdf)
       
        self._add_references()
    
        # Build the PDF
        doc.build(self.elements)
        
        return full_output_path


class StpDocument:
    def __init__(self):
        self.raster_url=Settings().GEOSERVER_EX_URL
        self.sld_url=Settings().GEOSERVER_EX_URL
        self.base_dir=Settings().BASE_DIR+"/temp"
        self.pdf=Settings().BASE_DIR+"/temp/documents"
        os.makedirs(self.pdf,exist_ok=True)
    
    def _geoserver_load(self,folder_path:str,layer_name:list):
        response=[]
        for i in layer_name:
            resp =Geoserver().raster_download(temp_path=folder_path,layer_name=i.layer_name)
            response.append(resp)
        return response
   
    def static_pdf(self,folder_path,csv_data,clip:list=[],dpi:int=100):
        config = ReportConfig(
            title="Comprehensive Report on the STP Priority",
            author="IIT BHU",
            output_folder=self.pdf
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
        generator = ReportGenerator(config, static_data, table_data,folder_path=folder_path,dpi=dpi)
        output_file = generator.generate_report(clip=clip)
        return output_file

    def _raster_loader(self,folder_path:str,layer_name:list):
        temp = self._geoserver_load(folder_path,layer_name)
        return temp

    def report_generator(self,layer_name:list,csv_data:list,clip:list=[],dpi:int=100):
        folder_path=Settings().BASE_DIR+"/temp/"+str(uuid.uuid4())
        os.makedirs(folder_path,exist_ok=True)
        self._raster_loader(folder_path,layer_name=layer_name)
        return self.static_pdf(folder_path,csv_data,clip,dpi=dpi)
