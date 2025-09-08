import pandas as pd
import numpy as np
import geopandas as gpd
from datetime import datetime
import os
import rasterio
from rasterio.transform import from_bounds
from rasterio.crs import CRS
from rasterio.mask import mask
from rasterio.features import geometry_mask
from scipy.spatial.distance import cdist
from rasterstats import zonal_stats
from shapely.geometry import Point
from shapely.ops import unary_union
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

class GroundwaterRechargeView(APIView):
    permission_classes = [AllowAny]

    def interpolate_for_villages(self, points_gdf, filtered_gdf, cell_size=30, power=2):
        """
        Perform IDW interpolation over an area that covers all villages with buffer
        to ensure every village gets proper interpolated values
        """
        
        print(f"🏞️ Starting interpolation for {len(filtered_gdf)} villages using {len(points_gdf)} data points")
        
        # Create a buffered area that includes all villages plus extra margin
        village_buffer_distance = 2000  # 2km buffer around villages
        unified_villages = unary_union(filtered_gdf.geometry)
        buffered_area = unified_villages.buffer(village_buffer_distance)
        
        # Get bounds for the buffered area (this ensures full coverage)
        bounds = buffered_area.bounds
        
        print(f"📏 Interpolation area bounds: {bounds}")
        print(f"🎯 Using {village_buffer_distance}m buffer around villages")
        
        # Create grid parameters with adequate resolution
        width = int((bounds[2] - bounds[0]) / cell_size)
        height = int((bounds[3] - bounds[1]) / cell_size)
        
        # Ensure reasonable grid size for performance
        max_grid_size = 3000
        if width > max_grid_size or height > max_grid_size:
            scale_factor = max(width, height) / max_grid_size
            width = int(width / scale_factor)
            height = int(height / scale_factor)
            cell_size = cell_size * scale_factor
            print(f"⚠️ Grid size adjusted to {width}x{height}, cell size: {cell_size:.1f}m")
        
        print(f"📏 Grid parameters: {width}x{height}, cell size: {cell_size}m")
        
        # Create coordinate arrays for the full grid
        x = np.linspace(bounds[0], bounds[2], width)
        y = np.linspace(bounds[1], bounds[3], height)
        xx, yy = np.meshgrid(x, y)
        
        # Create transform for the raster
        transform = from_bounds(bounds[0], bounds[1], bounds[2], bounds[3], width, height)
        
        # Get all grid coordinates
        grid_coords = np.column_stack([xx.ravel(), yy.ravel()])
        total_pixels = len(grid_coords)
        
        print(f"🔍 Interpolating for {total_pixels:,} grid points")
        
        # Get point data for interpolation
        point_coords = np.column_stack([
            points_gdf.geometry.x.values,
            points_gdf.geometry.y.values
        ])
        point_values = points_gdf['water_fluctuation'].values
        
        # Remove NaN values
        valid_mask = ~np.isnan(point_values)
        point_coords = point_coords[valid_mask]
        point_values = point_values[valid_mask]
        
        if len(point_coords) < 3:
            raise ValueError(f"Insufficient valid points for interpolation: {len(point_coords)} < 3")
        
        print(f"📊 Using {len(point_coords)} valid data points for interpolation")
        
        # Calculate adaptive search radius based on point distribution and grid size
        if len(point_coords) > 1:
            distances = cdist(point_coords, point_coords)
            distances[distances == 0] = np.inf
            avg_min_distance = np.mean(np.min(distances, axis=1))
            # Use larger search radius to ensure good coverage
            search_radius = max(avg_min_distance * 5, cell_size * 3, 1000)  # At least 1km
        else:
            search_radius = cell_size * 10
        
        print(f"🎯 Using search radius: {search_radius:.1f}m")
        
        # Enhanced IDW interpolation that covers the entire area
        def comprehensive_idw_interpolation(grid_coords, point_coords, point_values, power, search_radius):
            interpolated = np.full(len(grid_coords), np.nan)
            
            # Process in chunks for memory efficiency
            chunk_size = 8000
            total_chunks = (len(grid_coords) + chunk_size - 1) // chunk_size
            
            print(f"🔄 Processing {total_chunks} chunks for interpolation")
            
            for chunk_idx in range(total_chunks):
                start_idx = chunk_idx * chunk_size
                end_idx = min(start_idx + chunk_size, len(grid_coords))
                chunk_coords = grid_coords[start_idx:end_idx]
                
                if chunk_idx % 20 == 0 or chunk_idx == total_chunks - 1:
                    progress = ((chunk_idx + 1) / total_chunks) * 100
                    print(f"   Interpolation progress: {progress:.1f}% ({chunk_idx + 1}/{total_chunks} chunks)")
                
                # Calculate distances for this chunk
                chunk_distances = cdist(chunk_coords, point_coords)
                
                for i, distances in enumerate(chunk_distances):
                    grid_idx = start_idx + i
                    
                    # Handle exact matches
                    exact_match_mask = distances < 1e-6
                    if np.any(exact_match_mask):
                        interpolated[grid_idx] = np.mean(point_values[exact_match_mask])
                        continue
                    
                    # Use points within search radius
                    within_radius = distances <= search_radius
                    num_within_radius = np.sum(within_radius)
                    
                    if num_within_radius >= 3:
                        # Use points within radius, but limit to best 20 for performance
                        radius_indices = np.where(within_radius)[0]
                        if len(radius_indices) > 20:
                            radius_distances = distances[radius_indices]
                            closest_in_radius = np.argsort(radius_distances)[:20]
                            selected_distances = radius_distances[closest_in_radius]
                            selected_values = point_values[radius_indices[closest_in_radius]]
                        else:
                            selected_distances = distances[radius_indices]
                            selected_values = point_values[radius_indices]
                    else:
                        # Use closest points if not enough within radius
                        min_points = min(8, len(point_coords))  # Use at least 8 closest points
                        closest_indices = np.argsort(distances)[:min_points]
                        selected_distances = distances[closest_indices]
                        selected_values = point_values[closest_indices]
                    
                    # IDW calculation with distance weighting
                    weights = 1 / (selected_distances ** power)
                    
                    # Apply distance decay for very far points
                    max_reasonable_distance = search_radius * 2
                    far_points = selected_distances > max_reasonable_distance
                    if np.any(far_points):
                        weights[far_points] *= 0.1  # Reduce weight of very distant points
                    
                    interpolated[grid_idx] = np.sum(weights * selected_values) / np.sum(weights)
            
            return interpolated
        
        # Perform interpolation over the entire buffered area
        interpolated_values = comprehensive_idw_interpolation(
            grid_coords, point_coords, point_values, power, search_radius
        )
        
        # Reshape to grid
        interpolated_grid = interpolated_values.reshape(height, width).astype(np.float32)
        
        # Create a mask to identify areas outside the buffered village region
        # This helps with visualization but doesn't remove data needed for village calculations
        region_mask = geometry_mask(
            [buffered_area], 
            transform=transform,
            invert=True,  # True for inside the geometry
            out_shape=(height, width)
        )
        
        # Apply mask - set areas far from villages to NoData for cleaner visualization
        # But keep a generous buffer to ensure all village boundaries have data
        interpolated_grid[~region_mask] = np.nan
        
        # Validate that we have good coverage
        valid_pixels = ~np.isnan(interpolated_grid)
        coverage_percentage = (np.sum(valid_pixels) / total_pixels) * 100
        
        print(f"✅ Interpolation completed successfully")
        print(f"   - Total grid pixels: {total_pixels:,}")
        print(f"   - Valid interpolated pixels: {np.sum(valid_pixels):,}")
        print(f"   - Coverage: {coverage_percentage:.1f}%")
        print(f"   - Value range: {np.nanmin(interpolated_grid):.3f} to {np.nanmax(interpolated_grid):.3f}")
        
        return interpolated_grid, bounds, width, height, transform, search_radius

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
            # Step 1: Load and process CSV
            csv_path = os.path.join('media', 'temp', csv_filename)
            if not os.path.exists(csv_path):
                return Response(
                    {"success": False, "message": f"CSV file not found at {csv_path}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            df = pd.read_csv(csv_path)
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

            # Step 2: Identify Pre/Post columns and calculate water fluctuation
            pre_columns = [col for col in df.columns if 'pre' in col.lower()]
            post_columns = [col for col in df.columns if 'post' in col.lower()]

            if not pre_columns or not post_columns:
                return Response(
                    {"success": False, "message": f"Could not find pre/post columns. Found pre: {pre_columns}, post: {post_columns}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"📊 Found pre columns: {pre_columns}")
            print(f"📊 Found post columns: {post_columns}")

            # Convert columns to numeric
            for col in pre_columns + post_columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

            # Calculate means and water fluctuation
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

            # Filter shapefile based on selection
            if selected_villages:
                gdf['village_co'] = gdf['village_co'].astype(str)
                selected_villages_str = [str(v) for v in selected_villages]
                filtered_gdf = gdf[gdf['village_co'].isin(selected_villages_str)]
                filter_type = "villages"
                filter_values = selected_villages_str
                print(f"🎯 Filtering by villages: {selected_villages_str}")
            else:
                gdf['SUBDIS_COD'] = pd.to_numeric(gdf['SUBDIS_COD'], errors='coerce')
                selected_subdistricts_num = [int(s) for s in selected_subdistricts]
                filtered_gdf = gdf[gdf['SUBDIS_COD'].isin(selected_subdistricts_num)]
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

            # Step 4: Comprehensive IDW Interpolation
            # Create point geometries from CSV coordinates
            points_gdf = gpd.GeoDataFrame(
                df,
                geometry=[Point(xy) for xy in zip(df['LONGITUDE'], df['LATITUDE'])],
                crs='EPSG:4326'  # Assuming lat/lon are in WGS84
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
            
            # Perform comprehensive interpolation that ensures village coverage
            try:
                interpolated_grid, bounds, width, height, transform, search_radius = self.interpolate_for_villages(
                    points_within_region, filtered_gdf, cell_size=30, power=2
                )
            except Exception as interp_error:
                return Response(
                    {"success": False, "message": f"Interpolation failed: {str(interp_error)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Save interpolated raster
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            raster_filename = f"water_fluctuation_comprehensive_{timestamp}.tif"
            raster_path = os.path.join('media', 'temp', raster_filename)
            
            # Ensure temp directory exists
            os.makedirs(os.path.dirname(raster_path), exist_ok=True)
            
            with rasterio.open(
                raster_path, 'w',
                driver='GTiff',
                height=height,
                width=width,
                count=1,
                dtype=rasterio.float32,
                crs=CRS.from_epsg(32644),
                transform=transform,
                nodata=np.nan,
                compress='lzw'
            ) as dst:
                dst.write(interpolated_grid, 1)
            
            print(f"💾 Saved comprehensive interpolated raster: {raster_filename}")

            # Step 5: Zonal Statistics - Calculate mean water fluctuation for each village
            village_geometries = []
            village_codes = []
            
            for idx, row in filtered_gdf.iterrows():
                village_geometries.append(row['geometry'])
                village_codes.append(row['village_co'])
            
            print(f"📊 Calculating zonal statistics for {len(village_geometries)} villages")
            
            # Calculate zonal statistics with more comprehensive stats
            zonal_results = zonal_stats(
                village_geometries,
                raster_path,
                stats=['mean', 'count', 'min', 'max', 'std', 'median'],
                nodata=np.nan,
                all_touched=True  # Include pixels that touch village boundaries
            )
            
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
                    recharge = shape_area * sy_value * mean_water_fluctuation
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
                "search_radius_meters": round(search_radius, 1),
                "idw_power": 2,
                "interpolation_type": "Comprehensive IDW with Village Coverage"
            }

            # Convert results to safe format (include all villages for reference)
            village_results = dataframe_to_safe_dict(results_df)

            # Prepare response
            response_data = {
                "success": True,
                "message": f"Comprehensive groundwater recharge analysis completed. {villages_with_data}/{total_villages} villages have interpolated data.",
                "metadata": {
                    "processing_timestamp": datetime.now().isoformat(),
                    "input_csv": csv_filename,
                    "filter_type": filter_type,
                    "filter_values": filter_values,
                    "pre_columns_found": pre_columns,
                    "post_columns_found": post_columns,
                    "interpolation_method": "Comprehensive IDW with Village Coverage",
                    "coordinate_system": "EPSG:32644",
                    "interpolation_coverage": f"Interpolated over buffered area to ensure village coverage",
                    "recharge_calculation": "recharge = Shape_Area × SY × mean_water_fluctuation",
                    "recharge_units": "cubic meters (m³)",
                    "data_quality_note": "All villages included in results; check pixel_count > 0 for villages with interpolated data"
                },
                "output_files": {
                    "interpolated_raster": {
                        "filename": raster_filename,
                        "path": raster_path,
                        "size_bytes": os.path.getsize(raster_path),
                        "description": "Comprehensive interpolation raster ensuring village coverage"
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