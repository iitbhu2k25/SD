from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.db.models import Avg, Q, QuerySet
from .models import AdminFlow
from .models import SubbasinFlow
import numpy as np

import matplotlib.pyplot as plt
import io
import base64
import matplotlib
matplotlib.use("Agg")  # non-GUI backend for servers
from io import BytesIO
from typing import List, Dict, Any, Tuple, Optional
matplotlib.use("Agg")
from .models import AdminFlow 
import os
import geopandas as gpd
import matplotlib.pyplot as plt
from django.conf import settings
from django.http import FileResponse
from matplotlib.patches import FancyArrowPatch, Rectangle
from mpl_toolkits.axes_grid1.inset_locator import inset_axes


# ------------------------------------
class Subbasin(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        subs = SubbasinFlow.objects.values("sub").distinct().order_by("sub")
        if not subs.exists():
            return Response({"message": "No subbasins found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(list(subs), status=status.HTTP_200_OK)
    
#------------------------------------------    
    
class SubbasinStudyAreaMap(APIView):
    permission_classes = [ ]

    def post(self, request):
        subbasin_ids = request.data.get("subbasin_ids", [])
        if not subbasin_ids:
            return Response({"error": "No subbasin_ids provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # === Load shapefiles ===
            subbasin_path = os.path.join(
                settings.MEDIA_ROOT, "gwa_data", "gwa_shp", "varuna_subbasin_data", "varuna_subbasin_data.shp")
            stream_path = os.path.join(
                settings.MEDIA_ROOT, "gwa_data", "gwa_shp", "Streams_clipped", "Streams_clipped.shp")

            if not os.path.exists(subbasin_path):
                return Response({"error": f"Subbasin shapefile not found at {subbasin_path}"}, status=404)
            if not os.path.exists(stream_path):
                return Response({"error": f"Stream shapefile not found at {stream_path}"}, status=404)

            subbasin_gdf = gpd.read_file(subbasin_path)
            stream_gdf = gpd.read_file(stream_path)

            # === Ensure consistent CRS ===
            if subbasin_gdf.crs != stream_gdf.crs:
                stream_gdf = stream_gdf.to_crs(subbasin_gdf.crs)

            # === Find subbasin column ===
            sub_col = next((c for c in subbasin_gdf.columns if c.lower() == "subbasin"), None)
            if sub_col is None:
                return Response({"error": "No 'Subbasin' column found in shapefile"}, status=400)

            # === Filter selected subbasins and streams ===
            selected_sub = subbasin_gdf[subbasin_gdf[sub_col].isin(subbasin_ids)]
            selected_streams = stream_gdf[stream_gdf[sub_col].isin(subbasin_ids)]

            if selected_sub.empty:
                return Response({"error": "No matching subbasin(s) found"}, status=404)

            # === Create clean white figure ===
            fig, ax = plt.subplots(figsize=(12, 10), dpi=300, facecolor="white")
            ax.set_facecolor("white")

            # --- Draw selected subbasin with colorful borders ---
            colors = ['#FF1744', '#F50057', '#D500F9', '#651FFF', '#2979FF', '#00B0FF', '#00E5FF']
            for i, geom in enumerate(selected_sub.geometry):
                color = colors[i % len(colors)]
                gpd.GeoSeries([geom]).boundary.plot(ax=ax, color=color, linewidth=2.5, alpha=0.9)

            selected_streams.plot(ax=ax, color="blue", linewidth=0.7, label="Streams")

            # === Focus view around selected subbasin (square bounding box) ===
            bounds = selected_sub.total_bounds  # [minx, miny, maxx, maxy]
            x_range = bounds[2] - bounds[0]
            y_range = bounds[3] - bounds[1]
            max_range = max(x_range, y_range)
            mid_x = (bounds[0] + bounds[2]) / 2
            mid_y = (bounds[1] + bounds[3]) / 2

            buffer = 0.02 * max_range
            ax.set_xlim(mid_x - max_range/2 - buffer, mid_x + max_range/2 + buffer)
            ax.set_ylim(mid_y - max_range/2 - buffer, mid_y + max_range/2 + buffer)

            # === Add lat/lon ticks (rounded to two decimal points) ===
            xlim = ax.get_xlim()
            ylim = ax.get_ylim()
            x_ticks = [xlim[0] + i * (xlim[1] - xlim[0]) / 4 for i in range(5)]
            y_ticks = [ylim[0] + i * (ylim[1] - ylim[0]) / 4 for i in range(5)]
            ax.set_xticks(x_ticks)
            ax.set_yticks(y_ticks)
            x_labels = [f"{x:.2f}" for x in x_ticks]
            y_labels = [f"{y:.2f}" for y in y_ticks]
            ax.set_xticklabels(x_labels, fontsize=7, rotation=45, ha='right')
            ax.set_yticklabels(y_labels, fontsize=7)

            ax.tick_params(axis='both', which='major', length=6, width=1, colors='black')
            for spine in ax.spines.values():
                spine.set_visible(True)
                spine.set_color('black')
                spine.set_linewidth(1.5)

            # === Add thick bordered container ===
            rect = Rectangle(
                (ax.get_xlim()[0], ax.get_ylim()[0]),
                ax.get_xlim()[1] - ax.get_xlim()[0],
                ax.get_ylim()[1] - ax.get_ylim()[0],
                linewidth=4, edgecolor='black', facecolor='none', zorder=100
            )
            ax.add_patch(rect)

            # === Title ===
            ax.set_title("Selected Subbasin Boundary Map", fontsize=14, fontweight='bold', pad=12)

            # === Add legend outside box ===
            ax.legend(
                loc="upper center",
                bbox_to_anchor=(0.5, -0.08),
                ncol=2,
                frameon=False,
                fontsize=9
            )

            # === Export as base64 image ===
            buf = BytesIO()
            plt.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
            plt.close(fig)
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode("utf-8")

            return Response({
                "image_base64": f"data:image/png;base64,{img_base64}"
            })

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
#-------------------------------------------------------   

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



