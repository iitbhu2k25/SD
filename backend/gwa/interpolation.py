from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from .models import Well
import numpy as np
from scipy.interpolate import Rbf, griddata
from scipy.spatial.distance import cdist
import rasterio
from rasterio.transform import from_origin
from rasterio.mask import mask
from rasterio.warp import calculate_default_transform, reproject, Resampling
from rasterio.features import shapes
import os
import tempfile
from rest_framework.permissions import AllowAny
import requests
from pathlib import Path
import geopandas as gpd
import uuid
from shapely.geometry import mapping, shape, Point, LineString, Polygon
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
import matplotlib.colors as mcolors
import json
import fiona
from skimage import measure
import cv2
import pandas as pd

# GeoServer configuration
GEOSERVER_URL = "http://geoserver2:8080/geoserver/rest"
GEOSERVER_USER = "admin"
GEOSERVER_PASSWORD = "geoserver2"
WORKSPACE = "myworkspace"
TEMP_DIR = Path("media/temp")

# Path to shapefiles
VILLAGES_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                            'media', 'gwa_data', 'gwa_shp', 'Final_Village', 'Village.shp')

class InterpolateRasterView(APIView):
    permission_classes = [AllowAny]

    def generate_contours_as_geojson(self, raster_path, contour_interval=None, smooth=True):
        """
        Generate contour lines from a raster file and return as GeoJSON
        
        Parameters:
        - raster_path: Path to the input raster file
        - contour_interval: Interval between contour lines in meters (e.g., 5, 10, 20)
        - smooth: Whether to smooth the contours
        
        Returns:
        - GeoJSON dictionary with contour features
        """
        print(f"[DEBUG] Generating contours as GeoJSON from raster: {raster_path}")
        print(f"[DEBUG] Contour interval: {contour_interval} meters")
        
        try:
            with rasterio.open(raster_path) as src:
                # Read the raster data
                data = src.read(1)
                transform = src.transform
                crs = src.crs
                
                # Get data statistics
                valid_data = data[~np.isnan(data)]
                if len(valid_data) == 0:
                    print("[ERROR] No valid data in raster for contour generation")
                    return None
                
                data_min, data_max = np.nanmin(data), np.nanmax(data)
                print(f"[DEBUG] Raster data range: {data_min:.3f} to {data_max:.3f}")
                
                # Generate contour levels based on interval
                if contour_interval is None or contour_interval <= 0:
                    # Auto-generate 10 contour levels if no interval specified
                    contour_levels = np.linspace(data_min, data_max, 11)[1:-1]  # Exclude min and max
                    print(f"[DEBUG] Auto-generated contour levels: {len(contour_levels)} levels")
                else:
                    # Generate levels based on specified interval
                    # Start from the nearest interval above data_min
                    start_level = np.ceil(data_min / contour_interval) * contour_interval
                    # End at the nearest interval below data_max
                    end_level = np.floor(data_max / contour_interval) * contour_interval
                    
                    if start_level <= end_level:
                        contour_levels = np.arange(start_level, end_level + contour_interval, contour_interval)
                    else:
                        # If interval is too large, create at least one contour at the mean
                        contour_levels = np.array([np.nanmean(data)])
                    
                    print(f"[DEBUG] Generated {len(contour_levels)} contour levels with {contour_interval}m interval")
                    print(f"[DEBUG] Contour levels: {contour_levels}")
                
                # Replace NaN values with a value outside the data range for contour generation
                data_for_contour = data.copy()
                data_for_contour[np.isnan(data)] = data_min - 1000
                
                # Generate contours using skimage measure.find_contours
                geojson_features = []
                contour_statistics = {
                    'total_contours': 0,
                    'contour_levels': [],
                    'elevation_range': {
                        'min': float(data_min),
                        'max': float(data_max)
                    },
                    'contour_interval': contour_interval
                }
                
                for level in contour_levels:
                    try:
                        # Find contours at this level
                        contours = measure.find_contours(data_for_contour, level)
                        
                        for contour_idx, contour in enumerate(contours):
                            if len(contour) < 3:  # Skip very small contours
                                continue
                            
                            # Convert pixel coordinates to geographic coordinates
                            contour_coords = []
                            for point in contour:
                                # Convert from array indices to geographic coordinates
                                row, col = point[0], point[1]
                                x, y = rasterio.transform.xy(transform, row, col)
                                contour_coords.append([x, y])  # GeoJSON format [lng, lat]
                            
                            # Close the contour if it's not already closed
                            if len(contour_coords) > 2 and contour_coords[0] != contour_coords[-1]:
                                contour_coords.append(contour_coords[0])
                            
                            # Apply smoothing if requested
                            if smooth and len(contour_coords) > 4:
                                contour_coords = self.smooth_contour_coordinates(contour_coords)
                            
                            # Create GeoJSON feature
                            if len(contour_coords) >= 2:
                                feature = {
                                    "type": "Feature",
                                    "geometry": {
                                        "type": "LineString",
                                        "coordinates": contour_coords
                                    },
                                    "properties": {
                                        "level": float(level),
                                        "elevation": float(level),
                                        "contour_id": f"contour_{level}_{contour_idx}",
                                        "interval": contour_interval
                                    }
                                }
                                geojson_features.append(feature)
                                contour_statistics['total_contours'] += 1
                    
                    except Exception as e:
                        print(f"[WARNING] Failed to generate contour at level {level}: {str(e)}")
                        continue
                
                # Update statistics
                if geojson_features:
                    levels = [f['properties']['level'] for f in geojson_features]
                    contour_statistics['contour_levels'] = sorted(list(set(levels)))
                
                if not geojson_features:
                    print("[WARNING] No contours generated")
                    return None
                
                print(f"[DEBUG] Generated {len(geojson_features)} contour features")
                
                # Create GeoJSON FeatureCollection
                geojson_data = {
                    "type": "FeatureCollection",
                    "crs": {
                        "type": "name",
                        "properties": {
                            "name": str(crs)
                        }
                    },
                    "features": geojson_features,
                    "properties": {
                        "statistics": contour_statistics,
                        "generated_from": str(raster_path.name),
                        "generation_method": "skimage_find_contours"
                    }
                }
                
                return geojson_data
                
        except Exception as e:
            print(f"[ERROR] Contour generation error: {str(e)}")
            return None

    def smooth_contour_coordinates(self, coords, window_size=3):
        """
        Apply simple moving average smoothing to contour coordinates in GeoJSON format
        """
        if len(coords) < window_size:
            return coords
        
        smoothed = []
        for i in range(len(coords)):
            if i < window_size // 2 or i >= len(coords) - window_size // 2:
                # Keep original coordinates at the ends
                smoothed.append(coords[i])
            else:
                # Apply moving average
                x_sum = sum(coords[j][0] for j in range(i - window_size//2, i + window_size//2 + 1))
                y_sum = sum(coords[j][1] for j in range(i - window_size//2, i + window_size//2 + 1))
                smoothed.append([x_sum / window_size, y_sum / window_size])
        
        return smoothed

    def publish_shapefile_to_geoserver(self, shp_path, store_name):
        """
        Publish shapefile to GeoServer as a vector layer
        """
        print(f"[DEBUG] Publishing shapefile to GeoServer: {shp_path}")
        
        try:
            # Create a ZIP file containing all shapefile components
            import zipfile
            
            zip_path = shp_path.parent / f"{shp_path.stem}.zip"
            
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                # Add all shapefile components
                for ext in ['.shp', '.shx', '.dbf', '.prj', '.cpg']:
                    file_path = shp_path.with_suffix(ext)
                    if file_path.exists():
                        zipf.write(file_path, file_path.name)
            
            # Upload to GeoServer
            upload_url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/datastores/{store_name}/file.shp"
            headers = {"Content-type": "application/zip"}
            
            with open(zip_path, 'rb') as f:
                upload_response = requests.put(
                    upload_url,
                    auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                    headers=headers,
                    data=f,
                    timeout=30
                )
            
            print(f"[DEBUG] Shapefile upload response: {upload_response.status_code} - {upload_response.text}")
            
            # Clean up ZIP file
            os.remove(zip_path)
            
            if upload_response.status_code in [200, 201, 202]:
                print(f"[✓] Shapefile published successfully as: {store_name}")
                return True
            else:
                print(f"[ERROR] Shapefile upload failed: {upload_response.status_code}")
                return False
                
        except Exception as e:
            print(f"[ERROR] Shapefile publish error: {str(e)}")
            return False
    
    def idw_interpolation(self, points, values, grid_x, grid_y, power=2, radius=None):
        """
        Improved Inverse Distance Weighting interpolation
        """
        print(f"[DEBUG] Performing IDW interpolation with power={power}")
        
        # Create grid points
        xi, yi = np.meshgrid(grid_x, grid_y)
        grid_points = np.column_stack([xi.ravel(), yi.ravel()])
        
        # Calculate distances between grid points and data points
        distances = cdist(grid_points, points)
        
        # Apply radius filter if specified
        if radius:
            mask = distances > radius
            distances[mask] = np.inf
        
        # Avoid division by zero for points that are exactly at data locations
        distances[distances == 0] = 1e-10
        
        # Calculate weights
        weights = 1.0 / (distances ** power)
        
        # Handle infinite weights (points too far away)
        weights[np.isinf(weights)] = 0
        
        # Normalize weights
        weights_sum = np.sum(weights, axis=1)
        weights_sum[weights_sum == 0] = 1  # Avoid division by zero
        
        # Calculate interpolated values
        interpolated = np.sum(weights * values[np.newaxis, :], axis=1) / weights_sum
        
        # Reshape to grid
        return interpolated.reshape(xi.shape)

    def kriging_interpolation(self, points, values, grid_x, grid_y):
        """
        Improved Kriging-like interpolation using RBF with optimal parameters
        """
        print(f"[DEBUG] Performing Kriging-like interpolation using RBF")
        
        # Use different RBF functions based on data characteristics
        data_range = np.max(values) - np.min(values)
        data_std = np.std(values)
        
        # Choose epsilon based on data spread
        epsilon = data_std / 10 if data_std > 0 else 1
        
        try:
            # Try multiquadric first (often works well for geological data)
            rbf = Rbf(points[:, 0], points[:, 1], values, 
                     function='multiquadric', epsilon=epsilon, smooth=0.1)
            xi, yi = np.meshgrid(grid_x, grid_y)
            zi = rbf(xi, yi)
            print(f"[DEBUG] Successfully used multiquadric RBF")
            return zi
        except:
            try:
                # Fallback to gaussian
                rbf = Rbf(points[:, 0], points[:, 1], values, 
                         function='gaussian', epsilon=epsilon, smooth=0.1)
                xi, yi = np.meshgrid(grid_x, grid_y)
                zi = rbf(xi, yi)
                print(f"[DEBUG] Successfully used gaussian RBF")
                return zi
            except:
                # Final fallback to linear
                rbf = Rbf(points[:, 0], points[:, 1], values, 
                         function='linear', smooth=0.1)
                xi, yi = np.meshgrid(grid_x, grid_y)
                zi = rbf(xi, yi)
                print(f"[DEBUG] Successfully used linear RBF")
                return zi

    def spline_interpolation(self, points, values, grid_x, grid_y):
        """
        Improved Spline interpolation using scipy.interpolate.griddata
        """
        print(f"[DEBUG] Performing Spline interpolation using griddata")
        
        xi, yi = np.meshgrid(grid_x, grid_y)
        
        # Try cubic first, then linear if it fails
        try:
            zi = griddata(points, values, (xi, yi), method='cubic', fill_value=np.nan)
            print(f"[DEBUG] Successfully used cubic interpolation")
            
            # If too many NaN values, try linear
            nan_percentage = np.sum(np.isnan(zi)) / zi.size * 100
            if nan_percentage > 50:
                print(f"[DEBUG] Too many NaN values ({nan_percentage:.1f}%), trying linear")
                zi = griddata(points, values, (xi, yi), method='linear', fill_value=np.nan)
                print(f"[DEBUG] Successfully used linear interpolation")
                
        except:
            # Fallback to linear
            zi = griddata(points, values, (xi, yi), method='linear', fill_value=np.nan)
            print(f"[DEBUG] Successfully used linear interpolation (fallback)")
        
        return zi

    def get_arcmap_colors(self, parameter, data_type=None):
        """
        Get ArcMap-style color schemes based on parameter type
        """
        if parameter == 'gwl' or (parameter == 'RL' and data_type in ['PRE', 'POST']):
            # Blue to Red scheme for groundwater levels (deep blue = high water table, red = low water table)
            colors = [
                '#08306b',  # Dark blue (high groundwater)
                '#2171b5',  # Medium blue
                '#6baed6',  # Light blue
                '#c6dbef',  # Very light blue
                '#fee0d2',  # Very light orange
                '#fc9272',  # Light orange
                '#de2d26',  # Medium red
                '#a50f15'   # Dark red (low groundwater)
            ]
            labels = ['Very High', 'High', 'Moderately High', 'Moderate', 
                     'Moderately Low', 'Low', 'Very Low', 'Extremely Low']
        
        elif parameter == 'RL':
            # Elevation color scheme (green to brown)
            colors = [
                '#00441b',  # Dark green (low elevation)
                '#238b45',  # Medium green
                '#74c476',  # Light green
                '#bae4b3',  # Very light green
                '#edf8e9',  # Almost white
                '#fee6ce',  # Light orange
                '#fd8d3c',  # Orange
                '#d94701',  # Dark orange
                '#8c2d04'   # Brown (high elevation)
            ]
            labels = ['Very Low', 'Low', 'Moderately Low', 'Moderate',
                     'Moderately High', 'High', 'Very High', 'Extremely High', 'Peak']
        
        else:
            # Default scheme
            colors = [
                '#313695', '#4575b4', '#74add1', '#abd9e9',
                '#e0f3f8', '#fee090', '#fdae61', '#f46d43', '#d73027'
            ]
            labels = ['Level 1', 'Level 2', 'Level 3', 'Level 4',
                     'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Level 9']
        
        return colors, labels

    def create_colored_raster(self, data, colors, num_classes=8):
        """
        Create a colored raster using ArcMap-style classification
        """
        print(f"[DEBUG] Creating colored raster with {num_classes} classes")
        
        # Remove NaN values for classification
        valid_data = data[~np.isnan(data)]
        if len(valid_data) == 0:
            print("[ERROR] No valid data for classification")
            return np.zeros((*data.shape, 3), dtype=np.uint8)
        
        # Use quantile-based classification (similar to ArcMap's Natural Breaks)
        percentiles = np.linspace(0, 100, num_classes + 1)
        breaks = np.percentile(valid_data, percentiles)
        
        # Ensure unique breaks
        breaks = np.unique(breaks)
        if len(breaks) < 2:
            # If all values are the same, create artificial breaks
            data_min, data_max = np.min(valid_data), np.max(valid_data)
            if data_min == data_max:
                breaks = np.array([data_min - 0.1, data_max + 0.1])
            else:
                breaks = np.linspace(data_min, data_max, num_classes + 1)
        
        print(f"[DEBUG] Classification breaks: {breaks}")
        
        # Adjust colors list to match number of breaks
        if len(colors) > len(breaks) - 1:
            colors = colors[:len(breaks) - 1]
        elif len(colors) < len(breaks) - 1:
            # Interpolate colors if we need more
            from matplotlib.colors import LinearSegmentedColormap
            cmap = LinearSegmentedColormap.from_list("custom", colors, N=len(breaks) - 1)
            colors = [mcolors.to_hex(cmap(i / (len(breaks) - 2))) for i in range(len(breaks) - 1)]
        
        # Create colored image
        colored_image = np.zeros((*data.shape, 3), dtype=np.uint8)
        
        for i in range(len(breaks) - 1):
            if i == len(breaks) - 2:  # Last class includes maximum value
                mask = (data >= breaks[i]) & (data <= breaks[i + 1])
            else:
                mask = (data >= breaks[i]) & (data < breaks[i + 1])
            
            # Convert hex color to RGB
            hex_color = colors[i].lstrip('#')
            rgb = tuple(int(hex_color[j:j+2], 16) for j in (0, 2, 4))
            
            colored_image[mask] = rgb
        
        # Set NaN areas to black (or transparent)
        nan_mask = np.isnan(data)
        colored_image[nan_mask] = [0, 0, 0]  # Black for no-data areas
        
        return colored_image, breaks

    def create_workspace(self):
        """Create GeoServer workspace if it doesn't exist."""
        url = f"{GEOSERVER_URL}/workspaces"
        headers = {"Content-Type": "text/xml"}
        data = f"<workspace><name>{WORKSPACE}</name></workspace>"
        
        try:
            check_url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}"
            print(f"[DEBUG] Checking workspace: {check_url}")
            check_response = requests.get(
                check_url,
                auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                timeout=10
            )
            print(f"[DEBUG] Workspace check response: {check_response.status_code}")
            
            if check_response.status_code == 200:
                print(f"[✓] Workspace '{WORKSPACE}' already exists.")
                return True
            
            print(f"[DEBUG] Creating workspace: {url}")
            response = requests.post(
                url,
                auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                headers=headers,
                data=data,
                timeout=10
            )
            print(f"[DEBUG] Workspace creation response: {response.status_code} - {response.text}")
            
            if response.status_code in [201, 409]:
                print(f"[✓] Workspace '{WORKSPACE}' created or already exists.")
                return True
            
            print(f"[ERROR] Failed to create workspace: {response.status_code} - {response.text}")
            return False
            
        except requests.exceptions.RequestException as e:
            print(f"[ERROR] Workspace creation error: {str(e)}")
            return False

    def publish_geotiff(self, tiff_path, store_name):
        """Publish GeoTIFF to GeoServer."""
        upload_url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores/{store_name}/file.geotiff"
        headers = {"Content-type": "image/tiff"}
        
        try:
            print(f"[DEBUG] Uploading GeoTIFF to: {upload_url}")
            with open(tiff_path, 'rb') as f:
                upload_response = requests.put(
                    upload_url,
                    auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                    headers=headers,
                    data=f,
                    timeout=30
                )
            
            print(f"[DEBUG] GeoTIFF upload response: {upload_response.status_code} - {upload_response.text}")
            
            if upload_response.status_code not in [200, 201, 202]:
                print(f"[ERROR] GeoTIFF upload failed: {upload_response.status_code}")
                return False
            
            print(f"[✓] GeoTIFF uploaded successfully")
            
            # Check if coverage exists
            check_coverage_url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores/{store_name}/coverages/{store_name}"
            check_response = requests.get(
                check_coverage_url,
                auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                timeout=10
            )
            
            print(f"[DEBUG] Coverage check response: {check_response.status_code}")
            
            if check_response.status_code == 200:
                print(f"[✓] Coverage layer already exists or was auto-created")
            else:
                print(f"[DEBUG] Creating coverage layer manually")
                layer_url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores/{store_name}/coverages"
                layer_data = f"""<?xml version="1.0" encoding="UTF-8"?>
                <coverage>
                    <name>{store_name}</name>
                    <nativeName>{store_name}</nativeName>
                    <title>{store_name}</title>
                    <srs>EPSG:32644</srs>
                    <enabled>true</enabled>
                </coverage>"""
                
                layer_response = requests.post(
                    layer_url,
                    auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                    headers={"Content-Type": "text/xml"},
                    data=layer_data,
                    timeout=10
                )
                
                print(f"[DEBUG] Layer creation response: {layer_response.status_code} - {layer_response.text}")
                
                if layer_response.status_code not in [200, 201, 202]:
                    print(f"[WARNING] Layer creation failed: {layer_response.status_code}")
                    return True
            
            return True
                
        except Exception as e:
            print(f"[ERROR] GeoTIFF publish error: {str(e)}")
            return False

    def post(self, request):
        print("[DEBUG] POST request received")
        print(f"[DEBUG] Using GeoServer URL: {GEOSERVER_URL}")
        
        try:
            TEMP_DIR.mkdir(parents=True, exist_ok=True)

            data = request.data
            method = data.get('method')
            parameter = data.get('parameter')
            village_ids = data.get('village_ids')
            place = data.get('place')
            csv_file = data.get('csv_file')  # New: CSV file name from frontend
            create_colored = data.get('create_colored', True)
            contour_interval = data.get('contour_interval', None)  # in meters
            generate_contours = data.get('generate_contours', False)  # boolean flag
            
            print(f"[DEBUG] Contour generation: {generate_contours}")
            if generate_contours and contour_interval:
                print(f"[DEBUG] Contour interval: {contour_interval} meters")

            # Validate required fields
            if not all([method, parameter, csv_file]):
                return Response(
                    {'error': 'Missing required fields: method, parameter, csv_file'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate contour interval if contour generation is requested
            if generate_contours and contour_interval is not None:
                try:
                    contour_interval = float(contour_interval)
                    if contour_interval <= 0:
                        return Response(
                            {'error': 'Contour interval must be a positive number'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                except (ValueError, TypeError):
                    return Response(
                        {'error': 'Invalid contour interval format'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Validate interpolation method
            if method not in ['idw', 'kriging', 'spline']:
                return Response(
                    {'error': 'Invalid interpolation method. Must be idw, kriging, or spline'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate village_ids and place parameters
            if not village_ids or not place:
                return Response(
                    {'error': 'village_ids and place parameters are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if place not in ['village', 'subdistrict']:
                return Response(
                    {'error': 'Invalid place parameter. Must be village or subdistrict'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not isinstance(village_ids, list):
                return Response(
                    {'error': 'village_ids parameter must be a list of IDs'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Load CSV file
            csv_path = TEMP_DIR / csv_file
            print(f"[DEBUG] Loading CSV file: {csv_path}")
            if not csv_path.exists():
                return Response(
                    {'error': f'CSV file not found: {csv_path}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                df = pd.read_csv(csv_path)
                print(f"[DEBUG] CSV file loaded with {len(df)} rows")
            except Exception as e:
                return Response(
                    {'error': f'Failed to read CSV file: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate required columns
            required_columns = ['LONGITUDE', 'LATITUDE', parameter]
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return Response(
                    {'error': f'Missing required columns in CSV: {", ".join(missing_columns)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Extract data from CSV
            df = df.dropna(subset=required_columns)  # Drop rows with NaN in required columns
            if df.empty:
                return Response(
                    {'error': 'No valid data in CSV after removing rows with missing values'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            x = df['LONGITUDE'].values
            y = df['LATITUDE'].values
            z = df[parameter].values

            print(f"[DEBUG] Processing {len(x)} data points for interpolation")
            print(f"[DEBUG] Data range: min={np.min(z):.3f}, max={np.max(z):.3f}, mean={np.mean(z):.3f}")

            # Set store name based on CSV file name and parameter
            csv_name = Path(csv_file).stem
            store_name = f"interpolated_raster_{csv_name}_{parameter.replace(' ', '_')}"
            print(f"[DEBUG] GeoServer store name: {store_name}")

            # Load and filter village shapefile based on selected area
            try:
                villages_vector = gpd.read_file(VILLAGES_PATH)
                print(f"[DEBUG] Shapefile CRS: {villages_vector.crs}")
                print(f"[DEBUG] Shapefile bounds: {villages_vector.total_bounds}")

                # Validate geometries
                invalid_geoms = villages_vector[~villages_vector.geometry.is_valid]
                if not invalid_geoms.empty:
                    print(f"[DEBUG] Found {len(invalid_geoms)} invalid geometries. Attempting to fix.")
                    villages_vector['geometry'] = villages_vector.geometry.buffer(0)
                
                # Set CRS if undefined, assuming it's in EPSG:4326
                if villages_vector.crs is None:
                    print("[DEBUG] Shapefile CRS is None, setting to EPSG:4326")
                    villages_vector.set_crs("EPSG:4326", inplace=True)
                
                # Transform shapefile to EPSG:4326 if needed for initial processing
                if villages_vector.crs != "EPSG:4326":
                    print(f"[DEBUG] Transforming shapefile from {villages_vector.crs} to EPSG:4326")
                    villages_vector = villages_vector.to_crs("EPSG:4326")
                
                # Filter based on place and village_ids
                if place == "village":
                    village_ids = [float(x) for x in village_ids]
                    print(f"[DEBUG] Filtering villages with village_co in {village_ids}")
                    selected_area = villages_vector[villages_vector['village_co'].isin(village_ids)]
                elif place == "subdistrict":
                    village_ids = [int(x) for x in village_ids]
                    print(f"[DEBUG] Filtering subdistricts with SUBDIS_COD in {village_ids}")
                    selected_area = villages_vector[villages_vector['SUBDIS_COD'].isin(village_ids)]
                
                # Check if filtered shapefile is empty
                if selected_area.empty:
                    raise ValueError(f"No {place}s found for the provided IDs: {village_ids}")
                
                print(f"[DEBUG] Selected area bounds: {selected_area.total_bounds}")
                
                # Transform selected area to UTM Zone 44N (EPSG:32644) for final processing
                selected_area_utm = selected_area.to_crs("EPSG:32644")
                print(f"[DEBUG] Selected area UTM bounds: {selected_area_utm.total_bounds}")
                
            except Exception as e:
                return Response(
                    {'error': f'Failed to load or filter village shapefile: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Use ALL data points for interpolation (no filtering by area)
            print(f"[DEBUG] Using all {len(x)} data points for interpolation")

            # Define grid that covers BOTH data points and selected villages to ensure proper coverage
            grid_resolution = 0.001  # In degrees for WGS84 (approximately 100m)
            
            # Get bounds from data points
            x_min_data, x_max_data = np.min(x), np.max(x)
            y_min_data, y_max_data = np.min(y), np.max(y)
            
            # Get bounds from selected villages (in WGS84)
            village_x_min, village_y_min, village_x_max, village_y_max = selected_area.total_bounds
            
            # Use the union of both bounds to ensure complete coverage
            x_min = min(x_min_data, village_x_min) - 0.01  # Add buffer
            x_max = max(x_max_data, village_x_max) + 0.01
            y_min = min(y_min_data, village_y_min) - 0.01
            y_max = max(y_max_data, village_y_max) + 0.01
            
            print(f"[DEBUG] Interpolation grid bounds: x({x_min:.4f}, {x_max:.4f}), y({y_min:.4f}, {y_max:.4f})")
            print(f"[DEBUG] Selected villages bounds: x({village_x_min:.4f}, {village_x_max:.4f}), y({village_y_min:.4f}, {village_y_max:.4f})")
            
            x_grid = np.arange(x_min, x_max, grid_resolution)
            y_grid = np.arange(y_min, y_max, grid_resolution)
            
            print(f"[DEBUG] Grid dimensions: {len(x_grid)} x {len(y_grid)} = {len(x_grid) * len(y_grid)} points")

            # Perform interpolation based on method
            points = np.column_stack((x, y))
            
            if method == 'idw':
                Z = self.idw_interpolation(points, z, x_grid, y_grid, power=2)
            elif method == 'kriging':
                Z = self.kriging_interpolation(points, z, x_grid, y_grid)
            else:  # spline
                Z = self.spline_interpolation(points, z, x_grid, y_grid)

            print(f"[DEBUG] Interpolation completed. Grid size: {Z.shape}")

            # Handle NaN values and get data statistics
            z_min, z_max = np.nanmin(Z), np.nanmax(Z)
            z_mean, z_std = np.nanmean(Z), np.nanstd(Z)
            nan_percentage = np.sum(np.isnan(Z)) / Z.size * 100
            print(f"[DEBUG] Interpolated data - min={z_min:.3f}, max={z_max:.3f}, mean={z_mean:.3f}, std={z_std:.3f}")
            print(f"[DEBUG] NaN values: {nan_percentage:.1f}%")

            # Create both single-band and colored rasters
            if create_colored:
                # Get ArcMap-style colors for this parameter
                colors, labels = self.get_arcmap_colors(parameter)
                colored_grid, classification_breaks = self.create_colored_raster(Z, colors, num_classes=len(colors))
                print(f"[DEBUG] Created colored raster with shape: {colored_grid.shape}")

            # Create initial single-band GeoTIFF in WGS84
            initial_tiff_path = TEMP_DIR / f"{store_name}_initial_wgs84.tif"
            transform = from_origin(x_min, y_max, grid_resolution, grid_resolution)
            
            print(f"[DEBUG] Creating initial single-band GeoTIFF in WGS84: {initial_tiff_path}")
            with rasterio.open(
                initial_tiff_path,
                'w',
                driver='GTiff',
                height=Z.shape[0],
                width=Z.shape[1],
                count=1,  # Single band
                dtype=rasterio.float32,
                crs='EPSG:4326',
                transform=transform,
                nodata=np.nan
            ) as dst:
                dst.write(Z.astype(rasterio.float32), 1)

            # Create colored raster if requested
            if create_colored:
                colored_tiff_path = TEMP_DIR / f"{store_name}_colored_wgs84.tif"
                print(f"[DEBUG] Creating colored GeoTIFF in WGS84: {colored_tiff_path}")
                with rasterio.open(
                    colored_tiff_path,
                    'w',
                    driver='GTiff',
                    height=colored_grid.shape[0],
                    width=colored_grid.shape[1],
                    count=3,  # RGB bands
                    dtype=rasterio.uint8,
                    crs='EPSG:4326',
                    transform=transform,
                    nodata=0
                ) as dst:
                    for i in range(3):
                        dst.write(colored_grid[:, :, i], i + 1)

            # Mask to selected area shapefile (clip the interpolated raster to villages)
            masked_tiff_path = TEMP_DIR / f"{store_name}_masked_wgs84.tif"
            if create_colored:
                masked_colored_path = TEMP_DIR / f"{store_name}_colored_masked_wgs84.tif"
            
            try:
                with rasterio.open(initial_tiff_path) as src:
                    print(f"[DEBUG] Source raster bounds: {src.bounds}")
                    print(f"[DEBUG] Source raster shape: {src.shape}")
                    
                    # Create a unified geometry from all selected villages
                    from shapely.ops import unary_union
                    
                    # Ensure all geometries are valid
                    valid_geometries = []
                    for idx, geom in enumerate(selected_area.geometry):
                        if geom.is_valid:
                            valid_geometries.append(geom)
                        else:
                            print(f"[DEBUG] Village {idx+1} geometry is invalid, attempting to fix")
                            fixed_geom = geom.buffer(0)
                            if fixed_geom.is_valid:
                                valid_geometries.append(fixed_geom)
                                print(f"[DEBUG] Village {idx+1} geometry fixed successfully")
                            else:
                                print(f"[WARNING] Village {idx+1} geometry could not be fixed")
                    
                    if not valid_geometries:
                        raise ValueError("No valid geometries found for masking")
                    
                    print(f"[DEBUG] Using {len(valid_geometries)} valid geometries for masking")
                    
                    # Create union of all village geometries for better masking
                    if len(valid_geometries) > 1:
                        try:
                            unified_geometry = unary_union(valid_geometries)
                            if unified_geometry.is_valid:
                                mask_geometries = [unified_geometry]
                                print(f"[DEBUG] Created unified geometry for masking")
                            else:
                                mask_geometries = valid_geometries
                                print(f"[DEBUG] Using individual geometries for masking")
                        except Exception as e:
                            print(f"[WARNING] Failed to create unified geometry: {e}, using individual geometries")
                            mask_geometries = valid_geometries
                    else:
                        mask_geometries = valid_geometries
                    
                    # Perform masking for single-band raster
                    try:
                        out_image, out_transform = mask(
                            dataset=src,
                            shapes=mask_geometries,
                            crop=True,
                            nodata=np.nan,
                            all_touched=True,  # Include pixels that touch the geometry
                            invert=False
                        )
                        print(f"[DEBUG] Single-band masking successful, output shape: {out_image.shape}")
                    except ValueError as ve:
                        if "Input shapes do not overlap raster" in str(ve):
                            print(f"[ERROR] Villages do not overlap with raster. Raster bounds: {src.bounds}")
                            print(f"[ERROR] Village bounds: {selected_area.total_bounds}")
                            raise ValueError(f"Selected villages do not overlap with the interpolated raster area. Please check the village coordinates.")
                        else:
                            raise ve
                    
                    # Check if the output is not empty
                    if out_image.size == 0:
                        raise ValueError("Masking resulted in empty output. Villages may be outside the interpolation area.")
                    
                    out_meta = src.meta.copy()
                    out_meta.update({
                        "driver": "GTiff",
                        "height": out_image.shape[1],
                        "width": out_image.shape[2],
                        "transform": out_transform,
                        "nodata": np.nan
                    })
                    
                    with rasterio.open(masked_tiff_path, "w", **out_meta) as dest:
                        dest.write(out_image)
                    
                    print(f"[DEBUG] Village-masked single-band GeoTIFF saved to: {masked_tiff_path}")

                # Mask colored raster if created
                if create_colored:
                    with rasterio.open(colored_tiff_path) as src_colored:
                        out_image_colored, out_transform_colored = mask(
                            dataset=src_colored,
                            shapes=mask_geometries,
                            crop=True,
                            nodata=0,
                            all_touched=True,
                            invert=False
                        )
                        
                        out_meta_colored = src_colored.meta.copy()
                        out_meta_colored.update({
                            "driver": "GTiff",
                            "height": out_image_colored.shape[1],
                            "width": out_image_colored.shape[2],
                            "transform": out_transform_colored,
                            "nodata": 0
                        })
                        
                        with rasterio.open(masked_colored_path, "w", **out_meta_colored) as dest_colored:
                            dest_colored.write(out_image_colored)
                        
                        print(f"[DEBUG] Village-masked colored GeoTIFF saved to: {masked_colored_path}")
                
            except Exception as e:
                print(f"[ERROR] Village masking error: {str(e)}")
                try:
                    os.remove(initial_tiff_path)
                    if create_colored:
                        os.remove(colored_tiff_path)
                except Exception:
                    pass
                return Response(
                    {'error': f'Failed to mask raster to selected villages: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Project the masked rasters to UTM Zone 44N (EPSG:32644)
            final_tiff_path = TEMP_DIR / f"{store_name}_final_utm.tif"
            if create_colored:
                final_colored_path = TEMP_DIR / f"{store_name}_colored_final_utm.tif"
            
            try:
                # Project single-band raster
                with rasterio.open(masked_tiff_path) as src:
                    print(f"[DEBUG] Reprojecting single-band raster from {src.crs} to EPSG:32644")
                    
                    # Calculate the transform and dimensions for the output raster
                    dst_crs = 'EPSG:32644'
                    transform, width, height = calculate_default_transform(
                        src.crs, dst_crs, src.width, src.height, *src.bounds,
                        resolution=30  # 30 meter resolution in UTM for better detail
                    )
                    
                    # Set up the reprojected raster properties
                    kwargs = src.meta.copy()
                    kwargs.update({
                        'crs': dst_crs,
                        'transform': transform,
                        'width': width,
                        'height': height
                    })
                    
                    print(f"[DEBUG] Output UTM raster dimensions: {width}x{height}")
                    print(f"[DEBUG] Output UTM resolution: 30m")
                    
                    with rasterio.open(final_tiff_path, 'w', **kwargs) as dst:
                        # Reproject the raster
                        reproject(
                            source=rasterio.band(src, 1),
                            destination=rasterio.band(dst, 1),
                            src_transform=src.transform,
                            src_crs=src.crs,
                            dst_transform=transform,
                            dst_crs=dst_crs,
                            resampling=Resampling.bilinear,
                            dst_nodata=np.nan
                        )
                    
                    print(f"[DEBUG] UTM projected single-band GeoTIFF saved to: {final_tiff_path}")

                # Project colored raster if created
                if create_colored:
                    with rasterio.open(masked_colored_path) as src_colored:
                        print(f"[DEBUG] Reprojecting colored raster from {src_colored.crs} to EPSG:32644")
                        
                        # Calculate the transform and dimensions for the colored output raster
                        transform_colored, width_colored, height_colored = calculate_default_transform(
                            src_colored.crs, dst_crs, src_colored.width, src_colored.height, *src_colored.bounds,
                            resolution=30  # 30 meter resolution in UTM
                        )
                        
                        # Set up the reprojected colored raster properties
                        kwargs_colored = src_colored.meta.copy()
                        kwargs_colored.update({
                            'crs': dst_crs,
                            'transform': transform_colored,
                            'width': width_colored,
                            'height': height_colored
                        })
                        
                        with rasterio.open(final_colored_path, 'w', **kwargs_colored) as dst_colored:
                            # Reproject each RGB band
                            for i in range(3):
                                reproject(
                                    source=rasterio.band(src_colored, i + 1),
                                    destination=rasterio.band(dst_colored, i + 1),
                                    src_transform=src_colored.transform,
                                    src_crs=src_colored.crs,
                                    dst_transform=transform_colored,
                                    dst_crs=dst_crs,
                                    resampling=Resampling.nearest,  # Use nearest for colored raster to preserve colors
                                    dst_nodata=0
                                )
                        
                        print(f"[DEBUG] UTM projected colored GeoTIFF saved to: {final_colored_path}")
                    
                    # Log final raster properties
                    with rasterio.open(final_tiff_path) as final_raster:
                        print(f"[DEBUG] Final single-band raster CRS: {final_raster.crs}")
                        print(f"[DEBUG] Final single-band raster bounds: {final_raster.bounds}")
                        print(f"[DEBUG] Final single-band raster shape: {final_raster.shape}")
                        
                        # Check if raster has actual data
                        sample_data = final_raster.read(1)
                        valid_pixels = np.count_nonzero(~np.isnan(sample_data))
                        total_pixels = sample_data.size
                        print(f"[DEBUG] Final single-band raster contains {valid_pixels}/{total_pixels} valid pixels")
                        
                        if valid_pixels == 0:
                            print(f"[WARNING] Output raster contains no valid data pixels")
                
                if create_colored:
                    with rasterio.open(final_colored_path) as final_colored_raster:
                        print(f"[DEBUG] Final colored raster CRS: {final_colored_raster.crs}")
                        print(f"[DEBUG] Final colored raster bounds: {final_colored_raster.bounds}")
                        print(f"[DEBUG] Final colored raster shape: {final_colored_raster.shape}")
                
            except Exception as e:
                print(f"[ERROR] UTM reprojection error: {str(e)}")
                try:
                    os.remove(initial_tiff_path)
                    os.remove(masked_tiff_path)
                    if create_colored:
                        os.remove(colored_tiff_path)
                        os.remove(masked_colored_path)
                except Exception:
                    pass
                return Response(
                    {'error': f'Failed to reproject raster to UTM: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Clean up intermediate GeoTIFFs
            try:
                os.remove(initial_tiff_path)
                os.remove(masked_tiff_path)
                if create_colored:
                    os.remove(colored_tiff_path)
                    os.remove(masked_colored_path)
                print(f"[DEBUG] Intermediate GeoTIFFs deleted")
            except Exception as e:
                print(f"[!] Failed to delete intermediate GeoTIFFs: {e}")
            
            # Generate contours as GeoJSON if requested
            contour_geojson = None
            
            if generate_contours and final_tiff_path.exists():
                print(f"[DEBUG] Starting contour generation as GeoJSON...")
                
                contour_geojson = self.generate_contours_as_geojson(
                    final_tiff_path, 
                    contour_interval
                )
                
                if contour_geojson is not None:
                    print(f"[✓] Successfully generated contour GeoJSON with {len(contour_geojson['features'])} features")
                else:
                    print(f"[WARNING] Failed to generate contours from raster")

            # Publish to GeoServer
            if not self.create_workspace():
                try:
                    os.remove(final_tiff_path)
                    if create_colored:
                        os.remove(final_colored_path)
                except Exception as e:
                    print(f"[!] Failed to delete temporary file: {e}")
                return Response(
                    {'error': 'Failed to create or access GeoServer workspace'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Publish single-band raster
            print(f"[DEBUG] Publishing single-band UTM GeoTIFF to GeoServer: {final_tiff_path}")
            if not self.publish_geotiff(final_tiff_path, store_name):
                try:
                    os.remove(final_tiff_path)
                    if create_colored:
                        os.remove(final_colored_path)
                except Exception as e:
                    print(f"[!] Failed to delete temporary file: {e}")
                return Response(
                    {'error': f'Failed to publish single-band GeoTIFF to GeoServer: {store_name}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Publish colored raster if created
            published_layers = [store_name]
            if create_colored:
                colored_store_name = f"{store_name}_colored"
                print(f"[DEBUG] Publishing colored UTM GeoTIFF to GeoServer: {final_colored_path}")
                if self.publish_geotiff(final_colored_path, colored_store_name):
                    published_layers.append(colored_store_name)
                    print(f"[✓] Successfully published colored layer: {colored_store_name}")
                else:
                    print(f"[WARNING] Failed to publish colored layer: {colored_store_name}")

            # Clean up final temporary files
            try:
                os.remove(final_tiff_path)
                if create_colored:
                    os.remove(final_colored_path)
                print(f"[DEBUG] Final GeoTIFFs deleted")
            except Exception as e:
                print(f"[!] Failed to delete temporary files: {e}")

            print(f"[✓] Successfully published layer(s): {', '.join(published_layers)}")

            # Prepare response with contour information
            response_data = {
                'layer_name': store_name,
                'message': 'Improved interpolation with ArcMap-style coloring completed successfully',
                'data_points_used': len(x),
                'villages_selected': len(selected_area),
                'crs': 'EPSG:32644',
                'resolution': '30m',
                'interpolation_method': method,
                'data_statistics': {
                    'min_value': float(z_min),
                    'max_value': float(z_max),
                    'mean_value': float(z_mean),
                    'std_deviation': float(z_std),
                    'nan_percentage': float(nan_percentage)
                },
                'geoserver_url': f"http://localhost:9091/geoserver/{WORKSPACE}/wms",
                'published_layers': published_layers
            }

            # Add contour information if generated
            if generate_contours:
                if contour_geojson is not None:
                    response_data['contour_generation'] = {
                        'requested': True,
                        'success': True,
                        'interval': contour_interval,
                        'statistics': contour_geojson['properties']['statistics']
                    }
                    # Include the full GeoJSON contour data in response
                    response_data['contours'] = contour_geojson
                else:
                    response_data['contour_generation'] = {
                        'requested': True,
                        'success': False,
                        'interval': contour_interval,
                        'error': 'Failed to generate contours from raster'
                    }
                    response_data['contours'] = None
            else:
                response_data['contour_generation'] = {
                    'requested': False
                }

            if create_colored:
                # Generate numeric labels from actual breaks
                numeric_labels = []
                for i in range(len(classification_breaks) - 1):
                    numeric_labels.append(f"{classification_breaks[i]:.1f}-{classification_breaks[i+1]:.1f}")
                
                # Add color scheme information
                response_data['color_scheme'] = {
                    'type': 'ArcMap_style',
                    'parameter': parameter,
                    'colors': colors,
                    'labels': numeric_labels,
                    'classes': len(colors)
                }

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"[ERROR] Unexpected error: {str(e)}")
            try:
                if 'initial_tiff_path' in locals():
                    os.remove(initial_tiff_path)
                if 'masked_tiff_path' in locals():
                    os.remove(masked_tiff_path)
                if 'final_tiff_path' in locals():
                    os.remove(final_tiff_path)
                if 'colored_tiff_path' in locals():
                    os.remove(colored_tiff_path)
                if 'masked_colored_path' in locals():
                    os.remove(masked_colored_path)
                if 'final_colored_path' in locals():
                    os.remove(final_colored_path)
            except Exception as e:
                print(f"[!] Failed to delete temporary file(s): {e}")
            return Response(
                {'error': f'Error generating or publishing raster: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )