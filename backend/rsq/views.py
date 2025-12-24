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
            year_full = request.data.get("year")        # e.g. "2022 - 23"
            vlcodes = request.data.get("vlcodes")       # [210151, 210152, ...]

            if not year_full or not vlcodes or not isinstance(vlcodes, list):
                return Response({"error": "year and vlcodes are required"}, status=400)

            # Convert year format: "2022 - 23" → "2022-23"
            db_year = year_full[:4] + "-" + year_full[7:9]

            # Convert vlcodes to strings for shapefile matching
            vlcodes_str = [str(v) for v in vlcodes]

            # Fetch groundwater data
            gw_data_qs = GroundWaterData.objects.filter(
                Year=db_year,
                vlcode__in=vlcodes
            ).values()

            if not gw_data_qs.exists():
                return Response({
                    "error": "No groundwater data found for this year",
                    "year": db_year,
                    "villages_requested": len(vlcodes)
                }, status=404)

            # Load village shapefile
            shp_path = os.path.join(
                settings.MEDIA_ROOT,
                "gwa_data", "gwa_shp", "Final_Village", "Village_New.shp"
            )

            if not os.path.exists(shp_path):
                return Response({"error": "Village shapefile not found on server"}, status=500)

            # Read shapefile
            gdf = gpd.read_file(shp_path)

            # Set CRS if missing
            if gdf.crs is None:
                gdf = gdf.set_crs("EPSG:4326")
            
            # ALWAYS ensure we're in EPSG:4326 (lat/lon)
            if gdf.crs.to_epsg() != 4326:
                gdf = gdf.to_crs("EPSG:4326")

            # Filter by vlcode
            gdf_filtered = gdf[gdf["vlcode"].astype(str).isin(vlcodes_str)]

            if gdf_filtered.empty:
                return Response({"error": "No villages found in shapefile"}, status=404)

            # Build DB lookup: vlcode (int) → full groundwater data + status + color
            db_dict = {}
            for item in gw_data_qs:
                try:
                    vlcode_key = int(item["vlcode"])
                except (TypeError, ValueError):
                    continue

                stage = item.get("Stage_of_Ground_Water_Extraction")
                status_text, color = get_stage_status_and_color(stage)

                item_dict = dict(item)
                item_dict["status"] = status_text
                item_dict["color"] = color

                db_dict[vlcode_key] = item_dict

            # Build final GeoJSON features with EPSG:4326 coordinates
            features = []
            for _, row in gdf_filtered.iterrows():
                try:
                    vlcode_int = int(float(row["vlcode"]))
                except:
                    continue

                # Base info from shapefile
                props = {
                    "vlcode": vlcode_int,
                    "village": (
                        row.get("village") or
                        row.get("VILL_NAME") or
                        row.get("VILLAGE") or
                        "Unknown Village"
                    ),
                    "blockname": row.get("blockname") or row.get("BLOCK_NAME") or "",
                }

                # Merge groundwater data
                if vlcode_int in db_dict:
                    props.update(db_dict[vlcode_int])

                features.append({
                "type": "Feature",
                "geometry": row.geometry.__geo_interface__,
                "properties": round_props_to_2_decimals(props)
            })


            # Return standard GeoJSON in EPSG:4326 (no CRS declaration needed - it's the default)
            final_geojson = {
                "type": "FeatureCollection",
                "features": features
            }

            return Response(final_geojson, status=200)

        except Exception as e:
            traceback.print_exc()
            return Response({
                "error": "Server error",
                "detail": str(e)
            }, status=500)