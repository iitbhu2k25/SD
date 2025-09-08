from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import Well
from .serializers import WellSerializer
from .interpolation import InterpolateRasterView
from .trend import GroundwaterTrendAnalysisView
from .forecast import GroundwaterForecastView
from .recharge2 import GroundwaterRechargeView
from .upload_temp import CSVUploadView
from .validate import CSVValidationView
from .trends import GroundwaterTrendAnalysisView
from .catchment import VillagesByCatchmentFileAPI
from .crops import GetCropsBySeasonView

from django.conf import settings
from django.contrib.gis.gdal import DataSource
from django.contrib.gis.geos import GEOSGeometry
import os




class WellsAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request, format=None):
        # Accept both raw list and object payloads for backward compatibility
        if isinstance(request.data, list):
            village_codes = request.data
            subdis_codes = []
        else:
            village_codes = request.data.get('village_code', [])
            subdis_codes = request.data.get('subdis_cod', [])

        if not village_codes and not subdis_codes:
            return Response({"error": "village_code or subdis_cod is required"}, status=status.HTTP_400_BAD_REQUEST)

        wells = Well.objects.all()

        if village_codes:
            if isinstance(village_codes, int):
                village_codes = [village_codes]
            wells = wells.filter(village_code__in=village_codes)

        if subdis_codes:
            if isinstance(subdis_codes, int):
                subdis_codes = [subdis_codes]
            wells = wells.filter(SUBDIS_COD__in=subdis_codes)

        serial = WellSerializer(wells, many=True)
        sorted_data = sorted(serial.data, key=lambda x: x['HYDROGRAPH'])
        return Response(sorted_data, status=status.HTTP_200_OK)
    


import os
import pandas as pd
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from Basic.models import Population_2011, Basic_village
from django.conf import settings


class PopulationForecastAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            village_codes = request.data.get("village_code")
            subdistrict_codes = request.data.get("subdistrict_code")
            csv_filename = request.data.get("csv_filename")  # 🔹 new field
            lpcd = request.data.get("lpcd", 60)  # default 60

            if not csv_filename:
                return Response({"error": "csv_filename is required"}, status=status.HTTP_400_BAD_REQUEST)

            # 🔹 Build path
            csv_path = os.path.join(settings.MEDIA_ROOT, "temp", csv_filename)

            if not os.path.exists(csv_path):
                return Response({"error": f"CSV file '{csv_filename}' not found in temp"}, status=status.HTTP_404_NOT_FOUND)

            # 🔹 Load CSV and detect maximum year
            df = pd.read_csv(csv_path)
            year_cols = [col for col in df.columns if col.upper().startswith(("PRE_", "POST_"))]

            if not year_cols:
                return Response({"error": "CSV does not contain PRE_ / POST_ year columns"}, status=status.HTTP_400_BAD_REQUEST)

            # Extract years from column names
            years = [int(col.split("_")[1]) for col in year_cols if "_" in col]
            if not years:
                return Response({"error": "No valid year columns found in CSV"}, status=status.HTTP_400_BAD_REQUEST)

            target_year = max(years)  # 🔹 maximum year

            # ensure lpcd is numeric
            try:
                lpcd = float(lpcd)
            except ValueError:
                return Response({"error": "lpcd must be a number"}, status=status.HTTP_400_BAD_REQUEST)

            # 🔹 Collect all villages
            villages = []
            if village_codes:
                if not isinstance(village_codes, list):
                    return Response({"error": "village_code must be a list"}, status=status.HTTP_400_BAD_REQUEST)
                villages = Basic_village.objects.filter(village_code__in=village_codes)

            elif subdistrict_codes:
                if not isinstance(subdistrict_codes, list):
                    return Response({"error": "subdistrict_code must be a list"}, status=status.HTTP_400_BAD_REQUEST)
                villages = Basic_village.objects.filter(subdistrict_code_id__in=subdistrict_codes)

            else:
                return Response({"error": "Provide either village_code or subdistrict_code"}, status=status.HTTP_400_BAD_REQUEST)

            if not villages.exists():
                return Response({"error": "No villages found for given input"}, status=status.HTTP_404_NOT_FOUND)

            results = []
            base_year = 2011

            for village in villages:
                try:
                    sub = Population_2011.objects.get(subdistrict_code=village.subdistrict_code_id)
                except Population_2011.DoesNotExist:
                    results.append({
                        "village_code": village.village_code,
                        "error": "Subdistrict data not found"
                    })
                    continue

                # Historical populations
                p1, p2, p3, p4, p5, p6, p7 = (
                    sub.population_1951, sub.population_1961, sub.population_1971,
                    sub.population_1981, sub.population_1991, sub.population_2001,
                    sub.population_2011
                )

                # Decadal differences
                d1, d2, d3, d4, d5, d6 = (p2-p1, p3-p2, p4-p3, p5-p4, p6-p5, p7-p6)
                d_mean = (d1+d2+d3+d4+d5+d6) / 6
                m_mean = ((d2-d1) + (d3-d2) + (d4-d3) + (d5-d4) + (d6-d5)) / 5

                # Ratio k
                k = village.population_2011 / p7

                # Years difference
                n = (target_year - base_year) / 10

                # Forecast
                forecast = int(
                    village.population_2011 +
                    (k * n * d_mean) +
                    (k * (n * (n + 1)) * m_mean / 2)
                )

                # 🔹 Demand calculation (MLD)
                demand = round(((forecast * lpcd) / 1000)*365, 3)

                results.append({
                    "village_code": village.village_code,
                    "village_name": village.village_name,
                    "subdistrict_code": village.subdistrict_code_id,
                    "base_year": base_year,
                    "target_year": target_year,   # 🔹 from CSV
                    "population_2011": village.population_2011,
                    "forecast_population": forecast,
                    "lpcd": lpcd,
                    "demand_mld": demand
                })

            return Response({"forecasts": results})

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
