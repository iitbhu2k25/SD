

import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from pathlib import Path

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


@dataclass
class ReportConfig:
    title: str = "Comprehensive Report on the STP Priority"
    author: str = "IIT BHU"
    subject: str = "STP Priority Analysis"
    output_filename: str = "STP_Priority_Report.pdf"
    page_size: Tuple = A4
    margins: Dict[str, float] = None
    
    def __post_init__(self):
        if self.margins is None:
            self.margins = {
                'top': 2.5*cm,
                'bottom': 2.5*cm,
                'left': 2.5*cm,
                'right': 2.5*cm
            }


@dataclass
class StaticTextData:
    """Data structure for static text content."""
    downstream_effect: str = ""
    drainage_distance: str = ""
    groundwater_depth: str = ""
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
    """Data structure for table content."""
    weights_table: List[List[str]] = None
    village_priority_table: List[List[str]] = None
    
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
        
        if self.village_priority_table is None:
            self.village_priority_table = [
                ["Village Name", "Priority Score", "Population", "Risk Level", "Recommendation"],
                ["Village A", "4.5", "12,000", "High", "Immediate STP installation"],
                ["Village B", "4.2", "8,500", "High", "Immediate STP installation"],
                ["Village C", "3.8", "6,200", "Medium", "STP upgrade required"],
                ["Village D", "3.5", "4,800", "Medium", "STP upgrade required"],
                ["Village E", "2.1", "2,100", "Low", "Monitor and plan future intervention"]
            ]


class StyleManager:
    """Manages all document styles and formatting."""
    
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self._create_custom_styles()
    
    def _create_custom_styles(self):
        """Create custom paragraph styles."""
        # Title style
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
    def create_styled_table(data: List[List[str]], table_name: str = "") -> Table:
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


class ImageManager:
    """Handles image insertion and placeholder creation."""
    
    @staticmethod
    def create_image_placeholder(figure_name: str, width: float = 15*cm, height: float = 10*cm) -> List:
        """Create a placeholder for images with caption."""
        elements = []
        
        # Create placeholder rectangle (you can replace this with actual image loading)
        placeholder_text = f"[{figure_name} will be inserted here]"
        placeholder = Paragraph(
            f'<para align="center" backColor="lightgrey" borderColor="grey" borderWidth="1" '
            f'borderPadding="20" fontSize="12"><b>{placeholder_text}</b></para>',
            getSampleStyleSheet()['Normal']
        )
        
        elements.append(placeholder)
        elements.append(Spacer(1, 6))
        
        return elements
    
    @staticmethod
    def insert_actual_image(image_path: str, width: float = 15*cm, height: float = 10*cm) -> Image:
        """Insert an actual image if the path exists."""
        if os.path.exists(image_path):
            return Image(image_path, width=width, height=height, hAlign='CENTER')
        else:
            # Return placeholder if image doesn't exist
            return None


class ReportGenerator:
    """Main report generation class."""
    
    def __init__(self, config: ReportConfig, static_data: StaticTextData, table_data: TableData):
        self.config = config
        self.static_data = static_data
        self.table_data = table_data
        self.style_manager = StyleManager()
        self.elements = []
        
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
    
    def _add_study_area_overview(self):
        """Add study area overview section."""
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
        
        # Add study area map placeholder
        self.elements.extend(ImageManager.create_image_placeholder("Figure 1: Study Area Map"))
        self.elements.append(Paragraph("Figure 1: Study Area Map", self.style_manager.styles['FigureCaption']))
        self.elements.append(Spacer(1, 20))
    
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
            ("Downstream Effect of Drain", "This factor identifies locations where untreated sewage could severely impact downstream populations and ecosystems."),
            ("Drainage Distance", "Drainage distance was calculated using Euclidean and cost-distance algorithms to determine village proximity to the nearest major drain."),
            ("Groundwater Depth", "Depth-to-groundwater data were used to assess contamination risk. Shallow aquifers are more vulnerable to pollution."),
            ("LULC", "The influence of land use was examined using classified satellite imagery to identify dense built-up zones."),
            ("Major City Risk", "Villages in close proximity to major cities are at higher risk of pollution load migration and infrastructure overload."),
            ("Population", "Population data were sourced from Census 2011 and projected using appropriate demographic models."),
            ("Proximity to River Quality", "Proximity to poor-quality river segments was considered a critical factor.")
        ]
        
        for factor_name, description in factors:
            self.elements.append(Paragraph(f"<b>{factor_name}:</b> {description}", self.style_manager.styles['JustifiedBody']))
        
        # Methodology subsection
        self.elements.append(Paragraph("3.2 Methodology", self.style_manager.styles['SubsectionHeader']))
        
        methodology_text = """
        <b>(a) Data Reclassification:</b> Each factor raster was reclassified into suitability scores ranging from 1 (least priority) to 5 (highest priority).<br/><br/>
        <b>(b) Data Normalization:</b> To ensure comparability among heterogeneous datasets, min-max normalization was applied to all continuous variables.<br/><br/>
        <b>(c) Confusion Matrix:</b> To validate the predictive robustness of the prioritization output, confusion matrices were generated.<br/><br/>
        <b>(d) Weighted Overlay:</b> A Weighted Linear Combination (WLC) model was used, integrating all the thematic layers.
        """
        
        self.elements.append(Paragraph(methodology_text, self.style_manager.styles['JustifiedBody']))
        self.elements.append(PageBreak())
    
    def _add_results_section(self):
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
            ("(a) Downstream Effect of Drain", self.static_data.downstream_effect, "Figure 2: Downstream Effect Map"),
            ("(b) Drainage Distance", self.static_data.drainage_distance, "Figure 3: Drainage Distance Map"),
            ("(c) Groundwater Depth", self.static_data.groundwater_depth, "Figure 4: Groundwater Depth Map"),
            ("(d) LULC", self.static_data.lulc_analysis, "Figure 5: LULC Map"),
            ("(e) Major City Risk", self.static_data.major_city_risk, "Figure 6: Major City Risk Map"),
            ("(f) Population", self.static_data.population_analysis, "Figure 7: Population Map"),
            ("(g) Proximity to River Quality", self.static_data.proximity_river_quality, "Figure 8: Proximity to River Quality Map")
        ]
        
        for factor_title, static_text, figure_title in factors_data:
            self.elements.append(Paragraph(factor_title, self.style_manager.styles['SubsectionHeader']))
            
            content = static_text if static_text else "[Static text will be added here]"
            self.elements.append(Paragraph(content, self.style_manager.styles['JustifiedBody']))
            
            # Add map placeholder
            self.elements.extend(ImageManager.create_image_placeholder(figure_title))
            self.elements.append(Paragraph(figure_title, self.style_manager.styles['FigureCaption']))
            self.elements.append(Spacer(1, 15))
        
        self.elements.append(PageBreak())
        
        # Weights details
        self.elements.append(Paragraph("4.2 Details of the Assigned Weights", self.style_manager.styles['SubsectionHeader']))
        
        weights_text = self.static_data.weight_details if self.static_data.weight_details else "[Static text will be added here]"
        self.elements.append(Paragraph(weights_text, self.style_manager.styles['JustifiedBody']))
        
        # Weights table
        weights_table = TableGenerator.create_styled_table(self.table_data.weights_table, "Weights Table")
        self.elements.append(weights_table)
        self.elements.append(Paragraph("Table 1: Details of the Used Weights", self.style_manager.styles['FigureCaption']))
        self.elements.append(Spacer(1, 20))
        
        # Priority map
        self.elements.append(Paragraph("4.3 STP Priority Map", self.style_manager.styles['SubsectionHeader']))
        
        priority_text = self.static_data.priority_map_analysis if self.static_data.priority_map_analysis else "[Static text will be added here]"
        self.elements.append(Paragraph(priority_text, self.style_manager.styles['JustifiedBody']))
        
        self.elements.extend(ImageManager.create_image_placeholder("Figure 9: STP Priority Map"))
        self.elements.append(Paragraph("Figure 9: STP Priority Map", self.style_manager.styles['FigureCaption']))
        self.elements.append(Spacer(1, 20))
        
        # Village-wise analysis
        self.elements.append(Paragraph("4.4 Village-wise Analysis of the STP Priority", self.style_manager.styles['SubsectionHeader']))
        
        village_text = self.static_data.village_analysis if self.static_data.village_analysis else "[Static text will be added here]"
        self.elements.append(Paragraph(village_text, self.style_manager.styles['JustifiedBody']))
        
        # Village analysis table
        village_table = TableGenerator.create_styled_table(self.table_data.village_priority_table, "Village Priority Table")
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
    
    def generate_report(self) -> str:
        """Generate the complete report and return the output filename."""
        # Create document
        doc = SimpleDocTemplate(
            self.config.output_filename,
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
        self._add_study_area_overview()
        self._add_methodology_section()
        self._add_results_section()
        self._add_references()
        
        # Build the PDF
        doc.build(self.elements)
        
        return self.config.output_filename


# Example usage and data loading functions
class DataLoader:
    """Helper class to load data from various sources."""
    
    @staticmethod
    def load_static_text_from_file(file_path: str) -> StaticTextData:
        """Load static text data from a configuration file."""
        # Implement file loading logic here
        # This could read from JSON, YAML, or database
        return StaticTextData()
    
    @staticmethod
    def load_table_data_from_csv(weights_csv: str, village_csv: str) -> TableData:
        """Load table data from CSV files."""
        # Implement CSV loading logic here
        return TableData()


def main():
    """Main function to demonstrate usage."""
    # Configuration
    config = ReportConfig(
        title="Comprehensive Report on the STP Priority",
        author="Environmental Assessment Team",
        output_filename="STP_Priority_Report.pdf"
    )
    
    # Static text data (you can populate these from your data sources)
    static_data = StaticTextData(
        downstream_effect="The downstream effect analysis shows critical impact zones where untreated sewage significantly affects water quality and ecosystem health downstream.",
        drainage_distance="Drainage distance calculations reveal that villages within 500m of major drains pose the highest risk for unregulated discharge.",
        groundwater_depth="Groundwater depth analysis indicates that areas with shallow aquifers (<10m) are most vulnerable to contamination.",
        # Add more static text as needed...
    )
    
    # Table data (can be loaded from CSV or database)
    table_data = TableData()
    
    # Generate report
    generator = ReportGenerator(config, static_data, table_data)
    output_file = generator.generate_report()
    
    print(f"Report generated successfully: {output_file}")


if __name__ == "__main__":
    main()