import os
from typing import List, Optional
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
from shapely.geometry import Polygon
from app.api.service.river_water_management.stp_operation import RasterProcess

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
subdistrict_path = os.path.join(BASE_DIR, 'media', 'Rajat_data', 'shape_stp', 'subdistrict', 'STP_subdistrict.shp')
villages_path = os.path.join(BASE_DIR, 'media', 'Rajat_data', 'shape_stp', 'villages', 'STP_Village.shp')


geo=Geoserver()

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
        print("#################inside")
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
            print("vector path", vector_path)
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
                print(f"Area of {place_type} {place_id}: {area_sqmeters:.2f} sq m")
                
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
            print("vector path", vector_path)
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
                    print(f"Area of {place_type} {place_id}: {area_sqmeters:.2f} sq m")
                    
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
            print("combined_pixel_data shape:", combined_pixel_data.shape)
            
            valid_mask = ~np.isnan(combined_pixel_data)
            print("valid_mask count:", np.sum(valid_mask))
            valid_values = combined_pixel_data[valid_mask]
            print("valid_values shape:", valid_values.shape)
            
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


    # def rasterclip(self, db: Session, district_id: int, subdistrict_ids: List[int], raster_path: str, layer_class  : str, month: int | None = None):
    #     data_array = rioxarray.open_rasterio(raster_path)  # Load without initial selection

    #     # Determine time index based on layer_class
    #     time_index = 0  # Default for yearly (first time step)
    #     if layer_class == "monthly" and month is not None and 1 <= month <= 12:
    #         time_index = month - 1  # Adjust for 0-based indexing (0–11 for 12 months)
    #     elif layer_class == "monthly" and (month is None or not 1 <= month <= 12):
    #         raise ValueError("Month must be between 1 and 12 for monthly data")

    #     # Select the appropriate time step based on 'TIME' dimension
    #     if 'TIME' in data_array.dims:
    #         data_array = data_array.isel(TIME=time_index)  # Use 'TIME' as per dataset
    #     else:
    #         raise ValueError(f"No 'TIME' dimension found in {raster_path}. Dimensions: {data_array.dims}")
        
    #     # Ensure CRS is set if not present
    #     if data_array.rio.crs is None:
    #         data_array.rio.write_crs("EPSG:4326", inplace=True)

    #     total_area = 0.0
    #     all_pixel_data = []
    #     results = []

    #     # Case 1: Single subdistrict_id with value 0 -> Use district shapefile
    #     if len(subdistrict_ids) == 1 and subdistrict_ids[0] == 0:
    #         vector_path = os.path.join(self.config.base_dir, 'media', 'Rajat_data', 'shape_stp', 'district', 'STP_district.shp')
    #         print("vector path", vector_path)
    #         vector_data = gpd.read_file(vector_path)
    #         vector_data = vector_data.to_crs("EPSG:4326")
    #         area_data = vector_data[vector_data['district_c'] == district_id]
    #         place_type = "district"
    #         place_id = district_id

    #         if not area_data.empty:
    #             # Reproject to UTM Zone 43N (EPSG:32643) for accurate area calculation
    #             area_data_utm = area_data.to_crs("EPSG:32643")
    #             area_sqmeters = area_data_utm.geometry.area.iloc[0]
    #             total_area += area_sqmeters
    #             print(f"Area of {place_type} {place_id}: {area_sqmeters:.2f} sq m")

    #             # Get bounding box of the area
    #             bounds = area_data.total_bounds
    #             lon_min, lat_min, lon_max, lat_max = bounds

    #             # Subset the data_array based on x and y coordinates
    #             subset_data = data_array.where(
    #                 (data_array.x >= lon_min) & (data_array.x <= lon_max) &
    #                 (data_array.y >= lat_min) & (data_array.y <= lat_max),
    #                 drop=True
    #             )
                
    #             # Collect pixel data
    #             pixel_data = subset_data.values.astype(np.float32)
    #             all_pixel_data.append(pixel_data)
    #             results.append({
    #                 "subdistrict_id": place_id,
    #                 "area": area_sqmeters
    #             })
    #         else:
    #             print(f"No {place_type} found for {place_type}_cod {place_id}")
    #             results.append({
    #                 "subdistrict_id": place_id,
    #                 "error": f"No {place_type} found for {place_type}_cod {place_id}",
    #                 "average_rainfall": None,
    #                 "area": None
    #             })
    #     else:
    #         # Case 2: Multiple subdistricts or single subdistrict (not 0) -> Use subdistrict shapefile
    #         vector_path = os.path.join(self.config.base_dir, 'media', 'Rajat_data', 'shape_stp', 'subdistrict', 'STP_subdistrict.shp')
    #         print("vector path", vector_path)
    #         vector_data = gpd.read_file(vector_path)
    #         vector_data = vector_data.to_crs("EPSG:4326")
    #         place_type = "subdistrict"

    #         for subdistrict_id in subdistrict_ids:
    #             area_data = vector_data[vector_data['subdis_cod'] == subdistrict_id]
    #             place_id = subdistrict_id

    #             if not area_data.empty:
    #                 # Reproject to UTM Zone 43N (EPSG:32643) for accurate area calculation
    #                 area_data_utm = area_data.to_crs("EPSG:32643")
    #                 area_sqmeters = area_data_utm.geometry.area.iloc[0]
    #                 total_area += area_sqmeters
    #                 print(f"Area of {place_type} {place_id}: {area_sqmeters:.2f} sq m")

    #                 # Get bounding box of the area
    #                 bounds = area_data.total_bounds
    #                 lon_min, lat_min, lon_max, lat_max = bounds

    #                 # Subset the data_array based on x and y coordinates
    #                 subset_data = data_array.where(
    #                     (data_array.x >= lon_min) & (data_array.x <= lon_max) &
    #                     (data_array.y >= lat_min) & (data_array.y <= lat_max),
    #                     drop=True
    #                 )
                    
    #                 # Collect pixel data
    #                 pixel_data = subset_data.values.astype(np.float32)
    #                 all_pixel_data.append(pixel_data)
    #                 results.append({
    #                     "subdistrict_id": place_id,
    #                     "area": area_sqmeters
    #                 })
    #             else:
    #                 print(f"No {place_type} found for {place_type}_cod {place_id}")
    #                 results.append({
    #                     "subdistrict_id": place_id,
    #                     "error": f"No {place_type} found for {place_type}_cod {place_id}",
    #                     "average_rainfall": None,
    #                     "area": None
    #                 })

    #     # Combine all pixel data for average rainfall calculation
    #     if all_pixel_data:
    #         combined_pixel_data = np.concatenate([data.flatten() for data in all_pixel_data])
    #         nodata_value = data_array.rio.nodata if data_array.rio.nodata is not None else np.nan
    #         print("nodata_value", nodata_value)
    #         if nodata_value is not None:
    #             combined_pixel_data[combined_pixel_data == nodata_value] = np.nan
    #         print("combined_pixel_data", combined_pixel_data)

    #         valid_mask = ~np.isnan(combined_pixel_data)
    #         print("valid_mask", valid_mask)
    #         valid_values = combined_pixel_data[valid_mask]
    #         print("valid_values", valid_values)
            
    #         average = 0.0 if valid_values.size == 0 else float(np.sum(valid_values) / valid_values.size)
    #     else:
    #         average = 0.0

    #     # Return combined results
    #     return {
    #         "results": results,
    #         "area": total_area,
    #         "average_rainfall": average
    #     }
    
    # def calculate_manual_rainfall(self, coordinates: List[List[float]], db: Session, raster_path: str, layer_class: str, month: int | None = None):
    #     try:
    #         # print("input coordinates", coordinates, "raster path", raster_path)
    #         # Validate coordinates
    #         if len(coordinates) < 4 or coordinates[0] != coordinates[-1]:
    #             raise HTTPException(status_code=400, detail="Coordinates must form a closed polygon with at least 4 points")

    #         # Create GeoJSON Polygon
    #         # geojson = {
    #         #     "type": "Feature",
    #         #     "geometry": {
    #         #         "type": "Polygon",
    #         #         "coordinates": [coordinates]
    #         #     },
    #         #     "properties": {}
    #         # }

    #         # Convert GeoJSON to GeoDataFrame
    #         poly = Polygon(coordinates)
    #         if not poly.is_valid or poly.is_empty:
    #             raise HTTPException(status_code=400, detail="Invalid polygon geometry")
    #         gdf = gpd.GeoDataFrame(geometry=[poly], crs="EPSG:4326")

    #         # Calculate area in m² (project to UTM for accurate area calculation)
    #         centroid = gdf.geometry.centroid.iloc[0]
    #         utm_zone = int((centroid.x + 180) / 6) + 1
    #         utm_crs = f"EPSG:326{utm_zone:02d}" if centroid.y >= 0 else f"EPSG:327{utm_zone:02d}"
    #         project = pyproj.Transformer.from_crs("EPSG:4326", utm_crs, always_xy=True).transform
    #         projected_geom = transform(project, gdf.geometry.iloc[0])
    #         area_sqmeters = float(projected_geom.area)  # Area in square meters

    #         # Load raster file
    #         try:
    #             da = rioxarray.open_rasterio(raster_path)
    #         except Exception as e:
    #             raise HTTPException(status_code=500, detail=f"Failed to open raster: {e}")
            
    #         # Determine time index based on layer_class
    #         time_index = 0
    #         if layer_class == "monthly":
    #             if month is None or not (1 <= month <= 12):
    #                 raise HTTPException(status_code=400, detail="month must be an integer 1–12 for monthly data")
    #             time_index = month - 1

    #         # # Select the appropriate time step based on 'TIME' dimension
    #         if 'TIME' in data_array.dims:
    #             data_array = data_array.isel(TIME=time_index)  # Use 'TIME' as per dataset
    #         else:
    #             raise ValueError(f"No 'TIME' dimension found in {raster_path}. Dimensions: {data_array.dims}")
            
    #         # Ensure CRS is set if not present
    #         if data_array.rio.crs is None:
    #             data_array.rio.write_crs("EPSG:4326", inplace=True)

    #         # Clip dataset with polygon
    #         clipped = data_array.rio.clip([gdf.geometry.iloc[0]], crs="EPSG:4326", drop=True)

    #         # Calculate average rainfall
    #         pixel_data = clipped.values.astype(np.float32)
    #         nodata_value = clipped.rio.nodata if clipped.rio.nodata is not None else np.nan
    #         if nodata_value is not None:
    #             pixel_data[pixel_data == nodata_value] = np.nan

    #         valid_mask = ~np.isnan(pixel_data)
    #         valid_values = pixel_data[valid_mask]
            
    #         rainfall_avg = 0.0 if valid_values.size == 0 else float(np.sum(valid_values) / valid_values.size)

    #         # Return response
    #         return {
    #             "status": "success",
    #             "area_sqmeters": round(area_sqmeters, 2),
    #             "rainfall_avg_mm": round(rainfall_avg, 2),
    #             "message": "Rainfall and area calculated successfully"
    #         }

    #     except Exception as e:
    #         raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")
    
    # from uuid import uuid4  # if you want to save clipped outputs with unique names

    # from typing import List, Optional
    # from fastapi import HTTPException
    # import numpy as np
    # import os
    # import rioxarray
    # import geopandas as gpd
    # from shapely.geometry import Polygon
    # from shapely.ops import transform
    # import pyproj

    # def calculate_manual_rainfall(
    #     self,
    #     coordinates: List[List[float]],
    #     db,
    #     raster_path: str,
    #     layer_class: str,             # kept for signature compatibility; not used here
    #     month: Optional[int] = None,  # kept for signature compatibility; not used here
    #     save_clipped: bool = False,
    #     output_dir: Optional[str] = None
    # ):
    #     try:
    #         # 1) Validate coordinates: closed polygon with at least 4 points
    #         if not isinstance(coordinates, list) or len(coordinates) < 4:
    #             raise HTTPException(status_code=400, detail="Coordinates must have at least 4 points")
    #         if coordinates[0] != coordinates[-1]:
    #             raise HTTPException(status_code=400, detail="Coordinates must be a closed ring (first equals last)")
    #         for pt in coordinates:
    #             if not isinstance(pt, list) or len(pt) != 2:
    #                 raise HTTPException(status_code=400, detail="Each coordinate must be [lon, lat]")

    #         # 2) Construct polygon and GeoDataFrame in WGS84
    #         poly = Polygon(coordinates)
    #         if not poly.is_valid or poly.is_empty:
    #             raise HTTPException(status_code=400, detail="Invalid polygon geometry")
    #         gdf = gpd.GeoDataFrame(geometry=[poly], crs="EPSG:4326")

    #         # 3) Compute area in m² (project to suitable UTM based on centroid)
    #         centroid = gdf.geometry.centroid.iloc[0]
    #         utm_zone = int((centroid.x + 180) / 6) + 1
    #         utm_crs = f"EPSG:326{utm_zone:02d}" if centroid.y >= 0 else f"EPSG:327{utm_zone:02d}"
    #         project = pyproj.Transformer.from_crs("EPSG:4326", utm_crs, always_xy=True).transform
    #         projected_geom = shapely.ops.transform(project, gdf.geometry.iloc[0])
    #         area_sqmeters = float(projected_geom.area)

    #         # 4) Open raster (assume single band; no time dimension)
    #         try:
    #             da = rioxarray.open_rasterio(raster_path)
    #         except Exception as e:
    #             raise HTTPException(status_code=500, detail=f"Failed to open raster: {e}")

    #         # 5) Ensure CRS and clip with polygon (WGS84)
    #         if da.rio.crs is None:
    #             da.rio.write_crs("EPSG:4326", inplace=True)

    #         # Reuse your helper to clip and get transform
    #         clipped_np, raster_transform = self._clip_raster_with_geometry(da, gdf.geometry.iloc[0])

    #         # 6) Optionally save clipped raster
    #         clipped_path = None
    #         if save_clipped:
    #             if not output_dir:
    #                 output_dir = "/home/app/output/clipped"
    #             os.makedirs(output_dir, exist_ok=True)
    #             clipped_path = os.path.join(output_dir, "polygon_clip.tif")
    #             self._save_clipped_raster(clipped_np, raster_transform, da.rio.crs, clipped_path)

    #         # 7) Compute rainfall average ignoring NoData/NaN
    #         arr = clipped_np
    #         if arr.size == 0:
    #             rainfall_avg = 0.0
    #         else:
    #             if arr.ndim == 3 and arr.shape[0] == 1:
    #                 arr = arr[0]
    #             arr = arr.astype(np.float32, copy=False)

    #             nodata = da.rio.nodata
    #             if nodata is not None and not np.isnan(nodata):
    #                 arr[arr == nodata] = np.nan

    #             valid = np.isfinite(arr)
    #             vals = arr[valid]
    #             rainfall_avg = float(np.nanmean(vals)) if vals.size > 0 else 0.0

    #         result = {
    #             "status": "success",
    #             "area_sqmeters": round(area_sqmeters, 2),
    #             "rainfall_avg_mm": round(rainfall_avg, 2),
    #             "message": "Rainfall and area calculated successfully"
    #         }
    #         if clipped_path:
    #             result["clipped_file"] = clipped_path

    #         return result

    #     except HTTPException:
    #         raise
    #     except Exception as e:
    #         raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

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
            
            print(f"Polygon intersects {num_pixels} pixels, average rainfall: {rainfall_avg}")
            # ============== END CORRECTED APPROACH ==============

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
