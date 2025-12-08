# app/services/trend_service.py
import os
import json
import uuid
import base64
import warnings
import re
from datetime import datetime
from collections import namedtuple
from io import BytesIO
from typing import List, Optional, Tuple, Dict, Any

import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import shape
from scipy.spatial import cKDTree
from scipy import stats
import matplotlib.pyplot as plt
import seaborn as sns
import matplotlib.patches as mpatches

warnings.filterwarnings("ignore")

# ----------------------------------------------------------------------
# Helper namedtuple for Mann-Kendall result
# ----------------------------------------------------------------------
MKResult = namedtuple(
    "MKResult", ["tau", "p_value", "trend", "slope"]
)

# ----------------------------------------------------------------------
# TrendService – all heavy lifting lives here
# ----------------------------------------------------------------------
class TrendService:
    def __init__(self, media_root: str):
        self.media_root = media_root
        self.temp_media_dir = os.path.join(media_root, "temp")
        self.gwa_data_dir = os.path.join(media_root, "gwa_data", "gwa_shp")
        self.village_shp_path = os.path.join(self.gwa_data_dir, "Final_Village", "Village.shp")
        self.centroid_shp_path = os.path.join(self.gwa_data_dir, "Centroid", "Centroid1.shp")
        self.VILLAGE_CODE_COL = "village_co"

        os.makedirs(self.temp_media_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # 1. Filtering helpers
    # ------------------------------------------------------------------
    def _filter_by_subdis(self, subdis_codes: List) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
        centroids = gpd.read_file(self.centroid_shp_path)
        villages = gpd.read_file(self.village_shp_path)

        if "SUBDIS_COD" not in centroids.columns:
            raise ValueError(f"SUBDIS_COD column missing in centroids. Columns: {list(centroids.columns)}")
        if "SUBDIS_COD" not in villages.columns:
            raise ValueError(f"SUBDIS_COD column missing in villages. Columns: {list(villages.columns)}")

        # normalise to int
        subdis_codes = [int(c) for c in subdis_codes]
        filtered_c = centroids[centroids["SUBDIS_COD"].isin(subdis_codes)]
        filtered_v = villages[villages["SUBDIS_COD"].isin(subdis_codes)]

        if filtered_c.empty or filtered_v.empty:
            raise ValueError(f"No data for SUBDIS_COD {subdis_codes}")
        return filtered_c, filtered_v

    def _filter_by_village(self, village_codes: List) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame]:
        centroids = gpd.read_file(self.centroid_shp_path)
        villages = gpd.read_file(self.village_shp_path)

        if self.VILLAGE_CODE_COL not in centroids.columns:
            raise ValueError(f"{self.VILLAGE_CODE_COL} missing in centroids")
        if self.VILLAGE_CODE_COL not in villages.columns:
            raise ValueError(f"{self.VILLAGE_CODE_COL} missing in villages")

        norm = [int(v) for v in village_codes]
        filtered_c = centroids[centroids[self.VILLAGE_CODE_COL].isin(norm)]
        filtered_v = villages[villages[self.VILLAGE_CODE_COL].isin(norm)]

        if filtered_c.empty or filtered_v.empty:
            raise ValueError(f"No data for village codes {village_codes}")
        return filtered_c, filtered_v

    # ------------------------------------------------------------------
    # 2. Mann-Kendall
    # ------------------------------------------------------------------
    def mann_kendall_test(self, series: pd.Series) -> MKResult:
        data = series.dropna()
        if len(data) < 3:
            return MKResult(np.nan, np.nan, "Insufficient Data", np.nan)

        n = len(data)
        S = sum(np.sign(data.values[j] - data.values[i]) for i in range(n - 1) for j in range(i + 1, n))
        var_S = n * (n - 1) * (2 * n + 5) / 18
        Z = (S - 1) / np.sqrt(var_S) if S > 0 else (S + 1) / np.sqrt(var_S) if S < 0 else 0
        p = 2 * (1 - stats.norm.cdf(abs(Z)))
        tau = S / (0.5 * n * (n - 1))

        trend = (
            "Increasing"
            if p < 0.05 and tau > 0
            else "Decreasing"
            if p < 0.05 and tau < 0
            else "No-Trend"
        )

        slopes = [(data.values[j] - data.values[i]) / (j - i) for i in range(n - 1) for j in range(i + 1, n)]
        sen_slope = np.median(slopes) if slopes else 0

        return MKResult(tau, p, trend, sen_slope)

    # ------------------------------------------------------------------
    # 3. Time-series creation (yearly + seasonal)
    # ------------------------------------------------------------------
    def create_village_time_series(
        self,
        wells_csv_path: str,
        centroids: gpd.GeoDataFrame,
        villages: gpd.GeoDataFrame,
    ) -> Tuple[gpd.GeoDataFrame, gpd.GeoDataFrame, List[str], Dict[str, Any]]:
        wells_df = pd.read_csv(wells_csv_path)
        wells_gdf = gpd.GeoDataFrame(
            wells_df,
            geometry=gpd.points_from_xy(wells_df["LONGITUDE"], wells_df["LATITUDE"]),
            crs="EPSG:4326",
        )

        common_crs = centroids.crs
        wells_gdf = wells_gdf.to_crs(common_crs)
        villages = villages.to_crs(common_crs)

        depth_cols = [c for c in wells_gdf.columns if any(s in c for s in ("PRE", "POST"))]
        years = sorted(
            {re.search(r"(\d{4})", c).group(1) for c in depth_cols if re.search(r"(\d{4})", c)}
        )
        if not years:
            raise ValueError("No year columns found in wells CSV")

        # ---- spatial index -------------------------------------------------
        cent_coords = np.array([(g.x, g.y) for g in centroids.geometry])
        well_coords = np.array([(g.x, g.y) for g in wells_gdf.geometry])
        tree = cKDTree(well_coords)
        distances, indices = tree.query(cent_coords, k=min(3, len(well_coords)))
        if len(well_coords) == 1:
            distances = distances.reshape(-1, 1)
            indices = indices.reshape(-1, 1)
        elif len(well_coords) == 2:
            distances = distances.reshape(-1, 2)
            indices = indices.reshape(-1, 2)

        yearly_records = []
        seasonal_records = []

        for dist_row, idx_row in zip(distances, indices):
            # keep at most 3 nearest wells
            dist_row = dist_row[:3] if len(dist_row) > 3 else dist_row
            idx_row = idx_row[:3] if len(idx_row) > 3 else idx_row

            eps = 1e-10
            weights = 1.0 / (np.array(dist_row) + eps)
            weights = weights / weights.sum()

            yearly = {}
            seasonal = {}

            for yr in years:
                pre_col = next((c for c in depth_cols if yr in c and "PRE" in c.upper()), None)
                post_col = next((c for c in depth_cols if yr in c and "POST" in c.upper()), None)

                year_vals, year_w = [], []
                pre_vals, pre_w = [], []
                post_vals, post_w = [], []

                for j, w_idx in enumerate(idx_row):
                    w = wells_gdf.iloc[w_idx]
                    pre_v = w[pre_col] if pre_col and pd.notna(w[pre_col]) else None
                    post_v = w[post_col] if post_col and pd.notna(w[post_col]) else None

                    # yearly (average of pre+post)
                    vals = [v for v in (pre_v, post_v) if v is not None]
                    if vals:
                        year_vals.append(np.mean(vals))
                        year_w.append(weights[j])

                    # seasonal
                    if pre_v is not None:
                        pre_vals.append(pre_v)
                        pre_w.append(weights[j])
                    if post_v is not None:
                        post_vals.append(post_v)
                        post_w.append(weights[j])

                # ---- yearly ----
                if year_vals:
                    yw = np.array(year_w)
                    yw = yw / yw.sum()
                    yearly[yr] = float(np.sum(np.array(year_vals) * yw))
                else:
                    yearly[yr] = np.nan

                # ---- seasonal ----
                if pre_vals:
                    pw = np.array(pre_w)
                    pw = pw / pw.sum()
                    seasonal[f"{yr}_PRE"] = float(np.sum(np.array(pre_vals) * pw))
                else:
                    seasonal[f"{yr}_PRE"] = np.nan

                if post_vals:
                    pw = np.array(post_w)
                    pw = pw / pw.sum()
                    seasonal[f"{yr}_POST"] = float(np.sum(np.array(post_vals) * pw))
                else:
                    seasonal[f"{yr}_POST"] = np.nan

            # ---- metadata (nearest wells) ----
            for j, w_idx in enumerate(idx_row):
                meta = {
                    f"nearest_well_{j+1}_id": wells_gdf.iloc[w_idx].get("id", f"well_{w_idx}"),
                    f"distance_{j+1}": float(dist_row[j]),
                    f"weight_{j+1}": float(weights[j]) if j < len(weights) else 0.0,
                }
                yearly.update(meta)
                seasonal.update(meta)

            yearly_records.append(yearly)
            seasonal_records.append(seasonal)

        # ---- DataFrames ----------------------------------------------------
        yearly_df = pd.DataFrame(yearly_records)
        seasonal_df = pd.DataFrame(seasonal_records)

        yearly_df[self.VILLAGE_CODE_COL] = centroids[self.VILLAGE_CODE_COL].values
        seasonal_df[self.VILLAGE_CODE_COL] = centroids[self.VILLAGE_CODE_COL].values

        villages_y = villages.merge(yearly_df, on=self.VILLAGE_CODE_COL, how="left")
        villages_s = villages.merge(seasonal_df, on=self.VILLAGE_CODE_COL, how="left")

        # ---- save CSVs ----------------------------------------------------
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        yearly_csv = f"village_timeseries_yearly_filtered_all_years_{ts}.csv"
        seasonal_csv = f"village_timeseries_seasonal_filtered_all_years_{ts}.csv"

        yearly_path = os.path.join(self.temp_media_dir, yearly_csv)
        seasonal_path = os.path.join(self.temp_media_dir, seasonal_csv)

        villages_y.drop(columns=["geometry"], errors="ignore").to_csv(yearly_path, index=False)
        villages_s.drop(columns=["geometry"], errors="ignore").to_csv(seasonal_path, index=False)

        stats = {
            "total_villages": len(villages_y),
            "total_years_available": len(years),
            "all_years_analyzed": years,
            "village_timeseries_yearly_csv": yearly_csv,
            "village_timeseries_seasonal_csv": seasonal_csv,
        }

        return villages_y, villages_s, years, stats

    # ------------------------------------------------------------------
    # 4. Mann-Kendall on yearly data
    # ------------------------------------------------------------------
    def perform_mann_kendall_analysis(
        self,
        villages_y: gpd.GeoDataFrame,
        trend_years: List[str],
        all_years: List[str],
    ) -> pd.DataFrame:
        missing = [y for y in trend_years if y not in all_years]
        if missing:
            trend_years = [y for y in trend_years if y in all_years]

        if len(trend_years) < 3:
            raise ValueError(f"Need >=3 years for MK, got {len(trend_years)}")

        results = []
        for _, row in villages_y.iterrows():
            ts = row[trend_years]
            ts.index = [int(y) for y in trend_years]
            mk = self.mann_kendall_test(ts)

            results.append(
                {
                    "Village_ID": row.get(self.VILLAGE_CODE_COL, "Unknown"),
                    "Village_Name": row.get("village", row.get("VILLAGE", "Unknown")),
                    "Block": row.get("block", row.get("BLOCK", "Unknown")),
                    "District": row.get("district", row.get("DISTRICT", "Unknown")),
                    "SUBDIS_COD": row.get("SUBDIS_COD", "Unknown"),
                    "Mann_Kendall_Tau": mk.tau,
                    "P_Value": mk.p_value,
                    "Trend_Status": mk.trend,
                    "Sen_Slope": mk.slope,
                    "Data_Points": ts.count(),
                    "Years_Analyzed": ", ".join(trend_years),
                    "Start_Year": min([int(y) for y in trend_years]),
                    "End_Year": max([int(y) for y in trend_years]),
                    "Mean_Depth": float(ts.mean()) if ts.count() > 0 else None,
                    "Std_Depth": float(ts.std()) if ts.count() > 1 else None,
                    "Min_Depth": float(ts.min()) if ts.count() > 0 else None,
                    "Max_Depth": float(ts.max()) if ts.count() > 0 else None,
                    "Total_Years_Available": len(all_years),
                    "All_Years_Available": ", ".join(all_years),
                }
            )

        df = pd.DataFrame(results)
        color_map = {
            "Increasing": "#FA4646",
            "Decreasing": "#62D9D1",
            "No-Trend": "#95A5A6",
            "Insufficient Data": "#F39C12",
        }
        df["Color"] = df["Trend_Status"].map(color_map)
        return df

    # ------------------------------------------------------------------
    # 5. Trend map (base64 + file)
    # ------------------------------------------------------------------
    def generate_trend_map_from_geojson(
        self,
        geojson: Dict,
        years_for_trend: List[str],
        subdis_codes: Optional[List] = None,
        village_codes: Optional[List] = None,
    ) -> Tuple[Optional[str], Optional[str]]:
        try:
            polygons, colors, names = [], [], []
            for f in geojson["features"]:
                geom = shape(f["geometry"])
                if geom.geom_type == "MultiPolygon":
                    geom = list(geom.geoms)[0]
                polygons.append(geom)
                colors.append(f["properties"].get("Color", "#95A5A6"))
                names.append(f["properties"].get("Village_Name", "Unknown"))

            gdf = gpd.GeoDataFrame(
                {"geometry": polygons, "color": colors, "village_name": names}, crs="EPSG:4326"
            )
            gdf["geometry"] = gdf["geometry"].simplify(tolerance=0.0001, preserve_topology=True)

            fig, ax = plt.subplots(1, 1, figsize=(15, 12))
            gdf.plot(ax=ax, color=gdf["color"], edgecolor="blue", alpha=0.6, linewidth=1.5)

            bounds = gdf.total_bounds
            pad = 0.01
            ax.set_xlim(bounds[0] - pad, bounds[2] + pad)
            ax.set_ylim(bounds[1] - pad, bounds[3] + pad)

            try:
                import contextily as ctx

                ctx.add_basemap(ax, crs=gdf.crs, source=ctx.providers.CartoDB.Voyager, alpha=1, zoom=10)
            except Exception:
                pass

            year_range = f"{min([int(y) for y in years_for_trend])}-{max([int(y) for y in years_for_trend])}"
            info = []
            if subdis_codes:
                info.append(f"SUBDIS_COD: {', '.join(map(str, subdis_codes[:3]))}{'...' if len(subdis_codes)>3 else ''}")
            if village_codes:
                info.append(f"Villages: {', '.join(map(str, village_codes[:3]))}{'...' if len(village_codes)>3 else ''}")
            subtitle = f" ({' | '.join(info)})" if info else ""

            ax.set_title(f"Groundwater Trend Analysis Map ({year_range}){subtitle}", fontsize=14, fontweight="bold", pad=20)

            legend = [
                mpatches.Patch(color="#FF6B6B", label="Increasing (Worsening)"),
                mpatches.Patch(color="#4ECDC4", label="Decreasing (Improving)"),
                mpatches.Patch(color="#95A5A6", label="No Significant Trend"),
                mpatches.Patch(color="#F39C12", label="Insufficient Data"),
            ]
            ax.legend(handles=legend, loc="upper right", fontsize=10)

            ax.set_xlabel("LONGITUDE", fontsize=12)
            ax.set_ylabel("LATITUDE", fontsize=12)
            ax.grid(True, alpha=0.3)
            plt.tight_layout()

            # ---- file name ------------------------------------------------
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            uid = str(uuid.uuid4())[:8]
            if subdis_codes:
                tag = "_".join(map(str, subdis_codes[:3])) + ("_etc" if len(subdis_codes) > 3 else "")
                fname = f"trend_map_subdis_{tag}_{year_range}_{ts}_{uid}.png"
            elif village_codes:
                tag = "_".join(map(str, village_codes[:3])) + ("_etc" if len(village_codes) > 3 else "")
                fname = f"trend_map_villages_{tag}_{year_range}_{ts}_{uid}.png"
            else:
                fname = f"trend_map_{year_range}_{ts}_{uid}.png"

            buffer = BytesIO()
            plt.savefig(buffer, format="png", dpi=150, bbox_inches="tight", facecolor="white")
            buffer.seek(0)
            b64 = base64.b64encode(buffer.read()).decode()
            base64_str = f"data:image/png;base64,{b64}"

            # ---- save to disk --------------------------------------------
            path = os.path.join(self.temp_media_dir, fname)
            buffer.seek(0)
            with open(path, "wb") as f:
                f.write(buffer.read())

            plt.close(fig)
            buffer.close()
            return fname, base64_str

        except Exception as e:
            print(f"Map error: {e}")
            return None, None

    # ------------------------------------------------------------------
    # 6. Pie chart (trend distribution)
    # ------------------------------------------------------------------
    def generate_trend_charts(
        self,
        trend_df: pd.DataFrame,
        year_range: str,
        subdis_codes: Optional[List] = None,
        village_codes: Optional[List] = None,
    ) -> Dict[str, str]:
        charts = {}
        try:
            plt.style.use("default")
            sns.set_palette("husl")

            info = []
            if subdis_codes:
                info.append(f"SUBDIS_COD: {', '.join(map(str, subdis_codes[:3]))}{'...' if len(subdis_codes)>3 else ''}")
            if village_codes:
                info.append(f"Villages: {', '.join(map(str, village_codes[:3]))}{'...' if len(village_codes)>3 else ''}")
            ctx = f" ({' | '.join(info)})" if info else ""

            fig, ax = plt.subplots(figsize=(10, 8))
            counts = trend_df["Trend_Status"].value_counts()
            colors = ["#2ecc71", "#e74c3c", "#f39c12", "#95a5a6"]
            ax.pie(counts.values, labels=counts.index, autopct="%1.1f%%", colors=colors, startangle=90)
            ax.set_title(f"Groundwater Trend Distribution ({year_range}){ctx}", fontsize=14, fontweight="bold")

            buf = BytesIO()
            plt.savefig(buf, format="png", dpi=300, bbox_inches="tight")
            buf.seek(0)
            charts["trend_distribution"] = base64.b64encode(buf.getvalue()).decode()
            plt.close()
        except Exception as e:
            charts["error"] = str(e)
        return charts

    # ------------------------------------------------------------------
    # 7. Extract timeseries for front-end (curve + linear fit)
    # ------------------------------------------------------------------
    def extract_village_timeseries_data(
        self, villages_y: gpd.GeoDataFrame, trend_df: pd.DataFrame, all_years: List[str]
    ) -> List[Dict]:
        merged = villages_y.merge(
            trend_df[["Village_ID", "Trend_Status", "Color", "Mann_Kendall_Tau", "Sen_Slope"]],
            left_on=self.VILLAGE_CODE_COL,
            right_on="Village_ID",
            how="left",
        )

        out = []
        for _, row in merged.iterrows():
            years = []
            depths = []
            for y in all_years:
                years.append(y)
                val = row.get(y)
                depths.append(float(val) if pd.notna(val) else None)

            # smooth curve (moving avg)
            s = pd.Series(depths).rolling(window=3, min_periods=1, center=True).mean().round(2).tolist()

            # linear fit
            valid = [(i, d) for i, d in enumerate(depths) if d is not None]
            if len(valid) >= 2:
                xs = np.array([int(years[i]) for i, _ in valid])
                ys = np.array([d for _, d in valid])
                slope, intercept = np.polyfit(xs, ys, 1)
                line = [round(intercept + slope * int(y), 2) for y in years]
            else:
                line = [None] * len(years)

            out.append(
                {
                    "village_id": str(row.get("Village_ID", row.get(self.VILLAGE_CODE_COL, "Unknown"))),
                    "village_name": str(row.get("village", row.get("VILLAGE", "Unknown"))),
                    "block": str(row.get("block", row.get("BLOCK", "Unknown"))),
                    "district": str(row.get("district", row.get("DISTRICT", "Unknown"))),
                    "subdis_cod": str(row.get("SUBDIS_COD", "Unknown")),
                    "trend_status": str(row.get("Trend_Status", "No Data")),
                    "color": str(row.get("Color", "#95A5A6")),
                    "mann_kendall_tau": float(row["Mann_Kendall_Tau"]) if pd.notna(row.get("Mann_Kendall_Tau")) else None,
                    "sen_slope": float(row["Sen_Slope"]) if pd.notna(row.get("Sen_Slope")) else None,
                    "years": years,
                    "depths": s,
                    "trend_line": line,
                }
            )
        return out

    # ------------------------------------------------------------------
    # 8. GeoJSON for the map
    # ------------------------------------------------------------------
    def create_village_json_for_map(
        self, villages_y: gpd.GeoDataFrame, trend_df: pd.DataFrame, all_years: List[str]
    ) -> Dict:
        merged = villages_y.merge(trend_df, left_on=self.VILLAGE_CODE_COL, right_on="Village_ID", how="left")
        if merged.crs != "EPSG:4326":
            merged = merged.to_crs("EPSG:4326")

        features = []
        skipped = 0
        for _, row in merged.iterrows():
            try:
                geom = row.geometry
                if geom is None or geom.is_empty:
                    skipped += 1
                    continue
                if not geom.is_valid:
                    from shapely.validation import make_valid

                    geom = make_valid(geom)
                    if not geom.is_valid:
                        skipped += 1
                        continue

                # coordinates
                if geom.geom_type == "Polygon":
                    coords = [[[float(x), float(y)] for x, y in geom.exterior.coords]]
                    for interior in geom.interiors:
                        coords.append([[float(x), float(y)] for x, y in interior.coords])
                elif geom.geom_type == "MultiPolygon":
                    coords = []
                    for g in geom.geoms:
                        if g.is_valid and not g.is_empty:
                            outer = [[float(x), float(y)] for x, y in g.exterior.coords]
                            poly = [outer]
                            for interior in g.interiors:
                                poly.append([[float(x), float(y)] for x, y in interior.coords])
                            coords.append(poly)
                else:
                    skipped += 1
                    continue

                ts = {}
                for y in all_years:
                    v = row.get(y)
                    ts[y] = float(v) if pd.notna(v) else None

                feature = {
                    "type": "Feature",
                    "geometry": {"type": geom.geom_type, "coordinates": coords},
                    "properties": {
                        "Village_ID": str(row.get("Village_ID", row.get(self.VILLAGE_CODE_COL, "Unknown"))),
                        "Village_Name": str(row.get("Village_Name", row.get("village", row.get("VILLAGE", "Unknown")))),
                        "Block": str(row.get("Block", row.get("block", row.get("BLOCK", "Unknown")))),
                        "District": str(row.get("District", row.get("district", row.get("DISTRICT", "Unknown")))),
                        "SUBDIS_COD": str(row.get("SUBDIS_COD", "Unknown")),
                        "Mann_Kendall_Tau": float(row["Mann_Kendall_Tau"]) if pd.notna(row.get("Mann_Kendall_Tau")) else None,
                        "P_Value": float(row["P_Value"]) if pd.notna(row.get("P_Value")) else None,
                        "Trend_Status": str(row.get("Trend_Status", "No Data")),
                        "Sen_Slope": float(row["Sen_Slope"]) if pd.notna(row.get("Sen_Slope")) else None,
                        "Data_Points": int(row["Data_Points"]) if pd.notna(row.get("Data_Points")) else 0,
                        "Years_Analyzed": str(row.get("Years_Analyzed", "")),
                        "Mean_Depth": float(row["Mean_Depth"]) if pd.notna(row.get("Mean_Depth")) else None,
                        "Color": str(row.get("Color", "#95A5A6")),
                        "time_series": ts,
                        "bounds": {
                            "minLng": float(geom.bounds[0]),
                            "minLat": float(geom.bounds[1]),
                            "maxLng": float(geom.bounds[2]),
                            "maxLat": float(geom.bounds[3]),
                        },
                    },
                }
                features.append(feature)
            except Exception as e:
                skipped += 1
                continue

        return {
            "type": "FeatureCollection",
            "features": features,
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        }

    # ------------------------------------------------------------------
    # 9. Summary tables
    # ------------------------------------------------------------------
    def create_summary_tables(self, trend_df: pd.DataFrame) -> Dict:
        tr = trend_df["Trend_Status"].value_counts().reset_index()
        tr.columns = ["Trend_Status", "Count"]
        tr["Percentage"] = (tr["Count"] / len(trend_df) * 100).round(2)
        return {"trend_summary": tr.to_dict("records")}

    # ------------------------------------------------------------------
    # 10. Final response builder (identical to Django version)
    # ------------------------------------------------------------------
    def build_response(
        self,
        villages_y: gpd.GeoDataFrame,
        trend_df: pd.DataFrame,
        all_years: List[str],
        years_for_trend: List[str],
        timestamp: str,
        subdis_codes: Optional[List] = None,
        village_codes: Optional[List] = None,
        timeseries_stats: Optional[Dict] = None,
    ) -> Dict:
        year_range = f"{min(years_for_trend)}-{max(years_for_trend)}"
        charts = self.generate_trend_charts(trend_df, year_range, subdis_codes, village_codes)
        geojson = self.create_village_json_for_map(villages_y, trend_df, all_years)
        tables = self.create_summary_tables(trend_df)
        timeseries_data = self.extract_village_timeseries_data(villages_y, trend_df, all_years)

        map_file, map_b64 = self.generate_trend_map_from_geojson(
            geojson, years_for_trend, subdis_codes, village_codes
        )

        counts = trend_df["Trend_Status"].value_counts()
        summary_stats = {
            "file_info": {
                "total_villages": len(trend_df),
                "analysis_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "analysis_timestamp": timestamp,
                "filtered_by_subdis_cod": subdis_codes or [],
                "filtered_by_village_codes": village_codes or [],
                "trend_map_filename": map_file,
                "trend_map_base64": map_b64,
                "wells_csv_filename": timeseries_stats.get("wells_csv_filename", ""),
                "trend_csv_filename": timeseries_stats.get("trend_csv_filename", ""),
                "timeseries_yearly_csv_filename": timeseries_stats.get("village_timeseries_yearly_csv", ""),
                "timeseries_seasonal_csv_filename": timeseries_stats.get("village_timeseries_seasonal_csv", ""),
            },
            "trend_distribution": {
                "increasing": int(counts.get("Increasing", 0)),
                "decreasing": int(counts.get("Decreasing", 0)),
                "no_trend": int(counts.get("No-Trend", 0)),
                "insufficient_data": int(counts.get("Insufficient Data", 0)),
                "total": len(trend_df),
            },
        }

        color_mapping = {
            "Increasing": {"color": "#FF6B6B", "description": "Groundwater level decreasing (depth increasing)"},
            "Decreasing": {"color": "#4ECDC4", "description": "Groundwater level rising (depth decreasing)"},
            "No-Trend": {"color": "#95A5A6", "description": "No significant trend detected"},
            "Insufficient Data": {"color": "#F39C12", "description": "Insufficient data for analysis"},
        }

        villages = [
            {
                "Village_ID": r["Village_ID"],
                "Village_Name": r["Village_Name"],
                "Block": r["Block"],
                "District": r["District"],
                "SUBDIS_COD": r["SUBDIS_COD"],
                "Trend_Status": r["Trend_Status"],
                "Color": r["Color"],
                "Mann_Kendall_Tau": float(r["Mann_Kendall_Tau"]) if pd.notna(r["Mann_Kendall_Tau"]) else None,
                "P_Value": float(r["P_Value"]) if pd.notna(r["P_Value"]) else None,
                "Sen_Slope": float(r["Sen_Slope"]) if pd.notna(r["Sen_Slope"]) else None,
                "Data_Points": int(r["Data_Points"]),
                "Years_Analyzed": r["Years_Analyzed"],
                "Mean_Depth": float(r["Mean_Depth"]) if pd.notna(r["Mean_Depth"]) else None,
            }
            for _, r in trend_df.iterrows()
        ]

        return {
            "success": True,
            "summary_stats": summary_stats,
            "village_geojson": geojson,
            "villages": villages,
            "charts": charts,
            "summary_tables": tables,
            "color_mapping": color_mapping,
            "total_villages": len(villages),
            "analysis_timestamp": timestamp,
            "filtered_by_subdis_cod": subdis_codes or [],
            "filtered_by_village_codes": village_codes or [],
            "trend_map_filename": map_file,
            "trend_map_base64": map_b64,
            "village_timeseries_data": timeseries_data,
            "all_years": all_years,
        }