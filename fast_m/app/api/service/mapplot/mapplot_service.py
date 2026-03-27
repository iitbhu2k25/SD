import json
import logging
import os
import tempfile
import threading
import zipfile
from io import BytesIO
from typing import Any, Optional

import contextily as ctx
import geopandas as gpd
import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas as pdf_canvas
import shapely
from shapely.affinity import rotate as shapely_rotate, scale as shapely_scale, translate as shapely_translate
from shapely.geometry import MultiPoint, shape
from shapely.ops import voronoi_diagram

matplotlib.use("Agg")

logger = logging.getLogger(__name__)


class MapplotService:
    _GEOGRAPHIC_CRS = {4326, 4269, 4267, 4230, 4258}
    _SUPPORTED_EXTENSIONS = {".zip", ".shp", ".geojson", ".json", ".gpkg", ".kml", ".gml", ".fgb", ".tab", ".mif", ".csv"}

    # ── GeoJSON chunk upload storage (in-memory) ─────────────────────────
    _chunk_store: dict = {}   # upload_id -> {"chunks": {idx: str}, "total": int}
    _chunk_lock = threading.Lock()

    # ── Binary file chunk storage (on-disk) ──────────────────────────────
    _FILE_CHUNK_BASE = os.path.join(tempfile.gettempdir(), "slcr_file_chunks")

    def upload_chunk(self, upload_id: str, chunk_index: int, total_chunks: int, data: str) -> dict:
        with self._chunk_lock:
            if upload_id not in self._chunk_store:
                self._chunk_store[upload_id] = {"chunks": {}, "total": total_chunks}
            entry = self._chunk_store[upload_id]
            entry["chunks"][chunk_index] = data
            complete = len(entry["chunks"]) == entry["total"]
        return self._ok({"received": chunk_index, "complete": complete, "upload_id": upload_id})

    def _assemble_chunks(self, upload_id: str) -> Any:
        with self._chunk_lock:
            entry = self._chunk_store.pop(upload_id, None)
        if entry is None:
            raise ValueError(f"upload_id '{upload_id}' not found or already used")
        assembled = "".join(entry["chunks"][i] for i in range(entry["total"]))
        return json.loads(assembled)

    def _resolve_geojson(self, geojson: Optional[Any], upload_id: Optional[str]) -> Any:
        if upload_id:
            return self._assemble_chunks(upload_id)
        if geojson is None:
            raise ValueError("Either geojson or upload_id must be provided")
        return geojson

    # ── Binary file chunk upload (writes chunks to disk) ─────────────────

    def upload_file_chunk(
        self,
        upload_id: str,
        file_index: int,
        chunk_index: int,
        total_chunks: int,
        filename: str,
        data: bytes,
    ) -> dict:
        """Store one binary chunk for a large file upload."""
        file_dir = os.path.join(self._FILE_CHUNK_BASE, upload_id, f"file_{file_index}")
        os.makedirs(file_dir, exist_ok=True)

        # Write the chunk
        with open(os.path.join(file_dir, f"chunk_{chunk_index:06d}"), "wb") as f:
            f.write(data)

        # Count received chunks for this file
        received = len([n for n in os.listdir(file_dir) if n.startswith("chunk_")])
        file_complete = received == total_chunks

        if file_complete:
            # Persist per-file metadata
            meta_path = os.path.join(file_dir, "meta.json")
            with open(meta_path, "w") as f:
                json.dump({"filename": filename, "total_chunks": total_chunks}, f)

        return self._ok({
            "received": chunk_index,
            "file_complete": file_complete,
            "upload_id": upload_id,
            "file_index": file_index,
        })

    def _assemble_file_chunks(self, upload_id: str, temp_dir: str) -> list[str]:
        """
        Assemble all files in an upload session into *temp_dir*.
        Returns list of assembled file paths.
        """
        session_dir = os.path.join(self._FILE_CHUNK_BASE, upload_id)
        if not os.path.isdir(session_dir):
            raise ValueError(f"Upload session '{upload_id}' not found")

        assembled_paths = []
        file_dirs = sorted(
            [d for d in os.listdir(session_dir) if d.startswith("file_")],
            key=lambda d: int(d.split("_")[1]),
        )
        for file_dir_name in file_dirs:
            file_dir = os.path.join(session_dir, file_dir_name)
            meta_path = os.path.join(file_dir, "meta.json")
            if not os.path.exists(meta_path):
                raise ValueError(f"Incomplete upload in session '{upload_id}' ({file_dir_name})")
            with open(meta_path) as f:
                meta = json.load(f)
            filename = meta["filename"]
            total = meta["total_chunks"]
            dest = os.path.join(temp_dir, filename)
            with open(dest, "wb") as out_f:
                for i in range(total):
                    with open(os.path.join(file_dir, f"chunk_{i:06d}"), "rb") as chunk_f:
                        out_f.write(chunk_f.read())
            assembled_paths.append(dest)
        return assembled_paths

    def _cleanup_file_chunks(self, upload_id: str) -> None:
        session_dir = os.path.join(self._FILE_CHUNK_BASE, upload_id)
        if not os.path.isdir(session_dir):
            return
        try:
            for root, dirs, files in os.walk(session_dir, topdown=False):
                for fn in files:
                    os.remove(os.path.join(root, fn))
                for d in dirs:
                    os.rmdir(os.path.join(root, d))
            os.rmdir(session_dir)
        except Exception:
            pass

    def _ok(self, content: Any, status_code: int = 200) -> dict:
        return {"ok": True, "status_code": status_code, "content": content}

    def _error(self, message: str, status_code: int = 400) -> dict:
        return {"ok": False, "status_code": status_code, "content": {"error": message}}

    def _to_4326(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        if gdf.crs is None:
            return gdf.set_crs("EPSG:4326")
        if gdf.crs.to_epsg() != 4326:
            return gdf.to_crs("EPSG:4326")
        return gdf

    def _to_metric(self, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
        return gdf.to_crs(epsg=3857)

    def _safe_json(self, gdf: gpd.GeoDataFrame) -> dict:
        raw = json.loads(gdf.to_json())
        for feat in raw.get("features", []):
            props = feat.get("properties") or {}
            for k, v in props.items():
                if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                    props[k] = None
        return raw

    def _param(self, form: Any, key: str, default: Any = None) -> Any:
        value = form.get(key, default)
        return value[0] if isinstance(value, list) else value

    def _geojson_to_gdf(self, raw: Any) -> gpd.GeoDataFrame:
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
            rows.append({"geometry": shape(geom), **props})
        if not rows:
            raise ValueError("No valid geometries in GeoJSON")
        return gpd.GeoDataFrame(rows, crs="EPSG:4326")

    def _normalize_crs(self, gdfs: list[gpd.GeoDataFrame]) -> tuple[list[gpd.GeoDataFrame], Any]:
        base_crs = gdfs[0].crs
        out = []
        for gdf in gdfs:
            if gdf.crs is None:
                out.append(gdf.set_crs(base_crs))
            elif gdf.crs != base_crs:
                out.append(gdf.to_crs(base_crs))
            else:
                out.append(gdf)
        return out, base_crs

    def _is_supported(self, filename: str) -> bool:
        return os.path.splitext(filename)[1].lower() in self._SUPPORTED_EXTENSIONS

    def _crs_info(self, gdf: gpd.GeoDataFrame) -> dict:
        crs = gdf.crs
        if crs is None:
            return {"code": None, "name": "Unknown / No CRS", "is_geographic": False, "unit": "unknown"}
        epsg = crs.to_epsg()
        name = crs.name if hasattr(crs, "name") else str(crs)
        is_geo = crs.is_geographic if hasattr(crs, "is_geographic") else epsg in self._GEOGRAPHIC_CRS
        return {"code": f"EPSG:{epsg}" if epsg else str(crs), "name": name, "is_geographic": is_geo, "unit": "degrees" if is_geo else "metres (projected)"}

    def _ensure_wgs84(self, gdf: gpd.GeoDataFrame) -> tuple[gpd.GeoDataFrame, dict]:
        original = self._crs_info(gdf)
        if gdf.crs is None:
            gdf = gdf.set_crs(epsg=4326, allow_override=True)
            original["assumed"] = True
        current_epsg = gdf.crs.to_epsg()
        if current_epsg != 4326:
            gdf = gdf.to_crs(epsg=4326)
        final = self._crs_info(gdf)
        return gdf, {"original": original, "final": final, "reprojected": current_epsg != 4326}

    def read_spatial_file(self, uploaded_file) -> gpd.GeoDataFrame:
        filename = uploaded_file.filename or uploaded_file.name
        suffix = os.path.splitext(filename)[1].lower()
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, filename)
            with open(path, "wb") as f:
                f.write(uploaded_file.file.read())
                uploaded_file.file.seek(0)
            if suffix == ".zip":
                with zipfile.ZipFile(path, "r") as zf:
                    zf.extractall(tmpdir)
                priority = [".shp", ".gpkg", ".geojson", ".json", ".kml", ".gml", ".fgb"]
                for ext in priority:
                    candidates = [os.path.join(root, fn) for root, _, files in os.walk(tmpdir) for fn in files if fn.lower().endswith(ext) and not fn.startswith("__MACOSX")]
                    if candidates:
                        return gpd.read_file(candidates[0])
                raise ValueError("ZIP archive does not contain a recognised spatial file")
            return gpd.read_file(path)

    def _load_gdfs(self, form: Any) -> list[gpd.GeoDataFrame]:
        gdfs = []
        idx = 0
        while True:
            # Check for a pre-uploaded chunk reference first
            upload_id = self._param(form, f"geojson_{idx}_upload_id")
            if upload_id:
                raw = self._assemble_chunks(upload_id)
                gdfs.append(self._to_4326(self._geojson_to_gdf(raw)))
                idx += 1
                continue
            raw = form.get(f"geojson_{idx}")
            if raw is None:
                break
            gdfs.append(self._to_4326(self._geojson_to_gdf(raw)))
            idx += 1
        if not gdfs:
            for raw in form.getlist("geojson[]"):
                gdfs.append(self._to_4326(self._geojson_to_gdf(raw)))
        if not gdfs:
            for f in form.getlist("files"):
                gdfs.append(self._to_4326(self.read_spatial_file(f)))
        return gdfs

    def get_layer_fields(self, geojson: Optional[Any] = None, upload_id: Optional[str] = None) -> dict:
        """Return attribute/field names for a GeoJSON layer."""
        try:
            data = self._resolve_geojson(geojson, upload_id)
            gdf = self._geojson_to_gdf(data)
            fields = [c for c in gdf.columns if c != "geometry"]
            return self._ok({"fields": fields})
        except Exception as e:
            return self._error(str(e))

    def spatial_process(self, form: Any) -> dict:
        operation = (form.get("operation") or "").strip()
        try:
            gdfs = self._load_gdfs(form)
        except Exception as exc:
            return self._error(f"Failed to load layers: {exc}")
        if not gdfs:
            return self._error("At least one layer is required")
        gdfs, base_crs = self._normalize_crs(gdfs)

        def p(key: str, default: Any = None):
            return self._param(form, key, default)

        try:
            if operation == "intersection":
                if len(gdfs) < 2:
                    return self._error("Intersection requires at least 2 layers")
                result = gdfs[0]
                for gdf in gdfs[1:]:
                    result = gpd.overlay(result, gdf, how="intersection", keep_geom_type=False)
                return self._ok({"message": "No intersection found"} if result.empty else self._safe_json(self._to_4326(result)))
            if operation == "union":
                if len(gdfs) < 2:
                    return self._error("Union requires at least 2 layers")
                result = gdfs[0]
                for gdf in gdfs[1:]:
                    result = gpd.overlay(result, gdf, how="union", keep_geom_type=False)
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "difference":
                if len(gdfs) < 2:
                    return self._error("Difference requires at least 2 layers")
                result = gdfs[0]
                for gdf in gdfs[1:]:
                    result = gpd.overlay(result, gdf, how="difference", keep_geom_type=False)
                return self._ok({"message": "No difference found"} if result.empty else self._safe_json(self._to_4326(result)))
            if operation == "symmetric_difference":
                if len(gdfs) != 2:
                    return self._error("Symmetric difference requires exactly 2 layers")
                result = gpd.overlay(gdfs[0], gdfs[1], how="symmetric_difference", keep_geom_type=False)
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "clip":
                if len(gdfs) != 2:
                    return self._error("Clip requires exactly 2 layers")
                result = gpd.clip(gdfs[0], gdfs[1])
                return self._ok({"message": "No features within clip boundary"} if result.empty else self._safe_json(self._to_4326(result)))
            if operation == "buffer":
                distance_m = float(p("distance", 100))
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                projected = combined.to_crs(epsg=3857).copy()
                projected["geometry"] = projected.geometry.buffer(distance_m)
                return self._ok(self._safe_json(self._to_4326(projected.to_crs(base_crs))))
            if operation == "dissolve":
                dissolve_field = p("dissolve_field", "all")
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                if dissolve_field and str(dissolve_field).strip().lower() not in ("all", ""):
                    if dissolve_field not in combined.columns:
                        return self._error(f"Field '{dissolve_field}' not found. Available: {list(combined.columns)}")
                    result = combined.dissolve(by=dissolve_field).reset_index()
                else:
                    combined["_dk"] = 1
                    result = combined.dissolve(by="_dk").reset_index(drop=True)
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "statistics":
                stats_type = p("stats_type", "area")
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs).copy()
                if stats_type == "area":
                    metric = combined.geometry.to_crs(epsg=6933)
                    combined["area_sqkm"] = metric.area / 1e6
                    combined["area_sqm"] = metric.area
                elif stats_type == "length":
                    metric = combined.geometry.to_crs(epsg=3857)
                    combined["length_km"] = metric.length / 1000
                    combined["length_m"] = metric.length
                elif stats_type == "perimeter":
                    combined["perimeter_km"] = combined.geometry.to_crs(epsg=3857).length / 1000
                elif stats_type == "centroid":
                    c = combined.geometry.centroid
                    combined["centroid_lon"] = c.x
                    combined["centroid_lat"] = c.y
                elif stats_type == "bounds":
                    b = combined.geometry.bounds
                    combined["minx"], combined["miny"], combined["maxx"], combined["maxy"] = b["minx"], b["miny"], b["maxx"], b["maxy"]
                combined["feature_count"] = 1
                return self._ok(self._safe_json(self._to_4326(combined)))
            if operation == "centroid":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.centroid
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "convex_hull":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.convex_hull
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "simplify":
                tolerance = float(p("tolerance", 0.001))
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.simplify(tolerance, preserve_topology=True)
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "merge":
                return self._ok(self._safe_json(self._to_4326(gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs))))
            if operation == "spatial_join":
                if len(gdfs) != 2:
                    return self._error("Spatial join requires exactly 2 layers")
                result = gpd.sjoin(gdfs[0], gdfs[1], how=p("join_type", "inner"), predicate=p("predicate", "intersects"))
                result = result.drop(columns=["index_right"], errors="ignore")
                return self._ok({"message": "No features matched the spatial join"} if result.empty else self._safe_json(self._to_4326(result)))
            if operation == "nearest":
                if len(gdfs) != 2:
                    return self._error("Nearest requires exactly 2 layers")
                result = gpd.sjoin_nearest(gdfs[0], gdfs[1], how="left", distance_col="nearest_dist_deg").drop(columns=["index_right"], errors="ignore")
                left_m = gdfs[0].to_crs(epsg=3857)
                right_union = gdfs[1].to_crs(epsg=3857).geometry.unary_union
                result["nearest_dist_m"] = [round(geom.distance(right_union), 2) for geom in left_m.geometry]
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "euclidean_distance":
                if len(gdfs) != 2:
                    return self._error("Euclidean distance requires exactly 2 layers")
                distances = [{"from_feature": i, "to_feature": j, "distance": round(g1.distance(g2), 6)} for i, g1 in enumerate(gdfs[0].geometry) for j, g2 in enumerate(gdfs[1].geometry)]
                return self._ok({"type": "DistanceMatrix", "distances": distances, "count": len(distances)})
            if operation == "point_in_polygon":
                if len(gdfs) != 2:
                    return self._error("Point in polygon requires exactly 2 layers")
                g0_types = set(gdfs[0].geometry.geom_type.unique())
                g1_types = set(gdfs[1].geometry.geom_type.unique())
                point_types = {"Point", "MultiPoint"}
                points, polys = (gdfs[0], gdfs[1]) if g0_types <= point_types else ((gdfs[1], gdfs[0]) if g1_types <= point_types else (gdfs[0], gdfs[1]))
                result = gpd.sjoin(points, polys, how="inner", predicate="within").drop(columns=["index_right"], errors="ignore")
                return self._ok({"message": "No points found within the polygons"} if result.empty else self._safe_json(self._to_4326(result)))
            if operation == "bounding_box":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.envelope
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "voronoi":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                points = [geom if geom.geom_type == "Point" else geom.centroid for geom in combined.geometry]
                result = gpd.GeoDataFrame(geometry=list(voronoi_diagram(MultiPoint(points)).geoms), crs=base_crs)
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "area_comparison":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs).copy()
                combined["area_sqkm"] = combined.geometry.to_crs(epsg=6933).area / 1e6
                total = combined["area_sqkm"].sum()
                combined["percentage"] = (combined["area_sqkm"] / total * 100).round(2)
                combined["rank"] = combined["area_sqkm"].rank(ascending=False)
                return self._ok(self._safe_json(self._to_4326(combined)))
            if operation == "topology_check":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs).copy()
                combined["is_valid"] = combined.geometry.is_valid
                combined["is_simple"] = combined.geometry.is_simple
                combined["is_empty"] = combined.geometry.is_empty
                invalid_count = int((~combined["is_valid"]).sum())
                if invalid_count:
                    mask = ~combined["is_valid"]
                    combined.loc[mask, "geometry"] = combined.loc[mask, "geometry"].buffer(0)
                return self._ok({"geojson": self._safe_json(self._to_4326(combined)), "summary": {"total_features": len(combined), "invalid_features": invalid_count, "empty_features": int(combined["is_empty"].sum())}})
            if operation == "filter":
                field = p("field")
                operator = p("operator", "equals")
                value = p("value")
                if not field or value is None:
                    return self._error("field and value are required")
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                if field not in combined.columns:
                    return self._error(f"Field '{field}' not found. Available: {list(combined.columns)}")
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
                    mask = col.astype(str).str.contains(str(value), case=False, na=False)
                else:
                    return self._error(f"Unknown operator: {operator}")
                result = combined[mask]
                return self._ok({"message": "No features match the filter"} if result.empty else self._safe_json(self._to_4326(result)))
            if operation == "reproject":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                return self._ok(self._safe_json(combined.to_crs(p("target_crs", "EPSG:4326"))))
            if operation == "rotate":
                angle = float(p("angle", 45))
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.apply(lambda g: shapely_rotate(g, angle, origin="centroid"))
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "scale":
                xfact = float(p("xfact", 1.5))
                yfact = float(p("yfact", 1.5))
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.apply(lambda g: shapely_scale(g, xfact, yfact, origin="centroid"))
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "translate":
                xoff = float(p("xoff", 0.01))
                yoff = float(p("yoff", 0.01))
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.apply(lambda g: shapely_translate(g, xoff=xoff, yoff=yoff))
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "minimum_bounding_circle":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                result = combined.copy()
                def _min_circle(geom):
                    try:
                        return shapely.minimum_bounding_circle(geom)
                    except Exception:
                        c = geom.centroid
                        hull = geom.convex_hull
                        coords = list(hull.exterior.coords) if hasattr(hull, "exterior") else [geom.coords[0]]
                        radius = max(c.distance(shape({"type": "Point", "coordinates": list(pt)})) for pt in coords) if coords else 0.001
                        return c.buffer(radius)
                result["geometry"] = combined.geometry.apply(_min_circle)
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "polygon_to_line":
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.boundary
                result = result[~result.geometry.is_empty]
                return self._ok(self._safe_json(self._to_4326(result)))
            if operation == "snap_to_grid":
                grid_size = float(p("grid_size", 0.0001))
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                result = combined.copy()
                result["geometry"] = combined.geometry.apply(lambda g: shapely.set_precision(g, grid_size))
                return self._ok(self._safe_json(self._to_4326(result)))
            return self._error("Unknown operation")
        except Exception as exc:
            logger.exception("Spatial process failed: %s", exc)
            return self._error(f"Processing error: {exc}", status_code=500)

    def spatial_operations_list(self) -> dict:
        return {
            "overlay_operations": [{"name": "intersection"}, {"name": "union"}, {"name": "difference"}, {"name": "symmetric_difference"}, {"name": "clip"}],
            "geometric_operations": [{"name": "buffer"}, {"name": "dissolve"}, {"name": "centroid"}, {"name": "convex_hull"}, {"name": "bounding_box"}, {"name": "simplify"}, {"name": "voronoi"}, {"name": "rotate"}, {"name": "scale"}, {"name": "translate"}, {"name": "minimum_bounding_circle"}, {"name": "polygon_to_line"}],
            "analysis_operations": [{"name": "statistics"}, {"name": "spatial_join"}, {"name": "nearest"}, {"name": "euclidean_distance"}, {"name": "point_in_polygon"}, {"name": "area_comparison"}, {"name": "topology_check"}],
            "utility_operations": [{"name": "merge"}, {"name": "filter"}, {"name": "reproject"}, {"name": "snap_to_grid"}],
        }

    def _query_registry(self) -> dict:
        def _within_dist(s, t, distance_m=1000, **k):
            dm = float(distance_m)
            s_m, t_m = s.to_crs(epsg=3857), t.to_crs(epsg=3857)
            buf = t_m.geometry.unary_union.buffer(dm)
            return s[s_m.geometry.intersects(buf)].copy()

        def _not_within_dist(s, t, distance_m=1000, **k):
            dm = float(distance_m)
            s_m, t_m = s.to_crs(epsg=3857), t.to_crs(epsg=3857)
            buf = t_m.geometry.unary_union.buffer(dm)
            return s[~s_m.geometry.intersects(buf)].copy()

        def _distance_band(s, t, min_dist_m=0, max_dist_m=5000, **k):
            lo, hi = float(min_dist_m), float(max_dist_m)
            s_m, t_m = s.to_crs(epsg=3857), t.to_crs(epsg=3857)
            union = t_m.geometry.unary_union
            in_max = s_m.geometry.intersects(union.buffer(hi))
            in_min = s_m.geometry.intersects(union.buffer(lo))
            return s[in_max & ~in_min].copy()

        def _nearest_n(s, t, n=1, **k):
            n = int(n)
            result = gpd.sjoin_nearest(s, t, how="left", distance_col="_ndist", max_distance=None)
            result = result.drop(columns=["index_right"], errors="ignore")
            top = result.groupby(result.index).head(n)
            return top

        def _count_within(s, t, **k):
            joined = gpd.sjoin(s, t, how="left", predicate="contains")
            counts = joined.groupby(joined.index).size().rename("count_within")
            result = s.copy()
            result["count_within"] = counts.reindex(result.index).fillna(0).astype(int)
            return result

        def _sum_within(s, t, stat_field="", **k):
            if not stat_field or stat_field not in t.columns:
                raise ValueError(f"stat_field '{stat_field}' not found in target layer")
            joined = gpd.sjoin(s, t[[stat_field, "geometry"]], how="left", predicate="contains")
            sums = joined.groupby(joined.index)[stat_field].sum().rename(f"sum_{stat_field}")
            result = s.copy()
            result[f"sum_{stat_field}"] = sums.reindex(result.index).fillna(0)
            return result

        def _intersect_area(s, t, **k):
            s_m = s.to_crs(epsg=3857)
            t_m = t.to_crs(epsg=3857)
            overlay = gpd.overlay(s_m, t_m, how="intersection", keep_geom_type=False)
            overlay["intersect_area_sqkm"] = overlay.geometry.area / 1e6
            s_areas = s_m.geometry.area / 1e6
            s_areas.name = "source_area_sqkm"
            overlay = overlay.join(s_areas, rsuffix="_src", how="left")
            overlay["coverage_pct"] = (overlay["intersect_area_sqkm"] / overlay.get("source_area_sqkm", 1) * 100).round(2)
            if overlay.crs and overlay.crs.to_epsg() != 4326:
                overlay = overlay.to_crs(epsg=4326)
            return overlay

        def _largest_overlap(s, t, **k):
            s_m = s.to_crs(epsg=3857)
            t_m = t.to_crs(epsg=3857).reset_index(drop=True)
            rows = []
            for i, src_geom in enumerate(s_m.geometry):
                best_area, best_idx = 0.0, -1
                for j, tgt_geom in enumerate(t_m.geometry):
                    try:
                        inter = src_geom.intersection(tgt_geom).area
                    except Exception:
                        inter = 0.0
                    if inter > best_area:
                        best_area, best_idx = inter, j
                rows.append({"source_idx": i, "best_target_idx": best_idx, "overlap_sqkm": round(best_area / 1e6, 6)})
            result = s.copy().reset_index(drop=True)
            result["best_target_idx"] = [r["best_target_idx"] for r in rows]
            result["overlap_sqkm"] = [r["overlap_sqkm"] for r in rows]
            return result

        def _select_by_location(s, t, predicate="intersects", **k):
            union = t.geometry.unary_union
            mask = getattr(s.geometry, predicate)(union)
            return s[mask].copy()

        def _relate(s, t, **k):
            union = t.geometry.unary_union
            result = s.copy()
            result["de9im_intersects"] = s.geometry.intersects(union)
            result["de9im_within"] = s.geometry.within(union)
            result["de9im_contains"] = s.geometry.contains(union)
            result["de9im_touches"] = s.geometry.touches(union)
            result["de9im_crosses"] = s.geometry.crosses(union)
            result["de9im_overlaps"] = s.geometry.overlaps(union)
            result["de9im_disjoint"] = s.geometry.disjoint(union)
            return result

        return {
            # Topological
            "intersects":           {"name": "Intersects",           "category": "Topological", "parameters": [],                                                                          "fn": lambda s, t, **k: s[s.geometry.intersects(t.geometry.unary_union)].copy()},
            "within":               {"name": "Within",               "category": "Topological", "parameters": [],                                                                          "fn": lambda s, t, **k: s[s.geometry.within(t.geometry.unary_union)].copy()},
            "contains":             {"name": "Contains",             "category": "Topological", "parameters": [],                                                                          "fn": lambda s, t, **k: s[s.geometry.contains(t.geometry.unary_union)].copy()},
            "touches":              {"name": "Touches",              "category": "Topological", "parameters": [],                                                                          "fn": lambda s, t, **k: s[s.geometry.touches(t.geometry.unary_union)].copy()},
            "crosses":              {"name": "Crosses",              "category": "Topological", "parameters": [],                                                                          "fn": lambda s, t, **k: s[s.geometry.crosses(t.geometry.unary_union)].copy()},
            "overlaps":             {"name": "Overlaps",             "category": "Topological", "parameters": [],                                                                          "fn": lambda s, t, **k: s[s.geometry.overlaps(t.geometry.unary_union)].copy()},
            "disjoint":             {"name": "Disjoint (No relation)","category": "Topological", "parameters": [],                                                                         "fn": lambda s, t, **k: s[s.geometry.disjoint(t.geometry.unary_union)].copy()},
            # Distance
            "within_distance":      {"name": "Within Distance",      "category": "Distance",    "parameters": [{"name": "distance_m",  "label": "Distance (m)",     "type": "number", "default": 1000}], "fn": _within_dist},
            "not_within_distance":  {"name": "Not Within Distance",  "category": "Distance",    "parameters": [{"name": "distance_m",  "label": "Distance (m)",     "type": "number", "default": 1000}], "fn": _not_within_dist},
            "distance_band":        {"name": "Distance Band",        "category": "Distance",    "parameters": [{"name": "min_dist_m",  "label": "Min Distance (m)", "type": "number", "default": 0},
                                                                                                                {"name": "max_dist_m", "label": "Max Distance (m)", "type": "number", "default": 5000}],  "fn": _distance_band},
            "nearest_n":            {"name": "Nearest N Features",   "category": "Distance",    "parameters": [{"name": "n",           "label": "N nearest",        "type": "number", "default": 1}],    "fn": _nearest_n},
            # Aggregate
            "count_within":         {"name": "Count Within",         "category": "Aggregate",   "parameters": [],                                                                          "fn": _count_within},
            "sum_within":           {"name": "Sum Field Within",     "category": "Aggregate",   "parameters": [{"name": "stat_field",  "label": "Target Field",     "type": "text"}],      "fn": _sum_within},
            "intersect_area":       {"name": "Intersection Area",    "category": "Aggregate",   "parameters": [],                                                                          "fn": _intersect_area},
            "largest_overlap":      {"name": "Largest Overlap",      "category": "Aggregate",   "parameters": [],                                                                          "fn": _largest_overlap},
            # Advanced
            "select_by_location":   {"name": "Select by Location",   "category": "Advanced",    "parameters": [{"name": "predicate", "label": "Predicate", "type": "select", "default": "intersects", "options": ["intersects","within","contains","touches","crosses","overlaps","disjoint"]}], "fn": _select_by_location},
            "relate":               {"name": "Spatial Relate (all)", "category": "Advanced",    "parameters": [],                                                                          "fn": _relate},
        }

    def spatial_query(self, form: Any) -> dict:
        registry = self._query_registry()
        query_type = (self._param(form, "query_type") or "").strip()
        if not query_type:
            return {"ok": False, "status_code": 400, "content": {"error": "query_type is required", "valid_types": list(registry.keys())}}
        if query_type not in registry:
            return {"ok": False, "status_code": 400, "content": {"error": f"Unknown query_type '{query_type}'", "valid_types": list(registry.keys())}}
        try:
            src_uid = self._param(form, "geojson_0_upload_id")
            tgt_uid = self._param(form, "geojson_1_upload_id")
            raw_source = self._assemble_chunks(src_uid) if src_uid else form.get("geojson_0")
            raw_target = self._assemble_chunks(tgt_uid) if tgt_uid else form.get("geojson_1")
            source = self._to_4326(self._geojson_to_gdf(raw_source))
            target = self._to_4326(self._geojson_to_gdf(raw_target))
            extra = {k: (v[0] if isinstance(v, list) else v) for k, v in form.items() if k not in ("query_type", "geojson_0", "geojson_1")}
            result = registry[query_type]["fn"](source, target, **extra)
            if result.empty:
                return self._ok({"message": f"Query '{query_type}' returned no matching features", "query_type": query_type, "source_count": len(source), "matched_count": 0})
            geojson = self._safe_json(self._to_4326(result))
            return self._ok({"type": "FeatureCollection", "query_type": query_type, "query_name": registry[query_type]["name"], "source_count": len(source), "matched_count": len(result), "features": geojson["features"]})
        except Exception as exc:
            return self._error(str(exc), status_code=400)

    def spatial_query_types(self) -> dict:
        registry = self._query_registry()
        grouped = {}
        for qid, entry in registry.items():
            grouped.setdefault(entry["category"], []).append({"id": qid, "name": entry["name"], "description": entry["name"], "layer_labels": ["Source Layer", "Target Layer"], "parameters": entry.get("parameters", [])})
        return {"categories": list(grouped.keys()), "queries": grouped, "total": len(registry)}

    def _scan_directory(self, base_path: str) -> dict:
        response = {}
        for category in os.listdir(base_path):
            category_path = os.path.join(base_path, category)
            if not os.path.isdir(category_path):
                continue
            subdirs = [d for d in os.listdir(category_path) if os.path.isdir(os.path.join(category_path, d))]
            shp_files = [f[:-4].lower() for f in os.listdir(category_path) if f.endswith(".shp")]
            if subdirs:
                response[category.lower()] = [s.lower() for s in subdirs]
            elif shp_files:
                response[category.lower()] = shp_files if len(shp_files) > 1 else ["all"]
        return response

    def shapefile_directory(self) -> dict:
        base_path = os.path.join(os.getenv("MEDIA_ROOT", "media"), "shapefile")
        if not os.path.exists(base_path):
            return self._error("Shapefile directory not found", status_code=404)
        return self._ok(self._scan_directory(base_path))

    def get_shapefile_data(self, category: str, subcategory: str) -> dict:
        base_path = os.path.join(os.getenv("MEDIA_ROOT", "media"), "shapefile")
        if not os.path.exists(base_path):
            return self._error("Shapefile directory missing", status_code=404)
        target_shp = None
        for root, _, files in os.walk(base_path):
            for file in files:
                if file.lower().endswith(".shp"):
                    path = os.path.join(root, file)
                    if (category or "").lower() in path.lower() and (subcategory or "").lower() in path.lower():
                        target_shp = path
                        break
            if target_shp:
                break
        if not target_shp:
            return self._error("Shapefile not found for given category/subcategory", status_code=404)
        gdf = gpd.read_file(target_shp)
        gdf, crs_meta = self._ensure_wgs84(gdf)
        geojson = self._safe_json(gdf)
        geojson["_crs"] = crs_meta
        return self._ok(geojson)

    def _sse(self, data: dict) -> str:
        return f"data: {json.dumps(data)}\n\n"

    def upload_shapefile_sse(self, files: list[Any], upload_id: Optional[str] = None):
        temp_dir = tempfile.mkdtemp()
        try:
            target_path = None

            if upload_id:
                # ── Chunked path: assemble pre-uploaded binary chunks ──────
                yield self._sse({"pct": 15, "phase": "receiving", "msg": "Assembling uploaded chunks..."})
                try:
                    assembled = self._assemble_file_chunks(upload_id, temp_dir)
                except Exception as exc:
                    yield self._sse({"pct": 0, "phase": "error", "msg": str(exc)})
                    return

                # Find the primary spatial file from the assembled files
                zip_path = next((p for p in assembled if p.lower().endswith(".zip")), None)
                shp_path = next((p for p in assembled if p.lower().endswith(".shp")), None)

                if zip_path:
                    yield self._sse({"pct": 30, "phase": "extracting", "msg": "Extracting archive..."})
                    with zipfile.ZipFile(zip_path, "r") as zr:
                        zr.extractall(temp_dir)
                    priority = [".shp", ".gpkg", ".geojson", ".json", ".kml", ".gml", ".fgb"]
                    for ext in priority:
                        hits = [
                            os.path.join(root, fn)
                            for root, _, fns in os.walk(temp_dir)
                            for fn in fns
                            if fn.lower().endswith(ext) and not fn.startswith("__MACOSX")
                        ]
                        if hits:
                            target_path = hits[0]
                            break
                elif shp_path:
                    target_path = shp_path
                else:
                    # Use first assembled file directly
                    target_path = assembled[0] if assembled else None

            else:
                # ── Direct path: files received in the request body ────────
                if not files:
                    yield self._sse({"pct": 0, "phase": "error", "msg": "No file uploaded"})
                    return
                yield self._sse({"pct": 10, "phase": "receiving", "msg": "Receiving files..."})
                shp_file = None
                zip_file = None
                for f in files:
                    name = f.filename or f.name
                    dest = os.path.join(temp_dir, name)
                    with open(dest, "wb") as d:
                        d.write(f.file.read())
                        f.file.seek(0)
                    ext = os.path.splitext(name)[1].lower()
                    if ext == ".zip":
                        zip_file = dest
                    elif ext == ".shp":
                        shp_file = dest
                target_path = shp_file
                if zip_file:
                    with zipfile.ZipFile(zip_file, "r") as zr:
                        zr.extractall(temp_dir)
                    priority = [".shp", ".gpkg", ".geojson", ".json", ".kml", ".gml", ".fgb"]
                    for ext in priority:
                        hits = [
                            os.path.join(root, fn)
                            for root, _, fns in os.walk(temp_dir)
                            for fn in fns
                            if fn.lower().endswith(ext) and not fn.startswith("__MACOSX")
                        ]
                        if hits:
                            target_path = hits[0]
                            break

            if not target_path:
                yield self._sse({"pct": 0, "phase": "error", "msg": "No readable spatial file found"})
                return

            yield self._sse({"pct": 50, "phase": "reading", "msg": "Reading spatial data..."})
            gdf = gpd.read_file(target_path)
            if gdf.empty:
                yield self._sse({"pct": 0, "phase": "error", "msg": "File contains no features"})
                return

            yield self._sse({"pct": 75, "phase": "crs_check", "msg": "Checking coordinate system..."})
            gdf, crs_meta = self._ensure_wgs84(gdf)

            yield self._sse({"pct": 90, "phase": "converting", "msg": "Converting to GeoJSON..."})
            total_features = len(gdf)
            source_file = os.path.basename(target_path)

            # ── Stream features in ~1 MB GDF slices ─────────────────────
            # Process small chunks of the GeoDataFrame at a time so the full
            # GeoJSON is never held in memory — critical for large datasets.
            BATCH_ROWS = 500
            sent_count = 0

            for start in range(0, total_features, BATCH_ROWS):
                end = min(start + BATCH_ROWS, total_features)
                chunk_dict = json.loads(gdf.iloc[start:end].to_json())
                # Sanitise NaN / Inf in this batch only
                for feat in chunk_dict.get("features", []):
                    props = feat.get("properties") or {}
                    for k, v in props.items():
                        if isinstance(v, float) and (np.isnan(v) or np.isinf(v)):
                            props[k] = None
                sent_count = end
                is_last = end >= total_features

                yield self._sse({
                    "pct": 100 if is_last else round(90 + sent_count / total_features * 8),
                    "phase": "done" if is_last else "streaming",
                    "msg": f"Ready - {total_features:,} features loaded" if is_last
                           else f"Streaming {sent_count}/{total_features} features…",
                    "chunk": chunk_dict,
                    "sent": sent_count,
                    "total": total_features,
                    **({"feature_count": total_features, "crs": crs_meta, "source_file": source_file}
                       if is_last else {}),
                })
                del chunk_dict  # free memory immediately

        except Exception as exc:
            yield self._sse({"pct": 0, "phase": "error", "msg": str(exc)})
        finally:
            # Cleanup temp processing directory
            try:
                for root, dirs, fs in os.walk(temp_dir, topdown=False):
                    for fn in fs:
                        os.remove(os.path.join(root, fn))
                    for d in dirs:
                        os.rmdir(os.path.join(root, d))
                os.rmdir(temp_dir)
            except Exception:
                pass
            # Cleanup chunk session directory (if chunked upload)
            if upload_id:
                self._cleanup_file_chunks(upload_id)

    def _get_basemap(self, style: str):
        if style == "satellite":
            return ctx.providers.Esri.WorldImagery
        if style == "terrain":
            return ctx.providers.Stamen.Terrain
        if style == "light":
            return ctx.providers.CartoDB.Positron
        if style == "dark":
            return ctx.providers.CartoDB.DarkMatter
        return ctx.providers.OpenStreetMap.Mapnik

    def _validate_geojson(self, geojson_data):
        if isinstance(geojson_data, str):
            geojson_data = json.loads(geojson_data)
        gdf = gpd.GeoDataFrame.from_features(geojson_data["features"] if "features" in geojson_data else [geojson_data])
        if gdf.empty:
            raise ValueError("GeoJSON has no features")
        if gdf.crs is None:
            gdf.set_crs(epsg=4326, inplace=True)
        return gdf

    def export_png(self, geojson: Any = None, basemap: str = "osm", basemap_alpha: float = 0.6, upload_id: Optional[str] = None) -> dict:
        try:
            geojson = self._resolve_geojson(geojson, upload_id)
            gdf = self._validate_geojson(geojson).to_crs(epsg=3857)
            fig, ax = plt.subplots(figsize=(16, 9), dpi=300)
            gdf.plot(ax=ax, facecolor="#78b4db", edgecolor="red", alpha=0.4)
            ctx.add_basemap(ax, source=self._get_basemap(basemap), alpha=basemap_alpha)
            ax.set_axis_off()
            ax.set_aspect("equal")
            buffer = BytesIO()
            plt.savefig(buffer, format="png", bbox_inches="tight", dpi=300)
            plt.close()
            return self._ok(buffer.getvalue())
        except Exception as exc:
            return self._error(str(exc))

    def export_pdf(self, geojson: Any = None, basemap: str = "osm", basemap_alpha: float = 0.5, heading: str = "Map Export", upload_id: Optional[str] = None) -> dict:
        try:
            geojson = self._resolve_geojson(geojson, upload_id)
            gdf = self._validate_geojson(geojson)
            bounds = gdf.total_bounds
            gdf_3857 = gdf.to_crs(epsg=3857)
            temp_img = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
            fig, ax = plt.subplots(figsize=(11, 8), dpi=300)
            gdf_3857.plot(ax=ax, facecolor="#78b4db", edgecolor="black", alpha=0.4)
            ctx.add_basemap(ax, source=self._get_basemap(basemap), alpha=basemap_alpha)
            ax.set_axis_off()
            ax.set_aspect("equal")
            plt.savefig(temp_img.name, dpi=300, bbox_inches="tight")
            plt.close()
            temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            c = pdf_canvas.Canvas(temp_pdf.name, pagesize=A4)
            c.setFont("Helvetica-Bold", 18)
            c.drawCentredString(300, 820, heading)
            c.drawImage(temp_img.name, 40, 120, width=520, height=650)
            minx, miny, maxx, maxy = bounds
            c.setFont("Helvetica", 9)
            c.drawString(40, 100, f"Lon: {minx:.4f}° to {maxx:.4f}°")
            c.drawString(40, 85, f"Lat: {miny:.4f}° to {maxy:.4f}°")
            c.save()
            with open(temp_pdf.name, "rb") as f:
                data = f.read()
            os.unlink(temp_img.name)
            os.unlink(temp_pdf.name)
            return self._ok(data)
        except Exception as exc:
            return self._error(str(exc))

    def export_shapefile(self, geojson: dict = None, filename: str = "export", upload_id: Optional[str] = None) -> dict:
        try:
            geojson = self._resolve_geojson(geojson, upload_id)
            gdf = gpd.GeoDataFrame.from_features(geojson["features"])
            if gdf.crs is None:
                gdf.set_crs(epsg=4326, inplace=True)
            with tempfile.TemporaryDirectory() as temp_dir:
                shp_path = os.path.join(temp_dir, f"{filename}.shp")
                gdf.to_file(shp_path)
                zip_buffer = BytesIO()
                with zipfile.ZipFile(zip_buffer, "w") as zipf:
                    for ext in [".shp", ".shx", ".dbf", ".prj"]:
                        fp = shp_path.replace(".shp", ext)
                        if os.path.exists(fp):
                            zipf.write(fp, arcname=f"{filename}{ext}")
                return self._ok(zip_buffer.getvalue())
        except Exception as exc:
            return self._error(str(exc))
