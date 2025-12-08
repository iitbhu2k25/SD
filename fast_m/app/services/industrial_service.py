import os
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.services.population_service import PopulationService
from app.models import Village


class IndustrialForecastService:

    def __init__(self, db: Session):
        self.db = db
        self.population_service = PopulationService(db)

    def compute_industrial_demand(
        self,
        csv_filename: str,
        groundwater_industrial_demand: float,
        village_codes: Optional[List[int]] = None,
        subdistrict_codes: Optional[List[int]] = None
    ) -> Dict[str, Any]:

        # --- Get villages ---
        if village_codes:
            villages = (
                self.db.query(Village)
                .filter(Village.village_code.in_(village_codes))
                .all()
            )
        elif subdistrict_codes:
            villages = (
                self.db.query(Village)
                .filter(Village.subdistrict_code.in_(subdistrict_codes))
                .all()
            )
        else:
            return {"status": "error", "message": "Provide village_codes or subdistrict_codes"}

        if not villages:
            return {"status": "error", "message": "No villages found"}

        # --- Forecast populations using PopulationService ---
        forecasts_result = self.population_service.forecast(
            csv_filename=csv_filename,
            village_codes=village_codes,
            subdistrict_codes=subdistrict_codes
        )

        forecasts = forecasts_result.get("forecasts", [])
        if not forecasts:
            return {"status": "error", "message": "Population forecast returned no results"}

        # Convert forecasts to dict
        forecast_map = {f["village_code"]: f["forecast_population"] for f in forecasts}

        total_forecast = sum(forecast_map.values())
        if total_forecast <= 0:
            return {"status": "error", "message": "Total forecast is zero"}

        final_output = []

        # --- Industrial demand allocation ---
        for f in forecasts:
            village_code = f["village_code"]
            village_name = f["village_name"]
            forecast_population = f["forecast_population"]

            ratio = forecast_population / total_forecast
            demand = (ratio * groundwater_industrial_demand)/1000


            final_output.append({
                "village_code": village_code,
                "Village_name": village_name,
                # "Forecast_Population": forecast_population,
                # "Ratio": round(ratio, 6),
                "Industrial_demand_(Million litres/Year)": round(demand, 3)
            })
 
        return {
            "status": "success",
            "total_forecast": total_forecast,
            "groundwater_industrial_demand": groundwater_industrial_demand,
            "data": final_output
        }
