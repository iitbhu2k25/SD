# views.py (Django DRF)
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.db.models import Q
from .models import ClimateDrain
import io
import base64
import logging
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime

logger = logging.getLogger(__name__)

def render_climate_png_multi(points, sub_id, scenario, start_year, end_year, width=1200, height=420, dpi=140):
    # points: list of dicts {year, mon, flow_in, flow_out}
    dates = [datetime(p["year"], p["mon"], 1) for p in points]
    inflow = [p["flow_in"] for p in points]
    outflow = [p["flow_out"] for p in points]

    fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
    ax.plot(dates, inflow, color="#2563eb", linewidth=2, marker="o", markersize=3, label="Inflow")
    ax.plot(dates, outflow, color="#dc2626", linewidth=2, marker="o", markersize=3, label="Outflow")

    ax.set_xlabel("Year-Month")
    ax.set_ylabel("Flow (cms)")

    # Major ticks every 3 months, format YYYY‑MMM
    ax.xaxis.set_major_locator(mdates.MonthLocator(interval=3))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%b"))

    ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
    ax.set_title(f"Subbasin {sub_id}, Scenario {scenario}, Years {start_year}-{end_year}")
    ax.legend(loc="best")
    fig.autofmt_xdate()

    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("utf-8")

class ClimateChangeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            sub_ids = request.data.get('sub_ids', [])
            scenario = int(request.data.get('scenario', 585))
            year = request.data.get('year')  # keep for backward compatibility
            start_year = request.data.get('start_year')
            end_year = request.data.get('end_year')

            # Normalize year inputs: if single year given, use as both start/end
            if start_year is None and end_year is None and year is not None:
                start_year = int(year)
                end_year = int(year)
            elif start_year is not None and end_year is None:
                start_year = int(start_year)
                end_year = int(start_year)
            elif start_year is None and end_year is not None:
                end_year = int(end_year)
                start_year = int(end_year)
            else:
                start_year = int(start_year or 2021)
                end_year = int(end_year or start_year)

            if not sub_ids:
                return Response({"error": "No subbasin IDs provided"}, status=status.HTTP_400_BAD_REQUEST)

            if scenario not in [126, 245, 370, 585]:
                return Response({"error": "Invalid scenario. Must be one of: 126, 245, 370, 585"}, status=status.HTTP_400_BAD_REQUEST)

            if end_year < start_year:
                return Response({"error": "end_year must be >= start_year"}, status=status.HTTP_400_BAD_REQUEST)

            results = {}
            for sub_id in sub_ids:
                try:
                    qs = ClimateDrain.objects.filter(
                        sub=sub_id,
                        rch=scenario,
                        year__gte=start_year,
                        year__lte=end_year
                    ).order_by('year', 'mon')

                    if not qs.exists():
                        results[f"{sub_id}_{scenario}"] = {
                            "error": f"No data found for subbasin {sub_id}, scenario {scenario}, years {start_year}-{end_year}"
                        }
                        continue

                    points = []
                    area_km2 = None
                    for rec in qs:
                        if area_km2 is None:
                            area_km2 = float(rec.areakm2)
                        points.append({
                            "year": int(rec.year),
                            "mon": int(rec.mon),
                            "flow_in": float(rec.flow_incms),
                            "flow_out": float(rec.flow_outcms),
                        })

                    # Compute summary
                    total_inflow = sum(p["flow_in"] for p in points)
                    total_outflow = sum(p["flow_out"] for p in points)
                    net_flow = total_inflow - total_outflow

                    # Per-year summaries
                    per_year = {}
                    for y in range(start_year, end_year + 1):
                        y_points = [p for p in points if p["year"] == y]
                        if not y_points:
                            continue
                        ti = sum(p["flow_in"] for p in y_points)
                        to = sum(p["flow_out"] for p in y_points)
                        per_year[str(y)] = {
                            "total_inflow": round(ti, 3),
                            "total_outflow": round(to, 3),
                            "net_flow": round(ti - to, 3),
                            "avg_monthly_inflow": round(ti / max(1, len(y_points)), 3),
                            "avg_monthly_outflow": round(to / max(1, len(y_points)), 3),
                        }

                    # x_index for frontend (0..N-1)
                    for idx, p in enumerate(points):
                        p["x_index"] = idx

                    image_base64 = render_climate_png_multi(points, sub_id, scenario, start_year, end_year)

                    results[f"{sub_id}_{scenario}"] = {
                        "subbasin_id": sub_id,
                        "scenario": scenario,
                        "start_year": start_year,
                        "end_year": end_year,
                        "data": {
                            "points": points,  # [{year, mon, flow_in, flow_out, x_index}]
                            "area_km2": area_km2 or 0
                        },
                        "summary": {
                            "total_inflow": round(total_inflow, 3),
                            "total_outflow": round(total_outflow, 3),
                            "net_flow": round(net_flow, 3),
                            "avg_monthly_inflow": round(total_inflow / max(1, len(points)), 3),
                            "avg_monthly_outflow": round(total_outflow / max(1, len(points)), 3),
                            "per_year": per_year
                        },
                        "image_base64": image_base64
                    }

                except Exception as e:
                    logger.error(f"Error processing subbasin {sub_id}: {str(e)}")
                    results[f"{sub_id}_{scenario}"] = {"error": f"Error processing subbasin {sub_id}: {str(e)}"}

            return Response(results, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Climate API error: {str(e)}")
            return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ClimateScenarioComparisonView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            sub_ids = request.data.get('sub_ids', [])
            scenarios = request.data.get('scenarios', [126, 245, 370, 585])
            start_year = int(request.data.get('start_year', 2021))
            end_year = int(request.data.get('end_year', start_year))

            if not sub_ids:
                return Response({"error": "No subbasin IDs provided"}, status=status.HTTP_400_BAD_REQUEST)
            if end_year < start_year:
                return Response({"error": "end_year must be >= start_year"}, status=status.HTTP_400_BAD_REQUEST)

            results = {}

            for sub_id in sub_ids:
                for scenario in scenarios:
                    try:
                        qs = ClimateDrain.objects.filter(
                            sub=sub_id, rch=scenario,
                            year__gte=start_year, year__lte=end_year
                        ).order_by('year', 'mon')

                        if not qs.exists():
                            results[f"{sub_id}_{scenario}"] = {
                                "error": f"No data found for subbasin {sub_id}, scenario {scenario}, years {start_year}-{end_year}"
                            }
                            continue

                        points = []
                        area_km2 = None
                        for rec in qs:
                            if area_km2 is None:
                                area_km2 = float(rec.areakm2)
                            points.append({
                                "year": int(rec.year),
                                "mon": int(rec.mon),
                                "flow_in": float(rec.flow_incms),
                                "flow_out": float(rec.flow_outcms),
                            })

                        total_inflow = sum(p["flow_in"] for p in points)
                        total_outflow = sum(p["flow_out"] for p in points)
                        net_flow = total_inflow - total_outflow

                        per_year = {}
                        for y in range(start_year, end_year + 1):
                            y_points = [p for p in points if p["year"] == y]
                            if not y_points:
                                continue
                            ti = sum(p["flow_in"] for p in y_points)
                            to = sum(p["flow_out"] for p in y_points)
                            per_year[str(y)] = {
                                "total_inflow": round(ti, 3),
                                "total_outflow": round(to, 3),
                                "net_flow": round(ti - to, 3),
                                "avg_monthly_inflow": round(ti / max(1, len(y_points)), 3),
                                "avg_monthly_outflow": round(to / max(1, len(y_points)), 3),
                            }

                        for idx, p in enumerate(points):
                            p["x_index"] = idx

                        image_base64 = render_climate_png_multi(points, sub_id, scenario, start_year, end_year)

                        results[f"{sub_id}_{scenario}"] = {
                            "subbasin_id": sub_id,
                            "scenario": scenario,
                            "start_year": start_year,
                            "end_year": end_year,
                            "data": {
                                "points": points,
                                "area_km2": area_km2 or 0
                            },
                            "summary": {
                                "total_inflow": round(total_inflow, 3),
                                "total_outflow": round(total_outflow, 3),
                                "net_flow": round(net_flow, 3),
                                "avg_monthly_inflow": round(total_inflow / max(1, len(points)), 3),
                                "avg_monthly_outflow": round(total_outflow / max(1, len(points)), 3),
                                "per_year": per_year
                            },
                            "image_base64": image_base64
                        }

                    except Exception as e:
                        logger.error(f"Error processing subbasin {sub_id}, scenario {scenario}: {str(e)}")
                        results[f"{sub_id}_{scenario}"] = {
                            "error": f"Error processing subbasin {sub_id}, scenario {scenario}: {str(e)}"
                        }

            return Response(results, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Climate comparison API error: {str(e)}")
            return Response({"error": f"Internal server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
