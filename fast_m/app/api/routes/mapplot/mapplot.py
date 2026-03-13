from fastapi import APIRouter, Query, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.schema.mapplot.mapplot_schema import ExportMapRequest, GeoJSONToShapefileRequest
from app.api.service.mapplot.mapplot_service import MapplotService

router = APIRouter()
service = MapplotService()


@router.post("/spatial/process")
async def spatial_process(request: Request):
    form = await request.form()
    out = service.spatial_process(form)
    return JSONResponse(content=out["content"], status_code=out["status_code"])


@router.get("/spatial/operations")
def spatial_operations():
    return service.spatial_operations_list()


@router.post("/spatial/query")
async def spatial_query(request: Request):
    form = await request.form()
    out = service.spatial_query(form)
    return JSONResponse(content=out["content"], status_code=out["status_code"])


@router.get("/spatial/query/types")
def spatial_query_types():
    return service.spatial_query_types()


@router.get("/shapefiles")
def shapefiles():
    out = service.shapefile_directory()
    return JSONResponse(content=out["content"], status_code=out["status_code"])


@router.get("/get_shapefile")
def get_shapefile(
    category: str = Query(default=""),
    subcategory: str = Query(default=""),
):
    out = service.get_shapefile_data(category, subcategory)
    return JSONResponse(content=out["content"], status_code=out["status_code"])


@router.post("/upload-shapefile")
async def upload_shapefile(request: Request):
    form = await request.form()
    files = form.getlist("file")
    return StreamingResponse(
        service.upload_shapefile_sse(files),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/export/png")
def export_png(payload: ExportMapRequest):
    out = service.export_png(payload.geojson, payload.basemap or "osm", float(payload.basemap_alpha or 0.6))
    if not out["ok"]:
        return JSONResponse(content=out["content"], status_code=out["status_code"])
    return Response(content=out["content"], media_type="image/png")


@router.post("/export/pdf")
def export_pdf(payload: ExportMapRequest):
    out = service.export_pdf(payload.geojson, payload.basemap or "osm", float(payload.basemap_alpha or 0.5), payload.heading or "Map Export")
    if not out["ok"]:
        return JSONResponse(content=out["content"], status_code=out["status_code"])
    return Response(content=out["content"], media_type="application/pdf")


@router.post("/export/shapefile")
def export_shapefile(payload: GeoJSONToShapefileRequest):
    out = service.export_shapefile(payload.geojson, payload.filename or "export")
    if not out["ok"]:
        return JSONResponse(content=out["content"], status_code=out["status_code"])
    return Response(content=out["content"], media_type="application/zip")
