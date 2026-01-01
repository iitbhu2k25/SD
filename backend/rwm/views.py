import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import  csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
from shapely.geometry import Point
from .models import (
    WaterQuality_sampling_point_data,
    WaterQuality_upstream,
    WaterQuality_downstream,
    Stretches,
)
import geopandas as gpd
import os
import json
import logging
import traceback
import rasterio
from rasterio.features import rasterize
from rasterio.transform import from_bounds
import numpy as np
from io import BytesIO
import requests
import contextily as ctx

from .utils import *

logger = logging.getLogger(__name__)
import base64
from scipy.spatial.distance import cdist
from scipy.interpolate import griddata
import numpy as np
import geopandas as gpd
from urllib.parse import unquote
from scipy.spatial import cKDTree
from rasterio.features import geometry_mask
from rasterio.transform import from_bounds
from shapely.ops import unary_union
from shapely.geometry import mapping
import hashlib
from django.core.cache import cache
from rasterio.crs import CRS
import math
from rasterio.warp import calculate_default_transform, reproject, Resampling

# from .raster_styling import integrate_coloring_into_idw
import rasterio
from rasterio.transform import from_bounds
from rasterio.mask import geometry_mask

# FOR PDF
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch
import io
import uuid
from celery.result import GroupResult
from celery import current_app


auth = base64.b64encode(b"admin:geoserver").decode("utf-8")


GEOSERVER_URL = "http://geoserver:8080/geoserver"
GEOSERVER_USER = "admin"
GEOSERVER_PASSWORD = "geoserver"
WORKSPACE = "myworkspace"
wms_base_url = "/geoserver/api" # Frontend fetches rasters from geoserver

# Add this at the top of your file
BACKEND_PARAMETER_DISPLAY_NAMES = {
    "pH": "pH",
    "TDS_mg_L_": "TDS",
    "EC__S_cm_": "EC",
    "Temperatur": "Temperature",
    "Turbidity_": "Turbidity",
    "DO_mg_L_": "Dissolved Oxygen (DO)",
    "ORP": "ORP",
    "TSS_mg_L_": "TSS",
    "COD_mg_L_": "COD",
    "BOD_mg_L_": "BOD",
    "TS_mg_L_": "Total Solids (TS)",
    "Chloride_m": "Chloride",
    "Nitrate_mg": "Nitrate",
    "Hardness_m": "Hardness",
    "Faecal_Col": "Faecal Coliform",
    "Total_Coli": "Total Coliform",
    "WQI": "Water Quality Index (WQI)",
}


@csrf_exempt
@api_view(["POST", "GET"])
@permission_classes([AllowAny])          # <-- removes 401
@authentication_classes([])
def water_quality_data(request, data_type="subdistbased", season="premonsoon"):
    """
    API endpoint to return water quality data as JSON, filtered by Sub_District_Code if provided
    """
    if request.method == "OPTIONS":
        # Handle CORS preflight request
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    try:
        # Determine the model based on data_type
        if season == "premonsoon":
            model = WaterQuality_sampling_point_data
        elif season == "during_monsoon":
            model = WaterQuality_sampling_point_data
        # elif season == 'post_monsoon':
        #     model = WaterQuality_sampling_point_data_post_monsoon
        else:
            return JsonResponse(
                {
                    "error": 'Invalid data type. Use "overall", "upstream", or "downstream"'
                },
                status=400,
            )
        # model = WaterQuality_sampling_point_data
        if request.method == "POST":
            # Handle POST request with Sub_District_Code filter
            # print(f"Received POST request to {request.path}")
            # print(f"Request body: {request.body}")

            try:
                body = json.loads(request.body)
                sub_district_codes = body.get("Sub_District_Code", [])
                Stretch_IDs = body.get("Stretch_ID", [])
                # print(f"Sub-district codes: {sub_district_codes}")
            except json.JSONDecodeError:
                return JsonResponse(
                    {"error": "Invalid JSON in request body"}, status=400
                )

            # Filter by Sub_District_Code if provided, else fetch all
            if data_type == "subdistbased":
                if sub_district_codes:
                    data = model.objects.filter(
                        Sub_District_Code__in=sub_district_codes
                    ).values(
                        "Stretch_ID",
                        "Sub_District",
                        "Sub_District_Code",
                        "District_Code",
                        "s_no",
                        "sampling",
                        "location",
                        "status",
                        "latitude",
                        "longitude",
                        "ph",
                        "tds",
                        "ec",
                        "temperature",
                        "turbidity",
                        "do",
                        "orp",
                        "tss",
                        "cod",
                        "bod",
                        "ts",
                        "chloride",
                        "nitrate",
                        "hardness",
                        "faecal_coliform",
                        "total_coliform",
                    )
                else:
                    data = model.objects.all().values(
                        "Stretch_ID",
                        "Sub_District",
                        "Sub_District_Code",
                        "District_Code",
                        "s_no",
                        "sampling",
                        "location",
                        "status",
                        "latitude",
                        "longitude",
                        "ph",
                        "tds",
                        "ec",
                        "temperature",
                        "turbidity",
                        "do",
                        "orp",
                        "tss",
                        "cod",
                        "bod",
                        "ts",
                        "chloride",
                        "nitrate",
                        "hardness",
                        "faecal_coliform",
                        "total_coliform",
                    )
            elif data_type == "stretchbased":
                if Stretch_IDs:
                    data = model.objects.filter(Stretch_ID__in=Stretch_IDs).values(
                        "Stretch_ID",
                        "Sub_District",
                        "Sub_District_Code",
                        "District_Code",
                        "s_no",
                        "sampling",
                        "location",
                        "status",
                        "latitude",
                        "longitude",
                        "ph",
                        "tds",
                        "ec",
                        "temperature",
                        "turbidity",
                        "do",
                        "orp",
                        "tss",
                        "cod",
                        "bod",
                        "ts",
                        "chloride",
                        "nitrate",
                        "hardness",
                        "faecal_coliform",
                        "total_coliform",
                    )
                else:
                    data = model.objects.all().values(
                        "Stretch_ID",
                        "Sub_District",
                        "Sub_District_Code",
                        "District_Code",
                        "s_no",
                        "sampling",
                        "location",
                        "status",
                        "latitude",
                        "longitude",
                        "ph",
                        "tds",
                        "ec",
                        "temperature",
                        "turbidity",
                        "do",
                        "orp",
                        "tss",
                        "cod",
                        "bod",
                        "ts",
                        "chloride",
                        "nitrate",
                        "hardness",
                        "faecal_coliform",
                        "total_coliform",
                    )

            # print("***Data***", data)

            df = pd.DataFrame(data)
            # print("***df***", df)
            if not df.empty:
                df = WQI(df, pcm, labels)  # Process WQI and get DataFrame


            def safe_json_convert(dataframe):
                """Convert DataFrame to JSON-safe dictionary"""
                data_dict = dataframe.to_dict(orient="records")
                cleaned_data = []
                for record in data_dict:
                    cleaned_record = {}
                    for key, value in record.items():
                        if value is None:
                            cleaned_record[key] = None
                        elif isinstance(value, float) and (
                            math.isnan(value) or np.isnan(value)
                        ):
                            cleaned_record[key] = None
                        elif str(value).lower() in ["nan", "none", "null"]:
                            cleaned_record[key] = None
                        else:
                            cleaned_record[key] = value
                    cleaned_data.append(cleaned_record)
                return cleaned_data

            response_data = safe_json_convert(df)

            # print(f"data with WQI:{response_data}")

            response = JsonResponse(response_data, safe=False)
            response["Access-Control-Allow-Origin"] = "*"
            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type"
            return response

        elif request.method == "GET":
            # Handle GET request (fetch all data)
            # print(f"Received GET request to {request.path}")
            data = model.objects.all().values(
                "Stretch_ID",
                "Sub_District",
                "Sub_District_Code",
                "District_Code",
                "s_no",
                "sampling",
                "location",
                "status",
                "latitude",
                "longitude",
                "ph",
                "tds",
                "ec",
                "temperature",
                "turbidity",
                "do",
                "orp",
                "tss",
                "cod",
                "bod",
                "ts",
                "chloride",
                "nitrate",
                "hardness",
                "faecal_coliform",
                "total_coliform",
            )

            df = pd.DataFrame(data)
            if not df.empty:
                df = WQI(df, pcm, labels)  # Process WQI and get DataFrame

            def safe_json_convert(dataframe):
                """Convert DataFrame to JSON-safe dictionary"""
                data_dict = dataframe.to_dict(orient="records")
                cleaned_data = []
                for record in data_dict:
                    cleaned_record = {}
                    for key, value in record.items():
                        if value is None:
                            cleaned_record[key] = None
                        elif isinstance(value, float) and (
                            math.isnan(value) or np.isnan(value)
                        ):
                            cleaned_record[key] = None
                        elif str(value).lower() in ["nan", "none", "null"]:
                            cleaned_record[key] = None
                        else:
                            cleaned_record[key] = value
                    cleaned_data.append(cleaned_record)
                return cleaned_data

            response_data = safe_json_convert(df)

            response = JsonResponse(response_data, safe=False)
            response["Access-Control-Allow-Origin"] = "*"
            response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
            response["Access-Control-Allow-Headers"] = "Content-Type"
            return response

        else:
            return JsonResponse(
                {"error": f"Method {request.method} not allowed"}, status=405
            )

    except Exception as e:
        # logger.error(f"Error fetching water quality data: {str(e)}")
        import traceback

        traceback.print_exc()
        response = JsonResponse(
            {"error": "Failed to fetch water quality data"}, status=500
        )
        response["Access-Control-Allow-Origin"] = "*"
        return response


#


@csrf_exempt
@api_view(["POST", "GET"])
@permission_classes([AllowAny])          # <-- removes 401
@authentication_classes([])   
def River(request):
    """
    Enhanced river endpoint with regional clipping
    """
    try:
        shapefile_path = os.path.join(settings.MEDIA_ROOT, "rwm_data", "RIVER_SHP")
        shapefile_full_path = os.path.join(shapefile_path, "Rivers.shp")

        if not os.path.exists(shapefile_full_path):
            # logger.error(f"River shapefile not found at: {shapefile_full_path}")
            return Response(
                {"error": f"River shapefile not found at: {shapefile_full_path}"},
                status=404,
            )

        gdf = gpd.read_file(shapefile_full_path)
        gdf = gdf.to_crs("EPSG:4326")

        # Handle POST request with regional filtering
        if request.method == "POST":
            try:
                sub_district_codes = request.data.get("Sub_District_Code", [])

                if sub_district_codes:
                    clipped_gdf = load_and_clip_rivers(sub_district_codes)
                    if not clipped_gdf.empty:
                        gdf = clipped_gdf
                        # print(
                        #     f"Clipped rivers to {len(gdf)} features for selected region"
                        # )

            except Exception as e:
                print(f"Error filtering rivers: {e}")

        geojson_data = json.loads(gdf.to_json())
        return Response(geojson_data, status=status.HTTP_200_OK)

    except Exception as e:
        # logger.error(f"Error processing river shapefile: {str(e)}")
        return Response(
            {"error": f"Error processing river shapefile: {str(e)}"}, status=500
        )


@csrf_exempt
@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def load_stretch_linesAPI(request):
    """
    API endpoint to load stretch lines with optional filtering
    FIXED: Better error handling and consistent parameter naming
    """
    try:
        shp_path = os.path.join(
            settings.MEDIA_ROOT, "rwm_data", "stretch_shp", "stretch.shp"
        )

        if not os.path.exists(shp_path):
            return JsonResponse({"error": "Stretch shapefile not found"}, status=404)

        gdf = gpd.read_file(shp_path)
        # print(f"Loaded stretch shapefile with {len(gdf)} features")
        # print(f"Available columns: {list(gdf.columns)}")

        # Handle POST request with stretch filtering
        if request.method == "POST":
            try:
                body = json.loads(request.body)
                # print(f"Received POST body: {body}")

                stretch_ids = body.get(
                    "Stretch_ID", []
                )  # FIXED: Use consistent variable name
                # print(f"Extracted Stretch_IDs: {stretch_ids}")

                if stretch_ids:
                    filtered_gdf = load_stretch_lines(
                        stretch_ids
                    )  # FIXED: Use consistent variable name
                    if not filtered_gdf.empty:
                        gdf = filtered_gdf
                        # print(f"Filtered to {len(gdf)} stretch lines")
                    else:
                        # print("No stretch lines found for the provided IDs")
                        # Provide better debugging information
                        original_gdf = gpd.read_file(shp_path)
                        sample_data = []
                        if not original_gdf.empty:
                            # Get sample IDs from different possible columns
                            for col in [
                                "Stretch_ID",
                                "STRETCH_ID",
                                "stretch_id",
                                "ID",
                                "id",
                            ]:
                                if col in original_gdf.columns:
                                    sample_values = original_gdf[col].head(10).tolist()
                                    sample_data.append(
                                        {"column": col, "sample_values": sample_values}
                                    )

                        return JsonResponse(
                            {
                                "error": f"No stretch lines found for IDs: {stretch_ids}",
                                "available_columns": (
                                    list(original_gdf.columns)
                                    if not original_gdf.empty
                                    else []
                                ),
                                "sample_data": sample_data,
                                "total_features": (
                                    len(original_gdf) if not original_gdf.empty else 0
                                ),
                            },
                            status=404,
                        )
                

            except json.JSONDecodeError as e:
                return JsonResponse(
                    {"error": "Invalid JSON in request body"}, status=400
                )
            except Exception as e:
                # print(f"Error processing POST request: {e}")
                return JsonResponse(
                    {"error": f"Error processing request: {str(e)}"}, status=500
                )

        # Ensure proper CRS
        if gdf.crs != "EPSG:4326":
            # print(f"Converting CRS from {gdf.crs} to EPSG:4326")
            gdf = gdf.to_crs("EPSG:4326")

        # Convert to GeoJSON
        geojson_str = gdf.to_json()
        geojson_dict = json.loads(geojson_str)

        # print(f"Returning {len(gdf)} stretch features")

        response = JsonResponse(geojson_dict, safe=False)
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    except Exception as e:
        # print(f"Error in load_stretch_linesAPI: {str(e)}")
        import traceback

        traceback.print_exc()

        response = JsonResponse(
            {"error": "Failed to process stretch shapefile data", "details": str(e)},
            status=500,
        )
        response["Access-Control-Allow-Origin"] = "*"
        return response


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def River_100m_buffer(request, data_type="subdistbased"):
    """
    Enhanced river buffer endpoint with regional clipping
    """
    try:
        shapefile_path = os.path.join(
            settings.MEDIA_ROOT, "rwm_data", "RIVER_BUFFER100M_SHP"
        )
        shapefile_full_path = os.path.join(shapefile_path, "River_buffer_100m.shp")

        if not os.path.exists(shapefile_full_path):
            # logger.error(f"River buffer shapefile not found at: {shapefile_full_path}")
            return Response(
                {
                    "error": f"River buffer shapefile not found at: {shapefile_full_path}"
                },
                status=404,
            )

        gdf = gpd.read_file(shapefile_full_path)
        gdf = gdf.to_crs("EPSG:4326")

        # Handle POST request with regional filtering
        if request.method == "POST":
            try:
                sub_district_codes = request.data.get("Sub_District_Code", [])
                Stretch_IDs = request.data.get("Stretch_ID", [])

                if data_type == "subdistbased":
                    if sub_district_codes:
                        clipped_gdf = load_and_clip_river_buffer(
                            sub_district_codes, True
                        )  # true for subdistbased
                        if not clipped_gdf.empty:
                            gdf = clipped_gdf
                            # print(
                            #     f"Clipped river buffer to {len(gdf)} features for selected region"
                            # )
                else:
                    if Stretch_IDs:
                        # print(f"Filtering by Stretch_IDs: {Stretch_IDs}")
                        # print(f"Available columns in shapefile: {list(gdf.columns)}")

                        # FIXED: Use the exact 'Stretch_ID' column name
                        if "Stretch_ID" in gdf.columns:
                            # print(f"Using 'Stretch_ID' column for filtering")

                            # Convert both sides to ensure type matching
                            # Convert Stretch_IDs to integers if they're numeric strings
                            try:
                                stretch_ids_int = [int(sid) for sid in Stretch_IDs]
                                # print(
                                #     f"Converted Stretch_IDs to integers: {stretch_ids_int}"
                                # )

                                # Check data types
                                # print(
                                #     f"Stretch_ID column dtype: {gdf['Stretch_ID'].dtype}"
                                # )
                                # print(
                                #     f"Sample Stretch_ID values: {gdf['Stretch_ID'].head().tolist()}"
                                # )

                                # Filter using integer comparison
                                gdf = gdf[gdf["Stretch_ID"].isin(stretch_ids_int)]
                                # print(
                                #     f"Filtered to {len(gdf)} features using 'Stretch_ID' column"
                                # )

                            except ValueError:
                                # If conversion to int fails, try string comparison
                                # print(
                                #     "Failed to convert to int, trying string comparison"
                                # )
                                gdf = gdf[
                                    gdf["Stretch_ID"]
                                    .astype(str)
                                    .isin([str(sid) for sid in Stretch_IDs])
                                ]
                                # print(
                                #     f"Filtered to {len(gdf)} features using string comparison"
                                # )

                # Save as temporary shapefile only if we have features
                if len(gdf) > 0:
                    temp_dir = tempfile.gettempdir()
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    temp_shapefile_name = f"river_buffer_filtered_{timestamp}"
                    temp_shapefile_path = os.path.join(
                        temp_dir, f"{temp_shapefile_name}.shp"
                    )

                    # Save as temporary shapefile
                    gdf.to_file(temp_shapefile_path, driver="ESRI Shapefile")

                    # print(f"🎯 RIVER BUFFER SHAPEFILE SAVED FOR ARCGIS:")
                    # print(f"📁 Path: {temp_shapefile_path}")
                    # print(f"📊 Features: {len(gdf)}")
                    # print(f"🗺️ CRS: EPSG:4326")

                    # Add file info to response
                    geojson_data = json.loads(gdf.to_json())
                    geojson_data["arcgis_export"] = {
                        "shapefile_path": temp_shapefile_path,
                        "feature_count": len(gdf),
                        "crs": "EPSG:4326",
                        "temp_directory": temp_dir,
                        "files_created": [
                            f"{temp_shapefile_name}.shp",
                            f"{temp_shapefile_name}.shx",
                            f"{temp_shapefile_name}.dbf",
                            f"{temp_shapefile_name}.prj",
                        ],
                    }

                    return Response(geojson_data, status=status.HTTP_200_OK)
                else:
                    print("No features found after filtering")

            except Exception as e:
                print(f"Error filtering river buffer: {e}")

        # Returns full geojson if no filtering occurs and if filtering takes place, sends the filtered geojson
        geojson_data = json.loads(gdf.to_json())
        return Response(geojson_data, status=status.HTTP_200_OK)

    except Exception as e:
        # logger.error(f"Error processing river buffer shapefile: {str(e)}")
        return Response(
            {"error": f"Error processing river buffer shapefile: {str(e)}"}, status=500
        )



def get_points_shapefile_gdf(
    *,
    data_type: str,
    season: str,
    sub_district_codes=None,
    stretch_ids=None,
):
    """
    Shared internal function.
    - No request
    - No response
    - No Django / DRF objects
    - Safe for Celery & API use
    """

    # -----------------------------
    # Shapefile selection
    # -----------------------------
    if season == "premonsoon":
        shp_path = os.path.join(
            settings.MEDIA_ROOT,
            "rwm_data",
            "DRAINS_Final_point",
            "DRAINS_Final_point.shp",
        )
    elif season == "monsoon":
        shp_path = os.path.join(
            settings.MEDIA_ROOT,
            "rwm_data",
            "monsoon",
            "monsoon.shp",
        )
    else:
        raise ValueError("Invalid season")

    if not os.path.exists(shp_path):
        return JsonResponse({"error": "Shapefile not found"}, status=404)

    gdf = gpd.read_file(shp_path)

    # -----------------------------
    # Filtering
    # -----------------------------
    if data_type == "subdistbased" and sub_district_codes:
        col = "Sub_Dist_1"
        if col in gdf.columns:
            gdf[col] = gdf[col].astype(str)
            sub_district_codes = [str(c).strip() for c in sub_district_codes]
            gdf = gdf[gdf[col].isin(sub_district_codes)]

    elif data_type == "stretchbased" and stretch_ids:
        col = "Stretch_ID"
        if col in gdf.columns:
            gdf[col] = gdf[col].astype(str)
            stretch_ids = [str(s).strip() for s in stretch_ids]
            gdf = gdf[gdf[col].isin(stretch_ids)]

    # -----------------------------
    # WQI calculation
    # -----------------------------
    if not gdf.empty:
        df_for_wqi = gdf.copy()
        
        # Create field mapping dictionary for consistent naming
        field_mapping = {
            "S_No_": "s_no",
            "Sub_Distri": "Sub_District",
            "Sub_Dist_1": "Sub_District_Code",
            "District_C": "District_Code",
            "Sampling": "sampling",
            "Location": "location",
            "STATUS": "status",
            "LATITUDE": "latitude",
            "LONGITUDE": "longitude",
            "pH": "ph",
            "Temperatur": "temperature",
            "TDS_mg_L_": "tds",
            "EC__S_cm_": "ec",
            "TSS_mg_L_": "tss",
            "TS_mg_L_": "ts",
            "DO_mg_L_": "do",
            "Turbidity_": "turbidity",
            "ORP": "orp",
            "COD_mg_L_": "cod",
            "BOD_mg_L_": "bod",
            "Chloride_m": "chloride",
            "Nitrate_mg": "nitrate",
            "Hardness_m": "hardness",
            "Faecal_Col": "faecal_coliform",
            "Total_Coli": "total_coliform",
            "Stretch_ID": "Stretch_ID",
        }
        
        
        # Rename columns that exist in the dataframe
        existing_mappings = {
            old: new
            for old, new in field_mapping.items()
            if old in df_for_wqi.columns
        }
        df_for_wqi = df_for_wqi.rename(columns=existing_mappings)

        numeric_columns = [
                "ph",
                "temperature",
                "tds",
                "ec",
                "tss",
                "ts",
                "do",
                "turbidity",
                "orp",
                "cod",
                "bod",
                "chloride",
                "nitrate",
                "hardness",
                "faecal_coliform",
                "total_coliform",
            ]

        for col in numeric_columns:
            if col in df_for_wqi.columns:
                df_for_wqi[col] = pd.to_numeric(df_for_wqi[col], errors="coerce")

        df_with_wqi = WQI(df_for_wqi, pcm, labels)

        if "WQI" in df_with_wqi.columns:
            gdf["WQI"] = df_with_wqi["WQI"].round(2)

            def classify(wqi):
                if pd.isna(wqi):
                    return "Not Available"
                elif wqi <= 25:
                    return "Excellent"
                elif wqi <= 50:
                    return "Good"
                elif wqi <= 75:
                    return "Poor"
                elif wqi <= 100:
                    return "Very Poor"
                else:
                    return "Unfit for Drinking"

            gdf["WQI_Class"] = gdf["WQI"].apply(classify)

    return gdf




@csrf_exempt
def shapefile_data(request, data_type="subdistbased", season="premonsoon"):
    # """
    # API endpoint to return shapefile data as GeoJSON, optionally filtered by subdistricts
    # """
    # try:
    #     if season == "premonsoon":
    #         shp_path = os.path.join(
    #             settings.MEDIA_ROOT,
    #             "rwm_data",
    #             "DRAINS_Final_point",
    #             "DRAINS_Final_point.shp",
    #         )
    #     elif season == "monsoon":
    #         shp_path = os.path.join(
    #             settings.MEDIA_ROOT, "rwm_data", "monsoon", "monsoon.shp"
    #         )
        

    #     # shp_path = os.path.join(settings.MEDIA_ROOT, 'rwm_data', 'DRAINS_Final_point', 'DRAINS_Final_point.shp')
    #     if not os.path.exists(shp_path):
    #         # logger.error(f"Shapefile not found at: {shp_path}")
    #         return JsonResponse({"error": "Shapefile not found"}, status=404)

    #     gdf = gpd.read_file(shp_path)

    #     # Handle POST request with subdistrict filtering
    #     if request.method == "POST":
    #         try:
    #             body = json.loads(request.body)
    #             sub_district_codes = body.get("Sub_District_Code", [])
    #             Stretch_IDs = body.get("Stretch_ID", [])
    #             # Convert sub_district_codes to a set for efficient lookup
    #             if data_type == "subdistbased":
    #                 if sub_district_codes:
    #                     # Filter by subdistrict codes if provided
    #                     # Assuming your shapefile has a column for subdistrict codes
    #                     # Adjust the column name based on your actual shapefile structure

    #                     subdistrict_column = (
    #                         "Sub_Dist_1"  # or whatever column name you use
    #                     )
    #                     Stretch_column = "Stretch_ID"
    #                     if subdistrict_column in gdf.columns:

    #                         # Convert both sides to strings for consistent comparison
    #                         gdf[subdistrict_column] = gdf[subdistrict_column].astype(
    #                             str
    #                         )
    #                         sub_district_codes = [
    #                             str(code).strip() for code in sub_district_codes
    #                         ]

    #                         gdf = gdf[gdf[subdistrict_column].isin(sub_district_codes)]
    #                         # print(
    #                         #     f"SUBDISTRICT Filtered shapefile to {len(gdf)} features for subdistricts: {sub_district_codes}"
    #                         # )
                        
    #             elif data_type == "stretchbased":
    #                 if Stretch_IDs:
    #                     # Filter by subdistrict codes if provided
    #                     # Assuming your shapefile has a column for subdistrict codes
    #                     # Adjust the column name based on your actual shapefile structure
    #                     Stretch_column = "Stretch_ID"
    #                     if Stretch_column in gdf.columns:

    #                         gdf[Stretch_column] = gdf[Stretch_column].astype(str)
    #                         Stretch_IDs = [str(code).strip() for code in Stretch_IDs]

    #                         gdf = gdf[gdf[Stretch_column].isin(Stretch_IDs)]
    #                         # print(
    #                         #     f"STRETCH Filtered shapefile to {len(gdf)} features for subdistricts: {Stretch_IDs}"
    #                         # )
                        

    #         except json.JSONDecodeError:
    #             pass  # Continue h unfiltered data if JSON is invalid
    #     # Check if geodataframe has data before WQI calculation
    #     if not gdf.empty:
    #         # Convert GeoDataFrame to regular DataFrame for WQI calculation
    #         df_for_wqi = gdf.copy()

    #         # Create field mapping dictionary for consistent naming
    #         field_mapping = {
    #             "S_No_": "s_no",
    #             "Sub_Distri": "Sub_District",
    #             "Sub_Dist_1": "Sub_District_Code",
    #             "District_C": "District_Code",
    #             "Sampling": "sampling",
    #             "Location": "location",
    #             "STATUS": "status",
    #             "LATITUDE": "latitude",
    #             "LONGITUDE": "longitude",
    #             "pH": "ph",
    #             "Temperatur": "temperature",
    #             "TDS_mg_L_": "tds",
    #             "EC__S_cm_": "ec",
    #             "TSS_mg_L_": "tss",
    #             "TS_mg_L_": "ts",
    #             "DO_mg_L_": "do",
    #             "Turbidity_": "turbidity",
    #             "ORP": "orp",
    #             "COD_mg_L_": "cod",
    #             "BOD_mg_L_": "bod",
    #             "Chloride_m": "chloride",
    #             "Nitrate_mg": "nitrate",
    #             "Hardness_m": "hardness",
    #             "Faecal_Col": "faecal_coliform",
    #             "Total_Coli": "total_coliform",
    #             "Stretch_ID": "Stretch_ID",
    #         }

    #         # Rename columns that exist in the dataframe
    #         existing_mappings = {
    #             old: new
    #             for old, new in field_mapping.items()
    #             if old in df_for_wqi.columns
    #         }
    #         df_for_wqi = df_for_wqi.rename(columns=existing_mappings)

    #         # Ensure numeric columns are properly typed for WQI calculation
    #         numeric_columns = [
    #             "ph",
    #             "temperature",
    #             "tds",
    #             "ec",
    #             "tss",
    #             "ts",
    #             "do",
    #             "turbidity",
    #             "orp",
    #             "cod",
    #             "bod",
    #             "chloride",
    #             "nitrate",
    #             "hardness",
    #             "faecal_coliform",
    #             "total_coliform",
    #         ]

    #         for col in numeric_columns:
    #             if col in df_for_wqi.columns:
    #                 df_for_wqi[col] = pd.to_numeric(df_for_wqi[col], errors="coerce")

    #         # print(f"Starting WQI calculation for {len(df_for_wqi)} features...")

    #         # Apply WQI calculation using your existing function
    #         df_with_wqi = WQI(df_for_wqi, pcm, labels)

    #         # Add WQI results back to the original GeoDataFrame
    #         if "WQI" in df_with_wqi.columns:
    #             gdf["WQI"] = df_with_wqi["WQI"].round(2)

    #             # Add WQI classification
    #             def get_wqi_class(wqi_value):
    #                 if pd.isna(wqi_value):
    #                     return "Not Available"
    #                 elif wqi_value <= 25:
    #                     return "Excellent"
    #                 elif wqi_value <= 50:
    #                     return "Good"
    #                 elif wqi_value <= 75:
    #                     return "Poor"
    #                 elif wqi_value <= 100:
    #                     return "Very Poor"
    #                 else:
    #                     return "Unfit for Drinking"

    #             gdf["WQI_Class"] = gdf["WQI"].apply(get_wqi_class)


    #     geojson_str = gdf.to_json()
    #     geojson_dict = json.loads(geojson_str)

    #     response = JsonResponse(geojson_dict, safe=False)
    #     response["Access-Control-Allow-Origin"] = "*"
    #     response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    #     response["Access-Control-Allow-Headers"] = "Content-Type"
    #     return response

    # except Exception as e:
    #     # logger.error(f"Error processing shapefile: {str(e)}")
    #     response = JsonResponse(
    #         {"error": "Failed to process shapefile data"}, status=500
    #     )
    #     response["Access-Control-Allow-Origin"] = "*"
    #     return response
    
    
    try:
        body = json.loads(request.body) if request.method == "POST" else {}

        gdf = get_points_shapefile_gdf(
            data_type=data_type,
            season=season,
            sub_district_codes=body.get("Sub_District_Code"),
            stretch_ids=body.get("Stretch_ID"),
        )

        response = JsonResponse(json.loads(gdf.to_json()), safe=False)
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def clipped_subdistrict(request):
    """
    Enhanced subdistrict endpoint with filtering capability
    """
    try:
        shp_path = os.path.join(
            settings.MEDIA_ROOT, "rwm_data", "clipped_subdist", "clipped_subdist.shp"
        )

        if not os.path.exists(shp_path):
            return JsonResponse({"error": "Shapefile not found"}, status=404)

        gdf = gpd.read_file(shp_path)
        # print("gdf--------------", gdf)

        # Handle POST request with subdistrict filtering
        if request.method == "POST":
            try:
                body = json.loads(request.body)
                sub_district_codes = body.get("Sub_District_Code", [])
                # print("sub_district_codes", sub_district_codes)
                # print("body", body)

                if sub_district_codes:
                    filtered_gdf = load_subdistrict_boundaries(sub_district_codes)
                    if not filtered_gdf.empty:
                        gdf = filtered_gdf
                        # print(f"Filtered to {len(gdf)} subdistrict boundaries")

            except json.JSONDecodeError:
                pass

        if gdf.crs != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        geojson_str = gdf.to_json()
        geojson_dict = json.loads(geojson_str)

        response = JsonResponse(geojson_dict, safe=False)
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    except Exception as e:
        # logger.error(f"Error processing filtered shapefile: {str(e)}")
        response = JsonResponse(
            {"error": "Failed to process shapefile data"}, status=500
        )
        response["Access-Control-Allow-Origin"] = "*"
        return response


# Legacy function for backward compatibility


@csrf_exempt
def get_subdistricts(request, data_type="overall"):
    """
    API endpoint to return sub-districts data as JSON, filtered by District_Code if provided
    """
    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    try:
        # Determine the model based on data_type
        if data_type == "overall":
            model = WaterQuality_sampling_point_data
        elif data_type == "upstream":
            model = WaterQuality_upstream
        elif data_type == "downstream":
            model = WaterQuality_downstream
        else:
            return JsonResponse({"error": "Invalid data type."}, status=400)

        district_codes = []

        if request.method == "POST":
            # print(
            #     f"----------------------------------Received POST request to {request.path}"
            # )
            # print(f"Request body: {request.body}")

            try:
                body = json.loads(request.body)
                district_codes = body.get("District_Code", [])
                # print(f"District codes from POST: {district_codes}")
            except json.JSONDecodeError:
                return JsonResponse(
                    {"error": "Invalid JSON in request body"}, status=400
                )

        elif request.method == "GET":
            # print(f"Received GET request to {request.path}")
            # print(f"Query parameters: {request.GET}")

            district_code = request.GET.get("district_code")
            if district_code:
                district_codes = [district_code]
                # print(f"District codes from GET: {district_codes}")

        # Filter by District_Code if provided
        if district_codes:
            # print(f"Filtering by district codes: {district_codes}")
            # print(f"Total records in model: {model.objects.count()}")
            # print(f"Sample record: {model.objects.first()}")
            sample_record = model.objects.first()

            queryset = (
                model.objects.filter(District_Code__in=district_codes)
                .values("Sub_District", "Sub_District_Code", "District_Code")
                .distinct()
            )
        else:
            # print("No district codes provided, returning all sub-districts")
            queryset = (
                model.objects.all()
                .values("Sub_District", "Sub_District_Code", "District_Code")
                .distinct()
            )

        # print(f"Queryset count: {queryset.count()}")

        # Transform data for frontend
        results = []
        for item in queryset:
            results.append(
                {
                    "subdistrict_name": item["Sub_District"],
                    "subdistrict_code": item["Sub_District_Code"],
                    "district_code": item["District_Code"],
                }
            )

        # print(f"Results count: {len(results)}")
        # print(f"Sample results: {results[:3]}")

        response = JsonResponse(results, safe=False)
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    except Exception as e:
        # print(f"Error in get_subdistricts: {str(e)}")
        import traceback

        traceback.print_exc()
        response = JsonResponse(
            {"error": "Failed to fetch sub-districts data"}, status=500
        )
        response["Access-Control-Allow-Origin"] = "*"
        return response


@csrf_exempt
def get_stretches(request, data_type="overall"):
    """
    API endpoint to return stretches data as JSON, filtered by River_Code or Stretch_ID if provided
    """
    if request.method == "OPTIONS":
        response = JsonResponse({})
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    try:
        # For simplicity, ignore data_type since Stretches model doesn't differentiate
        # If you have different models (e.g., for upstream/downstream), adjust here
        model = Stretches

        river_codes = []
        stretch_ids = []

        if request.method == "POST":
            # print(f"Received POST request to {request.path}")
            # print(f"Request body: {request.body}")

            try:
                body = json.loads(request.body)
                river_codes = body.get("River_Code", [])
                stretch_ids = body.get("Stretch_ID", [])
                # print(f"River codes from POST: {river_codes}")
                # print(f"Stretch IDs from POST: {stretch_ids}")
            except json.JSONDecodeError:
                return JsonResponse(
                    {"error": "Invalid JSON in request body"}, status=400
                )

        elif request.method == "GET":
            # print(f"Received GET request to {request.path}")
            # print(f"Query parameters: {request.GET}")

            river_code = request.GET.get("river_code")
            stretch_id = request.GET.get("stretch_id")
            if river_code:
                river_codes = [river_code]
                # print(f"River codes from GET: {river_codes}")
            if stretch_id:
                stretch_ids = [stretch_id]
                # print(f"Stretch IDs from GET: {stretch_ids}")

        # Filter by River_Code or Stretch_ID if provided
        queryset = model.objects.all()
        if river_codes:
            # print(f"Filtering by river codes: {river_codes}")
            queryset = queryset.filter(River_Code__in=river_codes)
        if stretch_ids:
            # print(f"Filtering by stretch IDs: {stretch_ids}")
            queryset = queryset.filter(Stretch_ID__in=stretch_ids)

        # print(f"Queryset count: {queryset.count()}")

        # Transform data for frontend
        results = []
        for item in queryset:
            results.append(
                {
                    "stretch_name": item.Stretch_Na,
                    "stretch_code": item.Stretch_ID,  # Match frontend expectation
                    "Stretch_ID": item.Stretch_ID,
                    "River_Code": item.River_Code,
                }
            )

        # print(f"Results count: {len(results)}")
        # print(f"Sample results: {results[:3]}")

        response = JsonResponse(results, safe=False)
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    except Exception as e:
        # print(f"Error in get_stretches: {str(e)}")
        traceback.print_exc()
        response = JsonResponse({"error": "Failed to fetch stretches data"}, status=500)
        response["Access-Control-Allow-Origin"] = "*"
        return response


@csrf_exempt
def shapefile_data_with_wqi(request, data_type="overall"):
    """
    API endpoint to return shapefile data as GeoJSON with WQI calculation,
    optionally filtered by subdistricts
    """
    try:
        # First get the water quality data with WQI calculation
        if data_type == "overall":
            model = WaterQuality_sampling_point_data
            shp_path = os.path.join(
                settings.MEDIA_ROOT,
                "rwm_data",
                "DRAINS_Final_point",
                "DRAINS_Final_point.shp",
            )
        elif data_type == "upstream":
            model = WaterQuality_upstream
            shp_path = os.path.join(
                settings.MEDIA_ROOT,
                "rwm_data",
                "upstream_data_point",
                "upstream_data_points.shp",
            )
        elif data_type == "downstream":
            model = WaterQuality_downstream
            shp_path = os.path.join(
                settings.MEDIA_ROOT,
                "rwm_data",
                "downstream_data_point",
                "downstream_data_points.shp",
            )
        else:
            return JsonResponse({"error": "Invalid data type"}, status=400)

        if not os.path.exists(shp_path):
            # logger.error(f"Shapefile not found at: {shp_path}")
            return JsonResponse({"error": "Shapefile not found"}, status=404)

        # Get WQI-enhanced data from database
        sub_district_codes = []
        if request.method == "POST":
            try:
                body = json.loads(request.body)
                sub_district_codes = body.get("Sub_District_Code", [])
            except json.JSONDecodeError:
                pass

        # Get data with WQI calculation
        if sub_district_codes:
            db_data = model.objects.filter(
                Sub_District_Code__in=sub_district_codes
            ).values(
                "Sub_District",
                "Sub_District_Code",
                "District_Code",
                "s_no",
                "sampling",
                "location",
                "status",
                "latitude",
                "longitude",
                "ph",
                "tds",
                "ec",
                "temperature",
                "turbidity",
                "do",
                "orp",
                "tss",
                "cod",
                "bod",
                "ts",
                "chloride",
                "nitrate",
                "hardness",
                "faecal_coliform",
                "total_coliform",
            )
        else:
            db_data = model.objects.all().values(
                "Sub_District",
                "Sub_District_Code",
                "District_Code",
                "s_no",
                "sampling",
                "location",
                "status",
                "latitude",
                "longitude",
                "ph",
                "tds",
                "ec",
                "temperature",
                "turbidity",
                "do",
                "orp",
                "tss",
                "cod",
                "bod",
                "ts",
                "chloride",
                "nitrate",
                "hardness",
                "faecal_coliform",
                "total_coliform",
            )

        # Calculate WQI
        df = pd.DataFrame(db_data)
        if not df.empty:
            df = WQI(df, pcm, labels)  # This adds WQI column

        # Read shapefile
        gdf = gpd.read_file(shp_path)

        # Filter shapefile by subdistrict if needed
        if sub_district_codes:
            subdistrict_column = "SUBDIST_CO"  # Adjust based on your shapefile
            if subdistrict_column in gdf.columns:
                gdf = gdf[
                    gdf[subdistrict_column].isin(
                        [str(code) for code in sub_district_codes]
                    )
                ]

        # Merge WQI data with shapefile geometries
        # You'll need to match on a common field - adjust these field names based on your data
        if not df.empty:
            # Create a mapping from the database data
            wqi_mapping = {}
            for _, row in df.iterrows():
                # Use sampling location or coordinates as key - adjust as needed
                key = f"{row['latitude']}_{row['longitude']}"  # or use sampling field
                wqi_mapping[key] = {
                    "WQI": row.get("WQI"),
                    "ph": row.get("ph"),
                    "tds": row.get("tds"),
                    "ec": row.get("ec"),
                    "temperature": row.get("temperature"),
                    "turbidity": row.get("turbidity"),
                    "do": row.get("do"),
                    "orp": row.get("orp"),
                    "tss": row.get("tss"),
                    "cod": row.get("cod"),
                    "bod": row.get("bod"),
                    "ts": row.get("ts"),
                    "chloride": row.get("chloride"),
                    "nitrate": row.get("nitrate"),
                    "hardness": row.get("hardness"),
                    "faecal_coliform": row.get("faecal_coliform"),
                    "total_coliform": row.get("total_coliform"),
                }

            # Add WQI and other parameters to shapefile features
            def add_wqi_to_feature(row):
                # Create key from shapefile coordinates - adjust field names as needed
                lat_field = "LATITUDE"  # Adjust to your shapefile's latitude field
                lon_field = "LONGITUDE"  # Adjust to your shapefile's longitude field

                if lat_field in row and lon_field in row:
                    key = f"{row[lat_field]}_{row[lon_field]}"
                    if key in wqi_mapping:
                        for param, value in wqi_mapping[key].items():
                            row[param] = value
                    else:
                        row["WQI"] = None
                else:
                    row["WQI"] = None
                return row

            # Apply WQI data to shapefile
            for idx, row in gdf.iterrows():
                gdf.loc[idx] = add_wqi_to_feature(row)

        # Convert to GeoJSON
        geojson_str = gdf.to_json()
        geojson_dict = json.loads(geojson_str)

        response = JsonResponse(geojson_dict, safe=False)
        response["Access-Control-Allow-Origin"] = "*"
        response["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        return response

    except Exception as e:
        # logger.error(f"Error processing shapefile with WQI: {str(e)}")
        response = JsonResponse(
            {"error": "Failed to process shapefile data with WQI"}, status=500
        )
        response["Access-Control-Allow-Origin"] = "*"
        return response


################################STYLING############################

import requests
import json
import xml.etree.ElementTree as ET
import numpy as np
from django.conf import settings
import os


def get_color_scheme_for_attribute(attribute):

    # pH - Fixed thresholds (unchanged)
    pH_colors = [
        {
            "min": 0.0,
            "max": 4.5,
            "color": "#8B0000",
            "label": "Strong Acid",
        },  # Dark Red
        {"min": 4.5, "max": 5.5, "color": "#FF4500", "label": "Acidic"},  # Red-Orange
        {
            "min": 5.5,
            "max": 6.5,
            "color": "#FFA500",
            "label": "Slightly Acidic",
        },  # Orange
        {"min": 6.5, "max": 7.5, "color": "#32CD32", "label": "Neutral"},  # Green
        {
            "min": 7.5,
            "max": 8.5,
            "color": "#00BFFF",
            "label": "Slightly Basic",
        },  # Sky Blue
        {"min": 8.5, "max": 9.5, "color": "#1E90FF", "label": "Basic"},  # Dodger Blue
        {
            "min": 9.5,
            "max": 14.0,
            "color": "#00008B",
            "label": "Strong Base",
        },  # Dark Blue
    ]

    # Temperature - Fixed thresholds (°C)
    temperature_colors = [
        {"min": -10.0, "max": 0.0, "color": "#000080", "label": "Very Cold"},
        {"min": 0.0, "max": 10.0, "color": "#0040FF", "label": "Cold"},
        {"min": 10.0, "max": 15.0, "color": "#0080FF", "label": "Cool"},
        {"min": 15.0, "max": 20.0, "color": "#40C0FF", "label": "Moderate"},
        {"min": 20.0, "max": 25.0, "color": "#80FF80", "label": "Normal"},
        {"min": 25.0, "max": 30.0, "color": "#C0FF40", "label": "Warm"},
        {"min": 30.0, "max": 35.0, "color": "#FFFF00", "label": "Hot"},
        {"min": 35.0, "max": 40.0, "color": "#FF8000", "label": "Very Hot"},
        {"min": 40.0, "max": 100.0, "color": "#FF0000", "label": "Extremely Hot"},
    ]

    # Dissolved Oxygen - Fixed thresholds (mg/L, higher is better)
    DO_colors = [
        {"min": 0.0, "max": 2.0, "color": "#800000", "label": "Critical"},  # Dark Red
        {"min": 2.0, "max": 4.0, "color": "#FF0000", "label": "Very Low"},  # Red
        {"min": 4.0, "max": 5.0, "color": "#FF4000", "label": "Low"},  # Red-Orange
        {"min": 5.0, "max": 6.0, "color": "#FF8000", "label": "Poor"},  # Orange
        {
            "min": 6.0,
            "max": 7.0,
            "color": "#FFC000",
            "label": "Moderate",
        },  # Orange-Yellow
        {"min": 7.0, "max": 8.0, "color": "#FFFF00", "label": "Acceptable"},  # Yellow
        {"min": 8.0, "max": 10.0, "color": "#C0FF00", "label": "Good"},  # Yellow-Green
        {
            "min": 10.0,
            "max": 12.0,
            "color": "#80FF00",
            "label": "Very Good",
        },  # Light Green
        {"min": 12.0, "max": 20.0, "color": "#00FF00", "label": "Excellent"},  # Green
    ]

    # Turbidity - Fixed thresholds (NTU, higher is worse)
    turbidity_colors = [
        {"min": 0.0, "max": 1.0, "color": "#00FFFF", "label": "Crystal Clear"},  # Cyan
        {
            "min": 1.0,
            "max": 5.0,
            "color": "#40FF80",
            "label": "Very Clear",
        },  # Light Green-Cyan
        {"min": 5.0, "max": 10.0, "color": "#80FF40", "label": "Clear"},  # Light Green
        {
            "min": 10.0,
            "max": 20.0,
            "color": "#C0FF00",
            "label": "Slight Haze",
        },  # Yellow-Green
        {"min": 20.0, "max": 30.0, "color": "#FFFF00", "label": "Moderate"},  # Yellow
        {"min": 30.0, "max": 50.0, "color": "#FFD000", "label": "Turbid"},  # Gold
        {
            "min": 50.0,
            "max": 100.0,
            "color": "#FFA000",
            "label": "Very Turbid",
        },  # Orange
        {
            "min": 100.0,
            "max": 200.0,
            "color": "#FF6000",
            "label": "Highly Turbid",
        },  # Red-Orange
        {
            "min": 200.0,
            "max": 1000.0,
            "color": "#FF0000",
            "label": "Extremely Turbid",
        },  # Red
    ]

    # Default - Fixed thresholds for other attributes (generic scale)
    default_colors = [
        {"min": 0.0, "max": 10.0, "color": "#000080", "label": "Very Low"},  # Navy
        {"min": 10.0, "max": 20.0, "color": "#0040FF", "label": "Low"},  # Dark Blue
        {"min": 20.0, "max": 30.0, "color": "#0080FF", "label": "Low-Medium"},  # Blue
        {
            "min": 30.0,
            "max": 40.0,
            "color": "#40C0FF",
            "label": "Medium-Low",
        },  # Light Blue
        {
            "min": 40.0,
            "max": 50.0,
            "color": "#80FF80",
            "label": "Medium",
        },  # Light Green
        {
            "min": 50.0,
            "max": 60.0,
            "color": "#C0FF40",
            "label": "Medium-High",
        },  # Yellow-Green
        {"min": 60.0, "max": 70.0, "color": "#FFFF00", "label": "High"},  # Yellow
        {"min": 70.0, "max": 80.0, "color": "#FF8000", "label": "Very High"},  # Orange
        {
            "min": 80.0,
            "max": 100.0,
            "color": "#FF0000",
            "label": "Extremely High",
        },  # Red
    ]

    # Match attribute to color scheme
    attr_lower = attribute.lower()
    if "ph" in attr_lower:
        return pH_colors
    elif (
        "temp" in attr_lower
        or "temperature" in attr_lower
        or "temperatur" in attr_lower
    ):
        return temperature_colors
    elif (
        "do" in attr_lower or "dissolved oxygen" in attr_lower or "oxygen" in attr_lower
    ):
        return DO_colors
    elif (
        "turbidity" in attr_lower
        or "Turbidity_" in attribute
        or "Turbidity (FNU)" in attribute
    ):
        return turbidity_colors
    else:
        return default_colors


def calculate_raster_statistics(raster_data):
    """
    Calculate statistics for the raster data
    """
    # Remove NaN values for statistics
    valid_data = raster_data[~np.isnan(raster_data)]

    if len(valid_data) == 0:
        return None

    stats = {
        "min": float(np.min(valid_data)),
        "max": float(np.max(valid_data)),
        "mean": float(np.mean(valid_data)),
        "std": float(np.std(valid_data)),
        "median": float(np.median(valid_data)),
        "percentile_25": float(np.percentile(valid_data, 25)),
        "percentile_75": float(np.percentile(valid_data, 75)),
        "count": len(valid_data),
    }

    return stats


def create_simple_wqi_color_stops(stats):
    # print("=== FIXED WQI COLOR CLASSIFICATION ===")
    wqi_classes = [
        {"value": 25, "color": "#00FF00", "label": "Excellent (0-25)"},
        {"value": 50, "color": "#80FF00", "label": "Good (26-50)"},
        {"value": 75, "color": "#FFFF00", "label": "Fair (51-75)"},
        {"value": 100, "color": "#FF8000", "label": "Poor (76-100)"},
        {"value": 150, "color": "#FF0000", "label": "Very Poor (101-150)"},
        {"value": 250, "color": "#8B0000", "label": "Hazardous (151-250)"},
        {"value": 500, "color": "#4B0000", "label": "Critical (>250)"},
    ]
    data_min = float(stats["min"])
    data_max = float(stats["max"])
    # print(f"Data range: {data_min:.1f} to {data_max:.1f}")
    color_stops = []
    # Start with the class that covers the minimum value
    for i, wqi_class in enumerate(wqi_classes):
        if wqi_class["value"] >= data_min or i == len(wqi_classes) - 1:
            color_stops.append(
                {
                    "value": float(wqi_class["value"]),
                    "color": wqi_class["color"],
                    "label": wqi_class["label"],
                }
            )
            # print(f"✅ Included: {wqi_class['label']} - Color: {wqi_class['color']}")
            if wqi_class["value"] >= data_max and len(color_stops) >= 2:
                break
    # Ensure we cover the data_min explicitly
    if color_stops[0]["value"] > data_min:
        for i in range(len(wqi_classes)):
            if wqi_classes[i]["value"] >= data_min:
                if i > 0:
                    color_stops.insert(
                        0,
                        {
                            "value": float(data_min),
                            "color": wqi_classes[i - 1]["color"],
                            "label": f"Start ({data_min:.1f}) - {wqi_classes[i-1]['label']}",
                        },
                    )
                    # print(
                    #     f"✅ Added lower bound: Start ({data_min:.1f}) - {wqi_classes[i-1]['color']}"
                    # )
                break
    color_stops = sorted(color_stops, key=lambda x: x["value"])
    return color_stops


def create_color_stops(attribute_name, stats):
    """
    Create color stops for all attributes using fixed ranges
    """
    color_scheme = get_color_scheme_for_attribute(attribute_name)
    if not stats or "min" not in stats or "max" not in stats:
        # print("ERROR: Invalid statistics provided")
        return create_fallback_color_stops()

    # Handle edge case where min == max
    if abs(stats["max"] - stats["min"]) < 1e-10:
        # print(
        #     "WARNING: Min and max values are identical, creating single-value colormap"
        # )
        mid_value = stats["min"]
        single_color = "#4000FF"
        for stop in color_scheme:
            if (
                "min" in stop
                and "max" in stop
                and stop["min"] <= mid_value <= stop["max"]
            ):
                single_color = stop["color"]
                break
        return [
            {
                "value": mid_value,
                "color": single_color,
                "label": f"Value ({mid_value:.2f})",
            }
        ]

    # Handle WQI separately
    if attribute_name.lower() in ["wqi", "water quality index"]:
        return create_simple_wqi_color_stops(stats)

    # Handle all other attributes with fixed ranges
    data_min = float(stats["min"])
    data_max = float(stats["max"])
    color_stops = []

    # Add NoData stop if applicable
    nodata_value = stats.get("nodata", -9999)
    color_stops.append(
        {"value": nodata_value, "color": "#000000", "label": "NoData", "opacity": 0.0}
    )

    for color_def in color_scheme:
        if color_def["max"] >= data_min and color_def["min"] <= data_max:
            # Add start of range if it overlaps with data_min
            if color_def["min"] < data_min <= color_def["max"]:
                color_stops.append(
                    {
                        "value": data_min,
                        "color": color_def["color"],
                        "label": f"Start ({data_min:.1f}) - {color_def['label']}",
                    }
                )
            elif color_def["min"] >= data_min:
                color_stops.append(
                    {
                        "value": color_def["min"],
                        "color": color_def["color"],
                        "label": color_def["label"],
                    }
                )

            # Add end of range if it overlaps with data_max
            if color_def["min"] <= data_max < color_def["max"]:
                color_stops.append(
                    {
                        "value": data_max,
                        "color": color_def["color"],
                        "label": f"End ({data_max:.1f}) - {color_def['label']}",
                    }
                )
            elif color_def["max"] <= data_max:
                color_stops.append(
                    {
                        "value": color_def["max"],
                        "color": color_def["color"],
                        "label": color_def["label"],
                    }
                )

    # Sort and ensure unique stops
    color_stops = sorted(color_stops, key=lambda x: x["value"])
    unique_stops = []
    min_separation = (
        (stats["max"] - stats["min"]) / 10000
        if (stats["max"] - stats["min"]) > 0
        else 1e-9
    )
    for stop in color_stops:
        if (
            not unique_stops
            or abs(stop["value"] - unique_stops[-1]["value"]) > min_separation
        ):
            unique_stops.append(stop)

    if len(unique_stops) < 2:
        # print(
        #     f"WARNING: Not enough unique stops ({len(unique_stops)}) for {attribute_name}. Using fallback."
        # )
        return create_fallback_color_stops(stats)

    # print(
    #     f"{attribute_name} color stops: {[f'{stop['value']:.1f}: {stop['color']} - {stop['label']}' for stop in unique_stops]}"
    # )
    return unique_stops


def create_fallback_color_stops(stats=None):
    """
    Create fallback color stops
    """
    if not stats:
        return [
            {"value": 0.0, "color": "#0000FF", "label": "Low"},
            {"value": 25.0, "color": "#00FFFF", "label": "Low-Med"},
            {"value": 50.0, "color": "#FF0000", "label": "Medium"},
            {"value": 75.0, "color": "#FFA500", "label": "High"},
            {"value": 100.0, "color": "#FF0000", "label": "Very High"},
        ]

    min_val = float(stats["min"])
    max_val = float(stats["max"])
    range_val = max_val - min_val

    return [
        {"value": min_val, "color": "#0000FF", "label": f"Minimum ({min_val:.2f})"},
        {"value": min_val + 0.2 * range_val, "color": "#0080FF", "label": "Low"},
        {"value": min_val + 0.4 * range_val, "color": "#00FFFF", "label": "Low-Medium"},
        {"value": min_val + 0.5 * range_val, "color": "#FF0000", "label": "Medium"},
        {
            "value": min_val + 0.6 * range_val,
            "color": "#FF0000",
            "label": "Medium-High",
        },
        {"value": min_val + 0.8 * range_val, "color": "#FFA000", "label": "High"},
        {"value": max_val, "color": "#FF0000", "label": f"Maximum ({max_val:.2f})"},
    ]


def create_raster_sld(style_name, attribute_name, color_stops):
    """
    Create SLD for raster with fixed color stops
    """
    if not color_stops or len(color_stops) < 2:
        # print("WARNING: Insufficient color stops, using enhanced fallback")
        color_stops = create_fallback_color_stops()

    validated_stops = []
    for stop in color_stops:
        try:
            value = float(stop["value"])
            color = str(stop["color"]).strip()
            if not color.startswith("#"):
                color = "#" + color
            label = str(stop.get("label", f"Value {len(validated_stops)+1}"))
            opacity = float(stop.get("opacity", 0.8))

            validated_stops.append(
                {"value": value, "color": color, "label": label, "opacity": opacity}
            )
        except (ValueError, TypeError) as e:
            # print(f"Skipping invalid color stop: {stop}, error: {e}")
            continue

    if len(validated_stops) < 2:
        # print("CRITICAL: Insufficient valid color stops, using enhanced fallback")
        validated_stops = create_fallback_color_stops()

    validated_stops = sorted(validated_stops, key=lambda x: x["value"])
    color_map_entries = ""
    for stop in validated_stops:
        color_map_entries += f'        <ColorMapEntry color="{stop["color"]}" quantity="{stop["value"]}" opacity="{stop["opacity"]}" label="{stop["label"]}"/>\n'

    sld_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/sld StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>{style_name}</Name>
    <UserStyle>
      <Title>{attribute_name} Continuous Color Ramp</Title>
      <Abstract>Color classification for {attribute_name} with fixed ranges</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <Name>{attribute_name}_continuous_rule</Name>
          <Title>{attribute_name} Continuous Values</Title>
          <RasterSymbolizer>
            <ColorMap type="intervals" extended="true">
{color_map_entries}
            </ColorMap>
            <ContrastEnhancement>
              <Normalize/>
            </ContrastEnhancement>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>"""

    # print(
    #     f"Generated enhanced SLD for {style_name} with {len(validated_stops)} color stops"
    # )
    return sld_xml


def create_wqi_raster_sld(style_name, color_stops):
    if not color_stops or len(color_stops) < 2:
        return None

    sorted_stops = sorted(color_stops, key=lambda x: x["value"])
    color_map_entries = ""
    for stop in sorted_stops:
        color = stop["color"].upper()
        if not color.startswith("#"):
            color = "#" + color
        color_map_entries += f'        <ColorMapEntry color="{color}" quantity="{stop["value"]}" opacity="1.0" label="{stop["label"]}"/>\n'

    sld_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" 
    xmlns="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>{style_name}</Name>
    <UserStyle>
      <Title>WQI Color Classification</Title>
      <Abstract>Water Quality Index with proper color mapping for values {sorted_stops[0]['value']:.1f} to {sorted_stops[-1]['value']:.1f}</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <ColorMap type="intervals" extended="true">
{color_map_entries}            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>"""

    # print(f"Generated WQI SLD for {style_name} with {len(sorted_stops)} color stops")
    # print(
    #     f"Value range: {sorted_stops[0]['value']:.1f} to {sorted_stops[-1]['value']:.1f}"
    # )
    return sld_xml


import requests
import json
import os
import time  # Make sure time is imported
from django.conf import settings


def fix_raster_bounds_and_transform(raster_data, bounds):
    """
    Ensure consistent raster dimensions and transform
    """
    try:
        height, width = raster_data.shape
        # print(f"Raster dimensions: {width}x{height}")

        # Validate bounds
        minx, miny, maxx, maxy = bounds
        if minx >= maxx or miny >= maxy:
            raise ValueError(f"Invalid bounds: {bounds}")

        # Create precise transform using actual raster dimensions
        from rasterio.transform import from_bounds

        transform = from_bounds(minx, miny, maxx, maxy, width, height)

        # Validate transform
        if transform.a <= 0 or abs(transform.e) <= 0:
            raise ValueError(f"Invalid transform: {transform}")

        # print(f"Created transform: {transform}")
        return transform, (width, height)

    except Exception as e:
        # print(f"Error fixing raster bounds: {e}")
        raise


def create_safe_geotiff_with_validation(
    raster_data, transform, crs, attribute_name, nodata_value=-9999.0
):
    """
    Safe single-band GeoTIFF creation
    """
    height, width = raster_data.shape

    # Clean data
    clean_data = raster_data.copy().astype(np.float32)
    clean_data[~np.isfinite(clean_data)] = nodata_value

    # Single band options
    options = {
        "driver": "GTiff",
        "height": height,
        "width": width,
        "count": 1,  # Single band
        "dtype": np.float32,
        "crs": crs,
        "transform": transform,
        "nodata": nodata_value,
    }

    memfile = BytesIO()
    with rasterio.open(memfile, "w", **options) as dst:
        dst.write(clean_data, 1)

    memfile.seek(0)
    return memfile


def ensure_workspace_exists(workspace, auth_token):  # 👈 Accept auth_token
    """
    Checks if a workspace exists and creates it if not.
    Crucially, it now uses the provided auth_token for its request.
    """
    # print(f"🔍 Checking if workspace '{workspace}' exists...")
    url = f"{GEOSERVER_URL}/workspaces/{workspace}"
    headers = {"Authorization": f"Basic {auth_token}"}  # 👈 Use the auth_token here

    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            # print(f"✅ Workspace '{workspace}' already exists.")
            return True
        elif response.status_code == 404:
            # print(f"Workspace '{workspace}' not found. Creating it...")
            create_url = f"{GEOSERVER_URL}/workspaces"
            create_headers = {
                "Authorization": f"Basic {auth_token}",  # 👈 Use auth_token for creation too
                "Content-Type": "application/json",
            }
            create_data = json.dumps({"workspace": {"name": workspace}})
            create_response = requests.post(
                create_url, headers=create_headers, data=create_data
            )
            if create_response.status_code == 201:
                # print(f"✅ Successfully created workspace '{workspace}'.")
                return True
            else:
                # print(
                #     f"❌ Failed to create workspace. Status: {create_response.status_code}, Response: {create_response.text}"
                # )
                return False
        else:
            # This is where your error was happening
            # print(f"❌ Error checking workspace: {response.status_code}")
            # print(f"Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        # print(f"❌ Could not connect to GeoServer to check workspace: {e}")
        return False


def validate_raster_data(raster, attribute_name):
    """
    Performs a series of checks on the generated NumPy raster array before it's saved.
    """
    # print(f"=== VALIDATING RASTER DATA FOR {attribute_name} ===")
    if raster is None or not isinstance(raster, np.ndarray) or raster.size == 0:
        raise ValueError("Raster data is None, not a NumPy array, or is empty.")
    if len(raster.shape) != 2:
        raise ValueError(f"Raster must be 2D, but has shape {raster.shape}.")

    height, width = raster.shape
    valid_pixels = np.sum(~np.isnan(raster))
    total_pixels = raster.size

    if valid_pixels == 0:
        raise ValueError("Raster contains no valid data (all pixels are NaN).")

    return True


def create_robust_geotiff(
    raster_data, transform, crs, attribute_name, nodata_value=-9999.0
):
    """
    Create SINGLE-BAND GeoTIFF for numeric data
    """
    if len(raster_data.shape) == 3:
        # print(f"WARNING: Received 3D array {raster_data.shape}, converting to 2D")
        if raster_data.shape[0] == 1:
            raster_data = raster_data[0]  # Take first band
        else:
            raise ValueError(
                f"Cannot convert shape {raster_data.shape} to 2D - invalid input"
            )

    height, width = raster_data.shape

    # Clean data
    raster_clean = raster_data.copy().astype(np.float32)
    raster_clean[np.isnan(raster_clean)] = nodata_value
    raster_clean[np.isinf(raster_clean)] = nodata_value

    # CRITICAL: Single band only
    tiff_options = {
        "driver": "GTiff",
        "height": height,
        "width": width,
        "count": 1,  # MUST be 1
        "dtype": np.float32,
        "crs": crs,
        "transform": transform,
        "nodata": nodata_value,
        "compress": "lzw",
    }

    memfile = BytesIO()
    with rasterio.open(memfile, "w", **tiff_options) as dst:
        dst.write(raster_clean, 1)  # Write to band 1

        # Write NoData mask
        mask = (raster_clean != nodata_value).astype("uint8")
        dst.write_mask(mask)

    memfile.seek(0)
    # print(f"=== GEOTIFF VERIFICATION ===")
    with rasterio.open(memfile) as src:
        # print(f"Created TIFF bands: {src.count}")
        # print(f"Band dtypes: {src.dtypes}")
        # print(f"Expected: count=1, dtype=float32")

        if src.count != 1:
            raise ValueError(
                f"ERROR: Created {src.count}-band TIFF - MUST be 1 band for numeric data"
            )

        if src.dtypes[0] != "float32":
            print(f"WARNING: Band dtype is {src.dtypes[0]}, expected float32")

    return memfile


def validate_geotiff(file_path_or_buffer):
    """
    Validates a created GeoTIFF, accepting either a file path (str)
    or an in-memory file-like object (e.g., BytesIO).
    """
    # print("=== VALIDATING GEOTIFF ===")
    try:
        # The 'with rasterio.open(...)' context manager correctly handles both
        # file paths (strings) and in-memory file-like objects.
        with rasterio.open(file_path_or_buffer) as src:
            # Perform essential checks
            if not src.crs:
                raise ValueError("GeoTIFF is missing CRS information.")
            if src.width <= 0 or src.height <= 0:
                raise ValueError(
                    f"GeoTIFF has invalid dimensions: {src.width}x{src.height}"
                )

            # Try to read some data to confirm the file is not corrupt
            src.read(1)
        return True

    except Exception as e:
        # print(f"FATAL: GeoTIFF validation failed: {e}")
        import traceback

        traceback.print_exc()
        return False


def validate_sampling_points(point_gdf, attribute_name):
    """
    Validate sampling points data
    """

    if point_gdf.empty:
        raise ValueError("Sampling points GeoDataFrame is empty")

    # Check for required columns
    required_columns = ["geometry", attribute_name]
    missing_columns = [col for col in required_columns if col not in point_gdf.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns: {missing_columns}")

    # Check for valid geometries
    invalid_geoms = point_gdf[~point_gdf.geometry.is_valid]
    if not invalid_geoms.empty:
        point_gdf = point_gdf[point_gdf.geometry.is_valid]

    # Clean data
    points_clean = point_gdf.dropna(subset=["geometry", attribute_name])
    numeric_values = pd.to_numeric(points_clean[attribute_name], errors="coerce")
    points_clean = points_clean[~numeric_values.isna()]

    return points_clean


def create_proper_transform_from_bounds(bounds, width, height, crs="EPSG:4326"):
    """
    Create a proper transform from bounds with validation
    Fixed version that ensures correct pixel spacing
    """
    try:
        validated_bounds = validate_and_fix_bounds(bounds)
        minx, miny, maxx, maxy = validated_bounds

        # Calculate pixel size correctly
        pixel_width = (maxx - minx) / width
        pixel_height = (maxy - miny) / height

        # Create transform using rasterio - this is the correct way
        from rasterio.transform import from_bounds

        transform = from_bounds(minx, miny, maxx, maxy, width, height)
        
        return transform

    except Exception as e:
        # print(f"Error creating transform: {e}")
        raise


def validate_and_fix_bounds(bounds, fallback_bounds=None):
    """
    Enhanced bounds validation with better error handling
    """
    try:
        if len(bounds) != 4:
            raise ValueError("Bounds must have 4 values")

        minx, miny, maxx, maxy = bounds

        # Check if bounds are reasonable
        if minx >= maxx or miny >= maxy:
           
            if fallback_bounds is not None:
                return validate_and_fix_bounds(fallback_bounds)  # Recursive validation
            raise ValueError("Invalid bounds: min >= max")

        # Check if bounds are reasonable in size (not too small)
        width = maxx - minx
        height = maxy - miny

        if width < 1e-6 or height < 1e-6:
            if fallback_bounds is not None:
                return validate_and_fix_bounds(fallback_bounds)

        # Check if bounds are in reasonable geographic range for your area
        # Adjust these limits based on your study area
        return bounds

    except Exception as e:
        if fallback_bounds is not None:
            return validate_and_fix_bounds(fallback_bounds)
        # Default bounds for your region (adjust as needed)
        return [82.68, 25.32, 82.94, 25.45]


def create_color_stops_with_boundaries(attribute_name, stats):
    color_stops = create_color_stops(attribute_name, stats)

    # Ensure data range is covered
    data_min = stats["min"]
    data_max = stats["max"]

    # Add explicit boundaries if needed
    if data_min < color_stops[0]["value"]:
        color_stops.insert(
            0,
            {
                "value": data_min,
                "color": color_stops[0]["color"],  # Use same color as first stop
                "label": f"Below Range ({data_min:.1f})",
            },
        )

    if data_max > color_stops[-1]["value"]:
        color_stops.append(
            {
                "value": data_max,
                "color": color_stops[-1]["color"],  # Use same color as last stop
                "label": f"Above Range ({data_max:.1f})",
            }
        )

    return color_stops


from pykrige.ok import OrdinaryKriging  # Added for Kriging interpolation
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from rasterio.features import geometry_mask
from shapely.geometry import mapping


def create_multi_resolution_idw(
    sub_district_codes, stretch_ids, season, decoded_attribute, data_type
):
    """
    Enhanced version that creates rasters in both EPSG:4326 and EPSG:3857,
    using Kriging when points > 30, otherwise IDW.
    """
    try:

        # Resolution configurations
        resolution_configs = [
            {
                "name": "low",
                "resolution_m": 100,
                "max_size": 500,
                "description": "Low resolution for overview",
            },
            {
                "name": "medium",
                "resolution_m": 50,
                "max_size": 1000,
                "description": "Medium resolution",
            },
            {
                "name": "high",
                "resolution_m": 30,
                "max_size": 1500,
                "description": "High resolution",
            },
        ]

        workspace = "myworkspace"
        safe_attribute = (
            decoded_attribute.replace("(", "")
            .replace(")", "")
            .replace("/", "_")
            .replace(" ", "_")
        )

        created_layers = []

        # Load data once (same as original)
        if data_type == "subdistbased":
            river_gdf = load_and_clip_rivers(sub_district_codes)
            point_gdf = load_and_clip_sampling_points_subdistbased(
                sub_district_codes, season, decoded_attribute
            )
        else:
            river_gdf = load_stretch_lines(stretch_ids)
            point_gdf = load_and_clip_sampling_points_stretchbased(
                stretch_ids, season, decoded_attribute
            )

        point_gdf = validate_sampling_points(point_gdf, decoded_attribute)

        if river_gdf.empty or point_gdf.empty:
            raise ValueError("Insufficient data for interpolation")

        # Ensure same CRS
        if point_gdf.crs != river_gdf.crs:
            point_gdf = point_gdf.to_crs(river_gdf.crs)

        # Create processing geometry and bounds
        processing_geometry = river_gdf.geometry.unary_union.buffer(100 / 111000)
        bounds = processing_geometry.bounds
        bounds = validate_and_fix_bounds(bounds, point_gdf.total_bounds)
        
        # Prepare interpolation data (same as original)
        points_clean = point_gdf.dropna(subset=["geometry", decoded_attribute])
        numeric_values = pd.to_numeric(points_clean[decoded_attribute], errors="coerce")
        points_clean = points_clean[~numeric_values.isna()]

        coords = np.array([[geom.x, geom.y] for geom in points_clean.geometry])
        values = numeric_values.dropna().values

        if len(coords) < 3:
            raise ValueError(f"Need at least 3 valid points, found {len(coords)}")

        # Create each resolution level in both CRS
        for config in resolution_configs:
            try:

                # Create layer names for both CRS
                layer_name_4326 = f"{safe_attribute}_layer_4326_{config['name']}"
                store_name_4326 = f"{safe_attribute}_store_4326_{config['name']}"
                layer_name_3857 = f"{safe_attribute}_layer_3857_{config['name']}"
                store_name_3857 = f"{safe_attribute}_store_3857_{config['name']}"

                # Calculate grid dimensions
                width_degrees = bounds[2] - bounds[0]
                height_degrees = bounds[3] - bounds[1]
                target_resolution_deg = config["resolution_m"] / 111000
                ideal_width = int(width_degrees / target_resolution_deg)
                ideal_height = int(height_degrees / target_resolution_deg)

                # Constrain to maximum size
                max_size = config["max_size"]
                if ideal_width > max_size or ideal_height > max_size:
                    if ideal_width > ideal_height:
                        width = max_size
                        height = int((max_size * height_degrees) / width_degrees)
                    else:
                        height = max_size
                        width = int((max_size * width_degrees) / height_degrees)
                else:
                    width = ideal_width
                    height = ideal_height

                # Ensure minimum size
                width = max(width, 50)
                height = max(height, 50)

                # Calculate actual resolution
                actual_res_x = width_degrees / width * 111000
                actual_res_y = height_degrees / height * 111000
                # Create interpolation grid
                x_coords = np.linspace(bounds[0], bounds[2], width)
                y_coords = np.linspace(bounds[3], bounds[1], height)
                X, Y = np.meshgrid(x_coords, y_coords)
                grid_points = np.column_stack([X.ravel(), Y.ravel()])

                # Choose interpolation method based on number of points
                if len(coords) < 5:
                    # Perform Ordinary Kriging
                    try:
                        # Configure Kriging with a spherical variogram model
                        OK = OrdinaryKriging(
                            x=coords[:, 0],
                            y=coords[:, 1],
                            z=values,
                            variogram_model="spherical",  # Can also try 'exponential' or 'gaussian'
                            verbose=False,
                            enable_plotting=False,
                        )
                        # Interpolate on the grid
                        z_interpolated, sigma = OK.execute("grid", x_coords, y_coords)
                        interpolated_values = z_interpolated.flatten()
                        raster = interpolated_values.reshape((height, width))
                    except Exception as krige_error:
                        # Fallback to IDW if Kriging fails
                        power = 2.0
                        k = len(coords)
                        search_radius_deg = config["resolution_m"] * 55 / 111000
                        tree = cKDTree(coords)
                        distances, indices = tree.query(
                            grid_points, k=k, distance_upper_bound=search_radius_deg
                        )
                        weights = 1.0 / np.maximum(distances, 1e-10) ** power
                        valid_mask = ~np.isinf(distances)
                        interpolated_values = np.full(len(grid_points), np.nan)
                        for i in range(len(grid_points)):
                            valid_weights = weights[i][valid_mask[i]]
                            valid_values = values[indices[i][valid_mask[i]]]
                            if len(valid_weights) > 0 and np.sum(valid_weights) > 0:
                                interpolated_values[i] = np.sum(
                                    valid_weights * valid_values
                                ) / np.sum(valid_weights)
                        raster = interpolated_values.reshape((height, width))

                else:

                    # Configure IDW parameters (you can make these configurable)
                    idw_power = 2.0
                    search_mode = "variable"  # "variable", "fixed", or "global"
                    n_neighbors = min(
                        12, len(coords)
                    )  # ArcGIS default, but limited by available points

                    # Optional: calculate radius based on your resolution if using "fixed" mode
                    search_radius = None
                    if search_mode == "fixed":
                        search_radius = (
                            config["resolution_m"] * 55 / 111000
                        )  # Your existing calculation

                    # Perform advanced IDW interpolation
                    raster = interpolate_idw_advanced(
                        coords=coords,
                        values=values,
                        grid_points=grid_points,
                        height=height,
                        width=width,
                        power=idw_power,
                        search_mode=search_mode,
                        n_neighbors=n_neighbors,
                        radius=search_radius,
                    )

                # Apply masking
                if not processing_geometry.is_empty:
                    try:
                        mask = geometry_mask(
                            [mapping(processing_geometry)],
                            transform=create_proper_transform_from_bounds(
                                bounds, width, height, crs="EPSG:4326"
                            ),
                            invert=True,
                            out_shape=(height, width),
                            all_touched=True,
                        )
                        raster[~mask] = np.nan
                    except Exception as e:
                        traceback.print_exc()
                        continue


                valid_pixels = np.sum(~np.isnan(raster))
                if valid_pixels == 0:
                    continue

                # Create GeoTIFF in EPSG:4326
                memfile_4326 = create_geotiff_with_bounds_validation(
                    raster,
                    create_proper_transform_from_bounds(
                        bounds, width, height, crs="EPSG:4326"
                    ),
                    point_gdf.crs,
                    decoded_attribute,
                )

                memfile_4326.seek(0)
                with rasterio.open(memfile_4326) as src:
                    if src.count != 1:
                        raise ValueError(
                            f"ERROR: {src.count} bands created, need exactly 1"
                        )
                memfile_4326.seek(0)

                # Convert to EPSG:3857
                memfile_3857 = convert_raster_to_web_mercator(memfile_4326, "EPSG:3857")

                memfile_3857.seek(0)
                with rasterio.open(memfile_3857) as src:
                    if src.count != 1:
                        raise ValueError(
                            f"ERROR: {src.count} bands created, need exactly 1"
                        )
                memfile_3857.seek(0)

                # Publish EPSG:4326 layer
                success_4326 = publish_resolution_layer(
                    memfile_4326, workspace, store_name_4326, layer_name_4326, auth
                )

                # Publish EPSG:3857 layer
                success_3857 = publish_resolution_layer(
                    memfile_3857, workspace, store_name_3857, layer_name_3857, auth
                )
                if success_3857:
                    # Test the layer before applying styling
                    if not test_wms_layer(workspace, layer_name_3857, auth):
                        # Delete the broken layer
                        delete_url = (
                            f"{GEOSERVER_URL}/layers/{workspace}:{layer_name_3857}"
                        )
                        requests.delete(
                            delete_url, headers={"Authorization": f"Basic {auth}"}
                        )
                        continue  # Skip this resolution

                if success_4326 and success_3857:
                    # Apply styling to both layers
                    try:
                        style_result_4326 = create_and_apply_style_fixed(
                            workspace,
                            layer_name_4326,
                            decoded_attribute,
                            raster,
                            auth,
                            f"_{config['name']}",
                        )
                        style_result_3857 = create_and_apply_style_fixed(
                            workspace,
                            layer_name_3857,
                            decoded_attribute,
                            raster,
                            auth,
                            f"_{config['name']}_3857",
                        )

                        styled_4326 = style_result_4326.get("success", False)
                        styled_3857 = style_result_3857.get("success", False)

                    except Exception as style_error:
                        styled_4326 = False
                        styled_3857 = False

                    # Add both layers to results
                    created_layers.extend(
                        [
                            {
                                "name": layer_name_4326,
                                "crs": "EPSG:4326",
                                "resolution": int(actual_res_x),
                                "grid_size": f"{width}x{height}",
                                "valid_pixels": int(valid_pixels),
                                "styled": bool(styled_4326),
                                "style_name": str(
                                    style_result_4326.get("style_name", "raster")
                                ),
                                "applied": style_result_4326.get("success", False),
                                "style_name": style_result_4326.get("style_name"),
                                "color_stops": style_result_4326.get("color_stops"),
                                "statistics": style_result_4326.get("statistics"),
                                "error_message": style_result_4326.get("message"),
                                "interpolation_method": (
                                    "Kriging" if len(coords) < 5 else "IDW"
                                ),  # Indicate method used
                            },
                            {
                                "name": layer_name_3857,
                                "crs": "EPSG:3857",
                                "resolution": int(actual_res_x),
                                "grid_size": f"{width}x{height}",
                                "valid_pixels": int(valid_pixels),
                                "styled": bool(styled_3857),
                                "style_name": str(
                                    style_result_3857.get("style_name", "raster")
                                ),
                                "applied": style_result_3857.get("success", False),
                                "style_name": style_result_3857.get("style_name"),
                                "color_stops": style_result_3857.get("color_stops"),
                                "statistics": style_result_3857.get("statistics"),
                                "error_message": style_result_3857.get("message"),
                                "interpolation_method": (
                                    "Kriging" if len(coords) < 5 else "IDW"
                                ),  # Indicate method used
                            },
                        ]
                    )


            except Exception as e:
                import traceback

                traceback.print_exc()
                continue

        if not created_layers:
            raise ValueError("No resolution layers were created successfully")

        return {
            "status": "success",
            "layers": created_layers,
            "primary_layer": created_layers[5]["name"],
            "multi_resolution": True,
            "multi_crs": True,
            "bounds": bounds,
            "color_styling": {},
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}


def interpolate_idw_advanced(
    coords,
    values,
    grid_points,
    height,
    width,
    power=2,
    search_mode="variable",
    n_neighbors=12,
    radius=None,
):
    """
    Advanced IDW interpolation with multiple search modes

    Parameters:
    - coords: array of (x, y) coordinates
    - values: array of values to interpolate
    - grid_points: array of grid points for interpolation
    - height, width: dimensions of output raster
    - power: IDW power parameter (default=2)
    - search_mode: "variable", "fixed", or "global"
    - n_neighbors: number of neighbors for variable search (default=12)
    - radius: search radius for fixed search (in same units as coords)
    """

    from scipy.spatial import cKDTree
    import numpy as np

    # Build KDTree for fast neighbor queries
    tree = cKDTree(coords)

    if search_mode == "variable":
        # Use N nearest neighbors (ArcGIS-like default)
        
        dists, idxs = tree.query(grid_points, k=min(n_neighbors, len(coords)))

        # Handle exact matches (distance = 0)
        dists[dists == 0] = 1e-10

        # Calculate IDW weights
        weights = 1 / (dists**power)

        # Calculate interpolated values
        if len(coords) >= n_neighbors:
            interpolated_values = np.sum(weights * values[idxs], axis=1) / np.sum(
                weights, axis=1
            )
        else:
            # If fewer points than n_neighbors, use all available points
            interpolated_values = np.sum(weights * values[idxs], axis=1) / np.sum(
                weights, axis=1
            )

    elif search_mode == "fixed":
        # Use all points within radius
        if radius is None:
            raise ValueError("Radius must be specified for fixed search mode")

        idxs_list = tree.query_ball_point(grid_points, r=radius)
        interpolated_values = np.zeros(len(grid_points))

        for i, neighbors in enumerate(idxs_list):
            if len(neighbors) == 0:
                interpolated_values[i] = np.nan
            else:
                # Calculate distances to neighbors
                dists = np.linalg.norm(coords[neighbors] - grid_points[i], axis=1)
                dists[dists == 0] = 1e-10  # Handle exact matches

                # Calculate weights and interpolated value
                weights = 1 / (dists**power)
                interpolated_values[i] = np.sum(weights * values[neighbors]) / np.sum(
                    weights
                )

    else:  # global search mode
        # Use all points for interpolation

        # Calculate distances from all grid points to all data points
        dists = np.linalg.norm(coords[:, None, :] - grid_points[None, :, :], axis=2)
        dists[dists == 0] = 1e-10  # Handle exact matches

        # Calculate weights (transpose for correct broadcasting)
        weights = 1 / (dists.T**power)

        # Calculate interpolated values
        interpolated_values = np.sum(weights * values, axis=1) / np.sum(weights, axis=1)

    # Reshape to raster grid
    raster = interpolated_values.reshape((height, width))
    return raster


def publish_resolution_layer(memfile, workspace, store_name, layer_name, auth):
    """
    Publish layer to GeoServer - Updated for your Docker setup
    """
    try:
        # For internal container communication, use service name and internal port
        geoserver_url = f"{GEOSERVER_URL}/rest"
        headers_auth = {"Authorization": f"Basic {auth}"}

        # Add connection test first
        try:
            test_response = requests.get(
                f"{geoserver_url}/workspaces", headers=headers_auth, timeout=30
            )
            if test_response.status_code != 200:
                return False
        except requests.exceptions.ConnectionError:
            return False
        except requests.exceptions.Timeout:
            return False

        # Cleanup existing resources
        delete_layer_url = f"{geoserver_url}/layers/{workspace}:{layer_name}"
        delete_store_url = (
            f"{geoserver_url}/workspaces/{workspace}/coveragestores/{store_name}"
        )

        requests.delete(delete_layer_url, headers=headers_auth, timeout=60)
        requests.delete(
            delete_store_url,
            headers=headers_auth,
            params={"recurse": "true"},
            timeout=60,
        )

        # Validate memfile before upload
        memfile.seek(0)
        file_size = len(memfile.getvalue())

        if file_size == 0:
            return False

        # Upload GeoTIFF with extended timeout
        upload_url = f"{geoserver_url}/workspaces/{workspace}/coveragestores/{store_name}/file.geotiff?coverageName={layer_name}"

        headers_tiff = {"Content-Type": "image/tiff", **headers_auth}

        memfile.seek(0)

        response = requests.put(
            upload_url,
            data=memfile.getvalue(),
            headers=headers_tiff,
            timeout=300,  # 5 minute timeout for large files
        )

        if response.status_code not in [200, 201]:
            return False

        return True

    except requests.exceptions.ConnectionError as e:
        return False
    except requests.exceptions.Timeout as e:
        return False
    except Exception as e:
        import traceback

        traceback.print_exc()
        return False


def create_layer_group_for_zoom_levels(workspace, attribute_name, created_layers, auth):
    """
    Create a layer group that shows different resolutions at different zoom levels
    """
    try:
        geoserver_url = f"{GEOSERVER_URL}/rest"
        headers_auth = {"Authorization": f"Basic {auth}"}

        group_name = f"{attribute_name}_auto_resolution"

        # Create layer group XML with scale-dependent rendering
        layers_xml = ""
        styles_xml = ""

        for layer_info in created_layers:
            layers_xml += f"        <layer>{workspace}:{layer_info['name']}</layer>\n"
            styles_xml += f"        <style/>\n"  # Use default style for each layer

        group_xml = f"""<layerGroup>
            <name>{group_name}</name>
            <mode>SINGLE</mode>
            <title>{attribute_name} - Auto Resolution</title>
            <abstractTxt>Automatically switches resolution based on zoom level</abstractTxt>
            <layers>
{layers_xml}
            </layers>
            <styles>
{styles_xml}
            </styles>
            <bounds>
                <minx>-180</minx>
                <maxx>180</maxx>
                <miny>-90</miny>
                <maxy>90</maxy>
                <crs>EPSG:4326</crs>
            </bounds>
        </layerGroup>"""

        group_url = f"{geoserver_url}/layergroups"
        response = requests.post(
            group_url,
            data=group_xml,
            headers={"Content-Type": "text/xml", **headers_auth},
        )

        if response.status_code in [200, 201]:
            return group_name
        else:
            return None

    except Exception as e:
        return None


def create_and_apply_style_fixed(
    workspace, layer_name, attribute_name, raster_data, auth, resolution_suffix=""
):
    """
    Fixed style creation - Updated for your Docker setup
    """
    try:
        # Internal container communication
        geoserver_url = f"{GEOSERVER_URL}/rest"
        headers_auth = {"Authorization": f"Basic {auth}"}

        # Test connection first
        try:
            test_response = requests.get(
                f"{geoserver_url}/workspaces", headers=headers_auth, timeout=10
            )
            if test_response.status_code != 200:
                
                return apply_fallback_style(
                    workspace, layer_name, attribute_name, raster_data, auth
                )
        except:
            return apply_fallback_style(
                workspace, layer_name, attribute_name, raster_data, auth
            )

        # Rest of your existing styling code...
        stats = calculate_raster_statistics(raster_data)
        if stats is None:
            return {"success": False, "message": "No valid data for statistics"}


        # Create style name
        safe_attribute = (
            attribute_name.replace("(", "")
            .replace(")", "")
            .replace("/", "_")
            .replace(" ", "_")
            .replace("μ", "u")
            .replace("°", "deg")
        )
        style_name = f"{safe_attribute}_color_ramp{resolution_suffix}"

        # Check if this is WQI and use appropriate color stops
        attr_lower = attribute_name.lower()
        if "wqi" in attr_lower or "water quality index" in attr_lower:
            color_stops = create_simple_wqi_color_stops(stats)
            sld_xml = create_wqi_raster_sld(style_name, color_stops)
        else:
            color_stops = create_color_stops(attribute_name, stats)
            sld_xml = create_raster_sld(style_name, attribute_name, color_stops)

        if not sld_xml:
            return {"success": False, "message": "Failed to create SLD"}

        # Force delete existing style
        style_url = f"{geoserver_url}/styles/{style_name}"
        delete_response = requests.delete(style_url, headers=headers_auth, timeout=30)
        # Create new style with extended timeout
        headers = {
            "Content-Type": "application/vnd.ogc.sld+xml",
            "Authorization": f"Basic {auth}",
        }

        create_url = f"{geoserver_url}/styles"
        response = requests.post(
            create_url,
            params={"name": style_name},
            data=sld_xml,
            headers=headers,
            timeout=120,
        )

        if response.status_code not in [200, 201]:
            return apply_fallback_style(
                workspace, layer_name, attribute_name, stats, auth
            )

        # Apply style to layer
        layer_update_url = f"{geoserver_url}/layers/{workspace}:{layer_name}"
        layer_xml = f"""<layer>
            <defaultStyle>
                <name>{style_name}</name>
            </defaultStyle>
            <enabled>true</enabled>
        </layer>"""

        apply_response = requests.put(
            layer_update_url,
            data=layer_xml,
            headers={"Content-Type": "text/xml", **headers_auth},
            timeout=60,
        )

        if apply_response.status_code not in [200, 201]:
            return {
                "success": False,
                "message": f"Style application failed: {apply_response.text}",
            }

        return {
            "success": True,
            "style_name": style_name,
            "attribute": attribute_name,
            "statistics": {
                "min": float(stats["min"]),
                "max": float(stats["max"]),
                "mean": float(stats.get("mean", 0)),
                "std": float(stats.get("std", 0)),
                "count": int(stats.get("count", 0)),
            },
            "color_stops": color_stops,
            "styled": True,
        }

    except Exception as e:
        import traceback

        traceback.print_exc()
        return apply_fallback_style(workspace, layer_name, attribute_name, stats, auth)


def apply_fallback_style(workspace, layer_name, attribute_name, stats, auth):
    """
    Apply a guaranteed-to-work fallback style
    """
    try:
        geoserver_url = f"{GEOSERVER_URL}/rest"
        headers_auth = {"Authorization": f"Basic {auth}"}

        if stats:
            # Create a very simple 2-color style
            safe_attribute = (
                attribute_name.replace("(", "")
                .replace(")", "")
                .replace("/", "_")
                .replace(" ", "_")
            )
            fallback_style_name = f"{safe_attribute}_simple"

            min_val = float(stats["min"])
            max_val = float(stats["max"])

            # Ensure values are different
            if abs(max_val - min_val) < 0.001:
                min_val = min_val - 1.0
                max_val = max_val + 1.0

            simple_sld = f"""<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld">
  <NamedLayer>
    <Name>{fallback_style_name}</Name>
    <UserStyle>
      <Title>Simple {attribute_name}</Title>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <ColorMap type="ramp">
              <ColorMapEntry color="#0000FF" quantity="{min_val}" opacity="1.0" label="Low"/>
              <ColorMapEntry color="#FF0000" quantity="{max_val}" opacity="1.0" label="High"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>"""

            # Force delete any existing fallback style
            style_url = f"{geoserver_url}/styles/{fallback_style_name}"
            requests.delete(style_url, headers=headers_auth)

            # Create fallback style
            create_response = requests.post(
                f"{geoserver_url}/styles",
                params={"name": fallback_style_name},
                data=simple_sld,
                headers={"Content-Type": "application/vnd.ogc.sld+xml", **headers_auth},
            )

            if create_response.status_code in [200, 201]:
                # Apply fallback style
                layer_url = f"{geoserver_url}/layers/{workspace}:{layer_name}"
                layer_xml = f"""<layer>
                    <defaultStyle>
                        <name>{fallback_style_name}</name>
                    </defaultStyle>
                </layer>"""

                apply_response = requests.put(
                    layer_url,
                    data=layer_xml,
                    headers={"Content-Type": "text/xml", **headers_auth},
                )

                if apply_response.status_code in [200, 201]:
                    return {
                        "success": True,
                        "style_name": fallback_style_name,
                        "fallback": True,
                        "message": "Used simple fallback style",
                    }

        # Last resort: use built-in raster style
        layer_url = f"{geoserver_url}/layers/{workspace}:{layer_name}"
        layer_xml = """<layer>
            <defaultStyle>
                <name>raster</name>
            </defaultStyle>
        </layer>"""

        requests.put(
            layer_url,
            data=layer_xml,
            headers={"Content-Type": "text/xml", **headers_auth},
        )

        return {
            "success": True,
            "style_name": "raster",
            "fallback": True,
            "message": "Used default raster style",
        }

    except Exception as e:
        return {"success": False, "message": f"All styling attempts failed: {e}"}


def force_delete_all_related_styles(attribute_name, auth):
    """
    Force delete all styles related to an attribute (cleanup utility)
    """
    try:
        geoserver_url = f"{GEOSERVER_URL}/rest"
        headers_auth = {"Authorization": f"Basic {auth}"}

        safe_attribute = (
            attribute_name.replace("(", "")
            .replace(")", "")
            .replace("/", "_")
            .replace(" ", "_")
            .replace("μ", "u")
            .replace("°", "deg")
        )

        # List of possible style names to clean up
        style_names = [
            f"{safe_attribute}_color_ramp",
            f"{safe_attribute}_simple",
            f"{safe_attribute}_raster",
            f"{attribute_name}_color_ramp",  # In case it was created with original name
        ]

        for style_name in style_names:
            try:
                style_url = f"{geoserver_url}/styles/{style_name}"
                response = requests.delete(style_url, headers=headers_auth)
            except Exception as delete_error:
                print(f"Failed deleting style {style_name}: {delete_error}")
                    

    except Exception as e:
        print(f"Error in cleanup: {e}")


def generate_cache_key(sub_district_codes, stretch_ids, attribute_name, data_type):
    """
    Generate a unique cache key for the interpolation parameters
    """
    cache_data = {
        "sub_district_codes": sorted(sub_district_codes) if sub_district_codes else [],
        "stretch_ids": sorted(stretch_ids) if stretch_ids else [],
        "attribute_name": attribute_name,
        "data_type": data_type,
        "version": "2.0",  # Increment when you change interpolation logic
    }

    cache_string = str(cache_data)
    cache_hash = hashlib.md5(cache_string.encode()).hexdigest()
    return f"idw_v2_{cache_hash}"


def check_if_layer_exists(workspace, layer_name, auth):
    """
    Check if a GeoServer layer already exists
    """
    try:
        geoserver_url = f"{GEOSERVER_URL}/rest"
        headers_auth = {"Authorization": f"Basic {auth}"}

        layer_url = f"{geoserver_url}/layers/{workspace}:{layer_name}"
        response = requests.get(layer_url, headers=headers_auth)

        return response.status_code == 200
    except Exception as e:
        # print(f"Error checking layer existence: {e}")
        return False


def check_geoserver_health():
    """
    Check if GeoServer is accessible from Django container
    """
    try:

        # Test internal container communication
        internal_url = "http://geoserver:8080/geoserver/rest/workspaces"
        headers = {"Authorization": f"Basic {auth}"}

        response = requests.get(internal_url, headers=headers, timeout=30)

        if response.status_code == 200:
            workspaces = response.text
            return True
        else:
            return False

    except requests.exceptions.ConnectionError as e:
        return False
    except requests.exceptions.Timeout:
        return False
    except Exception as e:
        return False


# Add this to your views.py for manual testing
@csrf_exempt
def test_geoserver_connection(request):
    """
    Test endpoint for GeoServer connectivity
    """
    health_status = check_geoserver_health()

    return JsonResponse(
        {"geoserver_healthy": health_status, "timestamp": int(time.time())}
    )


def convert_to_json_serializable(obj):
    """
    Convert numpy and pandas types to JSON serializable Python types
    """
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, pd.Series):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_to_json_serializable(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_to_json_serializable(item) for item in obj]
    else:
        return obj


def clear_idw_cache():
    """
    Clear all IDW caches - useful for debugging
    """
    try:
        from django.core.cache import cache

        # Get all cache keys (this might not work with all cache backends)
        cache.clear()  # Nuclear option - clears all cache
    except Exception as e:
        print(f"Error clearing cache: {e}")


def create_geotiff_with_bounds_validation(
    raster_data, transform, crs, attribute_name, nodata_value=-9999.0
):
    """
    Create single-band GeoTIFF with validation
    """
    try:
        # Validate
        if raster_data is None or raster_data.size == 0:
            raise ValueError("Raster data is empty")

        height, width = raster_data.shape

        # Clean data
        raster_clean = raster_data.copy().astype(np.float32)
        raster_clean[np.isinf(raster_clean)] = nodata_value
        raster_clean[np.isnan(raster_clean)] = nodata_value

        # Single-band options
        tiff_options = {
            "driver": "GTiff",
            "height": height,
            "width": width,
            "count": 1,  # SINGLE BAND
            "dtype": np.float32,
            "crs": crs,
            "transform": transform,
            "nodata": nodata_value,
            "compress": "lzw",
        }

        memfile = BytesIO()
        with rasterio.open(memfile, "w", **tiff_options) as dst:
            dst.write(raster_clean, 1)
            dst.set_band_description(1, attribute_name)

            # Metadata
            dst.update_tags(
                1,
                attribute=attribute_name,
                min_value=str(float(np.nanmin(raster_data))),
                max_value=str(float(np.nanmax(raster_data))),
            )

            # Mask
            dst.write_mask((raster_clean != nodata_value).astype("uint8"))

        memfile.seek(0)
        return memfile

    except Exception as e:
        raise


def convert_raster_to_web_mercator(memfile, target_crs="EPSG:3857"):
    """
    Fixed Web Mercator conversion with better error handling
    """
    try:
        memfile.seek(0)

        with rasterio.open(memfile) as src:
            # Get NoData value from source
            nodata = src.nodata if src.nodata is not None else -9999

            # Calculate transform
            transform, width, height = calculate_default_transform(
                src.crs, target_crs, src.width, src.height, *src.bounds
            )

            # Limit output size to prevent memory issues
            max_dim = 2000
            if width > max_dim or height > max_dim:
                scale = min(max_dim / width, max_dim / height)
                width = int(width * scale)
                height = int(height * scale)
                transform = transform * rasterio.Affine.scale(1 / scale)

            profile = {
                "driver": "GTiff",
                "height": height,
                "width": width,
                "count": 1,
                "dtype": np.float32,
                "crs": target_crs,
                "transform": transform,
                "nodata": nodata,
                "compress": "lzw",
            }

            output_memfile = BytesIO()

            with rasterio.open(output_memfile, "w", **profile) as dst:
                # Reproject with explicit NoData handling
                reproject(
                    source=rasterio.band(src, 1),
                    destination=rasterio.band(dst, 1),
                    src_transform=src.transform,
                    src_crs=src.crs,
                    src_nodata=nodata,
                    dst_transform=transform,
                    dst_crs=target_crs,
                    dst_nodata=nodata,
                    resampling=Resampling.bilinear,
                )

                # Validate output
                dst.write_mask((dst.read(1) != nodata).astype("uint8"))

        output_memfile.seek(0)

        # CRITICAL: Validate reprojected data
        with rasterio.open(output_memfile) as test:
            test_data = test.read(1)
            valid_count = np.sum(test_data != nodata)

            if valid_count == 0:
                raise ValueError("Reprojection resulted in all NoData")

            if np.any(np.isnan(test_data)) or np.any(np.isinf(test_data)):
                # Fix any remaining invalid values
                test_data[np.isnan(test_data)] = nodata
                test_data[np.isinf(test_data)] = nodata

                # Rewrite the corrected data
                output_memfile = BytesIO()
                profile["nodata"] = nodata
                with rasterio.open(output_memfile, "w", **profile) as dst:
                    dst.write(test_data, 1)
                    dst.write_mask((test_data != nodata).astype("uint8"))

        output_memfile.seek(0)
        
        return output_memfile

    except Exception as e:
        raise


def test_wms_layer(workspace, layer_name, auth):
    """
    Test if WMS can actually render the layer - FIXED for Docker
    """
    try:
        # Use internal container URL (same as REST API)
        internal_wms_url = "http://geoserver:8080/geoserver/wms"

        test_url = f"{internal_wms_url}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS={workspace}:{layer_name}&STYLES=&SRS=EPSG:3857&BBOX=9200000,2900000,9220000,2920000&WIDTH=256&HEIGHT=256&FORMAT=image/png"

        headers = {"Authorization": f"Basic {auth}"}
        response = requests.get(test_url, headers=headers, timeout=30)

        if response.status_code != 200:
            return False

        # Check if response is actually an image
        content_type = response.headers.get("Content-Type", "")
        if not content_type.startswith("image/"):
            return False

        return True

    except Exception as e:
        return False


########################################improvement2#########################


def get_quality_thresholds(attribute_name, statistics):
    """
    Define quality thresholds for different water quality parameters
    Fixed version with extended WQI ranges and non-overlapping boundaries
    """
    attr_lower = attribute_name.lower()

    thresholds = {}

    if "ph" in attr_lower:
        thresholds = {
            "excellent": {"min": 6.5, "max": 8.5, "description": "Optimal pH range"},
            "good": {
                "min": 6.0,
                "max": 6.5,
                "description": "Acceptable pH (slightly acidic)",
            },
            "good_alkaline": {
                "min": 8.5,
                "max": 9.0,
                "description": "Acceptable pH (slightly alkaline)",
            },
            "poor_acidic": {"min": 0, "max": 6.0, "description": "Too acidic"},
            "poor_alkaline": {"min": 9.0, "max": 14, "description": "Too alkaline"},
        }
    elif "do" in attr_lower or "oxygen" in attr_lower:
        thresholds = {
            "excellent": {
                "min": 8.0,
                "max": float("inf"),
                "description": "High oxygen",
            },
            "good": {"min": 6.0, "max": 8.0, "description": "Adequate oxygen"},
            "fair": {"min": 4.0, "max": 6.0, "description": "Low oxygen"},
            "poor": {"min": 2.0, "max": 4.0, "description": "Very low oxygen"},
            "critical": {
                "min": 0,
                "max": 2.0,
                "description": "Critical oxygen deficit",
            },
        }
    elif "turbidity" in attr_lower:
        thresholds = {
            "excellent": {"min": 0, "max": 1, "description": "Crystal clear"},
            "good": {"min": 1, "max": 4, "description": "Clear water"},
            "fair": {"min": 4, "max": 10, "description": "Slightly turbid"},
            "poor": {"min": 10, "max": 25, "description": "Turbid water"},
            "very_poor": {
                "min": 25,
                "max": float("inf"),
                "description": "Highly turbid",
            },
        }
    elif "wqi" in attr_lower:
        # FIXED: Extended WQI thresholds to handle values up to 500+
        thresholds = {
            "excellent": {
                "min": 0,
                "max": 25,
                "description": "Excellent water quality",
            },
            "good": {"min": 25, "max": 50, "description": "Good water quality"},
            "fair": {"min": 50, "max": 75, "description": "Fair water quality"},
            "poor": {"min": 75, "max": 100, "description": "Poor water quality"},
            "very_poor": {
                "min": 100,
                "max": 150,
                "description": "Very poor water quality",
            },
            "hazardous": {
                "min": 150,
                "max": 200,
                "description": "Hazardous water quality",
            },
            "critical": {
                "min": 200,
                "max": 250,
                "description": "Critical water quality",
            },
            "severe": {"min": 250, "max": 300, "description": "Severe contamination"},
            "extreme": {"min": 300, "max": 400, "description": "Extreme contamination"},
            "catastrophic": {
                "min": 400,
                "max": float("inf"),
                "description": "Catastrophic contamination",
            },
        }
    elif "tds" in attr_lower:
        thresholds = {
            "excellent": {"min": 0, "max": 150, "description": "Excellent (low TDS)"},
            "good": {"min": 150, "max": 300, "description": "Good quality"},
            "fair": {"min": 300, "max": 600, "description": "Fair quality"},
            "poor": {"min": 600, "max": 1000, "description": "Poor quality"},
            "very_poor": {
                "min": 1000,
                "max": float("inf"),
                "description": "Very poor (high TDS)",
            },
        }
    elif "ec" in attr_lower:
        thresholds = {
            "excellent": {
                "min": 0,
                "max": 250,
                "description": "Excellent conductivity",
            },
            "good": {"min": 250, "max": 500, "description": "Good conductivity"},
            "fair": {"min": 500, "max": 1000, "description": "Fair conductivity"},
            "poor": {"min": 1000, "max": 2000, "description": "Poor conductivity"},
            "very_poor": {
                "min": 2000,
                "max": float("inf"),
                "description": "Very high conductivity",
            },
        }
    elif "temp" in attr_lower:
        thresholds = {
            "excellent": {"min": 15, "max": 25, "description": "Optimal temperature"},
            "good": {"min": 10, "max": 15, "description": "Good (cool)"},
            "good_warm": {"min": 25, "max": 30, "description": "Good (warm)"},
            "fair": {"min": 5, "max": 10, "description": "Fair (cold)"},
            "fair_hot": {"min": 30, "max": 35, "description": "Fair (hot)"},
            "poor": {"min": 0, "max": 5, "description": "Poor (very cold)"},
            "poor_hot": {
                "min": 35,
                "max": float("inf"),
                "description": "Poor (very hot)",
            },
        }
    elif "cod" in attr_lower:
        thresholds = {
            "excellent": {"min": 0, "max": 10, "description": "Excellent (low COD)"},
            "good": {"min": 10, "max": 20, "description": "Good quality"},
            "fair": {"min": 20, "max": 40, "description": "Fair quality"},
            "poor": {"min": 40, "max": 80, "description": "Poor quality"},
            "very_poor": {
                "min": 80,
                "max": float("inf"),
                "description": "Very poor (high COD)",
            },
        }
    elif "bod" in attr_lower:
        thresholds = {
            "excellent": {"min": 0, "max": 3, "description": "Excellent (low BOD)"},
            "good": {"min": 3, "max": 6, "description": "Good quality"},
            "fair": {"min": 6, "max": 12, "description": "Fair quality"},
            "poor": {"min": 12, "max": 25, "description": "Poor quality"},
            "very_poor": {
                "min": 25,
                "max": float("inf"),
                "description": "Very poor (high BOD)",
            },
        }
    elif "coliform" in attr_lower:
        thresholds = {
            "excellent": {"min": 0, "max": 1, "description": "No contamination"},
            "good": {"min": 1, "max": 10, "description": "Low contamination"},
            "fair": {"min": 10, "max": 100, "description": "Moderate contamination"},
            "poor": {"min": 100, "max": 1000, "description": "High contamination"},
            "very_poor": {
                "min": 1000,
                "max": float("inf"),
                "description": "Very high contamination",
            },
        }
    else:
        # Default thresholds for unknown parameters based on statistical distribution
        if statistics and "min" in statistics and "max" in statistics:
            data_min = statistics["min"]
            data_max = statistics["max"]
            data_range = data_max - data_min

            # Create percentile-based thresholds
            thresholds = {
                "excellent": {
                    "min": data_min,
                    "max": data_min + 0.2 * data_range,
                    "description": "Lowest 20%",
                },
                "good": {
                    "min": data_min + 0.2 * data_range,
                    "max": data_min + 0.4 * data_range,
                    "description": "20-40th percentile",
                },
                "fair": {
                    "min": data_min + 0.4 * data_range,
                    "max": data_min + 0.6 * data_range,
                    "description": "40-60th percentile",
                },
                "poor": {
                    "min": data_min + 0.6 * data_range,
                    "max": data_min + 0.8 * data_range,
                    "description": "60-80th percentile",
                },
                "very_poor": {
                    "min": data_min + 0.8 * data_range,
                    "max": data_max,
                    "description": "Highest 20%",
                },
            }
        else:
            # Fallback if no statistics available
            thresholds = {
                "unknown": {
                    "min": 0,
                    "max": float("inf"),
                    "description": "Quality assessment not available",
                }
            }

    return thresholds


@csrf_exempt
@api_view(["GET"])
@permission_classes([AllowAny])
def geoserver_health_check(request):
    """Health check endpoint for GeoServer connectivity"""
    try:
        geoserver = GeoServerManager()
        is_healthy = geoserver.test_connection()

        response_data = {
            "geoserver_healthy": is_healthy,
            "timestamp": int(time.time()),
            "config": {
                "workspace": GEOSERVER_CONFIG["workspace"],
                "external_url": GEOSERVER_CONFIG["external_url"],
            },
        }

        if not is_healthy:
            response_data["message"] = "GeoServer is not accessible"

        response = JsonResponse(response_data)
        response["Access-Control-Allow-Origin"] = "*"
        return response

    except Exception as e:
        response = JsonResponse(
            {"geoserver_healthy": False, "error": str(e), "timestamp": int(time.time())}
        )
        response["Access-Control-Allow-Origin"] = "*"
        return response


###############rough


# --------------------------------------------------------------------RAJKUMAR-----------------------------------------------------------------------------------------

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.transform import from_bounds
from rasterio.features import rasterize
from rasterio.crs import CRS
from rasterio.warp import transform_bounds
import tempfile
import os
from shapely.geometry import mapping
from scipy.spatial import cKDTree
import json
import requests
from requests.auth import HTTPBasicAuth
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rasterio.transform import from_origin
import math  # Added for ceil
import time  # Already used, but ensure for sleep
import traceback  # Already used
from pykrige.ok import OrdinaryKriging
import rasterio.mask


def create_sld_style(layer_name, color_stops):
    """Create SLD XML for color ramp styling with proper namespace"""

    sld_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0" 
    xmlns="http://www.opengis.net/sld" 
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <NamedLayer>
    <Name>{layer_name}</Name>
    <UserStyle>
      <Name>{layer_name}_style</Name>
      <Title>Color Ramp for {layer_name}</Title>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <Opacity>0.9</Opacity>
            <ColorMap type="ramp">
"""

    for stop in color_stops:
        sld_xml += f'              <ColorMapEntry color="{stop["color"]}" quantity="{stop["value"]}" label="{stop["label"]}"/>\n'

    sld_xml += """            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>"""

    return sld_xml


def get_parameter_color_scheme(attribute, vmin, vmax):
    """
    Perceptually uniform color schemes: Light (low values) -> Dark (high values)
    Each parameter has unique signature colors following luminance principles
    """
    vmean = (vmin + vmax) / 2

    parameter_colors = {
        # pH: Light Purple (acidic) -> Medium Cyan (neutral) -> Dark Orange (alkaline)
        "pH": [
            {"value": vmin, "color": "#E6D5FF", "label": f"Acidic: {vmin:.2f}"},
            {"value": vmean, "color": "#00CED1", "label": f"Mid: {vmean:.2f}"},
            {"value": vmax, "color": "#CC5500", "label": f"Alkaline: {vmax:.2f}"},
        ],
        # Temperature: Light Blue (cold) -> Yellow (moderate) -> Dark Magenta (warm)
        "Temperatur": [
            {"value": vmin, "color": "#B0E0E6", "label": f"Cold: {vmin:.1f}°C"},
            {"value": vmean, "color": "#FFD700", "label": f"Moderate: {vmean:.1f}°C"},
            {"value": vmax, "color": "#8B008B", "label": f"Warm: {vmax:.1f}°C"},
        ],
        # DO (Dissolved Oxygen): Light Green (low/bad) -> Yellow-Green -> Dark Green (high/good)
        "DO_mg_L_": [
            {"value": vmin, "color": "#F0FFF0", "label": f"Low: {vmin:.2f}"},
            {"value": vmean, "color": "#9ACD32", "label": f"Moderate: {vmean:.2f}"},
            {"value": vmax, "color": "#006400", "label": f"High: {vmax:.2f}"},
        ],
        # BOD: Light Teal (low/good) -> Orange -> Dark Maroon (high/bad)
        "BOD_mg_L_": [
            {"value": vmin, "color": "#AFEEEE", "label": f"Low: {vmin:.2f}"},
            {"value": vmean, "color": "#FF8C00", "label": f"Moderate: {vmean:.2f}"},
            {"value": vmax, "color": "#4B0000", "label": f"High: {vmax:.2f}"},
        ],
        # COD: Light Blue (low/good) -> Orange -> Dark Red (high/bad)
        "COD_mg_L_": [
            {"value": vmin, "color": "#ADD8E6", "label": f"Low: {vmin:.2f}"},
            {"value": vmean, "color": "#FFA500", "label": f"Moderate: {vmean:.2f}"},
            {"value": vmax, "color": "#800000", "label": f"High: {vmax:.2f}"},
        ],
        # Turbidity: Light Cyan (clear) -> Tan -> Dark Brown (murky)
        "Turbidity_": [
            {"value": vmin, "color": "#E0FFFF", "label": f"Clear: {vmin:.2f}"},
            {"value": vmean, "color": "#D2B48C", "label": f"Moderate: {vmean:.2f}"},
            {"value": vmax, "color": "#654321", "label": f"Turbid: {vmax:.2f}"},
        ],
        # TDS: Light Sky Blue (pure) -> Violet -> Dark Purple (contaminated)
        "TDS_mg_L_": [
            {"value": vmin, "color": "#E6F2FF", "label": f"Low: {vmin:.1f}"},
            {"value": vmean, "color": "#9370DB", "label": f"Moderate: {vmean:.1f}"},
            {"value": vmax, "color": "#4B0082", "label": f"High: {vmax:.1f}"},
        ],
        # EC (Conductivity): Light Steel Blue -> Yellow-Green -> Dark Red-Orange
        "EC__S_cm_": [
            {"value": vmin, "color": "#B0C4DE", "label": f"Low: {vmin:.1f}"},
            {"value": vmean, "color": "#9ACD32", "label": f"Moderate: {vmean:.1f}"},
            {"value": vmax, "color": "#CC3300", "label": f"High: {vmax:.1f}"},
        ],
        # Faecal Coliform: Light Lime (safe) -> Gold -> Dark Crimson (dangerous)
        "Faecal_Col": [
            {"value": vmin, "color": "#F0FFF0", "label": f"Safe: {vmin:.0f}"},
            {"value": vmean, "color": "#FFD700", "label": f"Moderate: {vmean:.0f}"},
            {"value": vmax, "color": "#8B0000", "label": f"Unsafe: {vmax:.0f}"},
        ],
        # Total Coliform: Pale Green (safe) -> Orange -> Dark Red (dangerous)
        "Total_Coli": [
            {"value": vmin, "color": "#E0FFE0", "label": f"Safe: {vmin:.0f}"},
            {"value": vmean, "color": "#FFA500", "label": f"Moderate: {vmean:.0f}"},
            {"value": vmax, "color": "#8B0000", "label": f"Unsafe: {vmax:.0f}"},
        ],
        "WQI": [
            {
                "value": vmin,
                "color": "#90EE90",
                "label": f"Better: {vmin:.1f}",
            },  # Light Green
            {
                "value": vmin + (vmax - vmin) * 0.33,
                "color": "#FFD700",
                "label": f"Moderate: {(vmin + (vmax - vmin) * 0.33):.1f}",
            },  # Yellow
            {
                "value": vmin + (vmax - vmin) * 0.67,
                "color": "#FF8C00",
                "label": f"Poor: {(vmin + (vmax - vmin) * 0.67):.1f}",
            },  # Orange
            {
                "value": vmax,
                "color": "#8B0000",
                "label": f"Worst: {vmax:.1f}",
            },  # Dark Red
        ],
        # Nitrate: Light Dodger Blue (low) -> Violet -> Dark Tomato (high)
        "Nitrate_mg": [
            {"value": vmin, "color": "#B0E2FF", "label": f"Low: {vmin:.2f}"},
            {"value": vmean, "color": "#BA55D3", "label": f"Moderate: {vmean:.2f}"},
            {"value": vmax, "color": "#CC3300", "label": f"High: {vmax:.2f}"},
        ],
        # Chloride: Pale Blue (low) -> Turquoise -> Dark Salmon (high)
        "Chloride_m": [
            {"value": vmin, "color": "#E0F2FF", "label": f"Low: {vmin:.1f}"},
            {"value": vmean, "color": "#40E0D0", "label": f"Moderate: {vmean:.1f}"},
            {"value": vmax, "color": "#CD5C5C", "label": f"High: {vmax:.1f}"},
        ],
        # TSS (Total Suspended Solids): Pale Aqua (clear) -> Khaki -> Dark Chocolate (contaminated)
        "TSS_mg_L_": [
            {"value": vmin, "color": "#E0FFFF", "label": f"Clear: {vmin:.1f}"},
            {"value": vmean, "color": "#F0E68C", "label": f"Moderate: {vmean:.1f}"},
            {"value": vmax, "color": "#5C3317", "label": f"High: {vmin:.1f}"},
        ],
        # TS (Total Solids): Light Cyan -> Goldenrod -> Dark Sienna
        "TS_mg_L_": [
            {"value": vmin, "color": "#E0FFFF", "label": f"Clear: {vmin:.1f}"},
            {"value": vmean, "color": "#DAA520", "label": f"Moderate: {vmean:.1f}"},
            {"value": vmax, "color": "#5C4033", "label": f"High: {vmax:.1f}"},
        ],
        # Hardness: Pale Royal Blue (soft) -> Plum -> Dark Crimson (hard)
        "Hardness_m": [
            {"value": vmin, "color": "#D4E4FF", "label": f"Soft: {vmin:.1f}"},
            {"value": vmean, "color": "#DDA0DD", "label": f"Moderate: {vmean:.1f}"},
            {"value": vmax, "color": "#8B0000", "label": f"Hard: {vmax:.1f}"},
        ],
        # ORP (Oxidation-Reduction Potential): Light Red (reducing) -> Yellow -> Dark Green (oxidizing)
        "ORP": [
            {"value": vmin, "color": "#FFB6C1", "label": f"Reducing: {vmin:.1f}"},
            {"value": vmean, "color": "#FFFF00", "label": f"Neutral: {vmean:.1f}"},
            {"value": vmax, "color": "#006400", "label": f"Oxidizing: {vmax:.1f}"},
        ],
    }

    # Default: Light blue -> Yellow -> Dark red (standard sequential ramp)
    return parameter_colors.get(
        attribute,
        [
            {"value": vmin, "color": "#FFFFCC", "label": f"Low: {vmin:.2f}"},
            {"value": vmean, "color": "#FD8D3C", "label": f"Medium: {vmean:.2f}"},
            {"value": vmax, "color": "#800026", "label": f"High: {vmax:.2f}"},
        ],
    )


def perform_interpolation(
    river_data,
    river_buffer_data,
    points_data,
    attribute,
    season,
    data_type,
    resolution,
    power=2,
    unique_id=None,
):
    """
    UPGRADED FUNCTION - Now matches the advanced script exactly with fixes for ArcGIS IDW alignment
    """
    start_time = time.time()
    try:
        # Step 1: Validate and convert inputs
        # Convert river data
        if isinstance(river_data, dict):
            if "type" in river_data and river_data["type"] == "FeatureCollection":
                river_gdf = gpd.GeoDataFrame.from_features(river_data["features"])
            else:
                river_gdf = gpd.GeoDataFrame.from_features(river_data)
        elif isinstance(river_data, gpd.GeoDataFrame):
            river_gdf = river_data
        else:
            raise ValueError("River data must be GeoJSON dict or GeoDataFrame")
        # Convert river buffer data
        if isinstance(river_buffer_data, dict):
            if (
                "type" in river_buffer_data
                and river_buffer_data["type"] == "FeatureCollection"
            ):
                river_buffer_gdf = gpd.GeoDataFrame.from_features(
                    river_buffer_data["features"]
                )
            else:
                river_buffer_gdf = gpd.GeoDataFrame.from_features(river_buffer_data)
        elif isinstance(river_buffer_data, gpd.GeoDataFrame):
            river_buffer_gdf = river_buffer_data
        else:
            raise ValueError("River buffer data must be GeoJSON dict or GeoDataFrame")
        # Convert points data
        if isinstance(points_data, dict):
            if "type" in points_data and points_data["type"] == "FeatureCollection":
                points_gdf = gpd.GeoDataFrame.from_features(points_data["features"])
            else:
                points_gdf = gpd.GeoDataFrame.from_features(points_data)
        elif isinstance(points_data, gpd.GeoDataFrame):
            points_gdf = points_data
        else:
            raise ValueError("Points data must be GeoJSON dict or GeoDataFrame")
        # Validation
        if len(river_buffer_gdf) == 0:
            raise ValueError("No river buffer data available")
        if len(points_gdf) == 0:
            raise ValueError("No water quality points available")
        if attribute not in points_gdf.columns:
            available_cols = list(points_gdf.columns)[:10]
            raise ValueError(
                f"Attribute '{attribute}' not found in points data. Available columns: {available_cols}"
            )
        points_gdf = points_gdf[points_gdf[attribute].notna()].copy()
        if len(points_gdf) == 0:
            raise ValueError(f"No valid data points found for attribute: {attribute}")

        # Convert attribute to numeric (handles string values like "42000")
        points_gdf[attribute] = pd.to_numeric(points_gdf[attribute], errors="coerce")
        points_gdf = points_gdf[points_gdf[attribute].notna()].copy()


        # Step 3: CRS handling
        if river_gdf.crs is None:
            river_gdf.set_crs("EPSG:4326", inplace=True)
        if river_buffer_gdf.crs is None:
            river_buffer_gdf.set_crs("EPSG:4326", inplace=True)
        if points_gdf.crs is None:
            points_gdf.set_crs("EPSG:4326", inplace=True)

        # Step 4: Automatic UTM zone detection
        centroid = river_buffer_gdf.geometry.unary_union.centroid
        utm_zone = int((centroid.x + 180) / 6) + 1
        utm_hemisphere = "north" if centroid.y >= 0 else "south"
        utm_crs = (
            f"EPSG:326{utm_zone}"
            if utm_hemisphere == "north"
            else f"EPSG:327{utm_zone}"
        )

        # Reproject to UTM
        river_buffer_proj = river_buffer_gdf.to_crs(utm_crs)
        points_proj = points_gdf.to_crs(utm_crs)

        # IDW Interpolation
        minx, miny, maxx, maxy = river_buffer_proj.total_bounds
        bounds = tuple(river_buffer_proj.total_bounds)
        cell_size = resolution
        x_coords = np.arange(minx, maxx, cell_size)
        y_coords = np.arange(miny, maxy, cell_size)
        grid_x, grid_y = np.meshgrid(x_coords, y_coords[::-1])
        coords = np.array([(geom.x, geom.y) for geom in points_proj.geometry])
        values = points_proj[attribute].astype(float).values
        k = min(12, len(coords))
        tree = cKDTree(coords)
        xi = np.column_stack([grid_x.ravel(), grid_y.ravel()])
        dists, idxs = tree.query(xi, k=k)
        dists[dists == 0] = 1e-10
        weights = 1 / (dists**power)
        vals = np.sum(weights * values[idxs], axis=1) / np.sum(weights, axis=1)
        idw_grid = vals.reshape(grid_x.shape)

        # Mask out cells outside buffer
        mask = rasterize(
            [(mapping(river_buffer_proj.unary_union), 1)],
            out_shape=idw_grid.shape,
            transform=from_origin(minx, maxy, cell_size, cell_size),
            fill=0,
            dtype=np.uint8,
        ).astype(bool)
        interpolated_grid = np.where(mask, idw_grid, np.nan)

        # Save raster
        temp_dir = tempfile.gettempdir()
        if unique_id:
            layer_name = (
                f"interp_{attribute}_{season}_{data_type}_{unique_id}".replace(" ", "_")
                .replace("(", "")
                .replace(")", "")
                .replace("/", "_")
            )
        else:
            unique_id = str(int(time.time()))
            layer_name = (
                f"interp_{attribute}_{season}_{data_type}_{unique_id}".replace(" ", "_")
                .replace("(", "")
                .replace(")", "")
                .replace("/", "_")
            )
        tiff_path = os.path.join(temp_dir, f"{layer_name}.tif")
        transform = from_origin(minx, maxy, cell_size, cell_size)
        with rasterio.open(
            tiff_path,
            "w",
            driver="GTiff",
            height=interpolated_grid.shape[0],
            width=interpolated_grid.shape[1],
            count=1,
            dtype=interpolated_grid.dtype,
            crs=utm_crs,
            transform=transform,
            nodata=-9999,
        ) as dst:
            output_array = np.where(
                np.isnan(interpolated_grid), -9999, interpolated_grid
            )
            dst.write(output_array, 1)

        # Clip raster with buffer outline
        with rasterio.open(tiff_path) as src:
            out_image, out_transform = rasterio.mask.mask(
                src, river_buffer_proj.geometry, crop=True, filled=True, nodata=-9999
            )
            out_meta = src.meta.copy()
            out_meta.update(
                {
                    "driver": "GTiff",
                    "height": out_image.shape[1],
                    "width": out_image.shape[2],
                    "transform": out_transform,
                    "nodata": -9999,
                }
            )
        clipped_tiff_path = os.path.join(temp_dir, f"{layer_name}_clipped.tif")
        with rasterio.open(clipped_tiff_path, "w", **out_meta) as dest:
            dest.write(out_image)
        tiff_path = clipped_tiff_path

        # GeoServer publishing
        auth = HTTPBasicAuth(GEOSERVER_USER, GEOSERVER_PASSWORD)
        workspace_url = f"{GEOSERVER_URL}/rest/workspaces/{WORKSPACE}.json"
        try:
            workspace_check = requests.get(workspace_url, auth=auth)
        except Exception as e:
            workspace_check = None
        if workspace_check is None or workspace_check.status_code == 404:
            create_ws_url = f"{GEOSERVER_URL}/rest/workspaces"
            ws_data = f'{{"workspace":{{"name":"{WORKSPACE}"}}}}'
            ws_response = requests.post(
                create_ws_url,
                data=ws_data,
                headers={"Content-Type": "application/json"},
                auth=auth,
            )
        upload_url = f"{GEOSERVER_URL}/rest/workspaces/{WORKSPACE}/coveragestores/{layer_name}/file.geotiff?configure=all"
        with open(tiff_path, "rb") as f:
            headers = {"Content-Type": "image/tiff"}
            response = requests.put(upload_url, data=f, headers=headers, auth=auth)
            if response.status_code not in [200, 201]:
                upload_url2 = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores/{layer_name}/external.geotiff?configure=all"
                with open(tiff_path, "rb") as f2:
                    response2 = requests.put(
                        upload_url2, data=f2, headers=headers, auth=auth
                    )
                    if response2.status_code not in [200, 201]:
                        store_xml = f"""<coverageStore>
                          <name>{layer_name}</name>
                          <workspace>{WORKSPACE}</workspace>
                          <enabled>true</enabled>
                          <type>GeoTIFF</type>
                          <url>file://{tiff_path}</url>
                        </coverageStore>"""
                        create_store_url = (
                            f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores"
                        )
                        store_response = requests.post(
                            create_store_url,
                            data=store_xml,
                            headers={"Content-Type": "application/xml"},
                            auth=auth,
                        )
                        if store_response.status_code not in [200, 201]:
                            raise Exception(
                                f"Failed to upload to GeoServer after trying all methods"
                            )
        
        # SLD Styling
        vmin = float(np.nanmin(interpolated_grid))
        vmax = float(np.nanmax(interpolated_grid))
        vmean = float(np.nanmean(interpolated_grid))

        # NEW CODE (USE THIS):
        color_stops = get_parameter_color_scheme(attribute, vmin, vmax)

        sld_body = create_sld_style(layer_name, color_stops)
        style_name = f"{layer_name}_style"
        try:
            delete_style_url = f"{GEOSERVER_URL}/rest/workspaces/{WORKSPACE}/styles/{style_name}?recurse=true&purge=true"
            delete_response = requests.delete(delete_style_url, auth=auth)
            
            time.sleep(0.5)
            create_style_url = f"{GEOSERVER_URL}/rest/workspaces/{WORKSPACE}/styles"
            style_json = {
                "style": {"name": style_name, "filename": f"{style_name}.sld"}
            }
            create_response = requests.post(
                create_style_url,
                json=style_json,
                headers={"Content-Type": "application/json"},
                auth=auth,
            )
            if create_response.status_code not in [200, 201]:
                upload_sld_url = (
                    f"{GEOSERVER_URL}/rest/workspaces/{WORKSPACE}/styles/{style_name}"
                )
                sld_response = requests.put(
                    upload_sld_url,
                    data=sld_body,
                    headers={"Content-Type": "application/vnd.ogc.sld+xml"},
                    auth=auth,
                )
                if sld_response.status_code not in [200, 201]:
                    raise Exception(
                        f"Failed to update style: {sld_response.status_code}"
                    )
            else:
                upload_sld_url = (
                    f"{GEOSERVER_URL}/rest/workspaces/{WORKSPACE}/styles/{style_name}"
                )
                sld_response = requests.put(
                    upload_sld_url,
                    data=sld_body,
                    headers={"Content-Type": "application/vnd.ogc.sld+xml"},
                    auth=auth,
                )
                if sld_response.status_code not in [200, 201]:
                    raise Exception(f"Failed to upload SLD: {sld_response.status_code}")
            apply_style_url = f"{GEOSERVER_URL}/rest/layers/{WORKSPACE}:{layer_name}"
            style_config = {
                "layer": {"defaultStyle": {"name": style_name, "workspace": WORKSPACE}}
            }
            apply_response = requests.put(
                apply_style_url,
                json=style_config,
                headers={"Content-Type": "application/json"},
                auth=auth,
            )
        except Exception as e:
            import traceback

            traceback.print_exc()
            style_name = ""

        # Return response
        from rasterio.warp import transform_bounds

        extent_4326 = transform_bounds(utm_crs, "EPSG:4326", *bounds)
        return {
            "status": "success",
            "message": "ADVANCED Interpolation completed successfully",
            "wms_url": f"{wms_base_url}/{WORKSPACE}/wms",
            "primary_layer": f"{WORKSPACE}:{layer_name}",
            "style_name": style_name if style_name else "",
            "extent": list(extent_4326),
            "statistics": {
                "min": float(vmin),
                "max": float(vmax),
                "mean": float(vmean),
                "std": float(np.nanstd(interpolated_grid)),
            },
            "color_stops": color_stops,
            "processing_info": {
                "utm_crs": str(utm_crs),
                "utm_zone": int(utm_zone),
                "resolution": int(resolution),
                "k_neighbors": int(k),
                "power": int(power),
                "valid_points": int(len(points_gdf)),
                "grid_cells": int(grid_x.size),
                "masked_cells": int(mask.sum()),
            },
            "individual_layers": [
                {
                    "name": layer_name,
                    "crs": str(utm_crs),
                    "styled": bool(style_name),
                    "style_name": style_name if style_name else "",
                    "color_stops": color_stops,
                    "statistics": {
                        "min": float(vmin),
                        "max": float(vmax),
                        "mean": float(vmean),
                    },
                }
            ],
        }
    except Exception as e:
        import traceback

        traceback.print_exc()
        return {
            "status": "error",
            "message": f"ADVANCED Interpolation failed: {str(e)}",
        }


@csrf_exempt
@require_http_methods(["POST"])
def optimized_idw_interpolation(request, attribute, data_type, season):
    """
    Enhanced interpolation with internal data fetching for stretch-based analysis
    Industry Standard: Service Layer Pattern Implementation
    """
    try:
        # Parse request body
        data = json.loads(request.body)
        unique_id = str(uuid.uuid4())[:8]

        # Branch based on data_type
        if data_type == "stretchbased":
            
            # For stretch-based: expect Stretch_ID and points_data only
            stretch_ids = data.get("Stretch_ID", [])
            points_data = data.get("points_data")

            if not stretch_ids:
                return JsonResponse(
                    {
                        "status": "error",
                        "message": "No Stretch_IDs provided for stretch-based analysis",
                    },
                    status=400,
                )

            if not points_data:
                return JsonResponse(
                    {
                        "status": "error",
                        "message": "No water quality points data provided",
                    },
                    status=400,
                )

            # Fetch stretch line geometries using service layer
            river_data = get_stretch_lines_service(stretch_ids)
            if not river_data:
                return JsonResponse(
                    {
                        "status": "error",
                        "message": "Failed to fetch stretch line geometries",
                    },
                    status=500,
                )

            # Fetch river buffer data using service layer
            river_buffer_data = get_river_buffer_service(stretch_ids)
            if not river_buffer_data:
                return JsonResponse(
                    {"status": "error", "message": "Failed to fetch river buffer data"},
                    status=500,
                )


        else:
            # For subdist-based: expect all data from frontend (existing logic)
            # print(f"Processing subdist-based interpolation for {attribute}, {season}")

            river_data = data.get("river_data")
            river_buffer_data = data.get("river_buffer_data")
            points_data = data.get("points_data")

            if not river_data:
                return JsonResponse(
                    {"status": "error", "message": "No river data provided"}, status=400
                )

            if not river_buffer_data:
                return JsonResponse(
                    {"status": "error", "message": "No river buffer data provided"},
                    status=400,
                )

            if not points_data:
                return JsonResponse(
                    {
                        "status": "error",
                        "message": "No water quality points data provided",
                    },
                    status=400,
                )

        # Call the perform_interpolation function (unchanged)
        result = perform_interpolation(
            river_data=river_data,
            river_buffer_data=river_buffer_data,
            points_data=points_data,
            attribute=attribute,
            season=season,
            data_type=data_type,
            resolution=30,
            power=2,
            unique_id=unique_id,
        )

        return JsonResponse(result)

    except Exception as e:
        import traceback

        traceback.print_exc()
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


# ==========================================
# SERVICE LAYER - Pure Business Logic Functions
# ==========================================


def get_stretch_lines_service(stretch_ids):
    """
    Service function to get stretch line geometries
    Industry Standard: Pure function with no HTTP dependencies
    """
    try:
        shp_path = os.path.join(
            settings.MEDIA_ROOT, "rwm_data", "stretch_shp", "stretch.shp"
        )

        if not os.path.exists(shp_path):
            return None

        gdf = gpd.read_file(shp_path)
        if stretch_ids:
            # Use existing filtering function
            filtered_gdf = load_stretch_lines(stretch_ids)
            if not filtered_gdf.empty:
                gdf = filtered_gdf
            else:
                return None

        # Ensure proper CRS
        if gdf.crs != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        # Convert to GeoJSON
        geojson_str = gdf.to_json()
        return json.loads(geojson_str)

    except Exception as e:
        return None


def get_river_buffer_service(stretch_ids):
    """
    Service function to get river buffer data
    Industry Standard: Pure function with no HTTP dependencies
    """
    try:
        shapefile_path = os.path.join(
            settings.MEDIA_ROOT, "rwm_data", "RIVER_BUFFER100M_SHP"
        )
        shapefile_full_path = os.path.join(shapefile_path, "River_buffer_100m.shp")

        if not os.path.exists(shapefile_full_path):
            return None

        gdf = gpd.read_file(shapefile_full_path)
        gdf = gdf.to_crs("EPSG:4326")

        if stretch_ids:

            if "Stretch_ID" in gdf.columns:
                try:
                    stretch_ids_int = [int(sid) for sid in stretch_ids]
                    gdf = gdf[gdf["Stretch_ID"].isin(stretch_ids_int)]
                except ValueError:
                    gdf = gdf[
                        gdf["Stretch_ID"]
                        .astype(str)
                        .isin([str(sid) for sid in stretch_ids])
                    ]
            else:
                return None

        if len(gdf) == 0:
            return None

        return json.loads(gdf.to_json())

    except Exception as e:
        return None


def batch_interpolation_internal(
    river_data,
    river_buffer_data,
    subdist_data,
    points_data,
    attributes,
    season,
    subdistrict_codes,
):
    """
    INTERNAL: Batch interpolation + map generation
    """
    try:
        # Convert GeoJSON to GeoDataFrames for map generation
        river_gdf = gpd.GeoDataFrame.from_features(
            river_data["features"], crs="EPSG:4326"
        )
        buffer_gdf = gpd.GeoDataFrame.from_features(
            river_buffer_data["features"], crs="EPSG:4326"
        )
        subdist_gdf = gpd.GeoDataFrame.from_features(
            subdist_data["features"], crs="EPSG:4326"
        )

        # Fix subdist CRS if needed
        bounds_check = subdist_gdf.total_bounds
        if abs(bounds_check[0]) > 180:
            subdist_gdf = subdist_gdf.set_crs("EPSG:32644", allow_override=True).to_crs(
                "EPSG:4326"
            )

        results = []
        successful_count = 0
        failed_count = 0

        for idx, attribute in enumerate(attributes):
           

            try:
                # Step 1: Run interpolation (creates raster, saves to temp file)
                result = perform_interpolation(
                    river_data=river_data,
                    river_buffer_data=river_buffer_data,
                    points_data=points_data,
                    attribute=attribute,
                    season=season,
                    data_type="subdistbased",
                    resolution=30,
                    power=2,
                )

                result["attribute"] = attribute
                result["index"] = idx
                color_stops = result.get("color_stops", [])

                if result.get("status") == "success":
                    # Step 2: Generate map from the saved raster
                    # Get raster file path from temp directory
                    temp_dir = tempfile.gettempdir()
                    layer_name = (
                        f"interp_{attribute}_{season}_subdistbased".replace(" ", "_")
                        .replace("(", "")
                        .replace(")", "")
                        .replace("/", "_")
                    )
                    tiff_path = os.path.join(temp_dir, f"{layer_name}_clipped.tif")

                    # Get UTM CRS from result
                    utm_crs = result["processing_info"]["utm_crs"]

                    # Generate map
                    map_result = generate_map_from_raster(
                        tiff_path=tiff_path,
                        attribute=attribute,
                        river_gdf=river_gdf,
                        buffer_gdf=buffer_gdf,
                        subdist_gdf=subdist_gdf,
                        utm_crs=utm_crs,
                        color_stops=color_stops,
                    )

                    # Add map to result
                    result["map_image"] = map_result

                    successful_count += 1
                else:
                    failed_count += 1

                results.append(result)

            except Exception as e:
                failed_count += 1
                results.append(
                    {
                        "status": "error",
                        "attribute": attribute,
                        "index": idx,
                        "message": str(e),
                    }
                )

        return {
            "status": "success" if successful_count > 0 else "error",
            "summary": {
                "total_attributes": len(attributes),
                "successful": successful_count,
                "failed": failed_count,
                "season": season,
            },
            "results": results,
        }

    except Exception as e:
        return {"status": "error", "message": f"Batch interpolation failed: {str(e)}"}


def generate_map_from_raster(
    tiff_path, attribute, river_gdf, buffer_gdf, subdist_gdf, utm_crs, color_stops=None
):
    """
    Generate styled map with lat-long gridlines and zoomed-out view.
    Blue-edge artifacts removed.
    """
    display_name = BACKEND_PARAMETER_DISPLAY_NAMES.get(attribute, attribute)
    try:

        import rasterio
        import contextily as ctx
        from matplotlib.colors import LinearSegmentedColormap
        from rasterio.warp import (
            transform_bounds,
            reproject,
            Resampling,
            calculate_default_transform,
        )
        import matplotlib.pyplot as plt
        import numpy as np
        import io, base64
        from matplotlib import patheffects

        # 1. Read raster
        with rasterio.open(tiff_path) as src:
            raster_data = src.read(1)
            raster_bounds = src.bounds
            raster_crs = src.crs
            raster_data = np.ma.masked_equal(raster_data, -9999)
            raster_data = np.ma.masked_invalid(raster_data)

            if raster_data.count() == 0:
                raise ValueError("No valid raster data")

            vmin, vmax, vmean = (
                float(raster_data.min()),
                float(raster_data.max()),
                float(raster_data.mean()),
            )

        # 2. Bounds in mercator
        bounds_4326 = transform_bounds(raster_crs, "EPSG:4326", *raster_bounds)
        bounds_merc = transform_bounds("EPSG:4326", "EPSG:3857", *bounds_4326)
        minx_merc, miny_merc, maxx_merc, maxy_merc = bounds_merc

        # 3. Zoom-out buffer
        extent_size = max(maxx_merc - minx_merc, maxy_merc - miny_merc)
        if extent_size < 5000:  # ~5km
            buffer_factor = 0.05  # 5% buffer for very small areas
        elif extent_size < 20000:  # ~20km
            buffer_factor = 0.08  # 8% buffer
        else:
            buffer_factor = 0.15  # 15% buffer for large areas

        x_buffer = (maxx_merc - minx_merc) * buffer_factor
        y_buffer = (maxy_merc - miny_merc) * buffer_factor

        # buffer_factor = 0.15
        # x_buffer = (maxx_merc - minx_merc) * buffer_factor
        # y_buffer = (maxy_merc - miny_merc) * buffer_factor

        # 4. Figure setup - FIXED BOX APPROACH
        # Use a consistent, well-proportioned figure size
        fig_width = 10
        fig_height = 8  # Fixed height for consistency

        fig, ax = plt.subplots(figsize=(fig_width, fig_height), dpi=50)

        font_scale = 1.0  # Keep fonts consistent
        base_tick_size = 8
        base_label_size = 9
        scaled_tick_size = base_tick_size
        scaled_label_size = base_label_size

        # Add extra bottom margin for colorbar/legend
        bottom_pad = 0.22
        plt.subplots_adjust(bottom=bottom_pad, left=0.12, right=0.93, top=0.95)

        fig.patch.set_facecolor("white")

        # Calculate the extent to fit the data properly
        data_width_merc = maxx_merc - minx_merc
        data_height_merc = maxy_merc - miny_merc
        data_aspect = data_width_merc / data_height_merc

        # Get the axes aspect (width/height in display coordinates)
        # The subplot adjustments give us the usable area
        ax_width = fig_width * (0.93 - 0.12)  # right - left
        ax_height = fig_height * (0.95 - bottom_pad)  # top - bottom
        ax_aspect = ax_width / ax_height

        # Adjust the extent to fit within the axes while maintaining data aspect ratio
        if data_aspect > ax_aspect:
            # Data is wider - fit to width, add vertical padding
            display_width = data_width_merc + 2 * x_buffer
            display_height = display_width / ax_aspect
            extra_y_padding = (display_height - data_height_merc - 2 * y_buffer) / 2
            y_buffer += extra_y_padding
        else:
            # Data is taller - fit to height, add horizontal padding
            display_height = data_height_merc + 2 * y_buffer
            display_width = display_height * ax_aspect
            extra_x_padding = (display_width - data_width_merc - 2 * x_buffer) / 2
            x_buffer += extra_x_padding

        ax.set_xlim(minx_merc - x_buffer, maxx_merc + x_buffer)
        ax.set_ylim(miny_merc - y_buffer, maxy_merc + y_buffer)

        ax.set_xlabel("Longitude", fontsize=scaled_label_size)
        ax.set_ylabel("Latitude", fontsize=scaled_label_size)
        ax.set_aspect("equal", adjustable="box")

        # 5. Basemap
        try:
            ctx.add_basemap(
                ax,
                crs="EPSG:3857",
                source=ctx.providers.Esri.WorldImagery,
                zoom="auto",
                attribution=False,
            )
        except Exception as e:
            ax.set_facecolor("white")

        # 6. Convert layers
        river_merc = (
            river_gdf.to_crs("EPSG:3857")
            if (river_gdf is not None and not river_gdf.empty)
            else None
        )
        buffer_merc = (
            buffer_gdf.to_crs("EPSG:3857")
            if (buffer_gdf is not None and not buffer_gdf.empty)
            else None
        )
        subdist_merc = subdist_gdf.to_crs("EPSG:3857")

        # 7. Reproject raster (with nodata handling)
        with rasterio.open(tiff_path) as src:
            dst_crs = "EPSG:3857"
            transform_merc, width_merc_px, height_merc_px = calculate_default_transform(
                src.crs, dst_crs, src.width, src.height, *src.bounds
            )

            raster_merc = np.empty((height_merc_px, width_merc_px), dtype=np.float32)

            reproject(
                source=src.read(1),
                destination=raster_merc,
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=transform_merc,
                dst_crs=dst_crs,
                resampling=Resampling.nearest,
                src_nodata=-9999,
                dst_nodata=np.nan,
            )

            raster_merc = np.ma.masked_invalid(raster_merc)
            raster_merc = np.ma.masked_less_equal(raster_merc, 0)

            bounds_merc_raster = transform_bounds(src.crs, "EPSG:3857", *src.bounds)
            extent_merc = [
                bounds_merc_raster[0],
                bounds_merc_raster[2],
                bounds_merc_raster[1],
                bounds_merc_raster[3],
            ]

            # colors = ['#0000FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF6600', '#FF0000']
            # cmap = LinearSegmentedColormap.from_list('vivid', colors, N=256)

            # NEW (USE THIS):
            if color_stops and len(color_stops) > 0:
               
                colors = [stop["color"] for stop in color_stops]
                cmap = LinearSegmentedColormap.from_list(
                    f"{attribute}_cmap", colors, N=256
                )
            else:
                colors = ["#FFFFCC", "#FD8D3C", "#800026"]
                cmap = LinearSegmentedColormap.from_list("default", colors, N=256)

            cmap.set_bad(color="none", alpha=0)

            im = ax.imshow(
                raster_merc,
                extent=extent_merc,
                origin="upper",
                cmap=cmap,
                alpha=1.0,
                vmin=vmin,
                vmax=vmax,
                zorder=6,
                interpolation="bilinear",
                rasterized=True,
            )

        # 8. Overlay boundaries and rivers
        if buffer_merc is not None and not buffer_merc.empty:
            buffer_merc.boundary.plot(ax=ax, color="white", linewidth=0.6, zorder=5)
        if river_merc is not None and not river_merc.empty:
            river_merc.plot(ax=ax, color="#00FF00", linewidth=1, zorder=5)
        subdist_merc.boundary.plot(ax=ax, color="#4B0082", linewidth=1.2, zorder=4)

        # 9. Add latitude–longitude grid
        ax.tick_params(axis="both", colors="black", labelsize=scaled_tick_size)

        # Convert ticks to lat–lon - USE ACTUAL AXIS LIMITS (including padding)
        current_xlim = ax.get_xlim()
        current_ylim = ax.get_ylim()

        xticks_merc = np.linspace(current_xlim[0], current_xlim[1], 6)
        yticks_merc = np.linspace(current_ylim[0], current_ylim[1], 6)

        from pyproj import Transformer

        transformer = Transformer.from_crs("EPSG:3857", "EPSG:4326", always_xy=True)
        xticks_lon, _ = transformer.transform(xticks_merc, np.zeros_like(xticks_merc))
        _, yticks_lat = transformer.transform(np.zeros_like(yticks_merc), yticks_merc)

        ax.set_xticks(xticks_merc)
        ax.set_yticks(yticks_merc)
        ax.set_xticklabels([f"{lon:.2f}°E" for lon in xticks_lon])
        ax.set_yticklabels([f"{lat:.2f}°N" for lat in yticks_lat])

        # Save image cleanly
        # Save the map (without colorbar)
        buffer_io_map = io.BytesIO()
        plt.savefig(
            buffer_io_map,
            format="png",
            dpi=300,
            bbox_inches="tight",
            facecolor="white",
            pad_inches=0.2,
        )
        buffer_io_map.seek(0)
        image_base64_map = base64.b64encode(buffer_io_map.read()).decode("utf-8")

        import matplotlib as mpl

        fig_leg, ax_leg = plt.subplots(
            figsize=(6, 0.8)
        )  # wide & short box for colorbar
        fig_leg.patch.set_facecolor("white")
        fig_leg.subplots_adjust(bottom=0.45, top=0.65, left=0.1, right=0.9)

        norm = mpl.colors.Normalize(vmin=vmin, vmax=vmax)
        cb = mpl.colorbar.ColorbarBase(
            ax_leg, cmap=cmap, norm=norm, orientation="horizontal"
        )
        cb.outline.set_visible(False)
        cb.set_ticks([])
        cb.set_label(
            f"{display_name} Levels",
            fontsize=12,
            weight="bold",
            color="black",
            labelpad=10,
        )

        # Add min/max value labels at ends (optional but helpful)
        ax_leg.text(
            0,
            -0.5,
            f"{vmin:.1f}",
            ha="left",
            va="top",
            fontsize=10,
            transform=ax_leg.transAxes,
        )
        ax_leg.text(
            1,
            -0.5,
            f"{vmax:.1f}",
            ha="right",
            va="top",
            fontsize=10,
            transform=ax_leg.transAxes,
        )

        buffer_io_leg = io.BytesIO()
        fig_leg.savefig(
            buffer_io_leg,
            format="png",
            dpi=300,
            bbox_inches="tight",
            facecolor="white",
            pad_inches=0.1,
        )
        buffer_io_leg.seek(0)
        image_base64_leg = base64.b64encode(buffer_io_leg.read()).decode("utf-8")
        plt.close(fig_leg)

        return {
            "success": True,
            "map_image": f"data:image/png;base64,{image_base64_map}",
            "legend_image": f"data:image/png;base64,{image_base64_leg}",
            "attribute": display_name,
            "statistics": {"min": vmin, "max": vmax, "mean": vmean},
        }

    except Exception as e:
        # print(f"    ❌ Failed: {str(e)}")
        import traceback

        traceback.print_exc()
        if "fig" in locals():
            plt.close(fig)
        return {"success": False, "error": str(e), "attribute": display_name}


from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import csrf_exempt
import json
from .tasks import submit_batch_interpolation_job
from main.celery import (
    app,
)  # Make sure this import is correct for your folder structure
from celery.result import AsyncResult


@csrf_exempt
@api_view(["POST", "GET"])
@permission_classes([AllowAny])          # <-- removes 401
@authentication_classes([])       
def start_pdf_report_job(request):
    """
    NEW ASYNC ENDPOINT - Replaces synchronous generate_pdf_report_data()

    Submits interpolation job to Celery and returns immediately

    Request body: Same as before (attributes, points_data, season, data_type, etc.)
    Response: 202 Accepted with job_id
    """
    
    try:
        data = json.loads(request.body)

        # Extract parameters
        attributes = data.get("attributes", [])
        # points_data = data.get("points_data")
        season = data.get("season", "premonsoon")
        data_type = data.get("data_type", "subdistbased")
            
            
        # Load river data based on data_type
        if data_type == "subdistbased":
            subdistrict_codes = data.get("subdistrict_codes", [])

            river_gdf = load_and_clip_rivers(subdistrict_codes)
            buffer_gdf = load_and_clip_river_buffer(subdistrict_codes, True)

            # Load boundaries from GeoServer
            geoserver_wfs_url = f"{GEOSERVER_URL}/{WORKSPACE}/ows"
            codes_str = ",".join(f"'{code}'" for code in subdistrict_codes)

            params = {
                "service": "WFS",
                "version": "1.0.0",
                "request": "GetFeature",
                "typeName": f"{WORKSPACE}:B_subdistrict",
                "outputFormat": "application/json",
                "CQL_FILTER": f"SUBDIS_COD IN ({codes_str})",
            }

            auth = (GEOSERVER_USER, GEOSERVER_PASSWORD)
            boundary_response = requests.get(
                geoserver_wfs_url, params=params, auth=auth, timeout=30
            )
            boundary_geojson = boundary_response.json()

            identifier_codes = subdistrict_codes

        elif data_type == "stretchbased":
            stretch_ids = data.get("stretch_ids", [])

            river_geojson = get_stretch_lines_service(stretch_ids)
            river_gdf = gpd.GeoDataFrame.from_features(
                river_geojson["features"], crs="EPSG:4326"
            )

            buffer_geojson = get_river_buffer_service(stretch_ids)
            buffer_gdf = gpd.GeoDataFrame.from_features(
                buffer_geojson["features"], crs="EPSG:4326"
            )

            # Fetch basin boundary
            geoserver_wfs_url = f"{GEOSERVER_URL}/{WORKSPACE}/ows"
            params = {
                "service": "WFS",
                "version": "1.0.0",
                "request": "GetFeature",
                "typeName": f"{WORKSPACE}:basin_boundary",
                "outputFormat": "application/json",
            }

            auth = (GEOSERVER_USER, GEOSERVER_PASSWORD)
            boundary_response = requests.get(
                geoserver_wfs_url, params=params, auth=auth, timeout=30
            )
            boundary_geojson = (
                boundary_response.json()
                if boundary_response.status_code == 200
                else buffer_geojson
            )

            identifier_codes = stretch_ids
            
            
        points_gdf = get_points_shapefile_gdf(
        data_type=data_type,
        season=season,
        sub_district_codes=subdistrict_codes if data_type == "subdistbased" else None,
        stretch_ids=stretch_ids if data_type == "stretchbased" else None,
        )
        
        points_data = json.loads(points_gdf.to_json())
            
        # SUBMIT CELERY JOB (non-blocking, returns immediately)
        celery_result = submit_batch_interpolation_job.delay(
            attributes=attributes,
            river_data=json.loads(river_gdf.to_json()),
            river_buffer_data=json.loads(buffer_gdf.to_json()),
            subdist_data=boundary_geojson,
            points_data=points_data,
            season=season,
            data_type=data_type,
            identifier_codes=identifier_codes,
        )
        
        chord_job_id = celery_result.id

        return Response(
            {
                "status": "processing",
                "job_id": str(chord_job_id),
                "message": f"Processing {len(attributes)} attributes in parallel...",
                "status_url": f"/rwm/job-status/{chord_job_id}/",
                "result_url": f"/rwm/job-result/{chord_job_id}/",
            },
            status=status.HTTP_202_ACCEPTED,
        )

    except Exception as e:
        # logger.error(f"❌ Job submission failed: {str(e)}")
        import traceback

        traceback.print_exc()

        return Response(
            {"status": "error", "message": str(e), "traceback": traceback.format_exc()},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@csrf_exempt
@api_view(["POST", "GET"])
@permission_classes([AllowAny])          # <-- removes 401
@authentication_classes([])       
def get_job_status(request, job_id):
    """
    Poll job status and progress

    Returns:
    {
        "status": "processing|completed|failed",
        "progress": {"completed": 8, "total": 17, "percentage": 47}
    }
    """

    try:
        task_result = AsyncResult(job_id, app=app)

        if task_result.state == "PENDING":
            response = {
                "job_id": job_id,
                "status": "pending",
                "progress": {"completed": 0, "total": 0},
            }
        elif task_result.state == "PROGRESS":
            response = {
                "job_id": job_id,
                "status": "processing",
                "progress": task_result.info,
            }
        elif task_result.state == "SUCCESS":
            response = {
                "job_id": job_id,
                "status": "completed",
                "result": task_result.result,
            }
        elif task_result.state == "FAILURE":
            response = {
                "job_id": job_id,
                "status": "failed",
                "error": str(task_result.info),
            }
        else:
            response = {"job_id": job_id, "status": task_result.state.lower()}

        return Response(response, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@api_view(["POST", "GET"])
@permission_classes([AllowAny])          # <-- removes 401
@authentication_classes([])       
def get_job_result(request, job_id):
    """
    Get final results once job is completed
    """

    try:
        task_result = AsyncResult(job_id, app=app)

        if task_result.state == "SUCCESS":
            return Response(
                {"status": "completed", "data": task_result.result},
                status=status.HTTP_200_OK,
            )
        elif task_result.state == "FAILURE":
            return Response(
                {"status": "failed", "error": str(task_result.info)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        else:
            return Response(
                {"status": "processing", "state": task_result.state},
                status=status.HTTP_202_ACCEPTED,
            )

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@csrf_exempt
@api_view(["POST", "GET"])
@permission_classes([AllowAny])          # <-- removes 401
@authentication_classes([])      
def cancel_job(request, job_id):
    cache.set(f"user_active_{job_id}", False, timeout=3600)
    revoke_remaining_tasks(job_id)
    return JsonResponse({"status": "cancelled", "job_id": job_id})




from django.core.cache import cache

def revoke_remaining_tasks(job_id):
    """
    Kill all running subtasks for a job, using the stored group_id.
    """
    group_id = cache.get(f"group_for_{job_id}")
    if not group_id:
        # logger.warning(f"No group_id found for job {job_id}; nothing to revoke")
        return

    group_result = GroupResult.restore(group_id)
    if not group_result:
        # logger.warning(f"GroupResult not found for group_id {group_id}")
        return

    for t in group_result.results:
        try:
            # logger.info(f"Revoking task {t.id} for job {job_id}")
            current_app.control.revoke(t.id, terminate=True, signal="SIGKILL")
        except Exception as e:
            # logger.error(f"Failed to revoke task {t.id}: {e}")
            pass

