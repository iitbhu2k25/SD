import os
import uuid
import base64
import pandas as pd
import geopandas as gpd
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from shapely.geometry import Point
from datetime import datetime
import contextily as ctx

MEDIA_ROOT = "media"   # <-- update if needed


class PDFMapService:

    @staticmethod
    def generate_map(selected_sub_districts, selected_villages, csv_filename):
        df_wells = pd.DataFrame()
        gdf_wells = None

        # -----------------------------
        # STEP 1: Load CSV if provided
        # -----------------------------
        if csv_filename:
            csv_path = os.path.join(MEDIA_ROOT, "temp", csv_filename)
            if not os.path.exists(csv_path):
                raise FileNotFoundError(f"CSV file '{csv_filename}' not found")

            df_wells = pd.read_csv(csv_path)

            required_columns = ['LATITUDE', 'LONGITUDE']
            missing = [c for c in required_columns if c not in df_wells.columns]
            if missing:
                raise ValueError(f"CSV missing required columns: {missing}")

            df_wells_clean = df_wells.dropna(subset=['LATITUDE', 'LONGITUDE'])

            if len(df_wells_clean) > 0:
                geometry = [Point(xy) for xy in zip(df_wells_clean['LONGITUDE'], df_wells_clean['LATITUDE'])]
                gdf_wells = gpd.GeoDataFrame(df_wells_clean, geometry=geometry, crs="EPSG:4326")

        # -----------------------------
        # STEP 2: Load villages shapefile
        # -----------------------------
        shp_path = os.path.join(MEDIA_ROOT, "gwa_data", "gwa_shp", "Final_Village", "Village_New.shp")

        if not os.path.exists(shp_path):
            raise FileNotFoundError("Village shapefile not found")

        gdf_villages = gpd.read_file(shp_path)

        required_shp_cols = ["SUBDIS_COD", "village_co"]
        missing = [c for c in required_shp_cols if c not in gdf_villages.columns]
        if missing:
            raise ValueError(f"Shapefile missing required columns: {missing}")

        # -----------------------------
        # STEP 3: Filtering villages
        # -----------------------------
        if selected_villages:
            gdf_villages["village_co"] = gdf_villages["village_co"].astype(str)
            selected_villages = [str(v) for v in selected_villages]
            filtered = gdf_villages[gdf_villages["village_co"].isin(selected_villages)]
        else:
            gdf_villages["SUBDIS_COD"] = gdf_villages["SUBDIS_COD"].astype(str)
            selected_sub_districts = [str(v) for v in selected_sub_districts]
            filtered = gdf_villages[gdf_villages["SUBDIS_COD"].isin(selected_sub_districts)]

        if len(filtered) == 0:
            raise ValueError("No villages found for selected inputs")

        # -----------------------------
        # STEP 4: CRS alignment
        # -----------------------------
        if gdf_wells is not None and filtered.crs != gdf_wells.crs:
            filtered = filtered.to_crs(gdf_wells.crs)

        # -----------------------------
        # STEP 5: Plotting
        # -----------------------------
        fig, ax = plt.subplots(figsize=(15, 12))

        filtered.plot(ax=ax, color="lightblue", edgecolor="blue", alpha=0.6, linewidth=1.5)

        if gdf_wells is not None:
            gdf_wells.plot(ax=ax, color='red', markersize=50, marker="o")

        # Bounds
        bounds = filtered.total_bounds
        min_x, min_y, max_x, max_y = bounds
        padding = 0.01
        ax.set_xlim(min_x - padding, max_x + padding)
        ax.set_ylim(min_y - padding, max_y + padding)

        # Basemap
        try:
            ctx.add_basemap(ax, crs=filtered.crs, source=ctx.providers.CartoDB.Voyager, zoom=10)
        except:
            pass

        # Labels
        ax.set_title("Groundwater Assessment Study Area Map", fontsize=16, fontweight="bold", pad=20)
        ax.set_xlabel("LONGITUDE")
        ax.set_ylabel("LATITUDE")

        # Legend
        from matplotlib.lines import Line2D
        legend_items = [
            patches.Patch(facecolor="lightblue", edgecolor="blue", label="Villages")
        ]
        if gdf_wells is not None:
            legend_items.append(Line2D([0], [0], marker='o', color='w', markerfacecolor='red',
                                       markersize=10, label='Wells'))
        ax.legend(handles=legend_items)

        plt.tight_layout()

        # -----------------------------
        # STEP 6: Save PNG
        # -----------------------------
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"gwa_map_{timestamp}_{unique_id}.png"
        path = os.path.join(MEDIA_ROOT, "temp", filename)
        os.makedirs(os.path.dirname(path), exist_ok=True)

        plt.savefig(path, dpi=300, bbox_inches="tight")
        plt.close()

        # -----------------------------
        # STEP 7: Encode Base64
        # -----------------------------
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        return {
            "pdfId": unique_id,
            "filename": filename,
            "generatedAt": datetime.now().isoformat(),
            "imageBase64": f"data:image/png;base64,{b64}",
            "statistics": {
                "villages_count": len(filtered),
                "wells_count": len(gdf_wells) if gdf_wells is not None else 0,
                "selected_villages": selected_villages,
                "selected_subdistricts": selected_sub_districts
            }
        }
