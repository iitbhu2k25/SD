# backend/dashboard/views.py - COMPLETE FILE

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .models import DrainWaterQuality, StoryMapStation
from django.conf import settings
import os
import json
import geopandas as gpd
import pandas as pd
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# ============================================
# EXISTING FUNCTION
# ============================================

@require_http_methods(["GET"])
def get_drain_water_quality(request):
    """Get all drain water quality data"""
    try:
        data = DrainWaterQuality.objects.all().values()
        return JsonResponse(list(data), safe=False)
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)


# ============================================
# STORY MAP API ENDPOINTS (NEW)
# ============================================

@require_http_methods(["GET"])
def get_story_map_stations(request):
    """
    API endpoint to get all story map stations
    GET /django/drain-water-quality/story-map/stations/
    """
    try:
        logger.info("📍 Fetching story map stations...")
        
        # Get all stations from database
        stations = StoryMapStation.objects.all()
        
        # Convert each station to dictionary
        stations_data = [station.to_dict() for station in stations]
        
        logger.info(f"✅ Found {len(stations_data)} stations")
        
        return JsonResponse({
            'status': 'success',
            'count': len(stations_data),
            'stations': stations_data
        }, safe=False)
    
    except Exception as e:
        logger.error(f" Error fetching stations: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_story_map_station_detail(request, station_id):
    """
    API endpoint to get a specific station by ID
    GET /django/drain-water-quality/story-map/stations/{station_id}/
    """
    try:
        logger.info(f"📍 Fetching station: {station_id}")
        
        # Get specific station
        station = StoryMapStation.objects.get(id=station_id)
        
        logger.info(f"✅ Found station: {station.location}")
        
        return JsonResponse({
            'status': 'success',
            'station': station.to_dict()
        })
    
    except StoryMapStation.DoesNotExist:
        logger.warning(f"⚠️ Station not found: {station_id}")
        return JsonResponse({
            'status': 'error',
            'message': f'Station "{station_id}" not found'
        }, status=404)
    
    except Exception as e:
        logger.error(f" Error fetching station: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_story_map_statistics(request):
    """
    API endpoint to get statistics about story map stations
    GET /django/drain-water-quality/story-map/statistics/
    """
    try:
        logger.info(" Fetching story map statistics...")
        
        total = StoryMapStation.objects.count()
        
        logger.info(f" Total stations: {total}")
        
        return JsonResponse({
            'status': 'success',
            'statistics': {
                'total_stations': total,
            }
        })
    
    except Exception as e:
        logger.error(f" Error fetching statistics: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)


# ============================================
# SEWAGE INFRASTRUCTURE FUNCTIONS
# ============================================

def get_shapefile_base_path():
    """Get the correct base path for shapefiles"""
    possible_paths = [
        Path(settings.BASE_DIR) / "media" / "shapefile" / "dashboard",
        Path("media") / "shapefile" / "dashboard",
    ]
    
    for path in possible_paths:
        if path.exists():
            logger.info(f"✅ Found shapefile path: {path}")
            return path
    
    logger.warning(f"⚠️ Shapefile path doesn't exist, using default")
    return possible_paths[0]


SHAPEFILE_BASE = get_shapefile_base_path()

SHAPEFILE_CONFIG = {
    'partial_tapped_drain': {
        'path': 'partial_tapped_drain',
        'display_name': 'Partial Tapped Drain',
        'color': '#FFA500',
    },
    'tapped': {
        'path': 'tapped',
        'display_name': 'Tapped Drain',
        'color': '#00FF00',
    },
    'untapped_drain': {
        'path': 'untapped_drain',
        'display_name': 'Untapped Drain',
        'color': '#FF0000',
    },
    'STP': {
        'path': 'STP',
        'display_name': 'STP (Sewage Treatment Plant)',
        'color': '#0000FF',
    },
    'Basin': {
        'path': 'Basin',
        'display_name': 'Basin',
        'color': '#8B4513',
    },
}


def get_shapefile_path(layer_name):
    """Get the full path to a shapefile (.shp)"""
    if layer_name not in SHAPEFILE_CONFIG:
        logger.error(f" Unknown layer: {layer_name}")
        return None
    
    layer_config = SHAPEFILE_CONFIG[layer_name]
    layer_folder = SHAPEFILE_BASE / layer_config['path']
    
    logger.info(f"Looking for layer folder: {layer_folder}")
    logger.info(f"Folder exists: {layer_folder.exists()}")
    
    if layer_folder.exists():
        try:
            shp_files = list(layer_folder.glob("*.shp"))
            logger.info(f"Found .shp files: {[f.name for f in shp_files]}")
            
            if shp_files:
                shapefile_path = str(shp_files[0])
                logger.info(f"✅ Using shapefile: {shapefile_path}")
                return shapefile_path
            else:
                logger.warning(f"⚠️ No .shp files in {layer_folder}")
                all_files = list(layer_folder.iterdir())
                logger.info(f"Files in folder: {[f.name for f in all_files]}")
                return None
        except Exception as e:
            logger.error(f"Error listing files: {e}")
            return None
    else:
        logger.error(f" Layer folder doesn't exist: {layer_folder}")
        return None


def convert_shapefile_to_geojson(shapefile_path):
    """Convert a shapefile to GeoJSON format"""
    try:
        logger.info(f"Converting shapefile: {shapefile_path}")
        
        gdf = gpd.read_file(shapefile_path)
        logger.info(f"✅ Read {len(gdf)} features from shapefile")
        
        # Convert timestamp columns to string
        for col in gdf.columns:
            if gdf[col].dtype == 'datetime64[ns]' or 'datetime' in str(gdf[col].dtype):
                logger.info(f"Converting timestamp column '{col}' to string...")
                gdf[col] = gdf[col].apply(lambda x: x.isoformat() if pd.notnull(x) else None)
        
        # Reproject to EPSG:4326 (WGS84)
        if gdf.crs and gdf.crs.to_string() != 'EPSG:4326':
            logger.info(f"Converting CRS from {gdf.crs} to EPSG:4326")
            gdf = gdf.to_crs('EPSG:4326')
        
        geojson = json.loads(gdf.to_json())
        logger.info(f"✅ Converted to GeoJSON with {len(geojson.get('features', []))} features")
        
        return geojson
    
    except Exception as e:
        logger.error(f" Error converting shapefile: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return None


@require_http_methods(["GET"])
def get_sewage_infrastructure_geojson(request, layer_name):
    """API endpoint to get GeoJSON data for sewage infrastructure"""
    try:
        logger.info(f"\n Requesting GeoJSON for layer: {layer_name}")
        
        shapefile_path = get_shapefile_path(layer_name)
        
        if not shapefile_path:
            logger.error(f" No shapefile found for {layer_name}")
            return JsonResponse({
                'error': f'Layer "{layer_name}" shapefile not found',
                'base_path': str(SHAPEFILE_BASE),
                'looking_for': str(SHAPEFILE_BASE / SHAPEFILE_CONFIG.get(layer_name, {}).get('path', 'unknown')),
            }, status=404)
        
        if not os.path.exists(shapefile_path):
            logger.error(f" Shapefile path doesn't exist: {shapefile_path}")
            return JsonResponse({
                'error': f'Shapefile not found at: {shapefile_path}'
            }, status=404)
        
        logger.info(f"✅ Found shapefile at: {shapefile_path}")
        
        geojson = convert_shapefile_to_geojson(shapefile_path)
        
        if geojson is None:
            logger.error(f" Failed to convert {layer_name}")
            return JsonResponse({
                'error': 'Failed to convert shapefile to GeoJSON'
            }, status=500)
        
        logger.info(f"✅ Returning GeoJSON with {len(geojson.get('features', []))} features")
        return JsonResponse(geojson, safe=False)
    
    except Exception as e:
        logger.error(f" Error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return JsonResponse({
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_available_layers(request):
    """API endpoint to get list of available sewage infrastructure layers"""
    try:
        logger.info(f"\n🔍 Listing available layers in: {SHAPEFILE_BASE}")
        available_layers = []
        
        for layer_id, config in SHAPEFILE_CONFIG.items():
            logger.info(f"Checking layer: {layer_id}")
            shapefile_path = get_shapefile_path(layer_id)
            exists = shapefile_path and os.path.exists(shapefile_path)
            
            logger.info(f"  Path: {shapefile_path}")
            logger.info(f"  Exists: {exists}")
            
            available_layers.append({
                'id': layer_id,
                'name': config['path'],
                'display_name': config['display_name'],
                'color': config['color'],
                'available': exists,
                'path': shapefile_path if exists else None
            })
        
        logger.info(f"✅ Found {len([l for l in available_layers if l['available']])} available layers")
        
        return JsonResponse({
            'layers': available_layers,
            'base_path': str(SHAPEFILE_BASE),
        }, safe=False)
    
    except Exception as e:
        logger.error(f" Error: {str(e)}")
        return JsonResponse({
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_layer_statistics(request):
    """API endpoint to get statistics for sewage infrastructure layers"""
    try:
        logger.info(f"\n Getting statistics for all layers")
        statistics = {}
        
        for layer_id, config in SHAPEFILE_CONFIG.items():
            shapefile_path = get_shapefile_path(layer_id)
            
            if shapefile_path and os.path.exists(shapefile_path):
                try:
                    gdf = gpd.read_file(shapefile_path)
                    feature_count = len(gdf)
                    
                    logger.info(f"✅ {layer_id}: {feature_count} features")
                        
                    statistics[layer_id] = {
                        'display_name': config['display_name'],
                        'feature_count': feature_count,
                        'color': config['color'],
                    }
                except Exception as e:
                    logger.error(f" {layer_id}: {e}")
                    statistics[layer_id] = {
                        'display_name': config['display_name'],
                        'error': str(e)
                    }
        
        return JsonResponse({
            'statistics': statistics
        }, safe=False)
    
    except Exception as e:
        logger.error(f" Error: {str(e)}")
        return JsonResponse({
            'error': str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_layer_details(request, layer_name):
    """API endpoint to get detailed information about a specific layer"""
    try:
        logger.info(f"\n📄 Getting details for layer: {layer_name}")
        
        shapefile_path = get_shapefile_path(layer_name)
        
        if not shapefile_path or not os.path.exists(shapefile_path):
            logger.error(f" Layer not found: {layer_name}")
            return JsonResponse({
                'error': f'Layer "{layer_name}" not found'
            }, status=404)
        
        gdf = gpd.read_file(shapefile_path)
        
        schema_props = {col: str(dtype) for col, dtype in gdf.dtypes.items() if col != 'geometry'}
        schema = {
            'properties': schema_props,
            'geometry': gdf.geom_type.unique()[0] if len(gdf.geom_type.unique()) == 1 else 'Mixed'
        }
        
        crs = str(gdf.crs)
        bounds = list(gdf.total_bounds)
        feature_count = len(gdf)
        
        sample_features = []
        for col in gdf.columns:
            if gdf[col].dtype == 'datetime64[ns]' or 'datetime' in str(gdf[col].dtype):
                gdf[col] = gdf[col].apply(lambda x: x.isoformat() if pd.notnull(x) else None)
        
        for i, row in gdf.head(5).iterrows():
            properties = row.to_dict()
            geometry_type = row.geometry.geom_type
            if 'geometry' in properties:
                del properties['geometry']
            
            sample_features.append({
                'properties': properties,
                'geometry_type': geometry_type
            })
        
        logger.info(f"✅ Layer details: {feature_count} features, {geometry_type}")
        
        return JsonResponse({
            'layer_name': layer_name,
            'display_name': SHAPEFILE_CONFIG[layer_name]['display_name'],
            'feature_count': feature_count,
            'schema': schema,
            'crs': crs,
            'bounds': bounds,
            'sample_features': sample_features
        }, safe=False)
    
    except Exception as e:
        logger.error(f" Error: {str(e)}")
        return JsonResponse({
            'error': str(e)
        }, status=500)