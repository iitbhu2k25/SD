import os
from pathlib import Path
from typing import List, Optional, Tuple
from fastapi import HTTPException
import geopandas as gpd
import pyproj
import rasterio
import shapely
from app.api.service.geoserver import Geoserver
from app.utils.network_conf import GeoConfig
import geopandas as gpd
import numpy as np
from sqlalchemy.orm import Session
import rioxarray
from rasterio.transform import from_origin
from shapely.geometry import Polygon
from tqdm import tqdm
from xml.dom import minidom
from xml.etree import ElementTree as ET
from rasterio.warp import calculate_default_transform, reproject, Resampling
import uuid
from rasterio.mask import mask
from shapely.geometry import mapping,shape
from app.utils.name import Unique_name
import pandas as pd
from rasterstats import zonal_stats
from rasterio.enums import Resampling
import tempfile
import zipfile
from app.api.service.script_svc.geoserver_svc import upload_shapefile

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

subdistrict_path = os.path.join(BASE_DIR, 'media', 'Rajat_data', 'shape_stp', 'subdistrict', 'STP_subdistrict.shp')
villages_path = os.path.join(BASE_DIR, 'media', 'Rajat_data', 'shape_stp', 'villages', 'STP_Village.shp')


geo=Geoserver()

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


class RainwaterMapper:
    def __init__(self, config: GeoConfig = None):
        self.config = config or GeoConfig()
        self.processor = RasterProcess(self.config)
        self.BASE_DIR = "/home/app/"

    def rasterclip_tif(self, db: Session, district_id: int, subdistrict_ids: List[int], 
                    raster_path: str, output_dir: str):
        """
        Clip raster/TIF files based on district or subdistrict boundaries and calculate statistics.
        
        Args:
            db: Database session
            district_id: District ID
            subdistrict_ids: List of subdistrict IDs (use [0] for district-level clipping)
            raster_path: Path to the input raster/TIF file
            output_dir: Directory to save clipped raster files
        
        Returns:
            Dictionary with results, total area, and average rainfall
        """
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Load the raster data
        data_array = rioxarray.open_rasterio(raster_path)
        
        # Ensure CRS is set if not present
        if data_array.rio.crs is None:
            data_array.rio.write_crs("EPSG:4326", inplace=True)
        
        # For multi-band rasters, select the first band
        if len(data_array.dims) > 2 and 'band' in data_array.dims:
            data_array = data_array.isel(band=0)
        
        total_area = 0.0
        all_pixel_data = []
        results = []
        clipped_files = []
        
        # Case 1: Single subdistrict_id with value 0 -> Use district shapefile
        if len(subdistrict_ids) == 1 and subdistrict_ids[0] == 0:
            vector_path = os.path.join(self.config.base_dir, 'media', 'Rajat_data', 
                                    'shape_stp', 'district', 'STP_district.shp')
            vector_data = gpd.read_file(vector_path)
            vector_data = vector_data.to_crs("EPSG:4326")
            area_data = vector_data[vector_data['district_c'] == district_id]
            place_type = "district"
            place_id = district_id
            
            if not area_data.empty:
                # Reproject to UTM Zone 43N (EPSG:32643) for accurate area calculation
                area_data_utm = area_data.to_crs("EPSG:32643")
                area_sqmeters = area_data_utm.geometry.area.iloc[0]
                total_area += area_sqmeters
              
                # Clip the raster using the geometry
                geometry = area_data.geometry.iloc[0]
                clipped_data, clipped_transform = self._clip_raster_with_geometry(
                    data_array, geometry
                )
                
                # Save clipped raster
                output_filename = f"{place_type}_{place_id}_clipped.tif"
                output_path = os.path.join(output_dir, output_filename)
                self._save_clipped_raster(clipped_data, clipped_transform, 
                                        data_array.rio.crs, output_path)
                clipped_files.append(output_path)
                
                # Collect pixel data
                pixel_data = clipped_data.astype(np.float32)
                all_pixel_data.append(pixel_data)
                results.append({
                    "subdistrict_id": place_id,
                    "area": area_sqmeters,
                    "clipped_file": output_path
                })
            else:
                print(f"No {place_type} found for {place_type}_cod {place_id}")
                results.append({
                    "subdistrict_id": place_id,
                    "error": f"No {place_type} found for {place_type}_cod {place_id}",
                    "average_rainfall": None,
                    "area": None,
                    "clipped_file": None
                })
        
        else:
            # Case 2: Multiple subdistricts or single subdistrict (not 0) -> Use subdistrict shapefile
            vector_path = os.path.join(self.config.base_dir, 'media', 'Rajat_data', 
                                    'shape_stp', 'subdistrict', 'STP_subdistrict.shp')
          
            vector_data = gpd.read_file(vector_path)
            vector_data = vector_data.to_crs("EPSG:4326")
            place_type = "subdistrict"
            
            for subdistrict_id in subdistrict_ids:
                area_data = vector_data[vector_data['subdis_cod'] == subdistrict_id]
                place_id = subdistrict_id
                
                if not area_data.empty:
                    # Reproject to UTM Zone 43N (EPSG:32643) for accurate area calculation
                    area_data_utm = area_data.to_crs("EPSG:32643")
                    area_sqmeters = area_data_utm.geometry.area.iloc[0]
                    total_area += area_sqmeters
                
                    
                    # Clip the raster using the geometry
                    geometry = area_data.geometry.iloc[0]
                    clipped_data, clipped_transform = self._clip_raster_with_geometry(
                        data_array, geometry
                    )
                    
                    # Save clipped raster
                    output_filename = f"{place_type}_{place_id}_clipped.tif"
                    output_path = os.path.join(output_dir, output_filename)
                    self._save_clipped_raster(clipped_data, clipped_transform, 
                                            data_array.rio.crs, output_path)
                    clipped_files.append(output_path)
                    
                    # Collect pixel data
                    pixel_data = clipped_data.astype(np.float32)
                    all_pixel_data.append(pixel_data)
                    results.append({
                        "subdistrict_id": place_id,
                        "area": area_sqmeters,
                        "clipped_file": output_path
                    })
                else:
                    print(f"No {place_type} found for {place_type}_cod {place_id}")
                    results.append({
                        "subdistrict_id": place_id,
                        "error": f"No {place_type} found for {place_type}_cod {place_id}",
                        "average_rainfall": None,
                        "area": None,
                        "clipped_file": None
                    })
        
        # Combine all pixel data for average rainfall calculation
        if all_pixel_data:
            combined_pixel_data = np.concatenate([data.flatten() for data in all_pixel_data])
            nodata_value = data_array.rio.nodata if data_array.rio.nodata is not None else np.nan
            print("nodata_value", nodata_value)
            
            if nodata_value is not None:
                combined_pixel_data[combined_pixel_data == nodata_value] = np.nan
          
            valid_mask = ~np.isnan(combined_pixel_data)
            valid_values = combined_pixel_data[valid_mask]
         
            
            average = 0.0 if valid_values.size == 0 else float(np.mean(valid_values))
        else:
            average = 0.0
        
        # Return combined results
        return {
            "results": results,
            "area": total_area,
            "average_rainfall": average,
            "clipped_files": clipped_files
        }

    def _clip_raster_with_geometry(self, data_array, geometry):
        """
        Clip raster data using a geometry.
        
        Args:
            data_array: Rioxarray DataArray
            geometry: Shapely geometry for clipping
        
        Returns:
            Tuple of (clipped_data, transform)
        """
        try:
            # Clip the raster using rioxarray
            clipped = data_array.rio.clip([geometry], drop=True)
            
            # Get the transform from the clipped data
            transformObject = clipped.rio.transform()
            
            # Convert to numpy array
            clipped_data = clipped.values
            
            return clipped_data, transformObject
        
        except Exception as e:
            print(f"Error clipping raster: {e}")
            # Fallback: return empty array with original transform
            return np.array([]), data_array.rio.transform()

    def _save_clipped_raster(self, clipped_data, transform, crs, output_path):
        """
        Save clipped raster data to a TIF file.
        
        Args:
            clipped_data: Numpy array of clipped data
            transform: Rasterio transform object
            crs: Coordinate reference system
            output_path: Output file path
        """
        try:
            if clipped_data.size == 0:
                print(f"Warning: No data to save for {output_path}")
                return
            
            # Ensure data is 2D
            if len(clipped_data.shape) == 3 and clipped_data.shape[0] == 1:
                clipped_data = clipped_data[0]
            
            height, width = clipped_data.shape
            
            # Write the clipped raster to file
            with rasterio.open(
                output_path,
                'w',
                driver='GTiff',
                height=height,
                width=width,
                count=1,
                dtype=clipped_data.dtype,
                crs=crs,
                transform=transform,
                compress='lzw'
            ) as dst:
                dst.write(clipped_data, 1)
            
            print(f"Clipped raster saved to: {output_path}")
        
        except Exception as e:
            print(f"Error saving clipped raster to {output_path}: {e}")



    def calculate_manual_rainfall(
            self,
            coordinates: List[List[float]],
            db,
            raster_path: str,
            layer_class: str,             # kept for signature compatibility; not used here
            month: Optional[int] = None,  # kept for signature compatibility; not used here
            save_clipped: bool = False,
            output_dir: Optional[str] = None
        ):
        try:
            # 1) Validate coordinates: closed polygon with at least 4 points
            if not isinstance(coordinates, list) or len(coordinates) < 4:
                raise HTTPException(status_code=400, detail="Coordinates must have at least 4 points")
            if coordinates[0] != coordinates[-1]:
                raise HTTPException(status_code=400, detail="Coordinates must be a closed ring (first equals last)")
            for pt in coordinates:
                if not isinstance(pt, list) or len(pt) != 2:
                    raise HTTPException(status_code=400, detail="Each coordinate must be [lon, lat]")

            # 2) Construct polygon and GeoDataFrame in WGS84
            poly = Polygon(coordinates)
            if not poly.is_valid or poly.is_empty:
                raise HTTPException(status_code=400, detail="Invalid polygon geometry")
            gdf = gpd.GeoDataFrame(geometry=[poly], crs="EPSG:4326")

            # 3) Compute area in m² (project to suitable UTM based on centroid)
            centroid = gdf.geometry.centroid.iloc[0]
            utm_zone = int((centroid.x + 180) / 6) + 1
            utm_crs = f"EPSG:326{utm_zone:02d}" if centroid.y >= 0 else f"EPSG:327{utm_zone:02d}"
            project = pyproj.Transformer.from_crs("EPSG:4326", utm_crs, always_xy=True).transform
            projected_geom = shapely.ops.transform(project, gdf.geometry.iloc[0])
            area_sqmeters = float(projected_geom.area)

            # 4) Open raster
            try:
                da = rioxarray.open_rasterio(raster_path)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to open raster: {e}")

            # 5) Ensure CRS
            if da.rio.crs is None:
                da.rio.write_crs("EPSG:4326", inplace=True)

            # ============== CORRECTED APPROACH ==============
            # 6) Clip the raster data using the polygon
            try:
                clipped_data = da.rio.clip(gdf.geometry.values, all_touched=True, drop=False)
            except Exception as e:
                # Fallback: use the polygon directly
                clipped_data = da.rio.clip([poly], all_touched=True, drop=False)
            
            # 7) Extract all pixel values from clipped data
            pixel_values = clipped_data.values
            
            # Handle different array dimensions properly
            if pixel_values.ndim == 3:  # Multi-band raster (bands, height, width)
                pixel_values = pixel_values[0]  # Select first band
            elif pixel_values.ndim == 4:  # Time + bands (time, bands, height, width)
                pixel_values = pixel_values[0, 0]  # Select first time, first band
            
            # Flatten to 1D array
            pixel_values = pixel_values.flatten()
            
            # Remove nodata and NaN values
            nodata = da.rio.nodata
            if nodata is not None:
                # Make sure nodata is the same type as pixel_values
                pixel_values = pixel_values[pixel_values != nodata]
            
            # Remove NaN values
            pixel_values = pixel_values[~np.isnan(pixel_values)]
            
            # 8) Calculate average rainfall
            if len(pixel_values) == 0:
                rainfall_avg = 0.0
                num_pixels = 0
            else:
                rainfall_avg = float(np.mean(pixel_values))
                num_pixels = len(pixel_values)


            # Reuse your helper to clip and get transform for saving clipped raster
            clipped_np, raster_transform = self._clip_raster_with_geometry(da, gdf.geometry.iloc[0])

            # 9) Optionally save clipped raster
            clipped_path = None
            if save_clipped and clipped_np is not None and clipped_np.size > 0:
                if not output_dir:
                    output_dir = "/home/app/output/clipped"
                os.makedirs(output_dir, exist_ok=True)
                clipped_path = os.path.join(output_dir, "polygon_clip.tif")
                self._save_clipped_raster(clipped_np, raster_transform, da.rio.crs, clipped_path)

            # 10) Return results
            result = {
                "status": "success",
                "area_sqmeters": round(area_sqmeters, 2),
                "rainfall_avg_mm": round(rainfall_avg, 2),
                "message": "Rainfall and area calculated successfully"
            }
            if clipped_path:
                result["clipped_file"] = clipped_path

            return result

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")
