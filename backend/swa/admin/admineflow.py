# views/adminflow.py

from rest_framework.views import APIView # type: ignore
from rest_framework.response import Response # type: ignore
from rest_framework import status # type: ignore
from rest_framework.permissions import AllowAny # type: ignore
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from io import BytesIO
import base64
from ..models import AdminFlow


class AdmineflowAPI(APIView):
    """Main API: Returns calculations per village (either by subdistrict or vlcode)."""
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        subdistrict_codes = request.data.get("subdistrict_codes", [])
        vlcodes = request.data.get("vlcodes", [])

        # --- Input validation ---
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

        # --- Fetch data based on input type ---
        if subdistrict_codes:
            qs = AdminFlow.objects.filter(subdistrict_code_id__in=subdistrict_codes)
        else:  # if vlcodes are provided
            qs = AdminFlow.objects.filter(vlcode__in=vlcodes)

        if not qs.exists():
            return Response({}, status=status.HTTP_200_OK)

        # --- Convert to DataFrame ---
        df = pd.DataFrame.from_records(
            qs.values("vlcode", "village", "subdistrict_code_id", "year", "mon", "surq_cnt_m3")
        )

        # --- Convert to flow rate (cms) ---
        days_in_month = 30
        seconds_in_month = days_in_month * 24 * 3600
        df["flow_out_cms"] = df["surq_cnt_m3"] / seconds_in_month

        all_results = {}

        # --- Loop through each village ---
        for vlcode in df["vlcode"].unique():
            village_df = df[df["vlcode"] == vlcode]
            village_name = village_df["village"].iloc[0]
            subdistrict_code = village_df["subdistrict_code_id"].iloc[0]

            monthly_avg = village_df.groupby("mon")["flow_out_cms"].mean().reset_index()
            flows = monthly_avg["flow_out_cms"].values
            days = monthly_avg["mon"].values

            Qmaf = np.mean(flows)

            # --- Flow Duration Curve (FDC) ---
            flows_sorted = np.sort(flows)[::-1]
            N = len(flows_sorted)
            ranks = np.arange(1, N + 1)
            prob = ranks / (N + 1) * 100

            def flow_duration_curve(flows_sorted, prob, exceed_prob):
                return float(np.interp(exceed_prob, prob, flows_sorted))

            Q95 = flow_duration_curve(flows_sorted, prob, 95)
            Q90 = flow_duration_curve(flows_sorted, prob, 90)

            # --- Eflow thresholds ---
            tennant_10 = 0.1 * Qmaf
            tennant_30 = 0.3 * Qmaf
            tennant_60 = 0.6 * Qmaf
            Qmonthly_avg = np.mean(monthly_avg["flow_out_cms"].values)
            tessmann = 0.4 * Qmaf if Qmaf > 0.4 * Qmonthly_avg else Qmonthly_avg
            smakhtin = 0.2 * Qmaf

            def compute_surplus(flows_arr, threshold):
                flows_arr = np.array(flows_arr, dtype=float)
                thr = float(threshold)
                surplus = np.where(flows_arr > thr, flows_arr - thr, 0.0)
                surplus_volume_m3 = np.sum(surplus * 86400)
                return float(surplus_volume_m3 / 1e6)  # million m³

            results = {
                "FDC-Q95": compute_surplus(flows, Q95),
                "FDC-Q90": compute_surplus(flows, Q90),
                "Tennant-10%": compute_surplus(flows, tennant_10),
                "Tennant-30%": compute_surplus(flows, tennant_30),
                "Tennant-60%": compute_surplus(flows, tennant_60),
                "Tessmann": compute_surplus(flows, tessmann),
                "Smakhtin": compute_surplus(flows, smakhtin),
            }

            thresholds = {
                "FDC-Q95": Q95,
                "FDC-Q90": Q90,
                "Tennant-10%": tennant_10,
                "Tennant-30%": tennant_30,
                "Tennant-60%": tennant_60,
                "Tessmann": tessmann,
                "Smakhtin": smakhtin,
            }

            curves = {
                method_key: {
                    "days": days.tolist(),
                    "flows": flows.tolist(),
                    "threshold": float(Qe),
                }
                for method_key, Qe in thresholds.items()
            }

            all_results[str(vlcode)] = {
                "vlcode": int(vlcode),
                "village": village_name,
                "subdistrict_code": int(subdistrict_code),
                "summary": results,
                "curves": curves,
            }

        return Response(all_results, status=status.HTTP_200_OK)


class AdmineflowImageAPI(APIView):
    """Separate API: Returns PNG image for a given village (vlcode) + method."""
    permission_classes = [AllowAny]

    def render_method_png(self, days, flows, threshold, village_name, vlcode, method_key,
                        width=1000, height=420, dpi=140):
        x = np.array(days, dtype=float)
        y = np.array(flows, dtype=float)

        # --- Flow Duration Curve (fixed curve) ---
        flows_sorted = np.sort(y)[::-1]
        N = len(flows_sorted)
        ranks = np.arange(1, N + 1)
        prob = ranks / (N + 1) * 100  # exceedance probability %

        fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)

        # Monthly flow curve
        ax.plot(x, y, color="#2563eb", linewidth=2, marker="o", label="Monthly Flow")

        

        # Threshold
        if threshold is not None and np.isfinite(threshold):
            ax.axhline(y=float(threshold), color="#7c3aed", linestyle="--", linewidth=2,
                    label=f"{method_key} threshold")

        ax.set_xlabel("X-axis (Month / Probability)")  # since both are on same X
        ax.set_ylabel("Flow (cms)")
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
        ax.set_title(f"Eflow: {method_key} • {village_name} ({vlcode})")
        ax.legend(loc="best")

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

        df["flow_out_cms"] = df["surq_cnt_m3"] / (30 * 24 * 3600)
        monthly_avg = df.groupby("mon")["flow_out_cms"].mean().reset_index()
        flows = monthly_avg["flow_out_cms"].values
        days = monthly_avg["mon"].values
        village_name = df["village"].iloc[0]

        # Compute thresholds (same as above)
        Qmaf = np.mean(flows)
        flows_sorted = np.sort(flows)[::-1]
        N = len(flows_sorted)
        ranks = np.arange(1, N + 1)
        prob = ranks / (N + 1) * 100

        def flow_duration_curve(flows_sorted, prob, exceed_prob):
            return float(np.interp(exceed_prob, prob, flows_sorted))

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

        threshold = thresholds[method_key]
        image_b64 = self.render_method_png(days, flows, threshold, village_name, vlcode, method_key)

        return Response({
            "vlcode": vlcode,
            "method_key": method_key,
            "image_base64": image_b64,
        }, status=status.HTTP_200_OK)
