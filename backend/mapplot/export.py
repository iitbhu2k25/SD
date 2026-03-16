import os
import json
import zipfile
import tempfile
from io import BytesIO
from datetime import datetime

from django.http import HttpResponse #type: ignore
from rest_framework.views import APIView #type: ignore
from rest_framework.response import Response #type: ignore
from rest_framework import status #type: ignore
from rest_framework.parsers import JSONParser #type: ignore
from rest_framework.permissions import AllowAny #type: ignore

import geopandas as gpd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch
import numpy as np
import contextily as ctx

from reportlab.lib.pagesizes import A4, A3 #type: ignore
from reportlab.lib.units import mm #type: ignore
from reportlab.pdfgen import canvas as pdf_canvas #type: ignore


# =========================================================
# BASE CLASS
# =========================================================
class MapExportBase:

    @staticmethod
    def format_coordinate(value, coord_type="lat"):
        if coord_type == "lat":
            direction = "N" if value >= 0 else "S"
        else:
            direction = "E" if value >= 0 else "W"
        return f"{abs(value):.4f}°{direction}"

    @staticmethod
    def calculate_scale(bounds, center_y):
        minx, miny, maxx, maxy = bounds
        degree_length = 111.32
        scale_deg = (maxx - minx) * 0.2
        return scale_deg * degree_length * np.cos(np.radians(center_y))

    @staticmethod
    def validate_geojson(geojson_data):
        if isinstance(geojson_data, str):
            geojson_data = json.loads(geojson_data)

        if "features" in geojson_data:
            gdf = gpd.GeoDataFrame.from_features(geojson_data["features"])
        else:
            gdf = gpd.GeoDataFrame.from_features([geojson_data])

        if gdf.empty:
            raise ValueError("GeoJSON has no features")

        if gdf.crs is None:
            gdf.set_crs(epsg=4326, inplace=True)

        return gdf

    @staticmethod
    def get_basemap(style):
        if style == "satellite":
            return ctx.providers.Esri.WorldImagery
        elif style == "terrain":
            return ctx.providers.Stamen.Terrain
        elif style == "light":
            return ctx.providers.CartoDB.Positron
        elif style == "dark":
            return ctx.providers.CartoDB.DarkMatter
        else:
            return ctx.providers.OpenStreetMap.Mapnik


# =========================================================
# PNG EXPORT
# =========================================================
class ExportMapPNGView(APIView, MapExportBase):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def post(self, request):
        try:
            data = request.data
            gdf = self.validate_geojson(data.get("geojson"))

            basemap_style = data.get("basemap", "osm")
            basemap_alpha = data.get("basemap_alpha", 0.6)

            bounds = gdf.total_bounds
            gdf_3857 = gdf.to_crs(epsg=3857)

            fig, ax = plt.subplots(figsize=(16, 9), dpi=300)

            gdf_3857.plot(ax=ax, facecolor="#78b4db", edgecolor="red", alpha=0.4)

            ctx.add_basemap(ax, source=self.get_basemap(basemap_style), alpha=basemap_alpha)

            ax.set_axis_off()
            ax.set_aspect("equal")

            buffer = BytesIO()
            plt.savefig(buffer, format="png", bbox_inches="tight", dpi=300)
            plt.close()

            buffer.seek(0)
            return HttpResponse(buffer, content_type="image/png")

        except Exception as e:
            return Response({"error": str(e)}, status=400)


# =========================================================
# PDF EXPORT
# =========================================================
class ExportMapPDFView(APIView, MapExportBase):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def post(self, request):
        try:
            data = request.data
            gdf = self.validate_geojson(data.get("geojson"))

            basemap_style = data.get("basemap", "osm")
            basemap_alpha = data.get("basemap_alpha", 0.5)
            heading = data.get("heading", "Map Export")

            bounds = gdf.total_bounds
            gdf_3857 = gdf.to_crs(epsg=3857)

            temp_img = tempfile.NamedTemporaryFile(delete=False, suffix=".png")

            fig, ax = plt.subplots(figsize=(11, 8), dpi=300)

            gdf_3857.plot(ax=ax, facecolor="#78b4db", edgecolor="black", alpha=0.4)
            ctx.add_basemap(ax, source=self.get_basemap(basemap_style), alpha=basemap_alpha)

            ax.set_axis_off()
            ax.set_aspect("equal")

            plt.savefig(temp_img.name, dpi=300, bbox_inches="tight")
            plt.close()

            temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            c = pdf_canvas.Canvas(temp_pdf.name, pagesize=A4)

            c.setFont("Helvetica-Bold", 18)
            c.drawCentredString(300, 820, heading)

            c.drawImage(temp_img.name, 40, 120, width=520, height=650)

            self._add_pdf_coordinates(c, bounds)
            self._add_pdf_north_arrow(c)
            self._add_pdf_scale_bar(c, bounds)

            c.save()

            with open(temp_pdf.name, "rb") as f:
                pdf_data = f.read()

            os.unlink(temp_img.name)
            os.unlink(temp_pdf.name)

            return HttpResponse(pdf_data, content_type="application/pdf")

        except Exception as e:
            return Response({"error": str(e)}, status=400)

    def _add_pdf_coordinates(self, c, bounds):
        minx, miny, maxx, maxy = bounds
        c.setFont("Helvetica", 9)
        c.drawString(40, 100, f"Lon: {minx:.4f}° to {maxx:.4f}°")
        c.drawString(40, 85, f"Lat: {miny:.4f}° to {maxy:.4f}°")

    def _add_pdf_north_arrow(self, c):
        c.line(550, 180, 550, 220)
        c.drawString(545, 225, "N")

    def _add_pdf_scale_bar(self, c, bounds):
        minx, miny, maxx, maxy = bounds
        center_y = (miny + maxy) / 2
        scale_km = self.calculate_scale(bounds, center_y)
        c.drawString(40, 60, f"Scale ≈ {scale_km:.1f} km")


# =========================================================
# SHAPEFILE EXPORT
# =========================================================
class GeoJSONToShapefileView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def post(self, request):
        try:
            geojson_data = request.data.get("geojson")
            filename = request.data.get("filename", "export")

            gdf = gpd.GeoDataFrame.from_features(geojson_data["features"])
            if gdf.crs is None:
                gdf.set_crs(epsg=4326, inplace=True)

            with tempfile.TemporaryDirectory() as temp_dir:
                shp_path = os.path.join(temp_dir, filename + ".shp")
                gdf.to_file(shp_path)

                zip_buffer = BytesIO()
                with zipfile.ZipFile(zip_buffer, "w") as zipf:
                    for ext in [".shp", ".shx", ".dbf", ".prj"]:
                        zipf.write(shp_path.replace(".shp", ext), arcname=filename + ext)

                zip_buffer.seek(0)
                return HttpResponse(zip_buffer, content_type="application/zip")

        except Exception as e:
            return Response({"error": str(e)}, status=400)
