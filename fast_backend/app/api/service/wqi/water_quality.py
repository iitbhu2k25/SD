from app.api.schema.wqi import Well_input,Well_response
from typing import List
from sqlalchemy.orm import session
from app.database.crud.gwpz_crud import WQI
import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import from_origin, from_bounds
from scipy.spatial import cKDTree
import geopandas as gpd
from app.api.service.river_water_management.stp_operation import VectorProcess
from app.conf.settings import Settings



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



class WQ_Index:
    def get_well(self,db: session,payload:Well_input):
        return WQI(db).get_wqi(payload.subdis_cod,payload.year)
    
    def get_interpolate(self,db:session,payload:List[Well_response]):
        drop_column=['year','Location']
        df = pd.DataFrame([item.model_dump() for item in payload]).drop(columns=drop_column)
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

        initial_count = len(df)
        df = df.dropna(subset=['Latitude', 'Longitude'])
        removed_count = initial_count - len(df)
        selected_parameters=df
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
        idw_cell_size = 10.0
        vectors=VectorProcess()
        selected_area=vectors.get_basin()
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
        interpolated_rasters = []
        for param in selected_parameters:
            try:
                
                # Get parameter values
                param_df = df[[param]].copy()
                param_df[param] = pd.to_numeric(param_df[param], errors='coerce')
                
                # Remove NaN values
                valid_mask = ~param_df[param].isna()
                valid_values = param_df.loc[valid_mask, param].values.astype(float)
                valid_coords = coords_xy_utm[valid_mask]
                
                if len(valid_values) < 3:
                    print(f"[INTERPOLATION] ✗ {param}: Only {len(valid_values)} valid points (need 3 minimum)")
                    break
                
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
                

                temp_utm_path = Settings().TEMP_DIR / f"temp_{param}_utm.tif"
                
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
                    output_path = Settings().TEMP_DIR / f"{param}_.tif"
                    
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
                            SOURCE='CSV_UPLOAD_IDW',
                            INTERPOLATION_METHOD='IDW_cKDTree',
                            WELLS_COUNT=str(len(valid_values)),
                            ORIGINAL_CRS='EPSG:32644',
                            OUTPUT_CRS='EPSG:4326'
                        )
                
                # Read back to get statistics
                with rasterio.open(output_path) as src:
                    data_4326 = src.read(1)
                    valid_data = data_4326[~np.isnan(data_4326)]
                

                
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
               
    
    # ===== SUMMARY =====
        success = len(interpolated_rasters) > 0
        
        if success:
            message = f"Successfully interpolated {len(interpolated_rasters)}/{len(selected_parameters)} parameters"
          
        else:
            message = f"All {len(selected_parameters)} parameters failed interpolation"
        

