"""
Standalone synchronous road network path finder for Manual STP mode.
Temporary replacement — no Celery, runs directly in FastAPI request.
Same logic as ManualSTPMapper.find_manual_path() in manual_stp_service.py.
"""

import asyncio
import tempfile
import uuid
import zipfile
from pathlib import Path

import aiohttp
import geopandas as gpd
import networkx as nx
import numpy as np
from pyproj import Transformer
from shapely.geometry import LineString, shape
from shapely.ops import unary_union

from app.api.service.celery.stp_area.manual_stp_area import ManualSTPArea
from app.api.service.geoserver_svc.geoserver import Geoserver
from app.utils.network_conf import GeoConfig


async def _fetch_layer_features(layer_name: str) -> list:
    cfg = GeoConfig()
    wfs_url = (
        f"{cfg.geoserver_url}/wfs?service=WFS&version=2.0.0&request=GetFeature"
        f"&typeName=vector_work:{layer_name}&outputFormat=application/json&srsname=EPSG:4326"
    )
    async with aiohttp.ClientSession() as session:
        async with session.get(wfs_url, auth=aiohttp.BasicAuth(cfg.username, cfg.password)) as resp:
            fc = await resp.json(content_type=None)
    return fc.get("features", [])


async def _fetch_layer_geom(layer_name: str):
    features = await _fetch_layer_features(layer_name)
    geoms = [shape(f["geometry"]) for f in features if f.get("geometry")]
    return unary_union(geoms) if geoms else None


def _build_road_graph(road_path: str, crs: str) -> nx.Graph:
    stp = ManualSTPArea()
    return stp._build_graph(crs)


def _find_paths_sync(
    src_point: tuple,
    drain_projected: list,
    road_path: str,
    crs: str,
    bbox_minx_m, bbox_miny_m, bbox_maxx_m, bbox_maxy_m,
):
    stp = ManualSTPArea()
    G = stp._build_graph(crs)
    if not G.nodes:
        return None, []

    if bbox_minx_m is not None:
        pad = 2000
        local_nodes = {
            n for n in G.nodes
            if bbox_minx_m - pad <= n[0] <= bbox_maxx_m + pad
            and bbox_miny_m - pad <= n[1] <= bbox_maxy_m + pad
        }
        G = G.subgraph(local_nodes).copy()
        if not G.nodes:
            return None, []

    node_list = list(G.nodes)
    nodes = np.array(node_list)
    src_arr = np.array(src_point)
    src_node = node_list[int(np.argmin(np.linalg.norm(nodes - src_arr, axis=1)))]

    all_lines = []
    drain_road_distances = []

    for (dx, dy), drain_no, elevation in drain_projected:
        tgt_arr = np.array([dx, dy])
        tgt_node = node_list[int(np.argmin(np.linalg.norm(nodes - tgt_arr, axis=1)))]

        if src_node == tgt_node:
            drain_road_distances.append({"Drain_No": drain_no, "distance_m": 0.0, "elevation": elevation})
            continue

        try:
            path_nodes = nx.shortest_path(G, src_node, tgt_node, weight="weight")
            road_dist = nx.shortest_path_length(G, src_node, tgt_node, weight="weight")
        except Exception:
            drain_road_distances.append({
                "Drain_No": drain_no,
                "distance_m": round(float(np.linalg.norm(src_arr - tgt_arr)), 1),
                "elevation": elevation,
            })
            continue

        drain_road_distances.append({"Drain_No": drain_no, "distance_m": round(float(road_dist), 1), "elevation": elevation})
        road_coords = list(path_nodes)

        if np.linalg.norm(np.array(road_coords[0]) - src_arr) < 5000 and road_coords[0] != src_point:
            road_coords = [src_point] + road_coords
        if np.linalg.norm(np.array(road_coords[-1]) - np.array([dx, dy])) < 5000 and road_coords[-1] != (dx, dy):
            road_coords = road_coords + [(dx, dy)]

        all_lines.append(LineString(road_coords))

    if not all_lines:
        return None, drain_road_distances

    combined = unary_union(all_lines)
    return gpd.GeoDataFrame(geometry=[combined], crs=crs), drain_road_distances


async def _publish_road_path(road_path_gdf: gpd.GeoDataFrame, temp_dir: str) -> str | None:
    road_path_name = f"road_path_{uuid.uuid4().hex}"
    output_zip_path = f"{temp_dir}/{road_path_name}.zip"
    try:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_shp = Path(tmp_dir) / f"{road_path_name}.shp"
            road_path_gdf.to_file(tmp_shp, driver="ESRI Shapefile", engine="fiona")
            with zipfile.ZipFile(output_zip_path, "w") as zf:
                for f in Path(tmp_dir).glob(f"{road_path_name}.*"):
                    zf.write(f, f.name)
        await Geoserver().upload_vector("vector_work", output_zip_path, road_path_name)
        return road_path_name
    except Exception as e:
        print(f"[road_path_finder] publish failed: {e}", flush=True)
        return None


async def find_road_path(
    polygon_geojson: dict | None,
    polygon_layer: str | None,
    location: list,
    drain_points: list | None = None,
    cluster_layer: str | None = None,
    cluster_rank: int | None = None,
    buffer_bbox: list | None = None,
) -> dict:
    """
    Synchronous road network path finder — same logic as ManualSTPMapper.find_manual_path()
    but as a standalone async function (no Celery).

    Returns:
        { "suitable_path": str | None, "cluster_distances": list | None }
    """
    from app.conf.settings import Settings
    temp_dir = Settings().TEMP_DIR

    # ── Resolve geometry ──────────────────────────────────────────────────────
    if cluster_layer is not None:
        features = await _fetch_layer_features(cluster_layer)
        if not features:
            return {"suitable_path": None, "cluster_distances": None}
        if cluster_rank is not None:
            matched = [
                f for f in features
                if f.get("properties", {}).get("rank") == cluster_rank
                or f.get("properties", {}).get("cluster_rank") == cluster_rank
            ]
            if not matched:
                idx = cluster_rank - 1
                matched = [features[idx]] if 0 <= idx < len(features) else features
            selected_features = matched
        else:
            selected_features = features
        geoms = [shape(f["geometry"]) for f in selected_features if f.get("geometry")]
        if not geoms:
            return {"suitable_path": None, "cluster_distances": None}
        cluster_geom = unary_union(geoms)
        geom = (
            max(cluster_geom.geoms, key=lambda g: g.area)
            if cluster_geom.geom_type in ("MultiPolygon", "GeometryCollection")
            else cluster_geom
        )
    elif polygon_geojson is not None:
        geom = shape(polygon_geojson)
    elif polygon_layer is not None:
        geom = await _fetch_layer_geom(polygon_layer)
        if geom is None:
            return {"suitable_path": None, "cluster_distances": None}
    else:
        return {"suitable_path": None, "cluster_distances": None}

    # ── Project to UTM ────────────────────────────────────────────────────────
    poly_gdf = gpd.GeoDataFrame(
        {"cluster_id": [0], "area_ha": [geom.area / 10_000]},
        geometry=[geom], crs="EPSG:4326",
    )
    poly_projected = poly_gdf.to_crs("EPSG:32644")
    crs = str(poly_projected.crs)
    centroid_projected = poly_projected.geometry.iloc[0].centroid
    src_point = (centroid_projected.x, centroid_projected.y)

    if not drain_points:
        return {"suitable_path": None, "cluster_distances": None}

    # ── Filter drains by bbox ─────────────────────────────────────────────────
    if buffer_bbox and len(buffer_bbox) == 4:
        bb_minlon, bb_minlat, bb_maxlon, bb_maxlat = buffer_bbox
        active_drains = [
            dp for dp in drain_points
            if bb_minlat <= dp["latitude"] <= bb_maxlat and bb_minlon <= dp["longitude"] <= bb_maxlon
        ] or drain_points
    else:
        active_drains = drain_points

    transformer = Transformer.from_crs("EPSG:4326", crs, always_xy=True)

    bbox_minx_m = bbox_miny_m = bbox_maxx_m = bbox_maxy_m = None
    if buffer_bbox and len(buffer_bbox) == 4:
        bb_minlon, bb_minlat, bb_maxlon, bb_maxlat = buffer_bbox
        bbox_minx_m, bbox_miny_m = transformer.transform(bb_minlon, bb_minlat)
        bbox_maxx_m, bbox_maxy_m = transformer.transform(bb_maxlon, bb_maxlat)

    drain_projected = [
        (transformer.transform(dp["longitude"], dp["latitude"]), dp["Drain_No"], dp.get("Elevation", 0))
        for dp in active_drains
    ]

    road_path_shp = Settings().road_path

    # ── Run heavy graph work in executor ──────────────────────────────────────
    loop = asyncio.get_event_loop()
    road_path_gdf, drain_road_distances = await loop.run_in_executor(
        None,
        lambda: _find_paths_sync(src_point, drain_projected, road_path_shp, crs, bbox_minx_m, bbox_miny_m, bbox_maxx_m, bbox_maxy_m),
    )

    # ── Upload road path to GeoServer ─────────────────────────────────────────
    road_path_layer = None
    if road_path_gdf is not None and not road_path_gdf.empty:
        road_path_layer = await _publish_road_path(road_path_gdf, temp_dir)

    polygon_area_ha = round(float(poly_projected.geometry.iloc[0].area) / 10_000, 4)
    cluster_distances_result = (
        [{"cluster_rank": 1, "area_ha": polygon_area_ha, "dist_to_polygon_m": 0.0, "drains": drain_road_distances}]
        if drain_road_distances else None
    )

    return {"suitable_path": road_path_layer, "cluster_distances": cluster_distances_result}
