from fastapi import APIRouter, File, Form, Query, Request, Response, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse

from app.api.schema.mapplot.mapplot_schema import (
    ChunkUploadRequest,
    ExportMapRequest,
    FieldsRequest,
    GeoJSONToShapefileRequest,
)
from app.api.service.mapplot.mapplot_service import MapplotService

router = APIRouter()
service = MapplotService()


@router.post("/chunk")
def upload_chunk(payload: ChunkUploadRequest):
    """Receive one 1 MB slice of a GeoJSON payload.

    The client splits large GeoJSON strings into 1 MB chunks and POSTs each
    one here.  Once all chunks for an ``upload_id`` have arrived, subsequent
    export/spatial endpoints can reference the data by ``upload_id`` instead
    of embedding the full GeoJSON in the request body.
    """
    out = service.upload_chunk(
        payload.upload_id,
        payload.chunk_index,
        payload.total_chunks,
        payload.data,
    )
    return JSONResponse(content=out["content"], status_code=out["status_code"])


@router.post("/fields")
def get_fields(payload: FieldsRequest):
    """Return attribute/field names for a GeoJSON layer.

    Accepts either a full ``geojson`` body or an ``upload_id`` referencing
    previously chunked data.  Returns ``{"fields": ["col1", "col2", ...]}``
    so the frontend can populate field-name dropdowns without re-sending data.
    """
    out = service.get_layer_fields(geojson=payload.geojson, upload_id=payload.upload_id)
    return JSONResponse(content=out["content"], status_code=out["status_code"])


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


@router.post("/upload-file-chunk")
async def upload_file_chunk(
    upload_id: str = Form(...),
    file_index: int = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    filename: str = Form(...),
    data: UploadFile = File(...),
):
    """Receive one binary chunk of a large shapefile upload.

    The client slices each file into 5 MB pieces and POSTs them here with
    ``upload_id`` / ``file_index`` / ``chunk_index`` metadata.  Once all
    chunks are stored on disk the client calls ``POST /upload-shapefile``
    with the same ``upload_id`` to trigger SSE-based processing.
    """
    chunk_bytes = await data.read()
    out = service.upload_file_chunk(upload_id, file_index, chunk_index, total_chunks, filename, chunk_bytes)
    return JSONResponse(content=out["content"], status_code=out["status_code"])


@router.post("/upload-shapefile")
async def upload_shapefile(request: Request):
    form = await request.form()
    files = form.getlist("file")
    upload_id = form.get("upload_id") or None  # present only for chunked uploads
    return StreamingResponse(
        service.upload_shapefile_sse(files, upload_id=upload_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/export/png")
def export_png(payload: ExportMapRequest):
    out = service.export_png(
        geojson=payload.geojson,
        basemap=payload.basemap or "osm",
        basemap_alpha=float(payload.basemap_alpha or 0.6),
        upload_id=payload.upload_id,
    )
    if not out["ok"]:
        return JSONResponse(content=out["content"], status_code=out["status_code"])
    return Response(content=out["content"], media_type="image/png")


@router.post("/export/pdf")
def export_pdf(payload: ExportMapRequest):
    out = service.export_pdf(
        geojson=payload.geojson,
        basemap=payload.basemap or "osm",
        basemap_alpha=float(payload.basemap_alpha or 0.5),
        heading=payload.heading or "Map Export",
        upload_id=payload.upload_id,
    )
    if not out["ok"]:
        return JSONResponse(content=out["content"], status_code=out["status_code"])
    return Response(content=out["content"], media_type="application/pdf")


@router.post("/export/shapefile")
def export_shapefile(payload: GeoJSONToShapefileRequest):
    out = service.export_shapefile(
        geojson=payload.geojson,
        filename=payload.filename or "export",
        upload_id=payload.upload_id,
    )
    if not out["ok"]:
        return JSONResponse(content=out["content"], status_code=out["status_code"])
    return Response(content=out["content"], media_type="application/zip")
