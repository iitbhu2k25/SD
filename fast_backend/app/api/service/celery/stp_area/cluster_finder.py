"""
Standalone synchronous cluster finder for Manual STP mode.
Temporary replacement for the Celery-based manual_find_suitable_area task.
Same logic as ManualSTPArea — no Celery, no DB writes, returns result directly.
"""

import json
import os
import tempfile
import zipfile
from pathlib import Path

import geopandas as gpd
import networkx as nx
import numpy as np
import pandas as pd
import rasterio
from pyproj import Transformer
from rasterio.features import shapes
from scipy.ndimage import label
from shapely.geometry import LineString, MultiLineString, Point, shape

from app.api.service.geoserver_svc.geoserver import Geoserver
from app.conf.redis.redis_manager import redis_manager
from app.conf.settings import Settings
from app.utils.exception import CustomException
from app.utils.name import Unique_name


SUITABILITY_THRESHOLD = 0.417


_TEMP_STP_OVERRIDE = "/home/app/temp/stp.tif"

def _read_raster(layer_name: str):
    raster_path = _TEMP_STP_OVERRIDE
    with rasterio.open(raster_path) as src:
        data = src.read(1)
        transform = src.transform
        crs = src.crs
        nodata = src.nodata
        if nodata is not None:
            data = np.where(data == nodata, np.nan, data)
        data = np.where((data < 0) | (data > 1), np.nan, data)
        res_x = abs(transform[0])
        res_y = abs(transform[4])
    return data, res_x, res_y, transform, crs


def _apply_threshold(data, threshold):
    mask = (~np.isnan(data)) & (data >= threshold)
    out = np.zeros_like(data, dtype=np.uint8)
    out[mask] = 1
    return out


def _calculate_required_pixels(required_area_m2, res_x, res_y):
    pixel_area = res_x * res_y
    pixels_needed = int(np.ceil(required_area_m2 / pixel_area))
    kernel_size = int(np.ceil(np.sqrt(pixels_needed)))
    return kernel_size, pixels_needed


def _find_suitable_areas(reclassified, kernel_size, required_pixels):
    rows, cols = reclassified.shape
    mask = np.zeros_like(reclassified, dtype=np.uint8)
    for i in range(rows - kernel_size + 1):
        for j in range(cols - kernel_size + 1):
            window = reclassified[i:i + kernel_size, j:j + kernel_size]
            if np.sum(window) >= required_pixels:
                mask[i:i + kernel_size, j:j + kernel_size] = 1
    return mask


def _extract_clusters(mask, transform, crs):
    labeled, _ = label(mask)
    polygons = []
    for geom, val in shapes(labeled.astype(np.uint8), transform=transform):
        if val > 0:
            polygons.append(shape(geom))
    gdf = gpd.GeoDataFrame(geometry=polygons, crs=crs)
    gdf["cluster_id"] = range(len(gdf))
    gdf["area_ha"] = gdf.area / 10000
    return gdf


def _find_suitable_cluster(mld_capacity, treatment_technology, custom_land_per_mld, layer_name):
    req_ha = (mld_capacity * treatment_technology) + custom_land_per_mld
    req_m2 = req_ha * 10000
    data, rx, ry, transform, crs = _read_raster(layer_name)
    threshold_mask = _apply_threshold(data, SUITABILITY_THRESHOLD)
    kernel_size, required_pixels = _calculate_required_pixels(req_m2, rx, ry)
    suitable_mask = _find_suitable_areas(threshold_mask, kernel_size, required_pixels)
    clusters_gdf = _extract_clusters(suitable_mask, transform, crs)

    if len(clusters_gdf) < 10:
        all_clusters_gdf = _extract_clusters(threshold_mask, transform, crs)
        if not all_clusters_gdf.empty:
            all_clusters_gdf = all_clusters_gdf.sort_values("area_ha", ascending=False).head(30)
            if clusters_gdf.empty:
                clusters_gdf = all_clusters_gdf
            else:
                clusters_gdf = gpd.GeoDataFrame(
                    pd.concat([clusters_gdf, all_clusters_gdf], ignore_index=True),
                    crs=crs,
                ).drop_duplicates(subset=["cluster_id"]).reset_index(drop=True)

    if clusters_gdf.empty:
        raise CustomException(status_code=404, detail="Suitable area not found")
    return clusters_gdf, crs


def _build_graph(road_path, crs):
    roads = gpd.read_file(road_path).to_crs(crs)
    G = nx.Graph()
    for row in roads.itertuples():
        geom = row.geometry
        lines = (
            [geom] if geom.geom_type == "LineString"
            else (list(geom.geoms) if geom.geom_type == "MultiLineString" else [])
        )
        for line in lines:
            coords = list(line.coords)
            for i in range(len(coords) - 1):
                p1, p2 = coords[i], coords[i + 1]
                G.add_edge(p1, p2, weight=Point(p1).distance(Point(p2)))
    return G


def _nearest(G, pt):
    nodes = np.array(list(G.nodes))
    if len(nodes) == 0:
        return None
    pt_arr = np.array(pt)
    if np.any(np.isnan(pt_arr)):
        return None
    return tuple(nodes[int(np.argmin(np.linalg.norm(nodes - pt_arr, axis=1)))])


def _road_path(G, src, tgt):
    try:
        s = _nearest(G, src)
        t = _nearest(G, tgt)
        if s is None or t is None:
            return None
        path = nx.shortest_path(G, s, t, weight="weight")
        return LineString(path)
    except Exception:
        return None


def _publish_path_sync(gdf, name, temp_dir):
    unique_zip = os.path.join(temp_dir, f"{name}.zip")
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_shp = Path(tmp) / f"{name}.shp"
            gdf.to_file(tmp_shp, driver="ESRI Shapefile", engine="fiona")
            with zipfile.ZipFile(unique_zip, "w") as zipf:
                for f in Path(tmp).glob(f"{name}.*"):
                    zipf.write(f, f.name)
        ok = Geoserver().celery_upload_vector("vector_work", unique_zip, name)
        return name if ok else None
    except Exception as e:
        print(f"[cluster_finder] path publish failed: {e}", flush=True)
        return None
    finally:
        try:
            os.remove(unique_zip)
        except Exception:
            pass


def _publish_cluster_vector(clusters_gdf, name, temp_dir):
    unique_zip = os.path.join(temp_dir, f"{name}.zip")
    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_shp = Path(tmp) / f"{name}.shp"
            clusters_gdf.to_file(tmp_shp, driver="ESRI Shapefile", engine="fiona")
            with zipfile.ZipFile(unique_zip, "w") as zipf:
                for f in Path(tmp).glob(f"{name}.*"):
                    zipf.write(f, f.name)
        Geoserver().celery_upload_vector("vector_work", unique_zip, name)
        return name
    except Exception as e:
        print(f"[cluster_finder] cluster publish failed: {e}", flush=True)
        return None
    finally:
        try:
            os.remove(unique_zip)
        except Exception:
            pass


def find_clusters_sync(
    treatment_technology: float,
    mld_capacity: float,
    custom_land_per_mld: float,
    layer_name: str,
    location: list,
    drain_points: list = None,
    num_clusters: int = 10,
) -> dict:
    """
    Synchronous cluster finder — same logic as the Celery task manual_find_suitable_area
    but runs directly in the FastAPI request (no Celery, no DB writes).

    Returns:
        {
            "cluster_layer": str | None,
            "cluster_distances": list | None,
        }
    """
    settings = Settings()
    temp_dir = settings.TEMP_DIR

    clusters_gdf, crs = _find_suitable_cluster(
        mld_capacity, treatment_technology, custom_land_per_mld, layer_name
    )

    # Centroid of the selected polygon area
    lat_sum = lon_sum = 0
    for lat, lon in location:
        lat_sum += lat
        lon_sum += lon
    n = len(location)
    longitude, latitude = lon_sum / n, lat_sum / n

    transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    src_x, src_y = transformer.transform(longitude, latitude)
    src_pt = np.array([src_x, src_y])

    centroids = np.array([
        (row.geometry.centroid.x, row.geometry.centroid.y)
        for row in clusters_gdf.itertuples()
    ])
    dists = np.linalg.norm(centroids - src_pt, axis=1)
    clusters_gdf = clusters_gdf.copy()
    clusters_gdf["dist_to_polygon_m"] = dists
    top_gdf = clusters_gdf.sort_values("dist_to_polygon_m").head(num_clusters).reset_index(drop=True)
    top_gdf["rank"] = range(1, len(top_gdf) + 1)

    road_path = settings.road_path
    G = _build_graph(road_path, crs)

    drain_pts_utm = []
    for dp in (drain_points or []):
        dx, dy = transformer.transform(dp["longitude"], dp["latitude"])
        drain_pts_utm.append({
            "Drain_No": dp["Drain_No"], "x": dx, "y": dy,
            "Elevation": dp.get("Elevation", 0),
        })

    drain_nearest_nodes = {
        dp["Drain_No"]: _nearest(G, (dp["x"], dp["y"])) for dp in drain_pts_utm
    }

    cluster_drain_distances = []
    for rank, row in enumerate(top_gdf.itertuples(), start=1):
        c = row.geometry.centroid
        c_src = (c.x, c.y)
        c_arr = np.array([c.x, c.y])
        c_nearest = _nearest(G, c_src)

        drain_dists = []
        road_lines = []

        for dp in drain_pts_utm:
            d_tgt = (dp["x"], dp["y"])
            d_arr = np.array([dp["x"], dp["y"]])
            road_line = _road_path(G, c_src, d_tgt)
            if road_line is not None and not road_line.is_empty:
                dist_m = float(road_line.length)
                road_lines.append(road_line)
                t_node = drain_nearest_nodes[dp["Drain_No"]]
                if c_nearest and tuple(c_nearest) != c_src:
                    road_lines.append(LineString([c_src, c_nearest]))
                if t_node and tuple(t_node) != d_tgt:
                    road_lines.append(LineString([d_tgt, t_node]))
            else:
                dist_m = float(np.linalg.norm(c_arr - d_arr))
                road_lines.append(LineString([c_src, d_tgt]))

            drain_dists.append({
                "Drain_No": dp["Drain_No"],
                "distance_m": round(dist_m, 1),
                "elevation": dp.get("Elevation", 0),
            })

        path_layer_name = None
        if road_lines:
            try:
                valid_lines = [ln for ln in road_lines if ln is not None and not ln.is_empty]
                if valid_lines:
                    multi_line = MultiLineString([list(ln.coords) for ln in valid_lines])
                    path_gdf = gpd.GeoDataFrame(geometry=[multi_line], crs=crs).to_crs("EPSG:4326")
                    path_name = Unique_name.unique_name("manual_cluster_path")
                    path_layer_name = _publish_path_sync(path_gdf, path_name, temp_dir)
            except Exception as e:
                print(f"[cluster_finder] path failed rank {rank}: {e}", flush=True)

        cluster_drain_distances.append({
            "cluster_rank": rank,
            "area_ha": round(float(row.area_ha), 4),
            "dist_to_polygon_m": round(float(row.dist_to_polygon_m), 1),
            "drains": drain_dists,
            "path_layer": path_layer_name,
        })

    cluster_layer = None
    if not top_gdf.empty:
        cluster_name = Unique_name.unique_name("manual_final_cluster")
        cluster_layer = _publish_cluster_vector(top_gdf, cluster_name, temp_dir)

    return {
        "cluster_layer": cluster_layer,
        "cluster_distances": cluster_drain_distances if cluster_drain_distances else None,
    }
