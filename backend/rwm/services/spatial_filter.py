"""
Spatial Filter Service
Filters water quality points based on buffer geometry.

Points inside the buffer are considered valid for WQI calculation.
Points outside the buffer are rejected.
"""

from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field

import geopandas as gpd
from shapely.geometry import Point, shape
from shapely.ops import unary_union
import json


@dataclass
class SpatialFilterResult:
    """Result of spatial filtering"""
    success: bool
    valid_points: List[Dict[str, Any]] = field(default_factory=list)
    rejected_points: List[Dict[str, Any]] = field(default_factory=list)
    valid_count: int = 0
    rejected_count: int = 0
    total_count: int = 0
    error_message: Optional[str] = None


class SpatialFilter:
    """
    Filters points based on buffer geometry.
    
    Points inside the buffer polygon are valid for WQI calculation.
    Points outside are rejected but returned for display.
    
    Usage:
        filter = SpatialFilter()
        result = filter.filter_points(points, buffer_geojson)
    """
    
    def __init__(self):
        pass
    
    def filter_points(
        self, 
        points: List[Dict[str, Any]], 
        buffer_geometry: Dict | gpd.GeoDataFrame | Path
    ) -> SpatialFilterResult:
        """
        Filter points based on buffer geometry.
        
        Args:
            points: List of dicts with 'lat' and 'lon' keys (plus other data)
            buffer_geometry: Buffer geometry as GeoJSON dict, GeoDataFrame, or path to shapefile
            
        Returns:
            SpatialFilterResult with valid and rejected points
        """
        try:
            # Load buffer geometry
            buffer_geom = self._load_buffer_geometry(buffer_geometry)
            
            if buffer_geom is None:
                return SpatialFilterResult(
                    success=False,
                    error_message="Failed to load buffer geometry"
                )
            
            valid_points = []
            rejected_points = []
            
            for point_data in points:
                lat = point_data.get('lat')
                lon = point_data.get('lon')
                
                if lat is None or lon is None:
                    # Skip points without coordinates
                    continue
                
                # Create point geometry
                point = Point(lon, lat)  # Note: Shapely uses (x, y) = (lon, lat)
                
                # Check if point is inside buffer
                if buffer_geom.contains(point):
                    valid_points.append({
                        **point_data,
                        'inside_buffer': True
                    })
                else:
                    rejected_points.append({
                        **point_data,
                        'inside_buffer': False
                    })
            
            return SpatialFilterResult(
                success=True,
                valid_points=valid_points,
                rejected_points=rejected_points,
                valid_count=len(valid_points),
                rejected_count=len(rejected_points),
                total_count=len(valid_points) + len(rejected_points)
            )
            
        except Exception as e:
            return SpatialFilterResult(
                success=False,
                error_message=f"Spatial filtering error: {str(e)}"
            )
    
    def _load_buffer_geometry(
        self, 
        buffer_geometry: Dict | gpd.GeoDataFrame | Path
    ):
        """
        Load buffer geometry from various sources.
        
        Returns:
            Shapely geometry object (unified if multiple features)
        """
        if isinstance(buffer_geometry, Path) or isinstance(buffer_geometry, str):
            # Load from shapefile
            path = Path(buffer_geometry)
            if path.suffix.lower() == '.shp':
                gdf = gpd.read_file(path)
            elif path.suffix.lower() == '.geojson':
                gdf = gpd.read_file(path)
            else:
                return None
            
            # Ensure WGS84
            if gdf.crs and gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')
            
            # Combine all geometries into one
            return unary_union(gdf.geometry)
        
        elif isinstance(buffer_geometry, gpd.GeoDataFrame):
            # Already a GeoDataFrame
            gdf = buffer_geometry
            if gdf.crs and gdf.crs != 'EPSG:4326':
                gdf = gdf.to_crs('EPSG:4326')
            return unary_union(gdf.geometry)
        
        elif isinstance(buffer_geometry, dict):
            # GeoJSON dict
            if 'type' in buffer_geometry:
                if buffer_geometry['type'] == 'FeatureCollection':
                    # Multiple features - combine them
                    geometries = []
                    for feature in buffer_geometry.get('features', []):
                        geom = shape(feature.get('geometry', {}))
                        geometries.append(geom)
                    return unary_union(geometries) if geometries else None
                
                elif buffer_geometry['type'] == 'Feature':
                    return shape(buffer_geometry.get('geometry', {}))
                
                else:
                    # Direct geometry
                    return shape(buffer_geometry)
            
            return None
        
        return None
    
    def points_to_geojson(
        self, 
        valid_points: List[Dict[str, Any]],
        rejected_points: List[Dict[str, Any]],
        wqi_results: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Convert points to GeoJSON format for frontend display.
        
        Args:
            valid_points: List of valid point dicts
            rejected_points: List of rejected point dicts
            wqi_results: Optional list of WQI results corresponding to valid_points
            
        Returns:
            GeoJSON FeatureCollection with all points
        """
        features = []
        
        # Add valid points with WQI data
        for i, point in enumerate(valid_points):
            wqi_data = wqi_results[i] if wqi_results and i < len(wqi_results) else {}
            
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [point['lon'], point['lat']]
                },
                'properties': {
                    'type': 'valid',
                    'inside_buffer': True,
                    **{k: v for k, v in point.items() if k not in ['lat', 'lon', 'inside_buffer']},
                    **wqi_data
                }
            }
            features.append(feature)
        
        # Add rejected points
        for point in rejected_points:
            feature = {
                'type': 'Feature',
                'geometry': {
                    'type': 'Point',
                    'coordinates': [point['lon'], point['lat']]
                },
                'properties': {
                    'type': 'rejected',
                    'inside_buffer': False,
                    **{k: v for k, v in point.items() if k not in ['lat', 'lon', 'inside_buffer']}
                }
            }
            features.append(feature)
        
        return {
            'type': 'FeatureCollection',
            'features': features
        }
