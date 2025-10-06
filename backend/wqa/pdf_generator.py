import io
import os
from pathlib import Path
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfgen import canvas
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib
matplotlib.use('Agg')
import traceback

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.setFont("Helvetica", 9)
        self.drawRightString(
            8 * inch, 0.5 * inch,
            f"Page {self._pageNumber} of {page_count}"
        )

class GWQIReportGenerator:
    def __init__(self, gwqi_data, selected_year, session_id=None):
        self.gwqi_data = gwqi_data
        self.selected_year = str(selected_year)
        self.session_id = session_id
        
        # Set paths based on session
        if session_id:
            # Use session-based paths
            self.base_dir = Path("media/temp/sessions") / session_id / "output"
            self.year_dir = self.base_dir / self.selected_year
        else:
            # Fallback to old paths
            self.base_dir = Path("media/gwa_generated_rasters")
            self.year_dir = self.base_dir / self.selected_year
        
        print(f"[PDF] Using directory: {self.year_dir}")
        print(f"[PDF] Session ID: {session_id}")
        
        # Create temp directory
        self.temp_dir = Path("media/temp")
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.temp_images = []
    
    def cleanup_temp_images(self):
        """Clean up temporary image files"""
        for img_path in self.temp_images:
            try:
                if os.path.exists(img_path):
                    os.remove(img_path)
            except Exception as e:
                print(f"Failed to delete temp image {img_path}: {e}")
    
    def get_parameter_legend_data(self, parameter):
        """Get legend data for a specific parameter - must match gwqi.py color schemes"""
        parameter_schemes = {
            'ph_level': {
                'colors': ['#d73027', '#fc8d59', '#fee08b', '#99d594', '#3288bd'],
                'labels': ['< 6.5', '6.5 - 7.5', '7.5 - 8.0', '8.0 - 8.5', '> 8.5'],
                'unit': 'pH units',
                'name': 'pH Level'
            },
            'electrical_conductivity': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 300', '300 - 600', '600 - 1200', '1200 - 1500', '> 1500'],
                'unit': 'µS/cm',
                'name': 'Electrical Conductivity'
            },
            'carbonate': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 30', '30 - 60', '60 - 120', '120 - 180', '> 180'],
                'unit': 'mg/L',
                'name': 'Carbonate'
            },
            'bicarbonate': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 150', '150 - 300', '300 - 600', '600 - 900', '> 900'],
                'unit': 'mg/L',
                'name': 'Bicarbonate'
            },
            'chloride': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 62.5', '62.5 - 125', '125 - 250', '250 - 375', '> 375'],
                'unit': 'mg/L',
                'name': 'Chloride'
            },
            'fluoride': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 0.375', '0.375 - 0.75', '0.75 - 1.5', '1.5 - 2.25', '> 2.25'],
                'unit': 'mg/L',
                'name': 'Fluoride'
            },
            'sulfate': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 75', '75 - 150', '150 - 300', '300 - 450', '> 450'],
                'unit': 'mg/L',
                'name': 'Sulfate'
            },
            'nitrate': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 12.5', '12.5 - 25', '25 - 50', '50 - 75', '> 75'],
                'unit': 'mg/L',
                'name': 'Nitrate'
            },
            'Hardness': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 150', '150 - 300', '300 - 600', '600 - 900', '> 900'],
                'unit': 'mg/L as CaCO₃',
                'name': 'Total Hardness'
            },
            'calcium': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 50', '50 - 100', '100 - 200', '200 - 300', '> 300'],
                'unit': 'mg/L',
                'name': 'Calcium'
            },
            'magnesium': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 25', '25 - 50', '50 - 100', '100 - 150', '> 150'],
                'unit': 'mg/L',
                'name': 'Magnesium'
            },
            'sodium': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 50', '50 - 100', '100 - 200', '200 - 300', '> 300'],
                'unit': 'mg/L',
                'name': 'Sodium'
            },
            'potassium': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 3', '3 - 6', '6 - 12', '12 - 18', '> 18'],
                'unit': 'mg/L',
                'name': 'Potassium'
            },
            'iron': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'labels': ['< 0.25', '0.25 - 0.5', '0.5 - 1.0', '1.0 - 1.5', '> 1.5'],
                'unit': 'mg/L',
                'name': 'Iron'
            }
        }
        
        return parameter_schemes.get(parameter)
    
    def create_legend_table(self, legend_data):
        """Create a compact formatted legend table for PDF"""
        if not legend_data:
            return None
        
        styles = getSampleStyleSheet()
        
        # Create legend rows - each row has [color box, label]
        data = []
        for color, label in zip(legend_data['colors'], legend_data['labels']):
            # Create smaller color box with border
            color_style = ParagraphStyle(
                'ColorBox',
                parent=styles['Normal'],
                backColor=color,
                borderWidth=1,
                borderColor=colors.black,
                alignment=TA_CENTER,
                leftIndent=0,
                rightIndent=0,
                fontSize=8,
            )
            color_cell = Paragraph('&nbsp;&nbsp;', color_style)
            
            # Create smaller label
            label_style = ParagraphStyle(
                'LabelStyle',
                parent=styles['Normal'],
                fontSize=9,
            )
            label_cell = Paragraph(f"<b>{label}</b>", label_style)
            
            data.append([color_cell, label_cell])
        
        # Create smaller table with reduced column widths
        legend_table = Table(data, colWidths=[0.4*inch, 2.5*inch])
        legend_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (1, 0), (1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        
        # Create smaller title with unit info
        title_style = ParagraphStyle(
            'LegendTitle',
            parent=styles['Heading3'],
            fontSize=10,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=4,
            fontName='Helvetica-Bold'
        )
        title_text = f"{legend_data['name']} Scale (Unit: {legend_data['unit']})"
        title = Paragraph(title_text, title_style)
        
        return KeepTogether([title, Spacer(1, 0.05*inch), legend_table])
    
    def generate_pdf(self):
        """Generate complete PDF report with session support"""
        try:
            print(f"[PDF] Generating report for year {self.selected_year}")
            
            buffer = io.BytesIO()
            
            doc = SimpleDocTemplate(
                buffer,
                pagesize=landscape(A4),
                rightMargin=0.5*inch,
                leftMargin=0.5*inch,
                topMargin=0.75*inch,
                bottomMargin=0.75*inch
            )
            
            elements = []
            
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor=colors.HexColor('#1e40af'),
                spaceAfter=30,
                alignment=TA_CENTER,
                fontName='Helvetica-Bold'
            )
            
            heading_style = ParagraphStyle(
                'CustomHeading',
                parent=styles['Heading2'],
                fontSize=16,
                textColor=colors.HexColor('#1e40af'),
                spaceAfter=12,
                spaceBefore=12,
                fontName='Helvetica-Bold'
            )
            
            # Cover Page
            elements.append(Spacer(1, 1*inch))
            elements.append(Paragraph("Groundwater Quality Index (GWQI) Report", title_style))
            elements.append(Spacer(1, 0.3*inch))
            elements.append(Paragraph(f"Analysis Year: {self.selected_year}", styles['Normal']))
            if self.session_id:
                elements.append(Paragraph(f"Session ID: {self.session_id[:8]}", styles['Normal']))
            elements.append(Spacer(1, 0.5*inch))
            
            # GWQI Score Summary
            results = self.gwqi_data.get('results', {})
            gwqi_score = results.get('gwqi_score', 'N/A')
            classification = results.get('classification', 'Unknown')
            statistics = results.get('statistics', {})
            min_score = statistics.get('min', 'N/A')
            max_score = statistics.get('max', 'N/A')
            
            if isinstance(gwqi_score, (int, float)):
                gwqi_score = f"{gwqi_score:.2f}"
            if isinstance(min_score, (int, float)):
                min_score = f"{min_score:.2f}"
            if isinstance(max_score, (int, float)):
                max_score = f"{max_score:.2f}"
            
            summary_data = [
                ['GWQI Score', gwqi_score],
                ['Classification', classification],
                ['Score Range', f"{min_score} - {max_score}"],
            ]
            
            summary_table = Table(summary_data, colWidths=[3*inch, 3*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e0e7ff')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 14),
                ('FONTSIZE', (0, 1), (-1, -1), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            
            elements.append(summary_table)
            elements.append(PageBreak())
            
            # GWQI Composite Map
            #elements.append(Paragraph("GWQI Composite Map", heading_style))
            
            # Build the GWQI preview filename with session support
            session_suffix = f"_{self.session_id[:8]}" if self.session_id else ""
            gwqi_preview_filename = f"gwqi_composite_{self.selected_year}{session_suffix}_preview.png"
            gwqi_preview_path = self.year_dir / gwqi_preview_filename
            
            print(f"[PDF] Looking for GWQI preview: {gwqi_preview_path}")
            
            if gwqi_preview_path.exists():
                print(f"[PDF] Found GWQI preview: {gwqi_preview_path}")
                
                # Create elements for GWQI map + legend to keep together
                gwqi_elements = []
                
                # REDUCED size for GWQI map to fit with legend on same page
                img = Image(str(gwqi_preview_path), width=7*inch, height=4.5*inch)
                gwqi_elements.append(img)
                
                # Add GWQI legend separately below the map
                gwqi_elements.append(Spacer(1, 0.15*inch))
                gwqi_legend_data = {
                    'colors': ['#d73027', '#fc8d59', '#fee08b', '#99d594', '#3288bd'],
                    'labels': ['0 - 0.2', '0.2 - 0.4', '0.4 - 0.6', '0.6 - 0.8', '0.8 - 1.0'],
                    'unit': 'Index Score',
                    'name': 'GWQI (Normalized)'
                }
                gwqi_legend_table = self.create_legend_table(gwqi_legend_data)
                if gwqi_legend_table:
                    gwqi_elements.append(gwqi_legend_table)
                    print(f"[PDF] Added GWQI legend")
                
                # Keep GWQI map and legend together on same page
                elements.append(KeepTogether(gwqi_elements))
            else:
                print(f"[PDF WARNING] GWQI preview not found: {gwqi_preview_path}")
                elements.append(Paragraph("GWQI map preview not available", styles['Normal']))
            
            #elements.append(PageBreak())
            
            # Individual Parameter Maps
            #elements.append(Paragraph("Individual Parameter Maps", heading_style))
            
            # Get individual parameter images
            individual_images = self.find_individual_parameter_images()
            
            if individual_images:
                print(f"[PDF] Found {len(individual_images)} individual parameter images")
                
                for idx, img_info in enumerate(individual_images):
                    img_path = img_info['path']
                    param_name = img_info['parameter']
                    
                    if img_path.exists():
                        print(f"[PDF] Adding parameter image: {param_name}")
                        
                        # Create a list to hold map + legend together
                        param_elements = []
                        
                        # REDUCED size to ensure fit on same page
                        img = Image(str(img_path), width=7*inch, height=4.5*inch)
                        param_elements.append(img)
                        
                        # Add separate legend below the map
                        legend_data = self.get_parameter_legend_data(param_name)
                        if legend_data:
                            param_elements.append(Spacer(1, 0.15*inch))
                            legend_table = self.create_legend_table(legend_data)
                            if legend_table:
                                param_elements.append(legend_table)
                                print(f"[PDF] Added legend for {param_name}")
                        
                        # Use KeepTogether to ensure map and legend stay on same page
                        elements.append(KeepTogether(param_elements))
                        
                        # Page break after each parameter (except last)
                        if idx < len(individual_images) - 1:
                            elements.append(PageBreak())
                    else:
                        print(f"[PDF WARNING] Parameter image not found: {img_path}")
            else:
                print("[PDF WARNING] No individual parameter images found")
                elements.append(Paragraph("Individual parameter maps not available", styles['Normal']))
            
            # Build PDF
            doc.build(elements, canvasmaker=NumberedCanvas)
            
            pdf_value = buffer.getvalue()
            buffer.close()
            
            self.cleanup_temp_images()
            
            print(f"[PDF] Report generated successfully for year {self.selected_year}")
            return pdf_value
            
        except Exception as e:
            print(f"[PDF ERROR] PDF generation failed: {e}")
            traceback.print_exc()
            self.cleanup_temp_images()
            return None
    
    def find_individual_parameter_images(self):
        """Find all individual parameter preview images"""
        try:
            individual_images = []
            
            if not self.year_dir.exists():
                print(f"[PDF] Year directory not found: {self.year_dir}")
                return individual_images
            
            # Look for preview images
            session_suffix = f"_{self.session_id[:8]}" if self.session_id else ""
            
            # Common parameter names
            parameters = [
                'ph_level', 'electrical_conductivity', 'carbonate', 'bicarbonate',
                'chloride', 'fluoride', 'sulfate', 'nitrate', 'phosphate',
                'Hardness', 'calcium', 'magnesium', 'sodium', 'potassium', 'iron'
            ]
            
            for param in parameters:
                # Try with session suffix first
                if self.session_id:
                    preview_filename = f"{param}_{self.selected_year}{session_suffix}_preview.png"
                else:
                    preview_filename = f"{param}_{self.selected_year}_preview.png"
                
                preview_path = self.year_dir / preview_filename
                
                if preview_path.exists():
                    individual_images.append({
                        'parameter': param,
                        'path': preview_path,
                        'filename': preview_filename
                    })
                    print(f"[PDF] Found parameter image: {preview_filename}")
            
            # Also try to find any other preview images with session suffix
            if self.session_id:
                pattern = f"*_{self.selected_year}{session_suffix}_preview.png"
            else:
                pattern = f"*_{self.selected_year}_preview.png"
            
            for preview_path in self.year_dir.glob(pattern):
                # Extract parameter name
                filename = preview_path.name
                if filename.startswith('gwqi_composite'):
                    continue  # Skip GWQI composite
                
                # Extract parameter name from filename
                param_part = filename.replace(f"_{self.selected_year}{session_suffix}_preview.png", "")
                
                # Check if we already have this parameter
                if not any(img['parameter'] == param_part for img in individual_images):
                    individual_images.append({
                        'parameter': param_part,
                        'path': preview_path,
                        'filename': filename
                    })
                    print(f"[PDF] Found additional parameter image: {filename}")
            
            print(f"[PDF] Total individual images found: {len(individual_images)}")
            return individual_images
            
        except Exception as e:
            print(f"[PDF ERROR] Error finding parameter images: {e}")
            traceback.print_exc()
            return []

def generate_gwqi_report(gwqi_data, selected_year, session_id=None):
    """Main function to generate GWQI report with session support"""
    print(f"[PDF] Starting report generation for year {selected_year}, session: {session_id}")
    generator = GWQIReportGenerator(gwqi_data, selected_year, session_id)
    return generator.generate_pdf()