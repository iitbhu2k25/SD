# gwa/interpolation.py - COMPLETE WITH WORKING IDW FROM REFERENCE

from pathlib import Path
import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import from_origin, from_bounds
from scipy.spatial import cKDTree
import geopandas as gpd
from shapely.geometry import Point
from datetime import datetime
import os
import traceback

# Path to village shapefile
VILLAGES_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'media', 'gwa_data', 'gwa_shp', 'Final_Village', 'Village.shp'
)


def interpolate_csv_to_rasters(
    wells_data,
    selected_parameters,
    selected_year,
    village_ids,
    place,
    session_id,
    output_dir
):
    """
    Main function to interpolate CSV data to rasters using IDW method with cKDTree
    Always outputs in EPSG:4326 to match pre-existing rasters
    
    Args:
        wells_data: List of well dictionaries with coordinates and parameter values
        selected_parameters: List of parameter names to interpolate
        selected_year: Year for the data (string or int)
        village_ids: List of village/subdistrict IDs to filter area
        place: 'village' or 'subdistrict' - determines how to filter area
        session_id: Session ID for tracking and logging
        output_dir: Directory to save rasters (Path object)
    
    Returns:
        dict: Success status, interpolated rasters info, and failed parameters
    """
    print(f"[INTERPOLATION] ========== Starting Interpolation ==========")
    print(f"[INTERPOLATION] Session ID: {session_id}")
    print(f"[INTERPOLATION] Output directory: {output_dir}")
    print(f"[INTERPOLATION] Year: {selected_year}")
    print(f"[INTERPOLATION] Parameters: {selected_parameters}")
    print(f"[INTERPOLATION] Wells count: {len(wells_data)}")
    print(f"[INTERPOLATION] Place type: {place}")
    
    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # ===== LOAD AND FILTER VILLAGE SHAPEFILE =====
    try:
        print(f"[INTERPOLATION] Loading village shapefile from: {VILLAGES_PATH}")
        
        if not os.path.exists(VILLAGES_PATH):
            return {
                'success': False,
                'error': f'Village shapefile not found at {VILLAGES_PATH}',
                'interpolated_rasters': [],
                'failed_parameters': []
            }
        
        villages_vector = gpd.read_file(VILLAGES_PATH)
        
        if villages_vector.crs is None:
            villages_vector.set_crs("EPSG:4326", inplace=True)
        
        print(f"[INTERPOLATION] Loaded {len(villages_vector)} villages from shapefile")
        print(f"[INTERPOLATION] Village shapefile CRS: {villages_vector.crs}")
        
        # Filter to selected area
        if place == "village":
            village_ids_float = [float(x) for x in village_ids]
            selected_area = villages_vector[villages_vector['village_co'].isin(village_ids_float)]
            print(f"[INTERPOLATION] Filtering by village_co: {village_ids_float}")
        else:  # subdistrict
            village_ids_int = [int(x) for x in village_ids]
            selected_area = villages_vector[villages_vector['SUBDIS_COD'].isin(village_ids_int)]
            print(f"[INTERPOLATION] Filtering by SUBDIS_COD: {village_ids_int}")
        
        if selected_area.empty:
            return {
                'success': False,
                'error': 'No matching area found for provided IDs',
                'interpolated_rasters': [],
                'failed_parameters': []
            }
        
        # Get bounds in original CRS
        bounds_original = selected_area.total_bounds
        print(f"[INTERPOLATION] Selected area bounds (original CRS): {bounds_original}")
        print(f"[INTERPOLATION] Matched {len(selected_area)} areas")
        
        # Convert to UTM for interpolation (better for distance calculations)
        selected_area_utm = selected_area.to_crs("EPSG:32644")
        bounds_utm = selected_area_utm.total_bounds
        print(f"[INTERPOLATION] Selected area UTM bounds: {bounds_utm}")
        
    except Exception as e:
        print(f"[INTERPOLATION] ERROR loading shapefile: {e}")
        traceback.print_exc()
        return {
            'success': False,
            'error': f'Shapefile error: {str(e)}',
            'interpolated_rasters': [],
            'failed_parameters': []
        }
    
    # ===== PREPARE WELLS DATAFRAME =====
    try:
        df = pd.DataFrame(wells_data)
        print(f"[INTERPOLATION] Created dataframe with {len(df)} rows")
        print(f"[INTERPOLATION] CSV columns: {list(df.columns)}")
        
        # Validate required columns
        if 'Latitude' not in df.columns or 'Longitude' not in df.columns:
            return {
                'success': False,
                'error': 'Missing required Latitude/Longitude columns in CSV',
                'interpolated_rasters': [],
                'failed_parameters': []
            }
        
        # Clean coordinates
        df['Latitude'] = pd.to_numeric(df['Latitude'], errors='coerce')
        df['Longitude'] = pd.to_numeric(df['Longitude'], errors='coerce')
        
        # Remove rows with invalid coordinates
        initial_count = len(df)
        df = df.dropna(subset=['Latitude', 'Longitude'])
        removed_count = initial_count - len(df)
        
        if removed_count > 0:
            print(f"[INTERPOLATION] Removed {removed_count} wells with invalid coordinates")
        
        if len(df) == 0:
            return {
                'success': False,
                'error': 'No valid coordinates found in CSV data',
                'interpolated_rasters': [],
                'failed_parameters': []
            }
        
        print(f"[INTERPOLATION] Valid wells after cleaning: {len(df)}")
        
    except Exception as e:
        print(f"[INTERPOLATION] ERROR preparing dataframe: {e}")
        traceback.print_exc()
        return {
            'success': False,
            'error': f'Data preparation error: {str(e)}',
            'interpolated_rasters': [],
            'failed_parameters': []
        }
    
    # ===== CONVERT COORDINATES TO UTM FOR INTERPOLATION =====
    try:
        # Create GeoDataFrame with lat/lon in EPSG:4326
        points_gdf = gpd.GeoDataFrame(
            df,
            geometry=gpd.points_from_xy(df['Longitude'], df['Latitude'], crs="EPSG:4326")
        )
        
        # Convert to UTM for accurate distance-based interpolation
        points_utm = points_gdf.to_crs("EPSG:32644")
        
        # Extract UTM coordinates
        coords_xy_utm = np.array([(geom.x, geom.y) for geom in points_utm.geometry], dtype=np.float64)
        
        print(f"[INTERPOLATION] Converted {len(coords_xy_utm)} points to UTM (EPSG:32644)")
        print(f"[INTERPOLATION] UTM X range: {coords_xy_utm[:,0].min():.2f} to {coords_xy_utm[:,0].max():.2f}")
        print(f"[INTERPOLATION] UTM Y range: {coords_xy_utm[:,1].min():.2f} to {coords_xy_utm[:,1].max():.2f}")
        
    except Exception as e:
        print(f"[INTERPOLATION] ERROR in coordinate conversion: {e}")
        traceback.print_exc()
        return {
            'success': False,
            'error': f'Coordinate conversion error: {str(e)}',
            'interpolated_rasters': [],
            'failed_parameters': []
        }
    
    # ===== SETUP GRID IN UTM =====
    idw_cell_size = 30.0  # 30 meters resolution
    
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
    
    print(f"[INTERPOLATION] UTM Grid setup:")
    print(f"  - Rows: {rows}, Cols: {cols}")
    print(f"  - Cell size: {idw_cell_size}m")
    print(f"  - Extent: [{minx:.2f}, {miny:.2f}, {maxx:.2f}, {maxy:.2f}]")
    
    # ===== INTERPOLATE EACH PARAMETER =====
    interpolated_rasters = []
    failed_parameters = []
    
    for param in selected_parameters:
        try:
            print(f"[INTERPOLATION] ========== Processing: {param} ==========")
            
            # Check if parameter exists in CSV
            if param not in df.columns:
                print(f"[INTERPOLATION] ✗ {param}: Column not found in CSV")
                failed_parameters.append({
                    'parameter': param,
                    'reason': 'Column not found in CSV data'
                })
                continue
            
            # Get parameter values
            param_df = df[[param]].copy()
            param_df[param] = pd.to_numeric(param_df[param], errors='coerce')
            
            # Remove NaN values
            valid_mask = ~param_df[param].isna()
            valid_values = param_df.loc[valid_mask, param].values.astype(float)
            valid_coords = coords_xy_utm[valid_mask]
            
            if len(valid_values) < 3:
                print(f"[INTERPOLATION] ✗ {param}: Only {len(valid_values)} valid points (need 3 minimum)")
                failed_parameters.append({
                    'parameter': param,
                    'reason': f'Insufficient data points ({len(valid_values)}/3 required)'
                })
                continue
            
            print(f"[INTERPOLATION] {param}: {len(valid_values)} valid points")
            print(f"[INTERPOLATION] {param} value range: {valid_values.min():.2f} - {valid_values.max():.2f}")
            
            # Perform IDW interpolation in UTM
            Z_utm = arcgis_style_idw_ckdtree(
                coords_xy=valid_coords,
                values=valid_values,
                grid_transform=proj_transform,
                grid_shape=(rows, cols),
                power=2.0,
                search_mode='variable',
                n_neighbors=12,
                radius=None
            )
            
            print(f"[INTERPOLATION] IDW completed - UTM grid shape: {Z_utm.shape}")
            
            # Convert UTM raster to EPSG:4326
            print(f"[INTERPOLATION] Converting raster to EPSG:4326...")
            
            # First save UTM raster temporarily
            temp_utm_path = output_dir / f"temp_{param}_utm.tif"
            
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
            
            # Reproject to EPSG:4326
            from rasterio.warp import calculate_default_transform, reproject, Resampling
            
            with rasterio.open(temp_utm_path) as src:
                # Calculate transform for EPSG:4326
                transform_4326, width_4326, height_4326 = calculate_default_transform(
                    src.crs, 'EPSG:4326', src.width, src.height, *src.bounds,
                    resolution=(0.001, 0.001)  # ~100m resolution in degrees
                )
                
                # Create output raster in EPSG:4326
                output_path = output_dir / f"{param}_{selected_year}.tif"
                
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
                    
                    # Add metadata
                    dst.update_tags(
                        PARAMETER=param,
                        YEAR=str(selected_year),
                        SOURCE='CSV_UPLOAD_IDW',
                        SESSION_ID=session_id,
                        INTERPOLATION_METHOD='IDW_cKDTree',
                        WELLS_COUNT=str(len(valid_values)),
                        ORIGINAL_CRS='EPSG:32644',
                        OUTPUT_CRS='EPSG:4326'
                    )
            
            # Read back to get statistics
            with rasterio.open(output_path) as src:
                data_4326 = src.read(1)
                valid_data = data_4326[~np.isnan(data_4326)]
            
            # Clean up temp file
            os.remove(temp_utm_path)
            
            interpolated_rasters.append({
                'parameter': param,
                'output_path': str(output_path),
                'wells_used': len(valid_values),
                'raster_shape': data_4326.shape,
                'value_range': {
                    'min': float(np.min(valid_data)),
                    'max': float(np.max(valid_data)),
                    'mean': float(np.mean(valid_data))
                }
            })
            
            print(f"[INTERPOLATION] ✓ {param} → {output_path.name}")
            print(f"[INTERPOLATION] Raster shape: {data_4326.shape}")
            print(f"[INTERPOLATION] CRS: EPSG:4326")
            print(f"[INTERPOLATION] Value range: {np.min(valid_data):.2f} to {np.max(valid_data):.2f}")
            
        except Exception as e:
            print(f"[INTERPOLATION] ✗ {param}: {str(e)}")
            traceback.print_exc()
            failed_parameters.append({
                'parameter': param,
                'reason': str(e)
            })
    
    # ===== SUMMARY =====
    success = len(interpolated_rasters) > 0
    
    if success:
        message = f"Successfully interpolated {len(interpolated_rasters)}/{len(selected_parameters)} parameters"
        if len(failed_parameters) > 0:
            message += f" ({len(failed_parameters)} failed)"
    else:
        message = f"All {len(selected_parameters)} parameters failed interpolation"
    
    print(f"[INTERPOLATION] ========== Complete ==========")
    print(f"[INTERPOLATION] {message}")
    print(f"[INTERPOLATION] Output directory: {output_dir}")
    print(f"[INTERPOLATION] All rasters saved in EPSG:4326")
    
    return {
        'success': success,
        'interpolated_rasters': interpolated_rasters,
        'failed_parameters': failed_parameters,
        'message': message,
        'coordinate_system': 'geographic',
        'crs_used': 'EPSG:4326',
        'total_wells': len(df),
        'session_id': session_id
    }


def arcgis_style_idw_ckdtree(coords_xy, values, grid_transform, grid_shape,
                              power=2.0, search_mode="variable", n_neighbors=12, radius=None):
    """
    ArcGIS-style IDW using cKDTree for fast nearest neighbor search
    From working reference implementation
    
    Args:
        coords_xy: Nx2 array of point coordinates
        values: N array of values at points
        grid_transform: Affine transform for output grid
        grid_shape: (rows, cols) tuple
        power: IDW power parameter
        search_mode: 'variable' (k nearest) or 'fixed' (radius)
        n_neighbors: Number of neighbors for variable search
        radius: Search radius for fixed search
    
    Returns:
        2D array of interpolated values
    """
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