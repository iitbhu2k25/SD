from __future__ import annotations

import base64
import io
import os
from datetime import datetime
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Rectangle
from sqlalchemy.orm import Session

from app.database.crud.swa.flow import SwaCrud


class SubbasinService:
    def __init__(self, db: Session):
        self.crud = SwaCrud(db)

    def get_subbasins(self) -> list[dict[str, int]]:
        sub_ids = self.crud.get_distinct_subbasins()
        return [{"sub": sub_id} for sub_id in sub_ids]

    def generate_subbasin_map(self, subbasin_ids: list[int], media_root: str) -> dict[str, str]:
        try:
            import geopandas as gpd
        except ImportError as exc:
            raise RuntimeError("geopandas is required for generate-subbasin-map endpoint") from exc

        subbasin_path = os.path.join(
            media_root,
            "gwa_data",
            "gwa_shp",
            "varuna_subbasin_data",
            "varuna_subbasin_data.shp",
        )
        stream_path = os.path.join(media_root, "gwa_data", "gwa_shp", "Streams_clipped", "Streams_clipped.shp")

        if not os.path.exists(subbasin_path):
            raise FileNotFoundError(f"Subbasin shapefile not found at {subbasin_path}")
        if not os.path.exists(stream_path):
            raise FileNotFoundError(f"Stream shapefile not found at {stream_path}")

        subbasin_gdf = gpd.read_file(subbasin_path)
        stream_gdf = gpd.read_file(stream_path)

        if subbasin_gdf.crs != stream_gdf.crs:
            stream_gdf = stream_gdf.to_crs(subbasin_gdf.crs)

        sub_col = next((c for c in subbasin_gdf.columns if c.lower() == "subbasin"), None)
        if sub_col is None:
            raise ValueError("No 'Subbasin' column found in shapefile")

        selected_sub = subbasin_gdf[subbasin_gdf[sub_col].isin(subbasin_ids)]
        selected_streams = stream_gdf[stream_gdf[sub_col].isin(subbasin_ids)]
        if selected_sub.empty:
            raise ValueError("No matching subbasin(s) found")

        fig, ax = plt.subplots(figsize=(12, 10), dpi=300, facecolor="white")
        ax.set_facecolor("white")

        colors = ["#FF1744", "#F50057", "#D500F9", "#651FFF", "#2979FF", "#00B0FF", "#00E5FF"]
        for i, geom in enumerate(selected_sub.geometry):
            color = colors[i % len(colors)]
            gpd.GeoSeries([geom]).boundary.plot(ax=ax, color=color, linewidth=2.5, alpha=0.9)

        selected_streams.plot(ax=ax, color="blue", linewidth=0.7, label="Streams")

        bounds = selected_sub.total_bounds
        x_range = bounds[2] - bounds[0]
        y_range = bounds[3] - bounds[1]
        max_range = max(x_range, y_range)
        mid_x = (bounds[0] + bounds[2]) / 2
        mid_y = (bounds[1] + bounds[3]) / 2

        buffer = 0.02 * max_range
        ax.set_xlim(mid_x - max_range / 2 - buffer, mid_x + max_range / 2 + buffer)
        ax.set_ylim(mid_y - max_range / 2 - buffer, mid_y + max_range / 2 + buffer)

        xlim = ax.get_xlim()
        ylim = ax.get_ylim()
        x_ticks = [xlim[0] + i * (xlim[1] - xlim[0]) / 4 for i in range(5)]
        y_ticks = [ylim[0] + i * (ylim[1] - ylim[0]) / 4 for i in range(5)]
        ax.set_xticks(x_ticks)
        ax.set_yticks(y_ticks)
        ax.set_xticklabels([f"{x:.2f}" for x in x_ticks], fontsize=7, rotation=45, ha="right")
        ax.set_yticklabels([f"{y:.2f}" for y in y_ticks], fontsize=7)

        for spine in ax.spines.values():
            spine.set_visible(True)
            spine.set_color("black")
            spine.set_linewidth(1.5)

        rect = Rectangle(
            (ax.get_xlim()[0], ax.get_ylim()[0]),
            ax.get_xlim()[1] - ax.get_xlim()[0],
            ax.get_ylim()[1] - ax.get_ylim()[0],
            linewidth=4,
            edgecolor="black",
            facecolor="none",
            zorder=100,
        )
        ax.add_patch(rect)

        ax.set_title("Selected Subbasin Boundary Map", fontsize=14, fontweight="bold", pad=12)
        ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.08), ncol=2, frameon=False, fontsize=9)

        buf = io.BytesIO()
        plt.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
        plt.close(fig)
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode("utf-8")
        return {"image_base64": f"data:image/png;base64,{img_base64}"}


class SurfaceWaterAnalyticsService:
    def __init__(self, db: Session):
        self.crud = SwaCrud(db)

    def compute_fdc_and_quantiles(self, flows: list[float], targets: list[int] | None = None) -> dict[str, Any] | None:
        targets = targets or [10, 25, 50, 75, 90]
        arr = np.array([f for f in flows if f is not None], dtype=float)
        if arr.size == 0:
            return None

        sorted_flows = np.sort(arr)[::-1]
        n = sorted_flows.size
        ranks = np.arange(1, n + 1)
        exceed_prob = ranks / (n + 1.0) * 100.0

        quantiles = {}
        for target in targets:
            quantiles[f"Q{target}"] = float(np.interp(target, exceed_prob, sorted_flows))

        return {
            "n": int(n),
            "exceed_prob": exceed_prob.tolist(),
            "sorted_flows": sorted_flows.tolist(),
            "quantiles": quantiles,
        }

    def flow_at_percentile(self, flows: list[float], percentile: float) -> float:
        arr = np.array(flows, dtype=float)
        arr = arr[~np.isnan(arr)]
        arr = arr[arr >= 0]
        if arr.size == 0:
            return 0.0

        sorted_flows = np.sort(arr)[::-1]
        n = len(sorted_flows)
        ranks = np.arange(1, n + 1)
        exceed_prob = ranks / (n + 1) * 100
        return float(np.interp(percentile, exceed_prob, sorted_flows))

    def render_fdc_png(self, exceed_prob: list[float], sorted_flows: list[float], label: str, q25: float | None = None) -> str:
        fig, ax = plt.subplots(figsize=(800 / 160, 450 / 160), dpi=160)
        ax.plot(exceed_prob, sorted_flows, color="#2563eb", linewidth=2, label=label)
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
        ax.set_xlim(0, 100)
        ax.set_xlabel("Percent exceedance probability")
        ax.set_ylabel("Runoff (m3/s)")
        ax.axvline(x=25, color="#dc2626", linestyle="--", linewidth=1.5)
        if q25 is not None:
            ax.axhline(y=q25, color="#dc2626", linestyle="--", linewidth=2)
            ax.text(26, q25, "Q25", color="#dc2626", fontsize=9, va="bottom")
        ax.set_title(f"Flow Duration Curve ({label})")
        ax.legend(loc="best")

        buf = io.BytesIO()
        plt.tight_layout()
        fig.savefig(buf, format="png", dpi=160, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def render_timeseries_png(self, timeseries: list[dict[str, Any]], q25: float, sub_id: int) -> str:
        days = [int(p["day"]) for p in timeseries]
        flows = [float(p["flow"]) for p in timeseries]

        fig, ax = plt.subplots(figsize=(1000 / 140, 420 / 140), dpi=140)
        ax.plot(days, flows, color="#2563eb", linewidth=2, label=f"Subbasin {sub_id} Avg Flow")
        ax.set_xlabel("Day of Year")
        ax.set_ylabel("Flow (cms)")
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
        ax.axhline(y=q25, color="#dc2626", linestyle="--", linewidth=2, label="Q25 Threshold")
        ax.set_title("Surface Water Surplus Analysis")
        ax.legend(loc="best")

        buf = io.BytesIO()
        fig.tight_layout()
        fig.savefig(buf, format="png", dpi=140, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def render_eflow_method_png(self, days: list[int], flows: list[float], threshold: float, sub_id: int, method_key: str) -> str:
        x = np.array(days, dtype=float)
        y = np.array(flows, dtype=float)
        fig, ax = plt.subplots(figsize=(1000 / 140, 420 / 140), dpi=140)
        ax.plot(x, y, color="#2563eb", linewidth=2, marker="o", markersize=4, label="Monthly flow")
        ax.set_xlabel("Month")
        ax.set_ylabel("Flow (cms)")
        ax.set_xlim(1, 12)
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
        ax.axhline(y=float(threshold), color="#7c3aed", linestyle="--", linewidth=2, label=f"{method_key} threshold")
        ax.set_title(f"Eflow: {method_key} - Subbasin {sub_id}")
        ax.legend(loc="best")

        buf = io.BytesIO()
        fig.tight_layout()
        fig.savefig(buf, format="png", dpi=140, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def render_climate_png(self, points: list[dict[str, Any]], sub_id: int, scenario: int, start_year: int, end_year: int) -> str:
        dates = [datetime(p["year"], p["mon"], 1) for p in points]
        inflow = [p["flow_in"] for p in points]
        outflow = [p["flow_out"] for p in points]

        fig, ax = plt.subplots(figsize=(1200 / 140, 420 / 140), dpi=140)
        ax.plot(dates, inflow, color="#2563eb", linewidth=2, marker="o", markersize=3, label="Inflow")
        ax.plot(dates, outflow, color="#dc2626", linewidth=2, marker="o", markersize=3, label="Outflow")
        ax.set_xlabel("Year-Month")
        ax.set_ylabel("Flow (cms)")
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=3))
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%b"))
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
        ax.set_title(f"Subbasin {sub_id}, Scenario {scenario}, Years {start_year}-{end_year}")
        ax.legend(loc="best")
        fig.autofmt_xdate()

        buf = io.BytesIO()
        fig.tight_layout()
        fig.savefig(buf, format="png", dpi=140, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def fdc_for_subbasins(self, subs: list[int]) -> dict[str, Any]:
        results: dict[str, Any] = {}
        errors: dict[str, str] = {}

        for sub in subs:
            computed = self.compute_fdc_and_quantiles(self.crud.get_subbasin_flows(sub))
            if not computed:
                errors[str(sub)] = "No data found for this subbasin"
                continue

            q25 = computed["quantiles"].get("Q25")
            computed["image_base64"] = self.render_fdc_png(
                computed["exceed_prob"], computed["sorted_flows"], f"Subbasin {sub}", q25
            )
            results[str(sub)] = computed

        return {"subs": subs, "results": results, "errors": errors or None}

    def surplus_runoff(self, subbasins_input: Any) -> dict[str, Any]:
        if isinstance(subbasins_input, str):
            subbasins = [int(s.strip()) for s in subbasins_input.split(",") if s.strip()]
        elif isinstance(subbasins_input, int):
            subbasins = [subbasins_input]
        else:
            subbasins = [int(s) for s in subbasins_input]

        output: dict[str, Any] = {}
        for sub in subbasins:
            rows = self.crud.get_subbasin_timeseries(sub)
            if not rows:
                output[str(sub)] = {"error": f"No flow data found for subbasin {sub}"}
                continue

            yearly_data: dict[int, list[dict[str, Any]]] = {}
            for row in rows:
                yearly_data.setdefault(int(row.year), []).append(
                    {
                        "day_of_year": int(row.yyyyddd) % 1000,
                        "flow": float(row.flow_out_cms) if row.flow_out_cms is not None else 0.0,
                    }
                )

            years = sorted(yearly_data.keys())
            expected_years = [2021, 2022, 2023]
            years_to_use = [y for y in expected_years if y in years] or years

            daily_flows: dict[int, list[float]] = {}
            for year in years_to_use:
                for entry in yearly_data[year]:
                    daily_flows.setdefault(int(entry["day_of_year"]), []).append(float(entry["flow"]))

            averaged_data = []
            for day_of_year in sorted(daily_flows.keys()):
                valid_flows = [f for f in daily_flows[day_of_year] if f is not None and f >= 0]
                if valid_flows:
                    averaged_data.append({"day": day_of_year, "flow": float(np.mean(valid_flows))})

            if not averaged_data:
                output[str(sub)] = {"error": f"No valid data for subbasin {sub}"}
                continue

            all_avg_flows = [entry["flow"] for entry in averaged_data]
            q25 = self.flow_at_percentile(all_avg_flows, 25)

            surplus_flows = []
            total_surplus_volume_m3 = 0.0
            for entry in averaged_data:
                surplus = max(0.0, float(entry["flow"]) - q25)
                surplus_flows.append(surplus)
                total_surplus_volume_m3 += surplus * 86400

            surplus_volume_mm3 = total_surplus_volume_m3 / 1e6
            image_b64 = self.render_timeseries_png(averaged_data, q25, sub)

            output[str(sub)] = {
                "subbasin": sub,
                "years": years_to_use,
                "total_years_available": len(years),
                "Q25_cms": round(float(q25), 3),
                "surplus_runoff_Mm3": round(float(surplus_volume_mm3), 3),
                "statistics": {
                    "max_flow": round(float(np.max(all_avg_flows)), 3),
                    "min_flow": round(float(np.min(all_avg_flows)), 3),
                    "mean_flow": round(float(np.mean(all_avg_flows)), 3),
                    "surplus_days": int(sum(1 for s in surplus_flows if s > 0)),
                    "total_data_points": len(averaged_data),
                },
                "timeseries": [{"day": e["day"], "flow": round(float(e["flow"]), 3)} for e in averaged_data],
                "image_base64": image_b64,
            }

        return output

    def eflow(self, sub_ids: list[int]) -> dict[str, Any]:
        all_results: dict[str, Any] = {}

        for sub_id in sub_ids:
            rows = self.crud.get_subbasin_monthly(sub_id)
            if not rows:
                continue

            month_groups: dict[int, list[float]] = {}
            for row in rows:
                month_groups.setdefault(int(row.month), []).append(float(row.flow_out_cms or 0.0))

            days = sorted(month_groups.keys())
            flows = np.array([float(np.mean(month_groups[m])) for m in days], dtype=float)
            if flows.size == 0:
                continue

            qmaf = float(np.mean(flows))
            flows_sorted = np.sort(flows)[::-1]
            n = len(flows_sorted)
            ranks = np.arange(1, n + 1)
            prob = ranks / (n + 1) * 100

            def fdc_val(exceed_prob: float) -> float:
                return float(np.interp(exceed_prob, prob, flows_sorted))

            q95 = fdc_val(95)
            q90 = fdc_val(90)
            monthly_avg = np.array([float(np.mean(month_groups[m])) for m in month_groups.keys()], dtype=float)
            qmonthly_avg = float(np.mean(monthly_avg))

            thresholds = {
                "FDC-Q95": q95,
                "FDC-Q90": q90,
                "Tennant-10%": 0.1 * qmaf,
                "Tennant-30%": 0.3 * qmaf,
                "Tennant-60%": 0.6 * qmaf,
                "Tessmann": 0.4 * qmaf if qmaf > 0.4 * qmonthly_avg else qmonthly_avg,
                "Smakhtin": 0.2 * qmaf,
            }

            def compute_surplus(arr: np.ndarray, threshold: float) -> float:
                surplus = np.where(arr > threshold, arr - threshold, 0.0)
                return float(np.sum(surplus * 86400) / 1e6)

            summary = {k: compute_surplus(flows, t) for k, t in thresholds.items()}
            curves = {}
            for method_key, threshold in thresholds.items():
                curves[method_key] = {
                    "days": days,
                    "flows": flows.tolist(),
                    "threshold": float(threshold),
                    "image_base64": self.render_eflow_method_png(days, flows.tolist(), float(threshold), sub_id, method_key),
                }

            all_results[str(sub_id)] = {"summary": summary, "curves": curves}

        return all_results

    def _normalize_year_range(self, year: int | None, start_year: int | None, end_year: int | None) -> tuple[int, int]:
        if start_year is None and end_year is None and year is not None:
            return int(year), int(year)
        if start_year is not None and end_year is None:
            y = int(start_year)
            return y, y
        if start_year is None and end_year is not None:
            y = int(end_year)
            return y, y

        start = int(start_year or 2021)
        end = int(end_year or start)
        return start, end

    def climate(self, sub_ids: list[int], scenario: int, year: int | None, start_year: int | None, end_year: int | None) -> dict[str, Any]:
        start, end = self._normalize_year_range(year, start_year, end_year)
        results: dict[str, Any] = {}

        for sub_id in sub_ids:
            rows = self.crud.get_climate_drain(sub=sub_id, scenario=scenario, start_year=start, end_year=end)
            key = f"{sub_id}_{scenario}"
            if not rows:
                results[key] = {"error": f"No data found for subbasin {sub_id}, scenario {scenario}, years {start}-{end}"}
                continue

            points = []
            area_km2 = None
            for rec in rows:
                if area_km2 is None:
                    area_km2 = float(rec.areakm2)
                points.append(
                    {
                        "year": int(rec.year),
                        "mon": int(rec.mon),
                        "flow_in": float(rec.flow_incms),
                        "flow_out": float(rec.flow_outcms),
                    }
                )

            total_inflow = sum(p["flow_in"] for p in points)
            total_outflow = sum(p["flow_out"] for p in points)
            per_year: dict[str, dict[str, float]] = {}
            for y in range(start, end + 1):
                y_points = [p for p in points if p["year"] == y]
                if not y_points:
                    continue
                ti = sum(p["flow_in"] for p in y_points)
                to = sum(p["flow_out"] for p in y_points)
                per_year[str(y)] = {
                    "total_inflow": round(ti, 3),
                    "total_outflow": round(to, 3),
                    "net_flow": round(ti - to, 3),
                    "avg_monthly_inflow": round(ti / max(1, len(y_points)), 3),
                    "avg_monthly_outflow": round(to / max(1, len(y_points)), 3),
                }

            for idx, point in enumerate(points):
                point["x_index"] = idx

            results[key] = {
                "subbasin_id": sub_id,
                "scenario": scenario,
                "start_year": start,
                "end_year": end,
                "data": {"points": points, "area_km2": area_km2 or 0},
                "summary": {
                    "total_inflow": round(total_inflow, 3),
                    "total_outflow": round(total_outflow, 3),
                    "net_flow": round(total_inflow - total_outflow, 3),
                    "avg_monthly_inflow": round(total_inflow / max(1, len(points)), 3),
                    "avg_monthly_outflow": round(total_outflow / max(1, len(points)), 3),
                    "per_year": per_year,
                },
                "image_base64": self.render_climate_png(points, sub_id, scenario, start, end),
            }

        return results

    def climate_comparison(self, sub_ids: list[int], scenarios: list[int], start_year: int, end_year: int) -> dict[str, Any]:
        results: dict[str, Any] = {}

        for sub_id in sub_ids:
            for scenario in scenarios:
                rows = self.crud.get_climate_drain(sub=sub_id, scenario=scenario, start_year=start_year, end_year=end_year)
                key = f"{sub_id}_{scenario}"
                if not rows:
                    results[key] = {
                        "error": f"No data found for subbasin {sub_id}, scenario {scenario}, years {start_year}-{end_year}"
                    }
                    continue

                points = []
                area_km2 = None
                for rec in rows:
                    if area_km2 is None:
                        area_km2 = float(rec.areakm2)
                    points.append(
                        {
                            "year": int(rec.year),
                            "mon": int(rec.mon),
                            "flow_in": float(rec.flow_incms),
                            "flow_out": float(rec.flow_outcms),
                        }
                    )

                total_inflow = sum(p["flow_in"] for p in points)
                total_outflow = sum(p["flow_out"] for p in points)
                per_year: dict[str, dict[str, float]] = {}
                for y in range(start_year, end_year + 1):
                    y_points = [p for p in points if p["year"] == y]
                    if not y_points:
                        continue
                    ti = sum(p["flow_in"] for p in y_points)
                    to = sum(p["flow_out"] for p in y_points)
                    per_year[str(y)] = {
                        "total_inflow": round(ti, 3),
                        "total_outflow": round(to, 3),
                        "net_flow": round(ti - to, 3),
                        "avg_monthly_inflow": round(ti / max(1, len(y_points)), 3),
                        "avg_monthly_outflow": round(to / max(1, len(y_points)), 3),
                    }

                for idx, point in enumerate(points):
                    point["x_index"] = idx

                results[key] = {
                    "subbasin_id": sub_id,
                    "scenario": scenario,
                    "start_year": start_year,
                    "end_year": end_year,
                    "data": {"points": points, "area_km2": area_km2 or 0},
                    "summary": {
                        "total_inflow": round(total_inflow, 3),
                        "total_outflow": round(total_outflow, 3),
                        "net_flow": round(total_inflow - total_outflow, 3),
                        "avg_monthly_inflow": round(total_inflow / max(1, len(points)), 3),
                        "avg_monthly_outflow": round(total_outflow / max(1, len(points)), 3),
                        "per_year": per_year,
                    },
                    "image_base64": self.render_climate_png(points, sub_id, scenario, start_year, end_year),
                }

        return results
