# app/services/recharge_service.py
import os
import numpy as np
import pandas as pd
import geopandas as gpd
import rasterio
from rasterio.transform import from_origin
from rasterio.crs import CRS
from rasterio.mask import mask
from scipy.spatial import cKDTree
from rasterstats import zonal_stats
from shapely.geometry import Point
from shapely.ops import unary_union
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
import multiprocessing


# ------------------------------------------
# Helper: Ultra-fast parallel zonal stats
# ------------------------------------------
def fast_zonal_stats(
    geometries: List,
    raster_path: str,
    stats_list: List[str],
    nodata: float = -9999,
    chunk_size: int = 100
) -> List[Dict]:
    def process_chunk(start_idx: int):
        end_idx = min(start_idx + chunk_size, len(geometries))
        chunk_geoms = geometries[start_idx:end_idx]
        return zonal_stats(
            chunk_geoms,
            raster_path,
            stats=stats_list,
            nodata=nodata,
            all_touched=True
        )

    max_workers = min(multiprocessing.cpu_count(), 8)
    results = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(process_chunk, i)
            for i in range(0, len(geometries), chunk_size)
        ]
        for future in futures:
            results.extend(future.result())

    return results


# --------------------------------------
# Helper: Optimized IDW interpolation
# --------------------------------------
def interpolate_for_villages(
    points_gdf: gpd.GeoDataFrame,
    filtered_gdf: gpd.GeoDataFrame,
    cell_size: int = 30,
    power: int = 2,
    search_mode: str = "variable",
    n_neighbors: int = 3,
    radius: Optional[float] = None,
    nodata_val: float = -9999
) -> Tuple[np.ndarray, Tuple[float, float, float, float], int, int, rasterio.Affine, None]:
    print(f"Starting IDW for {len(filtered_gdf)} villages using {len(points_gdf)} points")

    minx, miny, maxx, maxy = filtered_gdf.total_bounds
    x_coords = np.arange(minx, maxx, cell_size)
    y_coords = np.arange(miny, maxy, cell_size)
    grid_x, grid_y = np.meshgrid(x_coords, y_coords[::-1])
    width, height = len(x_coords), len(y_coords)

    coords = np.array([(g.x, g.y) for g in points_gdf.geometry])
    values = points_gdf['water_fluctuation'].to_numpy(dtype=np.float32)
    valid = ~np.isnan(values)
    coords, values = coords[valid], values[valid]

    if len(coords) < 3:
        # This will be handled by the fallback mechanism
        raise ValueError(f"Need ≥3 valid points for IDW, got {len(coords)}")

    tree = cKDTree(coords)
    xi = np.column_stack([grid_x.ravel(), grid_y.ravel()])
    n_points = xi.shape[0]
    out = np.empty(n_points, dtype=np.float32)
    chunk = 10000

    if search_mode == "variable":
        for s in range(0, n_points, chunk):
            e = min(s + chunk, n_points)
            chunk_pts = xi[s:e]
            dists, idxs = tree.query(chunk_pts, k=n_neighbors)
            dists[dists == 0] = 1e-10
            w = 1.0 / (dists ** power)
            out[s:e] = np.sum(w * values[idxs], axis=1) / np.sum(w, axis=1)

    elif search_mode == "fixed":
        if radius is None:
            raise ValueError("radius required")
        for s in range(0, n_points, chunk):
            e = min(s + chunk, n_points)
            for i, pt in enumerate(xi[s:e]):
                neigh = tree.query_ball_point(pt, r=radius)
                if not neigh:
                    out[s + i] = np.nan
                else:
                    d = np.linalg.norm(coords[neigh] - pt, axis=1)
                    d[d == 0] = 1e-10
                    w = 1.0 / (d ** power)
                    out[s + i] = np.sum(w * values[neigh]) / np.sum(w)

    else:  # global
        for s in range(0, n_points, chunk):
            e = min(s + chunk, n_points)
            chunk_pts = xi[s:e]
            d = np.linalg.norm(coords[:, None, :] - chunk_pts[None, :, :], axis=2)
            d[d == 0] = 1e-10
            w = 1.0 / (d.T ** power)
            out[s:e] = np.sum(w * values, axis=1) / np.sum(w, axis=1)

    grid = out.reshape(grid_x.shape).astype(np.float32)
    transform = from_origin(minx, maxy, cell_size, cell_size)
    bounds = (minx, miny, maxx, maxy)
    return grid, bounds, width, height, transform, None


# ----------------------------------------------------------------------
# Core Service Class
# ----------------------------------------------------------------------
class RechargeService:
    def __init__(self, media_root: str = "media"):
        self.media_root = media_root
        self.temp_dir = os.path.join(media_root, "temp")
        os.makedirs(self.temp_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # Fallback: Use CSV recharge when points < 3
    # ------------------------------------------------------------------
    def _fallback_to_csv_recharge(
        self,
        filtered: gpd.GeoDataFrame,
        filter_type: str,
        filter_vals: List,
        csv_filename: str,
        ts: str
    ) -> Dict[str, Any]:
        """
        When insufficient points for IDW, use pre-calculated recharge from CSV
        """
        print(f"⚠️ Insufficient points (<3). Falling back to CSV recharge data...")

        # Load recharge CSV
        recharge_csv_path = os.path.join(
            self.media_root, "gwa_data", "gwa_csv", "recharge.csv"
        )
        
        if not os.path.exists(recharge_csv_path):
            raise ValueError(f"Recharge CSV not found: {recharge_csv_path}")

        recharge_df = pd.read_csv(recharge_csv_path)
        recharge_df.columns = recharge_df.columns.str.strip()
        
        # Ensure village_co is string for matching
        recharge_df['village_co'] = recharge_df['village_co'].astype(str)
        filtered['village_co'] = filtered['village_co'].astype(str)

        # Filter recharge_df based on filter_type
        if filter_type == "villages":
            # Filter by village codes
            recharge_filtered = recharge_df[recharge_df['village_co'].isin([str(v) for v in filter_vals])]
        else:  # subdistricts
            # Filter by subdistrict codes
            recharge_df['SUBDIS_COD'] = pd.to_numeric(recharge_df['SUBDIS_COD'], errors='coerce')
            recharge_filtered = recharge_df[recharge_df['SUBDIS_COD'].isin(filter_vals)]

        if recharge_filtered.empty:
            raise ValueError(f"No matching data in recharge.csv for {filter_type}: {filter_vals}")

        # Build results directly from CSV data
        results = []
        no_data = []
        
        for _, row in recharge_filtered.iterrows():
            village_code = str(row['village_co'])
            recharge_val = row.get('recharge', np.nan)
            
            if pd.isna(recharge_val):
                no_data.append(village_code)
            
            results.append({
                'village_co': village_code,
                'village': row.get('village'),
                'SY': row.get('SY'),
                'Shape_Area': row.get('Shape_Area'),
                'mean_water_fluctuation': row.get('mean_water_fluctuation'),
                'median_water_fluctuation': row.get('median_water_fluctuation'),
                'min_water_fluctuation': row.get('min_water_fluctuation'),
                'max_water_fluctuation': row.get('max_water_fluctuation'),
                'std_water_fluctuation': row.get('std_water Villages'),  # Note: column name from CSV
                'pixel_count': row.get('pixel_count'),
                'recharge': recharge_val
            })

        results_df = pd.DataFrame(results)
        
        # Save results CSV
        csv_out = f"village_wise_groundwater_recharge_{ts}.csv"
        csv_path = os.path.join(self.temp_dir, csv_out)
        results_df.to_csv(csv_path, index=False)

        # Summary statistics
        valid = results_df[results_df['recharge'].notna()]
        total_recharge_m3 = valid['recharge'].sum() if not valid.empty else 0
        total_recharge_mcm = total_recharge_m3 / 1_000_000

        summary = {
            "total_villages": len(results_df),
            "villages_with_interpolated_data": len(valid),  # Using CSV data count
            "villages_with_valid_recharge": int(valid['recharge'].notna().sum()),
            "villages_without_data": len(no_data),
            "data_coverage_percentage": round((len(valid) / len(results_df)) * 100, 1) if len(results_df) > 0 else 0,
            "total_points_used": 0,  # No points used for interpolation
            "region_area_km2": round(valid['Shape_Area'].sum() / 1_000_000, 2) if not valid.empty else 0,
            "mean_recharge_m3": safe_float(valid['recharge'].mean()),
            "total_recharge_mcm": round(total_recharge_mcm, 4),
        }

        return {
            "success": True,
            "message": f"⚠️ Insufficient data points (<3). Used pre-calculated recharge from CSV. {len(valid)}/{len(results_df)} villages have data.",
            "metadata": {
                "processing_timestamp": datetime.now().isoformat(),
                "input_csv": csv_filename,
                "filter_type": filter_type,
                "filter_values": filter_vals,
                "interpolation_method": "CSV_FALLBACK (Insufficient points for IDW)",
                "recharge_calculation": "Pre-calculated values from recharge.csv",
                "data_source": recharge_csv_path
            },
            "output_files": {
                "interpolated_raster_full": None,  # No raster generated
                "interpolated_raster_clipped": None,
                "village_results_csv": {
                    "filename": csv_out, 
                    "path": csv_path, 
                    "size_bytes": os.path.getsize(csv_path)
                },
            },
            "summary_statistics": summary,
            "village_wise_results": [safe_dict(r) for r in results_df.to_dict("records")]
        }

    # ------------------------------------------------------------------
    # Main entry point – called from API
    # ------------------------------------------------------------------
    def analyze(
        self,
        csv_filename: str,
        selected_villages: Optional[List[str]] = None,
        selected_subdistricts: Optional[List[int]] = None,
    ) -> Dict[str, Any]:
        # === 1. Load & validate CSV ===
        csv_path = os.path.join(self.temp_dir, csv_filename)
        if not os.path.exists(csv_path):
            raise ValueError(f"CSV not found: {csv_path}")

        df = pd.read_csv(csv_path, dtype={'LATITUDE': 'float32', 'LONGITUDE': 'float32'})
        df.columns = df.columns.str.strip()

        if 'LATITUDE' not in df.columns or 'LONGITUDE' not in df.columns:
            raise ValueError("Missing LATITUDE/LONGITUDE")

        # === 2. Pre/Post & fluctuation ===
        pre_cols = [c for c in df.columns if 'pre' in c.lower()]
        post_cols = [c for c in df.columns if 'post' in c.lower()]
        if not pre_cols or not post_cols:
            raise ValueError(f"Pre/Post columns missing. Pre: {pre_cols}, Post: {post_cols}")

        for c in pre_cols + post_cols:
            df[c] = pd.to_numeric(df[c], errors='coerce')

        df['pre_mean'] = df[pre_cols].mean(axis=1, skipna=True)
        df['post_mean'] = df[post_cols].mean(axis=1, skipna=True)
        df['water_fluctuation'] = df['pre_mean'] - df['post_mean']
        df = df.dropna(subset=['LATITUDE', 'LONGITUDE', 'water_fluctuation'])

        if df.empty:
            raise ValueError("No valid points after cleaning")

        # === 3. Load & filter shapefile ===
        shp_path = os.path.join(self.media_root, "gwa_data", "gwa_shp", "Final_Village", "Village_PET_PE_SY_Crop.shp")
        if not os.path.exists(shp_path):
            raise ValueError(f"Shapefile missing: {shp_path}")

        gdf = gpd.read_file(shp_path)
        required = ['village_co', 'SUBDIS_COD', 'village', 'SY', 'Shape_Area']
        missing = [c for c in required if c not in gdf.columns]
        if missing:
            raise ValueError(f"Missing columns: {missing}")

        if selected_villages:
            gdf['village_co'] = gdf['village_co'].astype(str)
            filtered = gdf[gdf['village_co'].isin(selected_villages)].copy()
            filter_type, filter_vals = "villages", selected_villages
        else:
            gdf['SUBDIS_COD'] = pd.to_numeric(gdf['SUBDIS_COD'], errors='coerce')
            filtered = gdf[gdf['SUBDIS_COD'].isin(selected_subdistricts)].copy()
            filter_type, filter_vals = "subdistricts", selected_subdistricts

        if filtered.empty:
            raise ValueError(f"No villages for {filter_type}: {filter_vals}")

        if filtered.crs != 'EPSG:32644':
            filtered = filtered.to_crs('EPSG:32644')

        # === 4. Points in buffer ===
        points_gdf = gpd.GeoDataFrame(
            df,
            geometry=[Point(xy) for xy in zip(df['LONGITUDE'], df['LATITUDE'])],
            crs='EPSG:4326'
        ).to_crs('EPSG:32644')

        buffered = unary_union(filtered.geometry).buffer(5000)
        pts_in = points_gdf[points_gdf.geometry.within(buffered)]
        if len(pts_in) < 5:
            pts_in = points_gdf

        # === 5. Check if we have enough points for IDW ===
        valid_points = pts_in[~pts_in['water_fluctuation'].isna()]
        if len(valid_points) < 3:
            # FALLBACK: Use pre-calculated recharge from CSV
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            return self._fallback_to_csv_recharge(
                filtered=filtered,
                filter_type=filter_type,
                filter_vals=filter_vals,
                csv_filename=csv_filename,
                ts=ts
            )

        # === 6. IDW (only if points >= 3) ===
        grid, bounds, w, h, transform, _ = interpolate_for_villages(
            pts_in, filtered, cell_size=30, power=2, search_mode="variable", n_neighbors=3
        )

        # === 7. Save rasters ===
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        full_raster = f"water_fluctuation_idw_full_{ts}.tif"
        full_path = os.path.join(self.temp_dir, full_raster)
        with rasterio.open(
            full_path, "w", driver="GTiff", height=grid.shape[0], width=grid.shape[1], count=1,
            dtype=rasterio.float32, crs=CRS.from_epsg(32644), transform=transform,
            nodata=-9999, compress='lzw', tiled=True, blockxsize=256, blockysize=256
        ) as dst:
            dst.write(grid, 1)

        clipped_raster = f"water_fluctuation_idw_clipped_{ts}.tif"
        clipped_path = os.path.join(self.temp_dir, clipped_raster)
        with rasterio.open(full_path) as src:
            img, tr = mask(src, filtered.geometry, crop=True, filled=True, nodata=-9999)
            meta = src.meta.copy()
            meta.update({"height": img.shape[1], "width": img.shape[2], "transform": tr})
        with rasterio.open(clipped_path, "w", **meta) as dst:
            dst.write(img)

        # === 8. Zonal stats ===
        geoms = [r.geometry for _, r in filtered.iterrows()]
        codes = [r['village_co'] for _, r in filtered.iterrows()]
        chunk = max(10, min(len(geoms) // (multiprocessing.cpu_count() * 2), 200))
        stats = fast_zonal_stats(geoms, clipped_path, ['mean', 'count', 'min', 'max', 'std', 'median'], chunk_size=chunk)

        # === 9. Recharge ===
        attr_map = {
            str(r['village_co']): {'village_name': r['village'], 'sy_value': r['SY'], 'shape_area': r['Shape_Area']}
            for _, r in filtered.iterrows()
        }

        results = []
        no_data = []
        for code, stat in zip(codes, stats):
            code_str = str(code)
            mean_f = stat['mean'] if stat['mean'] is not None else np.nan
            count = stat['count']
            attrs = attr_map.get(code_str, {})
            recharge = (attrs.get('shape_area', np.nan) * attrs.get('sy_value', np.nan) * mean_f) / 1000 \
                       if count > 0 and not pd.isna(mean_f) else np.nan

            if count == 0 or pd.isna(mean_f):
                no_data.append(code_str)

            results.append({
                'village_co': code,
                'village': attrs.get('village_name'),
                'SY': attrs.get('sy_value'),
                'Shape_Area': attrs.get('shape_area'),
                'mean_water_fluctuation': mean_f,
                'median_water_fluctuation': stat['median'],
                'min_water_fluctuation': stat['min'],
                'max_water_fluctuation': stat['max'],
                'std_water_fluctuation': stat['std'],
                'pixel_count': count,
                'recharge': recharge
            })

        results_df = pd.DataFrame(results)
        csv_out = f"village_wise_groundwater_recharge_{ts}.csv"
        csv_path = os.path.join(self.temp_dir, csv_out)
        results_df.to_csv(csv_path, index=False)

        # === 10. Summary ===
        valid = results_df[results_df['pixel_count'] > 0]
        total_recharge_m3 = valid['recharge'].sum() if not valid.empty else 0
        total_recharge_mcm = total_recharge_m3 / 1_000_000

        summary = {
            "total_villages": len(results_df),
            "villages_with_interpolated_data": len(valid),
            "villages_with_valid_recharge": int(valid['recharge'].notna().sum()),
            "villages_without_data": len(no_data),
            "data_coverage_percentage": round((len(valid) / len(results_df)) * 100, 1) if len(results_df) > 0 else 0,
            "total_points_used": len(pts_in),
            "region_area_km2": round((np.sum(~np.isnan(grid)) * 900) / 1_000_000, 2),
            "mean_recharge_m3": safe_float(valid['recharge'].mean()),
            "total_recharge_mcm": round(total_recharge_mcm, 4),
        }

        # === 11. Response ===
        return {
            "success": True,
            "message": f"Analysis complete. {len(valid)}/{len(results_df)} villages have data.",
            "metadata": {
                "processing_timestamp": datetime.now().isoformat(),
                "input_csv": csv_filename,
                "filter_type": filter_type,
                "filter_values": filter_vals,
                "interpolation_method": "ULTRA-OPTIMIZED IDW + Parallel Zonal Stats",
                "recharge_calculation": "recharge = (Shape_Area × SY × mean_water_fluctuation)/1000",
            },
            "output_files": {
                "interpolated_raster_full": {"filename": full_raster, "path": full_path, "size_bytes": os.path.getsize(full_path)},
                "interpolated_raster_clipped": {"filename": clipped_raster, "path": clipped_path, "size_bytes": os.path.getsize(clipped_path)},
                "village_results_csv": {"filename": csv_out, "path": csv_path, "size_bytes": os.path.getsize(csv_path)},
            },
            "summary_statistics": summary,
            "village_wise_results": [safe_dict(r) for r in results_df.to_dict("records")]
        }


# ----------------------------------------------------------------------
# JSON-safe helpers
# ----------------------------------------------------------------------
def safe_float(x):
    return None if pd.isna(x) or np.isinf(x) or np.isnan(x) else float(x)

def safe_dict(row):
    return {k: safe_float(v) if isinstance(v, (np.floating, float)) and (np.isnan(v) or np.isinf(v)) else (None if pd.isna(v) else v)
            for k, v in row.items()}