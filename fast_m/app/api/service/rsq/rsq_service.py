import os

import geopandas as gpd
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.conf.settings import Settings
from app.database.crud.rsq.rsq_crud import RsqCrud
from app.api.service.rsq.rsq_utils import get_stage_status_and_color, round_props_to_2_decimals


class RsqService:
    def __init__(self, db: Session):
        self.db = db
        self.crud = RsqCrud(db)
        self.settings = Settings()

    # ------------------------------------------------------------------
    # 1. Blocks by district
    # ------------------------------------------------------------------
    def get_blocks_by_district(self, districtcodes: list[int]) -> list[dict]:
        rows = self.crud.get_blocks_by_district(districtcodes)
        return [
            {"block": r.block, "blockcode": r.blockcode, "district": r.district}
            for r in rows
        ]

    # ------------------------------------------------------------------
    # 2. Villages by block
    # ------------------------------------------------------------------
    def get_villages_by_block(self, blockcodes: list[int]) -> list[dict]:
        rows = self.crud.get_villages_by_block(blockcodes)
        return [{"vlcode": r.vlcode, "village": r.village} for r in rows]

    # ------------------------------------------------------------------
    # 3. Groundwater quantification GeoJSON
    # ------------------------------------------------------------------
    def get_quantification_geojson(self, year_full: str, vlcodes: list[int]) -> dict:
        # Convert year: "2022 - 23" → "2022-23"
        db_year = year_full[:4] + "-" + year_full[7:9]

        # Convert codes to int (skip invalid)
        village_codes = []
        for v in vlcodes:
            try:
                village_codes.append(int(v))
            except (TypeError, ValueError):
                pass

        if not village_codes:
            raise HTTPException(status_code=400, detail="Invalid village codes")

        # Fetch groundwater data
        gw_rows = self.crud.get_groundwater_data(db_year, village_codes)
        if not gw_rows:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "No groundwater data found",
                    "year": db_year,
                    "villages_requested": len(village_codes),
                },
            )

        # Load shapefile
        shp_path = os.path.join(
            self.settings.BASE_DIR,
            "media",
            "gwa_data",
            "gwa_shp",
            "Final_Village",
            "Village_New.shp",
        )

        if not os.path.exists(shp_path):
            raise HTTPException(
                status_code=500, detail="Village shapefile not found on server"
            )

        gdf = gpd.read_file(shp_path)

        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        if gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs("EPSG:4326")

        # Filter shapefile by village codes
        gdf_filtered = gdf[
            gdf["vlcode"].astype(str).isin([str(v) for v in village_codes])
        ]

        if gdf_filtered.empty:
            raise HTTPException(
                status_code=404, detail="No villages found in shapefile"
            )

        # Build lookup dict: village_co → row data + status/color
        db_dict: dict[int, dict] = {}
        for row in gw_rows:
            key = int(row.village_co)
            stage = row.stage_of_extraction
            status_text, color = get_stage_status_and_color(stage)
            db_dict[key] = {
                "id": row.id,
                "village_co": key,
                "block_code": row.block_code,
                "district_code": row.district_code,
                "subdistrict_code": row.subdistrict_code,
                "year": row.year,
                "factor": row.factor,
                "village_area": row.village_area,
                "block_area": row.block_area,
                "total_geographical_area": row.total_geographical_area,
                "recharge_worthy_area": row.recharge_worthy_area,
                "recharge_rainfall_mon": row.recharge_rainfall_mon,
                "recharge_other_mon": row.recharge_other_mon,
                "recharge_rainfall_nm": row.recharge_rainfall_nm,
                "recharge_other_nm": row.recharge_other_nm,
                "total_annual_recharge": row.total_annual_recharge,
                "total_natural_discharge": row.total_natural_discharge,
                "extractable_resource": row.extractable_resource,
                "irrigation_use": row.irrigation_use,
                "industrial_use": row.industrial_use,
                "domestic_use": row.domestic_use,
                "total_extraction": row.total_extraction,
                "annual_gw_allocation_domestic": row.annual_gw_allocation_domestic,
                "net_future_availability": row.net_future_availability,
                "bo_aquifer": row.bo_aquifer,
                "stage_of_extraction": stage,
                "category": row.category,
                "status": status_text,
                "color": color,
            }

        # Build GeoJSON features
        features = []
        for _, shp_row in gdf_filtered.iterrows():
            try:
                village_int = int(float(shp_row["vlcode"]))
            except Exception:
                continue

            props = {
                "village_co": village_int,
                "village": (
                    shp_row.get("village")
                    or shp_row.get("VILL_NAME")
                    or shp_row.get("VILLAGE")
                    or "Unknown Village"
                ),
            }

            if village_int in db_dict:
                props.update(db_dict[village_int])

            features.append(
                {
                    "type": "Feature",
                    "geometry": shp_row.geometry.__geo_interface__,
                    "properties": round_props_to_2_decimals(props),
                }
            )

        return {"type": "FeatureCollection", "features": features}
