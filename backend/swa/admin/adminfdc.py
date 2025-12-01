# views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import io
import base64

from ..models import AdminFlow


def compute_fdc_and_quantiles(flows, targets=[10, 25, 50, 75, 90]):
    flows = np.array([f for f in flows if f is not None], dtype=float)
    if flows.size == 0:
        return None

    sorted_flows = np.sort(flows)[::-1]
    N = sorted_flows.size
    ranks = np.arange(1, N + 1)
    exceed_prob = ranks / (N + 1.0) * 100.0

    quantiles = {}
    for t in targets:
        q = float(np.interp(t, exceed_prob, sorted_flows))
        quantiles[f"Q{t}"] = q

    return {
        "n": int(N),
        "exceed_prob": exceed_prob.tolist(),
        "sorted_flows": sorted_flows.tolist(),
        "quantiles": quantiles,
    }


def render_fdc_png(exceed_prob, sorted_flows, label, q25=None, width=800, height=450, dpi=160):
    fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)

    ax.plot(exceed_prob, sorted_flows, color="#2563eb", linewidth=2, label=label)

    ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
    ax.set_xlim(0, 100)
    ax.set_xlabel("Percent exceedance probability")
    ax.set_ylabel("Runoff (m³/s)")

    ax.axvline(x=25, color="#dc2626", linestyle="--", linewidth=1.5)
    if q25 is not None:
        ax.axhline(y=q25, color="#dc2626", linestyle="--", linewidth=2)
        ax.text(26, q25, "Q25", color="#dc2626", fontsize=9, va="bottom")

    ax.set_title(f"Flow Duration Curve ({label})")
    ax.legend(loc="best")

    buf = io.BytesIO()
    plt.tight_layout()
    fig.savefig(buf, format="png", dpi=dpi, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("utf-8")
    return b64


# -------------------- JSON API (Final Version) --------------------
class VillageFlowDurationCurveAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        subdistrict_codes = request.data.get("subdistrict_codes")
        vlcodes = request.data.get("vlcode")

        # Must provide one — but not both
        if not subdistrict_codes and not vlcodes:
            return Response(
                {"error": "Either subdistrict_codes or vlcode is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if subdistrict_codes and vlcodes:
            return Response(
                {"error": "Please provide only one of subdistrict_codes or vlcode, not both"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Normalize both inputs
        if isinstance(subdistrict_codes, str):
            subdistrict_codes = [c.strip() for c in subdistrict_codes.split(",") if c.strip()]
        if isinstance(vlcodes, str):
            vlcodes = [v.strip() for v in vlcodes.split(",") if v.strip()]

        final_results = {}
        errors = {}

        # ---------------------------------
        # Case 1: Handle subdistrict codes
        # ---------------------------------
        if subdistrict_codes:
            for subdistrict_code in subdistrict_codes:
                villages = (
                    AdminFlow.objects.filter(subdistrict_code_id=subdistrict_code)
                    .values("vlcode", "village", "surq_cnt_m3")
                )

                if not villages.exists():
                    errors[subdistrict_code] = f"No villages found for subdistrict {subdistrict_code}"
                    continue

                results = {}
                village_map = {}

                for row in villages:
                    vlcode = row["vlcode"]
                    village_name = row["village"]
                    flow = row["surq_cnt_m3"]
                    village_map.setdefault(vlcode, {"name": village_name, "flows": []})["flows"].append(flow)

                for vlcode, data in village_map.items():
                    flows = data["flows"]
                    computed = compute_fdc_and_quantiles(flows)
                    if not computed:
                        errors[str(vlcode)] = f"No data found for village {data['name']}"
                    else:
                        results[str(vlcode)] = {
                            "village": data["name"],
                            **computed,
                        }

                final_results[subdistrict_code] = results

        # ---------------------------------
        # Case 2: Handle vlcode directly
        # ---------------------------------
        elif vlcodes:
            for vlcode in vlcodes:
                flows_qs = AdminFlow.objects.filter(vlcode=vlcode).values(
                    "village", "surq_cnt_m3", "subdistrict_code_id"
                )
                if not flows_qs.exists():
                    errors[str(vlcode)] = f"No data found for village code {vlcode}"
                    continue

                flows = [row["surq_cnt_m3"] for row in flows_qs]
                village_name = flows_qs[0]["village"]
                subdistrict_code_id = flows_qs[0]["subdistrict_code_id"]

                computed = compute_fdc_and_quantiles(flows)
                if not computed:
                    errors[str(vlcode)] = f"Could not compute FDC for {village_name}"
                    continue

                final_results[str(vlcode)] = {
                    "village": village_name,
                    "subdistrict_code": subdistrict_code_id,
                    **computed,
                }

        # ---------------------------------
        # Response
        # ---------------------------------
        return Response(
            {
                "subdistrict_codes": subdistrict_codes,
                "vlcodes": vlcodes,
                "results": final_results,
                "errors": errors or None,
            },
            status=status.HTTP_200_OK,
        )


# -------------------- IMAGE API --------------------
class VillageFlowDurationCurveImageAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        vlcode = request.data.get("vlcode")
        if not vlcode:
            return Response({"error": "vlcode is required"}, status=400)

        flows_qs = AdminFlow.objects.filter(vlcode=vlcode).values("village", "surq_cnt_m3")
        if not flows_qs.exists():
            return Response({"error": f"No data found for village {vlcode}"}, status=404)

        flows = [row["surq_cnt_m3"] for row in flows_qs]
        village_name = flows_qs[0]["village"]

        computed = compute_fdc_and_quantiles(flows)
        if not computed:
            return Response({"error": f"Could not compute FDC for {village_name}"}, status=400)

        exceed_prob = computed["exceed_prob"]
        sorted_flows = computed["sorted_flows"]
        q25 = computed["quantiles"].get("Q25")
        png_b64 = render_fdc_png(exceed_prob, sorted_flows, label=village_name, q25=q25)

        return Response(
            {
                "vlcode": vlcode,
                "village": village_name,
                "image_base64": png_b64,
                "quantiles": computed["quantiles"],
            },
            status=status.HTTP_200_OK,
        )
