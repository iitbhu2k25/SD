# views/adminsurplus.py

import numpy as np
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from collections import defaultdict
from ..models import AdminFlow

# PNG rendering imports
import io
import base64
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


class VillageSurplusAPI(APIView):
    """
    API to calculate surplus runoff (Q25 method) at the village level.
    Input: subdistrict_codes OR vlcode (only one allowed)
    Returns: Q25, surplus runoff, stats, timeseries (NO image).
    """

    parser_classes = [JSONParser]
    permission_classes = [AllowAny]

    def flow_duration_curve(self, flows, percentile):
        """Return discharge at given exceedance percentile from sorted flows."""
        flows = np.array(flows)
        flows = flows[~np.isnan(flows)]
        flows = flows[flows >= 0]

        if len(flows) == 0:
            return 0.0

        flows_sorted = np.sort(flows)[::-1]
        N = len(flows_sorted)
        ranks = np.arange(1, N + 1)
        exceed_prob = ranks / (N + 1) * 100
        return float(np.interp(percentile, exceed_prob, flows_sorted))

    def post(self, request):
        try:
            subdistrict_codes = request.data.get("subdistrict_codes")
            vlcodes = request.data.get("vlcode")

            # Exclusivity check
            if not subdistrict_codes and not vlcodes:
                return JsonResponse({"error": "Either subdistrict_codes or vlcode is required"}, status=400)
            if subdistrict_codes and vlcodes:
                return JsonResponse(
                    {"error": "Please provide only one of subdistrict_codes or vlcode, not both"},
                    status=400,
                )

            # Normalize inputs
            if isinstance(subdistrict_codes, str):
                subdistrict_codes = [c.strip() for c in subdistrict_codes.split(",") if c.strip()]
            if isinstance(vlcodes, str):
                vlcodes = [v.strip() for v in vlcodes.split(",") if v.strip()]

            final_results = {}
            errors = {}

            # -------------------------------
            # Case 1: Handle subdistrict mode
            # -------------------------------
            if subdistrict_codes:
                for subdistrict_code in subdistrict_codes:
                    qs = AdminFlow.objects.filter(subdistrict_code_id=subdistrict_code).order_by("year", "mon")
                    if not qs.exists():
                        errors[subdistrict_code] = f"No data found for subdistrict {subdistrict_code}"
                        continue

                    results = self.process_villages(qs)
                    final_results[subdistrict_code] = results

            # -------------------------------
            # Case 2: Handle single village mode
            # -------------------------------
            elif vlcodes:
                for vlcode in vlcodes:
                    qs = AdminFlow.objects.filter(vlcode=vlcode).order_by("year", "mon")
                    if not qs.exists():
                        errors[str(vlcode)] = f"No data found for village code {vlcode}"
                        continue

                    results = self.process_villages(qs)
                    final_results[str(vlcode)] = results

            return JsonResponse(
                {
                    "subdistrict_codes": subdistrict_codes,
                    "vlcodes": vlcodes,
                    "results": final_results,
                    "errors": errors or None,
                },
                safe=False,
            )

        except Exception as e:
            import traceback
            print(f"Error in VillageSurplusAPI: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({"error": f"Internal server error: {str(e)}"}, status=500)

    # -----------------------------------------
    # Shared village processing logic
    # -----------------------------------------
    def process_villages(self, qs):
        results = {}
        village_groups = defaultdict(list)

        for row in qs:
            village_groups[(row.vlcode, row.village)].append({
                "year": row.year,
                "month": row.mon,
                "flow": float(row.surq_cnt_m3) if row.surq_cnt_m3 is not None else 0.0,
            })

        for (vlcode, village), records in village_groups.items():
            monthly_flows = defaultdict(list)
            for r in records:
                monthly_flows[r["month"]].append(r["flow"])

            averaged_data = []
            for m in sorted(monthly_flows.keys()):
                vals = [f for f in monthly_flows[m] if f is not None and f >= 0]
                if vals:
                    averaged_data.append({"month": m, "flow": float(np.mean(vals))})

            if not averaged_data:
                results[vlcode] = {"error": f"No valid data for {village} ({vlcode})"}
                continue

            all_flows = [e["flow"] for e in averaged_data]
            Q25 = self.flow_duration_curve(all_flows, 25)

            surplus_flows = []
            total_surplus_m3 = 0.0
            for e in averaged_data:
                surplus = max(0, e["flow"] - Q25)
                surplus_flows.append(surplus)
                total_surplus_m3 += surplus * 30 * 86400  # convert to m³

            surplus_Mm3 = total_surplus_m3 / 1e6

            results[vlcode] = {
                "vlcode": vlcode,
                "village": village,
                "Q25_m3": round(float(Q25), 3),
                "surplus_runoff_Mm3": round(float(surplus_Mm3), 3),
                "statistics": {
                    "max_flow": round(float(np.max(all_flows)), 3),
                    "min_flow": round(float(np.min(all_flows)), 3),
                    "mean_flow": round(float(np.mean(all_flows)), 3),
                    "surplus_months": int(sum(1 for s in surplus_flows if s > 0)),
                    "total_data_points": len(averaged_data),
                },
                "timeseries": [
                    {"month": e["month"], "flow": round(e["flow"], 3)} for e in averaged_data
                ],
            }

        return results


class VillageSurplusImageAPI(APIView):
    """
    API to generate PNG image for a single village (vlcode).
    Accepts only 'vlcode', rejects 'subdistrict_codes' if passed.
    """

    permission_classes = [AllowAny]

    def render_village_png(self, timeseries, q25, vlcode, village, width=1000, height=420, dpi=140):
        """Generate PNG chart for a village timeseries."""
        months = [int(p['month']) for p in timeseries]
        flows = [float(p['flow']) for p in timeseries]

        fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
        ax.plot(months, flows, color="#16a34a", linewidth=2, marker="o",
                label=f"{village} ({vlcode}) Flow")
        ax.set_xlabel("Month")
        ax.set_ylabel("Flow (m³)")
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)

        if q25 is not None:
            ax.axhline(y=q25, color="#dc2626", linestyle="--", linewidth=2, label="Q25 Threshold")

        ax.set_title("Village Surplus Runoff Analysis")
        ax.legend(loc="best")
        fig.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=dpi, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def post(self, request):
        subdistrict_codes = request.data.get("subdistrict_codes")
        vlcode = request.data.get("vlcode")

        # Exclusivity check
        if not vlcode and not subdistrict_codes:
            return JsonResponse({"error": "vlcode is required"}, status=400)
        if subdistrict_codes and vlcode:
            return JsonResponse({"error": "Please provide only vlcode, not both parameters"}, status=400)
        if not vlcode:
            return JsonResponse({"error": "vlcode is required"}, status=400)

        qs = AdminFlow.objects.filter(vlcode=vlcode).order_by("year", "mon")
        if not qs.exists():
            return JsonResponse({"error": f"No data found for vlcode {vlcode}"}, status=404)

        village = qs.first().village
        village_groups = defaultdict(list)
        for row in qs:
            village_groups[(row.vlcode, row.village)].append({
                "year": row.year,
                "month": row.mon,
                "flow": float(row.surq_cnt_m3) if row.surq_cnt_m3 is not None else 0.0,
            })

        # Only one village for this vlcode
        (_, _), records = list(village_groups.items())[0]

        monthly_flows = defaultdict(list)
        for r in records:
            monthly_flows[r["month"]].append(r["flow"])

        averaged_data = []
        for m in sorted(monthly_flows.keys()):
            vals = [f for f in monthly_flows[m] if f is not None and f >= 0]
            if vals:
                averaged_data.append({"month": m, "flow": float(np.mean(vals))})

        if not averaged_data:
            return JsonResponse({"error": f"No valid data for village {village} ({vlcode})"}, status=404)

        all_flows = [e["flow"] for e in averaged_data]
        Q25 = VillageSurplusAPI().flow_duration_curve(all_flows, 25)

        image_b64 = self.render_village_png(averaged_data, Q25, vlcode, village)

        return JsonResponse({
            "vlcode": vlcode,
            "village": village,
            "Q25_m3": round(float(Q25), 3),
            "image_base64": image_b64
        })
