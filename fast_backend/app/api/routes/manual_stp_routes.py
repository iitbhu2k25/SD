from fastapi import APIRouter, status, Depends, UploadFile, File, Form
from typing import Annotated, Optional
from app.dependency.token_dependency import validate_user
from app.database.config.dependency import db_dependency
from app.api.service.river_water_management.manual_stp_service import ManualSTPMapper
from app.utils.exception import validate
from app.api.schema.manual_stp_schema import (
    category_raster,
    STPManualAreaConfirmOutput,
    STPManualFindPathInput,
    STPManualFindPathOutput,
    STPManualCheckConstraintsInput,
    STPManualCheckConstraintsOutput,
    STPMultiAreaConfirmOutput,
    STPMultiAreaConfirmSingleResult,
    STPMultiFindPathInput,
    STPMultiFindPathOutput,
    STPMultiFindPathSingleResult,
    STPMultiAreaPayload,
    STPMultiAreaOutput,
    STPMultiAreaSingleResult,
    ManualSTPSuitabilityVisualOutput,
    ManualSTPsuitabilityInput,
    ManualSTPsuitabilityOutput,
    ManualSTP_suitability_Area,
    ManualCeleryId,
    ManualSTPAreaResp,
)
import asyncio

router = APIRouter()


@router.post("/stp_manual_area_confirm", status_code=status.HTTP_201_CREATED, response_model=STPManualAreaConfirmOutput)
@validate
async def stp_manual_area_confirm(
    db: db_dependency,
    method: str = Form(...),
    file: Optional[UploadFile] = File(None),
    polygon: Optional[str] = Form(None),
    buffer_radius_km: float = Form(5.0),
):
    """Accept a shapefile (.zip/.shp), KML, or GeoJSON polygon, process the area, and return the vector layer name."""
    import json
    import tempfile
    import zipfile
    from pathlib import Path

    mapper = ManualSTPMapper()
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

    result = await mapper.confirm_manual_area(geometry_geojson, buffer_radius_km=buffer_radius_km)

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
    raster_key = await ManualSTPMapper().create_manual_suitability_raster(payload.layer_name)
    return {"raster_layer": raster_key}


@router.post("/stp_manual_find_path", status_code=status.HTTP_200_OK, response_model=STPManualFindPathOutput)
@validate
async def stp_manual_find_path(payload: STPManualFindPathInput):
    """Find road network path from polygon centroid to the nearest drain."""
    drain_points = [{"Drain_No": d.Drain_No, "latitude": d.latitude, "longitude": d.longitude, "Elevation": d.Elevation} for d in (payload.drain_points or [])]
    result = await ManualSTPMapper().find_manual_path(
        polygon_geojson=payload.polygon_geojson,
        polygon_layer=payload.polygon_layer,
        cluster_layer=payload.cluster_layer,
        cluster_rank=payload.cluster_rank,
        location=payload.location,
        drain_points=drain_points,
        buffer_bbox=payload.buffer_bbox,
    )
    return STPManualFindPathOutput(suitable_path=result.get("suitable_path"), cluster_distances=result.get("cluster_distances"))


@router.post("/stp_manual_check_constraints", status_code=status.HTTP_200_OK, response_model=STPManualCheckConstraintsOutput)
@validate
async def stp_manual_check_constraints(db: db_dependency, payload: STPManualCheckConstraintsInput, user: Annotated[bool, Depends(validate_user)]):
    """Check if any constraint rasters intersect the drawn polygon."""
    result = await ManualSTPMapper().check_constraints(payload.polygon_geojson, db)
    return STPManualCheckConstraintsOutput(
        constraint_violations=result["constraint_violations"],
        can_proceed=result["can_proceed"],
    )


@router.post("/stp_multi_polygon_confirm", status_code=status.HTTP_201_CREATED, response_model=STPMultiAreaConfirmOutput)
@validate
async def stp_multi_polygon_confirm(
    file: UploadFile = File(...),
    method: str = Form(...),
    buffer_radius_km: float = Form(5.0),
):
    """Accept a single shapefile/KML containing multiple polygon rows.
    Each row is confirmed independently so it gets its own unique polygon_layer
    in GeoServer — identical behaviour to stp_multi_area_confirm per file.
    """
    import tempfile, zipfile, geopandas as gpd, fiona
    from pathlib import Path as _Path
    from shapely.geometry import shape as _shape
    import geopandas as _gpd

    fiona.drvsupport.supported_drivers["KML"] = "rw"
    fiona.drvsupport.supported_drivers["LIBKML"] = "rw"

    mapper = ManualSTPMapper()
    results = []

    contents = await file.read()
    suffix = _Path(file.filename).suffix.lower()

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = _Path(tmp_dir) / file.filename
        tmp_path.write_bytes(contents)

        if method == "shapefile":
            if suffix == ".zip":
                with zipfile.ZipFile(tmp_path, "r") as zf:
                    zf.extractall(tmp_dir)
                shp_files = list(_Path(tmp_dir).glob("*.shp"))
                if not shp_files:
                    from fastapi import HTTPException
                    raise HTTPException(status_code=400, detail="No .shp file found inside the zip")
                gdf = gpd.read_file(shp_files[0])
            elif suffix == ".shp":
                gdf = gpd.read_file(tmp_path)
            else:
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail="Unsupported shapefile format")
        elif method == "kml":
            if suffix == ".kmz":
                with zipfile.ZipFile(tmp_path, "r") as zf:
                    kml_files = [n for n in zf.namelist() if n.endswith(".kml")]
                    if not kml_files:
                        from fastapi import HTTPException
                        raise HTTPException(status_code=400, detail="No .kml file found inside the kmz")
                    zf.extract(kml_files[0], tmp_dir)
                    kml_path = _Path(tmp_dir) / kml_files[0]
            else:
                kml_path = tmp_path
            gdf = gpd.read_file(str(kml_path), driver="KML")
        else:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")

        if gdf.crs is None:
            gdf = gdf.set_crs("EPSG:4326")
        gdf_wgs84 = gdf.to_crs("EPSG:4326")

        # Keep only valid polygon/multipolygon rows — drop nulls, empties, and non-polygon types
        gdf_wgs84 = gdf_wgs84[
            gdf_wgs84.geometry.notna() &
            ~gdf_wgs84.geometry.is_empty &
            gdf_wgs84.geometry.geom_type.isin(["Polygon", "MultiPolygon"])
        ].reset_index(drop=True)

        # Deduplicate by WKT so identical geometries are not processed twice
        gdf_wgs84 = gdf_wgs84.loc[
            ~gdf_wgs84.geometry.apply(lambda g: g.wkt).duplicated()
        ].reset_index(drop=True)


        for _, row in gdf_wgs84.iterrows():
            geom = row.geometry
            geometry_geojson = geom.__geo_interface__

            # Each row gets its own confirm_manual_area call → unique polygon_layer in GeoServer
            result = await mapper.confirm_manual_area(geometry_geojson, buffer_radius_km=buffer_radius_km)

            try:
                _geom = _shape(geometry_geojson)
                _gdf = _gpd.GeoDataFrame(geometry=[_geom], crs="EPSG:4326").to_crs("EPSG:32644")
                area_ha = float(_gdf.geometry.area.iloc[0]) / 10_000
                _buffer_m = max(0, min(5000, buffer_radius_km * 1000))
                _buffered_proj = _gdf.geometry.iloc[0].buffer(_buffer_m)
                _buf_wgs84 = _gpd.GeoDataFrame(geometry=[_buffered_proj], crs="EPSG:32644").to_crs("EPSG:4326").geometry.iloc[0]
                tight_bbox = list(_buf_wgs84.bounds)
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


@router.post("/stp_multi_drawn_confirm", status_code=status.HTTP_201_CREATED, response_model=STPMultiAreaConfirmOutput)
@validate
async def stp_multi_drawn_confirm(payload: dict):
    """Accept a JSON array of GeoJSON polygon geometries (drawn on map).
    Each geometry is confirmed independently — same output schema as stp_multi_area_confirm.
    """
    from shapely.geometry import shape as _shape
    import geopandas as _gpd

    geometries = payload.get("polygons", [])
    buffer_radius_km = float(payload.get("buffer_radius_km", 5.0))
    if not geometries:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="No polygons provided")

    mapper = ManualSTPMapper()
    results = []

    for geometry_geojson in geometries:
        result = await mapper.confirm_manual_area(geometry_geojson, buffer_radius_km=buffer_radius_km)
        try:
            _geom = _shape(geometry_geojson)
            _gdf = _gpd.GeoDataFrame(geometry=[_geom], crs="EPSG:4326").to_crs("EPSG:32644")
            area_ha = float(_gdf.geometry.area.iloc[0]) / 10_000
            _buffer_m = max(0, min(5000, buffer_radius_km * 1000))
            _buffered_proj = _gdf.geometry.iloc[0].buffer(_buffer_m)
            _buf_wgs84 = _gpd.GeoDataFrame(geometry=[_buffered_proj], crs="EPSG:32644").to_crs("EPSG:4326").geometry.iloc[0]
            tight_bbox = list(_buf_wgs84.bounds)
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


@router.post("/stp_preview_polygon", status_code=status.HTTP_200_OK)
@validate
async def stp_preview_polygon(
    files: list[UploadFile] = File(...),
    method: str = Form(...),
):
    """Parse uploaded shapefile(s) or KML(s) and return GeoJSON for map preview."""
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
    buffer_radius_km: float = Form(5.0),
):
    """Accept multiple shapefiles or KML files, process each independently."""
    import json, tempfile, zipfile, geopandas as gpd, fiona
    from pathlib import Path as _Path
    from shapely.ops import unary_union
    from shapely.geometry import shape as _shape
    import geopandas as _gpd

    fiona.drvsupport.supported_drivers["KML"] = "rw"
    fiona.drvsupport.supported_drivers["LIBKML"] = "rw"

    mapper = ManualSTPMapper()
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

            result = await mapper.confirm_manual_area(geometry_geojson, buffer_radius_km=buffer_radius_km)

            try:
                _geom = _shape(geometry_geojson)
                _gdf = _gpd.GeoDataFrame(geometry=[_geom], crs="EPSG:4326").to_crs("EPSG:32644")
                area_ha = float(_gdf.geometry.area.iloc[0]) / 10_000
                buffer_m = max(0, min(5000, buffer_radius_km * 1000))
                _buffered_proj = _gdf.geometry.iloc[0].buffer(buffer_m)
                _buf_wgs84 = _gpd.GeoDataFrame(geometry=[_buffered_proj], crs="EPSG:32644").to_crs("EPSG:4326").geometry.iloc[0]
                tight_bbox = list(_buf_wgs84.bounds)
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
    """Find road network path independently for each polygon."""
    mapper = ManualSTPMapper()
    results = []
    for poly in payload.polygons:
        drain_points = [{"Drain_No": d.Drain_No, "latitude": d.latitude, "longitude": d.longitude, "Elevation": d.Elevation} for d in (poly.drain_points or [])]
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
    """Run DSS cluster finding independently for each polygon."""
    from app.api.service.celery.stp_area.manual_stp_area import manual_find_suitable_area as _find_area
    from app.database.config.dependency import celery_session
    from app.database.crud.raster_operations import rasterOperCrud
    import json

    tasks = []
    for poly in payload.polygons:
        drain_points = [{"Drain_No": d.Drain_No, "latitude": d.latitude, "longitude": d.longitude, "Elevation": d.Elevation} for d in (poly.drain_points or [])]
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

    for _ in range(900):
        if all(t.ready() for t in tasks):
            break
        await asyncio.sleep(1)

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
            results.append(STPMultiAreaSingleResult(cluster_layer=layer_name, cluster_distances=cluster_distances))
        else:
            results.append(STPMultiAreaSingleResult(cluster_layer=None, cluster_distances=None))

    return STPMultiAreaOutput(results=results)


# ── Suitability raster endpoints (manual-only, separate from admin/drain) ─────

@router.get("/get_suitability_by_category", status_code=status.HTTP_201_CREATED, response_model=list[ManualSTPsuitabilityOutput])
@validate
async def manual_get_suitability_by_category(db: db_dependency, category: str, user: Annotated[bool, Depends(validate_user)], all_data: bool = False):
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
    return ManualSTPAreaResp(cluster_layer=cluster_layer, suitable_path=None, cluster_distances=cluster_distances, task_status=task_status)
