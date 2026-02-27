# file: backend/mapplot/spatial_queries_api.py
#
# Spatial Query Engine
# --------------------
# All queries follow the pattern:
#   "Select features from the SOURCE layer WHERE <spatial_condition> TARGET layer"
#
# POST /django/mapplot/spatial/query
#   geojson_0  = source layer (FeatureCollection JSON)  ← features to SELECT FROM
#   geojson_1  = target layer (FeatureCollection JSON)  ← spatial reference / condition
#   query_type = one of the QUERY_TYPES below
#   + optional parameters (distance_m, predicate, stat_field, …)
#
# GET /django/mapplot/spatial/query/types
#   Returns list of all query types with descriptions and parameters

import json
import logging
import numpy as np
import pandas as pd
import geopandas as gpd

from shapely.geometry import shape, Point, MultiPoint
from shapely.ops import unary_union, nearest_points

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny
from rest_framework import status

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers (copied from enhanced_spatial_api to keep files independent)
# ─────────────────────────────────────────────────────────────────────────────

def _parse_geojson(raw) -> gpd.GeoDataFrame:
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
        except Exception as e:
            logger.warning("Skipping invalid geometry: %s", e)
    if not rows:
        raise ValueError("No valid geometries found")
    return gpd.GeoDataFrame(rows, crs="EPSG:4326")


def _to_4326(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    if gdf.crs is None:
        return gdf.set_crs("EPSG:4326")
    if gdf.crs.to_epsg() != 4326:
        return gdf.to_crs("EPSG:4326")
    return gdf


def _to_metric(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """EPSG:3857 — good for distance/area calculations globally."""
    return gdf.to_crs(epsg=3857)


def _safe_json(gdf: gpd.GeoDataFrame) -> dict:
    raw = json.loads(gdf.to_json())
    for feat in raw.get("features", []):
        props = feat.get("properties") or {}
        for k, v in props.items():
            if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                props[k] = None
    return raw


def _load_source_target(request):
    """Return (source_gdf, target_gdf) from the request."""
    raw0 = request.data.get("geojson_0")
    raw1 = request.data.get("geojson_1")
    if not raw0:
        raise ValueError("geojson_0 (source layer) is required")
    if not raw1:
        raise ValueError("geojson_1 (target layer) is required")
    source = _to_4326(_parse_geojson(raw0))
    target = _to_4326(_parse_geojson(raw1))
    return source, target


def _param(request, key, default=None):
    v = request.data.get(key, default)
    return v[0] if isinstance(v, list) else v


# ─────────────────────────────────────────────────────────────────────────────
# Query implementations
# ─────────────────────────────────────────────────────────────────────────────

def q_intersects(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """Select source features that intersect any target feature."""
    target_union = target.geometry.unary_union
    mask = source.geometry.intersects(target_union)
    return source[mask].copy()


def q_within(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """Select source features completely inside any target feature."""
    target_union = target.geometry.unary_union
    mask = source.geometry.within(target_union)
    return source[mask].copy()


def q_contains(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """Select source features that fully contain any target feature."""
    target_union = target.geometry.unary_union
    mask = source.geometry.contains(target_union)
    return source[mask].copy()


def q_touches(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """Select source features that share a boundary point with any target feature."""
    target_union = target.geometry.unary_union
    mask = source.geometry.touches(target_union)
    return source[mask].copy()


def q_crosses(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """Select source features (lines/polygons) that cross any target feature."""
    target_union = target.geometry.unary_union
    mask = source.geometry.crosses(target_union)
    return source[mask].copy()


def q_overlaps(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """Select source features that overlap (partially share interior) with any target feature."""
    target_union = target.geometry.unary_union
    mask = source.geometry.overlaps(target_union)
    return source[mask].copy()


def q_disjoint(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """Select source features that have NO spatial relationship with target features."""
    target_union = target.geometry.unary_union
    mask = source.geometry.disjoint(target_union)
    return source[mask].copy()


def q_within_distance(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame,
                       distance_m: float = 1000, **kw) -> gpd.GeoDataFrame:
    """Select source features within <distance_m> metres of any target feature."""
    src_m = _to_metric(source)
    tgt_m = _to_metric(target)
    target_union = tgt_m.geometry.unary_union
    buffered_target = target_union.buffer(distance_m)
    mask = src_m.geometry.intersects(buffered_target)
    result = source[mask].copy()
    # Add actual distance column
    dist_col = []
    for geom in src_m.geometry:
        dist_col.append(round(geom.distance(target_union), 2))
    source_copy = source.copy()
    source_copy["dist_to_target_m"] = dist_col
    return source_copy[mask].copy()


def q_not_within_distance(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame,
                            distance_m: float = 1000, **kw) -> gpd.GeoDataFrame:
    """Select source features FARTHER than <distance_m> metres from all target features."""
    src_m = _to_metric(source)
    tgt_m = _to_metric(target)
    target_union = tgt_m.geometry.unary_union
    buffered_target = target_union.buffer(distance_m)
    mask = ~src_m.geometry.intersects(buffered_target)
    result = source[mask].copy()
    dist_col = []
    for geom in src_m.geometry[mask]:
        dist_col.append(round(geom.distance(target_union), 2))
    result["dist_to_target_m"] = dist_col
    return result


def q_nearest_n(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame,
                 n: int = 1, **kw) -> gpd.GeoDataFrame:
    """
    For each source feature, find the N nearest target features.
    Returns source features enriched with distance and nearest target attributes.
    """
    src_m = _to_metric(source)
    tgt_m = _to_metric(target)
    tgt_reset = tgt_m.reset_index(drop=True)

    records = []
    for i, (src_idx, src_row) in enumerate(src_m.iterrows()):
        distances = [(j, src_row.geometry.distance(tgt_row.geometry))
                     for j, tgt_row in tgt_reset.iterrows()]
        distances.sort(key=lambda x: x[1])
        for rank, (j, dist) in enumerate(distances[:n], start=1):
            row_data = dict(source.iloc[i])
            row_data["nearest_rank"]   = rank
            row_data["dist_to_nearest_m"] = round(dist, 2)
            # Attach target attributes with prefix
            tgt_orig = target.reset_index(drop=True).iloc[j]
            for col in target.columns:
                if col != "geometry":
                    row_data[f"tgt_{col}"] = tgt_orig[col]
            records.append(row_data)

    if not records:
        return source.iloc[0:0].copy()

    result = gpd.GeoDataFrame(records, crs=source.crs)
    return result


def q_count_within(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """
    For each source feature, count how many target features fall within it.
    Adds 'target_count' column to source.
    """
    result = source.copy()
    counts = []
    for geom in source.geometry:
        try:
            count = int(target.geometry.within(geom).sum())
        except Exception:
            count = 0
        counts.append(count)
    result["target_count"] = counts
    return result


def q_sum_within(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame,
                  stat_field: str = "", **kw) -> gpd.GeoDataFrame:
    """
    For each source polygon, sum the values of <stat_field> from target features within it.
    Adds sum, mean, min, max, count columns.
    """
    if not stat_field:
        raise ValueError("stat_field parameter is required for sum_within query")
    if stat_field not in target.columns:
        raise ValueError(f"Field '{stat_field}' not found in target layer. "
                         f"Available: {[c for c in target.columns if c != 'geometry']}")

    result = source.copy()
    agg_sum, agg_mean, agg_min, agg_max, agg_cnt = [], [], [], [], []

    for geom in source.geometry:
        try:
            mask = target.geometry.within(geom)
            vals = pd.to_numeric(target.loc[mask, stat_field], errors="coerce").dropna()
        except Exception:
            vals = pd.Series(dtype=float)
        agg_cnt.append(int(len(vals)))
        agg_sum.append(round(float(vals.sum()), 4) if len(vals) else None)
        agg_mean.append(round(float(vals.mean()), 4) if len(vals) else None)
        agg_min.append(round(float(vals.min()), 4) if len(vals) else None)
        agg_max.append(round(float(vals.max()), 4) if len(vals) else None)

    result[f"sum_{stat_field}"]   = agg_sum
    result[f"mean_{stat_field}"]  = agg_mean
    result[f"min_{stat_field}"]   = agg_min
    result[f"max_{stat_field}"]   = agg_max
    result[f"count_{stat_field}"] = agg_cnt
    return result


def q_intersect_area(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """
    For each source polygon, compute the intersection area with target polygons.
    Adds intersection_area_sqkm and pct_covered columns.
    """
    src_m = _to_metric(source)
    tgt_m = _to_metric(target)
    target_union = tgt_m.geometry.unary_union

    result = source.copy()
    inter_areas, pct_covered = [], []

    for src_geom, src_geom_m in zip(source.geometry, src_m.geometry):
        try:
            inter = src_geom_m.intersection(target_union)
            area  = inter.area / 1e6  # → km²
            src_area = src_geom_m.area / 1e6
            pct = round((area / src_area * 100), 2) if src_area > 0 else 0.0
        except Exception:
            area, pct = 0.0, 0.0
        inter_areas.append(round(area, 6))
        pct_covered.append(pct)

    result["intersection_area_sqkm"] = inter_areas
    result["pct_covered"]            = pct_covered
    return result


def q_select_by_location(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame,
                           predicate: str = "intersects", **kw) -> gpd.GeoDataFrame:
    """
    General 'Select by Location' — filter source by any DE-9IM predicate.
    predicate: intersects | within | contains | touches | crosses | overlaps | disjoint
    """
    PRED_FNS = {
        "intersects": lambda a, b: a.intersects(b),
        "within":     lambda a, b: a.within(b),
        "contains":   lambda a, b: a.contains(b),
        "touches":    lambda a, b: a.touches(b),
        "crosses":    lambda a, b: a.crosses(b),
        "overlaps":   lambda a, b: a.overlaps(b),
        "disjoint":   lambda a, b: a.disjoint(b),
    }
    if predicate not in PRED_FNS:
        raise ValueError(f"Unknown predicate '{predicate}'. Valid: {list(PRED_FNS)}")
    target_union = target.geometry.unary_union
    fn   = PRED_FNS[predicate]
    mask = fn(source.geometry, target_union)
    result = source[mask].copy()
    result["spatial_predicate"] = predicate
    return result


def q_relate(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """
    For each source feature, compute DE-9IM relation flags against the target union.
    Adds: intersects, within, contains, touches, crosses, overlaps columns (True/False).
    """
    target_union = target.geometry.unary_union
    result = source.copy()
    result["rel_intersects"] = source.geometry.intersects(target_union)
    result["rel_within"]     = source.geometry.within(target_union)
    result["rel_contains"]   = source.geometry.contains(target_union)
    result["rel_touches"]    = source.geometry.touches(target_union)
    result["rel_crosses"]    = source.geometry.crosses(target_union)
    result["rel_overlaps"]   = source.geometry.overlaps(target_union)
    result["rel_disjoint"]   = source.geometry.disjoint(target_union)
    return result


def q_distance_band(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame,
                     min_dist_m: float = 0, max_dist_m: float = 5000, **kw) -> gpd.GeoDataFrame:
    """
    Select source features between <min_dist_m> and <max_dist_m> metres from target.
    Adds dist_to_target_m column.
    """
    src_m = _to_metric(source)
    tgt_m = _to_metric(target)
    target_union = tgt_m.geometry.unary_union

    distances = [src_geom.distance(target_union) for src_geom in src_m.geometry]
    mask = [(min_dist_m <= d <= max_dist_m) for d in distances]

    result = source[mask].copy()
    result["dist_to_target_m"] = [round(d, 2) for d, m in zip(distances, mask) if m]
    return result


def q_largest_overlap(source: gpd.GeoDataFrame, target: gpd.GeoDataFrame, **kw) -> gpd.GeoDataFrame:
    """
    For each source polygon, find which target feature it overlaps MOST with.
    Returns source features enriched with the dominant target attributes.
    """
    src_m = _to_metric(source)
    tgt_m = _to_metric(target).reset_index(drop=True)
    tgt_orig = target.reset_index(drop=True)

    records = []
    for i, (src_geom_m, src_geom) in enumerate(zip(src_m.geometry, source.geometry)):
        best_idx, best_area = None, 0.0
        for j, tgt_geom_m in enumerate(tgt_m.geometry):
            try:
                area = src_geom_m.intersection(tgt_geom_m).area
            except Exception:
                area = 0.0
            if area > best_area:
                best_area = area
                best_idx = j

        row = dict(source.iloc[i])
        row["dominant_overlap_area_sqm"] = round(best_area, 2)
        if best_idx is not None:
            for col in tgt_orig.columns:
                if col != "geometry":
                    row[f"dominant_{col}"] = tgt_orig.iloc[best_idx][col]
        records.append(row)

    if not records:
        return source.iloc[0:0].copy()
    return gpd.GeoDataFrame(records, crs=source.crs)


# ─────────────────────────────────────────────────────────────────────────────
# Query registry
# ─────────────────────────────────────────────────────────────────────────────

QUERY_REGISTRY = {
    # ── Basic topological ────────────────────────────────────────────────────
    "intersects": {
        "fn": q_intersects,
        "name": "Intersects",
        "category": "Topological",
        "description": "Select source features that intersect any target feature",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [],
    },
    "within": {
        "fn": q_within,
        "name": "Within",
        "category": "Topological",
        "description": "Select source features completely inside any target feature",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [],
    },
    "contains": {
        "fn": q_contains,
        "name": "Contains",
        "category": "Topological",
        "description": "Select source features that fully contain any target feature",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [],
    },
    "touches": {
        "fn": q_touches,
        "name": "Touches",
        "category": "Topological",
        "description": "Select source features sharing a boundary with any target feature",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [],
    },
    "crosses": {
        "fn": q_crosses,
        "name": "Crosses",
        "category": "Topological",
        "description": "Select source line/polygon features that cross any target feature",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [],
    },
    "overlaps": {
        "fn": q_overlaps,
        "name": "Overlaps",
        "category": "Topological",
        "description": "Select source features that partially overlap any target feature",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [],
    },
    "disjoint": {
        "fn": q_disjoint,
        "name": "Disjoint (No relation)",
        "category": "Topological",
        "description": "Select source features with NO spatial relation to target",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [],
    },
    # ── Distance-based ───────────────────────────────────────────────────────
    "within_distance": {
        "fn": q_within_distance,
        "name": "Within Distance",
        "category": "Distance",
        "description": "Select source features within a given distance of any target feature",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [
            {"name": "distance_m", "label": "Distance (meters)", "type": "number",
             "default": 1000, "required": True},
        ],
    },
    "not_within_distance": {
        "fn": q_not_within_distance,
        "name": "Not Within Distance",
        "category": "Distance",
        "description": "Select source features farther than a given distance from all target features",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [
            {"name": "distance_m", "label": "Distance (meters)", "type": "number",
             "default": 1000, "required": True},
        ],
    },
    "distance_band": {
        "fn": q_distance_band,
        "name": "Distance Band",
        "category": "Distance",
        "description": "Select source features between a minimum and maximum distance from target",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [
            {"name": "min_dist_m", "label": "Min Distance (m)", "type": "number", "default": 0, "required": True},
            {"name": "max_dist_m", "label": "Max Distance (m)", "type": "number", "default": 5000, "required": True},
        ],
    },
    "nearest_n": {
        "fn": q_nearest_n,
        "name": "Nearest N Features",
        "category": "Distance",
        "description": "For each source feature, find the N nearest target features",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [
            {"name": "n", "label": "Number of nearest (N)", "type": "number",
             "default": 1, "required": True},
        ],
    },
    # ── Aggregate / enrichment ───────────────────────────────────────────────
    "count_within": {
        "fn": q_count_within,
        "name": "Count Features Within",
        "category": "Aggregate",
        "description": "Count how many target features fall inside each source polygon. Adds 'target_count' column",
        "layer_labels": ["Source Polygons", "Target Features"],
        "parameters": [],
    },
    "sum_within": {
        "fn": q_sum_within,
        "name": "Sum Field Within",
        "category": "Aggregate",
        "description": "Sum a numeric field of target features inside each source polygon",
        "layer_labels": ["Source Polygons", "Target Features"],
        "parameters": [
            {"name": "stat_field", "label": "Target Field to Sum", "type": "text", "required": True,
             "placeholder": "e.g. population"},
        ],
    },
    "intersect_area": {
        "fn": q_intersect_area,
        "name": "Intersection Area",
        "category": "Aggregate",
        "description": "Compute the intersection area (km²) and % coverage between source and target polygons",
        "layer_labels": ["Source Polygons", "Target Polygons"],
        "parameters": [],
    },
    "largest_overlap": {
        "fn": q_largest_overlap,
        "name": "Largest Overlap",
        "category": "Aggregate",
        "description": "For each source polygon, find which target polygon it overlaps most with",
        "layer_labels": ["Source Polygons", "Target Polygons"],
        "parameters": [],
    },
    # ── Advanced ─────────────────────────────────────────────────────────────
    "select_by_location": {
        "fn": q_select_by_location,
        "name": "Select by Location",
        "category": "Advanced",
        "description": "Select source features using any DE-9IM spatial predicate",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [
            {"name": "predicate", "label": "Spatial Predicate", "type": "select",
             "default": "intersects", "required": True,
             "options": ["intersects", "within", "contains", "touches", "crosses", "overlaps", "disjoint"]},
        ],
    },
    "relate": {
        "fn": q_relate,
        "name": "Spatial Relate (all flags)",
        "category": "Advanced",
        "description": "Compute all DE-9IM relationship flags for each source feature against the target layer",
        "layer_labels": ["Source Layer", "Target Layer"],
        "parameters": [],
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Views
# ─────────────────────────────────────────────────────────────────────────────

class SpatialQueryAPIView(APIView):
    """
    POST /django/mapplot/spatial/query
    Run a spatial query between a source and target layer.
    """
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        query_type = (_param(request, "query_type") or "").strip()

        if not query_type:
            return Response(
                {"error": "query_type is required",
                 "valid_types": list(QUERY_REGISTRY.keys())},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if query_type not in QUERY_REGISTRY:
            return Response(
                {"error": f"Unknown query_type '{query_type}'",
                 "valid_types": list(QUERY_REGISTRY.keys())},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Load source + target
        try:
            source, target = _load_source_target(request)
        except Exception as exc:
            return Response({"error": str(exc)},
                            status=status.HTTP_400_BAD_REQUEST)

        # Build kwargs from request params
        entry = QUERY_REGISTRY[query_type]
        kwargs = {}
        for p in entry.get("parameters", []):
            raw = _param(request, p["name"])
            if raw is not None and raw != "":
                if p["type"] == "number":
                    try:
                        kwargs[p["name"]] = float(raw)
                        if p["name"] in ("n",):
                            kwargs[p["name"]] = int(float(raw))
                    except ValueError:
                        return Response(
                            {"error": f"Parameter '{p['name']}' must be a number"},
                            status=status.HTTP_400_BAD_REQUEST)
                else:
                    kwargs[p["name"]] = raw
            elif p.get("required"):
                return Response(
                    {"error": f"Parameter '{p['name']}' is required"},
                    status=status.HTTP_400_BAD_REQUEST)
            elif p.get("default") is not None:
                kwargs[p["name"]] = p["default"]

        # Run query
        try:
            result = entry["fn"](source, target, **kwargs)
        except ValueError as exc:
            return Response({"error": str(exc)},
                            status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.exception("Spatial query '%s' failed", query_type)
            return Response({"error": f"Query failed: {exc}"},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if result is None or (hasattr(result, "empty") and result.empty):
            return Response({
                "message": f"Query '{query_type}' returned no matching features",
                "query_type": query_type,
                "source_count": len(source),
                "matched_count": 0,
            })

        result = _to_4326(result)
        geojson = _safe_json(result)

        return Response({
            "type": "FeatureCollection",
            "query_type": query_type,
            "query_name": entry["name"],
            "source_count": len(source),
            "matched_count": len(result),
            "features": geojson["features"],
        })


class SpatialQueryTypesView(APIView):
    """
    GET /django/mapplot/spatial/query/types
    Returns all available query types grouped by category.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        grouped: dict = {}
        for qid, entry in QUERY_REGISTRY.items():
            cat = entry["category"]
            if cat not in grouped:
                grouped[cat] = []
            grouped[cat].append({
                "id": qid,
                "name": entry["name"],
                "description": entry["description"],
                "layer_labels": entry.get("layer_labels", ["Source Layer", "Target Layer"]),
                "parameters": entry.get("parameters", []),
            })
        return Response({
            "categories": list(grouped.keys()),
            "queries": grouped,
            "total": len(QUERY_REGISTRY),
        })