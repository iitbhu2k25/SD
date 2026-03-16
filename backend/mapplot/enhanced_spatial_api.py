# file: backend/mapplot/enhanced_spatial_api.py
#
# Merged version: keeps ALL 22 original operations and adds:
#   • _load_gdfs()   — reads ordered geojson_0 / geojson_1 / … sent by the
#                      SpatialAnalysisModal frontend (preserves layer priority)
#   • _safe_json()   — sanitises NaN/Inf so JSON serialisation never crashes
#   • Fallback to request.FILES for backwards-compatibility

import os
import json
import zipfile
import tempfile
import logging

import numpy as np
import pandas as pd
import geopandas as gpd

from shapely.geometry import (
    shape, Point, LineString, Polygon, MultiPoint, box
)
from shapely.ops import unary_union, voronoi_diagram

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny
from rest_framework import status

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# I/O helpers
# ─────────────────────────────────────────────────────────────────────────────

def read_spatial_file(uploaded_file) -> gpd.GeoDataFrame:
    """Read shapefile / zip / geojson from an uploaded file object."""
    suffix = os.path.splitext(uploaded_file.name)[1].lower()

    with tempfile.TemporaryDirectory() as tmpdir:
        file_path = os.path.join(tmpdir, uploaded_file.name)
        with open(file_path, "wb") as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)

        if suffix == ".zip":
            with zipfile.ZipFile(file_path, "r") as zf:
                zf.extractall(tmpdir)
            shp_files = [fn for fn in os.listdir(tmpdir) if fn.endswith(".shp")]
            if not shp_files:
                raise ValueError("ZIP does not contain a shapefile")
            return gpd.read_file(os.path.join(tmpdir, shp_files[0]))

        if suffix in (".shp", ".geojson", ".json"):
            return gpd.read_file(file_path)

        raise ValueError(f"Unsupported file format: {suffix}")


def _geojson_str_to_gdf(raw) -> gpd.GeoDataFrame:
    """Parse a GeoJSON string (or dict) into a GeoDataFrame."""
    data = json.loads(raw) if isinstance(raw, str) else raw
    features = data.get("features", [])
    if not features:
        raise ValueError("GeoJSON contains no features")

    rows = []
    for feat in features:
        geom = feat.get("geometry")
        props = feat.get("properties") or {}
        if geom is None:
            continue
        try:
            rows.append({"geometry": shape(geom), **props})
        except Exception as exc:
            logger.warning("Skipping invalid geometry: %s", exc)

    if not rows:
        raise ValueError("No valid geometries in GeoJSON")

    return gpd.GeoDataFrame(rows, crs="EPSG:4326")


def _to_4326(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    if gdf.crs is None:
        return gdf.set_crs("EPSG:4326")
    if gdf.crs.to_epsg() != 4326:
        return gdf.to_crs("EPSG:4326")
    return gdf


def _safe_json(gdf: gpd.GeoDataFrame) -> dict:
    """Convert to GeoJSON dict and replace NaN / Inf with None."""
    raw = json.loads(gdf.to_json())
    for feat in raw.get("features", []):
        props = feat.get("properties") or {}
        for k, v in props.items():
            if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                props[k] = None
    return raw


def _load_gdfs(request) -> list:
    """
    Load GeoDataFrames in the order the frontend sent them.

    The SpatialAnalysisModal sends layers as:
        geojson_0=<FeatureCollection JSON>
        geojson_1=<FeatureCollection JSON>
        …

    This preserves the user-chosen layer priority (e.g. which layer is
    "Input" vs "Clip Boundary").  Falls back to request.FILES if no
    keyed fields are found (backwards-compatible with old callers).
    """
    gdfs = []

    # ── Priority 1: indexed keys geojson_0, geojson_1, … ──
    idx = 0
    while True:
        raw = request.data.get(f"geojson_{idx}")
        if raw is None:
            break
        gdfs.append(_to_4326(_geojson_str_to_gdf(raw)))
        idx += 1

    # ── Priority 2: unkeyed list geojson[] ──
    if not gdfs:
        for raw in request.data.getlist("geojson[]"):
            gdfs.append(_to_4326(_geojson_str_to_gdf(raw)))

    # ── Priority 3: uploaded files (backwards compat) ──
    if not gdfs:
        for f in request.FILES.getlist("files"):
            gdfs.append(_to_4326(read_spatial_file(f)))

    return gdfs


def _normalize_crs(gdfs: list) -> tuple:
    """Ensure all GDFs share the same CRS; return (gdfs, base_crs)."""
    base_crs = gdfs[0].crs
    result = []
    for gdf in gdfs:
        if gdf.crs is None:
            result.append(gdf.set_crs(base_crs))
        elif gdf.crs != base_crs:
            result.append(gdf.to_crs(base_crs))
        else:
            result.append(gdf)
    return result, base_crs


# ─────────────────────────────────────────────────────────────────────────────
# Main View
# ─────────────────────────────────────────────────────────────────────────────

class SpatialProcessAPIView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        operation = (request.data.get("operation") or "").strip()

        # ── Load layers in user-defined order ──
        try:
            gdfs = _load_gdfs(request)
        except Exception as exc:
            return Response({"error": f"Failed to load layers: {exc}"},
                            status=status.HTTP_400_BAD_REQUEST)

        if not gdfs:
            return Response({"error": "At least one layer is required"},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            gdfs, base_crs = _normalize_crs(gdfs)
        except Exception as exc:
            return Response({"error": f"CRS normalisation failed: {exc}"},
                            status=status.HTTP_400_BAD_REQUEST)

        # ── Helper to unwrap DRF list-wrapped params ──
        def param(key, default=None):
            v = request.data.get(key, default)
            return v[0] if isinstance(v, list) else v

        try:
            # ════════════════════════════════════════════
            # 1. INTERSECTION
            # ════════════════════════════════════════════
            if operation == "intersection":
                if len(gdfs) < 2:
                    return Response({"error": "Intersection requires at least 2 layers"},
                                    status=status.HTTP_400_BAD_REQUEST)
                result = gdfs[0]
                for gdf in gdfs[1:]:
                    result = gpd.overlay(result, gdf, how="intersection",
                                         keep_geom_type=False)
                if result.empty:
                    return Response({"message": "No intersection found"})
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 2. UNION
            # ════════════════════════════════════════════
            elif operation == "union":
                if len(gdfs) < 2:
                    return Response({"error": "Union requires at least 2 layers"},
                                    status=status.HTTP_400_BAD_REQUEST)
                result = gdfs[0]
                for gdf in gdfs[1:]:
                    result = gpd.overlay(result, gdf, how="union",
                                         keep_geom_type=False)
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 3. DIFFERENCE  (Layer 1 − Layer 2 − …)
            # ════════════════════════════════════════════
            elif operation == "difference":
                if len(gdfs) < 2:
                    return Response({"error": "Difference requires at least 2 layers"},
                                    status=status.HTTP_400_BAD_REQUEST)
                result = gdfs[0]
                for gdf in gdfs[1:]:
                    result = gpd.overlay(result, gdf, how="difference",
                                         keep_geom_type=False)
                if result.empty:
                    return Response({"message": "No difference found"})
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 4. SYMMETRIC DIFFERENCE
            # ════════════════════════════════════════════
            elif operation == "symmetric_difference":
                if len(gdfs) != 2:
                    return Response({"error": "Symmetric difference requires exactly 2 layers"},
                                    status=status.HTTP_400_BAD_REQUEST)
                result = gpd.overlay(gdfs[0], gdfs[1],
                                      how="symmetric_difference",
                                      keep_geom_type=False)
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 5. CLIP  (Layer 1 clipped by Layer 2)
            # ════════════════════════════════════════════
            elif operation == "clip":
                if len(gdfs) != 2:
                    return Response({"error": "Clip requires exactly 2 layers"},
                                    status=status.HTTP_400_BAD_REQUEST)
                result = gpd.clip(gdfs[0], gdfs[1])
                if result.empty:
                    return Response({"message": "No features within clip boundary"})
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 6. BUFFER
            # ════════════════════════════════════════════
            elif operation == "buffer":
                distance_m = float(param("distance", 100))
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                projected = combined.to_crs(epsg=3857)
                projected = projected.copy()
                projected["geometry"] = projected.geometry.buffer(distance_m)
                result = projected.to_crs(base_crs)
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 7. DISSOLVE
            # ════════════════════════════════════════════
            elif operation == "dissolve":
                dissolve_field = param("dissolve_field", "all")
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                if dissolve_field and dissolve_field.strip().lower() not in ("all", ""):
                    if dissolve_field not in combined.columns:
                        return Response(
                            {"error": f"Field '{dissolve_field}' not found. "
                                      f"Available: {list(combined.columns)}"},
                            status=status.HTTP_400_BAD_REQUEST)
                    result = combined.dissolve(by=dissolve_field).reset_index()
                else:
                    combined["_dk"] = 1
                    result = combined.dissolve(by="_dk").reset_index(drop=True)
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 8. STATISTICS
            # ════════════════════════════════════════════
            elif operation == "statistics":
                stats_type = param("stats_type", "area")
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                combined = combined.copy()

                if stats_type == "area":
                    metric = combined.geometry.to_crs(epsg=6933)
                    combined["area_sqkm"] = metric.area / 1e6
                    combined["area_sqm"]  = metric.area
                elif stats_type == "length":
                    metric = combined.geometry.to_crs(epsg=3857)
                    combined["length_km"] = metric.length / 1000
                    combined["length_m"]  = metric.length
                elif stats_type == "perimeter":
                    metric = combined.geometry.to_crs(epsg=3857)
                    combined["perimeter_km"] = metric.length / 1000
                elif stats_type == "centroid":
                    c = combined.geometry.centroid
                    combined["centroid_lon"] = c.x
                    combined["centroid_lat"] = c.y
                elif stats_type == "bounds":
                    b = combined.geometry.bounds
                    combined["minx"] = b["minx"]
                    combined["miny"] = b["miny"]
                    combined["maxx"] = b["maxx"]
                    combined["maxy"] = b["maxy"]

                combined["feature_count"] = 1
                return Response(_safe_json(_to_4326(combined)))

            # ════════════════════════════════════════════
            # 9. CENTROID
            # ════════════════════════════════════════════
            elif operation == "centroid":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.centroid
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 10. CONVEX HULL
            # ════════════════════════════════════════════
            elif operation == "convex_hull":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.convex_hull
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 11. SIMPLIFY
            # ════════════════════════════════════════════
            elif operation == "simplify":
                tolerance = float(param("tolerance", 0.001))
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.simplify(
                    tolerance, preserve_topology=True)
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 12. MERGE / CONCATENATE
            # ════════════════════════════════════════════
            elif operation == "merge":
                result = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                           crs=base_crs)
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 13. SPATIAL JOIN
            # ════════════════════════════════════════════
            elif operation == "spatial_join":
                if len(gdfs) != 2:
                    return Response({"error": "Spatial join requires exactly 2 layers"},
                                    status=status.HTTP_400_BAD_REQUEST)
                join_type = param("join_type", "inner")
                predicate  = param("predicate",  "intersects")
                result = gpd.sjoin(gdfs[0], gdfs[1],
                                    how=join_type, predicate=predicate)
                result = result.drop(columns=["index_right"], errors="ignore")
                if result.empty:
                    return Response({"message": "No features matched the spatial join"})
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 14. NEAREST NEIGHBOR  (uses sjoin_nearest)
            # ════════════════════════════════════════════
            elif operation == "nearest":
                if len(gdfs) != 2:
                    return Response({"error": "Nearest requires exactly 2 layers"},
                                    status=status.HTTP_400_BAD_REQUEST)
                result = gpd.sjoin_nearest(gdfs[0], gdfs[1],
                                            how="left",
                                            distance_col="nearest_dist_deg")
                result = result.drop(columns=["index_right"], errors="ignore")
                # Add approximate distance in metres using 3857
                left_m  = gdfs[0].to_crs(epsg=3857)
                right_m = gdfs[1].to_crs(epsg=3857)
                dist_m = []
                right_union = right_m.geometry.unary_union
                for geom in left_m.geometry:
                    dist_m.append(round(geom.distance(right_union), 2))
                result = result.copy()
                result["nearest_dist_m"] = dist_m
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 15. EUCLIDEAN DISTANCE MATRIX
            # ════════════════════════════════════════════
            elif operation == "euclidean_distance":
                if len(gdfs) != 2:
                    return Response({"error": "Euclidean distance requires exactly 2 layers"},
                                    status=status.HTTP_400_BAD_REQUEST)
                distances = []
                for i, g1 in enumerate(gdfs[0].geometry):
                    for j, g2 in enumerate(gdfs[1].geometry):
                        distances.append({
                            "from_feature": i,
                            "to_feature":   j,
                            "distance":     round(g1.distance(g2), 6),
                        })
                return Response({
                    "type":      "DistanceMatrix",
                    "distances": distances,
                    "count":     len(distances),
                })

            # ════════════════════════════════════════════
            # 16. POINT IN POLYGON
            # ════════════════════════════════════════════
            elif operation == "point_in_polygon":
                if len(gdfs) != 2:
                    return Response({"error": "Point in polygon requires exactly 2 layers"},
                                    status=status.HTTP_400_BAD_REQUEST)
                # Auto-detect which layer is points
                g0_types = set(gdfs[0].geometry.geom_type.unique())
                g1_types = set(gdfs[1].geometry.geom_type.unique())
                point_types = {"Point", "MultiPoint"}
                if g0_types <= point_types:
                    points, polys = gdfs[0], gdfs[1]
                elif g1_types <= point_types:
                    points, polys = gdfs[1], gdfs[0]
                else:
                    points, polys = gdfs[0], gdfs[1]   # try anyway

                result = gpd.sjoin(points, polys, how="inner", predicate="within")
                result = result.drop(columns=["index_right"], errors="ignore")
                if result.empty:
                    return Response({"message": "No points found within the polygons"})
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 17. BOUNDING BOX
            # ════════════════════════════════════════════
            elif operation == "bounding_box":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.envelope
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 18. VORONOI DIAGRAM
            # ════════════════════════════════════════════
            elif operation == "voronoi":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                points = []
                for geom in combined.geometry:
                    if geom.geom_type == "Point":
                        points.append(geom)
                    else:
                        points.append(geom.centroid)
                multi_pt = MultiPoint(points)
                vor = voronoi_diagram(multi_pt)
                result = gpd.GeoDataFrame(
                    geometry=list(vor.geoms), crs=base_crs)
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 19. AREA COMPARISON
            # ════════════════════════════════════════════
            elif operation == "area_comparison":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                combined = combined.copy()
                combined["area_sqkm"] = (
                    combined.geometry.to_crs(epsg=6933).area / 1e6)
                total = combined["area_sqkm"].sum()
                combined["percentage"] = (
                    combined["area_sqkm"] / total * 100).round(2)
                combined["rank"] = combined["area_sqkm"].rank(ascending=False)
                return Response(_safe_json(_to_4326(combined)))

            # ════════════════════════════════════════════
            # 20. TOPOLOGY CHECK
            # ════════════════════════════════════════════
            elif operation == "topology_check":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                combined = combined.copy()
                combined["is_valid"]  = combined.geometry.is_valid
                combined["is_simple"] = combined.geometry.is_simple
                combined["is_empty"]  = combined.geometry.is_empty
                invalid_count = int((~combined["is_valid"]).sum())
                if invalid_count:
                    mask = ~combined["is_valid"]
                    combined.loc[mask, "geometry"] = (
                        combined.loc[mask, "geometry"].buffer(0))
                return Response({
                    "geojson": _safe_json(_to_4326(combined)),
                    "summary": {
                        "total_features":   len(combined),
                        "invalid_features": invalid_count,
                        "empty_features":   int(combined["is_empty"].sum()),
                    },
                })

            # ════════════════════════════════════════════
            # 21. ATTRIBUTE FILTER
            # ════════════════════════════════════════════
            elif operation == "filter":
                field    = param("field")
                operator = param("operator", "equals")
                value    = param("value")

                if not field or value is None:
                    return Response({"error": "field and value are required"},
                                    status=status.HTTP_400_BAD_REQUEST)

                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                if field not in combined.columns:
                    return Response(
                        {"error": f"Field '{field}' not found. "
                                  f"Available: {list(combined.columns)}"},
                        status=status.HTTP_400_BAD_REQUEST)

                col = combined[field]
                if operator == "equals":
                    try:
                        mask = col == type(col.iloc[0])(value)
                    except Exception:
                        mask = col.astype(str) == str(value)
                elif operator == "greater":
                    mask = pd.to_numeric(col, errors="coerce") > float(value)
                elif operator == "less":
                    mask = pd.to_numeric(col, errors="coerce") < float(value)
                elif operator == "contains":
                    mask = col.astype(str).str.contains(
                        str(value), case=False, na=False)
                else:
                    return Response({"error": f"Unknown operator: {operator}"},
                                    status=status.HTTP_400_BAD_REQUEST)

                result = combined[mask]
                if result.empty:
                    return Response({"message": "No features match the filter"})
                return Response(_safe_json(_to_4326(result)))

            # ════════════════════════════════════════════
            # 22. REPROJECT
            # ════════════════════════════════════════════
            elif operation == "reproject":
                target_crs = param("target_crs", "EPSG:4326")
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True),
                                             crs=base_crs)
                result = combined.to_crs(target_crs)
                return Response(_safe_json(result))

            else:
                valid = (
                    "intersection, union, difference, symmetric_difference, clip, "
                    "buffer, dissolve, statistics, centroid, convex_hull, simplify, "
                    "merge, spatial_join, nearest, euclidean_distance, point_in_polygon, "
                    "bounding_box, voronoi, area_comparison, topology_check, filter, reproject"
                )
                return Response(
                    {"error": f"Unknown operation '{operation}'. Valid: {valid}"},
                    status=status.HTTP_400_BAD_REQUEST)

        except ValueError as exc:
            return Response({"error": f"Value error: {exc}"},
                            status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception("Spatial operation '%s' failed", operation)
            return Response({"error": f"Processing error: {exc}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────────────────────────────────────────
# Operations list (unchanged from original)
# ─────────────────────────────────────────────────────────────────────────────

class SpatialOperationsListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        operations = {
            "overlay_operations": [
                {"name": "intersection",         "description": "Find areas where all input layers overlap",             "min_files": 2, "parameters": []},
                {"name": "union",                "description": "Combine all input layers into a single layer",          "min_files": 2, "parameters": []},
                {"name": "difference",           "description": "Subtract subsequent layers from the first layer",       "min_files": 2, "parameters": []},
                {"name": "symmetric_difference", "description": "Find areas in either layer but not in both",            "min_files": 2, "max_files": 2, "parameters": []},
                {"name": "clip",                 "description": "Clip first layer by second layer boundary",             "min_files": 2, "max_files": 2, "parameters": []},
            ],
            "geometric_operations": [
                {"name": "buffer",       "description": "Create buffer around features",              "min_files": 1, "parameters": [{"name": "distance",        "type": "float",  "default": 100}]},
                {"name": "dissolve",     "description": "Merge features by attribute or dissolve all","min_files": 1, "parameters": [{"name": "dissolve_field",   "type": "string", "optional": True}]},
                {"name": "centroid",     "description": "Calculate centroids of features",            "min_files": 1, "parameters": []},
                {"name": "convex_hull",  "description": "Create convex hull around features",         "min_files": 1, "parameters": []},
                {"name": "bounding_box", "description": "Create bounding box for features",           "min_files": 1, "parameters": []},
                {"name": "simplify",     "description": "Simplify geometry",                          "min_files": 1, "parameters": [{"name": "tolerance", "type": "float", "default": 0.001}]},
                {"name": "voronoi",      "description": "Create Voronoi diagram from points",         "min_files": 1, "parameters": []},
            ],
            "analysis_operations": [
                {"name": "statistics",       "description": "Calculate geometric statistics",                            "min_files": 1, "parameters": [{"name": "stats_type", "type": "string", "options": ["area","length","perimeter","centroid","bounds"], "default": "area"}]},
                {"name": "spatial_join",     "description": "Join attributes based on spatial relationship",             "min_files": 2, "max_files": 2, "parameters": [{"name": "join_type", "type": "string", "options": ["inner","left","right"], "default": "inner"}, {"name": "predicate", "type": "string", "options": ["intersects","within","contains"], "default": "intersects"}]},
                {"name": "nearest",          "description": "Find nearest features between two layers",                  "min_files": 2, "max_files": 2, "parameters": []},
                {"name": "euclidean_distance","description": "Calculate distances between features",                     "min_files": 2, "max_files": 2, "parameters": []},
                {"name": "point_in_polygon", "description": "Find points within polygons",                              "min_files": 2, "max_files": 2, "parameters": []},
                {"name": "area_comparison",  "description": "Compare areas and calculate percentages",                  "min_files": 1, "parameters": []},
                {"name": "topology_check",   "description": "Check and fix topology errors",                            "min_files": 1, "parameters": []},
            ],
            "utility_operations": [
                {"name": "merge",     "description": "Concatenate multiple layers into one", "min_files": 1, "parameters": []},
                {"name": "filter",    "description": "Filter features by attribute value",   "min_files": 1, "parameters": [{"name": "field", "type": "string", "required": True}, {"name": "operator", "type": "string", "options": ["equals","greater","less","contains"], "default": "equals"}, {"name": "value", "type": "any", "required": True}]},
                {"name": "reproject", "description": "Reproject to different CRS",           "min_files": 1, "parameters": [{"name": "target_crs", "type": "string", "default": "EPSG:4326"}]},
            ],
        }
        return Response(operations)