import os
from datetime import datetime
from typing import List, Dict, Any, Optional

import geopandas as gpd
from fastapi import HTTPException
from pydantic import BaseModel
from app.core.config import settings


class GSRVillage(BaseModel):
    village_code: str
    village_name: Optional[str] = "Unknown"
    recharge: float
    total_demand: float


class StressIdentificationService:
    

    shapefile_path: Optional[str] = None
    shapefile_map: Dict[str, float] = {}

    def load_shapefile(self) -> None:
        """Load shapefile once and store mapping {village_co: injection}."""
        try:
            if not self.shapefile_path:
                media_dir = os.path.join(settings.BASE_DIR, "media")
                self.shapefile_path = os.path.join(
                    media_dir,
                    "gwa_data",
                    "gwa_shp",
                    "Final_Village",
                    "Injection_Water_Need.shp",
                )

            if not os.path.exists(self.shapefile_path):
                raise HTTPException(
                    status_code=400,
                    detail=f"Shapefile not found at {self.shapefile_path}",
                )

            gdf = gpd.read_file(self.shapefile_path)

            if "village_co" not in gdf.columns or "Injection_" not in gdf.columns:
                raise HTTPException(
                    status_code=400,
                    detail="Shapefile missing required fields: village_co / Injection_",
                )

            gdf["village_co"] = gdf["village_co"].astype(str).str.strip()

            mapping = {}
            for _, row in gdf.iterrows():
                key = row["village_co"]
                try:
                    val = float(row.get("Injection_", 0) or 0)
                except:
                    val = 0.0
                mapping[key] = val

            self.shapefile_map = mapping
            print(f"Loaded shapefile — {len(mapping)} villages")

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error loading shapefile: {str(e)}")

    def compute_stress(
        self,
        gsr_data: List[Dict[str, Any]],
        years_count: int,
    ) -> Dict[str, Any]:

        if years_count <= 0:
            raise HTTPException(status_code=400, detail="years_count must be > 0")

        if not self.shapefile_map:
            self.load_shapefile()

        stress_results = []
        villages_processed = 0
        villages_with_injection = 0

        for row in gsr_data:
            village_code = str(row.get("village_code", "")).strip()

            if not village_code:
                continue
            if village_code not in self.shapefile_map:
                continue

            recharge = float(row.get("recharge", 0) or 0)
            demand = float(row.get("total_demand", 0) or 0)
            village_name = row.get("village_name", "Unknown")

            injection = self.shapefile_map.get(village_code, 0)
            if injection > 0:
                villages_with_injection += 1

            stress = (max(recharge - demand, 0) + (injection / years_count)) / 1000

            stress_results.append(
                {
                    "village_code": village_code,
                    "village_name": village_name,
                    "recharge": round(recharge, 4),
                    "total_demand": round(demand, 4),
                    "injection": round(injection, 4) / 1000,
                    "years_count": years_count,
                    "stress_value": round(stress, 2),
                }
            )

            villages_processed += 1

        summary = {
            "total_villages_processed": villages_processed,
            "villages_with_injection_data": villages_with_injection,
            "villages_without_injection_data": villages_processed - villages_with_injection,
            "years_count_used": years_count,
            "shapefile_villages_available": len(self.shapefile_map),
            "gsr_input_villages": len(gsr_data),
        }

        return {
            "success": True,
            "data": stress_results,
            "message": f"Stress values computed for {len(stress_results)} villages",
            "years_count": years_count,
            "total_villages": len(stress_results),
            "summary_stats": summary,
            "computed_at": datetime.now().isoformat(),
        }
