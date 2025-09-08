# backend/dashboard/dynamic_rivers_api.py - FIXED PATH VERSION

import os
import json
import geopandas as gpd
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from pathlib import Path
import logging
import traceback
from django.conf import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DynamicRiverManager:
    """Manages dynamic discovery and conversion of river shapefiles"""
    
    def __init__(self):
        # Since you're running from backend directory, the correct path is:
        # media/shapefile (not backend/media/shapefile)
        
        possible_paths = [
            "media/shapefile/Rivers",  # ✅ This should be the correct one for your setup
            os.path.join(settings.BASE_DIR, "media", "shapefile"),
        ]
        
        self.base_path = None
        self.rivers_path = None
        
        logger.info(f"Django BASE_DIR: {settings.BASE_DIR}")
        logger.info(f"Current working directory: {os.getcwd()}")
        
        # Find the correct path
        for path_str in possible_paths:
            test_path = Path(path_str)
            rivers_test_path = test_path / "Rivers"
            
            logger.info(f"Testing path: {test_path.absolute()}")
            logger.info(f"Rivers path: {rivers_test_path.absolute()}")
            logger.info(f"Rivers path exists: {rivers_test_path.exists()}")
            
            if rivers_test_path.exists():
                self.base_path = test_path
                self.rivers_path = rivers_test_path
                logger.info(f"✅ Found valid rivers path: {rivers_test_path.absolute()}")
                break
        
        # If no path found, use the first one as default
        if self.base_path is None:
            self.base_path = Path("media/shapefile")  # Default to correct path
            self.rivers_path = self.base_path / "Rivers"
            logger.warning(f"⚠️ No existing rivers path found, using default: {self.rivers_path.absolute()}")
        
        logger.info(f"Final configuration:")
        logger.info(f"  Base path: {self.base_path.absolute()}")
        logger.info(f"  Rivers path: {self.rivers_path.absolute()}")
        logger.info(f"  Path exists: {self.rivers_path.exists()}")
    
    def scan_rivers(self) -> dict:
        """Scan for available river folders and their shapefiles"""
        try:
            logger.info(f"=== SCANNING RIVERS ===")
            logger.info(f"Scanning path: {self.rivers_path.absolute()}")
            logger.info(f"Path exists: {self.rivers_path.exists()}")
            
            if not self.rivers_path.exists():
                logger.warning(f"Rivers path does not exist: {self.rivers_path.absolute()}")
                return {
                    "rivers": {}, 
                    "message": f"Rivers directory does not exist: {self.rivers_path.absolute()}",
                    "debug_path": str(self.rivers_path.absolute()),
                    "suggested_action": "Create the directory or check the path"
                }
            
            rivers = {}
            all_items = []
            
            # List ALL items in the Rivers directory
            logger.info("=== DIRECTORY CONTENTS ===")
            try:
                for item in self.rivers_path.iterdir():
                    all_items.append({
                        "name": item.name,
                        "is_dir": item.is_dir(),
                        "is_file": item.is_file(),
                        "absolute_path": str(item.absolute())
                    })
                    logger.info(f"  {item.name} ({'DIR' if item.is_dir() else 'FILE'})")
                
                if not all_items:
                    logger.warning("Directory is empty!")
                
            except Exception as e:
                logger.error(f"Error listing directory contents: {e}")
                return {
                    "error": f"Cannot list directory contents: {e}",
                    "debug_path": str(self.rivers_path.absolute())
                }
            
            # Process directories only
            directories_found = [item for item in all_items if item["is_dir"]]
            logger.info(f"Found {len(directories_found)} directories: {[d['name'] for d in directories_found]}")
            
            for dir_info in directories_found:
                item_path = Path(dir_info["absolute_path"])
                logger.info(f"=== PROCESSING {item_path.name} ===")
                
                # Look for .shp files in the folder
                shp_files = list(item_path.glob("*.shp"))
                logger.info(f"  Found .shp files: {[f.name for f in shp_files]}")
                
                if shp_files:
                    river_id = item_path.name.lower()
                    shapefile_path = str(shp_files[0])
                    
                    # Test if the shapefile is readable
                    try:
                        logger.info(f"  Testing readability of {shp_files[0].name}...")
                        test_gdf = gpd.read_file(str(shp_files[0]))
                        logger.info(f"  ✅ Readable! {len(test_gdf)} features found")
                        
                        rivers[river_id] = {
                            'id': river_id,
                            'display_name': item_path.name,
                            'folder_path': str(item_path),
                            'shapefile_path': shapefile_path,
                            'color': self._get_river_color(river_id),
                            'feature_count': len(test_gdf),
                            'crs': str(test_gdf.crs) if test_gdf.crs else 'Unknown'
                        }
                        
                    except Exception as e:
                        logger.error(f"  ❌ Error reading {shp_files[0].name}: {e}")
                        rivers[river_id] = {
                            'id': river_id,
                            'display_name': item_path.name,
                            'folder_path': str(item_path),
                            'shapefile_path': shapefile_path,
                            'color': self._get_river_color(river_id),
                            'error': f"Cannot read shapefile: {str(e)}"
                        }
                else:
                    logger.warning(f"  No .shp files found in {item_path.name}")
                    # List what files ARE in the directory
                    try:
                        files_in_dir = [f.name for f in item_path.iterdir() if f.is_file()]
                        logger.info(f"  Files in {item_path.name}: {files_in_dir}")
                    except:
                        pass
            
            logger.info(f"=== SCAN COMPLETE ===")
            logger.info(f"Found {len(rivers)} rivers with readable shapefiles: {list(rivers.keys())}")
            
            return {
                "rivers": rivers, 
                "count": len(rivers),
                "debug_info": {
                    "scan_path": str(self.rivers_path.absolute()),
                    "path_exists": self.rivers_path.exists(),
                    "all_items": all_items,
                    "directories_found": len(directories_found),
                    "directories_with_shapefiles": len(rivers),
                    "directory_names": [d['name'] for d in directories_found]
                }
            }
            
        except Exception as e:
            logger.error(f"Error scanning rivers: {str(e)}")
            logger.error(traceback.format_exc())
            return {
                "error": str(e),
                "debug_info": {
                    "scan_path": str(self.rivers_path.absolute()) if hasattr(self, 'rivers_path') else "Not set",
                    "path_exists": self.rivers_path.exists() if hasattr(self, 'rivers_path') else False
                }
            }
    
    def _get_river_color(self, river_id: str) -> str:
        """Get color for a river based on its name"""
        river_colors = {
            'varuna': '#0066CC',      # Blue
            'basuhi': '#00AA44',      # Green  
            'morwa': '#FF6600',       # Orange
            'basin': '#8B4513',       # Brown
        }
        
        for name, color in river_colors.items():
            if name in river_id.lower():
                return color
        
        return '#0ea5e9'  # Default light blue
    
    def get_river_geojson(self, river_name: str) -> dict:
        """Convert a specific river shapefile to GeoJSON"""
        try:
            logger.info(f"Converting {river_name} to GeoJSON")
            
            # Find the river folder (case-insensitive)
            river_folder = None
            available_rivers = []
            
            for item in self.rivers_path.iterdir():
                if item.is_dir():
                    available_rivers.append(item.name)
                    if item.name.lower() == river_name.lower():
                        river_folder = item
                        break
            
            if not river_folder:
                return {
                    "error": f"River '{river_name}' not found",
                    "available_rivers": available_rivers,
                    "scan_path": str(self.rivers_path.absolute())
                }
            
            logger.info(f"Found river folder: {river_folder}")
            
            # Find shapefile in the folder
            shp_files = list(river_folder.glob("*.shp"))
            all_files = [f.name for f in river_folder.iterdir() if f.is_file()]
            
            logger.info(f"Files in {river_folder.name}: {all_files}")
            logger.info(f"Shapefile files found: {[f.name for f in shp_files]}")
            
            if not shp_files:
                return {
                    "error": f"No shapefile found in {river_folder}",
                    "files_found": all_files
                }
            
            shapefile_path = shp_files[0]
            logger.info(f"Converting {shapefile_path} to GeoJSON")
            
            # Read shapefile and convert to GeoJSON
            gdf = gpd.read_file(str(shapefile_path))
            logger.info(f"Read {len(gdf)} features from {shapefile_path}")
            logger.info(f"Original CRS: {gdf.crs}")
            
            # Convert to WGS84 if needed
            if gdf.crs and gdf.crs.to_string() != 'EPSG:4326':
                logger.info(f"Converting CRS from {gdf.crs} to EPSG:4326")
                gdf = gdf.to_crs('EPSG:4326')
            
            # Convert to GeoJSON
            geojson = json.loads(gdf.to_json())
            
            logger.info(f"Successfully converted {river_name} to GeoJSON with {len(geojson['features'])} features")
            return geojson
            
        except Exception as e:
            logger.error(f"Error converting {river_name} to GeoJSON: {str(e)}")
            logger.error(traceback.format_exc())
            return {"error": str(e)}

# Initialize the river manager
river_manager = DynamicRiverManager()

@require_http_methods(["GET"])
def scan_available_rivers(request):
    """API endpoint to scan for available rivers"""
    try:
        result = river_manager.scan_rivers()
        
        if "error" in result:
            return JsonResponse({
                'status': 'error',
                'message': result["error"],
                'debug_info': result.get("debug_info", {})
            }, status=500)
        
        return JsonResponse({
            'status': 'success',
            'rivers': result["rivers"],
            'count': result["count"],
            'message': result.get("message", f"Found {result['count']} rivers"),
            'debug_info': result.get("debug_info", {})
        })
        
    except Exception as e:
        logger.error(f"Error in scan_available_rivers: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_river_geojson(request, river_name):
    """API endpoint to get GeoJSON for a specific river"""
    try:
        logger.info(f"Requested GeoJSON for river: {river_name}")
        
        result = river_manager.get_river_geojson(river_name)
        
        if "error" in result:
            return JsonResponse(result, status=404)
        
        # Return the GeoJSON directly
        return JsonResponse(result)
        
    except Exception as e:
        logger.error(f"Error in get_river_geojson for {river_name}: {str(e)}")
        return JsonResponse({
            'error': str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_river_styles(request):
    """API endpoint to get styling information for rivers"""
    try:
        styles = {
            'varuna': {'color': '#0066CC', 'width': 4},
            'basuhi': {'color': '#00AA44', 'width': 3},
            'morwa': {'color': '#FF6600', 'width': 3},
            'basin': {'color': '#8B4513', 'width': 2},
        }
        
        return JsonResponse({
            'status': 'success',
            'styles': styles
        })
        
    except Exception as e:
        logger.error(f"Error in get_river_styles: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def refresh_rivers(request):
    """API endpoint to refresh river data by rescanning"""
    try:
        logger.info("Refreshing river data...")
        
        # Rescan for rivers
        result = river_manager.scan_rivers()
        
        if "error" in result:
            return JsonResponse({
                'status': 'error',
                'message': result["error"],
                'debug_info': result.get("debug_info", {})
            }, status=500)
        
        rivers = result["rivers"]
        river_names = list(rivers.keys())
        
        return JsonResponse({
            'status': 'success',
            'message': f'Refreshed river data. Found {len(rivers)} rivers.',
            'total_count': len(rivers),
            'rivers': river_names,
            'debug_info': result.get("debug_info", {})
        })
        
    except Exception as e:
        logger.error(f"Error in refresh_rivers: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

@require_http_methods(["GET"])
def test_rivers_setup(request):
    """API endpoint to test the rivers setup and paths"""
    try:
        result = {
            'backend_status': 'connected',
            'backend_port': '9000',
            'django_base_dir': str(settings.BASE_DIR),
            'current_working_dir': os.getcwd(),
            'shapefile_base_path': str(river_manager.base_path.absolute()),
            'rivers_path': str(river_manager.rivers_path.absolute()),
            'rivers_path_exists': river_manager.rivers_path.exists(),
            'scan_results': None
        }
        
        # Try to scan for rivers
        scan_result = river_manager.scan_rivers()
        if "rivers" in scan_result:
            rivers = scan_result["rivers"]
            result['scan_results'] = {
                'rivers_found': len(rivers),
                'river_names': list(rivers.keys()),
                'river_details': rivers,
                'debug_info': scan_result.get("debug_info", {})
            }
        else:
            result['scan_results'] = {
                'error': scan_result.get("error", "Unknown error during scan"),
                'debug_info': scan_result.get("debug_info", {})
            }
        
        return JsonResponse(result)
        
    except Exception as e:
        logger.error(f"Error in test_rivers_setup: {str(e)}")
        return JsonResponse({
            'backend_status': 'error',
            'error': str(e),
            'traceback': traceback.format_exc()
        }, status=500)