
import base64
import io
import json
import math
import os
import uuid
from typing import Any

import requests
from matplotlib import pyplot as plt
from sqlalchemy.orm import Session

from app.conf.settings import Settings
from app.database.crud.basic.basic import BasicCrud

class BasicService:
    def __init__(self, db: Session):
        self.db = db
        self.crud = BasicCrud(db)
        self.settings = Settings()
        self.temp_dir = self.settings.TEMP_DIR

    def get_states(self):
        rows = self.crud.get_states()
        return [{"state_code": row.state_code, "state_name": row.state_name} for row in rows]

    def get_districts(self, state_code: int):
        rows = self.crud.get_districts(state_code)
        return [{"district_code": row.district_code, "district_name": row.district_name, "state_code": row.state_code} for row in rows]

    def get_subdistricts(self, district_codes: list[int]):
        rows = self.crud.get_subdistricts(district_codes)
        return [{"subdistrict_code": row.subdistrict_code, "subdistrict_name": row.subdistrict_name, "district_code": row.district_code} for row in rows]

    def get_villages(self, subdistrict_codes: list[int]):
        rows = self.crud.get_villages(subdistrict_codes)
        return [
            {
                "village_code": row.village_code,
                "village_name": row.village_name,
                "population_2011": row.population_2011,
                "subdistrict_code": row.subdistrict_code,
            }
            for row in rows
        ]

    def _extract_id_list(self, value: Any) -> list[int]:
        if value is None:
            return []
        if isinstance(value, dict):
            return [int(value["id"])] if value.get("id") is not None else []
        if isinstance(value, list):
            output: list[int] = []
            for item in value:
                if isinstance(item, dict) and item.get("id") is not None:
                    output.append(int(item["id"]))
                elif item is not None:
                    output.append(int(item))
            return output
        return [int(value)]

    def _ensure_village_subdistrict(self, villages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        village_ids = [int(v["id"]) for v in villages if v.get("id") is not None]
        if not village_ids:
            return villages

        mapping = self.crud.get_village_subdistrict_map(village_ids)
        normalized = []
        for village in villages:
            item = dict(village)
            vid = int(item["id"])
            if mapping.get(vid) is not None:
                item["subDistrictId"] = int(mapping[vid])
            normalized.append(item)
        return normalized

    def _population_stats(self, subdistrict_ids: list[int]) -> list[dict[str, Any]]:
        rows = self.crud.get_population_2011_by_subdistricts(subdistrict_ids)
        output = []
        for row in rows:
            p1 = row.population_1951
            p2 = row.population_1961
            p3 = row.population_1971
            p4 = row.population_1981
            p5 = row.population_1991
            p6 = row.population_2001
            p7 = row.population_2011

            d1, d2, d3, d4, d5, d6 = p2 - p1, p3 - p2, p4 - p3, p5 - p4, p6 - p5, p7 - p6
            d_mean = (d1 + d2 + d3 + d4 + d5 + d6) / 6
            m_mean = ((d2 - d1) + (d3 - d2) + (d4 - d3) + (d5 - d4) + (d6 - d5)) / 5

            valid_growth = []
            for prev, diff in [(p1, d1), (p2, d2), (p3, d3), (p4, d4), (p5, d5), (p6, d6)]:
                if prev:
                    g = (diff * 100) / prev
                    if g > 0:
                        valid_growth.append(g)

            geometric = 0.0
            if valid_growth:
                prod = 1.0
                for g in valid_growth:
                    prod *= g
                geometric = math.pow(prod, 1 / len(valid_growth))

            base_year = 2011
            xs = [1951 - base_year, 1961 - base_year, 1971 - base_year, 1981 - base_year, 1991 - base_year, 2001 - base_year, 2011 - base_year]
            ys = [math.log(max(v, 1), 10) for v in [p1, p2, p3, p4, p5, p6, p7]]
            x_sum = sum(xs)
            y_sum = sum(ys)
            x_sq_sum = sum(x * x for x in xs)
            xy_sum = sum(x * y for x, y in zip(xs, ys))
            n = 7
            denominator = (n * x_sq_sum) - (x_sum * x_sum)
            growth_rate = ((n * xy_sum) - (x_sum * y_sum)) / denominator if denominator else 0.0

            output.append(
                {
                    "subdistrict_code": int(row.subdistrict_code),
                    "total_p7": float(p7),
                    "d_mean": float(d_mean),
                    "m_mean": float(m_mean),
                    "annual_growth_rate": float(geometric),
                    "linear_annual_growth": math.floor(d_mean / 10),
                    "growth_rate": float(growth_rate),
                }
            )
        return output

    def time_series(self, payload: dict[str, Any]):
        base_year = 2011
        single_year = payload.get("year")
        start_year = payload.get("start_year")
        end_year = payload.get("end_year")
        villages = self._ensure_village_subdistrict(payload.get("villages_props", []))
        subdistrict = payload.get("subdistrict_props", [])

        sub_ids = self._extract_id_list(subdistrict)
        stats = self._population_stats(sub_ids)
        stats_map = {x["subdistrict_code"]: x for x in stats}

        def compute(method: str):
            rows = {}
            if single_year:
                ty = int(single_year)
                for v in villages:
                    vid = int(v["id"])
                    value = float(v["population"])
                    sid = int(v.get("subDistrictId", 0))
                    item = stats_map.get(sid)
                    if not item:
                        continue
                    n = (ty - base_year) / 10
                    if method == "Arithmetic":
                        projected = int(value + ((item["linear_annual_growth"] * (ty - base_year)) * (value / item["total_p7"])))
                    elif method == "Geometric":
                        projected = int(value * math.pow((1 + (item["annual_growth_rate"] / 100)), n))
                    elif method == "Incremental":
                        k = value / item["total_p7"] if item["total_p7"] else 0
                        projected = int(value + (k * n * item["d_mean"]) + (((n * (n + 1)) * item["m_mean"] / 2) * k))
                    else:
                        t = ty - base_year
                        projected = int(value * math.exp(item["growth_rate"] * t))
                    rows[vid] = {"2011": int(value), str(ty): projected}

                return {
                    "2011": sum(v["2011"] for v in rows.values()),
                    ty: sum(v[str(ty)] for v in rows.values()),
                }

            if start_year is not None and end_year is not None:
                sy, ey = int(start_year), int(end_year)
                for v in villages:
                    vid = int(v["id"])
                    value = float(v["population"])
                    sid = int(v.get("subDistrictId", 0))
                    item = stats_map.get(sid)
                    if not item:
                        continue
                    rows[vid] = {"2011": int(value)}
                    for year in range(sy, ey + 1):
                        n = (year - base_year) / 10
                        if method == "Arithmetic":
                            projected = int(value + ((item["linear_annual_growth"] * (year - base_year)) * (value / item["total_p7"])))
                        elif method == "Geometric":
                            projected = int(value * math.pow((1 + (item["annual_growth_rate"] / 100)), n))
                        elif method == "Incremental":
                            k = value / item["total_p7"] if item["total_p7"] else 0
                            projected = int(value + (k * n * item["d_mean"]) + (((n * (n + 1)) * item["m_mean"] / 2) * k))
                        else:
                            t = year - base_year
                            projected = int(value * math.exp(item["growth_rate"] * t))
                        rows[vid][year] = projected
                out = {"2011": sum(v["2011"] for v in rows.values())}
                for y in range(sy, ey + 1):
                    out[y] = sum(v[y] for v in rows.values())
                return out

            return {}

        return {
            "Arithmetic": compute("Arithmetic"),
            "Geometric": compute("Geometric"),
            "Incremental": compute("Incremental"),
            "Exponential": compute("Exponential"),
        }

    def demographic(self, payload: dict[str, Any]):
        base_year = 2011
        villages = self._ensure_village_subdistrict(payload.get("villages_props", []))
        rates = payload.get("demographic", {}) or {}
        b = float(rates.get("birthRate", 0)) / 10000
        d = float(rates.get("deathRate", 0)) / 10000
        e = float(rates.get("emigrationRate", 0)) / 10000
        i = float(rates.get("immigrationRate", 0)) / 10000

        def calc(year: int):
            output = {}
            for v in villages:
                val = float(v["population"])
                t = year - base_year
                output[int(v["id"])] = int(val + (val * t * (b - d)) + (t * (e - i)))
            return output

        single_year = payload.get("year")
        start_year = payload.get("start_year")
        end_year = payload.get("end_year")

        if single_year:
            ty = int(single_year)
            c = calc(ty)
            return {"demographic": {"2011": int(sum(float(v["population"]) for v in villages)), ty: int(sum(c.values()))}}

        if start_year is not None and end_year is not None:
            sy, ey = int(start_year), int(end_year)
            result = {"2011": int(sum(float(v["population"]) for v in villages))}
            for y in range(sy, ey + 1):
                result[y] = int(sum(calc(y).values()))
            return {"demographic": result}

        return {"demographic": {}}
    
    def sewage_calculation(self, payload: dict[str, Any]):
        method = payload.get("method")
        if method == "water_supply":
            total_supply = float(payload.get("total_supply", 0))
            if total_supply <= 0:
                raise ValueError("Total supply must be greater than zero")
            return {"sewage_demand": total_supply * 0.84}

        if method == "domestic_sewage":
            load_method = payload.get("load_method")
            if load_method == "manual":
                domestic_supply = float(payload.get("domestic_supply", 0))
                if domestic_supply <= 0:
                    raise ValueError("Domestic supply must be greater than zero")
                return {"sewage_demand": domestic_supply * 0.84}

            if load_method == "modeled":
                computed_population = payload.get("computed_population") or {}
                unmetered = float(payload.get("unmetered_supply", 0) or 0)
                result = {}
                for year, pop in computed_population.items():
                    pop_val = float(pop)
                    multiplier = (135 + unmetered) / 1000000
                    result[year] = pop_val * multiplier * 0.80
                return {"sewage_result": result}

            raise ValueError("Invalid domestic load method")

        raise ValueError("Invalid sewage method")

    def sewage_demand(self, payload: dict[str, Any]):
        load_method = payload.get("load_method")
        drains = payload.get("drains") or []
        drain_recharge_sum = sum(float(d.get("drain_recharge", 0) or 0) for d in drains)
        water_supply = float(payload.get("water_supply", 0) or 0)
        pop_2025 = float(payload.get("population_2025", 0) or 0)
        unmetered = float(payload.get("unmetered_supply", 15) or 15)
        mul = (135 + unmetered) / 1_000_000

        results = []

        if load_method == "manual":
            population_data = payload.get("population_data") or {}
            if not population_data:
                raise ValueError("population_data must not be empty for manual mode")
            for year in sorted(population_data.keys(), key=lambda y: int(y)):
                pop_val = float(population_data[year])
                pop_based = pop_val * mul * 0.84
                water_based = (pop_val / pop_2025) * 0.84 * water_supply if pop_2025 > 0 else 0.0
                drain_based = (pop_val / pop_2025) * drain_recharge_sum if pop_2025 > 0 else 0.0
                results.append({
                    "year": str(year),
                    "population": pop_val,
                    "population_based": round(pop_based, 4),
                    "water_based": round(water_based, 4),
                    "drain_based": round(drain_based, 4),
                })

        elif load_method == "modeled":
            computed = payload.get("computed_population") or {}
            if not computed:
                raise ValueError("computed_population is required for modeled mode")
            for year in sorted(computed.keys(), key=lambda y: int(y)):
                pop_val = float(computed[year])
                pop_based = pop_val * mul * 0.80
                water_based = (pop_val / pop_2025) * 0.84 * water_supply if pop_2025 > 0 else 0.0
                drain_based = (pop_val / pop_2025) * drain_recharge_sum if pop_2025 > 0 else 0.0
                results.append({
                    "year": str(year),
                    "population": pop_val,
                    "population_based": round(pop_based, 4),
                    "water_based": round(water_based, 4),
                    "drain_based": round(drain_based, 4),
                })

        else:
            raise ValueError("Invalid load_method. Use 'manual' or 'modeled'")

        return {
            "results": results,
            "drain_recharge_sum": round(drain_recharge_sum, 4),
        }

    def peak_sewage_flow(self, payload: dict[str, Any]):
            population_data: dict[str, float] = payload.get("population_data") or {}
            methods: list[str]                = payload.get("methods") or []
            sewage_data: dict | None          = payload.get("sewage_data")
            base_sewage: float | None         = payload.get("base_sewage")

            if not population_data:
                raise ValueError("population_data must not be empty.")
            if not methods:
                raise ValueError("At least one method must be selected.")

            # If no per-year sewage provided, distribute base_sewage by population ratio
            if sewage_data is None:
                if base_sewage is None or float(base_sewage) <= 0:
                    raise ValueError("Provide either sewage_data or a positive base_sewage.")
                sorted_years = sorted(population_data.keys(), key=int)
                ref_pop = float(population_data[sorted_years[0]])
                if ref_pop <= 0:
                    raise ValueError("Reference population (first year) must be > 0.")
                sewage_data = {
                    yr: float(base_sewage) * (float(population_data[yr]) / ref_pop)
                    for yr in sorted_years
                }

            def _cpheeo(pop: float) -> float:
                if pop < 20_000:  return 3.0
                if pop <= 50_000: return 2.5
                if pop <= 75_000: return 2.25
                return 2.0

            def _harmon(pop: float) -> float:
                return 1 + 14 / (4 + math.sqrt(pop / 1000))

            def _babbitt(pop: float) -> float:
                return 5 / (pop / 1000) ** 0.2

            results = []
            for year in sorted(population_data.keys(), key=int):
                pop     = float(population_data[year])
                avg_sew = float(sewage_data.get(year, 0))
                row: dict[str, Any] = {
                    "year":            year,
                    "population":      pop,
                    "avg_sewage_flow": round(avg_sew, 4),
                }
                if "cpheeo" in methods:
                    row["cpheeo"]  = round(avg_sew * _cpheeo(pop), 4)
                if "harmon" in methods:
                    row["harmon"]  = round(avg_sew * _harmon(pop), 4)
                if "babbitt" in methods:
                    row["babbitt"] = round(avg_sew * _babbitt(pop), 4)
                results.append(row)

            return {"results": results}

    def raw_sewage_characteristics(self, payload: dict[str, Any]):
        pop_2011:     float    = float(payload.get("population_2011", 0))
        unmetered:    float    = float(payload.get("unmetered_supply", 0) or 0)
        custom_items: list | None = payload.get("custom_items")

        default_items = [
            {"name": "BOD",               "per_capita": 27.0},
            {"name": "COD",               "per_capita": 45.9},
            {"name": "TSS",               "per_capita": 40.5},
            {"name": "VSS",               "per_capita": 28.4},
            {"name": "Total Nitrogen",    "per_capita":  5.4},
            {"name": "Organic Nitrogen",  "per_capita":  1.4},
            {"name": "Ammonia Nitrogen",  "per_capita":  3.5},
            {"name": "Nitrate Nitrogen",  "per_capita":  0.5},
            {"name": "Total Phosphorus",  "per_capita":  0.8},
            {"name": "Ortho Phosphorous", "per_capita":  0.5},
        ]

        base_coeff  = 150.0 if pop_2011 >= 1_000_000 else 135.0
        total_coeff = (base_coeff + unmetered) * 0.80

        if total_coeff <= 0:
            raise ValueError("Total coefficient must be > 0.")

        items_to_process = custom_items if custom_items else default_items

        result_items = []
        for item in items_to_process:
            per_capita    = float(item["per_capita"])
            concentration = round((per_capita / total_coeff) * 1000, 1)
            design_val    = item.get("design_characteristic")
            result_items.append({
                "name":                 item["name"],
                "per_capita":           per_capita,
                "concentration":        concentration,
                "design_characteristic": float(design_val) if design_val is not None else concentration,
            })

        return {
            "base_coefficient":  base_coeff,
            "total_coefficient": round(total_coeff, 4),
            "items":             result_items,
        }


    def water_supply(self, payload: dict[str, Any]):
        def f(value: Any) -> float:
            return float(value) if value not in [None, ""] else 0.0

        surface_water = f(payload.get("surface_water", 0))
        direct_groundwater = f(payload.get("direct_groundwater", 0))
        num_tubewells = f(payload.get("num_tubewells", 0))
        discharge_rate = f(payload.get("discharge_rate", 0))
        operating_hours = f(payload.get("operating_hours", 0))
        direct_alternate = f(payload.get("direct_alternate", 0))
        rooftop_tank = f(payload.get("rooftop_tank", 0))
        aquifer_recharge = f(payload.get("aquifer_recharge", 0))
        surface_runoff = f(payload.get("surface_runoff", 0))
        reuse_water = f(payload.get("reuse_water", 0))

        if direct_groundwater > 0 and (num_tubewells > 0 or discharge_rate > 0 or operating_hours > 0):
            raise ValueError("Provide either direct groundwater supply or tube well inputs, not both.")

        if direct_alternate > 0 and (rooftop_tank > 0 or aquifer_recharge > 0 or surface_runoff > 0 or reuse_water > 0):
            raise ValueError("Provide either direct alternate supply or alternate component inputs, not both.")

        groundwater_supply = direct_groundwater if direct_groundwater > 0 else num_tubewells * discharge_rate * operating_hours
        alternate_supply = direct_alternate if direct_alternate > 0 else rooftop_tank + aquifer_recharge + surface_runoff + reuse_water

        return {"total_supply": surface_water + groundwater_supply + alternate_supply}

    def domestic_water_demand(self, payload: dict[str, Any]):
        forecast_data = payload.get("forecast_data") or {}
        per_capita = float(payload.get("per_capita_consumption"))
        seasonal = payload.get("seasonal_multipliers") or {}

        base_demand = {}
        for year, population in forecast_data.items():
            base_demand[year] = float(population) * (per_capita / 1000000)

        defaults = {"summer": 1.10, "monsoon": 0.95, "postMonsoon": 1.00, "winter": 0.90}
        multipliers = {**defaults, **seasonal}

        seasonal_demands: dict[str, dict[str, float]] = {}
        for season, multiplier in multipliers.items():
            seasonal_demands[season] = {year: value * float(multiplier) for year, value in base_demand.items()}

        return {
            "base_demand": base_demand,
            "seasonal_demands": seasonal_demands,
            "seasonal_multipliers": multipliers,
            "base_per_capita": per_capita,
        }

    def floating_water_demand(self, payload: dict[str, Any]):
        floating_percentage = float(payload.get("floating_population_percentage", 15))
        facility_type = payload.get("facility_type")
        domestic_forecast = payload.get("domestic_forecast") or {}
        seasonal = payload.get("seasonal_multipliers") or {}

        mapping = {"provided": 45, "notprovided": 25, "onlypublic": 15}
        if facility_type not in mapping:
            raise ValueError("Invalid facility_type. Must be 'provided', 'notprovided', or 'onlypublic'.")

        facility_multiplier = mapping[facility_type]
        base_demand = {}
        for year, pop in domestic_forecast.items():
            projected_floating_population = float(pop) * (floating_percentage / 100)
            base_demand[year] = projected_floating_population * (facility_multiplier / 1000000)

        defaults = {"summer": 1.15, "monsoon": 1.25, "postMonsoon": 1.10, "winter": 0.85}
        multipliers = {**defaults, **seasonal}
        seasonal_demands = {
            season: {year: value * float(multiplier) for year, value in base_demand.items()}
            for season, multiplier in multipliers.items()
        }

        return {
            "base_demand": base_demand,
            "seasonal_demands": seasonal_demands,
            "seasonal_multipliers": multipliers,
            "facility_type": facility_type,
            "floating_population_percentage": floating_percentage,
        }

    def institutional_water_demand(self, payload: dict[str, Any]):
        fields = payload.get("institutional_fields") or {}
        domestic = payload.get("domestic_forecast") or {}

        if "2011" not in domestic:
            raise ValueError("domestic_forecast must include a value for 2011")
        base_domestic = float(domestic["2011"])

        def f(name: str) -> float:
            return float(fields.get(name, 0) or 0)

        base_demand = (
            f("hospitals100Units") * f("beds100") * 450
            + f("hospitalsLess100") * f("bedsLess100") * 350
            + f("hotels") * f("bedsHotels") * 180
            + f("hostels") * f("residentsHostels") * 135
            + f("nursesHome") * f("residentsNursesHome") * 135
            + f("boardingSchools") * f("studentsBoardingSchools") * 135
            + f("restaurants") * f("seatsRestaurants") * 70
            + f("airportsSeaports") * f("populationLoadAirports") * 70
            + f("junctionStations") * f("populationLoadJunction") * 70
            + f("terminalStations") * f("populationLoadTerminal") * 45
            + f("intermediateBathing") * f("populationLoadBathing") * 45
            + f("intermediateNoBathing") * f("populationLoadNoBathing") * 25
            + f("daySchools") * f("studentsDaySchools") * 45
            + f("offices") * f("employeesOffices") * 45
            + f("factorieswashrooms") * f("employeesFactories") * 45
            + f("factoriesnoWashrooms") * f("employeesFactoriesNoWashrooms") * 30
            + f("cinemas") * f("populationLoadCinemas") * 15
        ) / 1000000

        result = {}
        for year, value in domestic.items():
            year_value = float(value)
            growth_ratio = year_value / base_domestic if base_domestic else 1
            result[year] = base_demand * growth_ratio
        return result

    def firefighting_water_demand(self, payload: dict[str, Any]):
        methods = payload.get("firefighting_methods") or {}
        domestic = payload.get("domestic_forecast") or {}

        result = {}
        for method, selected in methods.items():
            if not selected:
                continue
            method_result = {}
            for year, value in domestic.items():
                pop_val = float(value)
                if method == "Kuchling":
                    demand = (4.582 / 100) * math.sqrt(pop_val / 1000)
                elif method == "Freeman":
                    demand = (1.635 / 100) * ((pop_val / 5000) + 10)
                elif method == "Buston":
                    demand = (8.155 / 100) * math.sqrt(pop_val / 1000)
                elif method == "American_insurance":
                    demand = (6.677 / 100) * math.sqrt(pop_val / 1000) * (1 - 0.01 * math.sqrt(pop_val / 1000))
                elif method == "Ministry_urban":
                    demand = math.sqrt(pop_val) / 1000
                else:
                    demand = 0.0
                method_result[year] = demand
            result[method] = method_result
        return result

    def water_supply_thematic_map(self, payload: dict[str, Any]):
        """Returns per-village Water Supply / Water Demand / Water Gap / Status (MLD).
        No geometry — frontend merges into existing population GeoJSON."""
        base_year    = 2011
        total_supply = float(payload.get("total_supply", 0))
        demand_raw   = {int(k): float(v) for k, v in (payload.get("demand_by_year") or {}).items()}

        single_year = payload.get("year")
        start_year  = payload.get("start_year")
        end_year    = payload.get("end_year")
        villages    = self._ensure_village_subdistrict(payload.get("villages_props", []))
        subdistrict = payload.get("subdistrict_props", [])

        if single_year:
            forecast_years = [int(single_year)]
        elif start_year is not None and end_year is not None:
            forecast_years = list(range(int(start_year), int(end_year) + 1))
        else:
            return {}

        sub_ids   = self._extract_id_list(subdistrict)
        stats_map = {x["subdistrict_code"]: x for x in self._population_stats(sub_ids)}

        # First pass: compute projected population per village per year
        village_pops: dict[int, dict[int, float]] = {}
        for v in villages:
            vid      = int(v["id"])
            pop_2011 = float(v["population"])
            sid      = int(v.get("subDistrictId", 0))
            item     = stats_map.get(sid)
            pops: dict[int, float] = {base_year: pop_2011}
            for yr in forecast_years:
                if item and item.get("total_p7"):
                    pops[yr] = max(0.0, pop_2011 + (
                        item["linear_annual_growth"] * (yr - base_year)
                    ) * (pop_2011 / item["total_p7"]))
                else:
                    pops[yr] = pop_2011
            village_pops[vid] = pops

        # Total projected population per year (for distributing supply/demand)
        total_pop_yr: dict[int, float] = {}
        for yr in [base_year] + forecast_years:
            total_pop_yr[yr] = sum(vp[yr] for vp in village_pops.values())

        result: dict[str, dict] = {}
        for v in villages:
            vid    = int(v["id"])
            pops   = village_pops[vid]
            ws: dict[int, float] = {}
            wd: dict[int, float] = {}
            wg: dict[int, float] = {}
            st: dict[int, str]   = {}

            for yr in [base_year] + forecast_years:
                pop_yr    = pops[yr]
                tot_yr    = total_pop_yr[yr] or 1.0
                share     = pop_yr / tot_yr
                s = round(share * total_supply, 4)
                d = round(share * demand_raw.get(yr, 0), 4)
                g = round(s - d, 4)
                ws[yr] = s
                wd[yr] = d
                wg[yr] = g
                st[yr] = "Sufficient" if g >= 0 else "Deficit"

            result[str(vid)] = {
                "Water Supply": ws,
                "Water Demand": wd,
                "Water Gap":    wg,
                "Status":       st,
            }
        return result

    def water_demand_thematic_map(self, payload: dict[str, Any]):
        """Returns per-village water demand data (MLD) keyed by village_code.
        No geometry — the frontend merges this into the existing population GeoJSON."""
        base_year     = 2011
        per_capita    = float(payload.get("per_capita_consumption", 135))
        float_pct     = float(payload.get("floating_percentage", 0))
        facility_lpcd = float(payload.get("facility_lpcd", 0))
        inst_demand   = {int(k): float(v) for k, v in (payload.get("inst_demand") or {}).items()}
        ff_demand     = {int(k): float(v) for k, v in (payload.get("ff_demand") or {}).items()}
        total_pop_2011 = float(payload.get("total_population_2011", 0))

        single_year = payload.get("year")
        start_year  = payload.get("start_year")
        end_year    = payload.get("end_year")
        villages    = self._ensure_village_subdistrict(payload.get("villages_props", []))
        subdistrict = payload.get("subdistrict_props", [])

        if single_year:
            forecast_years = [int(single_year)]
        elif start_year is not None and end_year is not None:
            forecast_years = list(range(int(start_year), int(end_year) + 1))
        else:
            return {}

        sub_ids   = self._extract_id_list(subdistrict)
        stats_map = {x["subdistrict_code"]: x for x in self._population_stats(sub_ids)}

        result: dict[str, dict] = {}
        for v in villages:
            vid      = int(v["id"])
            pop_2011 = float(v["population"])
            sid      = int(v.get("subDistrictId", 0))
            item     = stats_map.get(sid)
            v_ratio  = (pop_2011 / total_pop_2011) if total_pop_2011 > 0 else 0.0

            dom: dict[int, float] = {}
            flt: dict[int, float] = {}
            ins: dict[int, float] = {}
            ffd: dict[int, float] = {}
            tot: dict[int, float] = {}

            for yr in [base_year] + forecast_years:
                if yr == base_year:
                    pop_yr = pop_2011
                elif item and item.get("total_p7"):
                    pop_yr = max(0.0, pop_2011 + (
                        item["linear_annual_growth"] * (yr - base_year)
                    ) * (pop_2011 / item["total_p7"]))
                else:
                    pop_yr = pop_2011

                d = round(pop_yr * per_capita / 1_000_000, 4)
                f = round(pop_yr * (float_pct / 100) * facility_lpcd / 1_000_000, 4) if float_pct > 0 else 0.0
                i = round(v_ratio * inst_demand.get(yr, 0), 4) if inst_demand else 0.0
                g = round(v_ratio * ff_demand.get(yr, 0), 4)   if ff_demand   else 0.0

                dom[yr] = d
                if float_pct > 0:    flt[yr] = f
                if inst_demand:      ins[yr] = i
                if ff_demand:        ffd[yr] = g
                tot[yr] = round(d + f + i + g, 4)

            entry: dict[str, Any] = {"Domestic": dom, "Total Water Demand": tot}
            if flt: entry["Floating"]      = flt
            if ins: entry["Institutional"] = ins
            if ffd: entry["Firefighting"]  = ffd
            result[str(vid)] = entry

        return result

    def cohort(self, payload: dict[str, Any]):
        year = payload.get("year")
        start_year = payload.get("start_year")
        end_year = payload.get("end_year")

        if not year and (start_year is None or end_year is None):
            raise ValueError("Either 'year' or both 'start_year' and 'end_year' must be provided")

        villages = payload.get("villages_props") or []
        subdistrict = payload.get("subdistrict_props")
        district = payload.get("district_props")
        state = payload.get("state_props") or {}

        state_code = int(state["id"]) if isinstance(state, dict) and state.get("id") is not None else None
        district_codes = self._extract_id_list(district)
        subdistrict_codes = self._extract_id_list(subdistrict)
        village_codes = self._extract_id_list(villages)

        if state_code is None and not district_codes and not subdistrict_codes and not village_codes:
            raise ValueError("At least one location parameter (state, district, subdistrict, or village) is required")

        years_to_query: list[int]
        if year is not None:
            years_to_query = [int(year)]
            if int(year) != 2011:
                years_to_query.append(2011)
            years_to_query = sorted(years_to_query, key=lambda y: (y != 2011, y))
        else:
            sy = int(start_year)
            ey = int(end_year)
            if sy > ey:
                raise ValueError("start_year cannot be greater than end_year")
            years_to_query = list(range(sy, ey + 1))
            if 2011 not in years_to_query:
                years_to_query.append(2011)
                years_to_query = sorted(years_to_query, key=lambda y: (y != 2011, y))

        def organize(records):
            result: dict[str, dict[str, int]] = {}
            total_male = 0
            total_female = 0
            total_overall = 0

            for row in records:
                age_group = row.age_group
                gender = (row.gender or "").lower()
                population = int(row.population)

                if age_group not in result:
                    result[age_group] = {"male": 0, "female": 0, "total": 0}

                if gender == "male":
                    result[age_group]["male"] += population
                    total_male += population
                elif gender == "female":
                    result[age_group]["female"] += population
                    total_female += population

                result[age_group]["total"] = result[age_group]["male"] + result[age_group]["female"]
                total_overall += population

            if result:
                result["total"] = {"male": total_male, "female": total_female, "total": total_overall}

            return result

        years_data = []
        for y in years_to_query:
            records = self.crud.get_cohort_by_filters(y, state_code, district_codes, subdistrict_codes, village_codes)
            if year is not None:
                years_data.append({"year": y, "data": organize(records)})
            elif records:
                years_data.append({"year": y, "data": organize(records)})

        return {"cohort": years_data}
    def time_series_thematic_map(self, payload: dict[str, Any]):
        """Returns per-village GeoJSON FeatureCollection with projected population values for all years."""
        try:
            import geopandas as gpd
            from shapely.geometry import mapping as geom_mapping
        except ImportError as exc:
            raise RuntimeError("geopandas is required for thematic map") from exc

        base_year = 2011
        single_year = payload.get("year")
        start_year = payload.get("start_year")
        end_year = payload.get("end_year")
        villages = self._ensure_village_subdistrict(payload.get("villages_props", []))
        subdistrict = payload.get("subdistrict_props", [])

        # Build the list of years to compute
        if single_year:
            forecast_years = [int(single_year)]
        elif start_year is not None and end_year is not None:
            forecast_years = list(range(int(start_year), int(end_year) + 1))
        else:
            return {"type": "FeatureCollection", "available_years": [], "features": []}

        sub_ids = self._extract_id_list(subdistrict)
        stats = self._population_stats(sub_ids)
        stats_map = {x["subdistrict_code"]: x for x in stats}

        # Compute per-village values for every forecast year, keyed by year
        village_data: dict[int, dict] = {}
        for v in villages:
            vid = int(v["id"])
            value = float(v["population"])
            sid = int(v.get("subDistrictId", 0))
            item = stats_map.get(sid)
            name = v.get("name", "")

            arith: dict[int, int] = {base_year: int(value)}
            geo:   dict[int, int] = {base_year: int(value)}
            incr:  dict[int, int] = {base_year: int(value)}
            expo:  dict[int, int] = {base_year: int(value)}

            if item:
                for yr in forecast_years:
                    n = (yr - base_year) / 10
                    t = yr - base_year
                    arith[yr] = int(
                        value + ((item["linear_annual_growth"] * (yr - base_year)) * (value / item["total_p7"]))
                    )
                    geo[yr] = int(value * math.pow((1 + (item["annual_growth_rate"] / 100)), n))
                    k = value / item["total_p7"] if item["total_p7"] else 0
                    incr[yr] = int(
                        value + (k * n * item["d_mean"]) + (((n * (n + 1)) * item["m_mean"] / 2) * k)
                    )
                    expo[yr] = int(value * math.exp(item["growth_rate"] * t))

            village_data[vid] = {
                "village_name": name,
                "population_2011": int(value),
                "Arithmetic": arith,
                "Geometric": geo,
                "Incremental": incr,
                "Exponential": expo,
            }

        # Load village shapefile
        shp_path = os.path.join(self._media_root(), "Drain_shp", "Villages", "Edited2.shp")
        if not os.path.exists(shp_path):
            raise FileNotFoundError("Village shapefile not found")

        gdf = gpd.read_file(shp_path)
        gdf["village_co"] = gdf["village_co"].astype(str).str.strip()
        selected = gdf[gdf["village_co"].isin([str(vid) for vid in village_data.keys()])]

        if selected.empty:
            return {"type": "FeatureCollection", "available_years": [], "features": []}

        selected_latlon = selected.to_crs(epsg=4326)
        available_years = sorted({base_year} | set(forecast_years))

        features = []
        for _, gdf_row in selected_latlon.iterrows():
            vcode = str(gdf_row["village_co"]).strip()
            try:
                vid = int(vcode)
            except ValueError:
                continue
            data = village_data.get(vid)
            if not data:
                continue
            features.append({
                "type": "Feature",
                "geometry": geom_mapping(gdf_row.geometry),
                "properties": {
                    "village_code": vcode,
                    "village_name": data["village_name"],
                    "population_2011": data["population_2011"],
                    "Arithmetic": data["Arithmetic"],
                    "Geometric": data["Geometric"],
                    "Incremental": data["Incremental"],
                    "Exponential": data["Exponential"],
                },
            })

        return {"type": "FeatureCollection", "available_years": available_years, "features": features}

    def demographic_thematic_map(self, payload: dict[str, Any]):
        """Returns per-village GeoJSON with Demographic projected population for all years."""
        try:
            import geopandas as gpd
            from shapely.geometry import mapping as geom_mapping
        except ImportError as exc:
            raise RuntimeError("geopandas is required for thematic map") from exc

        base_year = 2011
        single_year = payload.get("year")
        start_year = payload.get("start_year")
        end_year = payload.get("end_year")
        villages = self._ensure_village_subdistrict(payload.get("villages_props", []))
        rates = payload.get("demographic", {}) or {}

        b = float(rates.get("birthRate", 0)) / 10000
        d = float(rates.get("deathRate", 0)) / 10000
        e_rate = float(rates.get("emigrationRate", 0)) / 10000
        i_rate = float(rates.get("immigrationRate", 0)) / 10000

        if single_year:
            forecast_years = [int(single_year)]
        elif start_year is not None and end_year is not None:
            forecast_years = list(range(int(start_year), int(end_year) + 1))
        else:
            return {"type": "FeatureCollection", "available_years": [], "features": []}

        village_data: dict[int, dict] = {}
        for v in villages:
            vid = int(v["id"])
            value = float(v["population"])
            name = v.get("name", "")
            demo: dict[int, int] = {base_year: int(value)}
            for yr in forecast_years:
                t = yr - base_year
                demo[yr] = int(value + (value * t * (b - d)) + (t * (e_rate - i_rate)))
            village_data[vid] = {
                "village_name": name,
                "population_2011": int(value),
                "Demographic": demo,
            }

        shp_path = os.path.join(self._media_root(), "Drain_shp", "Villages", "Edited2.shp")
        if not os.path.exists(shp_path):
            raise FileNotFoundError("Village shapefile not found")

        gdf = gpd.read_file(shp_path)
        gdf["village_co"] = gdf["village_co"].astype(str).str.strip()
        selected = gdf[gdf["village_co"].isin([str(v) for v in village_data.keys()])]
        if selected.empty:
            return {"type": "FeatureCollection", "available_years": [], "features": []}

        selected_latlon = selected.to_crs(epsg=4326)
        available_years = sorted({base_year} | set(forecast_years))

        features = []
        for _, gdf_row in selected_latlon.iterrows():
            vcode = str(gdf_row["village_co"]).strip()
            try:
                vid = int(vcode)
            except ValueError:
                continue
            data = village_data.get(vid)
            if not data:
                continue
            features.append({
                "type": "Feature",
                "geometry": geom_mapping(gdf_row.geometry),
                "properties": {
                    "village_code": vcode,
                    "village_name": data["village_name"],
                    "population_2011": data["population_2011"],
                    "Demographic": data["Demographic"],
                },
            })

        return {"type": "FeatureCollection", "available_years": available_years, "features": features}

    def cohort_thematic_map(self, payload: dict[str, Any]):
        """Returns per-village GeoJSON with cohort total + age-sex breakdown for all years."""
        try:
            import geopandas as gpd
            from shapely.geometry import mapping as geom_mapping
        except ImportError as exc:
            raise RuntimeError("geopandas is required for thematic map") from exc

        single_year = payload.get("year")
        start_year = payload.get("start_year")
        end_year = payload.get("end_year")
        villages_props = payload.get("villages_props") or []
        subdistrict_raw = payload.get("subdistrict_props")
        district_raw = payload.get("district_props")
        state_raw = payload.get("state_props") or {}

        if single_year:
            forecast_years = [int(single_year)]
        elif start_year is not None and end_year is not None:
            forecast_years = list(range(int(start_year), int(end_year) + 1))
        else:
            return {"type": "FeatureCollection", "available_years": [], "features": []}

        all_years = sorted({2011} | set(forecast_years))

        state_code = int(state_raw["id"]) if isinstance(state_raw, dict) and state_raw.get("id") is not None else None
        district_codes = self._extract_id_list(district_raw)
        subdistrict_codes = self._extract_id_list(subdistrict_raw)
        village_codes = self._extract_id_list(villages_props)

        # Build village name / pop lookup from payload
        village_meta: dict[int, dict] = {}
        for v in villages_props:
            try:
                vid = int(v["id"])
            except (KeyError, TypeError, ValueError):
                continue
            village_meta[vid] = {"name": v.get("name", ""), "population_2011": int(float(v.get("population", 0)))}

        # Query cohort data per year for all villages at once
        village_totals: dict[int, dict[int, int]] = {}          # vid -> {year -> total}
        village_agesex: dict[int, dict[int, dict]] = {}          # vid -> {year -> {age_group -> {m,f,t}}}

        for yr in all_years:
            records = self.crud.get_cohort_by_filters(yr, state_code, district_codes, subdistrict_codes, village_codes)
            for row in records:
                vid = int(row.village_code) if row.village_code is not None else None
                if vid is None:
                    continue
                gender = (row.gender or "").lower()
                age_grp = row.age_group or "unknown"
                pop = int(row.population)

                if vid not in village_totals:
                    village_totals[vid] = {}
                    village_agesex[vid] = {}

                village_totals[vid][yr] = village_totals[vid].get(yr, 0) + pop

                if yr not in village_agesex[vid]:
                    village_agesex[vid][yr] = {}
                if age_grp not in village_agesex[vid][yr]:
                    village_agesex[vid][yr][age_grp] = {"male": 0, "female": 0, "total": 0}
                if gender == "male":
                    village_agesex[vid][yr][age_grp]["male"] += pop
                elif gender == "female":
                    village_agesex[vid][yr][age_grp]["female"] += pop
                village_agesex[vid][yr][age_grp]["total"] = (
                    village_agesex[vid][yr][age_grp]["male"] + village_agesex[vid][yr][age_grp]["female"]
                )

        if not village_totals:
            return {"type": "FeatureCollection", "available_years": [], "features": []}

        # Load shapefile
        shp_path = os.path.join(self._media_root(), "Drain_shp", "Villages", "Edited2.shp")
        if not os.path.exists(shp_path):
            raise FileNotFoundError("Village shapefile not found")

        gdf = gpd.read_file(shp_path)
        gdf["village_co"] = gdf["village_co"].astype(str).str.strip()
        valid_codes = [str(vid) for vid in village_totals.keys()]
        selected = gdf[gdf["village_co"].isin(valid_codes)]
        if selected.empty:
            return {"type": "FeatureCollection", "available_years": [], "features": []}

        selected_latlon = selected.to_crs(epsg=4326)
        features = []
        for _, gdf_row in selected_latlon.iterrows():
            vcode = str(gdf_row["village_co"]).strip()
            try:
                vid = int(vcode)
            except ValueError:
                continue
            meta = village_meta.get(vid, {})
            totals = village_totals.get(vid, {})
            agesex = village_agesex.get(vid, {})
            if not totals:
                continue
            features.append({
                "type": "Feature",
                "geometry": geom_mapping(gdf_row.geometry),
                "properties": {
                    "village_code": vcode,
                    "village_name": meta.get("name", ""),
                    "population_2011": meta.get("population_2011", totals.get(2011, 0)),
                    "Cohort Total": totals,
                    "Cohort AgeSex": agesex,
                },
            })

        return {"type": "FeatureCollection", "available_years": all_years, "features": features}

    def _media_root(self) -> str:
        settings = Settings()
        if hasattr(settings, "media_root"):
            return settings.media_root
        return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "media"))
    
    def _to_geojson(self, shp_full_path: str, filter_column: str | None = None, values: list[Any] | None = None):
        try:
            import geopandas as gpd
        except ImportError as exc:
            raise RuntimeError("geopandas is required for this endpoint") from exc

        if not os.path.exists(shp_full_path):
            raise FileNotFoundError(f"Shapefile not found: {shp_full_path}")

        gdf = gpd.read_file(shp_full_path).to_crs("EPSG:4326")
        if filter_column and values:
            gdf = gdf[gdf[filter_column].isin(values)]
        return json.loads(gdf.to_json())

    def basin(self):
        media_root = self._media_root()
        return self._to_geojson(os.path.join(media_root, "Drain_shp", "Basin", "Catchment_Basin_Diss.shp"))

    def rivers(self):
        media_root = self._media_root()
        return self._to_geojson(os.path.join(media_root, "Drain_shp", "Rivers", "Rivers.shp"))

    def river_stretched(self, river_code: Any | None):
        media_root = self._media_root()
        if river_code in [None, ""]:
            return self._to_geojson(os.path.join(media_root, "Drain_shp", "River_Stretches", "Stretches.shp"))
        return self._to_geojson(
            os.path.join(media_root, "Drain_shp", "River_Stretches", "Stretches.shp"),
            filter_column="River_Code",
            values=[river_code],
        )

    def drain(self, stretch_ids: Any):
        media_root = self._media_root()
        ids = stretch_ids if isinstance(stretch_ids, list) else [stretch_ids] if stretch_ids not in [None, ""] else []
        return self._to_geojson(
            os.path.join(media_root, "Drain_shp", "Drains", "Drain.shp"),
            filter_column="Stretch_ID" if ids else None,
            values=ids,
        )

    def catchment(self, drain_nos: Any):
        media_root = self._media_root()
        ids = drain_nos if isinstance(drain_nos, list) else [drain_nos] if drain_nos not in [None, ""] else []
        return self._to_geojson(
            os.path.join(media_root, "Drain_shp", "Catchments", "Catchment.shp"),
            filter_column="Drain_No" if ids else None,
            values=ids,
        )

    def all_stretches(self):
        media_root = self._media_root()
        return self._to_geojson(os.path.join(media_root, "Drain_shp", "River_Stretches", "Stretches.shp"))

    def catchment_village(self, drain_nos: Any):
        try:
            import geopandas as gpd
        except ImportError as exc:
            raise RuntimeError("geopandas is required for this endpoint") from exc

        ids = drain_nos if isinstance(drain_nos, list) else [drain_nos]
        if not ids:
            raise ValueError("Drain_No is required")

        media_root = self._media_root()
        catchment_path = os.path.join(media_root, "Drain_shp", "Catchments", "Catchment.shp")
        village_path = os.path.join(media_root, "Drain_shp", "Villages", "Edited2.shp")

        if not os.path.exists(catchment_path) or not os.path.exists(village_path):
            raise FileNotFoundError("One or more required shapefiles not found")

        catchment_gdf = gpd.read_file(catchment_path).to_crs("EPSG:4326")
        village_gdf = gpd.read_file(village_path).to_crs("EPSG:4326")
        filtered_catchment = catchment_gdf[catchment_gdf["Drain_No"].isin(ids)]

        if filtered_catchment.empty:
            raise ValueError("No catchment data found for the provided Drain_No")

        joined = gpd.sjoin(village_gdf, filtered_catchment, predicate="intersects", how="inner")
        joined = joined.drop_duplicates(subset=["shapeID"])

        return {
            "intersected_villages": joined[["shapeID", "shapeName", "SUB_DISTRI", "SUBDIS_COD", "DISTRICT", "Drain_No"]].to_dict(orient="records"),
            "count": int(len(joined)),
            "village_geojson": json.loads(joined.to_json()) if not joined.empty else {"type": "FeatureCollection", "features": []},
            "catchment_geojson": json.loads(filtered_catchment.to_json()),
        }

    def village_population(self, shape_ids: list[int | str]):
        if not shape_ids:
            raise ValueError("shapeID must be provided as a list")

        results = []
        for village_id in shape_ids:
            village_text = str(village_id)
            possible_ids = {village_text, village_text.lstrip("0")}
            if village_text.isdigit():
                possible_ids.add(str(int(village_text)))
                possible_ids.add(village_text.zfill(6))

            found = None
            for candidate in possible_ids:
                if not candidate:
                    continue
                if not str(candidate).isdigit():
                    continue
                record = self.crud.get_village_with_hierarchy(int(candidate))
                if record:
                    found = record
                    break

            if found:
                results.append(
                    {
                        "village_code": village_text,
                        "subdistrict_code": str(found.subdistrict_code),
                        "district_code": str(found.district_code),
                        "state_code": str(found.state_code),
                        "total_population": int(found.population_2011),
                    }
                )

        return results

    def village_population_raw(self, shape_ids: list[int | str]):
        if not shape_ids:
            raise ValueError("shapeID must be provided as a list")

        ints = [int(x) for x in shape_ids if str(x).isdigit()]
        mapped = self.crud.get_total_population_for_villages(ints)

        results = []
        for village_id in shape_ids:
            code = int(village_id) if str(village_id).isdigit() else None
            total = mapped.get(code, 0) if code is not None else 0
            results.append(
                {
                    "village_code": str(village_id),
                    "subdistrict_code": None,
                    "district_code": None,
                    "state_code": None,
                    "total_population": int(total),
                }
            )

        return results
    def stormwater_runoff(self, payload: dict[str, Any]):
        area = float(payload.get("area"))
        selected_time = int(payload.get("selected_time"))
        shape = payload.get("shape")
        selected_land_use_type = str(payload.get("selected_land_use_type"))
        rainfall_intensity = float(payload.get("rainfall_intensity"))

        coefficient_record = self.crud.get_runoff_coefficient_by_duration(selected_time)
        if not coefficient_record:
            raise ValueError(f"No coefficient data found for duration {selected_time} minutes")

        if not hasattr(coefficient_record, selected_land_use_type):
            raise ValueError(f'Land use type "{selected_land_use_type}" not found in coefficient data')

        c_value = getattr(coefficient_record, selected_land_use_type)
        if c_value is None:
            raise ValueError(f'Coefficient value is null for land use type "{selected_land_use_type}"')

        runoff = (10 * float(c_value) * rainfall_intensity * area) / 1000000

        return {
            "storm_water_runoff": round(runoff, 4),
            "coefficient_C": float(c_value),
            "rainfall_intensity": rainfall_intensity,
            "area": area,
            "duration_minutes": selected_time,
            "land_use_type": selected_land_use_type,
            "shape": shape,
            "unit": "MLD",
            "formula_used": "Q = (10 x C x i x A) / 1000000",
        }

    def swrunoff(self, payload: dict[str, Any]):
        try:
            import geopandas as gpd
        except ImportError as exc:
            raise RuntimeError("geopandas is required for swrunoff") from exc

        village_codes = payload.get("village_code") or payload.get("village_codes")
        if village_codes is None:
            raise ValueError("village_code or village_codes is required")

        if isinstance(village_codes, (int, str)):
            village_codes = [village_codes]

        village_codes = [int(code) for code in village_codes]

        shp_path = os.path.join(self._media_root(), "Drain_shp", "Villages", "Edited2.shp")
        if not os.path.exists(shp_path):
            raise FileNotFoundError("Village boundary data file not found")

        gdf = gpd.read_file(shp_path)
        if "village_co" not in gdf.columns:
            raise ValueError("Invalid shapefile format - missing village_co column")

        selected = gdf[gdf["village_co"].isin(village_codes)]
        if selected.empty:
            raise ValueError("No valid villages found for the provided codes")

        total_area = float(selected.geometry.area.sum() / 10000)
        union = selected.unary_union
        min_rect = union.minimum_rotated_rectangle

        shape_type = "Rectangle" if min_rect.area and (union.area / min_rect.area) > 0.72 else "Sector"
        confidence = 0.8 if shape_type == "Rectangle" else 0.65

        return {
            "total_area_hectares": round(total_area, 4),
            "overall_shape_type": shape_type,
            "overall_confidence": confidence,
            "connectivity_type": "continuous" if len(selected) > 1 else "single",
            "total_villages_analyzed": int(len(selected)),
            "total_villages_requested": int(len(village_codes)),
            "all_duration_values": self.crud.get_runoff_durations(),
            "shape_attributes": self.crud.get_shape_attributes(shape_type),
        }

    def save_pdf_to_temp(self, upload_file):
        if not upload_file.filename or not upload_file.filename.lower().endswith(".pdf"):
            raise ValueError("Only PDF files are allowed")

        settings = Settings()
        temp_dir = getattr(settings, "TEMP_DIR", self.temp_dir)
        os.makedirs(temp_dir, exist_ok=True)

        name, ext = os.path.splitext(upload_file.filename)
        unique_id = uuid.uuid4().hex
        unique_filename = f"{name}_{unique_id}{ext}"
        temp_file_path = os.path.join(temp_dir, unique_filename)

        with open(temp_file_path, "wb") as f:
            f.write(upload_file.file.read())

        return {
            "message": "PDF uploaded with unique filename",
            "original_filename": upload_file.filename,
            "unique_filename": unique_filename,
            "unique_id": unique_id,
            "temp_file_path": temp_file_path,
            "relative_path": f"temp/{unique_filename}",
        }

    def study_area_map(self, village_codes: list[int | str]):
        try:
            import geopandas as gpd
        except ImportError as exc:
            raise RuntimeError("geopandas is required for studyareamap") from exc

        shp_path = os.path.join(self._media_root(), "Drain_shp", "Villages", "Edited2.shp")
        if not os.path.exists(shp_path):
            raise FileNotFoundError("Study area shapefile not found")

        gdf = gpd.read_file(shp_path)
        if "village_co" not in gdf.columns:
            raise ValueError("Shapefile does not contain 'village_co' field")

        target = [str(code).strip() for code in village_codes]
        gdf["village_co"] = gdf["village_co"].astype(str).str.strip()
        selected = gdf[gdf["village_co"].isin(target)]

        if selected.empty:
            raise ValueError("No matching village codes found in shapefile")

        selected_latlon = selected.to_crs(epsg=4326)
        minx, miny, maxx, maxy = selected_latlon.total_bounds

        fig, ax = plt.subplots(1, 1, figsize=(12, 7), dpi=220)
        selected_latlon.plot(ax=ax, edgecolor="black", facecolor="lightgreen", alpha=0.6, linewidth=1.0)
        ax.set_title("Study Area Map")
        ax.set_xlabel("Longitude")
        ax.set_ylabel("Latitude")
        ax.grid(True, alpha=0.3, linestyle="--", linewidth=0.5)

        buf = io.BytesIO()
        plt.tight_layout()
        plt.savefig(buf, format="png", dpi=220, bbox_inches="tight", facecolor="white", pad_inches=0.2)
        plt.close(fig)
        buf.seek(0)

        b64_string = base64.b64encode(buf.read()).decode("utf-8")
        return {
            "map_base64": f"data:image/png;base64,{b64_string}",
            "bounds": {
                "min_longitude": float(minx),
                "max_longitude": float(maxx),
                "min_latitude": float(miny),
                "max_latitude": float(maxy),
            },
            "map_center": {"longitude": float((minx + maxx) / 2), "latitude": float((miny + maxy) / 2)},
        }

    def village_intersection(self, geojson_data: dict[str, Any]):
        from shapely.geometry import shape
        from shapely.ops import unary_union

        if not geojson_data or "type" not in geojson_data:
            raise ValueError("Invalid GeoJSON format")

        geo_type = geojson_data["type"]
        if geo_type == "FeatureCollection":
            geometries = [shape(feature["geometry"]) for feature in geojson_data.get("features", [])]
            if not geometries:
                raise ValueError("FeatureCollection has no geometries")
            watershed_geom = unary_union(geometries)
        elif geo_type == "Feature":
            watershed_geom = shape(geojson_data.get("geometry"))
        else:
            watershed_geom = shape(geojson_data)

        minx, miny, maxx, maxy = watershed_geom.bounds
        bbox_filter = f"BBOX(the_geom,{minx},{miny},{maxx},{maxy})"
        spatial_filter = f"INTERSECTS(the_geom, {watershed_geom.wkt})"

        geoserver_workspace = self.settings.GEOSERVER_WORKSPACE
        geoserver_url = self.settings.GEOSERVER_URL.rstrip("/")

        payload = {
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "typeName": f"{geoserver_workspace}:village_boundary_SOI",
            "outputFormat": "application/json",
            "CQL_FILTER": f"{bbox_filter} AND {spatial_filter}",
        }

        response = requests.post(f"{geoserver_url}/{geoserver_workspace}/ows", data=payload, timeout=60)
        if response.status_code != 200:
            raise RuntimeError(f"GeoServer request failed with status {response.status_code}")

        features = response.json().get("features", [])
        villages = []
        total_population = 0

        for feature in features:
            props = feature.get("properties", {})
            population = int(props.get("total_popu") or 0)
            total_population += population
            villages.append(
                {
                    "vlcode": str(props.get("vlcode")),
                    "village": str(props.get("village")),
                    "subdis_cod": props.get("SUBDIS_COD"),
                    "total_popu": population,
                    "geometry": feature.get("geometry"),
                }
            )

        watershed_area_km2 = round(watershed_geom.area * 111 * 111, 2)
        density = round(total_population / watershed_area_km2, 2) if watershed_area_km2 > 0 else 0

        return {
            "success": True,
            "villages": villages,
            "count": len(villages),
            "watershed_area_km2": watershed_area_km2,
            "total_population": total_population,
            "population_density_per_km2": density,
        }


