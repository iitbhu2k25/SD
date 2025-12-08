import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny 

class HGStationDataAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        station_code = request.data.get("stationCode")
        start_date = request.data.get("startDate")
        end_date = request.data.get("endDate")

        if not station_code or not start_date or not end_date:
            return Response(
                {"error": "stationCode, startDate, and endDate are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        url = "https://ffs.india-water.gov.in/web-api/getHGStationDataForFFS/"

        payload = {
            "stationCode": station_code,
            "startDate": start_date,
            "endDate": end_date
        }

        try:
            response = requests.post(url, json=payload, timeout=20)

            # If API returns non-200 → error
            if response.status_code != 200:
                return Response(
                    {
                        "error": "External API returned an error",
                        "status_code": response.status_code,
                        "details": response.text
                    },
                    status=status.HTTP_502_BAD_GATEWAY
                )

            # Try parsing JSON safely
            try:
                data = response.json()
            except ValueError:
                # ⭐ External API returned 200 but invalid/empty body → return success with empty data
                return Response(
                    {"message": "External API returned no valid data", "data": []},
                    status=status.HTTP_200_OK
                )

            # If JSON is valid but empty/null
            if not data or data is None:
                return Response(
                    {"message": "External API returned no data", "data": []},
                    status=status.HTTP_200_OK
                )

            return Response(data, status=status.HTTP_200_OK)

        except requests.exceptions.RequestException:
            # ONLY in case of timeout, DNS failure, or no connection
            return Response(
                {"error": "Failed to reach external API"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
