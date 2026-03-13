from typing import Any, Dict, Optional, Union

from pydantic import BaseModel


class ExportMapRequest(BaseModel):
    geojson: Union[Dict[str, Any], str]
    basemap: Optional[str] = "osm"
    basemap_alpha: Optional[float] = 0.6
    heading: Optional[str] = "Map Export"


class GeoJSONToShapefileRequest(BaseModel):
    geojson: Dict[str, Any]
    filename: Optional[str] = "export"
