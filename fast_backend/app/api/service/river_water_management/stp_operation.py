import os
import time
from typing import List, Tuple
import geopandas as gpd
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import  reproject
from rasterio.transform import from_origin
from rasterio.mask import mask
from shapely.geometry import mapping
import matplotlib.pyplot as plt
from tqdm import tqdm
from app.api.service.geoserver_svc.geoserver import Geoserver
from xml.dom import minidom
from xml.etree import ElementTree as ET
from app.utils.network_conf import GeoConfig
import uuid
from app.database.config.dependency import db_dependency
from pathlib import Path
from app.api.service.river_water_management.spt_service import Stp_service
from app.database.crud.stp_crud import STP_priority_crud, STP_suitability_crud
from app.conf.settings import Settings
import zipfile
import tempfile
import geopandas as gpd
import numpy as np
import pandas as pd
from rasterstats import zonal_stats
from rasterio.enums import Resampling
from app.database.crud.location_crud import Stp_towns_crud,Stp_drain_new_crud
from sqlalchemy.orm import Session
from rasterio.features import rasterize
import pandas as pd
from rasterstats import zonal_stats
from app.api.schema.stp_schema import  STPCatchmentOutput, STPCategory, STPsuitabilityInput
from scipy.ndimage import label
from app.utils.name import Unique_name
from shapely.ops import unary_union
from app.conf.redis.redis_async_manager import async_redis_manager

geo=Geoserver()

class VectorProcess(GeoConfig):
    def __init__(self):
        super().__init__()
        self.village = self._force_to_epsg(self.villages_shapefile)
        self.basin = self._force_to_epsg(self.basin_shapefile)
        self.catchment = self._force_to_epsg(self.cachement_shapefile)
        self.drain_cachement= self._force_to_epsg(self.drain_cachement_shapefile)
        self.town=self._force_to_epsg(self.town_shapefile)
        self.TEMP_DIR = Settings().TEMP_DIR
        
    def _force_to_epsg(self, gdf: str, epsg: str = "EPSG:32644") -> gpd.GeoDataFrame:
        gdf=gpd.read_file(gdf)
        if gdf.crs is None:
            gdf.set_crs(epsg, inplace=True)
            return gdf
        return gdf.to_crs(epsg)
    
    def get_village(self,clip:List[int]=None):
        return self.village[self.village['ID'].isin(clip)]
    
    def get_sub_village(self,clip:List[int]=None):
        return self.village[self.village['subdis_cod'].isin(clip)]
    
    def get_town(self,clip:List[int]=None):
        town_vector = self.town[self.town['ID'].isin(clip)].copy()
        if town_vector.empty:
            raise ValueError("No town polygon found for the provided clip ID(s)")
        buffer_map = {1: 35000, 2: 30000, 3: 25000, 4: 20000, 5: 10000}
        town_vector['buffer'] = town_vector['class'].map(buffer_map).fillna(5000)
        town_vector['buffered'] = town_vector.geometry.buffer(town_vector['buffer'])
        town_buffer = unary_union(town_vector['buffered'].tolist())
        town_buffer = town_buffer.buffer(0)
        if town_buffer.is_empty:
            raise ValueError("Final buffer is empty")
        return gpd.GeoDataFrame(geometry=[town_buffer], crs=self.town.crs)
        
    def get_drain(self,clip:List[int]=None):
        drain_vector = self.drain_cachement[self.drain_cachement['Drain_No'].isin(clip)].copy()
        if drain_vector.empty:
            raise ValueError("No town polygon found for the provided clip ID(s)")
        buffer_map = {1: 35000, 2: 30000, 3: 25000, 4: 20000, 5: 10000}
        drain_vector['buffer'] =drain_vector['class'].map(buffer_map).fillna(5000)
        town_poly = drain_vector.iloc[0].geometry
        cls = int(drain_vector.iloc[0]['class'])
        buf = buffer_map.get(cls, 5000)
        return town_poly.buffer(buf)
        
    def get_town_village(self,clip:List[int]=None):
        town_buff = self.get_town(clip)
        village = self.village.to_crs(town_buff.crs)
        village['geometry'] = village['geometry'].buffer(0)
        geom = town_buff.geometry.iloc[0]   
        resp = village[village.intersects(geom)].copy()
        return resp
    
    def get_town_buffer(self,clip:List[int]=None):
        buffered_geom = self.get_town(clip)
        buffered_gdf = gpd.GeoDataFrame(geometry=[buffered_geom], crs="EPSG:32644")
        if len(buffered_gdf) > 1:
            union_geom = buffered_gdf.geometry.union_all()
            buffered_gdf = gpd.GeoDataFrame(geometry=[union_geom], crs=buffered_gdf.crs)
        return buffered_gdf
    
    def get_drain_buffer(self,clip:List[int]=None):
        buffered_geom = self.get_drain(clip)
        buffered_gdf = gpd.GeoDataFrame(geometry=[buffered_geom], crs="EPSG:32644")
        if len(buffered_gdf) > 1:
            union_geom = buffered_gdf.geometry.union_all()
            buffered_gdf = gpd.GeoDataFrame(geometry=[union_geom], crs=buffered_gdf.crs)
        return buffered_gdf
            
    def get_basin(self):
        return self.basin
    async def _temporory_vector(self,vector_temp_file:gpd.GeoDataFrame):
        random_name = f"{uuid.uuid4().hex}"
        unique_village_zip = f"catchment_{random_name}.zip"
        output_zip_path = self.TEMP_DIR+"/"+ unique_village_zip
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_shp = Path(temp_dir) / f"catchment_{random_name}.shp"
            vector_temp_file.to_file(temp_shp, driver='ESRI Shapefile', engine='fiona')
            with zipfile.ZipFile(output_zip_path, 'w') as zipf:
                for file in temp_shp.parent.glob(f"catchment_{random_name}.*"):
                    zipf.write(file, file.name)

        name_only = os.path.splitext(os.path.basename(output_zip_path))[0]
        await geo.upload_vector("vector_work",str(output_zip_path),name_only)
        return name_only
    

class RasterProcess(VectorProcess):    
    def __init__(self, config: GeoConfig = GeoConfig()):
        super().__init__()
        self.output_dir=Path(config.output_path) / "SLD" 
        self.geoserver_url = config.geoserver_url
        self.username = config.username
        self.password = config.password
        self.geoserver_external_url = config.geoserver_external_url 
        self.raster_workspace="raster_work"
        self.raster_store="stp_raster_store"
        self.config = config
        self.aligned_arrays = []
        self.reference_profile = None
        os.makedirs(self.output_dir, exist_ok=True)
        
        
    def _calculate_common_extent(self, raster_paths: List[str]) -> Tuple[float, float, float, float, int, int]:
        all_bounds = []
        
        for path in raster_paths:
            with rasterio.open(path) as src:
                bounds = rasterio.warp.transform_bounds(
                    src.crs, self.config.target_crs, *src.bounds
                )
                all_bounds.append(bounds)
        
       
        minx = min(b[0] for b in all_bounds)
        miny = min(b[1] for b in all_bounds)
        maxx = max(b[2] for b in all_bounds)
        maxy = max(b[3] for b in all_bounds)
        
       
        width = int((maxx - minx) / self.config.target_resolution[0])
        height = int((maxy - miny) / self.config.target_resolution[1])
        
        return minx, miny, maxx, maxy, width, height
    
    def _normalize_array(self, array: np.ndarray) -> np.ndarray:
        array[array < 0] = 0
        min_val = np.nanmin(array)
        max_val = np.nanmax(array)
        norm_array = (array - min_val) / (max_val - min_val + 1e-6)
        return norm_array
    
    def align_rasters(self, raster_paths: List[str]) -> None:            
        minx, _, maxx, maxy, width, height = self._calculate_common_extent(raster_paths)
        transform = from_origin(minx, maxy, 
                               self.config.target_resolution[0], 
                               self.config.target_resolution[1])
        
 
        for path in tqdm(raster_paths, desc="Aligning rasters"):
            with rasterio.open(path) as src:
                dst_array = np.zeros((height, width), dtype=np.float32)
                reproject(
                    source=rasterio.band(src, 1),
                    destination=dst_array,
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=transform,
                    dst_crs=self.config.target_crs,
                    resampling=Resampling.bilinear
                )
                
                # Normalize
                norm_array = self._normalize_array(dst_array)
                self.aligned_arrays.append(norm_array)
                
                # Save reference profile from first raster
                if self.reference_profile is None:
                    self.reference_profile = src.meta.copy()
                    self.reference_profile.update({
                        "crs": self.config.target_crs,
                        "transform": transform,
                        "width": width,
                        "height": height,
                        "dtype": 'float32'
                    })
        
    def create_weighted_overlay(self, weights: List[float], output_name: str = "weighted_overlay.tif") -> str:
        
        if len(weights) != len(self.aligned_arrays):
            raise ValueError(f"Number of weights ({len(weights)}) must match number of rasters ({len(self.aligned_arrays)})")

        weighted_sum = self.aligned_arrays[0] * weights[0]
 
        for i in range(1, len(self.aligned_arrays)):
            weighted_sum += self.aligned_arrays[i] * weights[i]
    

        weighted_sum = np.nan_to_num(weighted_sum, nan=-9999.0)
        
        output_profile = self.reference_profile.copy()
        output_profile.update({
            'nodata': -9999,
            'dtype': 'float32'
        })
        
        return weighted_sum
    
    def apply_stp_constraint(self, weighted_sum: np.ndarray, constraint_path: str = None, 
                        output_name: str = "constrained_overlay.tif") -> str:
        constraint_path = self.config.constraint_raster_path if constraint_path is None else constraint_path
        constraint_aligned = np.zeros_like(weighted_sum, dtype=np.float32)
        
        with rasterio.open(constraint_path) as src:
            reproject(
                source=rasterio.band(src, 1),
                destination=constraint_aligned,
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=self.reference_profile['transform'],
                dst_crs=self.reference_profile['crs'],
                resampling=Resampling.nearest
            )
        

        constraint_mask = np.where(constraint_aligned >= 1, 1, 0).astype("float32")
        final_priority = weighted_sum * constraint_mask
        output_path = os.path.join(self.config.output_path, output_name)
        with rasterio.open(output_path, 'w', **self.reference_profile) as dst:
            dst.write(final_priority, 1)
        return output_path
    
    def apply_constraints_new(self, weighted_sum: np.ndarray, constraint_paths: List[str] = None,
                        output_name: str = "constrained_overlay.tif") -> str:
       
       
        if len(constraint_paths) == 0:
            final_priority = weighted_sum
        else:
            combined_constraint_mask = np.ones_like(weighted_sum, dtype=np.float32)

            for path in constraint_paths:
                constraint_aligned = np.zeros_like(weighted_sum, dtype=np.float32)
                with rasterio.open(path) as src:
                    reproject(
                        source=rasterio.band(src, 1),
                        destination=constraint_aligned,
                        src_transform=src.transform,
                        src_crs=src.crs,
                        dst_transform=self.reference_profile['transform'],
                        dst_crs=self.reference_profile['crs'],
                        resampling=Resampling.nearest
                    )

                constraint_mask = np.where(constraint_aligned >= 1, 1, 0).astype("float32")
                combined_constraint_mask *= constraint_mask

            final_priority = combined_constraint_mask*weighted_sum

        # Save constrained overlay
        output_path = os.path.join(self.config.output_path, output_name)
        with rasterio.open(output_path, 'w', **self.reference_profile) as dst:
            dst.write(final_priority, 1)

        return output_path, final_priority
    
    def _saveraster(self,out_image,output_path:str,out_meta:dict):
        with rasterio.open(output_path, "w", **out_meta) as dest:
            dest.write(out_image)
       
    def _generate_colors(self,num_classes, color_ramp='blue_to_red'):
        colors = []
        if color_ramp == 'blue_to_red':
            for i in range(num_classes):
                # Calculate interpolation factor (0 to 1)
                t = i / max(1, num_classes - 1)
                
                if t < 0.5:
                    # Blue to Green transition (first half)
                    r = int(0 + t * 2 * 255)  # 0 to 255
                    g = int(0 + t * 2 * 255)  # 0 to 255
                    b = 255                   # Stay at 255
                else:
                    # Green to Red transition (second half)
                    r = 255                               # Stay at 255
                    g = int(255 - (t - 0.5) * 2 * 255)    # 255 to 0
                    b = int(255 - (t - 0.5) * 2 * 255)    # 255 to 0
                    
                hex_color = f"#{r:02x}{g:02x}{b:02x}"
                colors.append(hex_color.upper())
        
        elif color_ramp == 'orange_to_green':
            rgb_colors = [
                (204, 0, 0),    # Red
                (255, 128, 0),  # Orange
                (255, 255, 0),  # Yellow
                (50, 205, 50),  # Parrot Green
                (0, 100, 0)     # Deep Green
            ]
            
            for rgb in rgb_colors:
                r, g, b = rgb
                hex_color = f"#{r:02x}{g:02x}{b:02x}"
                colors.append(hex_color.upper())

        elif color_ramp == 'greenTOred':
            for i in range(num_classes):
        # Calculate interpolation factor (0 to 1)
                t = i / max(1, num_classes - 1)

                r = int(t * 255)           # 0 to 255
                g = int(255 * (1 - t))     # 255 to 0
                b = 0                      # Always 0
                    
                hex_color = f"#{r:02x}{g:02x}{b:02x}"
                colors.append(hex_color.upper())
        elif color_ramp == 'viridis':
            # Approximation of viridis colormap
            viridis_anchors = [
                (68, 1, 84),    # Dark purple
                (59, 82, 139),   # Purple
                (33, 144, 140),  # Teal
                (93, 201, 99),   # Green
                (253, 231, 37)   # Yellow
            ]
            
            for i in range(num_classes):
                t = i / max(1, num_classes - 1)
                idx = min(int(t * (len(viridis_anchors) - 1)), len(viridis_anchors) - 2)
                interp = t * (len(viridis_anchors) - 1) - idx
                
                r = int(viridis_anchors[idx][0] * (1 - interp) + viridis_anchors[idx + 1][0] * interp)
                g = int(viridis_anchors[idx][1] * (1 - interp) + viridis_anchors[idx + 1][1] * interp)
                b = int(viridis_anchors[idx][2] * (1 - interp) + viridis_anchors[idx + 1][2] * interp)
                
                hex_color = f"#{r:02x}{g:02x}{b:02x}"
                colors.append(hex_color.upper())
        
        elif color_ramp == 'terrain':
            # Approximation of terrain colormap
            terrain_anchors = [
                (0, 0, 92),      # Dark blue
                (0, 128, 255),   # Light blue
                (0, 255, 128),   # Light green
                (255, 255, 0),   # Yellow
                (128, 64, 0),    # Brown
                (255, 255, 255)  # White
            ]
            
            for i in range(num_classes):
                t = i / max(1, num_classes - 1)
                idx = min(int(t * (len(terrain_anchors) - 1)), len(terrain_anchors) - 2)
                interp = t * (len(terrain_anchors) - 1) - idx
                
                r = int(terrain_anchors[idx][0] * (1 - interp) + terrain_anchors[idx + 1][0] * interp)
                g = int(terrain_anchors[idx][1] * (1 - interp) + terrain_anchors[idx + 1][1] * interp)
                b = int(terrain_anchors[idx][2] * (1 - interp) + terrain_anchors[idx + 1][2] * interp)
                
                hex_color = f"#{r:02x}{g:02x}{b:02x}"
                colors.append(hex_color.upper())
                
        elif color_ramp == 'spectral':
            # Approximation of spectral colormap (red to blue)
            spectral_anchors = [
                (213, 62, 79),    # Red
                (253, 174, 97),   # Orange
                (254, 224, 139),  # Yellow
                (230, 245, 152),  # Light yellow-green
                (171, 221, 164),  # Light green
                (102, 194, 165),  # Teal
                (50, 136, 189)    # Blue
            ]
            
            for i in range(num_classes):
                t = i / max(1, num_classes - 1)
                idx = min(int(t * (len(spectral_anchors) - 1)), len(spectral_anchors) - 2)
                interp = t * (len(spectral_anchors) - 1) - idx
                
                r = int(spectral_anchors[idx][0] * (1 - interp) + spectral_anchors[idx + 1][0] * interp)
                g = int(spectral_anchors[idx][1] * (1 - interp) + spectral_anchors[idx + 1][1] * interp)
                b = int(spectral_anchors[idx][2] * (1 - interp) + spectral_anchors[idx + 1][2] * interp)
                
                hex_color = f"#{r:02x}{g:02x}{b:02x}"
                colors.append(hex_color.upper())
        
        else:
            return self._generate_colors(num_classes, 'blue_to_red')
        return colors

    def _generate_sld_xml(self, intervals, colors):
       
        # Create the XML document with proper namespaces
        root = ET.Element("sld:StyledLayerDescriptor")
        root.set("xmlns:sld", "http://www.opengis.net/sld")
        root.set("xmlns", "http://www.opengis.net/sld")
        root.set("xmlns:gml", "http://www.opengis.net/gml")
        root.set("xmlns:ogc", "http://www.opengis.net/ogc")
        root.set("version", "1.0.0")
        
        # Create the named layer
        named_layer = ET.SubElement(root, "sld:NamedLayer")
        layer_name = ET.SubElement(named_layer, "sld:Name")
        layer_name.text = "raster"
        
        # Create the user style
        user_style = ET.SubElement(named_layer, "sld:UserStyle")
        style_name = ET.SubElement(user_style, "sld:Name")
        style_name.text = "raster"
        
        title = ET.SubElement(user_style, "sld:Title")
        title.text = f"{len(colors)}-Class Raster Style with Ranges"
        
        abstract = ET.SubElement(user_style, "sld:Abstract")
        abstract.text = "SLD with explicit value ranges for raster styling"
        
        # Create feature type style
        feature_type_style = ET.SubElement(user_style, "sld:FeatureTypeStyle")
        rule = ET.SubElement(feature_type_style, "sld:Rule")
        
        # Create raster symbolizer
        raster_symbolizer = ET.SubElement(rule, "sld:RasterSymbolizer")
        
        # Create color map - using type="ramp" as in the example
        color_map = ET.SubElement(raster_symbolizer, "sld:ColorMap",
                              type="ramp", extended="True")
        color_map.set("type", "ramp")
        
        # Define class labels
        level_class = ["  Very low", "  Low", "  Moderate", "  High", "  Very high"]
        
        # Add color map entries
        for i in range(len(intervals)-1):
            entry = ET.SubElement(color_map, "sld:ColorMapEntry")
            entry.set("color", colors[i])
            entry.set("quantity", str(intervals[i]))
            
            # Use level class labels if available, otherwise use a default
            if i < len(level_class):
                entry.set("label", level_class[i])
            else:
                entry.set("label", f"class_{i+1}")
        
        # Convert to string with pretty printing
        rough_string = ET.tostring(root, 'utf-8')
        reparsed = minidom.parseString(rough_string)
        pretty_xml = reparsed.toprettyxml(indent="  ")
        
        # Clean up the XML to match the sample exactly
        # Remove XML declaration and add a custom one
        xml_lines = pretty_xml.split('\n')
        xml_lines[0] = '<?xml version="1.0" encoding="UTF-8"?>'
        pretty_xml = '\n'.join(xml_lines)
        
        return pretty_xml

    def _generate_dynamic_sld(self,raster_path:str,num_classes:int,color_ramp:str='blue_to_red',reverse:bool=False):
        with rasterio.open(raster_path) as src:
            data = src.read(1, masked=True)
            valid_data = data[~data.mask]
            if len(valid_data) == 0:
                raise ValueError("Raster contains no valid data")
            min_val = float(np.min(valid_data))
            max_val = max(float(np.max(valid_data)), 1.0)

        if min_val == max_val:
            intervals = [min_val] * num_classes
        else:
            intervals = np.linspace(min_val, max_val, num_classes+1)
        colors = self._generate_colors(num_classes, color_ramp)

        if reverse:
            colors = colors[::-1]
       
        sld_content = self._generate_sld_xml(intervals, colors)
        unique_name = f"style_{uuid.uuid4().hex}.sld"
        output_sld_path = os.path.join(self.output_dir, unique_name)        
        with open(output_sld_path, 'w', encoding='utf-8') as f:
            f.write(sld_content)
        return output_sld_path
    
    def processRaster(self,file_path:str,reverse:bool=False):
        try:
            #sld_path=self._generate_dynamic_sld(raster_path=file_path,num_classes=5,color_ramp='viridis')
            #sld_path=self._generate_dynamic_sld(raster_path=file_path,num_classes=5,color_ramp='blue_to_red')
            sld_path=self._generate_dynamic_sld(raster_path=file_path,num_classes=5,color_ramp='orange_to_green',reverse=reverse)
            #sld_path=self._generate_dynamic_sld(raster_path=file_path,num_classes=5,color_ramp='spectral')
            #sld_path=self._generate_dynamic_sld(raster_path=file_path,num_classes=5,color_ramp='terrain') #terrain
            #sld_path=self._generate_dynamic_sld(raster_path=file_path,num_classes=5,color_ramp="greenTOred")
            sld_name = os.path.basename(sld_path).split('.')[0]
            return sld_path,sld_name
        except Exception as e:
            print("exceprion",e)
            return False
    
    def clip_to_basin(self, raster_path: str, shapefile_path: str = None, 
                     output_name: str = "clipped_priority_map.tif") -> str:
        
        basin = gpd.read_file(shapefile_path)
        if basin.crs is None:
            basin.set_crs("EPSG:32644", inplace=True,allow_override=True) 
        try:
            basin = basin.to_crs("EPSG:32644")
        except Exception as e:
            print(e)

        with rasterio.open(raster_path) as src:
            out_image, out_transform = mask(dataset=src, shapes=basin.geometry, crop=True)
            out_meta = src.meta.copy()
        
        
        out_meta.update({
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform
        })
        
        
        output_path = os.path.join(self.config.output_path, output_name)
        self._saveraster(out_image,output_path,out_meta)
        return output_path
   
    def clip_to_user_villages(self, raster_path: str,final_name:str,clip:List[int]=None,place:str=None  ) -> str:
        if place == "Drain":
            villages_vector=self.get_village(clip)
        else:
            villages_vector=self.get_sub_village(clip)
        with rasterio.open(raster_path) as src:
            out_image, out_transform = mask(dataset=src, shapes=villages_vector.geometry, crop=True)
            out_meta = src.meta.copy()
        out_meta.update({
            "driver": "GTiff",
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform
        })
        output_path = os.path.join(self.config.output_path, final_name)
        with rasterio.open(output_path, "w", **out_meta) as dest:
            dest.write(out_image)
        return output_path

    def clip_to_town_buffer(self, raster_path: str,clip:List[int]=None  ) -> str:
            buffered_gdf =self.get_town_village(clip)
            geometry_for_mask = [mapping(geom) for geom in buffered_gdf.geometry]
            with rasterio.open(raster_path) as src:
                out_image, out_transform = mask(dataset=src, shapes=geometry_for_mask, crop=True)
                out_meta = src.meta.copy()
            out_meta.update({
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform
            })
            output_name=Unique_name.unique_name_with_ext(raster_path.split('/')[-1].rsplit('.', 1)[0],"tif")
            output_path = os.path.join(self.config.output_path, output_name)
            self._saveraster(out_image,output_path,out_meta)
            return output_path
        
    def clip_to_drain_buffer(self, raster_path: str,clip:List[int]=None  ) -> str:
        try:
            buffered_gdf = self.get_drain_buffer(clip)
            geometry_for_mask = [mapping(geom) for geom in buffered_gdf.geometry]
            with rasterio.open(raster_path) as src:
                out_image, out_transform = mask(dataset=src, shapes=geometry_for_mask, crop=True)
                out_meta = src.meta.copy()
            out_meta.update({
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform
            })
            output_name=Unique_name.unique_name_with_ext(raster_path.split('/')[-1].rsplit('.', 1)[0],"tif")
            output_path = os.path.join(self.config.output_path, output_name)
            self._saveraster(out_image,output_path,out_meta)
            return output_path
        except Exception as e:
            print(e)
    
    def _get_table_data(self,villages_vector:gpd.GeoDataFrame, stats:list):
        class_labels = {
                1: 'Very_Low',
                2: 'Low',
                3: 'Medium',
                4: 'High',
                5: 'Very_High'
                }
        results = []
        for i, counts in enumerate(stats):
            shape_name = villages_vector.iloc[i]['Name']
            total_pixels = sum([v for k, v in counts.items() if k in class_labels])
            result = {'Village_Name': shape_name}
            for class_val, label in class_labels.items():
                pixel_count = counts.get(class_val, 0)
                percent = (pixel_count / total_pixels * 100) if total_pixels > 0 else 0
                result[label] = round(percent, 2)
            results.append(result)
        return results
    def _classify_risk(self,value):
        if pd.isna(value): return "No Data" 
        elif 0 <= value < 0.2: return "Very Low" 
        elif 0.2 <= value < 0.4: return "Low" 
        elif 0.4 <= value < 0.6: return "Medium" 
        elif 0.6 <= value < 0.8: return "High" 
        elif 0.8 <= value <= 1.0: return "Very High" 
        else: return "No Data"         
    def clip_details(
        self,
        raster_path: str,          
        priority_raster: str,    
        villages_vector: gpd.GeoDataFrame,
    ):
    
        with rasterio.open(raster_path) as src:
            raster = src.read(1, masked=True)
            affine = src.transform

            min_val = raster.min()
            max_val = raster.max()
            bins = np.linspace(min_val, max_val, 6)

            reclass_raster = np.digitize(raster, bins[1:-1]) + 1
            reclass_raster = np.where(raster.mask, 0, reclass_raster)

        stats = zonal_stats(
            vectors=villages_vector,
            raster=reclass_raster,
            affine=affine,
            nodata=0,
            categorical=True,
            geojson_out=False,
            all_touched=True
        )


        results = self._get_table_data(villages_vector, stats)


        with rasterio.open(priority_raster) as src2:
            raster2 = src2.read(1, masked=True)
            affine2 = src2.transform
            nodata2 = src2.nodata
            crs2 = src2.crs

        # Match CRS if needed
        if villages_vector.crs != crs2:
            villages_vector = villages_vector.to_crs(crs2)

        mean_stats = zonal_stats(
            villages_vector,
            raster2,
            affine=affine2,
            stats=["mean"],
            nodata=nodata2,
            all_touched=True
        )

        # =========================
        # 🔹 Merge Results
        # =========================
        safe_len = min(len(results), len(mean_stats))

        for i in range(safe_len):
            mean_val = mean_stats[i].get("mean") if mean_stats[i] else None

            results[i]["mean"] = round(mean_val, 4) if mean_val is not None else None
            results[i]["Risk Factor"] = self._classify_risk(mean_val)


        return results

      
    
    async def save_vector(self,vector,name:str):
       
        unique_village_zip = f"{name}.zip"
        output_zip_path = self.config.output_path / unique_village_zip

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_shp = Path(temp_dir) / f"{name}.shp"

            vector.to_file(temp_shp, driver='ESRI Shapefile', engine='fiona')
            
            # Create zip with all shapefile components
            with zipfile.ZipFile(output_zip_path, 'w') as zipf:
                for file in temp_shp.parent.glob(f"{name}.*"):
                    zipf.write(file, file.name)

        name_only = os.path.splitext(os.path.basename(output_zip_path))[0]
        await geo.upload_vector("vector_work",str(output_zip_path),name_only)
        return name_only

class STPPriorityMapper:
    def __init__(self, config: GeoConfig = None):
        self.config = config or GeoConfig()
        self.processor = RasterProcess(self.config)
        self.BASE_DIR=Settings().BASE_DIR
        self.TEMP_DIR=Settings().TEMP_DIR+"/STP_Priority"
        os.makedirs(self.TEMP_DIR, exist_ok=True)
    
    async def cachement_villages(self,drain_no:List[int]):        
        catchment_villages=self.processor.catchment
        villages=self.processor.village
        catchment_polygon = catchment_villages[catchment_villages["Drain_No"].isin(drain_no)].geometry.union_all()
        villages_intersect = villages[villages.intersects(catchment_polygon)]
        villages_intersect = villages_intersect[villages_intersect.geometry.is_valid]
        villages_intersect['geometry'] = villages_intersect.geometry.buffer(0)
        villages_intersect = villages_intersect.rename(columns={'ID': 'village_id'})
        temp_vill_name=Unique_name.unique_name("catch_vill")
        village_temp_path=os.path.join(self.TEMP_DIR,temp_vill_name+".shp")
        villages_intersect.to_file(village_temp_path, driver='ESRI Shapefile', engine='fiona')
        vector_name=await self.processor._temporory_vector(vector_temp_file=villages_intersect)
        await async_redis_manager.setex(vector_name, 10800, str(village_temp_path))
        data = [
            {
                "id": village_id,  # Now using village_id instead of ID
                "village_name": name,
                "area": geom.area
            }
            for _, (village_id, name, geom) in enumerate(zip(villages_intersect["village_id"], villages_intersect["Name"], villages_intersect.geometry))
        ]
        return STPCatchmentOutput(catchments=data,layer_name=vector_name)
    
    def _raster_polyon_color(self,raster_path:str,villages_vector:gpd.GeoDataFrame):
        with rasterio.open(raster_path) as src:
            raster_data = src.read(1)
            raster_meta = src.meta.copy()
            raster_transform = src.transform
            raster_crs = "EPSG:32644"
            raster_nodata = src.nodata
        stats = zonal_stats(villages_vector, raster_path, stats=["mean"], nodata=raster_nodata)
        villages_vector["mean_val"] = [item['mean'] for item in stats]
        shapes = ((geom, value) for geom, value in zip(villages_vector.geometry, villages_vector["mean_val"]))
        out_array = rasterize(
            shapes=shapes,
            out_shape=raster_data.shape,
            transform=raster_transform,
            fill=raster_nodata,
            dtype='float32'
        )

        raster_meta.update({
            "dtype": "float32",
            "nodata": raster_nodata
        })
        output_name=Unique_name.unique_name_with_ext("STP_Priority_final","tif")
        output_path = os.path.join(self.config.output_path, output_name)
        with rasterio.open(output_path, "w", **raster_meta) as dest:
            dest.write(out_array,1)
        return output_path
    
    
    async def _get_priority_vill(self,place:str,clip:list,layer_name:str)->Tuple[gpd.GeoDataFrame,str]:
        villages_vector=None
        if place == 'Drain':
            village_vector=await async_redis_manager.get(layer_name)
            village_vector=gpd.read_file(village_vector)
            villages_vector=village_vector[village_vector['village_id'].isin(clip)]
        else:
            villages_vector=self.processor.get_sub_village(clip)
        temp_vill_name=Unique_name.unique_name("priority_vill")
        pri_vill=os.path.join(self.TEMP_DIR,temp_vill_name)
        os.makedirs(pri_vill, exist_ok=True)
        village_temp_path=os.path.join(pri_vill,temp_vill_name+".shp")
        villages_vector.to_file(str(village_temp_path),driver="ESRI Shapefile")
        vector_name=await self.processor._temporory_vector(vector_temp_file=villages_vector)
        await async_redis_manager.setex(vector_name, 10800, str(village_temp_path))
        return villages_vector,vector_name
    
    def _cliping_raster(self,raster_path:str,final_name:str,clip:gpd.GeoDataFrame):
        with rasterio.open(raster_path) as src:
            out_image, out_transform = mask(dataset=src, shapes=clip.geometry, crop=True)
            out_meta = src.meta.copy()
        out_meta.update({
            "driver": "GTiff",
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform
        })
        output_path = os.path.join(self.config.output_path, final_name)
        with rasterio.open(output_path, "w", **out_meta) as dest:
            dest.write(out_image)
        return output_path
    
    def _get_operations_raster(self,db:db_dependency,payload:List):
        all_priority_raster=STP_priority_crud(db).get_raster_category(all_data=True)
        payload_dict = {r.id: r.weight for r in payload.data}
        condition_raster = [
            [os.path.join(self.BASE_DIR, raster.file_path), payload_dict[raster.id],raster.layer_name]
            for raster in all_priority_raster
            if raster.id in payload_dict
        ]
        return condition_raster
    
    def _get_raster_with_weight(self,db:db_dependency,payload:List):
        condition_raster=self._get_operations_raster(db,payload)
        raster_path=[]
        raster_weights=[]
        for i in condition_raster:
            raster_path.append(i[0])
            raster_weights.append(i[1])
        return raster_path,raster_weights
    
    def _get_overlay_raster(self,raster_path:List =None,raster_weights:List=None):
        self.processor.align_rasters(raster_path)
        overlay_name=Unique_name.unique_name_with_ext("overlay","tif")
        weighted_sum = self.processor.create_weighted_overlay(
                raster_weights, overlay_name
            )
        apply_stp_constraint_path = self.processor.apply_stp_constraint(weighted_sum, output_name="constrained_overlay.tif")
        final_name = Unique_name.unique_name_with_ext("stp_overlay_clip","tif")
        return self.processor.clip_to_basin(apply_stp_constraint_path,shapefile_path=self.config.basin_shapefile , output_name=final_name)
    
    async def visual_priority_map(self,db:db_dependency,clip:List[int]=None,place:str=None,layer_name:str=None) -> str:
        raster_path=Stp_service.get_priority_visual(db,all_data=True)
        raster_path = [{"file_name": i.file_name,
                        "path": os.path.abspath(Settings().BASE_DIR+"/"+i.file_path),
                        "sld_path": os.path.abspath(Settings().BASE_DIR+"/"+i.sld_path,)                                            
                        } for i in raster_path]
        response=[]
        village_vector,geo_vector_layer=await self._get_priority_vill(place,clip,layer_name)
        for i in raster_path:
            final_name=Unique_name.unique_name_with_ext(i['file_name'],"tif")
            final_path=self._cliping_raster(i['path'],final_name,village_vector)
            unique_store_name =Unique_name.unique_name(self.config.raster_store)
            _,layer_name=await geo.upload_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path)
            await geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=i['sld_path'], sld_name=layer_name)   
            response.append({
                "workspace": self.config.raster_workspace,
                "layer_name": layer_name,
                "file_name":i["file_name"],
            })
        return {
            "raster_layer":response,
            "vector_layer":geo_vector_layer
        }
    
    async def create_priority_map(self, db:db_dependency, payload:STPCategory,reverse:bool=False) -> str:
        raster_paths,raster_weights=self._get_raster_with_weight(db,payload)
        final_path=self._get_overlay_raster(raster_paths,raster_weights)
        final_name = Unique_name.unique_name_with_ext('STP_priority','tif') 
        sld_path,sld_name=RasterProcess().processRaster(final_path,reverse=True)
        village_vector=await async_redis_manager.get(payload.village_layer)
        village_vector=gpd.read_file(village_vector)
        final_path=self._cliping_raster(final_path,final_name,village_vector)
        final_path1=self._raster_polyon_color(raster_path=final_path,villages_vector=village_vector)
        csv_details=self.processor.clip_details(raster_path=final_path,priority_raster=final_path1,villages_vector=village_vector)
        unique_store_name =Unique_name.unique_name(self.config.raster_store)
        _,layer_name=await geo.upload_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path1)
        await geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=sld_path, sld_name=layer_name)
        return {
                "workspace": self.config.raster_workspace,
                "layer_name": layer_name,
                "csv_details":csv_details
            }

      
def _nearest_towns(centroid_lat: float, centroid_lon: float, n: int = 3) -> list:
    """Return the [lat, lon] of the n towns nearest to the given WGS84 centroid."""
    try:
        cfg = GeoConfig()
        towns = gpd.read_file(cfg.town_shapefile).to_crs("EPSG:4326")
        if towns.empty:
            return []
        from shapely.geometry import Point
        ref = Point(centroid_lon, centroid_lat)
        towns = towns.copy()
        towns["_dist"] = towns.geometry.distance(ref)
        nearest = towns.nsmallest(n, "_dist")
        return [[row.geometry.y, row.geometry.x] for row in nearest.itertuples()]
    except Exception as e:
        print(f"[_nearest_towns] failed: {e}", flush=True)
        return []


class STPsuitabilityMapper:
    def __init__(self, config: GeoConfig = None):
        self.config = config or GeoConfig()
        self.processor = RasterProcess(self.config)
        self.BASE_DIR=Settings().BASE_DIR
        self.TEMP_DIR=Settings().TEMP_DIR+"/STP_suitability"
        os.makedirs(self.TEMP_DIR, exist_ok=True)
    
    async def cachement_villages(self,db:Session,drain_no:List[int]):
        catchment_buffer = self.processor.get_drain_buffer(clip=drain_no).iloc[0].geometry
        villages_sindex = self.processor.village.sindex
        possible_matches_idx = list(villages_sindex.query(catchment_buffer, predicate="intersects"))
        villages = self.processor.village.iloc[possible_matches_idx]
        villages_intersect = villages[villages.geometry.intersects(catchment_buffer)].copy()
        villages_intersect = villages_intersect[villages_intersect.geometry.is_valid].copy()
        villages_intersect = villages_intersect.set_geometry(
            villages_intersect.geometry.buffer(0)
        )
        villages_intersect["geometry"] = villages_intersect.geometry.buffer(0)
        villages_intersect = villages_intersect.rename(columns={'ID': 'village_id'})
        
        temp_vill_name=Unique_name.unique_name("catch_vill")
        village_temp_path=os.path.join(self.TEMP_DIR,temp_vill_name+".shp")
        villages_intersect.to_file(village_temp_path, driver='ESRI Shapefile', engine='fiona')
        vector_name=await self._temporory_vector(vector_temp_file=villages_intersect)
        await async_redis_manager.setex(vector_name, 10800, str(village_temp_path))
        return STPCatchmentOutput(layer_name=vector_name)
        
    
    def temporary_raster(self,raster_path:str,elevation_value:float):
        with rasterio.open(raster_path) as src:
            raster_data = src.read()
            out_transform = src.transform
            out_meta = src.meta.copy()
            nodata_value = src.nodata
    

        processed_data = np.zeros_like(raster_data, dtype=np.float32)
        
        for band_idx in range(raster_data.shape[0]):
            band_data = raster_data[band_idx].astype(np.float32)
            
           
            if nodata_value is not None:
                valid_mask = band_data != nodata_value
            else:
                valid_mask = np.ones_like(band_data, dtype=bool)
            
            # Subtract elevation value only from valid pixels
            band_data[valid_mask] = elevation_value - band_data[valid_mask]
            
            # Normalize the valid data to 0-1 range
            if np.any(valid_mask):
                valid_data = band_data[valid_mask]
                min_val = np.min(valid_data)
                max_val = np.max(valid_data)
                
                # Avoid division by zero
                if max_val != min_val:
                    # Normalize to 0-1 range
                    band_data[valid_mask] = (valid_data - min_val) / (max_val - min_val)
                else:
                    # If all values are the same, set to 0
                    band_data[valid_mask] = 0.0
            
            # Set nodata pixels back to nodata value (or 0 if no nodata defined)
            if nodata_value is not None:
                band_data[~valid_mask] = 0.0  # Set invalid pixels to 0 after normalization
            
            processed_data[band_idx] = band_data
        
        # Update metadata for output
        out_meta.update({
            "driver": "GTiff",
            "height": processed_data.shape[1],
            "width": processed_data.shape[2],
            "transform": out_transform,
            "dtype": rasterio.float32,  # Use float32 for normalized data
            "nodata": 0.0 if nodata_value is not None else None
        })
        
        # Generate unique output filename
        output_name = f"{raster_path.split('/')[-1].rsplit('.', 1)[0]}_{uuid.uuid4().hex}.tif"
        output_path = os.path.join(self.config.output_path, output_name)
        
        self.processor._saveraster(processed_data,output_path,out_meta)
        return output_path

    async def _temporory_vector(self,vector_temp_file:gpd.GeoDataFrame):
        random_name = f"{uuid.uuid4().hex}"
        unique_village_zip = f"catchment_{random_name}.zip"
        output_zip_path = self.TEMP_DIR+"/"+ unique_village_zip
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_shp = Path(temp_dir) / f"catchment_{random_name}.shp"
            vector_temp_file.to_file(temp_shp, driver='ESRI Shapefile', engine='fiona')
            with zipfile.ZipFile(output_zip_path, 'w') as zipf:
                for file in temp_shp.parent.glob(f"catchment_{random_name}.*"):
                    zipf.write(file, file.name)

        name_only = os.path.splitext(os.path.basename(output_zip_path))[0]
        await geo.upload_vector("vector_work",str(output_zip_path),name_only)
        return name_only
    
    def _get_operations_raster(self,db:db_dependency,payload:List):
        all_suitability_raster=STP_suitability_crud(db).get_all(True)
        payload_dict = {r.id: r.weight for r in payload.data}
        condition_raster = [
            [os.path.join(self.BASE_DIR, raster.file_path), payload_dict[raster.id],raster.layer_name]
            for raster in all_suitability_raster
            if raster.raster_category == 'condition' and raster.id in payload_dict
        ]
        constraintion_raster=[
            os.path.join(self.BASE_DIR, raster.file_path)
            for raster in all_suitability_raster
            if raster.raster_category == 'constraint' and raster.id in payload_dict
        ]
        return condition_raster,constraintion_raster
    
    def _get_overlay_raster(self,raster_path:List =None,constraintion_raster:List=None,raster_weights:List=None):
        self.processor.align_rasters(raster_path)
        overlay_name=Unique_name.unique_name_with_ext("overlay","tif")
        weighted_sum = self.processor.create_weighted_overlay(
                raster_weights, overlay_name
            )
        constraint_name=Unique_name.unique_name_with_ext("constraint","tif")
        constrained_path, _ = self.processor.apply_constraints_new(
                weighted_sum, constraint_paths=constraintion_raster, output_name=constraint_name
            )
        final_name = Unique_name.unique_name_with_ext("stp_suitability","tif")
        return constrained_path ,self.processor.clip_to_basin(constrained_path,shapefile_path=self.config.basin_shapefile , output_name=final_name)

    def _cliping_raster(self,raster_path:str,final_name:str,clip:gpd.GeoDataFrame):
        with rasterio.open(raster_path) as src:
            out_image, out_transform = mask(dataset=src, shapes=clip.geometry, crop=True)
            out_meta = src.meta.copy()
        out_meta.update({
            "driver": "GTiff",
            "height": out_image.shape[1],
            "width": out_image.shape[2],
            "transform": out_transform
        })
        output_path = os.path.join(self.config.output_path, final_name)
        with rasterio.open(output_path, "w", **out_meta) as dest:
            dest.write(out_image)
        return output_path
    
    def _town_to_villages(self,clip:List):
        selected_villages =self.processor.get_town_village(clip)
        vector_name=self._temporory_vector(vector_temp_file=selected_villages)
        return selected_villages['ID'].tolist(),vector_name
    
    async def _get_suitability_vill(self,place:str,clip:list,layer_name:str)->Tuple[gpd.GeoDataFrame,str]:
        villages_vector=None
        if place in ('Drain', 'Manual'):
            village_vector=await async_redis_manager.get(layer_name)
            village_vector=gpd.read_file(village_vector)
            return village_vector,layer_name
        villages_vector=self.processor.get_town_village(clip)
        temp_vill_name=Unique_name.unique_name("suit_vill")
        village_temp_path=os.path.join(self.TEMP_DIR,temp_vill_name+".shp")
        villages_vector.to_file(str(village_temp_path),driver="ESRI Shapefile")
        vector_name=await self._temporory_vector(vector_temp_file=villages_vector)
        await async_redis_manager.setex(vector_name, 10800, str(village_temp_path))
        return villages_vector,vector_name
    
    def _get_raster_with_weight(self,db:db_dependency,payload:List):
        condition_raster,constraintion_raster=self._get_operations_raster(db,payload)
        raster_path=[]
        raster_weights=[]
        if payload.place == "Drain":
            elevation_value=Stp_drain_new_crud(db).get_sum_elevation(payload.drain_clip)/len(payload.drain_clip)
        elif payload.place == "Manual":
            elevation_value = 5.0
        else:
            elevation_value=Stp_towns_crud(db).get_sum_elevation(payload.clip)/len(payload.clip)
        
        for i in condition_raster:
            if i[2] == 'STP_Elevation_Raster':
                elevation_path=self.temporary_raster(i[0],elevation_value)
                raster_path.append(elevation_path)
            else:
                raster_path.append(i[0])
            raster_weights.append(i[1])
        return raster_path,raster_weights,constraintion_raster
    
    async def _suitability_clip_details(self,raster_path:str,village_vector:gpd.GeoDataFrame):
        with rasterio.open(raster_path) as src:
            raster = src.read(1, masked=True)
            affine = src.transform

            # Compute equal interval breaks
            min_val = raster.min()
            max_val = raster.max()
            bins = np.linspace(min_val, max_val, 6)  # 5 classes = 6 edges

            # Reclassify raster into 1–5 classes
            reclass_raster = np.digitize(raster, bins[1:-1]) + 1  # bins[1:-1] excludes first & last edges
            reclass_raster = np.where(raster.mask, 0, reclass_raster) 
            

            stats = zonal_stats(
                vectors=village_vector,
                raster=reclass_raster,
                affine=affine,
                nodata=0,
                categorical=True,
                geojson_out=False 
            )
            results = self.processor._get_table_data(village_vector, stats)
            return results

    async def create_suitability_map(self,db:db_dependency,payload:STPsuitabilityInput,reverse:bool=False):
        raster_path,raster_weights,constraintion_raster=self._get_raster_with_weight(db,payload)
        _,final_path=self._get_overlay_raster(raster_path,constraintion_raster,raster_weights)
        final_name = Unique_name.unique_name_with_ext('STP_suitability','tif') 
        final_path="/home/app/temp/STP.tif"
        sld_path,sld_name=RasterProcess().processRaster(final_path,reverse=reverse)
        village_vector=await async_redis_manager.get(payload.village_layer)
        village_vector=gpd.read_file(village_vector)
        final_path=self._cliping_raster(final_path,final_name,village_vector)
        csv_details=self.processor.clip_details(raster_path=final_path,priority_raster=final_path,villages_vector=village_vector)
        unique_store_name =Unique_name.unique_name(self.config.raster_store)
        _,layer_name=await geo.upload_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path)
        await geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=sld_path, sld_name=layer_name)
        await async_redis_manager.setex(layer_name, 10800, str(final_path))
        return {
                "workspace": self.config.raster_workspace,
                "layer_name": layer_name,
                "csv_details":csv_details
            }

    async def confirm_manual_area(self, geometry_geojson: dict) -> dict:
        """Parse an input GeoJSON geometry, create a 5 km buffer, find villages in buffer,
        upload both the village buffer layer and the drawn polygon (cluster) layer to GeoServer.
        Returns vector_name (villages in buffer), polygon_layer (drawn polygon as cluster),
        centroid, and buffer bbox for frontend WFS filtering."""
        from shapely.geometry import shape
        from pyproj import Transformer
        import geopandas as gpd_local

        geom_wgs84 = shape(geometry_geojson)
        centroid_wgs84 = geom_wgs84.centroid
        centroid_lat = centroid_wgs84.y
        centroid_lon = centroid_wgs84.x

        # Project polygon to metric CRS (EPSG:32644) using GeoDataFrame to avoid
        # shapely.ops.transform coordinate-order ambiguity with pyproj >= 2.2
        poly_gdf = gpd_local.GeoDataFrame(geometry=[geom_wgs84], crs="EPSG:4326")
        poly_projected = poly_gdf.to_crs("EPSG:32644")
        geom_projected = poly_projected.geometry.iloc[0]

        # 5 km buffer around drawn polygon in projected CRS (metres)
        buffer_projected = geom_projected.buffer(5000)

        # Villages from local shapefile that intersect the buffer
        village = self.processor.village  # already in EPSG:32644
        villages_intersect = village[village.geometry.intersects(buffer_projected)].copy()

        # Fallback: try WGS84 intersection
        if villages_intersect.empty:
            buf_gdf = gpd_local.GeoDataFrame(geometry=[buffer_projected], crs="EPSG:32644")
            buf_wgs84_geom = buf_gdf.to_crs("EPSG:4326").geometry.iloc[0]
            village_wgs84 = village.to_crs("EPSG:4326")
            villages_intersect = village_wgs84[village_wgs84.geometry.intersects(buf_wgs84_geom)].copy()
            if not villages_intersect.empty:
                villages_intersect = villages_intersect.to_crs("EPSG:32644")

        # If still empty (outside shapefile coverage), use buffer polygon as placeholder
        if villages_intersect.empty:
            villages_intersect = gpd_local.GeoDataFrame(geometry=[buffer_projected], crs="EPSG:32644")
        else:
            villages_intersect = villages_intersect[villages_intersect.geometry.is_valid].copy()
            villages_intersect["geometry"] = villages_intersect.geometry.buffer(0)
            if "ID" in villages_intersect.columns:
                villages_intersect = villages_intersect.rename(columns={"ID": "village_id"})

        # Upload village layer (buffer area villages) to GeoServer
        temp_vill_name = Unique_name.unique_name("manual_vill")
        village_temp_path = os.path.join(self.TEMP_DIR, temp_vill_name + ".shp")
        villages_intersect.to_file(str(village_temp_path), driver="ESRI Shapefile")
        vector_name = await self._temporory_vector(vector_temp_file=villages_intersect)
        await async_redis_manager.setex(vector_name, 10800, str(village_temp_path))

        # Upload drawn polygon to GeoServer as the STP cluster layer
        polygon_gdf = gpd_local.GeoDataFrame({"geometry": [geom_projected], "label": ["Selected STP Area"]}, crs="EPSG:32644")
        polygon_layer = await self._temporory_vector(vector_temp_file=polygon_gdf)

        # Buffer bbox in WGS84 for frontend map zoom
        buf_bbox_gdf = gpd_local.GeoDataFrame(geometry=[buffer_projected], crs="EPSG:32644")
        buf_bbox_wgs84 = buf_bbox_gdf.to_crs("EPSG:4326").geometry.iloc[0]
        minx, miny, maxx, maxy = buf_bbox_wgs84.bounds
        print(f"[confirm_manual_area] centroid=({centroid_lat:.4f},{centroid_lon:.4f}) buffer_bbox=[{minx:.4f},{miny:.4f},{maxx:.4f},{maxy:.4f}]", flush=True)

        return {
            "vector_name": vector_name,
            "polygon_layer": polygon_layer,
            "centroid_lat": centroid_lat,
            "centroid_lon": centroid_lon,
            "buffer_bbox": [minx, miny, maxx, maxy],
        }

    async def create_manual_suitability_raster(self, vector_layer_name: str) -> str:
        """Convert the manual area vector (stored in Redis) into a binary suitability raster.
        Every pixel inside the polygon = 1.0 (fully suitable), outside = NaN.
        Stores the raster path in Redis and returns the key."""
        from rasterio.features import rasterize as rio_rasterize
        from shapely.geometry import mapping

        village_path = await async_redis_manager.get(vector_layer_name)
        area_gdf = gpd.read_file(village_path).to_crs("EPSG:32644")

        # Use the constraint raster as the grid reference (same CRS, same resolution)
        ref_raster_path = str(self.config.constraint_raster_path)
        with rasterio.open(ref_raster_path) as ref:
            ref_transform = ref.transform
            ref_crs = ref.crs
            ref_width = ref.width
            ref_height = ref.height
            ref_meta = ref.meta.copy()

        # Rasterize: value 1 inside the area, 0 outside
        shapes_iter = ((mapping(geom), 1) for geom in area_gdf.geometry if geom is not None)
        burned = rio_rasterize(
            shapes=shapes_iter,
            out_shape=(ref_height, ref_width),
            transform=ref_transform,
            fill=0,
            dtype=np.float32,
        )

        # Mask pixels outside area to NaN so the cluster finder skips them
        burned = np.where(burned == 1, 1.0, np.nan).astype(np.float32)

        output_name = Unique_name.unique_name_with_ext("manual_suitability", "tif")
        output_path = os.path.join(self.config.output_path, output_name)
        ref_meta.update({
            "driver": "GTiff",
            "dtype": "float32",
            "nodata": np.nan,
            "count": 1,
            "crs": ref_crs,
            "transform": ref_transform,
            "width": ref_width,
            "height": ref_height,
        })
        with rasterio.open(output_path, "w", **ref_meta) as dst:
            dst.write(burned, 1)

        raster_key = Unique_name.unique_name("manual_raster")
        await async_redis_manager.setex(raster_key, 10800, str(output_path))
        return raster_key

    async def find_manual_path(self, polygon_geojson: dict | None, polygon_layer: str | None, location: list, drain_points: list | None = None, cluster_layer: str | None = None, buffer_bbox: list | None = None) -> dict:
        """Find road network path: source = cluster centroid (if cluster_layer given) or polygon centroid, destination = nearest drain via road network."""
        print(f"[find_manual_path] buffer_bbox={buffer_bbox}, drain_count={len(drain_points) if drain_points else 0}", flush=True)
        import asyncio
        from shapely.geometry import shape
        import geopandas as gpd_local
        from app.api.service.celery.stp_area.stp_area import STP_Area
        import aiohttp
        from app.utils.network_conf import GeoConfig

        async def _fetch_layer_geom(layer_name: str):
            cfg = GeoConfig()
            wfs_url = (
                f"{cfg.geoserver_url}/wfs?service=WFS&version=2.0.0&request=GetFeature"
                f"&typeName=vector_work:{layer_name}&outputFormat=application/json&srsname=EPSG:4326"
            )
            async with aiohttp.ClientSession() as session:
                async with session.get(wfs_url, auth=aiohttp.BasicAuth(cfg.username, cfg.password)) as resp:
                    fc = await resp.json(content_type=None)
            features = fc.get("features", [])
            from shapely.ops import unary_union
            geoms = [shape(f["geometry"]) for f in features if f.get("geometry")]
            return unary_union(geoms) if geoms else None

        # If cluster_layer provided, use cluster centroid as source (path from cluster → drains)
        if cluster_layer is not None:
            cluster_geom = await _fetch_layer_geom(cluster_layer)
            if cluster_geom is None:
                return {"suitable_path": None}
            # Use centroid of best cluster (first polygon if multi)
            if cluster_geom.geom_type in ("MultiPolygon", "GeometryCollection"):
                geom = max(cluster_geom.geoms, key=lambda g: g.area)
            else:
                geom = cluster_geom
        elif polygon_geojson is not None:
            geom = shape(polygon_geojson)
        elif polygon_layer is not None:
            geom = await _fetch_layer_geom(polygon_layer)
            if geom is None:
                return {"suitable_path": None}
        else:
            return {"suitable_path": None}

        poly_gdf = gpd_local.GeoDataFrame(
            {"cluster_id": [0], "area_ha": [geom.area / 10_000]},
            geometry=[geom],
            crs="EPSG:4326",
        )
        poly_projected = poly_gdf.to_crs("EPSG:32644")
        crs = str(poly_projected.crs)

        # SOURCE = centroid of the drawn polygon (projected)
        centroid_projected = poly_projected.geometry.iloc[0].centroid
        src_point = (centroid_projected.x, centroid_projected.y)

        # DESTINATION = nearest drain point via road network
        # drain_points are [{"Drain_No", "latitude", "longitude"}] in WGS84
        if not drain_points:
            print("[find_manual_path] no drain points provided — cannot find path", flush=True)
            return {"suitable_path": None}

        # Use buffer_bbox (the tight bbox of this polygon's 5km buffer, passed from frontend)
        # to strictly filter drains and road nodes to this polygon's local area only.
        # This prevents cross-polygon routing when multiple polygons are processed.
        if buffer_bbox and len(buffer_bbox) == 4:
            bb_minlon, bb_minlat, bb_maxlon, bb_maxlat = buffer_bbox
            active_drains = [
                dp for dp in drain_points
                if bb_minlat <= dp["latitude"] <= bb_maxlat and bb_minlon <= dp["longitude"] <= bb_maxlon
            ]
            if not active_drains:
                active_drains = drain_points
            print(f"[find_manual_path] bbox drain filter: {len(drain_points)} → {len(active_drains)} (bbox lon=[{bb_minlon:.3f},{bb_maxlon:.3f}] lat=[{bb_minlat:.3f},{bb_maxlat:.3f}])", flush=True)
        else:
            active_drains = drain_points

        from pyproj import Transformer
        transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)

        # Project bbox corners to metric CRS for road graph clipping
        if buffer_bbox and len(buffer_bbox) == 4:
            bb_minlon, bb_minlat, bb_maxlon, bb_maxlat = buffer_bbox
            _tr = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
            bbox_minx_m, bbox_miny_m = _tr.transform(bb_minlon, bb_minlat)
            bbox_maxx_m, bbox_maxy_m = _tr.transform(bb_maxlon, bb_maxlat)
        else:
            bbox_minx_m = bbox_miny_m = bbox_maxx_m = bbox_maxy_m = None

        drain_projected = [
            (transformer.transform(dp["longitude"], dp["latitude"]), dp["Drain_No"], dp.get("Elevation", 0))
            for dp in active_drains
        ]

        stp_areas = STP_Area()
        print(f"[find_manual_path] crs={crs}, src={src_point}, drains={len(drain_projected)}", flush=True)

        def _find_paths_to_all_drains():
            import numpy as np
            import networkx as nx
            from shapely.geometry import LineString, MultiLineString
            from shapely.ops import unary_union as _unary_union
            G = stp_areas._build_graph(crs)
            if not G.nodes:
                return None, []

            # Clip road graph to this polygon's buffer bbox + 2 km padding (in projected metres).
            # bbox_minx_m etc. are computed from buffer_bbox above and are tight to this polygon only.
            if bbox_minx_m is not None:
                pad = 2000  # 2 km padding so road nodes just outside the bbox edge are reachable
                local_nodes = {
                    n for n in G.nodes
                    if bbox_minx_m - pad <= n[0] <= bbox_maxx_m + pad
                    and bbox_miny_m - pad <= n[1] <= bbox_maxy_m + pad
                }
                print(f"[find_manual_path] road clip: {len(G.nodes)} → {len(local_nodes)} nodes (bbox_m=[{bbox_minx_m:.0f},{bbox_miny_m:.0f},{bbox_maxx_m:.0f},{bbox_maxy_m:.0f}])", flush=True)
                G = G.subgraph(local_nodes).copy()
                if not G.nodes:
                    return None, []

            node_list = list(G.nodes)
            nodes = np.array(node_list)
            src_arr = np.array(src_point)

            # Nearest road node to polygon centroid (source)
            src_node = node_list[int(np.argmin(np.linalg.norm(nodes - src_arr, axis=1)))]

            all_lines = []
            drain_road_distances = []

            for (dx, dy), drain_no, elevation in drain_projected:
                tgt_arr = np.array([dx, dy])
                tgt_node = node_list[int(np.argmin(np.linalg.norm(nodes - tgt_arr, axis=1)))]

                if src_node == tgt_node:
                    drain_road_distances.append({"Drain_No": drain_no, "distance_m": 0.0, "elevation": elevation})
                    continue
                try:
                    path_nodes = nx.shortest_path(G, src_node, tgt_node, weight="weight")
                    road_dist = nx.shortest_path_length(G, src_node, tgt_node, weight="weight")
                except Exception:
                    drain_road_distances.append({"Drain_No": drain_no, "distance_m": round(float(np.linalg.norm(src_arr - tgt_arr)), 1), "elevation": elevation})
                    continue

                drain_road_distances.append({"Drain_No": drain_no, "distance_m": round(float(road_dist), 1), "elevation": elevation})

                road_coords = list(path_nodes)

                # Prepend actual centroid only if it is close to the first road node (within 5 km)
                first_node = np.array(road_coords[0])
                src_np = np.array(src_point)
                if np.linalg.norm(first_node - src_np) < 5000 and road_coords[0] != src_point:
                    road_coords = [src_point] + road_coords

                # Append actual drain coordinate only if it is close to the last road node (within 5 km).
                # Without this guard, a straight line would be drawn from the nearest in-bbox road node
                # all the way to a drain that may be in a completely different area.
                last_node = np.array(road_coords[-1])
                drain_arr = np.array([dx, dy])
                if np.linalg.norm(last_node - drain_arr) < 5000 and road_coords[-1] != (dx, dy):
                    road_coords = road_coords + [(dx, dy)]

                all_lines.append(LineString(road_coords))

            if not all_lines:
                return None, drain_road_distances

            import geopandas as _gpd
            combined = _unary_union(all_lines)
            return _gpd.GeoDataFrame(geometry=[combined], crs=crs), drain_road_distances

        road_path, drain_road_distances = await asyncio.get_event_loop().run_in_executor(None, _find_paths_to_all_drains)
        print(f"[find_manual_path] road_path={'found' if road_path is not None else None}", flush=True)

        road_path_layer = None
        if road_path is not None and not road_path.empty:
            road_path_name = Unique_name.unique_name("road_path")
            # _temporory_vector uses asyncio.run() which fails inside a running event loop.
            # Write the zip manually and upload async instead.
            import tempfile as _tempfile
            import zipfile as _zipfile
            from pathlib import Path as _Path
            output_zip_path = os.path.join(stp_areas.TEMP_DIR, f"{road_path_name}.zip")
            with _tempfile.TemporaryDirectory() as tmp_dir:
                tmp_shp = _Path(tmp_dir) / f"{road_path_name}.shp"
                road_path.to_file(tmp_shp, driver="ESRI Shapefile", engine="fiona")
                with _zipfile.ZipFile(output_zip_path, "w") as zf:
                    for f in _Path(tmp_dir).glob(f"{road_path_name}.*"):
                        zf.write(f, f.name)
            await geo.upload_vector("vector_work", output_zip_path, road_path_name)
            road_path_layer = road_path_name

        # Build cluster_distances entry for the drawn polygon (rank=1, area from projected polygon)
        polygon_area_ha = round(float(poly_projected.geometry.iloc[0].area) / 10_000, 4)
        cluster_distances_result = [
            {
                "cluster_rank": 1,
                "area_ha": polygon_area_ha,
                "dist_to_polygon_m": 0.0,
                "drains": drain_road_distances,
            }
        ] if drain_road_distances else None

        return {"suitable_path": road_path_layer, "cluster_distances": cluster_distances_result}

    async def check_constraints(self, polygon_geojson: dict, db: Session) -> dict:
        """Check which constraint rasters have non-zero pixels inside the drawn polygon.
        Returns constraint_violations (list of file_name strings) and can_proceed (bool)."""
        import asyncio
        from shapely.geometry import shape
        from rasterio.mask import mask as rasterio_mask
        from rasterio.warp import transform_geom
        import numpy as np

        polygon_geom = shape(polygon_geojson)

        constraint_rows = STP_suitability_crud(db).get_suitability_category("constraint", all_data=True)

        violations: list[str] = []

        def _check_one(file_path: str, file_name: str) -> str | None:
            try:
                with rasterio.open(file_path) as src:
                    # Reproject polygon to raster CRS
                    poly_reproj = transform_geom("EPSG:4326", src.crs, polygon_geojson)
                    from shapely.geometry import shape as _shape, box
                    poly_geom_reproj = _shape(poly_reproj)

                    # Skip if polygon doesn't overlap this raster at all
                    raster_box = box(*src.bounds)
                    if not poly_geom_reproj.intersects(raster_box):
                        return None

                    # filled=False gives a numpy masked array:
                    # mask=True means outside polygon (invalid) — we only check valid pixels
                    out_image, _ = rasterio_mask(src, [poly_reproj], crop=True, filled=False)
                    band = out_image[0]  # masked array, shape (H, W)

                    # Constraint raster encoding:
                    #   0 = constraint PRESENT (green in viewer) → violation
                    #   1 = constraint absent  (pink in viewer)  → safe
                    # Only look at pixels inside the polygon (mask==False means valid)
                    valid_pixels = band.data[~band.mask]
                    if valid_pixels.size == 0:
                        return None

                    # Violation if ANY inside-polygon pixel == 0
                    if np.any(valid_pixels == 0):
                        return file_name
            except Exception as e:
                print(f"[check_constraints] error on {file_name}: {e}", flush=True)
            return None

        loop = asyncio.get_event_loop()
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            tasks = [
                loop.run_in_executor(pool, _check_one, row.file_path, row.file_name)
                for row in constraint_rows
            ]
            results = await asyncio.gather(*tasks)

        violations = [r for r in results if r is not None]
        return {"constraint_violations": violations, "can_proceed": len(violations) == 0}

    async def visual_sutabilty_map(self,db:db_dependency,clip:List[int]=None,place:str=None,layer_name:str=None) -> str:
        raster_path=Stp_service.get_suitability_visual(db,all_data=True)
        raster_path = [{"file_name": i.file_name,
                        "path": os.path.abspath(Settings().BASE_DIR+"/"+i.file_path),
                        "sld_path": os.path.abspath(Settings().BASE_DIR+"/"+i.sld_path,)                                            
                        } for i in raster_path]
        response=[]
        village_vector,geo_vector_layer=await self._get_suitability_vill(place,clip,layer_name)
        for i in raster_path:
            final_name=Unique_name.unique_name_with_ext(i['file_name'],"tif")
            final_path=self._cliping_raster(i['path'],final_name,village_vector)
            unique_store_name =Unique_name.unique_name(self.config.raster_store)
            _,layer_name=await geo.upload_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path)
            await geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=i['sld_path'], sld_name=layer_name)   
            response.append({
                "workspace": self.config.raster_workspace,
                "layer_name": layer_name,
                "file_name":i["file_name"],
            })
        return {
            "raster_layer":response,
            "vector_layer":geo_vector_layer
        }
     
