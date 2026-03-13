from __future__ import annotations

import base64
import io
from collections import defaultdict
from datetime import datetime
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
from sqlalchemy.orm import Session

from app.api.service.swa.analytics_service import SurfaceWaterAnalyticsService
from app.database.crud.swa.flow import SwaCrud


class SwaAdminService:
    def __init__(self, db: Session):
        self.crud = SwaCrud(db)
        self.analytics = SurfaceWaterAnalyticsService(db)

    def _normalize_codes(self, values: Any) -> list[int]:
        if values is None:
            return []
        if isinstance(values, str):
            return [int(v.strip()) for v in values.split(",") if v.strip()]
        if isinstance(values, int):
            return [values]
        return [int(v) for v in values]

    def village_fdc(self, subdistrict_codes_input: Any, vlcodes_input: Any) -> dict[str, Any]:
        subdistrict_codes = self._normalize_codes(subdistrict_codes_input)
        vlcodes = self._normalize_codes(vlcodes_input)

        results: dict[str, Any] = {}
        errors: dict[str, str] = {}

        if subdistrict_codes:
            for sd_code in subdistrict_codes:
                rows = self.crud.get_adminflow_by_subdistrict(sd_code)
                if not rows:
                    errors[str(sd_code)] = f"No villages found for subdistrict {sd_code}"
                    continue

                grouped: dict[int, dict[str, Any]] = {}
                for row in rows:
                    grouped.setdefault(int(row.vlcode), {"name": row.village, "flows": []})["flows"].append(
                        float(row.surq_cnt_m3 or 0.0)
                    )

                sd_results: dict[str, Any] = {}
                for vlcode, data in grouped.items():
                    computed = self.analytics.compute_fdc_and_quantiles(data["flows"])
                    if not computed:
                        errors[str(vlcode)] = f"No data found for village {data['name']}"
                        continue
                    sd_results[str(vlcode)] = {"village": data["name"], **computed}
                results[str(sd_code)] = sd_results

        if vlcodes:
            for vlcode in vlcodes:
                rows = self.crud.get_adminflow_by_vlcode(vlcode)
                if not rows:
                    errors[str(vlcode)] = f"No data found for village code {vlcode}"
                    continue

                flows = [float(r.surq_cnt_m3 or 0.0) for r in rows]
                computed = self.analytics.compute_fdc_and_quantiles(flows)
                if not computed:
                    errors[str(vlcode)] = f"Could not compute FDC for {rows[0].village}"
                    continue

                results[str(vlcode)] = {
                    "village": rows[0].village,
                    "subdistrict_code": rows[0].subdistrict_code_id,
                    **computed,
                }

        return {
            "subdistrict_codes": subdistrict_codes or None,
            "vlcodes": vlcodes or None,
            "results": results,
            "errors": errors or None,
        }

    def village_fdc_image(self, vlcode: int) -> dict[str, Any]:
        rows = self.crud.get_adminflow_by_vlcode(vlcode)
        if not rows:
            raise ValueError(f"No data found for village {vlcode}")

        flows = [float(r.surq_cnt_m3 or 0.0) for r in rows]
        computed = self.analytics.compute_fdc_and_quantiles(flows)
        if not computed:
            raise ValueError(f"Could not compute FDC for {rows[0].village}")

        q25 = computed["quantiles"].get("Q25")
        return {
            "vlcode": vlcode,
            "village": rows[0].village,
            "image_base64": self.analytics.render_fdc_png(
                computed["exceed_prob"], computed["sorted_flows"], rows[0].village, q25
            ),
            "quantiles": computed["quantiles"],
        }

    def _process_village_surplus(self, rows: list[Any]) -> dict[str, Any]:
        output: dict[str, Any] = {}
        grouped: dict[tuple[int, str], list[dict[str, float | int]]] = defaultdict(list)

        for row in rows:
            grouped[(int(row.vlcode), row.village)].append(
                {"month": int(row.mon), "flow": float(row.surq_cnt_m3) if row.surq_cnt_m3 is not None else 0.0}
            )

        for (vlcode, village), records in grouped.items():
            monthly: dict[int, list[float]] = defaultdict(list)
            for record in records:
                monthly[int(record["month"])].append(float(record["flow"]))

            averaged_data = []
            for month in sorted(monthly.keys()):
                values = [f for f in monthly[month] if f is not None and f >= 0]
                if values:
                    averaged_data.append({"month": month, "flow": float(np.mean(values))})

            if not averaged_data:
                output[str(vlcode)] = {"error": f"No valid data for {village} ({vlcode})"}
                continue

            all_flows = [e["flow"] for e in averaged_data]
            q25 = self.analytics.flow_at_percentile(all_flows, 25)
            surplus_flows = []
            total_surplus_m3 = 0.0

            for entry in averaged_data:
                surplus = max(0.0, float(entry["flow"]) - q25)
                surplus_flows.append(surplus)
                total_surplus_m3 += surplus * 30 * 86400

            output[str(vlcode)] = {
                "vlcode": vlcode,
                "village": village,
                "Q25_m3": round(float(q25), 3),
                "surplus_runoff_Mm3": round(float(total_surplus_m3 / 1e6), 3),
                "statistics": {
                    "max_flow": round(float(np.max(all_flows)), 3),
                    "min_flow": round(float(np.min(all_flows)), 3),
                    "mean_flow": round(float(np.mean(all_flows)), 3),
                    "surplus_months": int(sum(1 for s in surplus_flows if s > 0)),
                    "total_data_points": len(averaged_data),
                },
                "timeseries": [{"month": e["month"], "flow": round(float(e["flow"]), 3)} for e in averaged_data],
            }

        return output

    def village_surplus(self, subdistrict_codes_input: Any, vlcodes_input: Any) -> dict[str, Any]:
        subdistrict_codes = self._normalize_codes(subdistrict_codes_input)
        vlcodes = self._normalize_codes(vlcodes_input)

        final_results: dict[str, Any] = {}
        errors: dict[str, str] = {}

        if subdistrict_codes:
            for sd_code in subdistrict_codes:
                rows = self.crud.get_adminflow_by_subdistrict(sd_code)
                if not rows:
                    errors[str(sd_code)] = f"No data found for subdistrict {sd_code}"
                    continue
                final_results[str(sd_code)] = self._process_village_surplus(rows)

        if vlcodes:
            for vlcode in vlcodes:
                rows = self.crud.get_adminflow_by_vlcode(vlcode)
                if not rows:
                    errors[str(vlcode)] = f"No data found for village code {vlcode}"
                    continue
                final_results[str(vlcode)] = self._process_village_surplus(rows)

        return {
            "subdistrict_codes": subdistrict_codes or None,
            "vlcodes": vlcodes or None,
            "results": final_results,
            "errors": errors or None,
        }

    def _render_village_surplus_png(self, timeseries: list[dict[str, float | int]], q25: float, vlcode: int, village: str) -> str:
        months = [int(p["month"]) for p in timeseries]
        flows = [float(p["flow"]) for p in timeseries]

        fig, ax = plt.subplots(figsize=(1000 / 140, 420 / 140), dpi=140)
        ax.plot(months, flows, color="#16a34a", linewidth=2, marker="o", label=f"{village} ({vlcode}) Flow")
        ax.set_xlabel("Month")
        ax.set_ylabel("Flow (m3)")
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
        ax.axhline(y=q25, color="#dc2626", linestyle="--", linewidth=2, label="Q25 Threshold")
        ax.set_title("Village Surplus Runoff Analysis")
        ax.legend(loc="best")

        buf = io.BytesIO()
        fig.tight_layout()
        fig.savefig(buf, format="png", dpi=140, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def village_surplus_image(self, vlcode: int) -> dict[str, Any]:
        rows = self.crud.get_adminflow_by_vlcode(vlcode)
        if not rows:
            raise ValueError(f"No data found for vlcode {vlcode}")

        records = [{"month": int(r.mon), "flow": float(r.surq_cnt_m3 or 0.0)} for r in rows]
        monthly: dict[int, list[float]] = defaultdict(list)
        for r in records:
            monthly[r["month"]].append(r["flow"])

        averaged = []
        for month in sorted(monthly.keys()):
            vals = [f for f in monthly[month] if f is not None and f >= 0]
            if vals:
                averaged.append({"month": month, "flow": float(np.mean(vals))})

        if not averaged:
            raise ValueError(f"No valid data for village {rows[0].village} ({vlcode})")

        q25 = self.analytics.flow_at_percentile([e["flow"] for e in averaged], 25)
        return {
            "vlcode": vlcode,
            "village": rows[0].village,
            "Q25_m3": round(float(q25), 3),
            "image_base64": self._render_village_surplus_png(averaged, q25, vlcode, rows[0].village),
        }

    def admin_eflow(self, subdistrict_codes: list[int] | None, vlcodes: list[int] | None) -> dict[str, Any]:
        if subdistrict_codes:
            rows = self.crud.get_adminflow_by_subdistrict_codes(subdistrict_codes)
        else:
            rows = self.crud.get_adminflow_by_vlcodes(vlcodes or [])

        if not rows:
            return {}

        grouped: dict[int, dict[str, Any]] = {}
        for row in rows:
            grouped.setdefault(
                int(row.vlcode),
                {
                    "village": row.village,
                    "subdistrict_code": row.subdistrict_code_id,
                    "month_flows": defaultdict(list),
                },
            )
            lps = (float(row.surq_cnt_m3 or 0.0) / 86400.0) * 1000.0
            grouped[int(row.vlcode)]["month_flows"][int(row.mon)].append(lps)

        all_results: dict[str, Any] = {}
        for vlcode, data in grouped.items():
            days = sorted(data["month_flows"].keys())
            flows = np.array([float(np.mean(data["month_flows"][m])) for m in days], dtype=float)
            if flows.size == 0:
                all_results[str(vlcode)] = {
                    "vlcode": vlcode,
                    "village": data["village"],
                    "subdistrict_code": data["subdistrict_code"],
                    "error": "No valid flow data",
                }
                continue

            qmaf = float(np.mean(flows))
            flows_sorted = np.sort(flows)[::-1]
            n = len(flows_sorted)
            ranks = np.arange(1, n + 1)
            prob = ranks / (n + 1) * 100.0

            def fdc_val(exceed_prob: float) -> float:
                return float(np.interp(exceed_prob, prob, flows_sorted))

            thresholds = {
                "FDC-Q95": fdc_val(95),
                "FDC-Q90": fdc_val(90),
                "Tennant-10%": 0.1 * qmaf,
                "Tennant-30%": 0.3 * qmaf,
                "Tennant-60%": 0.6 * qmaf,
                "Tessmann": 0.4 * qmaf if qmaf > 0.4 * float(np.mean(flows)) else float(np.mean(flows)),
                "Smakhtin": 0.2 * qmaf,
            }

            summary = {}
            curves = {}
            for method_key, threshold in thresholds.items():
                surplus_lps = np.where(flows > threshold, flows - threshold, 0.0)
                surplus_liters = float(np.sum(surplus_lps * 86400.0))
                surplus_ml = surplus_liters / 1e6

                summary[method_key] = {
                    "threshold_Lps": float(threshold),
                    "surplus_L": round(surplus_liters, 3),
                    "surplus_ML": round(surplus_ml, 6),
                }
                curves[method_key] = {
                    "days": days,
                    "flows_Lps": flows.tolist(),
                    "threshold_Lps": float(threshold),
                }

            all_results[str(vlcode)] = {
                "vlcode": vlcode,
                "village": data["village"],
                "subdistrict_code": int(data["subdistrict_code"] or 0),
                "summary": summary,
                "curves": curves,
            }

        return all_results

    def _render_admin_eflow_png(
        days: list[int],
        flows_lps: list[float],
        threshold_lps: float,
        village_name: str,
        vlcode: int,
        method_key: str,
        surplus_l: float,
        surplus_ml: float,
    ) -> str:
        x = np.array(days, dtype=float)
        y = np.array(flows_lps, dtype=float)

        fig, ax = plt.subplots(figsize=(1000 / 140, 420 / 140), dpi=140)
        ax.plot(x, y, color="#2563eb", linewidth=2, marker="o", markersize=4, label="Average Flow (L/s)")
        ax.axhline(
            y=float(threshold_lps),
            color="#7c3aed",
            linestyle="--",
            linewidth=2,
            label=f"{method_key} threshold ({threshold_lps:.4f} L/s)",
        )

        thr_arr = np.full_like(y, float(threshold_lps))
        mask = y > thr_arr
        if np.any(mask):
            ax.fill_between(x, y, thr_arr, where=mask, interpolate=True, alpha=0.25, color="#16a34a", label="Surplus area")

        ax.set_xlabel("Day / Month")
        ax.set_ylabel("Flow (L/s)")
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
        ax.set_title(f"Eflow: {method_key} - {village_name} ({vlcode})")
        ax.legend(loc="best")

        annotation = f"Surplus: {surplus_ml:.6f} ML  ({int(round(surplus_l)):,} L)"
        ax.text(
            0.02,
            0.98,
            annotation,
            transform=ax.transAxes,
            fontsize=10,
            verticalalignment="top",
            bbox={"boxstyle": "round,pad=0.3", "fc": "white", "ec": "#999999", "alpha": 0.8},
        )

        buf = io.BytesIO()
        fig.tight_layout()
        fig.savefig(buf, format="png", dpi=140, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def admin_eflow_image(self, vlcode: int, method_key: str) -> dict[str, Any]:
        rows = self.crud.get_adminflow_by_vlcode(vlcode)
        if not rows:
            raise ValueError("No data found")

        month_flows: dict[int, list[float]] = defaultdict(list)
        for row in rows:
            month_flows[int(row.mon)].append((float(row.surq_cnt_m3 or 0.0) / 86400.0) * 1000.0)

        days = sorted(month_flows.keys())
        flows = np.array([float(np.mean(month_flows[m])) for m in days], dtype=float)
        if flows.size == 0:
            raise ValueError("No valid flow data")

        qmaf = float(np.mean(flows))
        flows_sorted = np.sort(flows)[::-1]
        n = len(flows_sorted)
        ranks = np.arange(1, n + 1)
        prob = ranks / (n + 1) * 100.0

        def fdc_val(exceed_prob: float) -> float:
            return float(np.interp(exceed_prob, prob, flows_sorted))

        thresholds = {
            "FDC-Q95": fdc_val(95),
            "FDC-Q90": fdc_val(90),
            "Tennant-10%": 0.1 * qmaf,
            "Tennant-30%": 0.3 * qmaf,
            "Tennant-60%": 0.6 * qmaf,
            "Tessmann": 0.4 * qmaf if qmaf > 0.4 * float(np.mean(flows)) else float(np.mean(flows)),
            "Smakhtin": 0.2 * qmaf,
        }

        if method_key not in thresholds:
            raise ValueError("Invalid method_key")

        threshold_lps = float(thresholds[method_key])
        surplus_lps = np.where(flows > threshold_lps, flows - threshold_lps, 0.0)
        surplus_liters = float(np.sum(surplus_lps * 86400.0))
        surplus_ml = surplus_liters / 1e6

        image_b64 = self._render_admin_eflow_png(
            days,
            flows.tolist(),
            threshold_lps,
            rows[0].village,
            vlcode,
            method_key,
            surplus_liters,
            surplus_ml,
        )

        return {
            "vlcode": vlcode,
            "method_key": method_key,
            "threshold_Lps": threshold_lps,
            "surplus_L": round(surplus_liters, 3),
            "surplus_ML": round(surplus_ml, 6),
            "image_base64": image_b64,
        }

    def _render_climate_admin_png(self, points: list[dict[str, Any]], village: str, sd_code: str, source_id: int, start_year: int, end_year: int) -> str:
        dates = [datetime(p["year"], p["mon"], 1) for p in points]
        runoff = [p["surq_cnt_m3"] for p in points]

        fig, ax = plt.subplots(figsize=(1200 / 140, 420 / 140), dpi=140)
        ax.plot(dates, runoff, color="#16a34a", linewidth=2, marker="o", markersize=3, label=f"{village} Runoff")
        ax.set_xlabel("Year-Month")
        ax.set_ylabel("Surface Runoff (m3)")
        ax.xaxis.set_major_locator(mdates.MonthLocator(interval=3))
        ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%b"))
        ax.grid(True, linestyle="--", linewidth=0.5, alpha=0.6)
        ax.set_title(f"{village} | Subdistrict {sd_code}, Source {source_id}, Years {start_year}-{end_year}")
        ax.legend(loc="best")
        fig.autofmt_xdate()

        buf = io.BytesIO()
        fig.tight_layout()
        fig.savefig(buf, format="png", dpi=140, facecolor="white")
        plt.close(fig)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def admin_climate(
        self,
        subdistrict_codes: list[int] | None,
        vlcodes: list[int] | None,
        source_id: int,
        start_year: int,
        end_year: int,
    ) -> dict[str, Any]:
        results: dict[str, Any] = {}

        if subdistrict_codes:
            for sd_code in subdistrict_codes:
                rows = self.crud.get_climate_admin_by_subdistrict(sd_code, source_id, start_year, end_year)
                key = f"{sd_code}_{source_id}"
                if not rows:
                    results[key] = {
                        "error": f"No data found for subdistrict {sd_code}, source {source_id}, years {start_year}-{end_year}"
                    }
                    continue

                villages: dict[int, dict[str, Any]] = {}
                for row in rows:
                    villages.setdefault(int(row.vlcode), {"village": row.village, "points": {}})
                    ym = (int(row.year), int(row.mon))
                    villages[int(row.vlcode)]["points"].setdefault(ym, 0.0)
                    villages[int(row.vlcode)]["points"][ym] += float(row.surq_cnt_m3 or 0.0)

                for vlcode, vdata in villages.items():
                    points = [
                        {"year": y, "mon": m, "surq_cnt_m3": float(v)}
                        for (y, m), v in sorted(vdata["points"].items(), key=lambda x: (x[0][0], x[0][1]))
                    ]
                    total_runoff = sum(p["surq_cnt_m3"] for p in points)
                    per_year = {}
                    for y in range(start_year, end_year + 1):
                        y_points = [p for p in points if p["year"] == y]
                        if not y_points:
                            continue
                        total = sum(p["surq_cnt_m3"] for p in y_points)
                        per_year[str(y)] = {
                            "total_runoff": round(total, 3),
                            "avg_monthly_runoff": round(total / len(y_points), 3),
                        }

                    results[f"{sd_code}_{source_id}_{vlcode}"] = {
                        "subdistrict_code": sd_code,
                        "source_id": source_id,
                        "vlcode": vlcode,
                        "village": vdata["village"],
                        "start_year": start_year,
                        "end_year": end_year,
                        "data": {"points": points},
                        "summary": {
                            "total_runoff": round(total_runoff, 3),
                            "avg_monthly_runoff": round(total_runoff / max(1, len(points)), 3),
                            "per_year": per_year,
                        },
                    }

        if vlcodes:
            for vlcode in vlcodes:
                rows = self.crud.get_climate_admin_by_vlcode(vlcode, source_id, start_year, end_year)
                key = f"{vlcode}_{source_id}"
                if not rows:
                    results[key] = {
                        "error": f"No data found for village {vlcode}, source {source_id}, years {start_year}-{end_year}"
                    }
                    continue

                monthly_sum: dict[tuple[int, int], float] = defaultdict(float)
                for row in rows:
                    monthly_sum[(int(row.year), int(row.mon))] += float(row.surq_cnt_m3 or 0.0)

                points = [
                    {"year": y, "mon": m, "surq_cnt_m3": float(v)}
                    for (y, m), v in sorted(monthly_sum.items(), key=lambda x: (x[0][0], x[0][1]))
                ]
                total_runoff = sum(p["surq_cnt_m3"] for p in points)
                per_year = {}
                for y in range(start_year, end_year + 1):
                    y_points = [p for p in points if p["year"] == y]
                    if not y_points:
                        continue
                    total = sum(p["surq_cnt_m3"] for p in y_points)
                    per_year[str(y)] = {
                        "total_runoff": round(total, 3),
                        "avg_monthly_runoff": round(total / len(y_points), 3),
                    }

                results[f"{rows[0].subdistrict_code_id}_{source_id}_{vlcode}"] = {
                    "subdistrict_code": rows[0].subdistrict_code_id,
                    "source_id": source_id,
                    "vlcode": vlcode,
                    "village": rows[0].village,
                    "start_year": start_year,
                    "end_year": end_year,
                    "data": {"points": points},
                    "summary": {
                        "total_runoff": round(total_runoff, 3),
                        "avg_monthly_runoff": round(total_runoff / max(1, len(points)), 3),
                        "per_year": per_year,
                    },
                }

        return results

    def admin_climate_image(self, vlcode: int, source_id: int, start_year: int, end_year: int) -> dict[str, Any]:
        rows = self.crud.get_climate_admin_by_vlcode(vlcode, source_id, start_year, end_year)
        if not rows:
            raise ValueError(f"No data found for vlcode {vlcode}, source {source_id}")

        monthly_sum: dict[tuple[int, int], float] = defaultdict(float)
        for row in rows:
            monthly_sum[(int(row.year), int(row.mon))] += float(row.surq_cnt_m3 or 0.0)

        points = [
            {"year": y, "mon": m, "surq_cnt_m3": float(v)}
            for (y, m), v in sorted(monthly_sum.items(), key=lambda x: (x[0][0], x[0][1]))
        ]

        return {
            "vlcode": vlcode,
            "village": rows[0].village,
            "source_id": source_id,
            "start_year": start_year,
            "end_year": end_year,
            "image_base64": self._render_climate_admin_png(
                points,
                rows[0].village,
                str(rows[0].subdistrict_code_id or "N/A"),
                source_id,
                start_year,
                end_year,
            ),
        }
