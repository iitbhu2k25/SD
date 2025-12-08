# views/surfacewater.py

import numpy as np
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from .models import SubbasinFlow
from collections import defaultdict

# NEW: imports for image generation
import io
import base64
import matplotlib
matplotlib.use("Agg")  # headless, PNG-capable backend for servers
import matplotlib.pyplot as plt


class SurplusRunoffAPI(APIView):
    """
    API to calculate surplus runoff (Q25 method) from SubbasinFlow model.
    Supports multiple subbasins in a single request.
    Uses multi-year average flows (2021-2023) for reliability.
    """

    parser_classes = [JSONParser]
    permission_classes = [AllowAny]

    def flow_duration_curve(self, flows, percentile):
        """Return discharge at given exceedance percentile from sorted flows."""
        flows = np.array(flows)
        flows = flows[~np.isnan(flows)]  # drop NaN
        flows = flows[flows >= 0]        # drop negatives

        if len(flows) == 0:
            return 0.0

        flows_sorted = np.sort(flows)[::-1]  # descending
        N = len(flows_sorted)
        ranks = np.arange(1, N + 1)
        exceed_prob = ranks / (N + 1) * 100
        return float(np.interp(percentile, exceed_prob, flows_sorted))

    # NEW: server-side PNG renderer for a subbasin's averaged timeseries
    def render_timeseries_png(self, timeseries, q25, sub_id, width=1000, height=420, dpi=140):
        """
        timeseries: list of dicts with keys 'day' and 'flow'
        q25: float or None
        """
        days = [int(p['day']) for p in timeseries]
        flows = [float(p['flow']) for p in timeseries]

        fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
        ax.plot(days, flows, color="#2563eb", linewidth=2, label=f"Subbasin {sub_id} Avg Flow")
        ax.set_xlabel("Day of Year")
        ax.set_ylabel("Flow (cms)")
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)

        if q25 is not None:
            ax.axhline(y=q25, color="#dc2626", linestyle="--", linewidth=2, label="Q25 Threshold")

        ax.set_title("Surface Water Surplus Analysis")
        ax.legend(loc="best")
        fig.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=dpi, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def post(self, request):
        try:
            subbasins = request.data.get("subbasins")  # expect a list like [1,2,3]

            if not subbasins:
                return JsonResponse({"error": "subbasins parameter is required"}, status=400)

            # Normalize input to a list of integers
            if isinstance(subbasins, str):  # e.g. "1,2,3"
                subbasins = [int(s) for s in subbasins.split(",")]
            elif isinstance(subbasins, int):
                subbasins = [subbasins]
            else:
                subbasins = [int(s) for s in subbasins]

            results = {}

            for sub in subbasins:
                qs = SubbasinFlow.objects.filter(sub=sub).order_by("year", "yyyyddd")
                if not qs.exists():
                    results[sub] = {"error": f"No flow data found for subbasin {sub}"}
                    continue

                # Group data by year
                yearly_data = defaultdict(list)
                for row in qs:
                    yearly_data[row.year].append({
                        'day_of_year': row.yyyyddd % 1000,
                        'flow': float(row.flow_out_cms) if row.flow_out_cms is not None else 0.0
                    })

                years = sorted(yearly_data.keys())
                expected_years = [2021, 2022, 2023]
                years_to_use = [y for y in expected_years if y in years] or years

                # Daily averages across years
                daily_flows = defaultdict(list)
                for year in years_to_use:
                    for entry in yearly_data[year]:
                        daily_flows[entry['day_of_year']].append(entry['flow'])

                averaged_data = []
                for day_of_year in sorted(daily_flows.keys()):
                    valid_flows = [f for f in daily_flows[day_of_year] if f is not None and f >= 0]
                    if valid_flows:
                        averaged_data.append({
                            'day': int(day_of_year),
                            'flow': float(np.mean(valid_flows))
                        })

                if not averaged_data:
                    results[sub] = {"error": f"No valid data for subbasin {sub}"}
                    continue

                # Calculate Q25
                all_avg_flows = [entry['flow'] for entry in averaged_data]
                Q25 = self.flow_duration_curve(all_avg_flows, 25)

                # Calculate surplus runoff
                surplus_flows = []
                total_surplus_volume_m3 = 0.0
                for entry in averaged_data:
                    surplus = max(0, entry['flow'] - Q25)
                    surplus_flows.append(surplus)
                    total_surplus_volume_m3 += surplus * 86400  # per day

                surplus_volume_Mm3 = total_surplus_volume_m3 / 1e6

                # NEW: render PNG and attach to response
                image_b64 = self.render_timeseries_png(averaged_data, Q25, sub_id=sub)

                results[sub] = {
                    "subbasin": sub,
                    "years": years_to_use,
                    "total_years_available": len(years),
                    "Q25_cms": round(float(Q25), 3),
                    "surplus_runoff_Mm3": round(float(surplus_volume_Mm3), 3),
                    "statistics": {
                        "max_flow": round(float(np.max(all_avg_flows)), 3),
                        "min_flow": round(float(np.min(all_avg_flows)), 3),
                        "mean_flow": round(float(np.mean(all_avg_flows)), 3),
                        "surplus_days": int(sum(1 for s in surplus_flows if s > 0)),
                        "total_data_points": len(averaged_data),
                    },
                    "timeseries": [
                        {"day": entry['day'], "flow": round(entry['flow'], 3)}
                        for entry in averaged_data
                    ],
                    "image_base64": image_b64,  # NEW
                }

            return JsonResponse(results, safe=False)

        except Exception as e:
            import traceback
            print(f"Error in SurplusRunoffAPI: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({"error": f"Internal server error: {str(e)}"}, status=500)
