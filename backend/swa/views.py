from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.db.models import Avg
from .models import AdminFlow
from .models import SubbasinFlow
import numpy as np
from django.db.models import Q
import matplotlib.pyplot as plt
import io
import base64
import matplotlib
matplotlib.use("Agg")  # non-GUI backend for servers

from io import BytesIO
from typing import List, Dict, Any, Tuple, Optional
matplotlib.use("Agg")

from django.db.models import QuerySet
from .models import AdminFlow 


# ------------------------------------
class Subbasin(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        subs = SubbasinFlow.objects.values("sub").distinct().order_by("sub")
        if not subs.exists():
            return Response({"message": "No subbasins found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(list(subs), status=status.HTTP_200_OK)

#Drain mode FDC Curve API
def compute_fdc_and_quantiles(flows, targets=[10, 25, 50, 75, 90]):
    flows = np.array([f for f in flows if f is not None], dtype=float)
    if flows.size == 0:
        return None

    # Sort descending
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


def render_fdc_png(exceed_prob, sorted_flows, sub_id, q25=None, width=800, height=450, dpi=160):
    # Build a PNG image using matplotlib
    fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
    # Line
    ax.plot(exceed_prob, sorted_flows, color="#2563eb", linewidth=2, label=f"Subbasin {sub_id}")
    # Grid and labels
    ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
    ax.set_xlim(0, 100)
    ax.set_xlabel("Percent exceedance probability")
    ax.set_ylabel("Runoff (m³/s)")
    # Q25 reference
    ax.axvline(x=25, color="#dc2626", linestyle="--", linewidth=1.5)
    if q25 is not None:
        ax.axhline(y=q25, color="#dc2626", linestyle="--", linewidth=2)
        ax.text(26, q25, "Q25", color="#dc2626", fontsize=9, va="bottom")
    ax.set_title("Flow Duration Curve")
    ax.legend(loc="best")

    buf = io.BytesIO()
    plt.tight_layout()
    fig.savefig(buf, format="png", dpi=dpi, facecolor="white")
    plt.close(fig)
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("utf-8")
    return b64


class FlowDurationCurveAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        subs = request.data.get("subs")
        if not subs or not isinstance(subs, list):
            return Response({"error": "subs (list of subbasin IDs) is required"}, status=400)

        results = {}
        errors = {}

        for sub in subs:
            flows = list(
                SubbasinFlow.objects.filter(sub=sub)
                .values_list("flow_out_cms", flat=True)
            )

            computed = compute_fdc_and_quantiles(flows)
            if not computed:
                errors[str(sub)] = "No data found for this subbasin"
            else:
                # Generate PNG for each sub using computed arrays
                exceed_prob = computed["exceed_prob"]
                sorted_flows = computed["sorted_flows"]
                q25 = computed["quantiles"].get("Q25")
                png_b64 = render_fdc_png(exceed_prob, sorted_flows, sub_id=sub, q25=q25)

                results[str(sub)] = {
                    **computed,
                    "image_base64": png_b64,  # New: base64-encoded PNG image
                }

        return Response({
            "subs": subs,
            "results": results,
            "errors": errors or None
        }, status=status.HTTP_200_OK)
#---------------------------------------+Ended Drain mode FDC Curve API+------------------------------------------



