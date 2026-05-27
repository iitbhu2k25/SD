from fastapi import APIRouter,status,Depends,UploadFile,File,Form
from typing import Annotated, Optional
from app.dependency.token_dependency import validate_user
from app.database.config.dependency import db_dependency
from app.api.service.river_water_management.spt_service import Stp_service
from app.api.schema.stp_schema import  STP_suitability_Area, STPPriorityVisualOutput, STPSuitabilityVisualOutput,STPManualAreaConfirmOutput,Stp_Area,STPCategory,STPCatchmentInput,STPCatchmentOutput,StpsuitabilityAdminReport,StpsuitabilityDrainReport,STPsuitabilityOutput,STPPriorityOutput,STPsuitabilityInput,category_raster,StpPriorityDrainReport,StpPriorityAdminReport,celery_id, stp_area_resp, STPManualFindPathInput, STPManualFindPathOutput, STPManualCheckConstraintsInput, STPManualCheckConstraintsOutput, STPMultiAreaConfirmOutput, STPMultiAreaConfirmSingleResult, STPMultiFindPathInput, STPMultiFindPathOutput, STPMultiFindPathSingleResult, STPMultiAreaPayload, STPMultiAreaOutput, STPMultiAreaSingleResult
from app.api.service.river_water_management.stp_operation import STPPriorityMapper,STPsuitabilityMapper
from app.api.service.celery.stp_area.stp_area import find_suitable_area
from app.api.service.celery.pdf_generations.stp_priority_admin_document import document_gen
from app.api.service.celery.pdf_generations.stp_priority_drain_document import document_gen1
from app.api.service.celery.pdf_generations.stp_suitability_admin_report import document_gen2
from app.api.service.celery.pdf_generations.stp_suitability_drain_report import document_gen3
from app.conf.ws_config import ConnectionManager,safe_send
from fastapi import  WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from celery.result import AsyncResult
import asyncio
from app.utils.exception import validate
from pathlib import Path
from app.conf.logging import logger
from app.api.service.raster_work.raster_operation import RasterOperation


connection_manager=ConnectionManager()
router=APIRouter()


@router.get("/get_priority_category",status_code=status.HTTP_201_CREATED,response_model=list[STPPriorityOutput])
@validate
async def get_priority_category(db:db_dependency,user: Annotated[bool, Depends(validate_user)],all_data: bool = False):
    """ It return the priority raster information"""
    return Stp_service.get_priority_category(db,all_data)

@router.post("/stp_priority_visual_display",status_code=status.HTTP_201_CREATED,response_model=STPPriorityVisualOutput)
@validate
async def stp_priority_visual_display(db:db_dependency,payload:category_raster):
    """ It make the stp priority visual raster for displaying"""
    return await STPPriorityMapper().visual_priority_map(db,payload.clip,payload.place,payload.layer_name)

@router.post("/stp_priority",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_priority(db:db_dependency,payload: STPCategory):
    """ It calculater the stp priority """
    return  await STPPriorityMapper().create_priority_map(db,payload)

@router.post("/get_priority_cachement",response_model=STPCatchmentOutput,status_code=status.HTTP_201_CREATED)
@validate
async def get_priority_cachement(db:db_dependency,payload:STPCatchmentInput):
    """It make the stp priority cachement """
    return await STPPriorityMapper().cachement_villages(payload.drain_nos)


@router.post("/stp_priority_admin_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_priority_admin_report(payload:StpPriorityAdminReport,user: Annotated[bool, Depends(validate_user)]):
    """It make the stp priority admin report """
    task_id= document_gen.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)

@router.post("/stp_priority_drain_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_priority_drain_report(payload:StpPriorityDrainReport,user: Annotated[bool, Depends(validate_user)]):
    """It make the stp priority drain report """
    task_id= document_gen1.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id) 
 
# stp suitability
@router.get("/get_suitability_by_category",status_code=status.HTTP_201_CREATED,response_model=list[STPsuitabilityOutput])
@validate
async def get_raster_suitability(db:db_dependency,category:str,user: Annotated[bool, Depends(validate_user)],all_data: bool = False):
    """ It return the suitability raster information"""
    return Stp_service.get_raster_suitability(db,category,all_data)


@router.post("/stp_suitability_visual_display",status_code=status.HTTP_201_CREATED,response_model=STPSuitabilityVisualOutput)
@validate
async def stp_priority_raster_dislay(db:db_dependency,payload:category_raster):
    """ It make the stp suitability visual raster for displaying"""
    return await STPsuitabilityMapper().visual_sutabilty_map(db,payload.clip,payload.place,payload.layer_name)

@router.post("/get_suitability_cachement",response_model=STPCatchmentOutput,status_code=status.HTTP_201_CREATED)
@validate
async def get_suitability_cachement(db:db_dependency,payload:STPCatchmentInput):
    """It make the stp suitability cachement """
    return await STPsuitabilityMapper().cachement_villages(db,payload.drain_nos)

    
@router.post("/stp_suitability",status_code=status.HTTP_201_CREATED,)
@validate
async def stp_classify(db:db_dependency,payload:STPsuitabilityInput,):
    """ It calculater the stp suitability """
    return await STPsuitabilityMapper().create_suitability_map(db,payload)


@router.post("/stp_suitability_admin_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_suitability_admin_report(payload:StpsuitabilityAdminReport,user: Annotated[bool, Depends(validate_user)]):
    """It make the stp suitability admin report """
    task_id= document_gen2.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)

@router.post("/stp_suitability_drain_report",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_suitability_drain_report(payload:StpsuitabilityDrainReport,user: Annotated[bool, Depends(validate_user)]):
    """It make the stp suitability drain report """
    task_id= document_gen3.delay(payload=payload.model_dump())
    return celery_id(task_id=task_id.id)


    

@router.post("/stp_suitability_area",status_code=status.HTTP_201_CREATED,response_model=celery_id)
@validate
async def stp_suitability_area(db:db_dependency,payload:STP_suitability_Area):
    drain_points_raw = [{"Drain_No": d.Drain_No, "latitude": d.latitude, "longitude": d.longitude} for d in (payload.drain_points or [])]
    task_id=find_suitable_area.delay(
        treatment_technology=payload.treatment_technology,
        mld_capacity=payload.mld_capacity,
        custom_land_per_mld=payload.custom_land_per_mld,
        layer_name=payload.layer_name,
        location=payload.location,
        drain_points=drain_points_raw,
        num_clusters=payload.num_clusters,
    )
    return celery_id(task_id=task_id.id)

@router.get("/stp_area/{task_id}",status_code=status.HTTP_200_OK,response_model=stp_area_resp)
@validate
async def stp_area(db:db_dependency,task_id:str):
    import json as _json
    resp=await RasterOperation().get_result(db,task_id)
    cluster_distances = None
    if resp.file_path:
        try:
            cluster_distances = _json.loads(resp.file_path)
        except Exception:
            cluster_distances = None
    return stp_area_resp(cluster_layer=resp.layer_name, suitable_path=None, cluster_distances=cluster_distances, task_status=resp.task_status)

@router.get("/get_report",status_code=status.HTTP_200_OK,response_class=FileResponse)
@validate
async def get_report(chord_id:str,user: Annotated[bool, Depends(validate_user)]):
    file_path = AsyncResult(chord_id).get()      
    file_path = Path(file_path)
    if not file_path.exists():
        return {"error": "File not found"}
    return FileResponse(path=file_path, filename=file_path.name, media_type="application/pdf")


@router.post("/stp_manual_area_confirm", status_code=status.HTTP_201_CREATED, response_model=STPManualAreaConfirmOutput)
@validate
async def stp_manual_area_confirm(
    db: db_dependency,
    method: str = Form(...),
    file: Optional[UploadFile] = File(None),
    polygon: Optional[str] = Form(None),
):
    """Accept a shapefile (.zip/.shp), KML, or GeoJSON polygon, process the area, and return the vector layer name."""
    import json
    import tempfile
    import zipfile
    from pathlib import Path

    mapper = STPsuitabilityMapper()

    geometry_geojson = None

    if method in ("shapefile", "kml") and file is not None:
        contents = await file.read()
        suffix = Path(file.filename).suffix.lower()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir) / file.filename
            tmp_path.write_bytes(contents)

            if suffix == ".zip":
                import geopandas as gpd
                with zipfile.ZipFile(tmp_path, "r") as zf:
                    zf.extractall(tmp_dir)
                shp_files = list(Path(tmp_dir).glob("*.shp"))
                if not shp_files:
                    from fastapi import HTTPException
                    raise HTTPException(status_code=400, detail="No .shp file found inside the zip")
                gdf = gpd.read_file(shp_files[0])
                if gdf.crs is None:
                    gdf = gdf.set_crs("EPSG:4326")
                gdf_wgs84 = gdf.to_crs("EPSG:4326")
                from shapely.ops import unary_union
                union_geom = unary_union(gdf_wgs84.geometry)
                geometry_geojson = union_geom.__geo_interface__

            elif suffix in (".shp",):
                import geopandas as gpd
                gdf = gpd.read_file(tmp_path)
                if gdf.crs is None:
                    gdf = gdf.set_crs("EPSG:4326")
                gdf_wgs84 = gdf.to_crs("EPSG:4326")
                from shapely.ops import unary_union
                union_geom = unary_union(gdf_wgs84.geometry)
                geometry_geojson = union_geom.__geo_interface__

            elif suffix in (".kml", ".kmz"):
                import fiona
                import geopandas as gpd
                fiona.drvsupport.supported_drivers["KML"] = "rw"
                fiona.drvsupport.supported_drivers["LIBKML"] = "rw"
                if suffix == ".kmz":
                    with zipfile.ZipFile(tmp_path, "r") as zf:
                        kml_files = [n for n in zf.namelist() if n.endswith(".kml")]
                        if not kml_files:
                            from fastapi import HTTPException
                            raise HTTPException(status_code=400, detail="No .kml file found inside the kmz")
                        zf.extract(kml_files[0], tmp_dir)
                        kml_path = Path(tmp_dir) / kml_files[0]
                else:
                    kml_path = tmp_path
                gdf = gpd.read_file(str(kml_path), driver="KML")
                gdf_wgs84 = gdf.to_crs("EPSG:4326") if gdf.crs else gdf.set_crs("EPSG:4326")
                from shapely.ops import unary_union
                union_geom = unary_union(gdf_wgs84.geometry)
                geometry_geojson = union_geom.__geo_interface__

    elif method == "polygon" and polygon is not None:
        parsed = json.loads(polygon)
        geometry_geojson = parsed

    if geometry_geojson is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No valid geometry provided")

    result = await mapper.confirm_manual_area(geometry_geojson)

    # Calculate area in hectares using projected CRS (EPSG:32644 ~= UTM zone 44N, good for India)
    try:
        import geopandas as _gpd
        from shapely.geometry import shape as _shape
        _geom = _shape(geometry_geojson)
        _gdf = _gpd.GeoDataFrame(geometry=[_geom], crs="EPSG:4326").to_crs("EPSG:32644")
        area_ha = float(_gdf.geometry.area.iloc[0]) / 10_000
    except Exception:
        area_ha = 0.0

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
    """Convert a confirmed manual area vector (by layer_name from Redis) into a binary suitability raster."""
    if not payload.layer_name:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="layer_name is required")
    raster_key = await STPsuitabilityMapper().create_manual_suitability_raster(payload.layer_name)
    return {"raster_layer": raster_key}


@router.post("/stp_manual_find_path", status_code=status.HTTP_200_OK, response_model=STPManualFindPathOutput)
@validate
async def stp_manual_find_path(payload: STPManualFindPathInput):
    """Find road network path from polygon centroid to the drawn cluster (no raster needed)."""
    drain_points = [{"Drain_No": d.Drain_No, "latitude": d.latitude, "longitude": d.longitude} for d in (payload.drain_points or [])]
    result = await STPsuitabilityMapper().find_manual_path(
        polygon_geojson=payload.polygon_geojson,
        polygon_layer=payload.polygon_layer,
        cluster_layer=payload.cluster_layer,
        location=payload.location,
        drain_points=drain_points,
        buffer_bbox=payload.buffer_bbox,
    )
    return STPManualFindPathOutput(suitable_path=result.get("suitable_path"), cluster_distances=result.get("cluster_distances"))


@router.post("/stp_manual_check_constraints", status_code=status.HTTP_200_OK, response_model=STPManualCheckConstraintsOutput)
@validate
async def stp_manual_check_constraints(db: db_dependency, payload: STPManualCheckConstraintsInput, user: Annotated[bool, Depends(validate_user)]):
    """Check if any constraint rasters (railway, highway, water body, etc.) intersect the drawn polygon."""
    result = await STPsuitabilityMapper().check_constraints(payload.polygon_geojson, db)
    return STPManualCheckConstraintsOutput(
        constraint_violations=result["constraint_violations"],
        can_proceed=result["can_proceed"],
    )


@router.post("/stp_preview_polygon", status_code=status.HTTP_200_OK)
@validate
async def stp_preview_polygon(
    files: list[UploadFile] = File(...),
    method: str = Form(...),
):
    """Parse uploaded shapefile(s) or KML(s) and return their GeoJSON geometries for map preview. No backend processing."""
    import json, tempfile, zipfile, geopandas as gpd, fiona
    from pathlib import Path as _Path
    from shapely.ops import unary_union

    fiona.drvsupport.supported_drivers["KML"] = "rw"
    fiona.drvsupport.supported_drivers["LIBKML"] = "rw"

    features = []
    for file in files:
        contents = await file.read()
        suffix = _Path(file.filename).suffix.lower()
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = _Path(tmp_dir) / file.filename
            tmp_path.write_bytes(contents)
            try:
                if method == "shapefile":
                    if suffix == ".zip":
                        with zipfile.ZipFile(tmp_path, "r") as zf:
                            zf.extractall(tmp_dir)
                        shp_files = list(_Path(tmp_dir).glob("*.shp"))
                        if not shp_files:
                            continue
                        gdf = gpd.read_file(shp_files[0])
                    elif suffix == ".shp":
                        gdf = gpd.read_file(tmp_path)
                    else:
                        continue
                elif method == "kml":
                    if suffix == ".kmz":
                        with zipfile.ZipFile(tmp_path, "r") as zf:
                            kml_files = [n for n in zf.namelist() if n.endswith(".kml")]
                            if not kml_files:
                                continue
                            zf.extract(kml_files[0], tmp_dir)
                            kml_path = _Path(tmp_dir) / kml_files[0]
                    else:
                        kml_path = tmp_path
                    gdf = gpd.read_file(str(kml_path), driver="KML")
                else:
                    continue
                if gdf.crs is None:
                    gdf = gdf.set_crs("EPSG:4326")
                gdf_wgs84 = gdf.to_crs("EPSG:4326")
                geom = unary_union(gdf_wgs84.geometry)
                try:
                    area_ha = float(gpd.GeoDataFrame(geometry=[geom], crs="EPSG:4326").to_crs("EPSG:32644").geometry.area.iloc[0]) / 10_000
                except Exception:
                    area_ha = 0.0
                features.append({"type": "Feature", "geometry": json.loads(gpd.GeoSeries([geom], crs="EPSG:4326").to_json())["features"][0]["geometry"], "properties": {"name": file.filename, "area_ha": round(area_ha, 2)}})
            except Exception:
                continue

    return {"type": "FeatureCollection", "features": features}


@router.post("/stp_multi_area_confirm", status_code=status.HTTP_201_CREATED, response_model=STPMultiAreaConfirmOutput)
@validate
async def stp_multi_area_confirm(
    files: list[UploadFile] = File(...),
    method: str = Form(...),
):
    """Accept multiple shapefiles or KML files, process each independently, return per-polygon results."""
    import json, tempfile, zipfile, geopandas as gpd, fiona
    from pathlib import Path as _Path
    from shapely.ops import unary_union
    from shapely.geometry import shape as _shape
    import geopandas as _gpd

    fiona.drvsupport.supported_drivers["KML"] = "rw"
    fiona.drvsupport.supported_drivers["LIBKML"] = "rw"

    mapper = STPsuitabilityMapper()
    results = []

    for file in files:
        contents = await file.read()
        suffix = _Path(file.filename).suffix.lower()

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = _Path(tmp_dir) / file.filename
            tmp_path.write_bytes(contents)
            geometry_geojson = None

            if method == "shapefile":
                if suffix == ".zip":
                    with zipfile.ZipFile(tmp_path, "r") as zf:
                        zf.extractall(tmp_dir)
                    shp_files = list(_Path(tmp_dir).glob("*.shp"))
                    if not shp_files:
                        continue
                    gdf = gpd.read_file(shp_files[0])
                elif suffix == ".shp":
                    gdf = gpd.read_file(tmp_path)
                else:
                    continue
                if gdf.crs is None:
                    gdf = gdf.set_crs("EPSG:4326")
                gdf_wgs84 = gdf.to_crs("EPSG:4326")
                # Each feature in the file is a separate polygon — process all as one union per file
                geometry_geojson = unary_union(gdf_wgs84.geometry).__geo_interface__

            elif method == "kml":
                if suffix == ".kmz":
                    with zipfile.ZipFile(tmp_path, "r") as zf:
                        kml_files = [n for n in zf.namelist() if n.endswith(".kml")]
                        if not kml_files:
                            continue
                        zf.extract(kml_files[0], tmp_dir)
                        kml_path = _Path(tmp_dir) / kml_files[0]
                else:
                    kml_path = tmp_path
                gdf = gpd.read_file(str(kml_path), driver="KML")
                gdf_wgs84 = gdf.to_crs("EPSG:4326") if gdf.crs else gdf.set_crs("EPSG:4326")
                geometry_geojson = unary_union(gdf_wgs84.geometry).__geo_interface__

            if geometry_geojson is None:
                continue

            result = await mapper.confirm_manual_area(geometry_geojson)

            # Compute bbox and area from the actual uploaded polygon geometry (NOT the village union
            # buffer, which can be very large and overlap with other polygons).
            # Buffer by 5 km in projected CRS so nearby drains are included.
            try:
                _geom = _shape(geometry_geojson)
                _gdf = _gpd.GeoDataFrame(geometry=[_geom], crs="EPSG:4326").to_crs("EPSG:32644")
                area_ha = float(_gdf.geometry.area.iloc[0]) / 10_000
                _buffered_proj = _gdf.geometry.iloc[0].buffer(5000)
                _buf_wgs84 = _gpd.GeoDataFrame(geometry=[_buffered_proj], crs="EPSG:32644").to_crs("EPSG:4326").geometry.iloc[0]
                tight_bbox = list(_buf_wgs84.bounds)  # [minx, miny, maxx, maxy] in WGS84
            except Exception:
                area_ha = 0.0
                tight_bbox = result["buffer_bbox"]

            results.append(STPMultiAreaConfirmSingleResult(
                vector_layer=result["vector_name"],
                polygon_layer=result["polygon_layer"],
                centroid_lat=result["centroid_lat"],
                centroid_lon=result["centroid_lon"],
                buffer_bbox=tight_bbox,
                area_ha=area_ha,
            ))

    return STPMultiAreaConfirmOutput(results=results)


@router.post("/stp_multi_find_path", status_code=status.HTTP_200_OK, response_model=STPMultiFindPathOutput)
@validate
async def stp_multi_find_path(payload: STPMultiFindPathInput):
    """Find road network path independently for each polygon. Each polygon's result is kept separate."""
    mapper = STPsuitabilityMapper()
    results = []
    for poly in payload.polygons:
        drain_points = [{"Drain_No": d.Drain_No, "latitude": d.latitude, "longitude": d.longitude} for d in (poly.drain_points or [])]
        result = await mapper.find_manual_path(
            polygon_geojson=poly.polygon_geojson,
            polygon_layer=poly.polygon_layer,
            cluster_layer=None,
            location=poly.location,
            drain_points=drain_points,
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
    """Run DSS cluster finding independently for each polygon. Each polygon's clusters are kept separate."""
    from app.api.service.celery.stp_area.stp_area import find_suitable_area as _find_area
    from app.database.config.dependency import celery_session
    from app.database.crud.raster_operations import rasterOperCrud
    import json

    # Dispatch all tasks first so they run in parallel on the Celery worker
    tasks = []
    for poly in payload.polygons:
        drain_points = [{"Drain_No": d.Drain_No, "latitude": d.latitude, "longitude": d.longitude} for d in (poly.drain_points or [])]
        task = _find_area.delay(
            treatment_technology=poly.treatment_technology,
            mld_capacity=poly.mld_capacity,
            custom_land_per_mld=poly.custom_land_per_mld,
            layer_name=poly.layer_name,
            location=poly.location,
            drain_points=drain_points,
            num_clusters=poly.num_clusters,
        )
        tasks.append(task)

    # Poll all tasks together until all finish or timeout (90s per poll cycle, up to 300 iterations)
    for _ in range(300):
        if all(t.ready() for t in tasks):
            break
        await asyncio.sleep(1)

    # Collect results — read all ORM fields inside the session
    results = []
    for task in tasks:
        with celery_session() as session:
            task_record = rasterOperCrud(session).get_task(task.id)
            if task_record:
                task_status = task_record.task_status
                layer_name = task_record.layer_name
                file_path = task_record.file_path
            else:
                task_status = None
                layer_name = None
                file_path = None
        if task_status == "completed":
            cluster_distances = json.loads(file_path) if file_path else None
            results.append(STPMultiAreaSingleResult(
                cluster_layer=layer_name,
                cluster_distances=cluster_distances,
            ))
        else:
            results.append(STPMultiAreaSingleResult(cluster_layer=None, cluster_distances=None))

    return STPMultiAreaOutput(results=results)


@router.websocket("/ws/{task_id}")
async def report_download(websocket: WebSocket, task_id: str):
    await websocket.accept()
    await connection_manager.connect(websocket, task_id)
    try:
        while True:
            result = AsyncResult(task_id)
            if result.state == 'PENDING':
                progress_data = {
                    'state': 'PENDING',
                    'progress': 0,
                    'total': 100,
                    'description': 'Task pending...'
                }
            
            elif result.state == 'FAILURE':
                error_msg = str(result.info) if result.info else 'Unknown error'
                progress_data = {
                    'state': 'FAILURE',
                    'progress': 100,
                    'total': 100,
                    'description': f'Failed: {error_msg}'
                }
                await safe_send(websocket, progress_data)
 
                break
            
            elif result.state == 'SUCCESS':
                result_id = task_id
                if isinstance(result.result, dict):
                    result_id = result.result.get('chord_id', task_id)
                progress_data = {
                    'state': 'SUCCESS',
                    'progress': 100,
                    'total': 100,
                    'description': 'Complete',
                    'result': result_id
                }
                await websocket.send_json(progress_data)
                break
            
            else:
                if result.info and isinstance(result.info, dict):
                    progress_data = {
                        'state': result.state,
                        'progress': result.info.get('current', 0),
                        'total': result.info.get('total', 100),
                        'description': result.info.get('description', 'Processing...')
                    }
                else:
                    logger.info(f"Unknown result info: {result.info}")
                    progress_data = {
                        'state': result.state,
                        'progress': 50,
                        'total': 100,
                        'description': f'State: {result.state}'
                    }
            
            await safe_send(websocket,progress_data)
            await asyncio.sleep(0.5)
    
    except WebSocketDisconnect:
        pass
    
    except Exception as e:
        await safe_send(websocket, {"state": "ERROR", "description": str(e)})
    finally:
        await connection_manager.disconnect(websocket, task_id)