from typing import Any, Dict, Optional, Union

from pydantic import BaseModel


class ChunkUploadRequest(BaseModel):
    upload_id: str
    chunk_index: int
    total_chunks: int
    data: str  # raw JSON string fragment


class ExportMapRequest(BaseModel):
    geojson: Optional[Union[Dict[str, Any], str]] = None
    upload_id: Optional[str] = None  # alternative to geojson for chunked uploads
    basemap: Optional[str] = "osm"
    basemap_alpha: Optional[float] = 0.6
    heading: Optional[str] = "Map Export"


class GeoJSONToShapefileRequest(BaseModel):
    geojson: Optional[Dict[str, Any]] = None
    upload_id: Optional[str] = None  # alternative to geojson for chunked uploads
    filename: Optional[str] = "export"


class FieldsRequest(BaseModel):
    geojson: Optional[Dict[str, Any]] = None
    upload_id: Optional[str] = None  # alternative to geojson for chunked uploads
