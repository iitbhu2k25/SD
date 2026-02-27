# mapplot/views_upload_sse.py


import json
import logging
import os
import tempfile
import zipfile

import geopandas as gpd
from django.http import StreamingHttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from .views import _ensure_wgs84, gdf_to_geojson, _is_supported

logger = logging.getLogger(__name__)


def _sse(data: dict) -> str:
    """Format a dict as a single SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


class UploadShapefileSSE(APIView):
    """
    POST /django/mapplot/upload-shapefile

    Returns a text/event-stream response.
    Each processing step emits:
        data: {"pct": N, "phase": "...", "msg": "..."}

    Final success event:
        data: {"pct": 100, "phase": "done", "msg": "...",
               "feature_count": N, "crs": {...}, "source_file": "...",
               "geojson": {...}}

    Error event:
        data: {"pct": 0, "phase": "error", "msg": "..."}
    """
    permission_classes = [AllowAny]
    # No parser_classes — we read request.FILES directly

    def post(self, request, *args, **kwargs):
        files = request.FILES.getlist("file")

        if not files:
            # Even errors go through SSE so the frontend handler is uniform
            def _err():
                yield _sse({"pct": 0, "phase": "error", "msg": "No file uploaded"})
            return StreamingHttpResponse(
                _err(), content_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

        return StreamingHttpResponse(
            self._process(files),
            content_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    def _process(self, files):
        """Generator — yields SSE strings as each real step completes."""
        temp_dir = tempfile.mkdtemp()

        try:
            # ── STEP 1: Receiving ──────────────────────────────────────────
            yield _sse({"pct": 10, "phase": "receiving", "msg": "Receiving files…"})

            shp_file = None
            zip_file = None

            for f in files:
                dest = os.path.join(temp_dir, f.name)
                with open(dest, "wb+") as d:
                    for chunk in f.chunks():
                        d.write(chunk)
                ext = os.path.splitext(f.name)[1].lower()
                if ext == ".zip":
                    zip_file = dest
                elif ext == ".shp":
                    shp_file = dest

            yield _sse({"pct": 20, "phase": "receiving",
                        "msg": f"Saved {len(files)} file(s) — inspecting…"})

            # ── STEP 2: Extracting ─────────────────────────────────────────
            target_path = None

            if zip_file:
                yield _sse({"pct": 30, "phase": "extracting", "msg": "Extracting ZIP archive…"})
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
                    yield _sse({"pct": 0, "phase": "error",
                                "msg": "No spatial file found inside ZIP"})
                    return

                yield _sse({"pct": 38, "phase": "extracting",
                            "msg": f"Found: {os.path.basename(target_path)}"})

            elif shp_file:
                target_path = shp_file
                yield _sse({"pct": 35, "phase": "extracting",
                            "msg": f"Shapefile detected: {os.path.basename(shp_file)}"})
            else:
                for f in files:
                    candidate = os.path.join(temp_dir, f.name)
                    if os.path.exists(candidate) and _is_supported(f.name):
                        target_path = candidate
                        break

            if not target_path:
                yield _sse({"pct": 0, "phase": "error",
                            "msg": "No readable spatial file found. "
                                   "Upload a .zip, .shp, .geojson, .gpkg, .kml, etc."})
                return

            # ── STEP 3: Reading ────────────────────────────────────────────
            yield _sse({"pct": 45, "phase": "reading",
                        "msg": f"Reading {os.path.basename(target_path)}…"})

            try:
                gdf = gpd.read_file(target_path)
            except Exception as e:
                yield _sse({"pct": 0, "phase": "error",
                            "msg": f"Failed to read file: {e}"})
                return

            if gdf.empty:
                yield _sse({"pct": 0, "phase": "error", "msg": "File contains no features"})
                return

            feature_count = len(gdf)
            yield _sse({"pct": 60, "phase": "reading",
                        "msg": f"Read {feature_count:,} features successfully"})

            # ── STEP 4: CRS check ──────────────────────────────────────────
            yield _sse({"pct": 68, "phase": "crs_check",
                        "msg": "Detecting coordinate reference system…"})

            try:
                gdf, crs_meta = _ensure_wgs84(gdf)
            except Exception as e:
                yield _sse({"pct": 0, "phase": "error",
                            "msg": f"CRS error: {e}"})
                return

            orig_code = crs_meta["original"].get("code") or "Unknown"
            reprojected = crs_meta.get("reprojected", False)
            crs_msg = (
                f"CRS: {orig_code} → reprojected to WGS-84"
                if reprojected
                else f"CRS: {orig_code} (already WGS-84)"
            )
            yield _sse({"pct": 78, "phase": "crs_check", "msg": crs_msg, "crs": crs_meta})

            # ── STEP 5: Converting ─────────────────────────────────────────
            yield _sse({"pct": 85, "phase": "converting",
                        "msg": f"Converting {feature_count:,} features to GeoJSON…"})

            try:
                geojson = gdf_to_geojson(gdf)
            except Exception as e:
                yield _sse({"pct": 0, "phase": "error",
                            "msg": f"Conversion error: {e}"})
                return

            geojson["_crs"] = crs_meta
            geojson["_feature_count"] = feature_count
            geojson["_source_file"] = os.path.basename(target_path)

            yield _sse({"pct": 95, "phase": "converting",
                        "msg": "Finalising response…"})

            # ── STEP 6: Done ───────────────────────────────────────────────
            yield _sse({
                "pct": 100,
                "phase": "done",
                "msg": f"Ready — {feature_count:,} features loaded",
                "feature_count": feature_count,
                "crs": crs_meta,
                "source_file": os.path.basename(target_path),
                "geojson": geojson,
            })

        except Exception as e:
            logger.error(f"SSE upload error: {e}", exc_info=True)
            yield _sse({"pct": 0, "phase": "error", "msg": str(e)})

        finally:
            try:
                for root, dirs, fns in os.walk(temp_dir, topdown=False):
                    for fn in fns:
                        os.remove(os.path.join(root, fn))
                    for d in dirs:
                        os.rmdir(os.path.join(root, d))
                os.rmdir(temp_dir)
            except Exception:
                pass