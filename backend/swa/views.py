from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from .models import SubbasinFlow
import numpy as np
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status



class Subbasin(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        
        subs = SubbasinFlow.objects.values("sub").distinct().order_by("sub")

        if not subs.exists():
            return Response(
                {"message": "No subbasins found"},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(list(subs), status=status.HTTP_200_OK)
    




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
                results[str(sub)] = computed

        return Response({
            "subs": subs,
            "results": results,
            "errors": errors or None
        }, status=status.HTTP_200_OK)
