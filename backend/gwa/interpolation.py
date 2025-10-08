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
from scipy.spatial import cKDTree
import contextily as ctx
from PIL import Image
import base64
from io import BytesIO

# GeoServer configuration
GEOSERVER_URL = "http://geoserver:8080/geoserver/rest"
GEOSERVER_USER = "admin"
GEOSERVER_PASSWORD = "geoserver"
WORKSPACE = "myworkspace"
TEMP_DIR = Path("media/temp")

# Path to shapefiles
VILLAGES_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                            'media', 'gwa_data', 'gwa_shp', 'Final_Village', 'Village.shp')

class InterpolateRasterView(APIView):
    permission_classes = [AllowAny]

    def create_png_visualization(self, raster_path, contour_geojson=None, output_path=None, 
                                parameter='', colors=None, classification_breaks=None):
        """
        Create PNG image with raster overlay on basemap and optional contours.
        Returns: path to saved PNG file and base64 encoded image
        """
        print(f"[DEBUG] Creating PNG visualization for {parameter}")
        
        try:
            # Import additional required modules
            from rasterio.warp import reproject, calculate_default_transform, transform_bounds
            import rasterio.enums
            import pyproj
            import numpy as np  # For vectorized operations
            
            # Read the raster data
            with rasterio.open(raster_path) as src:
                raster_data = src.read(1)
                bounds = src.bounds
                original_crs = src.crs
                
                # Define target CRS for degrees
                target_crs = 'EPSG:4326'
                
                # Calculate new transform and dimensions for reprojection
                transform, width, height = calculate_default_transform(
                    original_crs, target_crs, src.width, src.height, *bounds
                )
                
                # Create destination array
                dst_array = np.empty((height, width), dtype=src.dtypes[0])
                
                # Reproject raster data with faster resampling
                reproject(
                    source=raster_data,
                    destination=dst_array,
                    src_transform=src.transform,
                    src_crs=original_crs,
                    dst_transform=transform,
                    dst_crs=target_crs,
                    resampling=rasterio.enums.Resampling.nearest  # Faster nearest neighbor resampling
                )
                
                # Calculate new bounds in target CRS
                left = transform.c
                bottom = transform.f + transform.e * height
                right = transform.c + transform.a * width
                top = transform.f
                
                # Create figure with proper aspect ratio
                fig, ax = plt.subplots(figsize=(12, 10))
                
                # Plot raster data
                if colors is not None and classification_breaks is not None:
                    # Create custom colormap
                    cmap = ListedColormap(colors)
                    norm = BoundaryNorm(classification_breaks, len(colors))
                    
                    # Show raster with transparency for NaN values
                    masked_data = np.ma.masked_invalid(dst_array)
                    im = ax.imshow(masked_data, extent=[left, right, bottom, top],
                                 cmap=cmap, norm=norm, alpha=0.7, zorder=2, interpolation='nearest')  # Faster interpolation
                else:
                    # Default visualization
                    masked_data = np.ma.masked_invalid(dst_array)
                    im = ax.imshow(masked_data, extent=[left, right, bottom, top],
                                 cmap='viridis', alpha=0.7, zorder=2, interpolation='nearest')  # Faster interpolation
                
                # Add basemap
                try:
                    # Convert axes to target CRS for basemap
                    ax.set_xlim(left, right)
                    ax.set_ylim(bottom, top)
                    
                    # Add contextily basemap with lighter provider
                    ctx.add_basemap(
                        ax,
                        crs=target_crs,
                        source=ctx.providers.CartoDB.Voyager,  # Medium contrast, clearer than Positron
                        alpha=1,
                        zoom=10
                    )
  # Lower zoom for fewer tiles; adjust if needed for detail
                    print("[DEBUG] Basemap added successfully")
                except Exception as e:
                    print(f"[WARNING] Could not add basemap: {e}")
                
                # Add contours if provided
                if contour_geojson is not None and contour_geojson.get('features'):
                    print(f"[DEBUG] Adding {len(contour_geojson['features'])} contours to visualization")
                    
                    # Create transformer for coordinates
                    transformer = pyproj.Transformer.from_crs(original_crs, target_crs, always_xy=True)
                    
                    for idx, feature in enumerate(contour_geojson['features']):
                        # Transform coordinates to target CRS using vectorized operation
                        coords = np.array(feature['geometry']['coordinates'])
                        x_t, y_t = transformer.transform(coords[:, 0], coords[:, 1])
                        level = feature['properties']['level']
                        
                        # Plot contour line
                        ax.plot(x_t, y_t, color='black', linewidth=0.5, 
                               alpha=1, zorder=3)
                        
                        # Add label for major contours (every 5th)
                        if len(contour_geojson['features']) < 20 or idx % 5 == 0:
                            mid_idx = len(x_t) // 2
                            ax.text(x_t[mid_idx], y_t[mid_idx], 
                                   f'{level:.1f}', fontsize=8, 
                                   bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=1),
                                   zorder=4)
                
                # Add colorbar
                cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
                cbar.set_label(parameter, rotation=270, labelpad=20)
                
                # Set labels and title
                ax.set_xlabel('LONGITUDE', fontsize=12)
                ax.set_ylabel('LATITUDE', fontsize=12)
                ax.set_title(f'{parameter} Interpolation with Contours', fontsize=14, fontweight='bold')
                
                # Add grid
                ax.grid(True, alpha=0.3, linestyle='--', linewidth=0.5)
                
                # Tight layout
                plt.tight_layout()
                
                # Save to file
                if output_path is None:
                    output_path = TEMP_DIR / f"visualization_{parameter}_{uuid.uuid4().hex[:8]}.png"
                
                plt.savefig(output_path, dpi=150, bbox_inches='tight', 
                           facecolor='white', edgecolor='none',
                           pil_kwargs={'compress_level': 1})  # Faster save with low compression
                
                print(f"[DEBUG] PNG saved to: {output_path}")
                
                # Convert to base64 by reading the saved file (avoids second rendering)
                with open(output_path, 'rb') as f:
                    image_base64 = base64.b64encode(f.read()).decode('utf-8')
                
                plt.close(fig)
                
                return str(output_path), image_base64
                
        except Exception as e:
            print(f"[ERROR] PNG visualization error: {str(e)}")
            import traceback
            traceback.print_exc()
            return None, None

    def generate_contours_as_geojson(self, raster_path, contour_interval=None, smooth=True, quality='balanced'):
        """
        Optimized contour generation with quality/speed options.
        """
        print(f"[DEBUG] Generating contours (quality={quality}) from raster: {raster_path}")
        print(f"[DEBUG] Contour interval: {contour_interval} meters")
        
        quality_settings = {
            'fast': {
                'upscale_factor': 1,
                'gaussian_sigma': 0.5,
                'smooth_method': 'simple',
                'simplify_tolerance': 2.0,
                'max_points_per_contour': 500
            },
            'balanced': {
                'upscale_factor': 2,
                'gaussian_sigma': 1.0,
                'smooth_method': 'savgol',
                'simplify_tolerance': 1.0,
                'max_points_per_contour': 1000
            },
            'high': {
                'upscale_factor': 3,
                'gaussian_sigma': 1.5,
                'smooth_method': 'bspline',
                'simplify_tolerance': 0.5,
                'max_points_per_contour': 2000
            }
        }
        
        settings = quality_settings.get(quality, quality_settings['balanced'])
        
        try:
            with rasterio.open(raster_path) as src:
                data = src.read(1)
                transform = src.transform
                crs = src.crs
                
                valid_mask = ~np.isnan(data)
                if np.sum(valid_mask) == 0:
                    print("[ERROR] No valid data in raster for contour generation")
                    return None
                    
                data_min, data_max = np.nanmin(data), np.nanmax(data)
                print(f"[DEBUG] Raster data range: {data_min:.3f} to {data_max:.3f}")
                
                upscale_factor = settings['upscale_factor']
                if upscale_factor > 1:
                    print(f"[DEBUG] Upsampling by factor {upscale_factor}...")
                    from scipy.ndimage import zoom
                    upsampled_data = zoom(data, upscale_factor, order=1, mode='nearest', prefilter=False)
                    upsampled_transform = rasterio.Affine(
                        transform.a / upscale_factor, transform.b, transform.c,
                        transform.d, transform.e / upscale_factor, transform.f
                    )
                else:
                    upsampled_data = data.copy()
                    upsampled_transform = transform
                
                print(f"[DEBUG] Applying gaussian smoothing (sigma={settings['gaussian_sigma']})...")
                from scipy.ndimage import gaussian_filter
                
                valid_upsampled = ~np.isnan(upsampled_data)
                if np.sum(valid_upsampled) > 0:
                    smoothed_data = gaussian_filter(
                        upsampled_data, 
                        sigma=settings['gaussian_sigma'],
                        mode='nearest',
                        truncate=3.0
                    )
                    smoothed_data[~valid_upsampled] = np.nan
                else:
                    smoothed_data = upsampled_data
                
                if contour_interval is None or contour_interval <= 0:
                    max_contours = 15 if quality == 'fast' else 20
                    contour_levels = np.linspace(data_min, data_max, min(11, max_contours))[1:-1]
                    print(f"[DEBUG] Auto-generated {len(contour_levels)} contour levels")
                else:
                    start_level = np.ceil(data_min / contour_interval) * contour_interval
                    end_level = np.floor(data_max / contour_interval) * contour_interval
                    if start_level <= end_level:
                        contour_levels = np.arange(start_level, end_level + contour_interval, contour_interval)
                        if len(contour_levels) > 50:
                            contour_levels = contour_levels[::2]
                            print(f"[DEBUG] Limited to {len(contour_levels)} contours for performance")
                    else:
                        contour_levels = np.array([np.nanmean(data)])
                    print(f"[DEBUG] Generated {len(contour_levels)} contour levels")
                
                data_for_contour = smoothed_data.copy()
                nan_mask = np.isnan(data_for_contour)
                
                if np.sum(nan_mask) > 0 and np.sum(nan_mask) < 0.2 * data_for_contour.size:
                    from scipy.ndimage import binary_erosion
                    small_gaps = binary_erosion(~nan_mask, iterations=1) & nan_mask
                    
                    if np.sum(small_gaps) > 0 and np.sum(small_gaps) < 1000:
                        from scipy.ndimage import distance_transform_edt
                        indices = distance_transform_edt(nan_mask, return_distances=False, return_indices=True)
                        data_for_contour[small_gaps] = data_for_contour[tuple(indices[:, small_gaps])]
                
                remaining_nan = np.isnan(data_for_contour)
                if np.sum(remaining_nan) > 0:
                    data_for_contour[remaining_nan] = data_min - abs(data_max - data_min)
                
                geojson_features = []
                contour_statistics = {
                    'total_contours': 0,
                    'contour_levels': [],
                    'elevation_range': {'min': float(data_min), 'max': float(data_max)},
                    'contour_interval': contour_interval,
                    'quality_setting': quality
                }
                
                print(f"[DEBUG] Processing {len(contour_levels)} contour levels...")
                
                for level_idx, level in enumerate(contour_levels):
                    if level_idx % 5 == 0:
                        print(f"[DEBUG] Processing level {level_idx+1}/{len(contour_levels)}")
                    
                    try:
                        contours = measure.find_contours(data_for_contour, level)
                        
                        for contour_idx, contour in enumerate(contours):
                            if len(contour) < 6:
                                continue
                            
                            if len(contour) > settings['max_points_per_contour']:
                                step = len(contour) // settings['max_points_per_contour']
                                contour = contour[::step]
                            
                            contour_coords = []
                            for point in contour:
                                row, col = float(point[0]), float(point[1])
                                x, y = rasterio.transform.xy(upsampled_transform, row, col)
                                contour_coords.append([float(x), float(y)])
                            
                            if len(contour_coords) < 3:
                                continue
                            
                            if smooth:
                                if settings['smooth_method'] == 'simple':
                                    contour_coords = self.fast_simple_smooth(contour_coords)
                                elif settings['smooth_method'] == 'savgol':
                                    contour_coords = self.fast_savgol_smooth(contour_coords)
                                else:
                                    contour_coords = self.fast_bspline_smooth(contour_coords)
                            
                            if len(contour_coords) > 10:
                                try:
                                    from shapely.geometry import LineString
                                    line = LineString(contour_coords)
                                    tolerance = settings['simplify_tolerance'] * upsampled_transform.a
                                    simplified = line.simplify(tolerance=tolerance, preserve_topology=False)
                                    if simplified.is_valid and len(simplified.coords) >= 3:
                                        contour_coords = list(simplified.coords)
                                except:
                                    pass
                            
                            if len(contour_coords) >= 3:
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
                                        "interval": contour_interval if contour_interval else "auto"
                                    }
                                }
                                geojson_features.append(feature)
                                contour_statistics['total_contours'] += 1
                                
                    except Exception as level_error:
                        print(f"[WARNING] Failed at level {level}: {str(level_error)}")
                        continue
                
                if geojson_features:
                    levels = [f['properties']['level'] for f in geojson_features]
                    contour_statistics['contour_levels'] = sorted(list(set(levels)))
                
                if not geojson_features:
                    print("[WARNING] No contours generated")
                    return None
                
                print(f"[DEBUG] Generated {len(geojson_features)} contour features in {quality} quality")
                
                return {
                    "type": "FeatureCollection",
                    "crs": {"type": "name", "properties": {"name": str(crs)}},
                    "features": geojson_features,
                    "properties": {
                        "statistics": contour_statistics,
                        "generated_from": str(raster_path.name),
                        "generation_method": f"optimized_{quality}_contours"
                    }
                }
                
        except Exception as e:
            print(f"[ERROR] Optimized contour generation error: {str(e)}")
            return None

    def fast_simple_smooth(self, coords, window=3):
        """Ultra-fast simple smoothing."""
        if len(coords) < window:
            return coords
        
        coords = np.array(coords)
        smoothed = coords.copy()
        
        for i in range(1, len(coords) - 1):
            smoothed[i] = (coords[i-1] + 2*coords[i] + coords[i+1]) / 4.0
        
        return smoothed.tolist()

    def fast_savgol_smooth(self, coords, window=5):
        """Fast Savitzky-Golay smoothing."""
        try:
            from scipy.signal import savgol_filter
            
            if len(coords) < window:
                return coords
            
            coords = np.array(coords)
            window = min(window, len(coords) if len(coords) % 2 == 1 else len(coords) - 1)
            
            if window < 3:
                return coords.tolist()
            
            smooth_x = savgol_filter(coords[:, 0], window, 2, mode='nearest')
            smooth_y = savgol_filter(coords[:, 1], window, 2, mode='nearest')
            
            return list(zip(smooth_x, smooth_y))
        except:
            return self.fast_simple_smooth(coords)

    def fast_bspline_smooth(self, coords, max_points=200):
        """Fast B-spline smoothing with point limiting."""
        try:
            from scipy import interpolate
            
            if len(coords) < 6:
                return coords
            
            if len(coords) > max_points:
                step = len(coords) // max_points
                coords = coords[::step]
            
            coords = np.array(coords)
            x, y = coords[:, 0], coords[:, 1]
            
            tck, _ = interpolate.splprep([x, y], s=len(coords)*0.2, k=3)
            u_new = np.linspace(0, 1, len(coords))
            smooth_coords = interpolate.splev(u_new, tck)
            
            return list(zip(smooth_coords[0], smooth_coords[1]))
        except:
            return self.fast_savgol_smooth(coords)

    def smooth_contour_coordinates(self, coords, window_size=3):
        """Smooth contour coordinates using a simple moving average."""
        if not coords or len(coords) < window_size:
            return coords
        
        try:
            coords = [[float(coord[0]), float(coord[1])] for coord in coords]
        except (IndexError, TypeError, ValueError) as e:
            print(f"[WARNING] Invalid coordinate format in smoothing: {e}")
            return coords
        
        smoothed = []
        half_window = window_size // 2
        
        for i in range(len(coords)):
            if i < half_window or i >= len(coords) - half_window:
                smoothed.append(coords[i])
            else:
                try:
                    x_sum = sum(coords[j][0] for j in range(i - half_window, i + half_window + 1))
                    y_sum = sum(coords[j][1] for j in range(i - half_window, i + half_window + 1))
                    smoothed.append([x_sum / window_size, y_sum / window_size])
                except (IndexError, TypeError) as e:
                    print(f"[WARNING] Smoothing calculation failed at index {i}: {e}")
                    smoothed.append(coords[i])
        
        return smoothed

    def publish_shapefile_to_geoserver(self, shp_path, store_name):
        print(f"[DEBUG] Publishing shapefile to GeoServer: {shp_path}")
        try:
            import zipfile
            zip_path = shp_path.parent / f"{shp_path.stem}.zip"
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for ext in ['.shp', '.shx', '.dbf', '.prj', '.cpg']:
                    file_path = shp_path.with_suffix(ext)
                    if file_path.exists():
                        zipf.write(file_path, file_path.name)
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
        print(f"[DEBUG] Performing legacy IDW (kept for compatibility)")
        xi, yi = np.meshgrid(grid_x, grid_y)
        grid_points = np.column_stack([xi.ravel(), yi.ravel()])
        distances = cdist(grid_points, points)
        if radius:
            mask_radius = distances > radius
            distances[mask_radius] = np.inf
        distances[distances == 0] = 1e-10
        weights = 1.0 / (distances ** power)
        weights[np.isinf(weights)] = 0
        weights_sum = np.sum(weights, axis=1)
        weights_sum[weights_sum == 0] = 1
        interpolated = np.sum(weights * values[np.newaxis, :], axis=1) / weights_sum
        return interpolated.reshape(xi.shape)

    def kriging_interpolation(self, points, values, grid_x, grid_y):
        print(f"[DEBUG] Performing Kriging-like interpolation using RBF")
        data_std = np.std(values)
        epsilon = data_std / 10 if data_std > 0 else 1
        try:
            rbf = Rbf(points[:, 0], points[:, 1], values, 
                      function='multiquadric', epsilon=epsilon, smooth=0.1)
            xi, yi = np.meshgrid(grid_x, grid_y)
            zi = rbf(xi, yi)
            print(f"[DEBUG] Successfully used multiquadric RBF")
            return zi
        except:
            try:
                rbf = Rbf(points[:, 0], points[:, 1], values, 
                          function='gaussian', epsilon=epsilon, smooth=0.1)
                xi, yi = np.meshgrid(grid_x, grid_y)
                zi = rbf(xi, yi)
                print(f"[DEBUG] Successfully used gaussian RBF")
                return zi
            except:
                rbf = Rbf(points[:, 0], points[:, 1], values, 
                          function='linear', smooth=0.1)
                xi, yi = np.meshgrid(grid_x, grid_y)
                zi = rbf(xi, yi)
                print(f"[DEBUG] Successfully used linear RBF")
                return zi

    def spline_interpolation(self, points, values, grid_x, grid_y):
        print(f"[DEBUG] Performing Spline interpolation using griddata")
        xi, yi = np.meshgrid(grid_x, grid_y)
        try:
            zi = griddata(points, values, (xi, yi), method='cubic', fill_value=np.nan)
            nan_percentage = np.sum(np.isnan(zi)) / zi.size * 100
            if nan_percentage > 50:
                print(f"[DEBUG] Too many NaN values ({nan_percentage:.1f}%), trying linear")
                zi = griddata(points, values, (xi, yi), method='linear', fill_value=np.nan)
        except:
            zi = griddata(points, values, (xi, yi), method='linear', fill_value=np.nan)
        return zi

    def get_arcmap_colors(self, parameter, data_type=None):
        if parameter == 'gwl' or (parameter == 'RL' and data_type in ['PRE', 'POST']):
            colors = ['#08306b','#2171b5','#6baed6','#c6dbef','#fee0d2','#fc9272','#de2d26','#a50f15']
            labels = ['Very High','High','Moderately High','Moderate','Moderately Low','Low','Very Low','Extremely Low']
        elif parameter == 'RL':
            colors = ['#00441b','#238b45','#74c476','#bae4b3','#edf8e9','#fee6ce','#fd8d3c','#d94701','#8c2d04']
            labels = ['Very Low','Low','Moderately Low','Moderate','Moderately High','High','Very High','Extremely High','Peak']
        else:
            colors = ['#313695','#4575b4','#74add1','#abd9e9','#e0f3f8','#fee090','#fdae61','#f46d43','#d73027']
            labels = ['Level 1','Level 2','Level 3','Level 4','Level 5','Level 6','Level 7','Level 8','Level 9']
        return colors, labels

    def create_colored_raster(self, data, colors, num_classes=8):
        print(f"[DEBUG] Creating colored raster with {num_classes} classes")
        valid_data = data[~np.isnan(data)]
        if len(valid_data) == 0:
            print("[ERROR] No valid data for classification")
            return np.zeros((*data.shape, 3), dtype=np.uint8)
        percentiles = np.linspace(0, 100, num_classes + 1)
        breaks = np.percentile(valid_data, percentiles)
        breaks = np.unique(breaks)
        if len(breaks) < 2:
            data_min, data_max = np.min(valid_data), np.max(valid_data)
            if data_min == data_max:
                breaks = np.array([data_min - 0.1, data_max + 0.1])
            else:
                breaks = np.linspace(data_min, data_max, num_classes + 1)
        print(f"[DEBUG] Classification breaks: {breaks}")
        if len(colors) > len(breaks) - 1:
            colors = colors[:len(breaks) - 1]
        elif len(colors) < len(breaks) - 1:
            from matplotlib.colors import LinearSegmentedColormap
            cmap = LinearSegmentedColormap.from_list("custom", colors, N=len(breaks) - 1)
            colors = [mcolors.to_hex(cmap(i / (len(breaks) - 2))) for i in range(len(breaks) - 1)]
        colored_image = np.zeros((*data.shape, 3), dtype=np.uint8)
        for i in range(len(breaks) - 1):
            if i == len(breaks) - 2:
                mask_sel = (data >= breaks[i]) & (data <= breaks[i + 1])
            else:
                mask_sel = (data >= breaks[i]) & (data < breaks[i + 1])
            hex_color = colors[i].lstrip('#')
            rgb = tuple(int(hex_color[j:j+2], 16) for j in (0, 2, 4))
            colored_image[mask_sel] = rgb
        nan_mask = np.isnan(data)
        colored_image[nan_mask] = [0, 0, 0]
        return colored_image, breaks

    def create_workspace(self):
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
    
    def _arcgis_style_idw_ckdtree(self, coords_xy, values, grid_transform, grid_shape,
                              power=2.0, search_mode="variable", n_neighbors=12, radius=None):
    
        print(f"[DEBUG] cKDTree IDW start | mode={search_mode}, k={n_neighbors}, radius={radius}, power={power}")
        
        if isinstance(grid_shape, (tuple, list)) and len(grid_shape) == 2:
            rows, cols = grid_shape
        else:
            raise ValueError(f"grid_shape must be a tuple/list of (rows, cols), got: {grid_shape}")
        
        rows, cols = int(rows), int(cols)
        print(f"[DEBUG] Grid dimensions: rows={rows}, cols={cols}")

        xs = (np.arange(cols, dtype=np.float64) * grid_transform.a) + grid_transform.c + (grid_transform.a / 2.0)
        ys = (np.arange(rows, dtype=np.float64) * grid_transform.e) + grid_transform.f + (grid_transform.e / 2.0)
        grid_x, grid_y = np.meshgrid(xs, ys)
        xi = np.column_stack([grid_x.ravel(), grid_y.ravel()])

        coords_xy = np.asarray(coords_xy, dtype=np.float64)
        values = np.asarray(values, dtype=np.float64)
        k = int(n_neighbors) if n_neighbors is not None else 12
        if k < 1:
            k = 1
        if k > coords_xy.shape[0]:
            k = coords_xy.shape[0]

        tree = cKDTree(coords_xy)

        if search_mode == "variable":
            dists, idxs = tree.query(xi, k=k)
            if k == 1:
                dists = dists[:, np.newaxis]
                idxs = idxs[:, np.newaxis]
            dists[dists == 0] = 1e-10
            weights = 1.0 / (dists ** float(power))
            numer = np.sum(weights * values[idxs], axis=1)
            denom = np.sum(weights, axis=1)
            vals = numer / denom

        elif search_mode == "fixed":
            if radius is None or float(radius) <= 0:
                raise ValueError("Fixed search requires positive radius")
            r = float(radius)
            neighbor_lists = tree.query_ball_point(xi, r=r)
            vals = np.empty(len(xi), dtype=np.float64)
            for i, neighbors in enumerate(neighbor_lists):
                if not neighbors:
                    vals[i] = np.nan
                    continue
                d = np.linalg.norm(coords_xy[neighbors] - xi[i], axis=1)
                d[d == 0] = 1e-10
                w = 1.0 / (d ** float(power))
                vals[i] = np.sum(w * values[neighbors]) / np.sum(w)

        else:
            N = len(xi)
            chunk = 200000
            out = np.empty(N, dtype=np.float64)
            for s in range(0, N, chunk):
                e = min(s + chunk, N)
                xchunk = xi[s:e]
                d = np.linalg.norm(coords_xy[None, :, :] - xchunk[:, None, :], axis=2)
                d[d == 0] = 1e-10
                w = 1.0 / (d ** float(power))
                numer = w.dot(values)
                denom = np.sum(w, axis=1)
                out[s:e] = numer / denom
            vals = out

        grid = vals.reshape(rows, cols).astype(np.float32)
        print(f"[DEBUG] cKDTree IDW done | grid shape={grid.shape}")
        return grid

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
            csv_file = data.get('csv_file')
            create_colored = data.get('create_colored', True)
            contour_interval = data.get('contour_interval', None)
            generate_contours = data.get('generate_contours', False)

            idw_search_mode = data.get('search_mode', 'variable')
            idw_n_neighbors = int(data.get('n_neighbors', 12))
            idw_radius = data.get('radius', None)
            idw_power = float(data.get('power', 2.0))
            idw_cell_size = float(data.get('cell_size', 30.0))

            if idw_radius is not None:
                try:
                    idw_radius = float(idw_radius)
                except:
                    return Response({'error': 'radius must be numeric (meters)'}, status=status.HTTP_400_BAD_REQUEST)

            print(f"[DEBUG] Contour generation: {generate_contours}")
            if generate_contours and contour_interval:
                print(f"[DEBUG] Contour interval: {contour_interval} meters")

            if not all([method, parameter, csv_file]):
                return Response(
                    {'error': 'Missing required fields: method, parameter, csv_file'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if generate_contours and contour_interval is not None:
                try:
                    contour_interval = float(contour_interval)
                    if contour_interval <= 0:
                        return Response({'error': 'Contour interval must be a positive number'}, status=status.HTTP_400_BAD_REQUEST)
                except (ValueError, TypeError):
                    return Response({'error': 'Invalid contour interval format'}, status=status.HTTP_400_BAD_REQUEST)

            if method not in ['idw', 'kriging', 'spline']:
                return Response(
                    {'error': 'Invalid interpolation method. Must be idw, kriging, or spline'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not village_ids or not place:
                return Response({'error': 'village_ids and place parameters are required'}, status=status.HTTP_400_BAD_REQUEST)

            if place not in ['village', 'subdistrict']:
                return Response({'error': 'Invalid place parameter. Must be village or subdistrict'}, status=status.HTTP_400_BAD_REQUEST)

            if not isinstance(village_ids, list):
                return Response({'error': 'village_ids parameter must be a list of IDs'}, status=status.HTTP_400_BAD_REQUEST)

            csv_path = TEMP_DIR / csv_file
            print(f"[DEBUG] Loading CSV file: {csv_path}")
            if not csv_path.exists():
                return Response({'error': f'CSV file not found: {csv_path}'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                df = pd.read_csv(csv_path)
                print(f"[DEBUG] CSV file loaded with {len(df)} rows")
            except Exception as e:
                return Response({'error': f'Failed to read CSV file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

            required_columns = ['LONGITUDE', 'LATITUDE', parameter]
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                return Response({'error': f'Missing required columns in CSV: {", ".join(missing_columns)}'}, status=status.HTTP_400_BAD_REQUEST)

            df = df.dropna(subset=required_columns)
            if df.empty:
                return Response({'error': 'No valid data in CSV after removing rows with missing values'}, status=status.HTTP_400_BAD_REQUEST)

            x = df['LONGITUDE'].values
            y = df['LATITUDE'].values
            z = df[parameter].astype(float).values
            print(f"[DEBUG] Processing {len(x)} data points for interpolation")
            print(f"[DEBUG] Data range: min={np.min(z):.3f}, max={np.max(z):.3f}, mean={np.mean(z):.3f}")

            csv_name = Path(csv_file).stem
            store_name = f"interpolated_raster_{csv_name}_{parameter.replace(' ', '_')}"
            print(f"[DEBUG] GeoServer store name: {store_name}")

            try:
                villages_vector = gpd.read_file(VILLAGES_PATH)
                print(f"[DEBUG] Shapefile CRS: {villages_vector.crs}")
                print(f"[DEBUG] Shapefile bounds: {villages_vector.total_bounds}")
                invalid_geoms = villages_vector[~villages_vector.geometry.is_valid]
                if not invalid_geoms.empty:
                    print(f"[DEBUG] Found {len(invalid_geoms)} invalid geometries. Attempting to fix.")
                    villages_vector['geometry'] = villages_vector.geometry.buffer(0)
                if villages_vector.crs is None:
                    print("[DEBUG] Shapefile CRS is None, setting to EPSG:4326")
                    villages_vector.set_crs("EPSG:4326", inplace=True)
                if villages_vector.crs != "EPSG:4326":
                    print(f"[DEBUG] Transforming shapefile from {villages_vector.crs} to EPSG:4326")
                    villages_vector = villages_vector.to_crs("EPSG:4326")
                if place == "village":
                    village_ids = [float(x) for x in village_ids]
                    print(f"[DEBUG] Filtering villages with village_co in {village_ids}")
                    selected_area = villages_vector[villages_vector['village_co'].isin(village_ids)]
                elif place == "subdistrict":
                    village_ids = [int(x) for x in village_ids]
                    print(f"[DEBUG] Filtering subdistricts with SUBDIS_COD in {village_ids}")
                    selected_area = villages_vector[villages_vector['SUBDIS_COD'].isin(village_ids)]
                if selected_area.empty:
                    raise ValueError(f"No {place}s found for the provided IDs: {village_ids}")
                print(f"[DEBUG] Selected area bounds: {selected_area.total_bounds}")
                selected_area_utm = selected_area.to_crs("EPSG:32644")
                print(f"[DEBUG] Selected area UTM bounds: {selected_area_utm.total_bounds}")
            except Exception as e:
                return Response({'error': f'Failed to load or filter village shapefile: {str(e)}'},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            points_gdf = gpd.GeoDataFrame(
                {'val': z},
                geometry=gpd.points_from_xy(x, y, crs="EPSG:4326")
            ).to_crs("EPSG:32644")
            coords_xy = np.array([(geom.x, geom.y) for geom in points_gdf.geometry], dtype=np.float64)
            values = points_gdf['val'].astype(float).values

            sel_minx, sel_miny, sel_maxx, sel_maxy = selected_area_utm.total_bounds
            pts_minx, pts_miny = coords_xy[:,0].min(), coords_xy[:,1].min()
            pts_maxx, pts_maxy = coords_xy[:,0].max(), coords_xy[:,1].max()
            minx = min(sel_minx, pts_minx) - idw_cell_size
            miny = min(sel_miny, pts_miny) - idw_cell_size
            maxx = max(sel_maxx, pts_maxx) + idw_cell_size
            maxy = max(sel_maxy, pts_maxy) + idw_cell_size

            cols = int(np.ceil((maxx - minx) / idw_cell_size))
            rows = int(np.ceil((maxy - miny) / idw_cell_size))
            proj_transform = from_origin(minx, maxy, idw_cell_size, idw_cell_size)
            print(f"[DEBUG] Projected grid rows={rows}, cols={cols}, cell_size={idw_cell_size}m")
            print(f"[DEBUG] Projected grid extent: [{minx},{miny},{maxx},{maxy}] EPSG:32644")

            if method == 'idw':
                Z_proj = self._arcgis_style_idw_ckdtree(
                    coords_xy=coords_xy,
                    values=values,
                    grid_transform=proj_transform,
                    grid_shape=(rows, cols),
                    power=idw_power,
                    search_mode=idw_search_mode,
                    n_neighbors=idw_n_neighbors,
                    radius=idw_radius
                )
            elif method == 'kriging':
                xs = np.arange(cols) * proj_transform.a + proj_transform.c + proj_transform.a / 2.0
                ys = np.arange(rows) * proj_transform.e + proj_transform.f + proj_transform.e / 2.0
                grid_x, grid_y = np.meshgrid(xs, ys)
                pts = coords_xy
                Z_proj = self.kriging_interpolation(pts, values, xs, ys)
            else:
                xs = np.arange(cols) * proj_transform.a + proj_transform.c + proj_transform.a / 2.0
                ys = np.arange(rows) * proj_transform.e + proj_transform.f + proj_transform.e / 2.0
                pts = coords_xy
                Z_proj = self.spline_interpolation(pts, values, xs, ys)

            print(f"[DEBUG] Interpolation completed. Projected grid size: {Z_proj.shape}")

            z_min, z_max = np.nanmin(Z_proj), np.nanmax(Z_proj)
            z_mean, z_std = np.nanmean(Z_proj), np.nanstd(Z_proj)
            nan_percentage = np.sum(np.isnan(Z_proj)) / Z_proj.size * 100.0
            print(f"[DEBUG] Interpolated data (proj) - min={z_min:.3f}, max={z_max:.3f}, mean={z_mean:.3f}, std={z_std:.3f}")
            print(f"[DEBUG] NaN values (proj): {nan_percentage:.1f}%")

            initial_tiff_path = TEMP_DIR / f"{store_name}_initial_utm.tif"
            print(f"[DEBUG] Creating initial single-band GeoTIFF in EPSG:32644: {initial_tiff_path}")

            if not isinstance(Z_proj, np.ndarray) or len(Z_proj.shape) != 2:
                raise ValueError(f"Z_proj must be 2D numpy array, got: {type(Z_proj)} with shape {getattr(Z_proj, 'shape', 'no shape')}")

            height, width = Z_proj.shape
            print(f"[DEBUG] Raster dimensions: height={height}, width={width}")

            with rasterio.open(
                initial_tiff_path,
                'w',
                driver='GTiff',
                height=int(height),
                width=int(width),
                count=1,
                dtype=rasterio.float32,
                crs='EPSG:32644',
                transform=proj_transform,
                nodata=np.nan
            ) as dst:
                dst.write(Z_proj.astype(rasterio.float32), 1)

            if create_colored:
                colors, labels = self.get_arcmap_colors(parameter)
                colored_grid, classification_breaks = self.create_colored_raster(Z_proj, colors, num_classes=len(colors))
                colored_tiff_path = TEMP_DIR / f"{store_name}_colored_utm.tif"
                print(f"[DEBUG] Creating colored GeoTIFF in EPSG:32644: {colored_tiff_path}")
                
                if len(colored_grid.shape) != 3 or colored_grid.shape[2] != 3:
                    raise ValueError(f"Colored grid must be 3D with 3 bands, got shape: {colored_grid.shape}")
                
                height_c, width_c, bands = colored_grid.shape
                
                with rasterio.open(
                    colored_tiff_path,
                    'w',
                    driver='GTiff',
                    height=int(height_c),
                    width=int(width_c),
                    count=3,
                    dtype=rasterio.uint8,
                    crs='EPSG:32644',
                    transform=proj_transform,
                    nodata=0
                ) as dst:
                    for i in range(3):
                        dst.write(colored_grid[:, :, i], i + 1)

            masked_tiff_path = TEMP_DIR / f"{store_name}_masked_utm.tif"
            if create_colored:
                masked_colored_path = TEMP_DIR / f"{store_name}_colored_masked_utm.tif"
            try:
                with rasterio.open(initial_tiff_path) as src:
                    print(f"[DEBUG] Source raster (proj) bounds: {src.bounds}")
                    print(f"[DEBUG] Source raster (proj) shape: {src.shape}")
                    from shapely.ops import unary_union
                    valid_geometries = []
                    for idx, geom in enumerate(selected_area_utm.geometry):
                        if geom.is_valid:
                            valid_geometries.append(geom)
                        else:
                            print(f"[DEBUG] Geometry {idx+1} invalid, attempting fix")
                            fixed = geom.buffer(0)
                            if fixed.is_valid:
                                valid_geometries.append(fixed)
                            else:
                                print(f"[WARNING] Geometry {idx+1} could not be fixed")
                    if not valid_geometries:
                        raise ValueError("No valid geometries found for masking")
                    try:
                        unified_geometry = unary_union(valid_geometries)
                        mask_geometries = [unified_geometry] if unified_geometry.is_valid else valid_geometries
                    except Exception as e:
                        print(f"[WARNING] unary_union failed: {e}, using individual geometries")
                        mask_geometries = valid_geometries

                    out_image, out_transform = mask(
                        dataset=src,
                        shapes=mask_geometries,
                        crop=True,
                        nodata=np.nan,
                        all_touched=True,
                        invert=False,
                        filled=True
                    )
                    print(f"[DEBUG] Single-band masking successful, output shape: {out_image.shape}")

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

                if create_colored:
                    with rasterio.open(colored_tiff_path) as src_colored:
                        out_image_colored, out_transform_colored = mask(
                            dataset=src_colored,
                            shapes=mask_geometries,
                            crop=True,
                            nodata=0,
                            all_touched=True,
                            invert=False,
                            filled=True
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
                return Response({'error': f'Failed to mask raster to selected villages: {str(e)}'},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            final_tiff_path = TEMP_DIR / f"{store_name}_final_utm.tif"
            if create_colored:
                final_colored_path = TEMP_DIR / f"{store_name}_colored_final_utm.tif"
            try:
                with rasterio.open(masked_tiff_path) as src:
                    print(f"[DEBUG] Reprojecting single-band raster from {src.crs} to EPSG:32644")
                    dst_crs = 'EPSG:32644'
                    transform_out, width_out, height_out = calculate_default_transform(
                        src.crs, dst_crs, src.width, src.height, *src.bounds, resolution=30
                    )
                    kwargs = src.meta.copy()
                    kwargs.update({'crs': dst_crs, 'transform': transform_out, 'width': width_out, 'height': height_out})
                    print(f"[DEBUG] Output UTM raster dimensions: {width_out}x{height_out}")
                    print(f"[DEBUG] Output UTM resolution: 30m")
                    with rasterio.open(final_tiff_path, 'w', **kwargs) as dst:
                        reproject(
                            source=rasterio.band(src, 1),
                            destination=rasterio.band(dst, 1),
                            src_transform=src.transform,
                            src_crs=src.crs,
                            dst_transform=transform_out,
                            dst_crs=dst_crs,
                            resampling=Resampling.bilinear,
                            dst_nodata=np.nan
                        )
                    print(f"[DEBUG] UTM projected single-band GeoTIFF saved to: {final_tiff_path}")

                if create_colored:
                    with rasterio.open(masked_colored_path) as src_colored:
                        print(f"[DEBUG] Reprojecting colored raster from {src_colored.crs} to EPSG:32644")
                        dst_crs = 'EPSG:32644'
                        transform_c, width_c, height_c = calculate_default_transform(
                            src_colored.crs, dst_crs, src_colored.width, src_colored.height, *src_colored.bounds, resolution=30
                        )
                        kwargs_c = src_colored.meta.copy()
                        kwargs_c.update({'crs': dst_crs, 'transform': transform_c, 'width': width_c, 'height': height_c})
                        with rasterio.open(final_colored_path, 'w', **kwargs_c) as dst_colored:
                            for i in range(3):
                                reproject(
                                    source=rasterio.band(src_colored, i + 1),
                                    destination=rasterio.band(dst_colored, i + 1),
                                    src_transform=src_colored.transform,
                                    src_crs=src_colored.crs,
                                    dst_transform=transform_c,
                                    dst_crs=dst_crs,
                                    resampling=Resampling.nearest,
                                    dst_nodata=0
                                )
                        print(f"[DEBUG] UTM projected colored GeoTIFF saved to: {final_colored_path}")

                    with rasterio.open(final_tiff_path) as final_raster:
                        print(f"[DEBUG] Final single-band raster CRS: {final_raster.crs}")
                        print(f"[DEBUG] Final single-band raster bounds: {final_raster.bounds}")
                        print(f"[DEBUG] Final single-band raster shape: {final_raster.shape}")
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
                return Response({'error': f'Failed to reproject raster to UTM: {str(e)}'},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            try:
                os.remove(initial_tiff_path)
                os.remove(masked_tiff_path)
                if create_colored:
                    os.remove(colored_tiff_path)
                    os.remove(masked_colored_path)
                print(f"[DEBUG] Intermediate GeoTIFFs deleted")
            except Exception as e:
                print(f"[!] Failed to delete intermediate GeoTIFFs: {e}")

            contour_geojson = None
            if generate_contours and final_tiff_path.exists():
                print(f"[DEBUG] Starting contour generation as GeoJSON...")
                contour_geojson = self.generate_contours_as_geojson(final_tiff_path, contour_interval)
                if contour_geojson is not None:
                    print(f"[✓] Successfully generated contour GeoJSON with {len(contour_geojson['features'])} features")
                else:
                    print(f"[WARNING] Failed to generate contours from raster")

            # Generate PNG visualization
            png_path = None
            png_base64 = None
            
            if final_tiff_path.exists():
                print("[DEBUG] Generating PNG visualization...")
                png_output_path = TEMP_DIR / f"{store_name}_visualization.png"
                
                viz_colors = colors if create_colored else None
                viz_breaks = classification_breaks if create_colored else None
                
                png_path, png_base64 = self.create_png_visualization(
                    raster_path=final_tiff_path,
                    contour_geojson=contour_geojson,
                    output_path=png_output_path,
                    parameter=parameter,
                    colors=viz_colors,
                    classification_breaks=viz_breaks
                )
                
                if png_path:
                    print(f"[✓] PNG visualization created: {png_path}")
                else:
                    print("[WARNING] Failed to create PNG visualization")

            if not self.create_workspace():
                try:
                    os.remove(final_tiff_path)
                    if create_colored:
                        os.remove(final_colored_path)
                except Exception as e:
                    print(f"[!] Failed to delete temporary file: {e}")
                return Response({'error': 'Failed to create or access GeoServer workspace'},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            print(f"[DEBUG] Publishing single-band UTM GeoTIFF to GeoServer: {final_tiff_path}")
            if not self.publish_geotiff(final_tiff_path, store_name):
                try:
                    os.remove(final_tiff_path)
                    if create_colored:
                        os.remove(final_colored_path)
                except Exception as e:
                    print(f"[!] Failed to delete temporary file: {e}")
                return Response({'error': f'Failed to publish single-band GeoTIFF to GeoServer: {store_name}'},
                                status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            published_layers = [store_name]
            if create_colored:
                colored_store_name = f"{store_name}_colored"
                print(f"[DEBUG] Publishing colored UTM GeoTIFF to GeoServer: {final_colored_path}")
                if self.publish_geotiff(final_colored_path, colored_store_name):
                    published_layers.append(colored_store_name)
                    print(f"[✓] Successfully published colored layer: {colored_store_name}")
                else:
                    print(f"[WARNING] Failed to publish colored layer: {colored_store_name}")

            try:
                os.remove(final_tiff_path)
                if create_colored:
                    os.remove(final_colored_path)
                print(f"[DEBUG] Final GeoTIFFs deleted")
            except Exception as e:
                print(f"[!] Failed to delete temporary files: {e}")

            print(f"[✓] Successfully published layer(s): {', '.join(published_layers)}")

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
                'geoserver_url': f"/geoserver/api/{WORKSPACE}/wms",
                'published_layers': published_layers
            }

            # Add PNG visualization data
            if png_path and png_base64:
                response_data['visualization'] = {
                    'png_path': str(png_path),
                    'png_filename': os.path.basename(png_path),
                    'png_base64': png_base64,
                    'download_url': f"/media/temp/{os.path.basename(png_path)}"
                }
                print(f"[✓] PNG visualization added to response")

            if generate_contours:
                if contour_geojson is not None:
                    response_data['contour_generation'] = {
                        'requested': True,
                        'success': True,
                        'interval': contour_interval,
                        'statistics': contour_geojson['properties']['statistics']
                    }
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
                numeric_labels = []
                for i in range(len(classification_breaks) - 1):
                    numeric_labels.append(f"{classification_breaks[i]:.1f}-{classification_breaks[i+1]:.1f}")
                response_data['color_scheme'] = {
                    'type': 'ArcMap_style',
                    'parameter': parameter,
                    'colors': colors,
                    'labels': numeric_labels,
                    'classes': len(colors)
                }

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as main_error:
            print(f"[ERROR] Unexpected error: {str(main_error)}")
            import traceback
            traceback.print_exc()
            
            cleanup_files = []
            for var_name in ['initial_tiff_path', 'masked_tiff_path', 'final_tiff_path', 
                            'colored_tiff_path', 'masked_colored_path', 'final_colored_path']:
                if var_name in locals():
                    cleanup_files.append(locals()[var_name])
            
            for file_path in cleanup_files:
                try:
                    if file_path and os.path.exists(file_path):
                        os.remove(file_path)
                        print(f"[DEBUG] Cleaned up temporary file: {file_path}")
                except Exception as cleanup_error:
                    print(f"[WARNING] Failed to cleanup file {file_path}: {cleanup_error}")
            
            return Response(
                {'error': f'Error generating or publishing raster: {str(main_error)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )