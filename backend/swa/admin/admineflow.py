# views/adminflow.py

from rest_framework.views import APIView  # type: ignore
from rest_framework.response import Response  # type: ignore
from rest_framework import status  # type: ignore
from rest_framework.permissions import AllowAny  # type: ignore
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from io import BytesIO
import base64
from ..models import AdminFlow

class AdmineflowAPI(APIView):
    """
    Main API: Returns calculations per village (either by subdistrict or vlcode).
    All units converted to Liters per second (L/s). Surplus reported in liters and million liters (ML).
    """
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        subdistrict_codes = request.data.get("subdistrict_codes", [])
        vlcodes = request.data.get("vlcodes", [])

        # Input validation
        if subdistrict_codes and vlcodes:
            return Response(
                {"error": "Send either subdistrict_codes or vlcodes, not both."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not subdistrict_codes and not vlcodes:
            return Response(
                {"error": "Either subdistrict_codes or vlcodes is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Query database
        if subdistrict_codes:
            qs = AdminFlow.objects.filter(subdistrict_code_id__in=subdistrict_codes)
        else:
            qs = AdminFlow.objects.filter(vlcode__in=vlcodes)

        if not qs.exists():
            return Response({}, status=status.HTTP_200_OK)

        # Build DataFrame
        df = pd.DataFrame.from_records(
            qs.values("vlcode", "village", "subdistrict_code_id", "year", "mon", "surq_cnt_m3")
        )

        # Convert daily volume (m3/day) to flow rate (L/s)
        seconds_in_day = 86400.0
        # flow_out_Lps = (m3/day) / 86400 * 1000 -> L/s
        df["flow_out_Lps"] = (df["surq_cnt_m3"] / seconds_in_day) * 1000.0

        all_results = {}

        # Process per village
        for vlcode in df["vlcode"].unique():
            village_df = df[df["vlcode"] == vlcode]
            village_name = village_df["village"].iloc[0]
            subdistrict_code = village_df["subdistrict_code_id"].iloc[0]

            # Compute monthly/day-of-year averages (flows in L/s)
            daily_avg = village_df.groupby("mon")["flow_out_Lps"].mean().reset_index()
            flows = daily_avg["flow_out_Lps"].values.astype(float)  # L/s
            days = daily_avg["mon"].values.astype(int)

            if flows.size == 0:
                all_results[str(vlcode)] = {
                    "vlcode": int(vlcode),
                    "village": village_name,
                    "subdistrict_code": int(subdistrict_code),
                    "error": "No valid flow data"
                }
                continue

            # Mean annual flow (MAF) — here mean of the available monthly averages (L/s)
            Qmaf = float(np.mean(flows))

            # Flow duration curve inputs (flows in L/s)
            flows_sorted = np.sort(flows)[::-1]
            N = len(flows_sorted)
            ranks = np.arange(1, N + 1)
            prob = ranks / (N + 1) * 100.0

            def flow_duration_curve(flows_sorted_local, prob_local, exceed_prob):
                return float(np.interp(exceed_prob, prob_local, flows_sorted_local))

            # Compute thresholds (all in L/s)
            thresholds_Lps = {
                "FDC-Q95": flow_duration_curve(flows_sorted, prob, 95),
                "FDC-Q90": flow_duration_curve(flows_sorted, prob, 90),
                "Tennant-10%": 0.1 * Qmaf,
                "Tennant-30%": 0.3 * Qmaf,
                "Tennant-60%": 0.6 * Qmaf,
                "Tessmann": 0.4 * Qmaf if Qmaf > 0.4 * np.mean(flows) else np.mean(flows),
                "Smakhtin": 0.2 * Qmaf,
            }

            # Helper: compute surplus in liters and million liters (ML)
            def compute_surplus_liters(flows_arr_Lps, threshold_Lps):
                """
                flows_arr_Lps: array of flows in L/s
                threshold_Lps: scalar in L/s
                returns (surplus_liters_total, surplus_ML_total)
                """
                arr = np.array(flows_arr_Lps, dtype=float)
                thr = float(threshold_Lps)
                # surplus (L/s) at each time step
                surplus_Lps = np.where(arr > thr, arr - thr, 0.0)
                # convert to liters for the time-step by multiplying by seconds in day
                # (same logic as before: flows are representative average per day/month)
                surplus_liters = float(np.sum(surplus_Lps * seconds_in_day))  # total liters
                surplus_ML = surplus_liters / 1e6  # million liters
                return surplus_liters, surplus_ML

            # Build outputs
            summary = {}
            curves = {}
            for method_key, thr_Lps in thresholds_Lps.items():
                surplus_L, surplus_ML = compute_surplus_liters(flows, thr_Lps)

                summary[method_key] = {
                    "threshold_Lps": float(thr_Lps),            # L/s
                    "surplus_L": round(surplus_L, 3),           # liters
                    "surplus_ML": round(surplus_ML, 6),         # million liters (ML)
                }

                curves[method_key] = {
                    "days": days.tolist(),
                    "flows_Lps": flows.tolist(),                 # flows in L/s for plotting
                    "threshold_Lps": float(thr_Lps),
                }

            all_results[str(vlcode)] = {
                "vlcode": int(vlcode),
                "village": village_name,
                "subdistrict_code": int(subdistrict_code),
                "summary": summary,
                "curves": curves,
            }

        return Response(all_results, status=status.HTTP_200_OK)


class AdmineflowImageAPI(APIView):
    """
    Returns PNG image for a given village (vlcode) + method.
    Uses L/s units for plotting, shades surplus area above threshold and annotates surplus (ML and L).
    """
    permission_classes = [AllowAny]

    def render_method_png(self, days, flows_Lps, threshold_Lps, village_name, vlcode, method_key,
                          surplus_L, surplus_ML, width=1000, height=420, dpi=140):
        """
        days: array-like (month/day indices)
        flows_Lps: array-like flows in L/s
        threshold_Lps: scalar in L/s
        surplus_L: total surplus in liters
        surplus_ML: total surplus in million liters
        """
        x = np.array(days, dtype=float)
        y = np.array(flows_Lps, dtype=float)  # L/s

        fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)

        # Flow curve (L/s)
        ax.plot(x, y, color="#2563eb", linewidth=2, marker="o", markersize=4, label="Average Flow (L/s)")

        # Threshold horizontal line (L/s)
        if threshold_Lps is not None and np.isfinite(threshold_Lps):
            ax.axhline(y=float(threshold_Lps), color="#7c3aed", linestyle="--", linewidth=2,
                       label=f"{method_key} threshold ({threshold_Lps:.4f} L/s)")

            # Shade area above threshold (surplus)
            thr_arr = np.full_like(y, float(threshold_Lps))
            mask = y > thr_arr
            if np.any(mask):
                ax.fill_between(x, y, thr_arr, where=mask, interpolate=True, alpha=0.25, color="#16a34a",
                                label="Surplus area")

        # Labels and grid (L/s)
        ax.set_xlabel("Day / Month")
        ax.set_ylabel("Flow (L/s)")
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
        ax.set_title(f"Eflow: {method_key} • {village_name} ({vlcode})")
        ax.legend(loc="best")

        # Annotate surplus as text on the chart (ML and L)
        annotation = f"Surplus: {surplus_ML:.6f} ML  ({int(round(surplus_L)):,} L)"
        ax.text(0.02, 0.98, annotation, transform=ax.transAxes,
                fontsize=10, verticalalignment='top',
                bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="#999999", alpha=0.8))

        fig.tight_layout()

        buf = BytesIO()
        fig.savefig(buf, format="png", dpi=dpi, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def post(self, request, *args, **kwargs):
        vlcode = request.data.get("vlcode")
        method_key = request.data.get("method_key")

        if not vlcode or not method_key:
            return Response({"error": "vlcode and method_key are required"}, status=status.HTTP_400_BAD_REQUEST)

        qs = AdminFlow.objects.filter(vlcode=vlcode)
        if not qs.exists():
            return Response({"error": "No data found"}, status=status.HTTP_404_NOT_FOUND)

        df = pd.DataFrame.from_records(
            qs.values("vlcode", "village", "year", "mon", "surq_cnt_m3")
        )

        # Convert daily volume (m3/day) to flow rate (L/s)
        seconds_in_day = 86400.0
        df["flow_out_Lps"] = (df["surq_cnt_m3"] / seconds_in_day) * 1000.0

        # Group by month/day-of-year and compute mean flow (L/s)
        daily_avg = df.groupby("mon")["flow_out_Lps"].mean().reset_index()
        flows = daily_avg["flow_out_Lps"].values.astype(float)
        days = daily_avg["mon"].values.astype(int)
        village_name = df["village"].iloc[0]

        if flows.size == 0:
            return Response({"error": "No valid flow data"}, status=status.HTTP_404_NOT_FOUND)

        # Compute thresholds (in L/s)
        Qmaf = np.mean(flows)
        flows_sorted = np.sort(flows)[::-1]
        N = len(flows_sorted)
        ranks = np.arange(1, N + 1)
        prob = ranks / (N + 1) * 100.0

        def flow_duration_curve(flows_sorted_local, prob_local, exceed_prob):
            return float(np.interp(exceed_prob, prob_local, flows_sorted_local))

        thresholds = {
            "FDC-Q95": flow_duration_curve(flows_sorted, prob, 95),
            "FDC-Q90": flow_duration_curve(flows_sorted, prob, 90),
            "Tennant-10%": 0.1 * Qmaf,
            "Tennant-30%": 0.3 * Qmaf,
            "Tennant-60%": 0.6 * Qmaf,
            "Tessmann": 0.4 * Qmaf if Qmaf > 0.4 * np.mean(flows) else np.mean(flows),
            "Smakhtin": 0.2 * Qmaf,
        }

        if method_key not in thresholds:
            return Response({"error": "Invalid method_key"}, status=status.HTTP_400_BAD_REQUEST)

        threshold_Lps = thresholds[method_key]

        # Compute surplus in liters and ML
        def compute_surplus_liters_local(flows_arr_Lps, threshold_local_Lps):
            arr = np.array(flows_arr_Lps, dtype=float)
            thr = float(threshold_local_Lps)
            surplus_Lps = np.where(arr > thr, arr - thr, 0.0)
            surplus_liters_val = float(np.sum(surplus_Lps * seconds_in_day))
            surplus_ML_val = surplus_liters_val / 1e6
            return surplus_liters_val, surplus_ML_val

        surplus_L, surplus_ML = compute_surplus_liters_local(flows, threshold_Lps)

        image_b64 = self.render_method_png(days, flows, threshold_Lps, village_name, vlcode, method_key,
                                           surplus_L, surplus_ML)

        return Response({
            "vlcode": vlcode,
            "method_key": method_key,
            "threshold_Lps": float(threshold_Lps),
            "surplus_L": round(surplus_L, 3),
            "surplus_ML": round(surplus_ML, 6),
            "image_base64": image_b64,
        }, status=status.HTTP_200_OK)
