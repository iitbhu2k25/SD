# views/eflow.py (or your existing file where EflowAPI lives)

from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from .models import SubbasinFlow
import numpy as np
import pandas as pd

# NEW: image generation imports
import io
import base64
import matplotlib
matplotlib.use("Agg")  # server-safe PNG backend
import matplotlib.pyplot as plt


class EflowAPI(APIView):
    permission_classes = [AllowAny]

    # NEW: render one method’s monthly flow curve with threshold
    def render_method_png(self, days, flows, threshold, sub_id, method_key, width=1000, height=420, dpi=140):
        
        x = np.array(days, dtype=float)
        y = np.array(flows, dtype=float)

        fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
        # Line + markers
        ax.plot(x, y, color="#2563eb", linewidth=2, marker="o", markersize=4, label="Monthly flow")
        ax.set_xlabel("Month")
        ax.set_ylabel("Flow (cms)")
        ax.set_xlim(1, 12)
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)

        # Threshold
        if threshold is not None and np.isfinite(threshold):
            ax.axhline(y=float(threshold), color="#7c3aed", linestyle="--", linewidth=2, label=f"{method_key} threshold")

        ax.set_title(f"Eflow: {method_key} • Subbasin {sub_id}")
        ax.legend(loc="best")
        fig.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=dpi, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def post(self, request):
        # Get list of subbasin IDs from request
        sub_ids = request.data.get('sub_ids', [])
        if not sub_ids:
            return JsonResponse({"error": "sub_ids is required"}, status=400)

        all_results = {}

        for sub_id in sub_ids:
            qs = SubbasinFlow.objects.filter(sub=sub_id)
            if not qs.exists():
                continue

            df = pd.DataFrame.from_records(
                qs.values('sub', 'year', 'month', 'flow_out_cms')
            )

            # Monthly averages
            daily_avg = df.groupby('month')['flow_out_cms'].mean().reset_index()
            flows = daily_avg['flow_out_cms'].values
            days = daily_avg['month'].values

            # Methods computations
            Qmaf = np.mean(flows)

            # FDC helper
            flows_sorted = np.sort(flows)[::-1]
            N = len(flows_sorted)
            ranks = np.arange(1, N+1)
            prob = ranks / (N+1) * 100

            def flow_duration_curve(flows_sorted, prob, exceed_prob):
                return float(np.interp(exceed_prob, prob, flows_sorted))

            Q95 = flow_duration_curve(flows_sorted, prob, 95)
            Q90 = flow_duration_curve(flows_sorted, prob, 90)

            tennant_10 = 0.1 * Qmaf
            tennant_30 = 0.3 * Qmaf
            tennant_60 = 0.6 * Qmaf

            monthly_avg = df.groupby('month')['flow_out_cms'].mean().values
            Qmonthly_avg = np.mean(monthly_avg)
            tessmann = 0.4 * Qmaf if Qmaf > 0.4 * Qmonthly_avg else Qmonthly_avg

            smakhtin = 0.2 * Qmaf

            def compute_surplus(flows_arr, threshold):
                flows_arr = np.array(flows_arr, dtype=float)
                thr = float(threshold)
                surplus = np.where(flows_arr > thr, flows_arr - thr, 0.0)
                # interpret each monthly mean as daily flow for a representative day count? existing code used 86400 per day
                # keep parity with original: multiply by seconds/day then sum; here per-month mean lacks day counts,
                # but to preserve behavior leave as-is for consistency with user code.
                surplus_volume_m3 = np.sum(surplus * 86400)
                return float(surplus_volume_m3 / 1e6)

            results = {
                "FDC-Q95": compute_surplus(flows, Q95),
                "FDC-Q90": compute_surplus(flows, Q90),
                "Tennant-10%": compute_surplus(flows, tennant_10),
                "Tennant-30%": compute_surplus(flows, tennant_30),
                "Tennant-60%": compute_surplus(flows, tennant_60),
                "Tessmann": compute_surplus(flows, tessmann),
                "Smakhtin": compute_surplus(flows, smakhtin)
            }

            thresholds = {
                "FDC-Q95": Q95,
                "FDC-Q90": Q90,
                "Tennant-10%": tennant_10,
                "Tennant-30%": tennant_30,
                "Tennant-60%": tennant_60,
                "Tessmann": tessmann,
                "Smakhtin": smakhtin
            }

            curves = {}
            for method_key, Qe in thresholds.items():
                image_b64 = self.render_method_png(days, flows, Qe, sub_id=sub_id, method_key=method_key)
                curves[method_key] = {
                    "days": days.tolist(),
                    "flows": flows.tolist(),
                    "threshold": float(Qe),
                    "image_base64": image_b64,  # NEW
                }

            all_results[sub_id] = {
                "summary": results,
                "curves": curves
            }

        return JsonResponse(all_results, safe=False)
