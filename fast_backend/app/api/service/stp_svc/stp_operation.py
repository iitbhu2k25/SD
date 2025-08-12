import os
from typing import List, Tuple
import geopandas as gpd
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import  reproject
from rasterio.transform import from_origin
from rasterio.mask import mask
from shapely.geometry import mapping
from rasterio.plot import show
import matplotlib.pyplot as plt
from tqdm import tqdm
from app.api.service.geoserver import Geoserver
from xml.dom import minidom
from xml.etree import ElementTree as ET
from app.api.service.network_svc.network_conf import GeoConfig
import uuid
from app.database.config.dependency import db_dependency
from pathlib import Path
from app.api.service.stp_svc import spt_service
from app.database.crud.stp_crud import STP_sutability_crud
from app.conf.settings import Settings
from datetime import datetime
import zipfile
import tempfile
import geopandas as gpd
import numpy as np
import pandas as pd
from rasterstats import zonal_stats
from rasterio.enums import Resampling
from app.api.service.script_svc.geoserver_svc import upload_shapefile
from app.database.crud.stp_crud import Stp_towns_crud,Stp_drain_new_crud
from sqlalchemy.orm import Session
from rasterio.features import rasterize
import pandas as pd
from rasterstats import zonal_stats




BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
subdistrict_path = os.path.join(BASE_DIR, 'media', 'Rajat_data', 'shape_stp', 'subdistrict', 'STP_subdistrict.shp')
villages_path = os.path.join(BASE_DIR, 'media', 'Rajat_data', 'shape_stp', 'villages', 'STP_Village.shp')


geo=Geoserver()

class RasterProcess:    
    def __init__(self, config: GeoConfig = GeoConfig()):
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
        

        
        # Initialize weighted sum array
        weighted_sum = np.zeros_like(self.aligned_arrays[0], dtype=np.float32)
 
        for i, array in enumerate(self.aligned_arrays):
            weighted_sum += array * weights[i]
        
        # Replace NaN values with 0
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
        
        
        # Initialize constraint array
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
        
        # Save constrained overlay
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

                # Generate binary mask (1 where constraint is met, 0 otherwise)
                constraint_mask = np.where(constraint_aligned >= 1, 1, 0).astype("float32")

                # Combine constraints (logical AND: multiply masks together)
                combined_constraint_mask *= constraint_mask

            print("apply constrtin")
            final_priority = combined_constraint_mask*weighted_sum

        # Save constrained overlay
        output_path = os.path.join(self.config.output_path, output_name)
        with rasterio.open(output_path, 'w', **self.reference_profile) as dst:
            dst.write(final_priority, 1)

        return output_path, final_priority
    
    def clip_to_basin(self, raster_path: str, shapefile_path: str = None, 
                     output_name: str = "clipped_priority_map.tif") -> str:
        
        basin = gpd.read_file(shapefile_path)
        if basin.crs is None:
            basin.set_crs("EPSG:32644", inplace=True) 
        print('raster path',raster_path)
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
        with rasterio.open(output_path, "w", **out_meta) as dest:
            dest.write(out_image)
        
   
        return output_path
    
    def clip_to_user_villages(self, raster_path: str,clip:List[int]=None,place:str=None  ) -> str:
        try:
            villages_path = os.path.join(self.config.base_dir, 'media', 'Rajat_data', 'shape_stp', 'villages', 'STP_Village.shp')
            villages_vector = gpd.read_file(villages_path)
            if villages_vector.crs is None:
                villages_vector.set_crs("EPSG:32644", inplace=True) 
            villages_vector=villages_vector.to_crs("EPSG:32644")
            if place == "Drain":
                villages_vector=villages_vector[villages_vector['ID'].isin(clip)]
            else:
                villages_vector=villages_vector[villages_vector['subdis_cod'].isin(clip)]
            with rasterio.open(raster_path) as src:
                out_image, out_transform = mask(dataset=src, shapes=villages_vector.geometry, crop=True)
                out_meta = src.meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform
            })
            output_name=f"{raster_path.split('/')[-1].rsplit('.', 1)[0]}_{uuid.uuid4().hex}.tif"
            output_path = os.path.join(self.config.output_path, output_name)
            with rasterio.open(output_path, "w", **out_meta) as dest:
                dest.write(out_image)
            return output_path
        except Exception as e:
            print(e)
    
    def clip_to_town_buffer(self, raster_path: str,clip:List[int]=None  ) -> str:
        try:
            town_path = os.path.join(self.config.base_dir, 'media', 'Rajat_data', 'shape_stp','Drain_stp','Town','Town.shp')
            town_vector = gpd.read_file(town_path)
            if town_vector.crs is None:
                town_vector.set_crs("EPSG:32644", inplace=True) 
            town_vector=town_vector.to_crs("EPSG:32644")
            town_vector=town_vector[town_vector['ID'].isin(clip)]
            class_buffer = 0 
            if int(town_vector['class'].iloc[0]) == 1:
                class_buffer=35000
            elif int(town_vector['class'].iloc[0]) == 2:
                class_buffer=30000
            elif int(town_vector['class'].iloc[0]) == 3:
                class_buffer=25000  
            elif int(town_vector['class'].iloc[0]) == 4:
                class_buffer=20000
            elif int(town_vector['class'].iloc[0]) == 5:
                class_buffer=10000
            else:
                class_buffer=5000
            buffered_geom = town_vector.geometry.buffer(class_buffer)
            buffered_gdf = gpd.GeoDataFrame(geometry=buffered_geom, crs=town_vector.crs)
            if len(buffered_gdf) > 1:
                print("Multiple geometries found, creating union...")
                union_geom = buffered_gdf.geometry.unary_union
                buffered_gdf = gpd.GeoDataFrame(geometry=[union_geom], crs=buffered_gdf.crs)
            geometry_for_mask = [mapping(geom) for geom in buffered_gdf.geometry]
            with rasterio.open(raster_path) as src:
                out_image, out_transform = mask(dataset=src, shapes=geometry_for_mask, crop=True)
                out_meta = src.meta.copy()
            out_meta.update({

                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform
            })
            output_name=f"{raster_path.split('/')[-1].rsplit('.', 1)[0]}_{uuid.uuid4().hex}.tif"
            output_path = os.path.join(self.config.output_path, output_name)
            print("ouytput path",output_path)
            with rasterio.open(output_path, "w", **out_meta) as dest:
                dest.write(out_image)
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
                villages_vector.set_crs("EPSG:32644", inplace=True) 
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
        color_map = ET.SubElement(raster_symbolizer, "sld:ColorMap")
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
            print("min valuye ",min_val)
            print("max valuye ",max_val)
    
        print(f"Raster min value: {min_val}, max value: {max_val}")
        if min_val == max_val:
            intervals = [min_val] * num_classes
        else:
            intervals = np.linspace(min_val, max_val, num_classes+1)
       
        colors = self._generate_colors(num_classes, color_ramp)
        print("reverse ",reverse)
        if reverse:
            colors = colors[::-1]
        for i in intervals:
            print("intervals ",intervals)
        sld_content = self._generate_sld_xml(intervals, colors)
        unique_name = f"style_{uuid.uuid4().hex}.sld"
        output_sld_path = os.path.join(self.output_dir, unique_name)        
        with open(output_sld_path, 'w', encoding='utf-8') as f:
            f.write(sld_content)
        print(f"SLD file created: {output_sld_path}")
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

class STPPriorityMapper:
    def __init__(self, config: GeoConfig = None):
        self.config = config or GeoConfig()
        self.processor = RasterProcess(self.config)
    

    def _get_priority_raster(self):
        from app.database.config.dependency import PostgresDb
        db=PostgresDb().get_session
        raster_path=spt_service.Stp_service.get_priority_category(db)
        print(raster_path,raster_path)
        # raster_path = [{"file_name": i.file_name,
        #                 "path": os.path.abspath(Settings().BASE_DIR+"/"+i.file_path),
        #                 "sld_path": os.path.abspath(Settings().BASE_DIR+"/"+i.sld_path,)                                            
        #                 } for i in raster_path]
        # return raster_path
    def _get_clip_raster(self,raster_path:List,clip:List[int]=None,place:str=None):
        raster_response=[]
        for i in raster_path:
            final_path=self.processor.clip_to_user_villages(i['path'],clip=clip,place=place)
            raster_response.append(
                {"file_name":i["file_name"],
                "sld_path":i["sld_path"],
                "final_path":final_path}
            )
        return raster_response
    
    def cachement_villages(self,drain_no:List[int]):
        catchment_villages = gpd.read_file(self.config.cachement_shapefile)
        villages = gpd.read_file(self.config.villages_shapefile) 
        projected_crs = 'EPSG:32643' 
        catchment_villages = catchment_villages.to_crs(projected_crs)
        villages = villages.to_crs(projected_crs)
        catchment_selected = catchment_villages[catchment_villages["Drain_No"].isin(drain_no)]
        catchment_polygon = catchment_selected.geometry.unary_union
        
        villages_intersect = villages[villages.intersects(catchment_polygon)]
        print("villages_intersect",villages_intersect)

        # Data cleaning and validation
        villages_intersect = villages_intersect[villages_intersect.geometry.is_valid]
        villages_intersect['geometry'] = villages_intersect.geometry.buffer(0)


        if 'FID' in villages_intersect.columns:
            villages_intersect = villages_intersect.drop(columns=['FID'])
        if 'fid' in villages_intersect.columns:
            villages_intersect = villages_intersect.drop(columns=['fid'])
        if 'ID' in villages_intersect.columns:
            villages_intersect = villages_intersect.rename(columns={'ID': 'village_id'})
        # Generate unique names
        random_name = f"{uuid.uuid4().hex}"
        unique_village_zip = f"catchment_villages_{random_name}.zip"
        output_zip_path = self.config.output_path / unique_village_zip

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_shp = Path(temp_dir) / f"catchment_villages_{random_name}.shp"
            
            # Save using fiona engine explicitly
            villages_intersect.to_file(temp_shp, driver='ESRI Shapefile', engine='fiona')
            
            # Create zip with all shapefile components
            with zipfile.ZipFile(output_zip_path, 'w') as zipf:
                for file in temp_shp.parent.glob(f"catchment_villages_{random_name}.*"):
                    zipf.write(file, file.name)

        name_only = os.path.splitext(os.path.basename(output_zip_path))[0]

        upload_shapefile("vector_work", "stp_vector_store", Path(output_zip_path), layer_name=name_only)

        # Update data array to use the new column name
        data = [
            {
                "id": village_id,  # Now using village_id instead of ID
                "village_name": name,
                "area": geom.area
            }
            for _, (village_id, name, geom) in enumerate(zip(villages_intersect["village_id"], villages_intersect["Name"], villages_intersect.geometry))
        ]


        print("name is ",name_only)
        return [data, name_only]
    def _raster_polyon_color(self,raster_path:str,clip:List[int]=None,place:str=None  ):
        villages_path = os.path.join(self.config.base_dir, 'media', 'Rajat_data', 'shape_stp', 'villages', 'STP_Village.shp')
        villages_vector = gpd.read_file(villages_path)
        with rasterio.open(raster_path) as src:
            raster_data = src.read(1)
            raster_meta = src.meta.copy()
            raster_transform = src.transform
            raster_crs = "EPSG:32644"
            raster_nodata = src.nodata
        if villages_vector.crs is None:
            villages_vector.set_crs("EPSG:32644", inplace=True) 
        villages_vector=villages_vector.to_crs("EPSG:32644")
        if place == "Drain":
                villages_vector=villages_vector[villages_vector['ID'].isin(clip)]
        else:
            villages_vector=villages_vector[villages_vector['subdis_cod'].isin(clip)]
            
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

        # --- Update metadata and save output ---
        raster_meta.update({
            "dtype": "float32",
            "nodata": raster_nodata
        })
        output_name=f"STP_Priority_{uuid.uuid4().hex}.tif"
        output_path = os.path.join(self.config.output_path, output_name)
        with rasterio.open(output_path, "w", **raster_meta) as dest:
            dest.write(out_array,1)
        return output_path
    
    def create_priority_map(self, raster_paths: List[str], weights: List[float],clip:List[int]=None,place:str=None) -> str:
        try:
            if len(raster_paths) != len(weights):
                raise ValueError(f"Number of rasters ({len(raster_paths)}) must match number of weights ({len(weights)})")
            self.processor.align_rasters(raster_paths)
            overlay_name=f"overlay_{uuid.uuid4().hex}_map.tif"
            weighted_sum = self.processor.create_weighted_overlay(
                weights, overlay_name
            )
            output_name=f"Final_STP_Priority_{uuid.uuid4().hex}_map.tif"
            constrained_path, _ = self.processor.apply_constraint(
                weighted_sum, output_name=output_name
            )
            final_name = f"STP_Priority_{uuid.uuid4().hex}.tif"
            final_path = self.processor.clip_to_basin(
                raster_path=constrained_path,
                shapefile_path=self.config.basin_shapefile , output_name=final_name
            )
            sld_path,sld_name=RasterProcess().processRaster(final_path,reverse=True)
            final_path=self.processor.clip_to_user_villages(final_path,clip=clip,place=place)
            csv_path,csv_details=self.processor.clip_details(raster_path=final_path,clip=clip,place=place,logic="priority")
            final_path=self._raster_polyon_color(raster_path=final_path,clip=clip,place=place)
            tatus,layer_name=geo.publish_raster(workspace_name=self.config.raster_workspace, store_name=self.config.raster_store, raster_path=final_path)
            status=geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=sld_path, sld_name=layer_name)
            if status:
                return {
                    "status": "success",
                    "workspace": self.config.raster_workspace,
                    "store": self.config.raster_store,
                    "layer_name": layer_name,
                    "type": "raster",
                    "csv_path":csv_path,
                    "csv_details":csv_details
                }
            return False
        except Exception as e:
            print(e)
            return False

    def category_priority_map(self,db:db_dependency,clip:List[int]=None,place:str=None) -> str:
        try:
            raster_path=spt_service.Stp_service.get_priority_category(db)
            raster_path = [{"file_name": i.file_name,
                            "path": os.path.abspath(Settings().BASE_DIR+"/"+i.file_path),
                            "sld_path": os.path.abspath(Settings().BASE_DIR+"/"+i.sld_path,)                                            
                           } for i in raster_path]
           
            print("raster path",raster_path)
            response=[]
            for i in raster_path:
                final_path=self.processor.clip_to_user_villages(i['path'],clip=clip,place=place)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]  # Include milliseconds
                unique_store_name = f"{self.config.raster_store}_{timestamp}"
                status,layer_name=geo.publish_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path)
                sld_path= i['sld_path']
                status=geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=sld_path, sld_name=layer_name)   
                os.remove(final_path)
                response.append({
                    "workspace": self.config.raster_workspace,
                    "layer_name": layer_name,
                    "file_name":i["file_name"],
                })
            return response
        
        except Exception as e:
            print(e)
            return False
    
    def category_priority_map_villages(self,db:db_dependency,clip:List[int]=None,place:str=None) -> str:
        try:
            raster_path=spt_service.Stp_service.get_sutability_category(db,all_data=True)
            raster_path = [{"file_name": i.file_name,
                            "path": os.path.abspath(Settings().BASE_DIR+"/"+i.file_path),
                            "sld_path": os.path.abspath(Settings().BASE_DIR+"/"+i.sld_path,)                                            
                           } for i in raster_path]
            response=[]
            for i in raster_path:
                if place == 'Drain':
                    final_path=self.processor.clip_to_user_villages(i['path'],clip=clip,place=place)
                else:
                    final_path=self.processor.clip_to_town_buffer(i['path'],clip=clip)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]  # Include milliseconds
                unique_store_name = f"{self.config.raster_store}_{timestamp}"
                status,layer_name=geo.publish_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path)
                sld_name=f"{layer_name}_sld_{uuid.uuid4().hex}"
                status=geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=i['sld_path'], sld_name=sld_name)   
                response.append({
                    "workspace": self.config.raster_workspace,
                    "layer_name": layer_name,
                    "file_name":i["file_name"],
                })
            print("clips",clip)
            return response
        
        except Exception as e:
            print(e)
            return False
        
class STPSutabilityMapper:
    def __init__(self, config: GeoConfig = None):
        self.config = config or GeoConfig()
        self.processor = RasterProcess(self.config)
        self.BASE_DIR="/home/app/"
    
    def cachement_villages(self,db:Session,drain_no:List[int]):
        # get the drain buffer 
        buffer_value=Stp_drain_new_crud(db).get_drains_class(drain_no)
        buffer_class=buffer_value[0].drain_class
        if buffer_class == 1:
            buffer_value=35000
        elif buffer_class == 2:
            buffer_value=30000
        elif buffer_class == 3:
            buffer_value=25000  
        elif buffer_class == 4:
            buffer_value=20000
        elif buffer_class == 5:
            buffer_value=10000
        else:
            buffer_value=5000
        projected_crs = 'EPSG:32643' 
        drain_catchment = gpd.read_file(self.config.drain_cachement_shapefile).to_crs(projected_crs)
        villages = gpd.read_file(self.config.villages_shapefile).to_crs(projected_crs)
        catchment_selected = drain_catchment[drain_catchment["Drain_No"].isin(drain_no)]
        catchment_polygon = catchment_selected.geometry.unary_union
        catchment_buffer=catchment_polygon.buffer(buffer_value)
        villages_sindex = villages.sindex
        villages = villages.iloc[list(villages_sindex.query(catchment_buffer))]
        villages_intersect = villages[villages.geometry.intersects(catchment_buffer)]
        villages_intersect = villages_intersect[villages_intersect.geometry.is_valid]
        villages_intersect['geometry'] = villages_intersect.geometry.buffer(0)
        
        print('vill',villages_intersect.columns)
        if 'FID' in villages_intersect.columns:
            villages_intersect = villages_intersect.drop(columns=['FID'])
        if 'fid' in villages_intersect.columns:
            villages_intersect = villages_intersect.drop(columns=['fid'])
        if 'ID' in villages_intersect.columns:
            villages_intersect = villages_intersect.rename(columns={'ID': 'village_id'})
        # Generate unique names
        random_name = f"{uuid.uuid4().hex}"
        unique_village_zip = f"catchment_villages_{random_name}.zip"
        output_zip_path = self.config.output_path / unique_village_zip

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_shp = Path(temp_dir) / f"catchment_villages_{random_name}.shp"
            
            # Save using fiona engine explicitly
            villages_intersect.to_file(temp_shp, driver='ESRI Shapefile', engine='fiona')
            
            # Create zip with all shapefile components
            with zipfile.ZipFile(output_zip_path, 'w') as zipf:
                for file in temp_shp.parent.glob(f"catchment_villages_{random_name}.*"):
                    zipf.write(file, file.name)

        name_only = os.path.splitext(os.path.basename(output_zip_path))[0]

        upload_shapefile("vector_work", "stp_vector_store", Path(output_zip_path), layer_name=name_only)

        # Update data array to use the new column name
        data = [
            {
                "id": village_id,  # Now using village_id instead of ID
                "village_name": name,
                "area": geom.area
            }
            for _, (village_id, name, geom) in enumerate(zip(villages_intersect["village_id"], villages_intersect["Name"], villages_intersect.geometry))
        ]
        return [data, name_only]
    
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
        
        # Write the processed raster
        with rasterio.open(output_path, "w", **out_meta) as dest:
            dest.write(processed_data)
        
        return output_path

    def _temporory_vector(self,vector_temp_file):
        villages_intersect=vector_temp_file
        random_name = f"{uuid.uuid4().hex}"
        unique_village_zip = f"catchment_villages_{random_name}.zip"
        output_zip_path = self.config.output_path / unique_village_zip
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_shp = Path(temp_dir) / f"catchment_villages_{random_name}.shp"
            
            # Save using fiona engine explicitly
            villages_intersect.to_file(temp_shp, driver='ESRI Shapefile', engine='fiona')
            
            # Create zip with all shapefile components
            with zipfile.ZipFile(output_zip_path, 'w') as zipf:
                for file in temp_shp.parent.glob(f"catchment_villages_{random_name}.*"):
                    zipf.write(file, file.name)

        name_only = os.path.splitext(os.path.basename(output_zip_path))[0]
        upload_shapefile("vector_work", "stp_vector_store", Path(output_zip_path), layer_name=name_only)
        return name_only
    
    def _get_sutability_raster(self,db:db_dependency,payload:List):
        all_sutability_raster=STP_sutability_crud(db).get_all(True)
        payload_dict = {r.id: r.weight for r in payload.data}
        condition_raster = [
            [os.path.join(self.BASE_DIR, raster.file_path), payload_dict[raster.id],raster.layer_name]
            for raster in all_sutability_raster
            if raster.raster_category == 'condition' and raster.id in payload_dict
        ]
        constraintion_raster=[
            os.path.join(self.BASE_DIR, raster.file_path)
            for raster in all_sutability_raster
            if raster.raster_category == 'constraint' and raster.id in payload_dict
        ]
        return condition_raster,constraintion_raster
    
    def _sutability_overlay(self,raster_path:List =None,constraintion_raster:List=None,raster_weights:List=None):
        self.processor.align_rasters(raster_path)
        overlay_name=f"overlay_{uuid.uuid4().hex}_map.tif"
        weighted_sum = self.processor.create_weighted_overlay(
                raster_weights, overlay_name
            )
        constraint_name=f"constraint_{uuid.uuid4().hex}_map.tif"
        constrained_path, _ = self.processor.apply_constraints_new(
                weighted_sum, constraint_paths=constraintion_raster, output_name=constraint_name
            )
        final_name = f"stp_sutability_{uuid.uuid4().hex}_map.tif"
        return constrained_path ,self.processor.clip_to_basin(constrained_path,shapefile_path=self.config.basin_shapefile , output_name=final_name)

    def _cliping_raster(self,final_path:str,payload:List):
        
        vector_name=None
        clip=payload.clip
        if payload.place == "Drain":
            final_path=self.processor.clip_to_user_villages(final_path,clip=clip,place=payload.place)
        else:
            clip,vector_name=self._town_to_villages(clip=clip)
            final_path=self.processor.clip_to_user_villages(final_path,clip=clip,place="Drain")

        return final_path,vector_name,clip
    
    def _town_to_villages(self,clip:List):
        town_path = os.path.join(self.config.base_dir, 'media', 'Rajat_data', 'shape_stp','Drain_stp','Town','Town.shp')
        villages_path = os.path.join(self.config.base_dir, 'media', 'Rajat_data', 'shape_stp', 'villages', 'STP_Village.shp')
        town_vector = gpd.read_file(town_path)
        if town_vector.crs is None:
            town_vector.set_crs("EPSG:32644", inplace=True) 
        town_vector=town_vector.to_crs("EPSG:32644")
        villages_gdf = gpd.read_file(villages_path)
        if villages_gdf.crs is None:
            villages_gdf.set_crs("EPSG:32644", inplace=True)
        villages_gdf = villages_gdf.to_crs("EPSG:32644")

        town_vector=town_vector[town_vector['ID'].isin(clip)]
        if town_vector.empty:
            raise ValueError("No town polygon found for the provided clip ID(s)")
        town_poly = town_vector.iloc[0].geometry

        cls = int(town_vector.iloc[0]['class'])
        buffer_map = {1: 35000, 2: 30000, 3: 25000, 4: 20000, 5: 10000}
        buf = buffer_map.get(cls, 5000)
        town_buff = town_poly.buffer(buf)
        
        selected_villages = villages_gdf[villages_gdf.intersects(town_buff)].copy()
        vector_name=self._temporory_vector(vector_temp_file=selected_villages)
        return selected_villages['ID'].tolist(),vector_name
       
    def _get_raster_with_weight(self,db:db_dependency,payload:List):
        condition_raster,constraintion_raster=self._get_sutability_raster(db,payload)
        raster_path=[]
        raster_weights=[]
        if payload.place == "Drain":
            elevation_value=4
        else: 
            elevation_value=Stp_towns_crud(db).get_all(payload.clip)/len(payload.clip)
        for i in condition_raster:
            if i[2] == 'STP_Elevation_Raster':
                elevation_path=self.temporary_raster(i[0],elevation_value)
                raster_path.append(elevation_path)
            else:
                raster_path.append(i[0])
            raster_weights.append(i[1])
        return raster_path,raster_weights,constraintion_raster
    
    def create_sutability_map(self,db:db_dependency,payload:List,reverse:bool=False):
        
        raster_path,raster_weights,constraintion_raster=self._get_raster_with_weight(db,payload)
        
        constrained_path,final_path=self._sutability_overlay(raster_path,constraintion_raster,raster_weights)
        
        final_path,vector_name,clip=self._cliping_raster(final_path,payload)
        sld_path,sld_name=RasterProcess().processRaster(final_path,reverse=reverse)
        csv_path,csv_details=self.processor.clip_details(raster_path=final_path,clip=clip,place="Admin",logic="sutability")
        status,layer_name=geo.publish_raster(workspace_name=self.config.raster_workspace, store_name=self.config.raster_store, raster_path=final_path)
        print("csv path",csv_path)
        status=geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=sld_path, sld_name=sld_name)
        if status:
            os.remove(final_path)
            os.remove(constrained_path)
            os.remove(sld_path)
            return {
                "status": "success",
                "workspace": self.config.raster_workspace,
                "store": self.config.raster_store,
                "layer_name": layer_name,
                "vector_name":vector_name,
                "type": "raster",
                "csv_path":csv_path,
                "csv_details":csv_details
            }
        return False

class GWAPriorityMapper:
    def __init__(self, config: GeoConfig = None):
        self.config = config or GeoConfig()
        self.processor = RasterProcess(self.config)
    
    
    def get_visual_raster(self,db:db_dependency,clip:List[int]=None,place:str=None) -> str:
        try:
            raster_path=spt_service.Stp_service.get_GWA_Priority_visual(db)
            print("raster path",raster_path)
            raster_path = [{"file_name": i.file_name,
                            "path": os.path.abspath(Settings().BASE_DIR+"/"+i.file_path),                                           
                           } for i in raster_path]
           
            print("raster path",raster_path)
            response=[]
            for i in raster_path:
                final_path=self.processor.clip_to_user_villages(i['path'],clip=clip,place=place)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]  # Include milliseconds
                unique_store_name = f"{self.config.raster_store}_{timestamp}"
                status,layer_name=geo.publish_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path)
                sld_path,sld_name=RasterProcess().processRaster(final_path)
                status=geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=sld_path, sld_name=sld_name)   
                os.remove(final_path)
                response.append({
                    "workspace": self.config.raster_workspace,
                    "layer_name": layer_name,
                    "file_name":i["file_name"],
                })
            return response
        
        except Exception as e:
            print(e)
            return False