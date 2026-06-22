import asyncio
import json
import tempfile
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.api.schema.manual_stp_schema import (
    ManualCeleryId,
    ManualSTP_suitability_Area,
    ManualSTPAreaResp,
    ManualSTPSuitabilityVisualOutput,
    ManualSTPsuitabilityInput,
    ManualSTPsuitabilityOutput,
    STPManualAreaConfirmOutput,
    STPManualCheckConstraintsInput,
    STPManualCheckConstraintsOutput,
    STPManualFindPathInput,
    STPManualFindPathOutput,
    STPMultiAreaConfirmOutput,
    STPMultiAreaConfirmSingleResult,
    STPMultiAreaOutput,
    STPMultiAreaPayload,
    STPMultiAreaSingleResult,
    STPMultiFindPathInput,
    STPMultiFindPathOutput,
    STPMultiFindPathSingleResult,
    category_raster,
)
from app.api.service.river_water_management.manual_stp_service import ManualSTPMapper
from app.database.config.dependency import db_dependency
from app.dependency.token_dependency import validate_user
from app.utils.exception import validate

router = APIRouter()


def _drain_dicts(drain_points) -> list:
    return [
        {"Drain_No": d.Drain_No, "latitude": d.latitude, "longitude": d.longitude, "Elevation": d.Elevation}
        for d in (drain_points or [])
    ]


# ── Single-polygon endpoints ──────────────────────────────────────────────────

@router.post("/stp_manual_area_confirm", status_code=status.HTTP_201_CREATED, response_model=STPManualAreaConfirmOutput)
@validate
async def stp_manual_area_confirm(
    db: db_dependency,
    method: str = Form(...),
    file: Optional[UploadFile] = File(None),
    polygon: Optional[str] = Form(None),
    buffer_radius_km: float = Form(5.0),
):
    geometry_geojson = None
    if method in ("shapefile", "kml") and file is not None:
        contents = await file.read()
        with tempfile.TemporaryDirectory() as tmp_dir:
            geometry_geojson = ManualSTPMapper.parse_file_to_geojson(contents, file.filename, method, tmp_dir)
    elif method == "polygon" and polygon is not None:
        geometry_geojson = json.loads(polygon)

    if geometry_geojson is None:
        raise HTTPException(status_code=400, detail="No valid geometry provided")

    mapper = ManualSTPMapper()
    result = await mapper.confirm_manual_area(geometry_geojson, buffer_radius_km=buffer_radius_km)
    area_ha, _ = ManualSTPMapper.compute_area_and_bbox(geometry_geojson, buffer_radius_km, result["buffer_bbox"])
    return {
        "raster_layer": [],
        "vector_layer": result["vector_name"],
        "polygon_layer": result["polygon_layer"],
        "centroid_lat": result["centroid_lat"],
        "centroid_lon": result["centroid_lon"],
        "buffer_bbox": result["buffer_bbox"],
        "area_ha": area_ha,
    }


@router.post("/stp_manual_area_raster", status_code=status.HTTP_201_CREATED)
@validate
async def stp_manual_area_raster(db: db_dependency, payload: category_raster):
    if not payload.layer_name:
        raise HTTPException(status_code=400, detail="layer_name is required")
    raster_key = await ManualSTPMapper().create_manual_suitability_raster(payload.layer_name)
    return {"raster_layer": raster_key}


@router.post("/stp_manual_find_path", status_code=status.HTTP_200_OK, response_model=STPManualFindPathOutput)
@validate
async def stp_manual_find_path(payload: STPManualFindPathInput):
    result = await ManualSTPMapper().find_manual_path(
        polygon_geojson=payload.polygon_geojson,
        polygon_layer=payload.polygon_layer,
        cluster_layer=payload.cluster_layer,
        cluster_rank=payload.cluster_rank,
        location=payload.location,
        drain_points=_drain_dicts(payload.drain_points),
        buffer_bbox=payload.buffer_bbox,
    )
    return STPManualFindPathOutput(
        suitable_path=result.get("suitable_path"),
        cluster_distances=result.get("cluster_distances"),
    )


@router.post("/stp_manual_check_constraints", status_code=status.HTTP_200_OK, response_model=STPManualCheckConstraintsOutput)
@validate
async def stp_manual_check_constraints(
    db: db_dependency,
    payload: STPManualCheckConstraintsInput,
    user: Annotated[bool, Depends(validate_user)],
):
    result = await ManualSTPMapper().check_constraints(payload.polygon_geojson, db)
    return STPManualCheckConstraintsOutput(
        constraint_violations=result["constraint_violations"],
        can_proceed=result["can_proceed"],
    )


# ── Preview endpoint ──────────────────────────────────────────────────────────

@router.post("/stp_preview_polygon", status_code=status.HTTP_200_OK)
@validate
async def stp_preview_polygon(
    files: list[UploadFile] = File(...),
    method: str = Form(...),
):
    features = []
    for file in files:
        contents = await file.read()
        with tempfile.TemporaryDirectory() as tmp_dir:
            try:
                geojson = ManualSTPMapper.parse_file_to_geojson(contents, file.filename, method, tmp_dir)
                features.append(ManualSTPMapper.geojson_to_preview_feature(geojson, file.filename))
            except Exception:
                continue
    return {"type": "FeatureCollection", "features": features}


# ── Multi-polygon confirm endpoints ───────────────────────────────────────────

@router.post("/stp_multi_polygon_confirm", status_code=status.HTTP_201_CREATED, response_model=STPMultiAreaConfirmOutput)
@validate
async def stp_multi_polygon_confirm(
    file: UploadFile = File(...),
    method: str = Form(...),
    buffer_radius_km: float = Form(5.0),
):
    contents = await file.read()
    rows = await ManualSTPMapper().confirm_multi_polygon_file(contents, file.filename, method, buffer_radius_km)
    return STPMultiAreaConfirmOutput(results=[
        STPMultiAreaConfirmSingleResult(
            vector_layer=r["vector_name"],
            polygon_layer=r["polygon_layer"],
            centroid_lat=r["centroid_lat"],
            centroid_lon=r["centroid_lon"],
            buffer_bbox=r["tight_bbox"],
            area_ha=r["area_ha"],
        )
        for r in rows
    ])


@router.post("/stp_multi_area_confirm", status_code=status.HTTP_201_CREATED, response_model=STPMultiAreaConfirmOutput)
@validate
async def stp_multi_area_confirm(
    files: list[UploadFile] = File(...),
    method: str = Form(...),
    buffer_radius_km: float = Form(5.0),
):
    mapper = ManualSTPMapper()
    results = []
    for file in files:
        contents = await file.read()
        with tempfile.TemporaryDirectory() as tmp_dir:
            try:
                geojson = ManualSTPMapper.parse_file_to_geojson(contents, file.filename, method, tmp_dir)
            except Exception:
                continue
        result = await mapper.confirm_manual_area(geojson, buffer_radius_km=buffer_radius_km)
        area_ha, tight_bbox = ManualSTPMapper.compute_area_and_bbox(geojson, buffer_radius_km, result["buffer_bbox"])
        results.append(STPMultiAreaConfirmSingleResult(
            vector_layer=result["vector_name"],
            polygon_layer=result["polygon_layer"],
            centroid_lat=result["centroid_lat"],
            centroid_lon=result["centroid_lon"],
            buffer_bbox=tight_bbox,
            area_ha=area_ha,
        ))
    return STPMultiAreaConfirmOutput(results=results)


@router.post("/stp_multi_drawn_confirm", status_code=status.HTTP_201_CREATED, response_model=STPMultiAreaConfirmOutput)
@validate
async def stp_multi_drawn_confirm(payload: dict):
    geometries = payload.get("polygons", [])
    buffer_radius_km = float(payload.get("buffer_radius_km", 5.0))
    if not geometries:
        raise HTTPException(status_code=400, detail="No polygons provided")

    mapper = ManualSTPMapper()
    results = []
    for geojson in geometries:
        result = await mapper.confirm_manual_area(geojson, buffer_radius_km=buffer_radius_km)
        area_ha, tight_bbox = ManualSTPMapper.compute_area_and_bbox(geojson, buffer_radius_km, result["buffer_bbox"])
        results.append(STPMultiAreaConfirmSingleResult(
            vector_layer=result["vector_name"],
            polygon_layer=result["polygon_layer"],
            centroid_lat=result["centroid_lat"],
            centroid_lon=result["centroid_lon"],
            buffer_bbox=tight_bbox,
            area_ha=area_ha,
        ))
    return STPMultiAreaConfirmOutput(results=results)


# ── Multi-polygon path + area endpoints ──────────────────────────────────────

@router.post("/stp_multi_find_path", status_code=status.HTTP_200_OK, response_model=STPMultiFindPathOutput)
@validate
async def stp_multi_find_path(payload: STPMultiFindPathInput):
    mapper = ManualSTPMapper()
    results = []
    for poly in payload.polygons:
        result = await mapper.find_manual_path(
            polygon_geojson=poly.polygon_geojson,
            polygon_layer=poly.polygon_layer,
            cluster_layer=None,
            location=poly.location,
            drain_points=_drain_dicts(poly.drain_points),
            buffer_bbox=poly.buffer_bbox,
        )
        results.append(STPMultiFindPathSingleResult(
            suitable_path=result.get("suitable_path"),
            cluster_distances=result.get("cluster_distances"),
        ))
    return STPMultiFindPathOutput(results=results)


@router.post("/stp_multi_area", status_code=status.HTTP_200_OK, response_model=STPMultiAreaOutput)
@validate
async def stp_multi_area(payload: STPMultiAreaPayload):
    from app.api.service.celery.stp_area.manual_stp_area import manual_find_suitable_area as _find_area
    from app.database.config.dependency import celery_session
    from app.database.crud.raster_operations import rasterOperCrud

    tasks = [
        _find_area.delay(
            treatment_technology=poly.treatment_technology,
            mld_capacity=poly.mld_capacity,
            custom_land_per_mld=poly.custom_land_per_mld,
            layer_name=poly.layer_name,
            location=poly.location,
            drain_points=_drain_dicts(poly.drain_points),
            num_clusters=poly.num_clusters,
        )
        for poly in payload.polygons
    ]

    for _ in range(900):
        if all(t.ready() for t in tasks):
            break
        await asyncio.sleep(1)

    results = []
    for task in tasks:
        with celery_session() as session:
            rec = rasterOperCrud(session).get_task(task.id)
        if rec and rec.task_status == "completed":
            cluster_distances = json.loads(rec.file_path) if rec.file_path else None
            results.append(STPMultiAreaSingleResult(cluster_layer=rec.layer_name, cluster_distances=cluster_distances))
        else:
            results.append(STPMultiAreaSingleResult(cluster_layer=None, cluster_distances=None))

    return STPMultiAreaOutput(results=results)


# ── Suitability raster endpoints ──────────────────────────────────────────────

@router.get("/get_suitability_by_category", status_code=status.HTTP_201_CREATED, response_model=list[ManualSTPsuitabilityOutput])
@validate
async def manual_get_suitability_by_category(
    db: db_dependency,
    category: str,
    user: Annotated[bool, Depends(validate_user)],
    all_data: bool = False,
):
    return await ManualSTPMapper().get_suitability_categories(db, category, all_data)


@router.post("/stp_suitability_visual_display", status_code=status.HTTP_201_CREATED, response_model=ManualSTPSuitabilityVisualOutput)
@validate
async def manual_stp_suitability_visual_display(db: db_dependency, payload: category_raster):
    return await ManualSTPMapper().visual_suitability_map(db, payload.clip, payload.place, payload.layer_name)


@router.post("/stp_suitability", status_code=status.HTTP_201_CREATED)
@validate
async def manual_stp_suitability(db: db_dependency, payload: ManualSTPsuitabilityInput):
    return await ManualSTPMapper().create_suitability_map(db, payload)


@router.post("/stp_suitability_area", status_code=status.HTTP_201_CREATED, response_model=ManualCeleryId)
@validate
async def manual_stp_suitability_area(db: db_dependency, payload: ManualSTP_suitability_Area):
    task_id = await ManualSTPMapper().start_suitability_area_task(payload)
    return ManualCeleryId(task_id=task_id)


@router.get("/stp_area/{task_id}", status_code=status.HTTP_200_OK, response_model=ManualSTPAreaResp)
@validate
async def manual_stp_area(db: db_dependency, task_id: str):
    cluster_layer, cluster_distances, task_status = await ManualSTPMapper().get_suitability_area_result(db, task_id)
    return ManualSTPAreaResp(
        cluster_layer=cluster_layer,
        suitable_path=None,
        cluster_distances=cluster_distances,
        task_status=task_status,
    )
