from app.api.schema.wqi import Well_input,Well_response
from typing import List,Tuple
from sqlalchemy.orm import session
from app.database.crud.gwpz_crud import WQI,WQI_threshold
import os
from tqdm import tqdm
import zipfile
from xml.dom import minidom
from xml.etree import ElementTree as ET
import numpy as np
import pandas as pd
import rasterio
from rasterio.warp import  reproject
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.mask import mask
from rasterio.features import shapes
from shapely.geometry import mapping,shape
from scipy.spatial import cKDTree
import geopandas as gpd
from app.utils.network_conf import GeoConfig
import uuid
from app.api.service.geoserver import Geoserver
from app.conf.settings import Settings
from pathlib import Path
from app.utils.name import Unique_name
from fastapi import HTTPException,status
from rasterio.warp import calculate_default_transform, reproject, Resampling
from app.api.service.script_svc.geoserver_svc import upload_shapefile
from rasterstats import zonal_stats
import tempfile


geo=Geoserver()

class VectorProcess(GeoConfig):
    def __init__(self):
        super().__init__()
        self.village = self._force_to_epsg(self.villages_shapefile)
        self.basin = self._force_to_epsg(self.basin_shapefile)
        self.catchment = self._force_to_epsg(self.cachement_shapefile)
        self.drain_cachement= self._force_to_epsg(self.drain_cachement_shapefile)
        self.town=self._force_to_epsg(self.town_shapefile)
        
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
        town_poly = town_vector.iloc[0].geometry
        cls = int(town_vector.iloc[0]['class'])
        buf = buffer_map.get(cls, 5000)
        return town_poly.buffer(buf)
        
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
        return self.village[self.village.intersects(town_buff)].copy()
        
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
    
    def apply_constraint(self, weighted_sum: np.ndarray, constraint_path: str = None, 
                        output_name: str = "constrained_overlay.tif") -> str:
        constraint_path = constraint_path or self.config.constraint_raster_path
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
        
       
        return output_path, final_priority
    
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
        try:
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
        except Exception as e:
            print(e)
        
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
                    
    def clip_details(self, raster_path: str,clip:List[int]=None,place:str=None,logic:str=None):
        if logic is None:
            return None
        try:
            villages_path = os.path.join(self.config.base_dir, 'media', 'Rajat_data', 'shape_stp', 'villages', 'STP_Village.shp')
            villages_vector = gpd.read_file(villages_path)
            if villages_vector.crs is None:
                villages_vector.set_crs("EPSG:32644", inplace=True,allow_override=True) 
            villages_vector=villages_vector.to_crs("EPSG:32644")
            if logic == "priority":   # priority
                if place == "Drain":
                    villages_vector=villages_vector[villages_vector['ID'].isin(clip)]
                else:
                    villages_vector=villages_vector[villages_vector['subdis_cod'].isin(clip)]
            else:
                if place == "Admin":
                    villages_vector=villages_vector[villages_vector['ID'].isin(clip)]
                pass
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
                    vectors=villages_vector,
                    raster=reclass_raster,
                    affine=affine,
                    nodata=0,
                    categorical=True,
                    geojson_out=False  # ✅ Fix here
                )
                results = self._get_table_data(villages_vector, stats)
                df = pd.DataFrame(results)
                output_csv_path = os.path.join(self.config.output_path, f"village_details_{uuid.uuid4().hex}.csv")
                df.to_csv(output_csv_path, index=False)
                return output_csv_path,results
        except Exception as e:
            print(e)
    
    def save_vector(self,vector,name:str):
       
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

        upload_shapefile("vector_work", "stp_vector_store", Path(output_zip_path), layer_name=name_only)
        return name_only




class WQ_Index:
    def __init__(self):
        unique_name=Unique_name().unique_name('wqi')
        self.output=Path(Settings().TEMP_DIR,unique_name)
        self.output.mkdir(exist_ok=True)
        self.vector_work=VectorProcess()
        
    def _correct_pandas(self,payload:List[Well_response],params:List[str]):
        df = pd.DataFrame([item.model_dump() for item in payload])
        df = df[params]
        for param in df:
            param_df = df[[param]].copy()
            param_df[param] = pd.to_numeric(param_df[param], errors='coerce')
        return df

    def _arcgis_style_idw_ckdtree(self,coords_xy, values, grid_transform, grid_shape,
                              power=2.0, search_mode="variable", n_neighbors=12, radius=None):
        print(f"[IDW] cKDTree IDW start | mode={search_mode}, k={n_neighbors}, radius={radius}, power={power}")
        
        if isinstance(grid_shape, (tuple, list)) and len(grid_shape) == 2:
            rows, cols = grid_shape
        else:
            raise ValueError(f"grid_shape must be (rows, cols), got: {grid_shape}")
        
        rows, cols = int(rows), int(cols)
        print(f"[IDW] Grid dimensions: rows={rows}, cols={cols}")

        # Generate grid coordinates
        xs = (np.arange(cols, dtype=np.float64) * grid_transform.a) + grid_transform.c + (grid_transform.a / 2.0)
        ys = (np.arange(rows, dtype=np.float64) * grid_transform.e) + grid_transform.f + (grid_transform.e / 2.0)
        grid_x, grid_y = np.meshgrid(xs, ys)
        xi = np.column_stack([grid_x.ravel(), grid_y.ravel()])

        coords_xy = np.asarray(coords_xy, dtype=np.float64)
        values = np.asarray(values, dtype=np.float64)
        
        k = int(n_neighbors) if n_neighbors is not None else 12
        k = max(1, min(k, coords_xy.shape[0]))

        # Build KDTree
        tree = cKDTree(coords_xy)

        if search_mode == "variable":
            # K nearest neighbors
            dists, idxs = tree.query(xi, k=k)
            if k == 1:
                dists = dists[:, np.newaxis]
                idxs = idxs[:, np.newaxis]
            
            dists[dists == 0] = 1e-10
            weights = 1.0 / (dists ** float(power))
            numer = np.sum(weights * values[idxs], axis=1)
            denom = np.sum(weights, axis=1)
            vals = numer / denom

        elif search_mode == "fixed":
            # Fixed radius search
            if radius is None or float(radius) <= 0:
                raise ValueError("Fixed search requires positive radius")
            
            r = float(radius)
            neighbor_lists = tree.query_ball_point(xi, r=r)
            vals = np.empty(len(xi), dtype=np.float64)
            
            for i, neighbors in enumerate(neighbor_lists):
                if not neighbors:
                    vals[i] = np.nan
                    continue
                
                d = np.linalg.norm(coords_xy[neighbors] - xi[i], axis=1)
                d[d == 0] = 1e-10
                w = 1.0 / (d ** float(power))
                vals[i] = np.sum(w * values[neighbors]) / np.sum(w)
        else:
            # Fallback: all points (slower)
            N = len(xi)
            chunk = 200000
            out = np.empty(N, dtype=np.float64)
            
            for s in range(0, N, chunk):
                e = min(s + chunk, N)
                xchunk = xi[s:e]
                d = np.linalg.norm(coords_xy[None, :, :] - xchunk[:, None, :], axis=2)
                d[d == 0] = 1e-10
                w = 1.0 / (d ** float(power))
                numer = w.dot(values)
                denom = np.sum(w, axis=1)
                out[s:e] = numer / denom
            vals = out

        grid = vals.reshape(rows, cols).astype(np.float32)
        
        print(f"[IDW] cKDTree IDW done")
        print(f"  - Output shape: {grid.shape}")
        print(f"  - Value range: {np.nanmin(grid):.2f} to {np.nanmax(grid):.2f}")
        print(f"  - Mean: {np.nanmean(grid):.2f}")
        
        return grid

    def _vector_area(self,df:pd.DataFrame):
        points_gdf = gpd.GeoDataFrame(
            df,
            geometry=gpd.points_from_xy(df['Longitude'], df['Latitude'], crs="EPSG:4326")
        )
        points_utm = points_gdf.to_crs("EPSG:32644")
        coords_xy_utm = np.array([(geom.x, geom.y) for geom in points_utm.geometry], dtype=np.float64)
        idw_cell_size = 50.0
        
        selected_area=self.vector_work.get_basin()
        bounds_original = selected_area.total_bounds
        selected_area_utm = selected_area.to_crs("EPSG:32644")
        bounds_utm = selected_area_utm.total_bounds
        sel_minx, sel_miny, sel_maxx, sel_maxy = bounds_utm
        pts_minx, pts_miny = coords_xy_utm[:,0].min(), coords_xy_utm[:,1].min()
        pts_maxx, pts_maxy = coords_xy_utm[:,0].max(), coords_xy_utm[:,1].max()
        
        # Expand bounds to include both selected area and well points
        minx = min(sel_minx, pts_minx) - idw_cell_size
        miny = min(sel_miny, pts_miny) - idw_cell_size
        maxx = max(sel_maxx, pts_maxx) + idw_cell_size
        maxy = max(sel_maxy, pts_maxy) + idw_cell_size
        
        cols = int(np.ceil((maxx - minx) / idw_cell_size))
        rows = int(np.ceil((maxy - miny) / idw_cell_size))
    
        proj_transform = from_origin(minx, maxy, idw_cell_size, idw_cell_size)
        return cols,rows,coords_xy_utm,proj_transform

    def _get_interpolate(self,df:pd.DataFrame,threshold):   
        selected_parameters=df.drop(columns=['Longitude','Latitude'])  
        cols,rows,coords_xy_utm,proj_transform=self._vector_area(df)
        interpolated_rasters = []
        for param in selected_parameters:
            temp_name=Unique_name.unique_name_with_ext(param,"tif")
            param_threshold=threshold[param]
            try:
                param_df=selected_parameters
                valid_mask = ~param_df[param].isna()
                valid_values = param_df.loc[valid_mask, param].values.astype(float)
                valid_coords = coords_xy_utm[valid_mask]
                
                if len(valid_values) < 3:
                    print(f"[INTERPOLATION] ✗ {param}: Only {len(valid_values)} valid points (need 3 minimum)")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Only {len(valid_values)} valid points for {param} (need 3 minimum)"
                    )                
                # Perform IDW interpolation in UTM
                Z_utm = self._arcgis_style_idw_ckdtree(
                    coords_xy=valid_coords,
                    values=valid_values,
                    grid_transform=proj_transform,
                    grid_shape=(rows, cols),
                    power=2.0,
                    search_mode='variable',
                    n_neighbors=12,
                    radius=None
                )
                temp_utm_path = self.output / f"temp_{temp_name}"

                with rasterio.open(
                    temp_utm_path,
                    'w',
                    driver='GTiff',
                    height=Z_utm.shape[0],
                    width=Z_utm.shape[1],
                    count=1,
                    dtype=rasterio.float32,
                    crs='EPSG:32644',
                    transform=proj_transform,
                    nodata=np.nan
                ) as dst:
                    dst.write(Z_utm.astype(rasterio.float32), 1)

                with rasterio.open(temp_utm_path) as src:
                    transform_4326, width_4326, height_4326 = calculate_default_transform(
                        src.crs, 'EPSG:4326', src.width, src.height, *src.bounds,
                        resolution=(0.001, 0.001)  # ~100m resolution in degrees
                    )
                    output_path = self.output/ f"{temp_name}"
                    
                    with rasterio.open(
                        output_path,
                        'w',
                        driver='GTiff',
                        height=height_4326,
                        width=width_4326,
                        count=1,
                        dtype=rasterio.float32,
                        crs='EPSG:4326',
                        transform=transform_4326,
                        nodata=np.nan,
                        compress='lzw'
                        
                    ) as dst:
                        reproject(
                            source=rasterio.band(src, 1),
                            destination=rasterio.band(dst, 1),
                            src_transform=src.transform,
                            src_crs=src.crs,
                            dst_transform=transform_4326,
                            dst_crs='EPSG:4326',
                            resampling=Resampling.bilinear,
                            dst_nodata=np.nan
                            
                        )
                        dst.update_tags(
                            PARAMETER=param,
                            INTERPOLATION_METHOD='IDW_cKDTree',
                            WELLS_COUNT=str(len(valid_values)),
                            ORIGINAL_CRS='EPSG:32644',
                            OUTPUT_CRS='EPSG:4326'
                        )
                with rasterio.open(output_path) as src:
                    data_4326 = src.read(1)
                    valid_data = data_4326[~np.isnan(data_4326)]
                interpolated_rasters.append({
                    'parameter': param,
                    'output_path': str(output_path),
                    'wells_used': len(valid_values),
                    'raster_shape': data_4326.shape,
                    'threshold_bool': float(np.mean(valid_data))>param_threshold,
                    'value_range': {
                        'min': float(np.min(valid_data)),
                        'max': float(np.max(valid_data)),
                        'mean': float(np.mean(valid_data))
                    }
                   

                })
            
            except Exception as e:
                print(f"[INTERPOLATION] ✗ {param}: {str(e)}")
        return interpolated_rasters

    def __calculate_index(self,p_array, threshold):
        if hasattr(p_array, 'mask'):
            valid_mask = ~p_array.mask
            p_array = p_array.data
        else:
            valid_mask = np.isfinite(p_array) & (p_array > 0)

        numerator = p_array - threshold
        denominator = p_array + threshold
        ci = np.full_like(p_array, np.nan, dtype=np.float32)
        calc_mask = valid_mask & (denominator != 0)
        ci[calc_mask] = numerator[calc_mask] / denominator[calc_mask]
        ci = np.clip(ci, -1, 1)
        return ci

    def __calculate_ranking(self, ci_array):
        valid_mask = ~np.isnan(ci_array) & np.isfinite(ci_array)
        rank = np.full_like(ci_array, np.nan, dtype=np.float32)
        valid_ci = ci_array[valid_mask]
        rank[valid_mask] = 0.5 * (valid_ci ** 2) + 4.5 * valid_ci + 5
        rank[valid_mask] = np.clip(rank[valid_mask], 1, 10)
        return rank
    
    def _calulate_concentration_index(self, arr,threshold):
        CI_raster=[]
        rank_raster=[]
        for i in arr:
            CI_raster.append(
                {
                "parameter":i["parameter"],
                "P_raster":i["output_path"],
                "threshold":threshold.get(i['parameter']),
                "threshold_bool":i["threshold_bool"]  
                }
            )
        for i in CI_raster:
      
            with rasterio.open(i["P_raster"]) as src:
                p_array = src.read(1)
                profile = src.profile
            result = self.__calculate_index(p_array, i["threshold"])

        # Define output CI raster path
            base, ext = os.path.splitext(i["P_raster"])
            ci_raster_path = f"{base}_ci{ext}"

        # Update metadata
            profile.update(
                dtype=rasterio.float32,
                count=1,
                compress="lzw"
            )

        # Write the CI raster
            with rasterio.open(ci_raster_path, "w", **profile) as dst:
                dst.write(result.astype(np.float32), 1)
            rank_raster.append({
                "parameter":i["parameter"],
                "CI_raster":ci_raster_path,
                "threshold_bool":i["threshold_bool"]  
            })
        return rank_raster

    def _calcluate_ranking_raster(self,arr):
        rank_raster=[]
        for i in arr:
            with rasterio.open(i["CI_raster"]) as src:
                p_array = src.read(1)
                profile = src.profile
            result=self.__calculate_ranking(p_array)
            base, ext = os.path.splitext(i["CI_raster"])
            rank_raster_path = f"{base}_rank{ext}"
            profile.update(
                dtype=rasterio.float32,
                count=1,
                compress="lzw"
            )
            with rasterio.open(rank_raster_path, "w", **profile) as dst:
                dst.write(result.astype(np.float32), 1)
            rank_raster.append({
                "parameter":i["parameter"],
                "Rank_raster":rank_raster_path,
                "threshold_bool":i["threshold_bool"]    
            })
        return rank_raster
    def _find_weight(self,arr):
        weight_rank=[]
        for i in arr:
            with rasterio.open(i["Rank_raster"]) as src:
                p_array = src.read(1, masked=True).filled(np.nan)
                mean_val = np.nanmean(p_array)

                weight = mean_val + 2 if i["threshold_bool"] else mean_val
                weight_rank.append({
                    "parameter": i["parameter"],
                    "weight": float(weight)
                })
        return weight_rank
    def _overlay(self, rank, weight):
        weighted_arrays = []
        meta = None
        weight_map = {w["parameter"]: w["weight"] for w in weight}
        for i in rank:
            param = i["parameter"]
            if param not in weight_map:
                continue

            with rasterio.open(i["Rank_raster"]) as src:
                array = src.read(1).astype(float)
                weight_val = weight_map[param]
                weighted_array = array * weight_val
                weighted_arrays.append(weighted_array)

             
                if meta is None:
                    meta = src.meta.copy()

      
        if not weighted_arrays:
            return None

        num_params = len(weighted_arrays)
        print(num_params)
        final_overlay = np.sum(weighted_arrays, axis=0) / num_params

        final_overlay = 100 - final_overlay

        min_val = np.nanmin(final_overlay)
        max_val = np.nanmax(final_overlay)

        if max_val != min_val:  # avoid division by zero
            final_overlay = (final_overlay - min_val) / (max_val - min_val)
        else:
            final_overlay[:] = 0
        output_dir = "/home/app/temp"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "overlay.tif")

        meta.update(dtype=rasterio.float32, count=1)
        with rasterio.open(output_path, "w", **meta) as dst:
            dst.write(final_overlay.astype(rasterio.float32), 1)

        return output_path

    def calculate_GWQI(self,db:session,payload:List[Well_response]):
        df=self._correct_pandas(payload.data,payload.params)
        thresholds = WQI_threshold(db).get_threshold()
        df_columns = set(df.columns)
        parameter_thresholds = {
            t.parameter: t.value
            for t in thresholds
            if t.parameter in df_columns
        }
        result=self._get_interpolate(df,parameter_thresholds)   
        result_CI=self._calulate_concentration_index(result,parameter_thresholds)
        result_rank=self._calcluate_ranking_raster(result_CI)
        result_weight=self._find_weight(result_rank)
        overlay=self._overlay(result_rank,result_weight)
        print("overlay",overlay)


    def get_well(self,db: session,payload:Well_input):
        return WQI(db).get_wqi(payload.subdis_cod,payload.year)
        