
import os
from typing import List, Tuple
import geopandas as gpd
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import  reproject
from rasterio.transform import from_origin
from rasterio.mask import mask
from shapely.geometry import mapping
from tqdm import tqdm
from app.api.service.geoserver import Geoserver
from xml.dom import minidom
from xml.etree import ElementTree as ET
from app.utils.network_conf import GeoConfig
import uuid
from app.database.config.dependency import db_dependency
from pathlib import Path
from app.api.service.river_water_management import spt_service
from app.conf.settings import Settings
from datetime import datetime
import numpy as np
import pandas as pd
from rasterstats import zonal_stats
from rasterio.enums import Resampling
from app.api.service.script_svc.geoserver_svc import upload_shapefile
from app.api.service.ground_water_management.gwpz_svc import Gwzp_service,GWLI_service
import pandas as pd
from rasterstats import zonal_stats
import matplotlib.cm as cm


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
       
        weighted_sum = self.aligned_arrays[0] * weights[0]
 
        for i in range(1, len(self.aligned_arrays)):
            weighted_sum += self.aligned_arrays[i] * weights[i]
    
        weighted_sum = np.nan_to_num(weighted_sum, nan=-9999.0)
        
        output_profile = self.reference_profile.copy()
        output_profile.update({
            'nodata': -9999,
            'dtype': 'float32'
        })
        valid_data = weighted_sum[weighted_sum != -9999]
        print("min_value:", np.min(valid_data), "max_value:", np.max(valid_data))
        print("shape:", weighted_sum.shape, "valid_pixels:", len(valid_data))
        return weighted_sum
    def make_raster_output(self, weighted_sum: np.ndarray, 
                     output_name: str = "constrained_overlay.tif") -> str:
        if weighted_sum.ndim == 2:
            final_priority = weighted_sum[np.newaxis, :, :]
        else:
            final_priority = weighted_sum
        profile = self.reference_profile.copy()
        profile.update(
            dtype=rasterio.float32,
            count=1
        )
        output_path = os.path.join(self.config.output_path, output_name)
        with rasterio.open(output_path, 'w', **profile) as dst:
            dst.write(final_priority.astype(np.float32))

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
        elif color_ramp == 'turbo':
            turbo = cm.get_cmap("turbo")
            for i in range(num_classes):
                t = i / max(1, num_classes - 1)
                r, g, b, _ = turbo(t)  # Values in [0,1]
                hex_color = f"#{int(r*255):02x}{int(g*255):02x}{int(b*255):02x}"
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
            max_val = float(np.max(valid_data)+0.0001)
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
            #sld_path=self._generate_dynamic_sld(raster_path=file_path,num_classes=5,color_ramp='turbo',reverse=reverse)
            #sld_path=self._generate_dynamic_sld(raster_path=file_path,num_classes=5,color_ramp='terrain') #terrain
            #sld_path=self._generate_dynamic_sld(raster_path=file_path,num_classes=5,color_ramp="greenTOred")
            sld_name = os.path.basename(sld_path).split('.')[0]
            return sld_path,sld_name
        except Exception as e:
            print("exceprion",e)
            return False

class GWAPriorityMapper:
    def __init__(self, config: GeoConfig = None):
        self.config = config or GeoConfig()
        self.processor = RasterProcess(self.config)
    
    
    def get_visual_raster(self,db:db_dependency,clip:List[int]=None,place:str=None) -> str:
        try:
            raster_path=Gwzp_service.get_GWA_Priority_visual(db)
            raster_path = [{"file_name": i.file_name,
                            "path": os.path.abspath(Settings().BASE_DIR+"/"+i.file_path),
                            "sld_path": os.path.abspath(Settings().BASE_DIR+"/"+i.sld_path,)                                           
                           } for i in raster_path]
    
            response=[]
            for i in raster_path:
                final_path=self.processor.clip_to_user_villages(i['path'],clip=clip,place=place)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]  
                unique_store_name = f"{self.config.raster_store}_{timestamp}"
                status,layer_name=geo.publish_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path)
                sld_name=f"{layer_name}_sld_{uuid.uuid4().hex}"
                status=geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=i['sld_path'], sld_name=sld_name)   
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
        
    def create_gwpz_map(self, raster_paths: List[str], weights: List[float],clip:List[int]=None,place:str=None) -> str:
        try:
            if len(raster_paths) != len(weights):
                raise ValueError(f"Number of rasters ({len(raster_paths)}) must match number of weights ({len(weights)})")
            self.processor.align_rasters(raster_paths)
            weighted_sum = self.processor.create_weighted_overlay(
                weights
            )
            output_name=f"Final_Ground_water_Potential_{uuid.uuid4().hex}_map.tif"
            constrained_path, _ = self.processor.make_raster_output(
                weighted_sum, output_name=output_name
            )
            final_name = f"Groundwater_potential_{uuid.uuid4().hex}.tif"
            final_path = self.processor.clip_to_basin(
                raster_path=constrained_path,
                shapefile_path=self.config.basin_shapefile , output_name=final_name
            )
            sld_path,sld_name=RasterProcess().processRaster(final_path,reverse=False)
            final_path1=self.processor.clip_to_user_villages(final_path,clip=clip,place=place)
            csv_path,csv_details=self.processor.clip_details(raster_path=final_path1,clip=clip,place=place,logic="priority")
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]  # Include milliseconds
            unique_store_name = f"{self.config.raster_store}_{timestamp}"
            tatus,layer_name=geo.publish_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path1)
            status=geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=sld_path, sld_name=layer_name)
            if status:
                os.remove(final_path)
                os.remove(sld_path)
                os.remove(csv_path)
                os.remove(constrained_path)
                os.remove(final_path1)
                return {
                    "workspace": self.config.raster_workspace,
                    "layer_name": layer_name,
                    "csv_path":csv_path,
                    "csv_details":csv_details
                }
            return False
        except Exception as e:
            print(e)
            return False

class GWPumpingMapper:
    def __init__(self, config: GeoConfig = None):
        self.config = config or GeoConfig()
        self.processor = RasterProcess(self.config)
    
    
    def get_visual_raster(self,db:db_dependency,clip:List[int]=None,place:str="Drain") -> str:
        try:
            print("clips",clip)
            raster_path=GWLI_service.get_GWLI_visual(db)
            raster_path = [{"file_name": i.file_name,
                            "path": os.path.abspath(Settings().BASE_DIR+"/"+i.file_path),                            
                           } for i in raster_path]
            print("raster_path",raster_path)
            response=[]
            print('str',place)
            for i in raster_path:
                final_path=self.processor.clip_to_user_villages(i['path'],clip=clip,place=place)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]  
                unique_store_name = f"{self.config.raster_store}_{timestamp}"
                status,layer_name=geo.publish_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path)
                sld_path,sld_name=RasterProcess().processRaster(final_path,reverse=True)
                sld_name=f"{layer_name}_sld_{uuid.uuid4().hex}"
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
        
    # def create_gwpz_map(self, raster_paths: List[str], weights: List[float],clip:List[int]=None,place:str=None) -> str:
    #     try:
    #         if len(raster_paths) != len(weights):
    #             raise ValueError(f"Number of rasters ({len(raster_paths)}) must match number of weights ({len(weights)})")
    #         self.processor.align_rasters(raster_paths)
    #         overlay_name=f"overlay_{uuid.uuid4().hex}_map.tif"
    #         weighted_sum = self.processor.create_weighted_overlay(
    #             weights, overlay_name
    #         )
    #         output_name=f"Final_Ground_water_Potential_{uuid.uuid4().hex}_map.tif"
    #         constrained_path, _ = self.processor.make_raster_output(
    #             weighted_sum, output_name=output_name
    #         )
    #         final_name = f"Groundwater_potential_{uuid.uuid4().hex}.tif"
    #         final_path = self.processor.clip_to_basin(
    #             raster_path=constrained_path,
    #             shapefile_path=self.config.basin_shapefile , output_name=final_name
    #         )
    #         sld_path,sld_name=RasterProcess().processRaster(final_path,reverse=True)
    #         final_path=self.processor.clip_to_user_villages(final_path,clip=clip,place=place)
    #         csv_path,csv_details=self.processor.clip_details(raster_path=final_path,clip=clip,place=place,logic="priority")
            
    #         timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]  # Include milliseconds
    #         unique_store_name = f"{self.config.raster_store}_{timestamp}"
    #         tatus,layer_name=geo.publish_raster(workspace_name=self.config.raster_workspace, store_name=unique_store_name, raster_path=final_path)
    #         status=geo.apply_sld_to_layer(workspace_name=self.config.raster_workspace, layer_name = layer_name,sld_content=sld_path, sld_name=layer_name)
    #         if status:
    #             return {
    #                 "workspace": self.config.raster_workspace,
    #                 "layer_name": layer_name,
    #                 "csv_path":csv_path,
    #                 "csv_details":csv_details
    #             }
    #         return False
    #     except Exception as e:
    #         print(e)
    #         return False
