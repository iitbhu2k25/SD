from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from fastapi.responses import FileResponse
from app.api.schema.water_schema import StretchesOutput, DrainOutput, DrainInput, StretchesInput, WaterDrainLocationInput
import logging
from pathlib import Path
import shutil
import tempfile
import requests
from requests.auth import HTTPBasicAuth

from app.api.schema.water_schema import (
    WaterAdminLocationInput,
    WaterAdminLocationOutput,
    STPRiverOutput,
    Stp_response,
    Stp_Area,
    Stp_town_respons,
    Town_request,
    Village_request,
    District_request,
    Sub_district_request,
)
from app.api.service.water.water_service import StretchLocation, WaterAvailabilityMapper, Stp_location
from app.database.config.dependency import db_dependency
router = APIRouter()
logger = logging.getLogger(__name__)


def _download_raster_via_wms_geotiff(
    mapper: WaterAvailabilityMapper,
    layer_name: str,
    workspace: str,
    temp_dir: Path,
) -> Path | None:
    processor = mapper.processor
    auth = HTTPBasicAuth(processor.username, processor.password)

    layer_url = (
        f"{processor.geoserver_url}/rest/workspaces/{workspace}/layers/{layer_name}.json"
    )
    layer_resp = requests.get(layer_url, auth=auth, timeout=20)
    if layer_resp.status_code != 200:
        return None

    layer_json = layer_resp.json()
    resource_href = layer_json.get("layer", {}).get("resource", {}).get("href")
    if not resource_href:
        return None

    coverage_resp = requests.get(resource_href, auth=auth, timeout=20)
    if coverage_resp.status_code != 200:
        return None

    coverage_json = coverage_resp.json().get("coverage", {})
    bbox = coverage_json.get("latLonBoundingBox") or coverage_json.get("nativeBoundingBox")
    if not bbox:
        return None

    minx = bbox.get("minx")
    miny = bbox.get("miny")
    maxx = bbox.get("maxx")
    maxy = bbox.get("maxy")
    bbox_crs = str(bbox.get("crs") or "EPSG:4326")
    if None in (minx, miny, maxx, maxy):
        return None

    minx = float(minx)
    miny = float(miny)
    maxx = float(maxx)
    maxy = float(maxy)
    span_x = max(maxx - minx, 1e-9)
    span_y = max(maxy - miny, 1e-9)
    width = 2048
    height = max(256, min(4096, int(round(width * (span_y / span_x)))))

    wms_url = f"{processor.geoserver_url}/wms"
    params = {
        "service": "WMS",
        "version": "1.1.1",
        "request": "GetMap",
        "layers": f"{workspace}:{layer_name}",
        "styles": "",
        "srs": bbox_crs,
        "bbox": f"{minx},{miny},{maxx},{maxy}",
        "width": width,
        "height": height,
        "format": "image/geotiff",
        "transparent": "true",
    }

    wms_resp = requests.get(wms_url, params=params, auth=auth, timeout=60)
    if wms_resp.status_code != 200:
        logger.warning(
            "WMS GeoTIFF fallback failed for %s:%s with status %s",
            workspace,
            layer_name,
            wms_resp.status_code,
        )
        return None

    raster_path = temp_dir / f"{layer_name}.tif"
    raster_path.write_bytes(wms_resp.content)
    return raster_path



@router.post(
    "/process_water_raster",
    status_code=status.HTTP_201_CREATED,
    response_model=WaterAdminLocationOutput,
)
def process_water_raster(payload: WaterAdminLocationInput):
    try:

        mapper = WaterAvailabilityMapper()
        result = mapper.process_water_budget_map(
            subdistrict_codes=payload.subdistrict_codes,
            year=payload.year,
            product_type=payload.product_type,
            time_scale=payload.time_scale,
            season=payload.season,
        )

        return result

    except ValueError as e:
       
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    except Exception as e:
       
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process water raster: {str(e)}",
        )
@router.get("/get_river",response_model=list[STPRiverOutput],status_code=status.HTTP_200_OK)
async def get_river(db:db_dependency):
    return Stp_location.get_river(db)

@router.post("/get_stretch",response_model=StretchesOutput,status_code=status.HTTP_200_OK)
async def get_stretch(db:db_dependency,payload:StretchesInput):
    return StretchLocation.get_stretch(db,payload.river_code)

@router.post("/get_drain",response_model=DrainOutput,status_code=status.HTTP_200_OK)
async def get_drain(db:db_dependency,payload:DrainInput):
    return StretchLocation.get_drain(db,payload.resolved_stretch_ids())




@router.post(
    "/process_drain_raster",
    status_code=status.HTTP_201_CREATED,
    response_model=WaterAdminLocationOutput, # Reuse output model if structure is same
)
def process_drain_raster(payload: WaterDrainLocationInput):
    try:
        mapper = WaterAvailabilityMapper()
        
        # Call the new Drain-specific method
        result = mapper.process_drain_budget_map(
            drain_no=payload.drain_no,
            year=payload.year,
            product_type=payload.product_type,
            time_scale=payload.time_scale,
            season=payload.season,
        )

        return result

    except ValueError as e:
        logger.error(f"Validation error in drain process: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    except Exception as e:
        logger.error(f"Processing error in drain process: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process drain raster: {str(e)}",
        )


@router.get(
    "/download_raster",
    status_code=status.HTTP_200_OK,
    response_class=FileResponse,
)
def download_raster(
    layer_name: str,
    background_tasks: BackgroundTasks,
    workspace: str = "dss_raster",
    filename: str | None = None,
):
    try:
        mapper = WaterAvailabilityMapper()
        temp_dir = Path(tempfile.mkdtemp(prefix="water_raster_download_"))
        download_result = mapper.processor.download_raster_from_geoserver(
            layer_name=layer_name,
            workspace=workspace,
            output_dir=temp_dir,
        )

        raster_path: Path | None = None
        if download_result and download_result.get("raster_path"):
            raster_path = Path(download_result["raster_path"])
        else:
            raster_path = _download_raster_via_wms_geotiff(
                mapper=mapper,
                layer_name=layer_name,
                workspace=workspace,
                temp_dir=temp_dir,
            )

        if raster_path is None:
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Raster download failed or layer not found in GeoServer.",
            )

        if not raster_path.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Downloaded raster file was not found on the server.",
            )

        background_tasks.add_task(shutil.rmtree, temp_dir, True)
        return FileResponse(
            path=str(raster_path),
            media_type="image/tiff",
            filename=filename or raster_path.name,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Water raster download failed: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download raster: {str(e)}",
        )
    

@router.get("/get_states",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)

async def get_states(db:db_dependency,user: bool = False,all_data: bool = False):
    return Stp_location.get_state(db,all_data)

@router.get("/all_districts",status_code=status.HTTP_201_CREATED)

async def get_districtss(db:db_dependency):
    return Stp_location.get_district_all(db)

@router.get("/all_sub_districts",status_code=status.HTTP_201_CREATED)

async def get_sub_districtss(db:db_dependency):
    return Stp_location.get_sub_district_all(db)

@router.get("/get_all_towns",response_model=list[Stp_town_respons],status_code=status.HTTP_201_CREATED)

async def get_towns(db:db_dependency):
    return Stp_location.get_all_town(db)

@router.post("/get_districts",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)

async def get_districts(db:db_dependency,payload:District_request,user: bool = False):
    return Stp_location.get_district(db,payload)


@router.post("/get_sub_districts",response_model=list[Stp_response],status_code=status.HTTP_201_CREATED)

async def get_sub_districts(db:db_dependency,payload:Sub_district_request,user: bool = False):
    return Stp_location.get_sub_district(db,payload)


@router.post("/get_villages",status_code=status.HTTP_201_CREATED)

async def get_villages(db:db_dependency,payload:Village_request,user: bool = False):
    return Stp_location.get_villages(db,payload)


@router.post("/get_towns",response_model=list[Stp_town_respons],status_code=status.HTTP_201_CREATED)

async def get_towns(db:db_dependency,payload:Town_request,user: bool = False):
    return Stp_location.get_town(db,payload)

