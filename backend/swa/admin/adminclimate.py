# views/climate_admin.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.db.models import Sum
from ..models import ClimateAdmin
import io
import base64
import logging
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime

logger = logging.getLogger(__name__)


def render_climate_admin_png(points, village, sd_code, source_id, start_year, end_year, width=1200, height=420, dpi=140):
    """Render line chart for one village timeseries."""
    dates = [datetime(p["year"], p["mon"], 1) for p in points]
    runoff = [p["surq_cnt_m3"] for p in points]

    fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
    ax.plot(dates, runoff, color="#16a34a", linewidth=2, marker="o", markersize=3, label=f"{village} Runoff")

    ax.set_xlabel("Year-Month")
    ax.set_ylabel("Surface Runoff (m³)")

    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=3))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%b"))

    ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
    ax.set_title(f"{village} | Subdistrict {sd_code}, Source {source_id}, Years {start_year}-{end_year}")
    ax.legend(loc="best")
    fig.autofmt_xdate()

    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")


class ClimateAdminView(APIView):
    """Optimized API for surface runoff data (aggregated at DB level)."""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            subdistrict_codes = request.data.get("subdistrict_codes", [])
            vlcodes = request.data.get("vlcodes", [])
            source_id = request.data.get("source_id")
            start_year = int(request.data.get("start_year", 2021))
            end_year = int(request.data.get("end_year", start_year))

            # Validation
            if subdistrict_codes and vlcodes:
                return Response(
                    {"error": "Provide either subdistrict_codes or vlcodes, not both."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not subdistrict_codes and not vlcodes:
                return Response(
                    {"error": "Either subdistrict_codes or vlcodes must be provided."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if source_id is None:
                return Response({"error": "No source_id provided"}, status=status.HTTP_400_BAD_REQUEST)

            if end_year < start_year:
                return Response({"error": "end_year must be >= start_year"}, status=status.HTTP_400_BAD_REQUEST)

            results = {}

            # --- Mode 1: By Subdistrict ---
            if subdistrict_codes:
                for sd_code in subdistrict_codes:
                    try:
                        qs = (
                            ClimateAdmin.objects.filter(
                                subdistrict_code_id=sd_code,
                                source_id=source_id,
                                year__gte=start_year,
                                year__lte=end_year,
                            )
                            .values("vlcode", "village", "year", "mon")
                            .annotate(runoff=Sum("surq_cnt_m3"))
                            .order_by("vlcode", "year", "mon")
                        )

                        if not qs.exists():
                            results[f"{sd_code}_{source_id}"] = {
                                "error": f"No data found for subdistrict {sd_code}, source {source_id}, years {start_year}-{end_year}"
                            }
                            continue

                        villages = {}
                        for row in qs:
                            vlcode = row["vlcode"]
                            vname = row["village"]
                            if vlcode not in villages:
                                villages[vlcode] = {"village": vname, "points": []}
                            villages[vlcode]["points"].append({
                                "year": row["year"],
                                "mon": row["mon"],
                                "surq_cnt_m3": float(row["runoff"])
                            })

                        for vlcode, vdata in villages.items():
                            points = vdata["points"]
                            total_runoff = sum(p["surq_cnt_m3"] for p in points)

                            per_year = {}
                            for y in range(start_year, end_year + 1):
                                y_points = [p for p in points if p["year"] == y]
                                if not y_points:
                                    continue
                                total = sum(p["surq_cnt_m3"] for p in y_points)
                                per_year[str(y)] = {
                                    "total_runoff": round(total, 3),
                                    "avg_monthly_runoff": round(total / len(y_points), 3),
                                }

                            results[f"{sd_code}_{source_id}_{vlcode}"] = {
                                "subdistrict_code": sd_code,
                                "source_id": source_id,
                                "vlcode": vlcode,
                                "village": vdata["village"],
                                "start_year": start_year,
                                "end_year": end_year,
                                "data": {"points": points},
                                "summary": {
                                    "total_runoff": round(total_runoff, 3),
                                    "avg_monthly_runoff": round(total_runoff / max(1, len(points)), 3),
                                    "per_year": per_year,
                                },
                            }

                    except Exception as e:
                        logger.error(f"Error processing subdistrict {sd_code}, source {source_id}: {str(e)}")
                        results[f"{sd_code}_{source_id}"] = {
                            "error": f"Error processing subdistrict {sd_code}: {str(e)}"
                        }

            # --- Mode 2: By Village codes ---
            elif vlcodes:
                for vlcode in vlcodes:
                    try:
                        qs = (
                            ClimateAdmin.objects.filter(
                                vlcode=vlcode,
                                source_id=source_id,
                                year__gte=start_year,
                                year__lte=end_year,
                            )
                            .values("subdistrict_code_id", "village", "year", "mon")
                            .annotate(runoff=Sum("surq_cnt_m3"))
                            .order_by("year", "mon")
                        )

                        if not qs.exists():
                            results[f"{vlcode}_{source_id}"] = {
                                "error": f"No data found for village {vlcode}, source {source_id}, years {start_year}-{end_year}"
                            }
                            continue

                        sd_code = qs.first()["subdistrict_code_id"]
                        vname = qs.first()["village"]

                        points = [
                            {"year": row["year"], "mon": row["mon"], "surq_cnt_m3": float(row["runoff"])}
                            for row in qs
                        ]

                        total_runoff = sum(p["surq_cnt_m3"] for p in points)

                        per_year = {}
                        for y in range(start_year, end_year + 1):
                            y_points = [p for p in points if p["year"] == y]
                            if not y_points:
                                continue
                            total = sum(p["surq_cnt_m3"] for p in y_points)
                            per_year[str(y)] = {
                                "total_runoff": round(total, 3),
                                "avg_monthly_runoff": round(total / len(y_points), 3),
                            }

                        results[f"{sd_code}_{source_id}_{vlcode}"] = {
                            "subdistrict_code": sd_code,
                            "source_id": source_id,
                            "vlcode": vlcode,
                            "village": vname,
                            "start_year": start_year,
                            "end_year": end_year,
                            "data": {"points": points},
                            "summary": {
                                "total_runoff": round(total_runoff, 3),
                                "avg_monthly_runoff": round(total_runoff / max(1, len(points)), 3),
                                "per_year": per_year,
                            },
                        }

                    except Exception as e:
                        logger.error(f"Error processing village {vlcode}, source {source_id}: {str(e)}")
                        results[f"{vlcode}_{source_id}"] = {
                            "error": f"Error processing village {vlcode}: {str(e)}"
                        }

            return Response(results, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"ClimateAdmin API error: {str(e)}")
            return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class ClimateAdminImageView(APIView):
    """Returns PNG chart for one village based on vlcode and year range."""
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            vlcode = request.data.get("vlcode")
            source_id = request.data.get("source_id")
            start_year = int(request.data.get("start_year", 2021))
            end_year = int(request.data.get("end_year", start_year))

            if not vlcode:
                return Response({"error": "vlcode is required"}, status=400)
            if not source_id:
                return Response({"error": "source_id is required"}, status=400)
            if end_year < start_year:
                return Response({"error": "end_year must be >= start_year"}, status=400)

            qs = (
                ClimateAdmin.objects.filter(
                    vlcode=vlcode,
                    source_id=source_id,
                    year__gte=start_year,
                    year__lte=end_year
                )
                .values("village", "year", "mon")
                .annotate(runoff=Sum("surq_cnt_m3"))
                .order_by("year", "mon")
            )

            if not qs.exists():
                return Response({"error": f"No data found for vlcode {vlcode}, source {source_id}"}, status=404)

            village_name = qs[0]["village"]
            points = [
                {"year": row["year"], "mon": row["mon"], "surq_cnt_m3": float(row["runoff"])}
                for row in qs
            ]

            image_b64 = render_climate_admin_png(points, village_name, "N/A", source_id, start_year, end_year)

            return Response(
                {
                    "vlcode": vlcode,
                    "village": village_name,
                    "source_id": source_id,
                    "start_year": start_year,
                    "end_year": end_year,
                    "image_base64": image_b64,
                },
                status=200,
            )

        except Exception as e:
            logger.error(f"ClimateAdminImageView error: {str(e)}")
            return Response({"error": f"Internal server error: {str(e)}"}, status=500)
