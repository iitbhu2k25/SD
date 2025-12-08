import pandas as pd
import numpy as np
import geopandas as gpd
from datetime import datetime
import os
import rasterio
from rasterio.transform import from_bounds, from_origin
from rasterio.crs import CRS
from rasterio.mask import mask
from rasterio.features import geometry_mask
from scipy.spatial import cKDTree
from rasterstats import zonal_stats
from shapely.geometry import Point
from shapely.ops import unary_union
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from concurrent.futures import ThreadPoolExecutor
import multiprocessing

class GroundwaterRechargeView(APIView):
    permission_classes = [AllowAny]

    def fast_zonal_stats(self, geometries, raster_path, stats_list, nodata=-9999, chunk_size=100):
        """
        ULTRA-FAST parallelized zonal statistics using multithreading
        """
        def process_chunk(start_idx):
            end_idx = min(start_idx + chunk_size, len(geometries))
            chunk_geoms = geometries[start_idx:end_idx]
            return zonal_stats(
                chunk_geoms,
                raster_path,
                stats=stats_list,
                nodata=nodata,
                all_touched=True
            )

        # Use all available CPU cores for maximum speed
        max_workers = min(multiprocessing.cpu_count(), 8)  # Cap at 8 to avoid overhead
        results = []

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all chunks for parallel processing
            futures = [
                executor.submit(process_chunk, i) 
                for i in range(0, len(geometries), chunk_size)
            ]
            
            # Collect results as they complete
            for future in futures:
                results.extend(future.result())

        return results

    def interpolate_for_villages(self, points_gdf, filtered_gdf, cell_size=30, power=2, 
                               search_mode="variable", n_neighbors=3, radius=None, nodata_val=-9999):
        """
        OPTIMIZED IDW interpolation - faster processing with chunking and memory optimization
        """
        
        print(f"🏞️ Starting OPTIMIZED IDW interpolation for {len(filtered_gdf)} villages using {len(points_gdf)} data points")
        print(f"📊 Interpolation parameters: cell_size={cell_size}m, power={power}, search_mode={search_mode}")
        
        if search_mode == "variable":
            print(f"   Using {n_neighbors} nearest neighbors")
        elif search_mode == "fixed":
            print(f"   Using all points within {radius}m radius")
        else:
            print(f"   Using global search (all points)")
        
        # Get raster grid extent directly from boundary
        minx, miny, maxx, maxy = filtered_gdf.total_bounds
        
        print(f"📏 Interpolation area bounds: ({minx:.0f}, {miny:.0f}, {maxx:.0f}, {maxy:.0f})")
        
        # Create grid coordinates - using more efficient approach
        x_coords = np.arange(minx, maxx, cell_size)
        y_coords = np.arange(miny, maxy, cell_size)
        grid_x, grid_y = np.meshgrid(x_coords, y_coords[::-1])  # flip y for raster
        
        width = len(x_coords)
        height = len(y_coords)
        
        print(f"📏 Grid parameters: {width}x{height}, cell size: {cell_size}m")
        
        # Extract coords & values - optimized for speed
        coords = np.array([(geom.x, geom.y) for geom in points_gdf.geometry])
        values = points_gdf['water_fluctuation'].to_numpy(dtype=np.float32)  # Use numpy directly for speed
        
        # Remove NaN values efficiently
        valid_mask = ~np.isnan(values)
        coords = coords[valid_mask]
        values = values[valid_mask]
        
        if len(coords) < 3:
            raise ValueError(f"Insufficient valid points for interpolation: {len(coords)} < 3")
        
        print(f"📊 Using {len(coords)} valid data points for interpolation")
        
        # KDTree for fast neighbor queries
        tree = cKDTree(coords)
        xi = np.column_stack([grid_x.ravel(), grid_y.ravel()])
        
        print(f"🔍 Interpolating for {len(xi):,} grid points")
        
        # OPTIMIZED IDW interpolation with chunking for better memory management and speed
        n_points = xi.shape[0]
        interpolated_values = np.empty(n_points, dtype=np.float32)
        
        # Use chunking to process large grids efficiently
        chunk_size = 10000  # Process 10k points at a time for optimal memory usage
        
        if search_mode == "variable":
            # Optimized variable search with chunking
            for start_idx in range(0, n_points, chunk_size):
                end_idx = min(start_idx + chunk_size, n_points)
                chunk = xi[start_idx:end_idx]
                
                dists, idxs = tree.query(chunk, k=n_neighbors)
                dists[dists == 0] = 1e-10
                weights = 1.0 / (dists ** power)
                vals = np.sum(weights * values[idxs], axis=1) / np.sum(weights, axis=1)
                interpolated_values[start_idx:end_idx] = vals
                
                # Progress reporting for large grids
                if n_points > 50000 and start_idx % (chunk_size * 5) == 0:
                    progress = ((end_idx / n_points) * 100)
                    print(f"   Progress: {progress:.1f}%")

        elif search_mode == "fixed":
            # Use all points within radius - chunked processing
            if radius is None:
                raise ValueError("Radius must be specified for fixed search mode")
            
            for start_idx in range(0, n_points, chunk_size):
                end_idx = min(start_idx + chunk_size, n_points)
                chunk = xi[start_idx:end_idx]
                
                for i, grid_point in enumerate(chunk):
                    neighbors = tree.query_ball_point(grid_point, r=radius)
                    if len(neighbors) == 0:
                        interpolated_values[start_idx + i] = np.nan
                    else:
                        dists = np.linalg.norm(coords[neighbors] - grid_point, axis=1)
                        dists[dists == 0] = 1e-10
                        weights = 1.0 / (dists ** power)
                        interpolated_values[start_idx + i] = np.sum(weights * values[neighbors]) / np.sum(weights)

        else:  # global
            # Global search with optimized vectorized operations
            for start_idx in range(0, n_points, chunk_size):
                end_idx = min(start_idx + chunk_size, n_points)
                chunk = xi[start_idx:end_idx]
                
                dists = np.linalg.norm(coords[:, None, :] - chunk[None, :, :], axis=2)
                dists[dists == 0] = 1e-10
                weights = 1.0 / (dists.T ** power)
                vals = np.sum(weights * values, axis=1) / np.sum(weights, axis=1)
                interpolated_values[start_idx:end_idx] = vals

        # Reshape to grid efficiently
        idw_grid = interpolated_values.reshape(grid_x.shape)
        
        # Create transform
        transform = from_origin(minx, maxy, cell_size, cell_size)
        
        # Convert to float32 for consistency and memory efficiency
        idw_grid = idw_grid.astype(np.float32)
        
        # Validate results
        valid_pixels = ~np.isnan(idw_grid)
        total_pixels = len(xi)
        coverage_percentage = (np.sum(valid_pixels) / total_pixels) * 100
        
        print(f"✅ OPTIMIZED IDW interpolation completed successfully")
        print(f"   - Total grid pixels: {total_pixels:,}")
        print(f"   - Valid interpolated pixels: {np.sum(valid_pixels):,}")
        print(f"   - Coverage: {coverage_percentage:.1f}%")
        print(f"   - Value range: {np.nanmin(idw_grid):.3f} to {np.nanmax(idw_grid):.3f}")
        
        # Get bounds for return
        bounds = (minx, miny, maxx, maxy)
        
        return idw_grid, bounds, width, height, transform, None

    def post(self, request):
        # Extract payload data
        csv_filename = request.data.get('csvFilename')
        selected_villages = request.data.get('selectedVillages')
        selected_subdistricts = request.data.get('selectedSubDistricts')

        # Validate required fields
        if not csv_filename:
            return Response(
                {"success": False, "message": "Missing required field: csvFilename"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not selected_villages and not selected_subdistricts:
            return Response(
                {"success": False, "message": "Either selectedVillages or selectedSubDistricts must be provided"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Step 1: Load and process CSV - OPTIMIZED
            csv_path = os.path.join('media', 'temp', csv_filename)
            if not os.path.exists(csv_path):
                return Response(
                    {"success": False, "message": f"CSV file not found at {csv_path}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Use faster CSV reading with dtype specification
            df = pd.read_csv(csv_path, dtype={'LATITUDE': 'float32', 'LONGITUDE': 'float32'})
            if df.empty:
                return Response(
                    {"success": False, "message": "CSV file is empty"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Clean column names
            df.columns = df.columns.str.strip()
            print(f"✅ Loaded CSV with {len(df)} rows and columns: {list(df.columns)}")

            # Validate coordinate columns
            if 'LATITUDE' not in df.columns or 'LONGITUDE' not in df.columns:
                return Response(
                    {"success": False, "message": f"Required coordinate columns 'LATITUDE', 'LONGITUDE' not found. Available: {list(df.columns)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Step 2: Identify Pre/Post columns and calculate water fluctuation - OPTIMIZED
            pre_columns = [col for col in df.columns if 'pre' in col.lower()]
            post_columns = [col for col in df.columns if 'post' in col.lower()]

            if not pre_columns or not post_columns:
                return Response(
                    {"success": False, "message": f"Could not find pre/post columns. Found pre: {pre_columns}, post: {post_columns}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"📊 Found pre columns: {pre_columns}")
            print(f"📊 Found post columns: {post_columns}")

            # Convert columns to numeric efficiently
            for col in pre_columns + post_columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

            # Calculate means and water fluctuation using vectorized operations
            df['pre_mean'] = df[pre_columns].mean(axis=1, skipna=True)
            df['post_mean'] = df[post_columns].mean(axis=1, skipna=True)
            df['water_fluctuation'] = df['pre_mean'] - df['post_mean']

            # Remove rows with NaN coordinates or water_fluctuation
            initial_count = len(df)
            df = df.dropna(subset=['LATITUDE', 'LONGITUDE', 'water_fluctuation'])
            
            if df.empty:
                return Response(
                    {"success": False, "message": "No valid data points after removing NaN values"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"🧮 Calculated water_fluctuation for {len(df)} valid points (removed {initial_count - len(df)} invalid)")

            # Step 3: Load and filter shapefile
            centroid_path = os.path.join('media', 'gwa_data', 'gwa_shp', 'Final_Village', 'Village_PET_PE_SY_Crop.shp')
            if not os.path.exists(centroid_path):
                return Response(
                    {"success": False, "message": f"Village shapefile not found at {centroid_path}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            gdf = gpd.read_file(centroid_path)
            if gdf.empty:
                return Response(
                    {"success": False, "message": "Village shapefile is empty"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"🗺️ Loaded village shapefile with {len(gdf)} features")

            # Validate required columns in shapefile
            required_shp_columns = ['village_co', 'SUBDIS_COD', 'village', 'SY', 'Shape_Area']
            missing_shp_columns = [col for col in required_shp_columns if col not in gdf.columns]
            if missing_shp_columns:
                return Response(
                    {"success": False, "message": f"Missing columns in shapefile: {missing_shp_columns}. Available: {list(gdf.columns)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"✅ Validated required shapefile columns: {required_shp_columns}")

            # Filter shapefile based on selection - OPTIMIZED
            if selected_villages:
                gdf['village_co'] = gdf['village_co'].astype(str)
                selected_villages_str = [str(v) for v in selected_villages]
                filtered_gdf = gdf[gdf['village_co'].isin(selected_villages_str)].copy()  # Use copy for better memory management
                filter_type = "villages"
                filter_values = selected_villages_str
                print(f"🎯 Filtering by villages: {selected_villages_str}")
            else:
                gdf['SUBDIS_COD'] = pd.to_numeric(gdf['SUBDIS_COD'], errors='coerce')
                selected_subdistricts_num = [int(s) for s in selected_subdistricts]
                filtered_gdf = gdf[gdf['SUBDIS_COD'].isin(selected_subdistricts_num)].copy()
                filter_type = "subdistricts"
                filter_values = selected_subdistricts_num
                print(f"🎯 Filtering by subdistricts: {selected_subdistricts_num}")

            if filtered_gdf.empty:
                return Response(
                    {"success": False, "message": f"No features found for selected {filter_type}: {filter_values}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"✅ Filtered shapefile to {len(filtered_gdf)} features")

            # Ensure shapefile is in EPSG:32644
            if filtered_gdf.crs != 'EPSG:32644':
                filtered_gdf = filtered_gdf.to_crs('EPSG:32644')
                print(f"🔄 Reprojected shapefile to EPSG:32644")

            # Step 4: OPTIMIZED IDW Interpolation
            # Create point geometries from CSV coordinates
            points_gdf = gpd.GeoDataFrame(
                df,
                geometry=[Point(xy) for xy in zip(df['LONGITUDE'], df['LATITUDE'])],
                crs='EPSG:4326'
            )
            
            # Reproject points to match shapefile CRS
            points_gdf = points_gdf.to_crs('EPSG:32644')
            
            # Use a larger buffer to include more data points for better interpolation
            unified_region = unary_union(filtered_gdf.geometry)
            point_selection_buffer = 5000  # 5km buffer to include relevant points
            buffered_region = unified_region.buffer(point_selection_buffer)
            
            # Find points within the expanded buffer
            points_within_region = points_gdf[points_gdf.geometry.within(buffered_region)]
            
            if len(points_within_region) < 3:
                # If still not enough points, use all available points
                points_within_region = points_gdf
                print(f"⚠️ Using all {len(points_gdf)} points (insufficient points within {point_selection_buffer}m buffer)")
            else:
                print(f"🎯 Using {len(points_within_region)} points within {point_selection_buffer}m buffer of selected region")
            
            # Ensure we have sufficient points for good interpolation
            if len(points_within_region) < 5:
                # If we still don't have enough points, expand to use more distant points
                print(f"⚠️ Limited data points ({len(points_within_region)}), using all available points for better interpolation")
                points_within_region = points_gdf
            
            # Perform OPTIMIZED IDW interpolation
            try:
                interpolated_grid, bounds, width, height, transform, _ = self.interpolate_for_villages(
                    points_within_region, filtered_gdf, 
                    cell_size=30, power=2, search_mode="variable", n_neighbors=3, 
                    radius=None, nodata_val=-9999
                )
            except Exception as interp_error:
                return Response(
                    {"success": False, "message": f"Interpolation failed: {str(interp_error)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Save full raster first (exactly like first file)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_raster = f"water_fluctuation_idw_full_{timestamp}.tif"
            output_raster_path = os.path.join('media', 'temp', output_raster)
            
            # Ensure temp directory exists
            os.makedirs(os.path.dirname(output_raster_path), exist_ok=True)
            
            # OPTIMIZED raster writing with compression
            with rasterio.open(
                output_raster_path, "w",
                driver="GTiff",
                height=interpolated_grid.shape[0],
                width=interpolated_grid.shape[1],
                count=1,
                dtype=rasterio.float32,
                crs=CRS.from_epsg(32644),
                transform=transform,
                nodata=-9999,
                compress='lzw',
                tiled=True,  # Enable tiling for better performance
                blockxsize=256,  # Optimal block size
                blockysize=256
            ) as dst:
                dst.write(interpolated_grid, 1)

            # Clip raster with village outline (mask outside polygon = NoData) - exactly like first file
            clipped_raster = f"water_fluctuation_idw_clipped_{timestamp}.tif"
            clipped_raster_path = os.path.join('media', 'temp', clipped_raster)
            
            with rasterio.open(output_raster_path) as src:
                out_image, out_transform = rasterio.mask.mask(
                    src,
                    filtered_gdf.geometry,
                    crop=True,
                    filled=True,
                    nodata=-9999
                )
                out_meta = src.meta.copy()
                out_meta.update({
                    "driver": "GTiff",
                    "height": out_image.shape[1],
                    "width": out_image.shape[2],
                    "transform": out_transform,
                    "nodata": -9999
                })

            with rasterio.open(clipped_raster_path, "w", **out_meta) as dest:
                dest.write(out_image)
            
            print(f"💾 OPTIMIZED IDW interpolation complete.")
            print(f"   • Full raster: {output_raster}")
            print(f"   • Clipped raster: {clipped_raster}")

            # Step 5: ULTRA-FAST Zonal Statistics with parallel processing
            village_geometries = []
            village_codes = []
            
            for idx, row in filtered_gdf.iterrows():
                village_geometries.append(row['geometry'])
                village_codes.append(row['village_co'])
            
            print(f"📊 Calculating ULTRA-FAST zonal statistics for {len(village_geometries)} villages using parallel processing")
            
            # Use ULTRA-FAST parallel zonal statistics
            # Optimal chunk size based on number of villages and available cores
            chunk_size = max(10, min(len(village_geometries) // (multiprocessing.cpu_count() * 2), 200))
            
            zonal_results = self.fast_zonal_stats(
                village_geometries,
                clipped_raster_path,
                ['mean', 'count', 'min', 'max', 'std', 'median'],
                nodata=-9999,
                chunk_size=chunk_size
            )
            
            print(f"✅ ULTRA-FAST zonal statistics completed!")
            
            # Step 6: Enhanced - Add recharge calculation using village, SY, and Shape_Area from shapefile
            print("🔧 Adding recharge calculation using village attributes from shapefile")
            
            # Create a mapping from village_co to shapefile attributes
            village_attributes_mapping = {}
            for idx, row in filtered_gdf.iterrows():
                village_code = str(row['village_co'])  # Ensure string format for consistency
                village_attributes_mapping[village_code] = {
                    'village_name': row['village'],
                    'sy_value': row['SY'],
                    'shape_area': row['Shape_Area']
                }
            
            print(f"📊 Created village attributes mapping for {len(village_attributes_mapping)} villages")
            
            # Add shapefile attributes and calculate recharge for the results DataFrame
            results_data_enhanced = []
            villages_without_data = []
            
            for i, (village_code, stats) in enumerate(zip(village_codes, zonal_results)):
                village_code_str = str(village_code)
                
                # Get mean water fluctuation from zonal stats
                mean_water_fluctuation = stats['mean'] if stats['mean'] is not None else np.nan
                pixel_count = stats['count'] if stats['count'] is not None else 0
                
                if pixel_count == 0 or pd.isna(mean_water_fluctuation):
                    villages_without_data.append(village_code_str)
                
                # Get attributes from shapefile
                village_attrs = village_attributes_mapping.get(village_code_str, {})
                village_name = village_attrs.get('village_name', np.nan)
                sy_value = village_attrs.get('sy_value', np.nan)
                shape_area = village_attrs.get('shape_area', np.nan)
                
                # Calculate recharge (Shape_Area * SY * mean_water_fluctuation)
                if (not pd.isna(mean_water_fluctuation) and 
                    not pd.isna(sy_value) and 
                    not pd.isna(shape_area) and
                    pixel_count > 0):
                    recharge = (shape_area * sy_value * mean_water_fluctuation)/1000
                else:
                    recharge = np.nan
                
                results_data_enhanced.append({
                    'village_co': village_code,
                    'village': village_name,
                    'SY': sy_value,
                    'Shape_Area': shape_area,
                    'mean_water_fluctuation': mean_water_fluctuation,
                    'median_water_fluctuation': stats['median'] if stats['median'] is not None else np.nan,
                    'min_water_fluctuation': stats['min'] if stats['min'] is not None else np.nan,
                    'max_water_fluctuation': stats['max'] if stats['max'] is not None else np.nan,
                    'std_water_fluctuation': stats['std'] if stats['std'] is not None else np.nan,
                    'pixel_count': pixel_count,
                    'recharge': recharge
                })
            
            # Create enhanced results DataFrame
            results_df = pd.DataFrame(results_data_enhanced)
            
            # Report on data coverage
            total_villages = len(results_df)
            villages_with_data = len(results_df[results_df['pixel_count'] > 0])
            villages_with_valid_recharge = results_df['recharge'].notna().sum()
            
            print(f"📈 Data coverage summary:")
            print(f"   - Total villages: {total_villages}")
            print(f"   - Villages with interpolated data: {villages_with_data}")
            print(f"   - Villages with valid recharge calculation: {villages_with_valid_recharge}")
            
            if villages_without_data:
                print(f"⚠️ Villages without interpolated data: {len(villages_without_data)}")
                print(f"   Village codes: {villages_without_data[:10]}{'...' if len(villages_without_data) > 10 else ''}")
            
            # Filter results to include villages with data, but keep all for reference
            valid_results_df = results_df[results_df['pixel_count'] > 0].copy()
            
            print(f"✅ Calculated recharge for {len(valid_results_df)} villages with valid data")
            
            if len(valid_results_df) > 0 and valid_results_df['recharge'].notna().sum() > 0:
                print(f"📈 Recharge statistics:")
                print(f"   - Mean recharge (m³): {valid_results_df['recharge'].mean():.2f}")
                print(f"   - Max recharge (m³): {valid_results_df['recharge'].max():.2f}")
                print(f"   - Min recharge (m³): {valid_results_df['recharge'].min():.2f}")
                print(f"   - Total recharge (m³): {valid_results_df['recharge'].sum():.2f}")
            
            # Step 7: Save complete village-wise results CSV (including villages without data for reference)
            results_filename = f"village_wise_groundwater_recharge_{timestamp}.csv"
            results_path = os.path.join('media', 'temp', results_filename)
            results_df.to_csv(results_path, index=False)  # Save all results, not just valid ones
            
            print(f"💾 Saved village-wise results: {results_filename}")

            # Helper functions for JSON serialization
            def safe_value(value):
                if pd.isna(value):
                    return None
                if isinstance(value, (np.integer, np.floating)):
                    if np.isnan(value) or np.isinf(value):
                        return None
                    return value.item()
                if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
                    return None
                return value

            def dataframe_to_safe_dict(df):
                records = []
                for _, row in df.iterrows():
                    record = {}
                    for col, value in row.items():
                        record[col] = safe_value(value)
                    records.append(record)
                return records

            # Calculate region statistics
            valid_pixels = ~np.isnan(interpolated_grid)
            region_area_m2 = np.sum(valid_pixels) * (30 * 30)  # assuming 30m cells
            region_area_km2 = region_area_m2 / 1000000

            # Calculate total recharge across all villages with valid data
            total_recharge_m3 = valid_results_df['recharge'].sum() if len(valid_results_df) > 0 and valid_results_df['recharge'].notna().sum() > 0 else 0
            total_recharge_mcm = total_recharge_m3 / 1_000_000  # Convert to Million Cubic Meters

            # Prepare enhanced summary statistics including recharge and coverage info
            summary_stats = {
                "total_villages": total_villages,
                "villages_with_interpolated_data": villages_with_data,
                "villages_with_valid_recharge": int(villages_with_valid_recharge),
                "villages_without_data": len(villages_without_data),
                "data_coverage_percentage": round((villages_with_data / total_villages) * 100, 1) if total_villages > 0 else 0,
                "total_points_used": len(points_within_region),
                "region_area_km2": round(region_area_km2, 2),
                "interpolated_pixels": int(np.sum(valid_pixels)),
                "mean_fluctuation_across_villages": safe_value(valid_results_df['mean_water_fluctuation'].mean()) if len(valid_results_df) > 0 else None,
                "max_fluctuation": safe_value(valid_results_df['mean_water_fluctuation'].max()) if len(valid_results_df) > 0 else None,
                "min_fluctuation": safe_value(valid_results_df['mean_water_fluctuation'].min()) if len(valid_results_df) > 0 else None,
                "mean_recharge_m3": safe_value(valid_results_df['recharge'].mean()) if len(valid_results_df) > 0 else None,
                "max_recharge_m3": safe_value(valid_results_df['recharge'].max()) if len(valid_results_df) > 0 else None,
                "min_recharge_m3": safe_value(valid_results_df['recharge'].min()) if len(valid_results_df) > 0 else None,
                "total_recharge_m3": safe_value(total_recharge_m3),
                "total_recharge_mcm": round(total_recharge_mcm, 4),
                "interpolation_grid_size": f"{width}x{height}",
                "cell_size_meters": 30,
                "idw_power": 2,
                "search_mode": "variable",
                "n_neighbors": 3,
                "interpolation_type": "ULTRA-OPTIMIZED IDW + Parallel Zonal Stats"
            }

            # Convert results to safe format (include all villages for reference)
            village_results = dataframe_to_safe_dict(results_df)

            # Prepare response
            response_data = {
                "success": True,
                "message": f"ULTRA-OPTIMIZED IDW groundwater recharge analysis completed. {villages_with_data}/{total_villages} villages have interpolated data.",
                "metadata": {
                    "processing_timestamp": datetime.now().isoformat(),
                    "input_csv": csv_filename,
                    "filter_type": filter_type,
                    "filter_values": filter_values,
                    "pre_columns_found": pre_columns,
                    "post_columns_found": post_columns,
                    "interpolation_method": "ULTRA-OPTIMIZED IDW + Parallel Zonal Stats",
                    "coordinate_system": "EPSG:32644",
                    "interpolation_parameters": {
                        "cell_size": 30,
                        "power": 2,
                        "search_mode": "variable",
                        "n_neighbors": 12,
                        "nodata_value": -9999,
                        "optimization": "chunked_processing + parallel_zonal_stats"
                    },
                    "recharge_calculation": "recharge = (Shape_Area × SY × mean_water_fluctuation)/1000",
                    "recharge_units": "cubic meters (m³)",
                    "data_quality_note": "All villages included in results; check pixel_count > 0 for villages with interpolated data"
                },
                "output_files": {
                    "interpolated_raster_full": {
                        "filename": output_raster,
                        "path": output_raster_path,
                        "size_bytes": os.path.getsize(output_raster_path),
                        "description": "ULTRA-OPTIMIZED Full IDW interpolation raster (before clipping)"
                    },
                    "interpolated_raster_clipped": {
                        "filename": clipped_raster,
                        "path": clipped_raster_path,
                        "size_bytes": os.path.getsize(clipped_raster_path),
                        "description": "ULTRA-OPTIMIZED Clipped IDW interpolation raster (used for zonal statistics)"
                    },
                    "village_results_csv": {
                        "filename": results_filename,
                        "path": results_path,
                        "size_bytes": os.path.getsize(results_path),
                        "description": "Complete village-wise results including coverage information"
                    }
                },
                "summary_statistics": summary_stats,
                "village_wise_results": village_results
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"❌ Error in groundwater recharge analysis: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {"success": False, "message": f"Error processing groundwater recharge analysis: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
