# mapplot/views.py
from django.shortcuts import render # type: ignore
from django.http import JsonResponse # type: ignore
from django.views.decorators.csrf import csrf_exempt # type: ignore
from django.core.files.storage import FileSystemStorage # type: ignore
from django.conf import settings # type: ignore
from rest_framework.permissions import AllowAny # type: ignore
from rest_framework.views import APIView # type: ignore
from rest_framework.response import Response # type: ignore
from rest_framework.parsers import MultiPartParser, FormParser # type: ignore
from rest_framework import status # type: ignore
from shapely.ops import unary_union
import geopandas as gpd
import os
import uuid
import logging
import tempfile
import json
import zipfile
import pandas as pd

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────
#  CRS UTILITIES
# ─────────────────────────────────────────────────────────────────

# EPSG codes that are *already* geographic (lat/lon degrees).
# We reproject everything else to WGS-84 (4326) for the frontend.
_GEOGRAPHIC_CRS = {4326, 4269, 4267, 4230, 4258}

def _crs_info(gdf: gpd.GeoDataFrame) -> dict:
    """Return a human-readable summary of the GDF's CRS."""
    crs = gdf.crs
    if crs is None:
        return {"code": None, "name": "Unknown / No CRS", "is_geographic": False, "unit": "unknown"}

    epsg = crs.to_epsg()
    name = crs.name if hasattr(crs, "name") else str(crs)
    is_geo = crs.is_geographic if hasattr(crs, "is_geographic") else epsg in _GEOGRAPHIC_CRS
    unit = "degrees" if is_geo else "metres (projected)"
    return {"code": f"EPSG:{epsg}" if epsg else str(crs), "name": name, "is_geographic": is_geo, "unit": unit}


def _ensure_wgs84(gdf: gpd.GeoDataFrame) -> tuple[gpd.GeoDataFrame, dict]:
    """
    Reproject to EPSG:4326 (WGS-84) when necessary.
    Returns (reprojected_gdf, crs_meta) where crs_meta carries original/final info.
    """
    original_info = _crs_info(gdf)

    if gdf.crs is None:
        # Assume WGS-84 when CRS is completely missing (common for hand-made files)
        logger.warning("Shapefile has no CRS – assuming EPSG:4326")
        gdf = gdf.set_crs(epsg=4326, allow_override=True)
        original_info["assumed"] = True

    target_epsg = 4326
    current_epsg = gdf.crs.to_epsg()

    if current_epsg != target_epsg:
        logger.info(f"Reprojecting from {original_info['code']} → EPSG:4326")
        gdf = gdf.to_crs(epsg=target_epsg)

    final_info = _crs_info(gdf)
    return gdf, {"original": original_info, "final": final_info, "reprojected": current_epsg != target_epsg}


# ─────────────────────────────────────────────────────────────────
#  FILE READING
# ─────────────────────────────────────────────────────────────────

# All extensions we accept (no hard block – we validate by trying to read)
_SUPPORTED_EXTENSIONS = {
    ".zip", ".shp", ".geojson", ".json",
    ".gpkg", ".kml", ".gml", ".fgb",           # GeoPackage, KML, GML, FlatGeobuf
    ".tab", ".mif",                             # MapInfo
    ".csv",                                     # CSVs with WKT geometry column
}

def _is_supported(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in _SUPPORTED_EXTENSIONS


def read_spatial_file(uploaded_file) -> gpd.GeoDataFrame:
    """
    Read any supported spatial format from an uploaded Django file object.
    Raises ValueError for unsupported / unreadable files.
    """
    filename = uploaded_file.name
    suffix = os.path.splitext(filename)[1].lower()

    with tempfile.TemporaryDirectory() as tmpdir:
        file_path = os.path.join(tmpdir, filename)

        with open(file_path, "wb") as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)

        # ── ZIP: extract and find the first readable spatial file ──
        if suffix == ".zip":
            with zipfile.ZipFile(file_path, "r") as zip_ref:
                zip_ref.extractall(tmpdir)

            # Preference order: shp → gpkg → geojson → json → kml → others
            priority = [".shp", ".gpkg", ".geojson", ".json", ".kml", ".gml", ".fgb"]
            found = None
            for ext in priority:
                candidates = [
                    os.path.join(root, f)
                    for root, _, files in os.walk(tmpdir)
                    for f in files
                    if f.lower().endswith(ext) and not f.startswith("__MACOSX")
                ]
                if candidates:
                    found = candidates[0]
                    break

            if not found:
                raise ValueError(
                    "ZIP archive does not contain a recognised spatial file "
                    "(expected .shp, .gpkg, .geojson, .kml, .gml, etc.)"
                )
            return gpd.read_file(found)

        # ── All other formats: try reading directly ──
        try:
            return gpd.read_file(file_path)
        except Exception as exc:
            raise ValueError(f"Cannot read spatial file '{filename}': {exc}") from exc


# ─────────────────────────────────────────────────────────────────
#  GEOJSON SERIALISATION
# ─────────────────────────────────────────────────────────────────

def _safe_value(v):
    """Convert non-serialisable values to a JSON-safe form."""
    if isinstance(v, float):
        import math
        if math.isnan(v) or math.isinf(v):
            return None
    if hasattr(v, "item"):          # numpy scalar
        return v.item()
    if isinstance(v, (bytes, bytearray)):
        return v.decode("utf-8", errors="replace")
    return v


def gdf_to_geojson(gdf: gpd.GeoDataFrame) -> dict:
    features = []

    for idx, row in gdf.iterrows():
        try:
            geometry = row.geometry
            if geometry is None or geometry.is_empty:
                continue

            properties = {k: _safe_value(v) for k, v in row.drop("geometry").to_dict().items()}

            if geometry.geom_type == "Polygon":
                coords = [[float(x), float(y)] for x, y in zip(*geometry.exterior.coords.xy)]
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Polygon", "coordinates": [coords]},
                    "properties": properties,
                })

            elif geometry.geom_type == "MultiPolygon":
                polygons = [
                    [[float(x), float(y)] for x, y in zip(*poly.exterior.coords.xy)]
                    for poly in geometry.geoms
                ]
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "MultiPolygon", "coordinates": [polygons]},
                    "properties": properties,
                })

            elif geometry.geom_type == "LineString":
                coords = [[float(x), float(y)] for x, y in zip(*geometry.coords.xy)]
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": properties,
                })

            elif geometry.geom_type == "MultiLineString":
                lines = [
                    [[float(x), float(y)] for x, y in zip(*line.coords.xy)]
                    for line in geometry.geoms
                ]
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "MultiLineString", "coordinates": lines},
                    "properties": properties,
                })

            elif geometry.geom_type == "Point":
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [float(geometry.x), float(geometry.y)]},
                    "properties": properties,
                })

            elif geometry.geom_type == "MultiPoint":
                points = [[float(p.x), float(p.y)] for p in geometry.geoms]
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "MultiPoint", "coordinates": points},
                    "properties": properties,
                })

        except Exception as e:
            logger.error(f"Feature {idx} serialisation error: {e}")
            continue

    return {"type": "FeatureCollection", "features": features}


# ─────────────────────────────────────────────────────────────────
#  UPLOAD SHAPEFILE  (REST — with CRS metadata in response)
# ─────────────────────────────────────────────────────────────────

class UploadShapefile(APIView):
    
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        files = request.FILES.getlist("file")
        if not files:
            return JsonResponse({"error": "No file uploaded"}, status=400)

        temp_dir = tempfile.mkdtemp()

        try:
            # ── Determine the primary spatial file ──────────────────────────
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

            # ── Case 1: ZIP uploaded ──────────────────────────────────────
            target_path = None
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
                    return JsonResponse({"error": "No spatial file found inside ZIP"}, status=400)

            # ── Case 2: Direct upload ─────────────────────────────────────
            elif shp_file:
                target_path = shp_file
            else:
                # Try first file that geopandas can read
                for f in files:
                    candidate = os.path.join(temp_dir, f.name)
                    if os.path.exists(candidate) and _is_supported(f.name):
                        target_path = candidate
                        break

            if not target_path:
                return JsonResponse({
                    "error": "No readable spatial file found. "
                             "Upload a .zip, .shp (+sidecar files), .geojson, .gpkg, .kml, etc."
                }, status=400)

            # ── Read, detect CRS, reproject ───────────────────────────────
            gdf = gpd.read_file(target_path)

            if gdf.empty:
                return JsonResponse({"error": "File contains no features"}, status=400)

            gdf, crs_meta = _ensure_wgs84(gdf)

            geojson = gdf_to_geojson(gdf)
            geojson["_crs"] = crs_meta          # attach metadata for frontend display
            geojson["_feature_count"] = len(geojson["features"])
            geojson["_source_file"] = os.path.basename(target_path)

            return JsonResponse(geojson, safe=False)

        except Exception as e:
            logger.error(f"Upload error: {e}", exc_info=True)
            return JsonResponse({"error": str(e)}, status=500)

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


# ─────────────────────────────────────────────────────────────────
#  SPATIAL PROCESS  (intersection / union / dissolve / statistics)
# ─────────────────────────────────────────────────────────────────

class SpatialProcessAPIView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        files = request.FILES.getlist("files")
        operation = request.data.get("operation")

        if not files or len(files) < 1:
            return Response(
                {"error": "At least one spatial file required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            gdfs = []
            for file in files:
                gdf = read_spatial_file(file)
                if gdf.empty:
                    return Response(
                        {"error": f"{file.name} has no features"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                gdf, _ = _ensure_wgs84(gdf)
                gdfs.append(gdf)

            base_crs = gdfs[0].crs
            gdfs = [gdf.to_crs(base_crs) for gdf in gdfs]

            if operation == "intersection":
                result = gdfs[0]
                for gdf in gdfs[1:]:
                    result = gpd.overlay(result, gdf, how="intersection")
                if result.empty:
                    return Response({"message": "No intersection found"})
                return Response(result.__geo_interface__)

            elif operation == "union":
                result = gdfs[0]
                for gdf in gdfs[1:]:
                    result = gpd.overlay(result, gdf, how="union")
                return Response(result.__geo_interface__)

            elif operation == "dissolve":
                dissolve_field = request.data.get("dissolve_field")
                if not dissolve_field:
                    return Response({"error": "dissolve_field is required"}, status=status.HTTP_400_BAD_REQUEST)

                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)
                if dissolve_field not in combined.columns:
                    return Response({"error": f"{dissolve_field} not found"}, status=status.HTTP_400_BAD_REQUEST)

                result = combined.dissolve(by=dissolve_field)
                return Response(result.__geo_interface__)

            elif operation == "statistics":
                stats_type = request.data.get("stats_type", "area")
                combined = gpd.GeoDataFrame(pd.concat(gdfs, ignore_index=True), crs=base_crs)

                if stats_type == "area":
                    combined["area_sqkm"] = combined.geometry.to_crs(epsg=6933).area / 1e6
                elif stats_type == "length":
                    combined["length_km"] = combined.geometry.to_crs(epsg=3857).length / 1000

                combined["feature_count"] = 1
                return Response(combined.__geo_interface__)

            else:
                return Response({"error": "Invalid operation"}, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────────────────────────────
#  SHAPEFILE DIRECTORY
# ─────────────────────────────────────────────────────────────────

class ShapefileDirectoryView(APIView):
    permission_classes = [AllowAny]
    BASE_DIR_NAME = "shapefile"

    def get(self, request):
        try:
            base_path = os.path.join(settings.MEDIA_ROOT, self.BASE_DIR_NAME)
            if not os.path.exists(base_path):
                return Response({"error": "Shapefile directory not found"}, status=status.HTTP_404_NOT_FOUND)
            return Response(self._scan_directory(base_path), status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _scan_directory(self, base_path):
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


# ─────────────────────────────────────────────────────────────────
#  SHAPEFILE DATA API
# ─────────────────────────────────────────────────────────────────

class ShapefileDataAPI(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            category = request.GET.get("category", "").lower()
            subcategory = request.GET.get("subcategory", "").lower()
            base_path = os.path.join(settings.MEDIA_ROOT, "shapefile")

            if not os.path.exists(base_path):
                return Response({"error": "Shapefile directory missing"}, status=404)

            target_shp = None
            for root, dirs, files in os.walk(base_path):
                for file in files:
                    if file.lower().endswith(".shp"):
                        path = os.path.join(root, file)
                        if category in path.lower() and subcategory in path.lower():
                            target_shp = path
                            break

            if not target_shp:
                return Response({"error": "Shapefile not found for given category/subcategory"}, status=404)

            logger.info(f"Reading shapefile: {target_shp}")
            gdf = gpd.read_file(target_shp)
            gdf, crs_meta = _ensure_wgs84(gdf)

            geojson = gdf_to_geojson(gdf)
            if not geojson["features"]:
                return Response({"error": "No valid features"}, status=400)

            geojson["_crs"] = crs_meta
            return Response(geojson, status=200)

        except Exception as e:
            logger.error(e, exc_info=True)
            return Response({"error": str(e)}, status=500)