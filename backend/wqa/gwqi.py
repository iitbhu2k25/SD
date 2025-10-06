from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import pandas as pd
import numpy as np
from pathlib import Path
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.features import shapes
from rasterio.mask import mask
from datetime import datetime
import os
import shutil
import requests
import geopandas as gpd
from shapely.ops import unary_union
from shapely.geometry import Point, shape as shapely_shape
from scipy.interpolate import Rbf, griddata
from scipy.spatial.distance import cdist
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import matplotlib.patches as mpatches
import tempfile
import time
import re
import glob
import traceback
import concurrent.futures
from threading import Lock
import gc
from functools import lru_cache
import uuid
from .session_manager import session_manager

# Constants
RASTERS_DIR = Path("media/gwa_iprasters")
GENERATED_RASTERS_DIR = Path("media/temp/sessions")
GEOSERVER_URL = "http://geoserver2:8080/geoserver/rest"
GEOSERVER_WCS_URL = "/geoserver/wcs"
GEOSERVER_USER = "admin"
GEOSERVER_PASSWORD = "geoserver2"
WORKSPACE = "myworkspace"

# Path to shapefiles
VILLAGES_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            'media', 'gwa_data', 'gwa_shp', 'Final_Village', 'Village.shp')

# Global locks for thread safety
geoserver_lock = Lock()
file_write_lock = Lock()

class GWQIOverlayView(APIView):
    permission_classes = [AllowAny]

    def __init__(self):
        super().__init__()
        self._village_cache = None
        self._color_schemes = None
        # Session attributes
        self.session_id = None
        self.session_temp_dir = None
        self.session_output_dir = None

    @lru_cache(maxsize=1)
    def get_parameter_color_schemes(self):
        """Cached color schemes for individual parameters"""
        if self._color_schemes is not None:
            return self._color_schemes
            
        self._color_schemes = {
            'ph_level': {
                'colors': ['#d73027', '#fc8d59', '#fee08b', '#99d594', '#3288bd'],
                'parameter_name': 'pH Level',
                'unit': 'pH units',
                'ranges': [0, 6.5, 7.5, 8.0, 8.5, 14]
            },
            'electrical_conductivity': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Electrical Conductivity',
                'unit': 'µS/cm',
                'ranges': [0, 300, 600, 1200, 1500, 3000]
            },
            'carbonate': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Carbonate',
                'unit': 'mg/L',
                'ranges': [0, 30, 60, 120, 180, 300]
            },
            'bicarbonate': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Bicarbonate',
                'unit': 'mg/L',
                'ranges': [0, 150, 300, 600, 900, 1200]
            },
            'chloride': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Chloride',
                'unit': 'mg/L',
                'ranges': [0, 62.5, 125, 250, 375, 500]
            },
            'fluoride': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Fluoride',
                'unit': 'mg/L',
                'ranges': [0, 0.375, 0.75, 1.5, 2.25, 3.0]
            },
            'sulfate': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Sulfate',
                'unit': 'mg/L',
                'ranges': [0, 75, 150, 300, 450, 600]
            },
            'nitrate': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Nitrate',
                'unit': 'mg/L',
                'ranges': [0, 12.5, 25, 50, 75, 100]
            },
            'Hardness': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Total Hardness',
                'unit': 'mg/L as CaCO₃',
                'ranges': [0, 150, 300, 600, 900, 1200]
            },
            'calcium': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Calcium',
                'unit': 'mg/L',
                'ranges': [0, 50, 100, 200, 300, 400]
            },
            'magnesium': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Magnesium',
                'unit': 'mg/L',
                'ranges': [0, 25, 50, 100, 150, 200]
            },
            'sodium': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Sodium',
                'unit': 'mg/L',
                'ranges': [0, 50, 100, 200, 300, 400]
            },
            'potassium': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Potassium',
                'unit': 'mg/L',
                'ranges': [0, 3, 6, 12, 18, 24]
            },
            'iron': {
                'colors': ['#3288bd', '#99d594', '#fee08b', '#fc8d59', '#d73027'],
                'parameter_name': 'Iron',
                'unit': 'mg/L',
                'ranges': [0, 0.25, 0.5, 1.0, 1.5, 2.0]
            }
        }
        return self._color_schemes

    @lru_cache(maxsize=1)
    def load_village_shapefile(self):
        """Cached village shapefile loading"""
        if self._village_cache is not None:
            return self._village_cache
            
        try:
            villages_vector = gpd.read_file(VILLAGES_PATH)
            if villages_vector.crs is None:
                villages_vector.set_crs("EPSG:4326", inplace=True)
            self._village_cache = villages_vector
            return villages_vector
        except Exception as e:
            print(f"[ERROR] Failed to load village shapefile: {str(e)}")
            return None

    def cleanup_temp_directory(self):
        """Clean up session temp directory after successful GWQI generation"""
        try:
            if self.session_temp_dir and self.session_temp_dir.exists():
                print(f"[CLEANUP] Cleaning session temp directory: {self.session_temp_dir}")
                
                for item in self.session_temp_dir.iterdir():
                    try:
                        if item.is_file():
                            item.unlink()
                            print(f"[CLEANUP] Deleted temp file: {item.name}")
                        elif item.is_dir():
                            shutil.rmtree(item)
                            print(f"[CLEANUP] Deleted temp directory: {item.name}")
                    except Exception as e:
                        print(f"[CLEANUP WARNING] Could not delete {item}: {str(e)}")
                
                print(f"[CLEANUP] Session temp directory cleaned successfully")
                return True
        except Exception as e:
            print(f"[CLEANUP ERROR] Failed to clean session temp directory: {str(e)}")
            return False

    def create_map_preview_with_wells(self, raster_path, output_path, wells_data=None, title="", color_scheme=None):
        """Create a PNG preview of the raster with well points - NO EMBEDDED LEGEND (for PDF use)"""
        try:
            print(f"[PREVIEW] Creating map preview WITHOUT legend: {output_path}")
            
            with rasterio.open(raster_path) as src:
                if src.count >= 3:
                    r = src.read(1)
                    g = src.read(2)
                    b = src.read(3)
                    rgb = np.dstack((r, g, b))
                else:
                    print(f"[PREVIEW] Raster doesn't have RGB bands: {raster_path}")
                    return False
                
                # Create figure with white background
                fig = plt.figure(figsize=(14, 10), dpi=350, facecolor='white')
                ax = fig.add_subplot(111)
                ax.set_facecolor('white')
                
                # Replace black (0,0,0) pixels with white (255,255,255)
                black_mask = (rgb[:, :, 0] == 0) & (rgb[:, :, 1] == 0) & (rgb[:, :, 2] == 0)
                rgb_white_bg = rgb.copy()
                rgb_white_bg[black_mask] = [255, 255, 255]
                
                # Display raster with white background
                ax.imshow(rgb_white_bg, aspect='auto')
                
                # Add well points
                if wells_data and len(wells_data) > 0:
                    well_count = 0
                    for well in wells_data:
                        lat = well.get('LATITUDE') or well.get('Latitude')
                        lon = well.get('LONGITUDE') or well.get('Longitude')
                        
                        if lat is not None and lon is not None:
                            try:
                                row, col = rasterio.transform.rowcol(src.transform, lon, lat)
                                
                                if 0 <= row < rgb.shape[0] and 0 <= col < rgb.shape[1]:
                                    ax.plot(col, row, 'o', 
                                           color='#FF6B6B',
                                           markersize=8,
                                           markeredgecolor='white',
                                           markeredgewidth=1.5,
                                           zorder=10)
                                    well_count += 1
                            except Exception as e:
                                continue
                    
                    print(f"[PREVIEW] Plotted {well_count} well points")
                
                # Add title
                ax.set_title(title, fontsize=16, fontweight='bold', pad=15)
                ax.axis('off')
                
                # NO LEGEND - Save directly with white background
                plt.tight_layout(pad=0.5)
                plt.savefig(output_path, dpi=150, bbox_inches='tight', 
                           pad_inches=0.1, facecolor='white', edgecolor='none')
                plt.close(fig)
                
                print(f"[PREVIEW] Successfully created: {output_path}")
                return True
                
        except Exception as e:
            print(f"[PREVIEW ERROR] Failed to create preview: {str(e)}")
            traceback.print_exc()
            return False

    def post(self, request):
        """Handle GWQI generation with UUID session"""
        print("[DEBUG] GWQI Overlay POST request received")
        
        try:
            data = request.data
            selected_parameters = data.get('selected_parameters', [])
            selected_year = data.get('selected_year', '2023')
            village_ids = data.get('village_ids', [])
            place = data.get('place', 'subdistrict')
            weights = data.get('weights', {})
            unified_mode = data.get('unified_mode', False)
            wells_data = data.get('wells_data', [])

            print(f"[DEBUG] Parameters: {len(selected_parameters)} | Year: {selected_year}")

            if not selected_parameters:
                return Response({
                    'error': 'No parameters selected for GWQI generation',
                    'code': 'MISSING_PARAMETERS'
                }, status=status.HTTP_400_BAD_REQUEST)

            if not village_ids:
                return Response({
                    'error': 'No villages/subdistricts selected',
                    'code': 'MISSING_AREA_SELECTION'
                }, status=status.HTTP_400_BAD_REQUEST)

            # YEAR VALIDATION
            if not selected_year:
                return Response({
                    'error': 'Year is required for GWQI generation',
                    'code': 'MISSING_YEAR'
                }, status=status.HTTP_400_BAD_REQUEST)

            current_year = datetime.now().year
            try:
                year_int = int(selected_year)
                if year_int < 2019:
                    return Response({
                        'error': 'Year must be 2019 or later',
                        'code': 'INVALID_YEAR_RANGE'
                    }, status=status.HTTP_400_BAD_REQUEST)
                if year_int > current_year:
                    return Response({
                        'error': f'Year cannot be in the future (current year: {current_year})',
                        'code': 'INVALID_YEAR_RANGE'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({
                    'error': 'Year must be a valid integer',
                    'code': 'INVALID_YEAR_FORMAT'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create UUID session
            user_id = getattr(request.user, 'id', 'anonymous')
            session_id = session_manager.create_session(user_id=user_id, year=selected_year)
            
            print(f"[SESSION] Created: {session_id}")

            # Get session paths
            paths = session_manager.get_paths(session_id)
            
            # Store in instance for use in methods
            self.session_id = session_id
            self.session_temp_dir = paths['temp_dir']
            self.session_output_dir = paths['output_dir']

            # Ensure session temp directory exists
            self.session_temp_dir.mkdir(parents=True, exist_ok=True)
            GENERATED_RASTERS_DIR.mkdir(parents=True, exist_ok=True)

            if unified_mode:
                result = self.generate_unified_gwqi_with_session(request, session_id)
            else:
                if not weights:
                    return Response({
                        'error': 'No weights provided. Please run analysis first.',
                        'suggestion': 'Click "Analyze Parameters" before creating overlay.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                result = self.create_gwqi_overlay(request)

            # Add session info to response
            result['session_id'] = session_id
            result['session_paths'] = {
                'temp': str(paths['temp_dir']),
                'output': str(paths['output_dir'])
            }

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"[ERROR] GWQI request error: {str(e)}")
            traceback.print_exc()
            return Response({'error': f'GWQI operation failed: {str(e)}'},
                          status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def generate_unified_gwqi_with_session(self, request, session_id):
        """Generate complete GWQI with automatic CSV interpolation if needed"""
        print(f"[DEBUG] Starting GWQI generation for session {session_id}")
        start_time = time.time()
        
        data = request.data
        selected_parameters = data.get('selected_parameters', [])
        selected_year = data.get('selected_year', '2023')
        village_ids = data.get('village_ids', [])
        place = data.get('place', 'subdistrict')
        wells_data = data.get('wells_data', [])
        use_csv_interpolation = data.get('use_csv_interpolation', False)

        self._current_village_ids = village_ids
        self._current_place = place

        print(f"[DEBUG] Received {len(wells_data)} wells for preview overlay")
        print(f"[DEBUG] CSV Interpolation Mode: {use_csv_interpolation}")

        try:
            # Use session directories instead of global ones
            year_dir = self.session_output_dir
            year_dir.mkdir(parents=True, exist_ok=True)
            
            print(f"[SESSION] Using output directory: {year_dir}")

            # STEP 1: Load rasters - WITH INTERPOLATION IF NEEDED
            print(f"STEP 1/3: Loading rasters...")
            
            if use_csv_interpolation:
                print(f"[GWQI] CSV mode - running interpolation first")
                
                # Import interpolation helper
                from .interpolation import interpolate_csv_to_rasters
                
                # Prepare interpolation output directory
                interp_dir = self.session_temp_dir.parent / "interpolated_rasters" / selected_year
                
                print(f"[GWQI] Interpolation will save to: {interp_dir}")
                
                # Run interpolation
                interp_result = interpolate_csv_to_rasters(
                    wells_data=wells_data,
                    selected_parameters=selected_parameters,
                    selected_year=selected_year,
                    village_ids=village_ids,
                    place=place,
                    session_id=session_id,
                    output_dir=interp_dir
                )
                
                if not interp_result['success']:
                    return {
                        'error': f"Interpolation failed: {interp_result.get('error', 'Unknown error')}",
                        'failed_parameters': interp_result.get('failed_parameters', []),
                        'interpolation_details': interp_result
                    }
                
                print(f"[GWQI] Interpolation complete: {interp_result['message']}")
                
                # Show interpolation summary
                if interp_result.get('failed_parameters'):
                    print(f"[GWQI] WARNING: {len(interp_result['failed_parameters'])} parameters failed:")
                    for failed in interp_result['failed_parameters']:
                        print(f"  - {failed['parameter']}: {failed['reason']}")
                
                # Now load the interpolated rasters
                raster_data, raster_metadata = self.load_csv_interpolated_rasters(
                    selected_parameters, selected_year, village_ids, place, session_id
                )
            else:
                print(f"[GWQI] Using pre-existing rasters")
                raster_data, raster_metadata = self.load_and_clip_interpolated_rasters_optimized(
                    selected_parameters, selected_year, village_ids, place
                )

            if not raster_data:
                return {'error': 'Failed to load interpolated rasters'}

            print(f"STEP 1B/3: Publishing rasters and creating preview images...")
            
            individual_published_layers = []
            preview_images_created = []
            
            color_schemes = self.get_parameter_color_schemes()
            clipping_geometry = self.load_clipping_geometry_optimized(village_ids, place)
            
            # Process individual parameters
            for param in selected_parameters:
                if param not in raster_data:
                    continue
                
                try:
                    raster_array = raster_data[param]
                    metadata = raster_metadata[param]
                    
                    if clipping_geometry is not None:
                        raster_array = self.apply_clipping_to_raster(raster_array, clipping_geometry, metadata)
                    
                    # UNIQUE LAYER NAME with session
                    layer_name = f"{param}_{selected_year}_{session_id[:8]}"
                    color_scheme = color_schemes.get(param, color_schemes['ph_level'])
                    colored_grid, breaks, labels = self.create_parameter_colored_raster(raster_array, param, color_scheme)
                    
                    colored_path = year_dir / f"{layer_name}_colored.tif"
                    
                    with rasterio.open(
                        colored_path,
                        'w',
                        driver='GTiff',
                        height=colored_grid.shape[0],
                        width=colored_grid.shape[1],
                        count=3,
                        dtype=rasterio.uint8,
                        crs=metadata['crs'],
                        transform=metadata['transform'],
                        nodata=0,
                        compress='lzw'
                    ) as dst:
                        for i in range(3):
                            dst.write(colored_grid[:, :, i], i + 1)
                    
                    preview_path = year_dir / f"{layer_name}_preview.png"
                    param_title = color_scheme['parameter_name']
                    
                    # CREATE PREVIEW WITHOUT EMBEDDED LEGEND
                    if self.create_map_preview_with_wells(
                        str(colored_path),
                        str(preview_path),
                        wells_data,
                        f"{param_title} ({selected_year})",
                        None  # No color scheme = no embedded legend
                    ):
                        preview_images_created.append(str(preview_path))
                        print(f"[PREVIEW] Created preview for {param} (without embedded legend)")
                    
                    # Publish to GeoServer
                    with geoserver_lock:
                        if self.publish_geotiff(colored_path, layer_name):
                            individual_published_layers.append(layer_name)
                    
                except Exception as e:
                    print(f"[ERROR] Failed to process {param}: {str(e)}")
            
            print(f"[PREVIEW] Created {len(preview_images_created)} preview images")

            print("STEP 2/3: Running quality analysis...")
            parameter_thresholds = {
                'ph_level': 7.5, 'electrical_conductivity': 1500.0, 'carbonate': 100.0,
                'bicarbonate': 500.0, 'chloride': 250.0, 'fluoride': 1.5, 'sulfate': 250.0,
                'nitrate': 50.0, 'Hardness': 500.0, 'calcium': 200.0,
                'magnesium': 150.0, 'sodium': 200.0, 'potassium': 12.0, 'iron': 0.3
            }
            analysis_results = self.perform_quality_analysis_optimized(
                raster_data, parameter_thresholds, selected_parameters
            )

            if not analysis_results:
                return {'error': 'Failed to perform quality analysis'}

            print("STEP 2B: Saving analysis rasters...")
            analyzed_layers = self.save_analysis_rasters_parallel(
                analysis_results, selected_parameters, selected_year, raster_metadata
            )

            parameter_statistics = self.calculate_detailed_parameter_statistics_optimized(
                raster_data, analysis_results, parameter_thresholds
            )

            print("STEP 3/3: Creating GWQI overlay with TRUE NORMALIZATION...")
            gwqi_raster = self.calculate_gwqi_overlay(
                analysis_results['rank_maps'],
                analysis_results['weights']
            )

            if gwqi_raster is None:
                return {'error': 'Failed to calculate GWQI overlay'}

            reference_metadata = next(iter(raster_metadata.values()))
            # UNIQUE COMPOSITE LAYER NAME
            composite_layer_name = f"gwqi_composite_{selected_year}_{session_id[:8]}"
            
            if clipping_geometry is not None:
                gwqi_raster = self.apply_clipping_to_raster(gwqi_raster, clipping_geometry, reference_metadata)

            # DEBUG: Verify normalization
            valid_gwqi = gwqi_raster[~np.isnan(gwqi_raster) & np.isfinite(gwqi_raster)]
            print(f"[DEBUG] Normalized GWQI stats: min={np.min(valid_gwqi):.4f}, max={np.max(valid_gwqi):.4f}, mean={np.mean(valid_gwqi):.4f}")

            # CRITICAL: Save normalized GWQI raster FIRST (for village analysis)
            normalized_gwqi_path = year_dir / f"{composite_layer_name}_normalized.tif"
            
            print(f"[DEBUG] Saving normalized GWQI to: {normalized_gwqi_path}")
            
            with rasterio.open(
                normalized_gwqi_path,
                'w',
                driver='GTiff',
                height=gwqi_raster.shape[0],
                width=gwqi_raster.shape[1],
                count=1,
                dtype=rasterio.float32,
                crs=reference_metadata['crs'],
                transform=reference_metadata['transform'],
                nodata=np.nan,
                compress='lzw'
            ) as dst:
                dst.write(gwqi_raster.astype(np.float32), 1)
            
            print(f"[SAVE] Normalized GWQI raster saved to: {normalized_gwqi_path}")
            
            # Verify the saved raster
            with rasterio.open(normalized_gwqi_path) as verify:
                verify_data = verify.read(1)
                valid_verify = verify_data[~np.isnan(verify_data) & np.isfinite(verify_data)]
                print(f"[VERIFY] Saved raster range: {np.min(valid_verify):.4f} to {np.max(valid_verify):.4f}")

            # Create colored version for visualization
            colored_grid, breaks, colors, labels = self.create_gwqi_colored_raster(gwqi_raster)

            colored_path = year_dir / f"{composite_layer_name}.tif"

            with rasterio.open(
                colored_path,
                'w',
                driver='GTiff',
                height=colored_grid.shape[0],
                width=colored_grid.shape[1],
                count=3,
                dtype=rasterio.uint8,
                crs=reference_metadata['crs'],
                transform=reference_metadata['transform'],
                nodata=0,
                compress='lzw'
            ) as dst:
                for i in range(3):
                    dst.write(colored_grid[:, :, i], i + 1)

            gwqi_preview_path = year_dir / f"{composite_layer_name}_preview.png"
            
            # CREATE GWQI PREVIEW WITHOUT EMBEDDED LEGEND
            self.create_map_preview_with_wells(
                str(colored_path),
                str(gwqi_preview_path),
                wells_data,
                f"Groundwater Quality Index - Normalized ({selected_year})",
                None  # No color scheme = no embedded legend
            )

            success = False
            if self.create_workspace():
                if self.publish_geotiff(colored_path, composite_layer_name):
                    success = True
            
            gwqi_published_layers = [composite_layer_name] if success else []

            gwqi_stats = self.calculate_gwqi_statistics(gwqi_raster)
            analysis_stats = self.calculate_analysis_statistics(analysis_results)

            # REMOVED: Village analysis from main generation
            print("STEP 3B: Village analysis SKIPPED (available on-demand)")

            print("STEP 4/4: Preparing response...")
            all_published_layers = individual_published_layers + gwqi_published_layers
            layer_metadata = self.create_layer_metadata(
                individual_published_layers, gwqi_published_layers, selected_parameters, selected_year
            )
            print(f"[DEBUG] Individual layers created: {individual_published_layers}")
            print(f"[DEBUG] GWQI layers created: {gwqi_published_layers}")
            print(f"[DEBUG] All layer metadata count: {len(layer_metadata)}")
            print(f"[DEBUG] Layer names in metadata: {[l['layer_name'] for l in layer_metadata]}")

            total_time = time.time() - start_time

            response_data = {
                'message': 'GWQI Generation completed (village analysis available on-demand)',
                'generation_mode': 'unified_fast_with_uuid',
                'selected_year': selected_year,
                'parameters_processed': selected_parameters,
                'total_parameters': len(selected_parameters),
                'published_layers': all_published_layers,
                'individual_raster_layers': individual_published_layers,
                'gwqi_layers': gwqi_published_layers,
                'analyzed_layers': analyzed_layers,
                'layer_metadata': layer_metadata,
                'weights_calculated': analysis_results['weights'],
                'results': gwqi_stats,
                'analysis_details': analysis_stats,
                'parameter_statistics': parameter_statistics,
                'village_analysis': [],
                'geoserver_url': f"/geoserver/{WORKSPACE}/wms",
                'processing_info': {
                    'total_time': f'{total_time:.2f}s',
                    'normalization_method': 'min_max_scaling',
                    'normalization_applied': True,
                    'village_analysis_mode': 'on_demand',
                    'uuid_session': True,
                    'data_source': 'CSV_INTERPOLATION' if use_csv_interpolation else 'EXISTING_RASTERS',
                    'interpolation_mode': 'IDW' if use_csv_interpolation else 'PRE_EXISTING'
                },
                'storage_info': {
                    'permanent_storage_path': str(year_dir),
                    'normalized_raster_path': str(normalized_gwqi_path),
                    'temp_directory_cleaned': False,
                    'csv_rasters_used': use_csv_interpolation
                },
                'preview_images': {
                    'individual_parameters': len(preview_images_created),
                    'gwqi_composite': str(gwqi_preview_path) if gwqi_preview_path.exists() else None,
                    'total_previews': len(preview_images_created) + 1,
                    'legends_embedded': False  # NEW: Indicate legends are separate for PDF
                },
                'wells_overlaid': len(wells_data),
                'village_count': 0
            }

            if gwqi_published_layers:
                response_data['color_scheme'] = {
                    'type': 'GWQI_Classification_Normalized',
                    'parameter': 'GWQI_Composite',
                    'colors': colors,
                    'labels': labels,
                    'classes': len(colors)
                }

            print("[CLEANUP] Cleaning up session temp directory...")
            cleanup_success = self.cleanup_temp_directory()
            response_data['storage_info']['temp_directory_cleaned'] = cleanup_success
            
            if cleanup_success:
                print("[SUCCESS] Session temp files cleaned successfully")
            else:
                print("[WARNING] Some session temp files could not be cleaned")

            print(f"GWQI GENERATION COMPLETED in {total_time:.2f}s (with UUID session)")

            del raster_data, analysis_results
            gc.collect()

            return response_data

        except Exception as e:
            print(f"[ERROR] GWQI generation error: {str(e)}")
            traceback.print_exc()
            
            try:
                self.cleanup_temp_directory()
            except:
                pass
                
            return {'error': f'GWQI generation failed: {str(e)}'}

    def calculate_village_analysis(self, gwqi_raster, metadata, village_ids, place):
        """OPTIMIZED: Calculate village-wise GWQI analysis using session temp"""
        try:
            print("[VILLAGE ANALYSIS] Starting OPTIMIZED village-wise analysis...")
            start_time = time.time()
            
            villages_vector = self.load_village_shapefile()
            if villages_vector is None:
                print("[VILLAGE ANALYSIS] Could not load village shapefile")
                return []

            # Filter villages
            if place == "village":
                village_ids_float = [float(x) for x in village_ids]
                selected_villages = villages_vector[villages_vector['village_co'].isin(village_ids_float)]
            else:
                village_ids_int = [int(x) for x in village_ids]
                selected_villages = villages_vector[villages_vector['SUBDIS_COD'].isin(village_ids_int)]

            if selected_villages.empty:
                print("[VILLAGE ANALYSIS] No villages found")
                return []

            print(f"[VILLAGE ANALYSIS] Processing {len(selected_villages)} villages...")

            # OPTIMIZATION 1: Create raster ONCE in session temp directory
            temp_raster_path = self.session_temp_dir / f"temp_gwqi_analysis_{uuid.uuid4().hex}.tif"
            
            with rasterio.open(
                temp_raster_path,
                'w',
                driver='GTiff',
                height=gwqi_raster.shape[0],
                width=gwqi_raster.shape[1],
                count=1,
                dtype=rasterio.float32,
                crs=metadata['crs'],
                transform=metadata['transform'],
                nodata=np.nan
            ) as dst:
                dst.write(gwqi_raster.astype(np.float32), 1)

            # OPTIMIZATION 2: Reproject ALL geometries at once
            if selected_villages.crs != metadata['crs']:
                selected_villages = selected_villages.to_crs(metadata['crs'])

            village_analysis = []
            pixel_area_km2 = 0.0009

            # OPTIMIZATION 3: Reuse the same raster source
            with rasterio.open(temp_raster_path) as src:
                for idx, village_row in selected_villages.iterrows():
                    try:
                        village_name = village_row.get('village', village_row.get('VILLAGE', 'Unknown'))
                        village_geom = village_row.geometry

                        # Mask raster to village boundary (NO reprojection needed now)
                        out_image, out_transform = mask(
                            dataset=src,
                            shapes=[village_geom],
                            crop=True,
                            nodata=np.nan,
                            all_touched=True
                        )

                        if len(out_image.shape) == 3:
                            village_gwqi = out_image[0]
                        else:
                            village_gwqi = out_image

                        # Calculate statistics
                        valid_data = village_gwqi[~np.isnan(village_gwqi) & np.isfinite(village_gwqi)]

                        if len(valid_data) == 0:
                            continue

                        # Count pixels in each category (0-1 scale)
                        excellent_count = np.sum((valid_data >= 0.8) & (valid_data <= 1.0))
                        good_count = np.sum((valid_data >= 0.6) & (valid_data < 0.8))
                        fair_count = np.sum((valid_data >= 0.4) & (valid_data < 0.6))
                        poor_count = np.sum((valid_data >= 0.2) & (valid_data < 0.4))
                        very_poor_count = np.sum((valid_data >= 0.0) & (valid_data < 0.2))

                        total_pixels = len(valid_data)

                        village_analysis.append({
                            'village_name': village_name,
                            'village_code': str(village_row.get('village_co', village_row.get('SUBDIS_COD', 'Unknown'))),
                            'total_area_km2': round(total_pixels * pixel_area_km2, 2),
                            'average_gwqi': round(np.mean(valid_data), 4),
                            'percentages': {
                                'excellent': round((excellent_count / total_pixels) * 100, 2),
                                'good': round((good_count / total_pixels) * 100, 2),
                                'fair': round((fair_count / total_pixels) * 100, 2),
                                'poor': round((poor_count / total_pixels) * 100, 2),
                                'very_poor': round((very_poor_count / total_pixels) * 100, 2)
                            },
                            'area_km2': {
                                'excellent': round(excellent_count * pixel_area_km2, 2),
                                'good': round(good_count * pixel_area_km2, 2),
                                'fair': round(fair_count * pixel_area_km2, 2),
                                'poor': round(poor_count * pixel_area_km2, 2),
                                'very_poor': round(very_poor_count * pixel_area_km2, 2)
                            },
                            'distribution': {
                                'excellent': int(excellent_count),
                                'good': int(good_count),
                                'fair': int(fair_count),
                                'poor': int(poor_count),
                                'very_poor': int(very_poor_count)
                            }
                        })

                    except Exception as e:
                        print(f"[VILLAGE ANALYSIS] Error processing village {village_name}: {str(e)}")
                        continue

            # Clean up temp file
            if temp_raster_path.exists():
                os.remove(temp_raster_path)

            elapsed_time = time.time() - start_time
            print(f"[VILLAGE ANALYSIS] Completed analysis for {len(village_analysis)} villages in {elapsed_time:.2f}s")
            
            return village_analysis

        except Exception as e:
            print(f"[VILLAGE ANALYSIS ERROR] {str(e)}")
            traceback.print_exc()
            return []

    def load_csv_interpolated_rasters(self, selected_parameters, selected_year, village_ids, place, session_id):
        """Load rasters created from CSV interpolation"""
        print(f"[CSV RASTERS] Loading from session {session_id}, year {selected_year}")
        
        try:
            session_paths = session_manager.get_paths(session_id)
            session_base_dir = session_paths['temp_dir'].parent
        except ValueError as e:
            raise FileNotFoundError(f"Invalid or expired session {session_id}: {e}")

        # Construct the path to read the interpolated rasters from within the session directory
        csv_rasters_dir = session_base_dir / "interpolated_rasters" / selected_year
        
        print(f"[CSV RASTERS] Looking in: {csv_rasters_dir}")
        
        if not csv_rasters_dir.exists():
            raise FileNotFoundError(f"CSV interpolation directory not found: {csv_rasters_dir}")
        
        # Load village shapefile
        villages_vector = self.load_village_shapefile()
        if villages_vector is None:
            return {}, {}
        
        # Filter to selected area
        try:
            if place == "village":
                village_ids_float = [float(x) for x in village_ids]
                selected_area = villages_vector[villages_vector['village_co'].isin(village_ids_float)]
            else:
                village_ids_int = [int(x) for x in village_ids]
                selected_area = villages_vector[villages_vector['SUBDIS_COD'].isin(village_ids_int)]
        except Exception as e:
            print(f"[ERROR] Failed to filter village shapefile: {str(e)}")
            return {}, {}
        
        if selected_area.empty:
            print("[ERROR] No matching villages found for clipping")
            return {}, {}
        
        raster_data = {}
        raster_metadata = {}
        
        for parameter in selected_parameters:
            try:
                raster_path = csv_rasters_dir / f"{parameter}_{selected_year}.tif"
                
                if not raster_path.exists():
                    print(f"[WARNING] CSV raster not found: {raster_path}")
                    continue
                
                print(f"[CSV RASTERS] Loading: {raster_path}")
                
                with rasterio.open(raster_path) as src:
                    # Ensure geometries are in the same CRS as raster
                    if selected_area.crs != src.crs:
                        selected_area_reproj = selected_area.to_crs(src.crs)
                    else:
                        selected_area_reproj = selected_area
                    
                    # Clip to selected area
                    out_image, out_transform = mask(
                        dataset=src,
                        shapes=selected_area_reproj.geometry,
                        crop=True,
                        nodata=np.nan,
                        all_touched=True
                    )
                    
                    if len(out_image.shape) == 3:
                        raster_array = out_image[0]
                    else:
                        raster_array = out_image
                    
                    metadata = {
                        'transform': out_transform,
                        'crs': src.crs,
                        'shape': raster_array.shape,
                        'dtype': rasterio.float32,
                        'nodata': src.nodata,
                        'data_year': selected_year,
                        'source_file': str(raster_path),
                        'source_type': 'CSV_INTERPOLATION'
                    }
                    
                    raster_data[parameter] = raster_array.astype(np.float32)
                    raster_metadata[parameter] = metadata
                    
            except Exception as e:
                print(f"[ERROR] Failed to load CSV raster for {parameter}: {str(e)}")
                traceback.print_exc()
                continue
        
        print(f"[CSV RASTERS] Loaded {len(raster_data)}/{len(selected_parameters)} rasters")
        return raster_data, raster_metadata

    def load_and_clip_interpolated_rasters_optimized(self, selected_parameters, selected_year, village_ids, place):
        """Load rasters with parallel processing"""
        print(f"[OPTIMIZED] Loading {len(selected_parameters)} rasters for year {selected_year}")
        start_time = time.time()
        
        villages_vector = self.load_village_shapefile()
        if villages_vector is None:
            return {}, {}

        try:
            if place == "village":
                village_ids_float = [float(x) for x in village_ids]
                selected_area = villages_vector[villages_vector['village_co'].isin(village_ids_float)]
            else:
                village_ids_int = [int(x) for x in village_ids]
                selected_area = villages_vector[villages_vector['SUBDIS_COD'].isin(village_ids_int)]

            if selected_area.empty:
                print("[ERROR] No matching villages found for clipping")
                return {}, {}

        except Exception as e:
            print(f"[ERROR] Failed to filter village shapefile: {str(e)}")
            return {}, {}

        def process_single_raster(parameter):
            try:
                raster_filename = f"{parameter}_{selected_year}.tif"
                raster_path = RASTERS_DIR / raster_filename

                if not raster_path.exists():
                    print(f"[WARNING] Raster not found: {raster_path}")
                    return None, None, None

                with rasterio.open(raster_path) as src:
                    if selected_area.crs != src.crs:
                        selected_area_reproj = selected_area.to_crs(src.crs)
                    else:
                        selected_area_reproj = selected_area

                    valid_geometries = []
                    for geom in selected_area_reproj.geometry:
                        if geom.is_valid:
                            valid_geometries.append(geom)
                        else:
                            fixed_geom = geom.buffer(0)
                            if fixed_geom.is_valid:
                                valid_geometries.append(fixed_geom)

                    if not valid_geometries:
                        return None, None, None

                    if len(valid_geometries) > 1:
                        try:
                            unified_geometry = unary_union(valid_geometries)
                            clip_geometries = [unified_geometry] if unified_geometry.is_valid else valid_geometries
                        except:
                            clip_geometries = valid_geometries
                    else:
                        clip_geometries = valid_geometries

                    out_image, out_transform = mask(
                        dataset=src,
                        shapes=clip_geometries,
                        crop=True,
                        nodata=src.nodata,
                        all_touched=True,
                        invert=False
                    )

                    if len(out_image.shape) == 3 and out_image.shape[0] >= 1:
                        raster_array = out_image[0]
                    else:
                        raster_array = out_image

                    metadata = {
                        'transform': out_transform,
                        'crs': src.crs,
                        'shape': raster_array.shape,
                        'dtype': rasterio.float32,
                        'nodata': src.nodata,
                        'bounds': rasterio.transform.array_bounds(
                            raster_array.shape[0],
                            raster_array.shape[1],
                            out_transform
                        ),
                        'valid_pixels': len(raster_array[~np.isnan(raster_array)]),
                        'total_pixels': raster_array.size,
                        'data_year': selected_year,
                        'source_file': str(raster_path)
                    }

                    return parameter, raster_array.astype(np.float32), metadata

            except Exception as e:
                print(f"[ERROR] Failed to process {parameter}: {str(e)}")
                return None, None, None

        raster_data = {}
        raster_metadata = {}
        
        max_workers = min(4, len(selected_parameters))
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_param = {executor.submit(process_single_raster, param): param for param in selected_parameters}
            
            for future in concurrent.futures.as_completed(future_to_param):
                result = future.result()
                if result[0] is not None:
                    param, data, metadata = result
                    raster_data[param] = data
                    raster_metadata[param] = metadata

        load_time = time.time() - start_time
        print(f"[OPTIMIZED] Loaded {len(raster_data)}/{len(selected_parameters)} rasters in {load_time:.2f}s")
        
        return raster_data, raster_metadata

    def perform_quality_analysis_optimized(self, raster_data, thresholds, parameters):
        """Parallel CI and Rank calculations"""
        print(f"[OPTIMIZED] Running parallel quality analysis")
        start_time = time.time()
        
        try:
            ci_maps = {}
            rank_maps = {}

            def calculate_ci_for_param(param_data_tuple):
                param, data = param_data_tuple
                threshold = thresholds.get(param, 1.0)
                ci = self.calculate_concentration_index(data, threshold)
                return param, ci

            with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(parameters))) as executor:
                ci_futures = [executor.submit(calculate_ci_for_param, (param, raster_data[param])) 
                             for param in parameters if param in raster_data]
                
                for future in concurrent.futures.as_completed(ci_futures):
                    param, ci = future.result()
                    ci_maps[param] = ci

            def calculate_rank_for_param(param_ci_tuple):
                param, ci_data = param_ci_tuple
                rank = self.calculate_ranking(ci_data)
                return param, rank

            with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(ci_maps))) as executor:
                rank_futures = [executor.submit(calculate_rank_for_param, (param, ci_data)) 
                               for param, ci_data in ci_maps.items()]
                
                for future in concurrent.futures.as_completed(rank_futures):
                    param, rank = future.result()
                    rank_maps[param] = rank

            weights = self.calculate_weights(rank_maps, ci_maps, thresholds, parameters, raster_data)

            total_time = time.time() - start_time
            print(f"[OPTIMIZED] Analysis completed in {total_time:.2f}s")

            return {
                'ci_maps': ci_maps,
                'rank_maps': rank_maps,
                'weights': weights,
                'parameter_thresholds': thresholds
            }

        except Exception as e:
            print(f"[ERROR] Analysis error: {str(e)}")
            traceback.print_exc()
            return None

    def save_analysis_rasters_parallel(self, analysis_results, selected_parameters, selected_year, raster_metadata):
        """Save analysis rasters in parallel using session temp directory"""
        print(f"[OPTIMIZED] Saving analysis rasters to session temp")
        analyzed_layers = []
        
        def save_raster_pair(param):
            if param not in analysis_results['ci_maps'] or param not in analysis_results['rank_maps']:
                return []
                
            try:
                timestamp = int(time.time() * 1000)
                ci_layer = f"ci_{param}_{selected_year}_{timestamp}"
                rank_layer = f"rank_{param}_{selected_year}_{timestamp}"
                
                saved_layers = []
                
                ci_path = self.save_analysis_raster(
                    analysis_results['ci_maps'][param],
                    ci_layer,
                    raster_metadata[param],
                    'CI'
                )
                if ci_path:
                    saved_layers.append(ci_layer)
                
                rank_path = self.save_analysis_raster(
                    analysis_results['rank_maps'][param],
                    rank_layer,
                    raster_metadata[param],
                    'Rank'
                )
                if rank_path:
                    saved_layers.append(rank_layer)
                
                return saved_layers
                
            except Exception as e:
                print(f"[ERROR] Failed to save analysis rasters for {param}: {str(e)}")
                return []

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(save_raster_pair, param) for param in selected_parameters]
            
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                analyzed_layers.extend(result)

        return analyzed_layers

    def save_analysis_raster(self, data_array, layer_name, metadata, analysis_type):
        """Save analysis raster to session temp directory"""
        try:
            with file_write_lock:
                temp_path = self.session_temp_dir / f"{layer_name}.tif"

                if len(data_array.shape) == 3:
                    data_array = data_array[0]

                with rasterio.open(
                    temp_path,
                    'w',
                    driver='GTiff',
                    height=data_array.shape[0],
                    width=data_array.shape[1],
                    count=1,
                    dtype=rasterio.float32,
                    crs=metadata['crs'],
                    transform=metadata['transform'],
                    nodata=np.nan,
                    compress='lzw'
                ) as dst:
                    dst.write(data_array, 1)

                return str(temp_path)

        except Exception as e:
            print(f"[ERROR] Failed to save {analysis_type} raster: {str(e)}")
            return None

    def load_clipping_geometry_optimized(self, village_ids, place):
        """Load clipping geometry with caching"""
        try:
            villages_vector = self.load_village_shapefile()
            if villages_vector is None:
                return None

            if place == "village":
                village_ids_float = [float(x) for x in village_ids]
                selected_area = villages_vector[villages_vector['village_co'].isin(village_ids_float)]
            else:
                village_ids_int = [int(x) for x in village_ids]
                selected_area = villages_vector[villages_vector['SUBDIS_COD'].isin(village_ids_int)]

            return selected_area if not selected_area.empty else None

        except Exception as e:
            print(f"[ERROR] Failed to load clipping geometry: {str(e)}")
            return None

    def calculate_detailed_parameter_statistics_optimized(self, raster_data, analysis_results, thresholds):
        """Calculate statistics in parallel"""
        print(f"[OPTIMIZED] Calculating statistics")
        
        try:
            ci_maps = analysis_results.get('ci_maps', {})
            rank_maps = analysis_results.get('rank_maps', {})
            
            def calculate_param_stats(param):
                try:
                    p_array = raster_data[param]
                    ci_array = ci_maps.get(param)
                    rank_array = rank_maps.get(param)
                    threshold = thresholds.get(param, 1.0)
                    
                    p_stats = self._calculate_robust_p_statistics(p_array, param)
                    ci_stats = self._calculate_robust_ci_statistics(ci_array, param)
                    rank_stats = self._calculate_robust_rank_statistics(rank_array, param)
                    
                    mean_p = p_stats.get('mean')
                    mean_rank = rank_stats.get('mean')
                    
                    if mean_p is not None and mean_rank is not None and threshold is not None:
                        if mean_p > threshold:
                            calculated_weight = mean_rank + 2
                            weight_classification = "critical"
                        else:
                            calculated_weight = mean_rank
                            weight_classification = "non-critical"
                    else:
                        calculated_weight = 5.0
                        weight_classification = "unknown"
                    
                    return param, {
                        'parameter_name': param.replace('_', ' ').title(),
                        'threshold_T': self._safe_float(threshold),
                        'P_statistics': p_stats,
                        'CI_statistics': ci_stats,
                        'Rank_statistics': rank_stats,
                        'Weight': self._safe_float(calculated_weight),
                        'weight_classification': weight_classification,
                        'processing_status': 'success'
                    }
                    
                except Exception as e:
                    return param, {
                        'parameter_name': param.replace('_', ' ').title(),
                        'threshold_T': thresholds.get(param, 1.0),
                        'Weight': 5.0,
                        'weight_classification': 'error',
                        'processing_status': 'error',
                        'error_message': str(e)
                    }

            parameter_statistics = {}
            with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(raster_data))) as executor:
                futures = [executor.submit(calculate_param_stats, param) for param in raster_data.keys()]
                
                for future in concurrent.futures.as_completed(futures):
                    param, stats = future.result()
                    parameter_statistics[param] = stats

            return parameter_statistics
            
        except Exception as e:
            print(f"[ERROR] Statistics error: {str(e)}")
            return {}
    
    def create_layer_metadata(self, individual_layers, gwqi_layers, parameters, year):
        """Create metadata with fixed layer names"""
        layer_metadata = []
        color_schemes = self.get_parameter_color_schemes()
        
        for gwqi_layer in gwqi_layers:
            layer_metadata.append({
                'layer_name': gwqi_layer,
                'display_name': f'GWQI Composite ({year})',
                'type': 'gwqi',
                'parameter': 'GWQI',
                'year': year,
                'description': 'Groundwater Quality Index',
                'color_scheme': {
                    'type': 'gwqi_classification',
                    'colors': ['#d73027', '#fc8d59', '#fee08b', '#99d594', '#3288bd'],
                    'labels': ['Very Poor (0-0.2)', 'Poor (0.2-0.4)', 'Fair (0.4-0.6)', 'Good (0.6-0.8)', 'Excellent (0.8-1.0)'],
                    'parameter_name': 'GWQI'
                },
                'is_default': True
            })
        
        for layer in individual_layers:
            # Extract parameter name from layer (remove year and session)
            parts = layer.rsplit('_', 2)
            if len(parts) >= 3:
                param = parts[0]
            else:
                param = layer
            
            if param in color_schemes:
                param_scheme = color_schemes[param]
                
                ranges = param_scheme['ranges']
                labels = []
                for j in range(len(ranges) - 1):
                    if j == 0:
                        labels.append(f"< {ranges[j+1]} {param_scheme['unit']}")
                    elif j == len(ranges) - 2:
                        labels.append(f"> {ranges[j]} {param_scheme['unit']}")
                    else:
                        labels.append(f"{ranges[j]} - {ranges[j+1]} {param_scheme['unit']}")
                
                layer_metadata.append({
                    'layer_name': layer,
                    'display_name': f"{param_scheme['parameter_name']} ({year})",
                    'type': 'parameter',
                    'parameter': param,
                    'year': year,
                    'description': f'Interpolated {param_scheme["parameter_name"]} concentration values',
                    'color_scheme': {
                        'type': 'parameter_gradient',
                        'colors': param_scheme['colors'],
                        'labels': labels,
                        'parameter_name': param_scheme['parameter_name'],
                        'unit': param_scheme['unit'],
                        'ranges': param_scheme['ranges']
                    },
                    'is_default': False
                })
        
        if layer_metadata and not any(l['is_default'] for l in layer_metadata):
            layer_metadata[0]['is_default'] = True
        
        return layer_metadata

    def get_current_village_ids(self):
        return getattr(self, '_current_village_ids', [])
    
    def get_current_place(self):
        return getattr(self, '_current_place', 'subdistrict')

    def _safe_float(self, value):
        """Convert value to JSON-safe float"""
        if value is None:
            return None
        try:
            if hasattr(value, 'item'):
                value = value.item()
            elif hasattr(value, 'dtype'):
                value = float(value)
            else:
                value = float(value)
            
            if np.isnan(value) or np.isinf(value):
                return None
            return value
        except (ValueError, TypeError, OverflowError):
            return None

    def create_parameter_colored_raster(self, data, parameter, color_scheme):
        """Create colored raster for individual parameters"""
        try:
            colors = color_scheme['colors']
            ranges = color_scheme['ranges']
            
            valid_data = data[~np.isnan(data)]
            if len(valid_data) == 0:
                return np.zeros((*data.shape, 3), dtype=np.uint8), ranges, []
            
            breaks = np.array(ranges)
            labels = []
            for i in range(len(breaks) - 1):
                if i == 0:
                    labels.append(f"< {breaks[i+1]}")
                elif i == len(breaks) - 2:
                    labels.append(f"> {breaks[i]}")
                else:
                    labels.append(f"{breaks[i]} - {breaks[i+1]}")
            
            colored_image = np.zeros((*data.shape, 3), dtype=np.uint8)
            
            for i in range(len(breaks) - 1):
                if i == len(breaks) - 2:
                    mask = (data >= breaks[i]) & (data <= breaks[i + 1]) & ~np.isnan(data)
                else:
                    mask = (data >= breaks[i]) & (data < breaks[i + 1]) & ~np.isnan(data)
                
                if np.any(mask) and i < len(colors):
                    hex_color = colors[i].lstrip('#')
                    rgb = tuple(int(hex_color[j:j+2], 16) for j in (0, 2, 4))
                    colored_image[mask] = rgb
            
            nan_mask = np.isnan(data)
            colored_image[nan_mask] = [0, 0, 0]
            
            return colored_image, breaks, labels
            
        except Exception as e:
            print(f"[ERROR] Failed to create colored raster for {parameter}: {str(e)}")
            return np.zeros((*data.shape, 3), dtype=np.uint8), [], []

    def apply_clipping_to_raster(self, raster_data, clipping_geometry, metadata):
        """Apply clipping geometry to raster data using session temp"""
        try:
            temp_raster_path = self.session_temp_dir / f"temp_clipping_{uuid.uuid4().hex}.tif"

            with rasterio.open(
                temp_raster_path,
                'w',
                driver='GTiff',
                height=raster_data.shape[0],
                width=raster_data.shape[1],
                count=1,
                dtype=rasterio.float32,
                crs=metadata['crs'],
                transform=metadata['transform'],
                nodata=np.nan
            ) as dst:
                dst.write(raster_data, 1)

            with rasterio.open(temp_raster_path) as src:
                if clipping_geometry.crs != src.crs:
                    clipping_geometry = clipping_geometry.to_crs(src.crs)

                out_image, out_transform = mask(
                    dataset=src,
                    shapes=clipping_geometry.geometry,
                    crop=True,
                    nodata=np.nan,
                    all_touched=True,
                    invert=False
                )

                if len(out_image.shape) == 3:
                    clipped_data = out_image[0]
                else:
                    clipped_data = out_image

                metadata['transform'] = out_transform
                metadata['shape'] = clipped_data.shape

            os.remove(temp_raster_path)
            return clipped_data

        except Exception as e:
            print(f"[ERROR] Clipping failed: {str(e)}")
            return raster_data

    def calculate_concentration_index(self, p_array, threshold):
        """Calculate Concentration Index: CI = (P - T) / (P + T)"""
        if hasattr(p_array, 'mask'):
            valid_mask = ~p_array.mask
            p_array = p_array.data
        else:
            valid_mask = np.isfinite(p_array) & (p_array > 0)

        numerator = p_array - threshold
        denominator = p_array + threshold
        ci = np.full_like(p_array, np.nan, dtype=np.float32)
        calc_mask = valid_mask & (denominator != 0)
        ci[calc_mask] = numerator[calc_mask] / denominator[calc_mask]
        ci = np.clip(ci, -1, 1)
        return ci

    def calculate_ranking(self, ci_array):
        """Calculate Ranking: R = 0.5 * (CI)^2 + 4.5 * CI + 5"""
        valid_mask = ~np.isnan(ci_array) & np.isfinite(ci_array)
        rank = np.full_like(ci_array, np.nan, dtype=np.float32)
        valid_ci = ci_array[valid_mask]
        rank[valid_mask] = 0.5 * (valid_ci ** 2) + 4.5 * valid_ci + 5
        rank[valid_mask] = np.clip(rank[valid_mask], 1, 10)
        return rank

    def calculate_weights(self, rank_maps, ci_maps, thresholds, parameters, raster_data):
        """Weight calculation: W = R + 2 if mean(P) > T else W = R"""
        weights = {}

        for param in parameters:
            if param in rank_maps and param in raster_data:
                p_array = raster_data[param]
                rank_arr = rank_maps[param]
                threshold = thresholds.get(param, 1.0)

                valid_ranks = rank_arr[~np.isnan(rank_arr) & np.isfinite(rank_arr)]
                if len(valid_ranks) == 0:
                    weights[param] = 5.0
                    continue

                mean_rank = np.mean(valid_ranks)

                valid_p = p_array[~np.isnan(p_array) & np.isfinite(p_array)]
                if len(valid_p) == 0:
                    weights[param] = mean_rank
                    continue

                mean_p = np.mean(valid_p)

                if mean_p > threshold:
                    weights[param] = mean_rank + 2
                else:
                    weights[param] = mean_rank

        return weights

    def calculate_gwqi_overlay(self, rank_rasters, weights):
        """Calculate GWQI Overlay with TRUE MIN-MAX NORMALIZATION to 0-1"""
        try:
            first_key = list(rank_rasters.keys())[0]
            shape = rank_rasters[first_key].shape

            weighted_sum = np.zeros(shape, dtype=np.float32)
            weight_sum = np.zeros(shape, dtype=np.float32)

            for param, rank_arr in rank_rasters.items():
                weight = weights.get(param, 5.0)
                valid_mask = ~np.isnan(rank_arr) & np.isfinite(rank_arr)

                weighted_sum[valid_mask] += rank_arr[valid_mask] * weight
                weight_sum[valid_mask] += weight

            gwqi = np.full(shape, np.nan, dtype=np.float32)
            valid_pixels = weight_sum > 0

            if np.any(valid_pixels):
                n = len(rank_rasters)
                raw_gwqi = 100 - (weighted_sum[valid_pixels] / n)
                
                actual_min = np.min(raw_gwqi)
                actual_max = np.max(raw_gwqi)
                
                print(f"[NORMALIZATION] Raw GWQI range: {actual_min:.2f} to {actual_max:.2f}")
                
                if actual_max > actual_min:
                    gwqi[valid_pixels] = (raw_gwqi - actual_min) / (actual_max - actual_min)
                else:
                    gwqi[valid_pixels] = 0.5
                
                valid_gwqi = ~np.isnan(gwqi) & np.isfinite(gwqi)
                gwqi[valid_gwqi] = np.clip(gwqi[valid_gwqi], 0, 1)
                
                print(f"[NORMALIZATION] Normalized GWQI range: {np.min(gwqi[valid_gwqi]):.4f} to {np.max(gwqi[valid_gwqi]):.4f}")
                print(f"[NORMALIZATION] Mean normalized GWQI: {np.mean(gwqi[valid_gwqi]):.4f}")

            return gwqi

        except Exception as e:
            print(f"[ERROR] GWQI overlay calculation error: {str(e)}")
            traceback.print_exc()
            return None

    def calculate_gwqi_statistics(self, gwqi_raster):
        """Calculate statistics for GWQI overlay (normalized 0-1 scale)"""
        try:
            valid_data = gwqi_raster[~np.isnan(gwqi_raster)]
            
            if len(valid_data) == 0:
                return {'gwqi_score': 0, 'classification': 'No Data', 'valid_pixels': 0}

            gwqi_mean = np.mean(valid_data)

            if gwqi_mean >= 0.8:
                classification = 'Excellent'
            elif gwqi_mean >= 0.6:
                classification = 'Good'
            elif gwqi_mean >= 0.4:
                classification = 'Fair'
            elif gwqi_mean >= 0.2:
                classification = 'Poor'
            else:
                classification = 'Very Poor'

            excellent_count = np.sum((valid_data >= 0.8) & (valid_data <= 1.0))
            good_count = np.sum((valid_data >= 0.6) & (valid_data < 0.8))
            fair_count = np.sum((valid_data >= 0.4) & (valid_data < 0.6))
            poor_count = np.sum((valid_data >= 0.2) & (valid_data < 0.4))
            very_poor_count = np.sum((valid_data >= 0) & (valid_data < 0.2))

            pixel_area_km2 = 0.0009

            return {
                'gwqi_score': round(gwqi_mean, 4),
                'classification': classification,
                'valid_pixels': len(valid_data),
                'statistics': {
                    'mean': round(gwqi_mean, 4),
                    'std': round(np.std(valid_data), 4),
                    'min': round(np.min(valid_data), 4),
                    'max': round(np.max(valid_data), 4)
                },
                'distribution': {
                    'excellent': int(excellent_count),
                    'good': int(good_count),
                    'fair': int(fair_count),
                    'poor': int(poor_count),
                    'very_poor': int(very_poor_count)
                },
                'percentages': {
                    'excellent': round((excellent_count / len(valid_data)) * 100, 1),
                    'good': round((good_count / len(valid_data)) * 100, 1),
                    'fair': round((fair_count / len(valid_data)) * 100, 1),
                    'poor': round((poor_count / len(valid_data)) * 100, 1),
                    'very_poor': round((very_poor_count / len(valid_data)) * 100, 1)
                },
                'area_distribution_km2': {
                    'excellent': round(excellent_count * pixel_area_km2, 2),
                    'good': round(good_count * pixel_area_km2, 2),
                    'fair': round(fair_count * pixel_area_km2, 2),
                    'poor': round(poor_count * pixel_area_km2, 2),
                    'very_poor': round(very_poor_count * pixel_area_km2, 2),
                    'total_area': round(len(valid_data) * pixel_area_km2, 2)
                }
            }

        except Exception as e:
            print(f"[ERROR] GWQI statistics error: {str(e)}")
            traceback.print_exc()
            return {'gwqi_score': 0, 'classification': 'Calculation Error', 'valid_pixels': 0}

    def create_gwqi_colored_raster(self, gwqi_data):
        """Create colored raster for GWQI (0-1 scale)"""
        colors = ['#d73027', '#fc8d59', '#fee08b', '#99d594', '#3288bd']
        breaks = np.array([0, 0.2, 0.4, 0.6, 0.8, 1.0])
        
        colored_image = np.zeros((*gwqi_data.shape, 3), dtype=np.uint8)

        for i in range(len(breaks) - 1):
            if i == len(breaks) - 2:
                mask = (gwqi_data >= breaks[i]) & (gwqi_data <= breaks[i + 1]) & ~np.isnan(gwqi_data)
            else:
                mask = (gwqi_data >= breaks[i]) & (gwqi_data < breaks[i + 1]) & ~np.isnan(gwqi_data)

            if np.any(mask):
                hex_color = colors[i].lstrip('#')
                rgb = tuple(int(hex_color[j:j+2], 16) for j in (0, 2, 4))
                colored_image[mask] = rgb

        nan_mask = np.isnan(gwqi_data)
        colored_image[nan_mask] = [0, 0, 0]

        labels = ['Very Poor (0-0.2)', 'Poor (0.2-0.4)', 'Fair (0.4-0.6)', 'Good (0.6-0.8)', 'Excellent (0.8-1.0)']
        
        return colored_image, breaks, colors, labels

    def create_workspace(self):
        """Create GeoServer workspace"""
        url = f"{GEOSERVER_URL}/workspaces"
        headers = {"Content-Type": "text/xml"}
        data = f"<workspace><name>{WORKSPACE}</name></workspace>"

        try:
            check_url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}"
            check_response = requests.get(
                check_url,
                auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                timeout=10
            )

            if check_response.status_code == 200:
                return True

            response = requests.post(
                url,
                auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                headers=headers,
                data=data,
                timeout=10
            )

            return response.status_code in [201, 409]

        except Exception as e:
            return False

    def publish_geotiff(self, tiff_path, store_name):
        """Publish GeoTIFF to GeoServer"""
        upload_url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores/{store_name}/file.geotiff"
        headers = {"Content-type": "image/tiff"}

        try:
            with open(tiff_path, 'rb') as f:
                upload_response = requests.put(
                    upload_url,
                    auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                    headers=headers,
                    data=f,
                    timeout=60
                )

            return upload_response.status_code in [200, 201, 202]

        except Exception as e:
            return False

    def calculate_analysis_statistics(self, analysis_results):
        """Calculate statistics for analysis results"""
        try:
            ci_stats = {}
            for param, ci_data in analysis_results['ci_maps'].items():
                valid_data = ci_data[~np.isnan(ci_data)]
                if len(valid_data) > 0:
                    ci_stats[param] = {
                        'mean': float(np.mean(valid_data)),
                        'min': float(np.min(valid_data)),
                        'max': float(np.max(valid_data)),
                        'valid_pixels': int(len(valid_data))
                    }

            return {
                'ci_statistics': ci_stats,
                'weights': analysis_results['weights'],
                'total_parameters': len(analysis_results['ci_maps'])
            }

        except Exception as e:
            return {}

    def _calculate_robust_p_statistics(self, p_array, param_name):
        """Calculate robust P statistics"""
        try:
            if p_array is None:
                return {'mean': None, 'min': None, 'max': None, 'std': None, 'valid_pixels': 0}
                
            valid_p_mask = (~np.isnan(p_array) & np.isfinite(p_array) & (p_array > 0) & (p_array < 1e10))
            valid_p = p_array[valid_p_mask]
            
            if len(valid_p) == 0:
                return {'mean': None, 'min': None, 'max': None, 'std': None, 'valid_pixels': 0}
            
            return {
                'mean': self._safe_float(np.mean(valid_p)),
                'min': self._safe_float(np.min(valid_p)),
                'max': self._safe_float(np.max(valid_p)),
                'std': self._safe_float(np.std(valid_p)),
                'valid_pixels': int(len(valid_p))
            }
            
        except Exception as e:
            return {'mean': None, 'min': None, 'max': None, 'std': None, 'valid_pixels': 0}

    def _calculate_robust_ci_statistics(self, ci_array, param_name):
        """Calculate robust CI statistics"""
        try:
            if ci_array is None:
                return {'mean': None, 'min': None, 'max': None, 'std': None, 'valid_pixels': 0}
            
            valid_ci_mask = (~np.isnan(ci_array) & np.isfinite(ci_array) & (ci_array >= -1) & (ci_array <= 1))
            valid_ci = ci_array[valid_ci_mask]
            
            if len(valid_ci) == 0:
                return {'mean': None, 'min': None, 'max': None, 'std': None, 'valid_pixels': 0}
            
            return {
                'mean': self._safe_float(np.mean(valid_ci)),
                'min': self._safe_float(np.min(valid_ci)),
                'max': self._safe_float(np.max(valid_ci)),
                'std': self._safe_float(np.std(valid_ci)),
                'valid_pixels': int(len(valid_ci))
            }
            
        except Exception as e:
            return {'mean': None, 'min': None, 'max': None, 'std': None, 'valid_pixels': 0}

    def _calculate_robust_rank_statistics(self, rank_array, param_name):
        """Calculate robust Rank statistics"""
        try:
            if rank_array is None:
                return {'mean': None, 'min': None, 'max': None, 'std': None, 'valid_pixels': 0}
            
            valid_rank_mask = (~np.isnan(rank_array) & np.isfinite(rank_array) & (rank_array >= 1) & (rank_array <= 10))
            valid_rank = rank_array[valid_rank_mask]
            
            if len(valid_rank) == 0:
                return {'mean': None, 'min': None, 'max': None, 'std': None, 'valid_pixels': 0}
            
            return {
                'mean': self._safe_float(np.mean(valid_rank)),
                'min': self._safe_float(np.min(valid_rank)),
                'max': self._safe_float(np.max(valid_rank)),
                'std': self._safe_float(np.std(valid_rank)),
                'valid_pixels': int(len(valid_rank))
            }
            
        except Exception as e:
            return {'mean': None, 'min': None, 'max': None, 'std': None, 'valid_pixels': 0}

    def create_gwqi_overlay(self, request):
        """Fallback method for non-unified mode"""
        return self.generate_unified_gwqi_with_session(request, self.session_id)