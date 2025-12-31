# rsq/views.py – FINAL VERSION WITH CRS FOR EPSG:3857

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .models import Block, Village, GroundWaterData
from .serializers import BlockSerializer, VillageSerializer
from .utils import get_stage_status_and_color
from .utils import round_props_to_2_decimals

import os
import geopandas as gpd
from django.conf import settings
import traceback







# ==============================================================
# 1. Block by District
# ==============================================================
class BlockByDistrictAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        districtcodes = request.data.get('districtcodes')

        if not districtcodes or not isinstance(districtcodes, list):
            return Response({"error": "districtcodes must be a non-empty list"}, status=400)

        blocks = Block.objects.filter(districtcode__in=districtcodes)
        serializer = BlockSerializer(blocks, many=True)
        return Response(serializer.data)


# ==============================================================
# 2. Village by Block
# ==============================================================
class VillageByBlockAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        blockcodes = request.data.get('blockcodes')

        if not blockcodes or not isinstance(blockcodes, list):
            return Response({"error": "blockcodes must be a non-empty list"}, status=400)

        villages = Village.objects.filter(blockcode__in=blockcodes)
        serializer = VillageSerializer(villages, many=True)
        return Response(serializer.data)


# ==============================================================
# 3. RSQ GeoJSON API – WITH CRS DECLARATION FOR EPSG:3857
# ==============================================================



class VillageGroundWaterGeoJSONAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            # ---------------------------------------------
            # 1. INPUT VALIDATION
            # ---------------------------------------------
            year_full = request.data.get("year")     # e.g. "2022 - 23"
            village_codes = request.data.get("vlcodes")  # [210151, 210152, ...]

            if not year_full or not village_codes or not isinstance(village_codes, list):
                return Response(
                    {"error": "year and vlcodes are required"},
                    status=400
                )

            # Convert year: "2022 - 23" → "2022-23"
            db_year = year_full[:4] + "-" + year_full[7:9]

            # Convert village codes to int
            village_codes_int = []
            for v in village_codes:
                try:
                    village_codes_int.append(int(v))
                except (TypeError, ValueError):
                    pass

            if not village_codes_int:
                return Response(
                    {"error": "Invalid village codes"},
                    status=400
                )

            # ---------------------------------------------
            # 2. FETCH GROUNDWATER DATA (UPDATED MODEL FIELDS)
            # ---------------------------------------------
            gw_qs = GroundWaterData.objects.filter(
                year=db_year,
                village_co__in=village_codes_int
            ).values()

            if not gw_qs.exists():
                return Response(
                    {
                        "error": "No groundwater data found",
                        "year": db_year,
                        "villages_requested": len(village_codes_int),
                    },
                    status=404
                )

            # ---------------------------------------------
            # 3. LOAD VILLAGE SHAPEFILE
            # ---------------------------------------------
            shp_path = os.path.join(
                settings.MEDIA_ROOT,
                "gwa_data",
                "gwa_shp",
                "Final_Village",
                "Village_New.shp",
            )

            if not os.path.exists(shp_path):
                return Response(
                    {"error": "Village shapefile not found on server"},
                    status=500
                )

            gdf = gpd.read_file(shp_path)

            # Ensure CRS
            if gdf.crs is None:
                gdf = gdf.set_crs("EPSG:4326")

            if gdf.crs.to_epsg() != 4326:
                gdf = gdf.to_crs("EPSG:4326")

            # ---------------------------------------------
            # 4. FILTER SHAPEFILE BY village_co
            # ---------------------------------------------
            gdf_filtered = gdf[
                gdf["vlcode"].astype(str).isin(
                    [str(v) for v in village_codes_int]
                )
            ]

            if gdf_filtered.empty:
                return Response(
                    {"error": "No villages found in shapefile"},
                    status=404
                )

            # ---------------------------------------------
            # 5. BUILD DB LOOKUP (village_co → data)
            # ---------------------------------------------
            db_dict = {}

            for item in gw_qs:
                try:
                    village_key = int(item["village_co"])
                except (TypeError, ValueError):
                    continue

                stage = item.get("stage_of_extraction")
                status_text, color = get_stage_status_and_color(stage)

                item_copy = dict(item)
                item_copy["status"] = status_text
                item_copy["color"] = color

                db_dict[village_key] = item_copy

            # ---------------------------------------------
            # 6. BUILD FINAL GEOJSON
            # ---------------------------------------------
            features = []

            for _, row in gdf_filtered.iterrows():
                try:
                    village_int = int(float(row["vlcode"]))
                except Exception:
                    continue

                props = {
                    "village_co": village_int,
                    "village": (
                        row.get("village")
                        or row.get("VILL_NAME")
                        or row.get("VILLAGE")
                        or "Unknown Village"
                    ),
                    
                }

                # Merge groundwater data
                if village_int in db_dict:
                    props.update(db_dict[village_int])

                features.append({
                    "type": "Feature",
                    "geometry": row.geometry.__geo_interface__,
                    "properties": round_props_to_2_decimals(props),
                })

            # ---------------------------------------------
            # 7. RETURN GEOJSON
            # ---------------------------------------------
            final_geojson = {
                "type": "FeatureCollection",
                "features": features,
            }

            return Response(final_geojson, status=200)

        except Exception as e:
            traceback.print_exc()
            return Response(
                {
                    "error": "Server error",
                    "detail": str(e),
                },
                status=500
            )
