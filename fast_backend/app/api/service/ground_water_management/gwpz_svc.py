from sqlalchemy.orm import Session
from app.database.crud.gwpz_crud import GWZ_crud,MARSuitability_crud,MARSuitability_visualization_crud,GWZ_visualization_crud,GWPL_crud,GWPL_visualization_crud
from app.api.schema.stp_schema import STPCategory,RasterVisual
import os
from  app.api.service.river_water_management.spt_service import Stp_service
from app.conf.settings import Settings
from app.api.exception.exceptions import CustomException
from fastapi.responses import FileResponse
import rasterio
import matplotlib.pyplot as plt
from matplotlib.colors import BoundaryNorm, ListedColormap
from xml.etree import ElementTree as ET
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
from io import BytesIO
import math
import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass
from app.api.service.geoserver import Geoserver
from pathlib import Path
from app.utils.name import Unique_name

class Gwzp_service:
    def get_raster(db:Session,payload:STPCategory):
        raster_path=[]
        raster_weights=[]
        for i in payload.data:
            temp_path=GWZ_crud(db).get_raster_path(i.file_name)
            temp_path=os.path.join(Settings().BASE_DIR+"/"+temp_path)
            temp_path = os.path.abspath(temp_path)
            raster_path.append(temp_path)
            raster_weights.append(float(i.weight))
        return raster_path,raster_weights
    
    def get_raster_GWZ(db:Session,all_data:bool=False):
        return GWZ_crud(db).get_raster_category(all_data)

    def get_GWA_Priority_visual(db:Session,all_data:bool=True):
        return GWZ_visualization_crud(db).get_all_visual()
    
    def get_raster_path(db:Session,name:str):
        return GWZ_visualization_crud(db).get_raster(name)

class GWPL_service:
    
    def get_raster_GWPL(db:Session,category:str,all_data:bool=False):
        return GWPL_crud(db).get_raster_category(category,all_data)

    def get_GWPL_visual(db:Session,all_data:bool=True):
        return GWPL_visualization_crud(db).get_all_visual()
    def get_raster_path(db:Session,name:str):
        return GWPL_visualization_crud(db).get_raster(name)

class MARSuitability_svc:
    def get_raster_MAR(db:Session,category:str,all_data:bool=False):
        return MARSuitability_crud(db).get_raster_category(category,all_data)

    def get_MAR_visual(db:Session,all_data:bool=True):
        return MARSuitability_visualization_crud(db).get_all_visual()
    def get_raster_path(db:Session,name:str):
        return MARSuitability_visualization_crud(db).get_raster(name)


@dataclass
class MapConfig:
    page_width: float
    page_height: float
    dpi: int = 250
    map_margin_left: int = 200
    map_margin_right: int = 20
    map_margin_top: int = 100
    map_margin_bottom: int = 80
    
    @property
    def map_width(self) -> float:
        return self.page_width - self.map_margin_left - self.map_margin_right
    
    @property
    def map_height(self) -> float:
        return self.page_height - self.map_margin_top - self.map_margin_bottom


@dataclass
class RasterData:
    data: np.ndarray
    bounds: rasterio.coords.BoundingBox
    crs: rasterio.crs.CRS
    width: int
    height: int
    nodata: Optional[float]
    
    @property
    def aspect_ratio(self) -> float:
        return self.width / self.height


@dataclass
class LegendItem:
    color: str
    label: str
    quantity: float

@dataclass
class LogoConfig:
    left_logo_path: Optional[str] = None
    right_logo_path: Optional[str] = None
    logo_height: float = 60  # Height of logo in points
    logo_margin_top: float = 20  # Margin from top
    logo_margin_side: float = 30  # Margin from sides



class SLDParser:
    
    def __init__(self, sld_path: str):
        self.sld_path = sld_path
        self.namespace = {'sld': 'http://www.opengis.net/sld'}
    
    def parse(self) -> List[LegendItem]:
        tree = ET.parse(self.sld_path)
        legend_items = []
        
        for entry in tree.findall('.//sld:ColorMapEntry', self.namespace):
            color = entry.attrib.get('color')
            label = entry.attrib.get('label')
            quantity = float(entry.attrib.get('quantity'))
            legend_items.append(LegendItem(color, label, quantity))
        
        return legend_items
    
    @staticmethod
    def create_colormap(legend_items: List[LegendItem]) -> Tuple[ListedColormap, BoundaryNorm]:
        colors = [item.color for item in legend_items]
        quantities = [item.quantity for item in legend_items]
        
        cmap = ListedColormap(colors)
        norm = BoundaryNorm(quantities, ncolors=len(colors))
        cmap.set_bad(color='white', alpha=0)
        
        return cmap, norm


class RasterReader:
    
    def __init__(self, raster_path: str):
        self.raster_path = raster_path
    
    def read(self) -> RasterData:
        with rasterio.open(self.raster_path) as src:
            data = src.read(1)
            bounds = src.bounds
            crs = src.crs
            nodata = src.nodata
            width = src.width
            height = src.height
            
            data = self._mask_nodata(data, nodata)
            
            return RasterData(data, bounds, crs, width, height, nodata)
    
    @staticmethod
    def _mask_nodata(data: np.ndarray, nodata: Optional[float]) -> np.ma.MaskedArray:
    
        if nodata is not None:
            data = np.ma.masked_equal(data, nodata)
        else:
            # Mask invalid values if no nodata value is defined
            data = np.ma.masked_invalid(data)
            data = np.ma.masked_where((data < -9999) | (data > 1e10), data)
        
        return data


class RasterRenderer:

    def __init__(self, config: MapConfig):
        self.config = config
    
    def render(self, raster_data: RasterData, cmap: ListedColormap, 
               norm: BoundaryNorm) -> Tuple[Image.Image, float, float]:
        img_width_px, img_height_px = self._calculate_dimensions(raster_data)
        

        fig, ax = plt.subplots(figsize=(img_width_px/self.config.dpi, 
                                        img_height_px/self.config.dpi), 
                               dpi=self.config.dpi)
        fig.patch.set_facecolor('white')
        ax.set_facecolor('white')
        

        ax.imshow(raster_data.data, cmap=cmap, norm=norm, 
                 aspect='equal', interpolation='nearest')
        ax.axis('off')
        plt.tight_layout(pad=0)
        
        buf = BytesIO()
        plt.savefig(buf, format='png', dpi=self.config.dpi, 
                   transparent=False, bbox_inches='tight', 
                   pad_inches=0, facecolor='white')
        plt.close(fig)
        
        buf.seek(0)
        img = Image.open(buf).convert("RGBA")
        
        actual_width = img_width_px * 72 / self.config.dpi
        actual_height = img_height_px * 72 / self.config.dpi
        
        return img, actual_width, actual_height
    
    def _calculate_dimensions(self, raster_data: RasterData) -> Tuple[int, int]:
        aspect_ratio = raster_data.aspect_ratio
        map_aspect = self.config.map_width / self.config.map_height
        
        if aspect_ratio > map_aspect:
            # Width is the limiting factor
            img_width_px = int(self.config.map_width / 72 * self.config.dpi)
            img_height_px = int(img_width_px / aspect_ratio)
        else:
            # Height is the limiting factor
            img_height_px = int(self.config.map_height / 72 * self.config.dpi)
            img_width_px = int(img_height_px * aspect_ratio)
        
        return img_width_px, img_height_px

class LogoDrawer:

    
    def __init__(self, logo_config: LogoConfig, page_width: float, page_height: float):
        self.logo_config = logo_config
        self.page_width = page_width
        self.page_height = page_height
    
    def draw(self, canvas_obj: canvas.Canvas):

        if self.logo_config.left_logo_path:
            self._draw_left_logo(canvas_obj)
        
        if self.logo_config.right_logo_path:
            self._draw_right_logo(canvas_obj)
    
    def _draw_left_logo(self, c: canvas.Canvas):

        if not os.path.exists(self.logo_config.left_logo_path):
            print(f"Warning: Left logo not found at {self.logo_config.left_logo_path}")
            return
        
        try:
            # Open image to get dimensions
            img = Image.open(self.logo_config.left_logo_path)
            img_width, img_height = img.size
            
            # Calculate width maintaining aspect ratio
            aspect_ratio = img_width / img_height
            logo_width = self.logo_config.logo_height * aspect_ratio
            
            # Position in top-left
            x = self.logo_config.logo_margin_side
            y = self.page_height - self.logo_config.logo_margin_top - self.logo_config.logo_height
            
            c.drawImage(self.logo_config.left_logo_path, x, y, 
                       width=logo_width, height=self.logo_config.logo_height,
                       preserveAspectRatio=True, mask='auto')
        except Exception as e:
            print(f"Error drawing left logo: {e}")
    
    def _draw_right_logo(self, c: canvas.Canvas):

        if not os.path.exists(self.logo_config.right_logo_path):
            print(f"Warning: Right logo not found at {self.logo_config.right_logo_path}")
            return
        
        try:
            # Open image to get dimensions
            img = Image.open(self.logo_config.right_logo_path)
            img_width, img_height = img.size
            
            # Calculate width maintaining aspect ratio
            aspect_ratio = img_width / img_height
            logo_width = self.logo_config.logo_height * aspect_ratio
            
            # Position in top-right
            x = self.page_width - self.logo_config.logo_margin_side - logo_width
            y = self.page_height - self.logo_config.logo_margin_top - self.logo_config.logo_height
            
            c.drawImage(self.logo_config.right_logo_path, x, y,
                       width=logo_width, height=self.logo_config.logo_height,
                       preserveAspectRatio=True, mask='auto')
        except Exception as e:
            print(f"Error drawing right logo: {e}")


class CompassRose:
    
    def __init__(self, x: float, y: float, radius: float = 45):
        self.x = x
        self.y = y
        self.radius = radius
    
    def draw(self, canvas_obj: canvas.Canvas):

        self._draw_circles(canvas_obj)
        self._draw_cardinal_directions(canvas_obj)
        self._draw_intermediate_directions(canvas_obj)
        self._draw_center_star(canvas_obj)
    
    def _draw_circles(self, c: canvas.Canvas):

        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(2)
        c.circle(self.x, self.y, self.radius, fill=0)
        
        c.setLineWidth(1)
        c.circle(self.x, self.y, self.radius * 0.2, fill=0)
    
    def _draw_cardinal_directions(self, c: canvas.Canvas):
        directions = [
            ('N', 0, True),
            ('E', 90, False),
            ('S', 180, True),
            ('W', 270, False)
        ]
        
        for label, angle, has_arrow in directions:
            rad = math.radians(angle)
            
            outer_x = self.x + self.radius * 0.85 * math.sin(rad)
            outer_y = self.y + self.radius * 0.85 * math.cos(rad)
            inner_x = self.x + self.radius * 0.25 * math.sin(rad)
            inner_y = self.y + self.radius * 0.25 * math.cos(rad)
            
            # Draw line
            if has_arrow:
                c.setLineWidth(3)
                c.setStrokeColorRGB(0, 0, 0)
            else:
                c.setLineWidth(1.5)
                c.setStrokeColorRGB(0.4, 0.4, 0.4)
            
            c.line(inner_x, inner_y, outer_x, outer_y)
            
            # Draw arrow heads
            if has_arrow:
                self._draw_arrow_head(c, rad)
            
            # Draw labels
            self._draw_label(c, label, rad, is_north=(label == 'N'))
    
    def _draw_arrow_head(self, c: canvas.Canvas, rad: float):
        c.setFillColorRGB(0, 0, 0)
        arrow_path = c.beginPath()
        
        arrow_tip_x = self.x + self.radius * 0.95 * math.sin(rad)
        arrow_tip_y = self.y + self.radius * 0.95 * math.cos(rad)
        
        left_rad = rad + math.radians(150)
        left_x = arrow_tip_x + 8 * math.sin(left_rad)
        left_y = arrow_tip_y + 8 * math.cos(left_rad)
        
        right_rad = rad - math.radians(150)
        right_x = arrow_tip_x + 8 * math.sin(right_rad)
        right_y = arrow_tip_y + 8 * math.cos(right_rad)
        
        arrow_path.moveTo(arrow_tip_x, arrow_tip_y)
        arrow_path.lineTo(left_x, left_y)
        arrow_path.lineTo(right_x, right_y)
        arrow_path.close()
        c.drawPath(arrow_path, fill=1, stroke=0)
    
    def _draw_label(self, c: canvas.Canvas, label: str, rad: float, is_north: bool):

        label_x = self.x + self.radius * 1.15 * math.sin(rad)
        label_y = self.y + self.radius * 1.15 * math.cos(rad)
        
        c.setFillColorRGB(0, 0, 0)
        font_name = "Helvetica-Bold" if is_north else "Helvetica"
        font_size = 14 if is_north else 11
        c.setFont(font_name, font_size)
        
        text_width = c.stringWidth(label, font_name, font_size)
        c.drawString(label_x - text_width/2, label_y - 4, label)
    
    def _draw_intermediate_directions(self, c: canvas.Canvas):
    
        intermediate_dirs = [
            ('NE', 45),
            ('SE', 135),
            ('SW', 225),
            ('NW', 315)
        ]
        
        c.setLineWidth(0.8)
        c.setStrokeColorRGB(0.6, 0.6, 0.6)
        
        for label, angle in intermediate_dirs:
            rad = math.radians(angle)
            
            inner_x = self.x + self.radius * 0.25 * math.sin(rad)
            inner_y = self.y + self.radius * 0.25 * math.cos(rad)
            outer_x = self.x + self.radius * 0.75 * math.sin(rad)
            outer_y = self.y + self.radius * 0.75 * math.cos(rad)
            
            c.line(inner_x, inner_y, outer_x, outer_y)
            
            # Labels
            label_x = self.x + self.radius * 1.2 * math.sin(rad)
            label_y = self.y + self.radius * 1.2 * math.cos(rad)
            
            c.setFont("Helvetica", 8)
            c.setFillColorRGB(0.3, 0.3, 0.3)
            text_width = c.stringWidth(label, "Helvetica", 8)
            c.drawString(label_x - text_width/2, label_y - 3, label)
    
    def _draw_center_star(self, c: canvas.Canvas):

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
    
    def __init__(self, x: float, y_start: float, box_size: int = 18, spacing: int = 25):
        self.x = x
        self.y_start = y_start
        self.box_size = box_size
        self.spacing = spacing
    
    def draw(self, canvas_obj: canvas.Canvas, legend_items: List[LegendItem]):
        legend_height = len(legend_items) * self.spacing + 50
        
        # Draw frame
        canvas_obj.setStrokeColorRGB(0.3, 0.3, 0.3)
        canvas_obj.setFillColorRGB(1, 1, 1)
        canvas_obj.roundRect(self.x - 10, self.y_start - legend_height + 10,
                            170, legend_height, 5, fill=1, stroke=1)
        
        # Draw title
        canvas_obj.setFillColorRGB(0, 0, 0)
        canvas_obj.setFont("Helvetica-Bold", 13)
        canvas_obj.drawString(self.x, self.y_start + 15, "Legend")
        canvas_obj.line(self.x, self.y_start, self.x + 140, self.y_start)
        
        # Draw legend items
        canvas_obj.setFont("Helvetica", 9)
        for i, item in enumerate(legend_items):
            self._draw_legend_item(canvas_obj, item, i)
    
    def _draw_legend_item(self, c: canvas.Canvas, item: LegendItem, index: int):
        y_pos = self.y_start - 20 - index * self.spacing
        
        # Convert hex color to RGB
        r = int(item.color[1:3], 16) / 255
        g = int(item.color[3:5], 16) / 255
        b = int(item.color[5:7], 16) / 255
        
        # Draw colored rectangle
        c.setFillColorRGB(r, g, b)
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(0.5)
        c.rect(self.x, y_pos, self.box_size, self.box_size, fill=1, stroke=1)
        
        # Draw label
        c.setFillColorRGB(0, 0, 0)
        c.drawString(self.x + self.box_size + 8, y_pos + 4, item.label)


class PDFMapComposer:
    
    def __init__(self, config: MapConfig,raster_name:str,ModuleName:str=None,logo_config: Optional[LogoConfig] = None):
        self.config = config
        self.title=ModuleName
        self.header=raster_name
        self.logo_config = logo_config  or LogoConfig()
    
    def compose(self, output_path: str, img: Image.Image, img_width: float, 
                img_height: float, raster_data: RasterData, 
                legend_items: List[LegendItem]):
        c = canvas.Canvas(output_path, pagesize=landscape(A4))
        
        # Draw background and map frame
        self._draw_background(c)
        self._draw_map_frame(c)
        
        # Draw raster image
        img_x, img_y = self._calculate_image_position(img_width, img_height)
        c.drawInlineImage(img, img_x, img_y, width=img_width, height=img_height)
        self._draw_logos(c)
        # Draw map elements
        self._draw_title(c)
        self._draw_compass(c)
        self._draw_legend(c, legend_items)
        self._draw_metadata(c, raster_data)
        self._draw_footer(c)
        
        c.showPage()
        c.save()
    def _draw_logos(self, c: canvas.Canvas):
        logo_drawer = LogoDrawer(self.logo_config, self.config.page_width, 
                                 self.config.page_height)
        logo_drawer.draw(c)

    def _draw_background(self, c: canvas.Canvas):
        c.setFillColorRGB(0.98, 0.98, 0.98)
        c.rect(0, 0, self.config.page_width, self.config.page_height, fill=1)
    
    def _draw_map_frame(self, c: canvas.Canvas):
        c.setStrokeColorRGB(0.2, 0.2, 0.2)
        c.setFillColorRGB(1, 1, 1)
        c.setLineWidth(2)
        c.rect(self.config.map_margin_left, self.config.map_margin_bottom,
               self.config.map_width, self.config.map_height, fill=1, stroke=1)
    
    def _calculate_image_position(self, img_width: float, img_height: float) -> Tuple[float, float]:
        img_x = self.config.map_margin_left + (self.config.map_width - img_width) / 2
        img_y = self.config.map_margin_bottom + (self.config.map_height - img_height) / 2
        return img_x, img_y
    
    def _draw_title(self, c: canvas.Canvas):
        c.setFillColorRGB(0, 0, 0)
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(self.config.page_width / 2, 
                           self.config.page_height - 50, 
                           self.title)
        
        c.setFont("Helvetica", 10)
        c.drawCentredString(self.config.page_width / 2,
                           self.config.page_height - 70,
                           self.header)
    
    def _draw_compass(self, c: canvas.Canvas):
        compass_x = 85
        compass_y = self.config.page_height - 160
        compass = CompassRose(compass_x, compass_y, radius=25)
        compass.draw(c)
    
    def _draw_legend(self, c: canvas.Canvas, legend_items: List[LegendItem]):
        legend_x = 30
        legend_y_start = self.config.page_height - 300
        legend = LegendDrawer(legend_x, legend_y_start)
        legend.draw(c, legend_items)
    
    def _draw_metadata(self, c: canvas.Canvas, raster_data: RasterData):

        meta_x = 30
        meta_y = 50
        
        c.setFont("Helvetica-Bold", 10)
        c.drawString(meta_x, meta_y + 20, "Map Information")
        
        c.setFont("Helvetica", 8)
        c.drawString(meta_x, meta_y, f"CRS: {raster_data.crs}")
        c.drawString(meta_x, meta_y - 15, 
                    f"Bounds: {raster_data.bounds.left:.2f}, {raster_data.bounds.bottom:.2f}")
    
    def _draw_footer(self, c: canvas.Canvas):
 
        c.setFont("Helvetica", 8)
        c.drawCentredString(self.config.page_width / 2, 20,
                           "© 2026 | SLCR IITBHU | Decision Support System Tool")


class GISMapGenerator:
    
    def __init__(self, raster_path: str, sld_path: str, output_path: str,raster_name:str,ModuleName:str =None,
                left_logo_path: Optional[str] = None, 
                right_logo_path: Optional[str] = None):
       
        self.raster_path = raster_path
        self.sld_path = sld_path
        self.output_path = output_path
        self.title=ModuleName
        self.header=raster_name
        # Initialize configuration
        page_width, page_height = landscape(A4)
        self.config = MapConfig(page_width, page_height)
        self.logo_config = LogoConfig(
            left_logo_path=left_logo_path,
            right_logo_path=right_logo_path
        )
    
    def generate(self):

        sld_parser = SLDParser(self.sld_path)
        legend_items = sld_parser.parse()
        cmap, norm = SLDParser.create_colormap(legend_items)

        raster_reader = RasterReader(self.raster_path)
        raster_data = raster_reader.read()

        renderer = RasterRenderer(self.config)
        img, img_width, img_height = renderer.render(raster_data, cmap, norm)
        
        composer = PDFMapComposer(self.config,self.title,self.header,self.logo_config)
        composer.compose(self.output_path, img, img_width, img_height, 
                        raster_data, legend_items)
        

   

class Raster_visual:
    @staticmethod
    def _raster_path(db,payload:RasterVisual):
        path =None
        if payload.moduleName=="Stp priority":
            path=Stp_service.get_priority_raster_path(db,payload.rasterName)
        elif payload.moduleName=="Stp suitability":
            path=Stp_service.get_suitability_raster_path(db,payload.rasterName)
        elif payload.moduleName=="Groundwater Potential Zone":
            path=Gwzp_service.get_raster_path(db,payload.rasterName)
        elif payload.moduleName=="Groundwater Pumping Location":
            path=GWPL_service.get_raster_path(db,payload.rasterName)
        elif payload.moduleName=="MAR Site Suitability":
            path=MARSuitability_svc.get_raster_path(db,payload.rasterName)
        else:
            return path
        return path
    @staticmethod
    def raster_down(db,payload:RasterVisual):
        path = Raster_visual._raster_path(db,payload)
        if path:
            path="/home/app/"+path.file_path
            return FileResponse(path=path, status_code=201, media_type="image/tiff")
        raise CustomException(status_code=401,detail="File not found")
    
    @staticmethod
    def raster_pdf(db,payload:RasterVisual):
        output_pdf = Path(Settings().TEMP_DIR,Unique_name.unique_name_with_ext("raster","pdf"))
        resp=Geoserver().raster_download(Settings().TEMP_DIR,payload.rasterName,"raster_visualization")
        generator = GISMapGenerator(resp["raster_path"], 
                                    resp["sld_path"], 
                                    str(output_pdf),
                                    payload.fileName,
                                    payload.moduleName,
                                    left_logo_path=f"{Settings().BASE_DIR}/media/images/iitbhu.png",
                                    right_logo_path=f"{Settings().BASE_DIR}/media/images/slcr.png",
                        )
        generator.generate()
        return FileResponse(path=output_pdf, status_code=201, media_type="application/pdf")

    @staticmethod
    def visual_raster(db):
        temp = Stp_service.get_priority_visual(db)
        temp2 = Stp_service.get_suitability_visual(db)
        temp3= Gwzp_service.get_GWA_Priority_visual(db)
        temp4 = GWPL_service.get_GWPL_visual(db)
        temp5=MARSuitability_svc.get_MAR_visual(db)
        resp = [
            {
                "module": "Stp priority",
                "category": False,
                "raster": [
                    {"file_name": i.file_name, "layer_name": i.layer_name}
                    for i in temp
                ]
            },
            {
                "module": "Stp suitability",
                "category": True,
                "raster": [
                    {
                        "file_name": i.file_name,
                        "layer_name": i.layer_name,
                        "category": i.raster_category
                    }
                    for i in temp2
                ]
            },
            {
                "module": "Groundwater Potential Zone",
                "category": False,
                "raster": [
                    {"file_name": i.file_name, "layer_name": i.layer_name}
                    for i in temp3
                ]
            },
            {
                "module": "Groundwater Pumping Location",
                "category": True,
                "raster": [
                    {
                        "file_name": i.file_name,
                        "layer_name": i.layer_name,
                        "category": i.raster_category
                    }
                    for i in temp4  # ← Use temp4 here, if intended
                ]
            },
            {
                "module": "MAR Site Suitability",
                "category": True,
                "raster": [
                    {
                        "file_name": i.file_name,
                        "layer_name": i.layer_name,
                        "category": i.raster_category
                    }
                    for i in temp5  # ← Use temp5 here
                ]
            }
        ]

        return resp
