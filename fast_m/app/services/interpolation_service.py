# fast_m/app/services/interpolation_service.py
import numpy as np
from scipy.interpolate import Rbf, griddata
from scipy.spatial.distance import cdist
import rasterio
from rasterio.transform import from_origin
from rasterio.mask import mask
from rasterio.warp import calculate_default_transform, reproject, Resampling
import os
import tempfile
from pathlib import Path
import geopandas as gpd
import uuid
from shapely.geometry import mapping, shape, Point, LineString, Polygon
from shapely.ops import unary_union
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
import matplotlib.colors as mcolors
import pandas as pd
from scipy.spatial import cKDTree
import contextily as ctx
from PIL import Image
import base64
from io import BytesIO
from skimage import measure
import pyproj
from typing import Optional, Tuple, Dict, List, Any
import requests

from app.core.config import settings

# Configuration
GEOSERVER_URL = "http://geoserver:8080/geoserver/rest"
GEOSERVER_USER = "admin"
GEOSERVER_PASSWORD = "geoserver"
WORKSPACE = "myworkspace"

# Use paths from settings
BASE_DIR = Path(settings.BASE_DIR)
MEDIA_ROOT = Path(settings.MEDIA_ROOT)
TEMP_DIR = MEDIA_ROOT / "temp"
VILLAGES_PATH = MEDIA_ROOT / "gwa_data" / "gwa_shp" / "Final_Village" / "Village.shp"


class InterpolationService:
    """Service for raster interpolation and GeoServer publishing"""
    
    def __init__(self):
        # Ensure temp directory exists
        TEMP_DIR.mkdir(parents=True, exist_ok=True)
        print(f"[DEBUG] Settings BASE_DIR: {settings.BASE_DIR}")
        print(f"[DEBUG] Settings MEDIA_ROOT: {settings.MEDIA_ROOT}")
        print(f"[DEBUG] TEMP_DIR: {TEMP_DIR}")
        print(f"[DEBUG] VILLAGES_PATH: {VILLAGES_PATH}")
        
        # Verify villages shapefile exists
        if not VILLAGES_PATH.exists():
            print(f"[WARNING] Villages shapefile not found at: {VILLAGES_PATH}")
        else:
            print(f"[✓] Villages shapefile found: {VILLAGES_PATH}")
    
    def create_png_visualization(
        self, 
        raster_path: Path, 
        contour_geojson: Optional[Dict] = None, 
        output_path: Optional[Path] = None,
        parameter: str = '', 
        colors: Optional[List[str]] = None, 
        classification_breaks: Optional[List[float]] = None
    ) -> Tuple[Optional[str], Optional[str]]:
        """Create PNG image with raster overlay on basemap and optional contours."""
        print(f"[DEBUG] Creating PNG visualization for {parameter}")
        
        try:
            from rasterio.warp import reproject, calculate_default_transform
            import rasterio.enums
            
            with rasterio.open(raster_path) as src:
                raster_data = src.read(1)
                bounds = src.bounds
                original_crs = src.crs
                
                target_crs = 'EPSG:4326'
                
                transform, width, height = calculate_default_transform(
                    original_crs, target_crs, src.width, src.height, *bounds
                )
                
                dst_array = np.empty((height, width), dtype=src.dtypes[0])
                
                reproject(
                    source=raster_data,
                    destination=dst_array,
                    src_transform=src.transform,
                    src_crs=original_crs,
                    dst_transform=transform,
                    dst_crs=target_crs,
                    resampling=rasterio.enums.Resampling.nearest
                )
                
                left = transform.c
                bottom = transform.f + transform.e * height
                right = transform.c + transform.a * width
                top = transform.f
                
                fig, ax = plt.subplots(figsize=(12, 10))
                
                if colors is not None and classification_breaks is not None:
                    cmap = ListedColormap(colors)
                    norm = BoundaryNorm(classification_breaks, len(colors))
                    masked_data = np.ma.masked_invalid(dst_array)
                    im = ax.imshow(masked_data, extent=[left, right, bottom, top],
                                 cmap=cmap, norm=norm, alpha=0.7, zorder=2, interpolation='nearest')
                else:
                    masked_data = np.ma.masked_invalid(dst_array)
                    im = ax.imshow(masked_data, extent=[left, right, bottom, top],
                                 cmap='viridis', alpha=0.7, zorder=2, interpolation='nearest')
                
                try:
                    ax.set_xlim(left, right)
                    ax.set_ylim(bottom, top)
                    ctx.add_basemap(
                        ax,
                        crs=target_crs,
                        source=ctx.providers.CartoDB.Voyager,
                        alpha=1,
                        zoom=10
                    )
                    print("[DEBUG] Basemap added successfully")
                except Exception as e:
                    print(f"[WARNING] Could not add basemap: {e}")
                
                if contour_geojson is not None and contour_geojson.get('features'):
                    print(f"[DEBUG] Adding {len(contour_geojson['features'])} contours to visualization")
                    transformer = pyproj.Transformer.from_crs(original_crs, target_crs, always_xy=True)
                    
                    for idx, feature in enumerate(contour_geojson['features']):
                        coords = np.array(feature['geometry']['coordinates'])
                        x_t, y_t = transformer.transform(coords[:, 0], coords[:, 1])
                        level = feature['properties']['level']
                        
                        ax.plot(x_t, y_t, color='black', linewidth=0.5, alpha=1, zorder=3)
                        
                        if len(contour_geojson['features']) < 20 or idx % 5 == 0:
                            mid_idx = len(x_t) // 2
                            ax.text(x_t[mid_idx], y_t[mid_idx], f'{level:.1f}', fontsize=8,
                                   bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=1),
                                   zorder=4)
                
                cbar = plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
                cbar.set_label(parameter, rotation=270, labelpad=20)
                
                ax.set_xlabel('LONGITUDE', fontsize=12)
                ax.set_ylabel('LATITUDE', fontsize=12)
                ax.set_title(f'{parameter} Interpolation with Contours', fontsize=14, fontweight='bold')
                ax.grid(True, alpha=0.3, linestyle='--', linewidth=0.5)
                plt.tight_layout()
                
                if output_path is None:
                    output_path = TEMP_DIR / f"visualization_{parameter}_{uuid.uuid4().hex[:8]}.png"
                
                plt.savefig(output_path, dpi=150, bbox_inches='tight',
                           facecolor='white', edgecolor='none',
                           pil_kwargs={'compress_level': 1})
                
                print(f"[DEBUG] PNG saved to: {output_path}")
                
                with open(output_path, 'rb') as f:
                    image_base64 = base64.b64encode(f.read()).decode('utf-8')
                
                plt.close(fig)
                return str(output_path), image_base64
                
        except Exception as e:
            print(f"[ERROR] PNG visualization error: {str(e)}")
            import traceback
            traceback.print_exc()
            return None, None

    def generate_contours_as_geojson(
        self, 
        raster_path: Path, 
        contour_interval: Optional[float] = None, 
        smooth: bool = True, 
        quality: str = 'balanced'
    ) -> Optional[Dict]:
        """Generate contours from raster as GeoJSON."""
        print(f"[DEBUG] Generating contours (quality={quality}) from raster: {raster_path}")
        
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
        
        settings_dict = quality_settings.get(quality, quality_settings['balanced'])
        
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
                
                upscale_factor = settings_dict['upscale_factor']
                if upscale_factor > 1:
                    from scipy.ndimage import zoom
                    upsampled_data = zoom(data, upscale_factor, order=1, mode='nearest', prefilter=False)
                    upsampled_transform = rasterio.Affine(
                        transform.a / upscale_factor, transform.b, transform.c,
                        transform.d, transform.e / upscale_factor, transform.f
                    )
                else:
                    upsampled_data = data.copy()
                    upsampled_transform = transform
                
                from scipy.ndimage import gaussian_filter
                valid_upsampled = ~np.isnan(upsampled_data)
                if np.sum(valid_upsampled) > 0:
                    smoothed_data = gaussian_filter(
                        upsampled_data,
                        sigma=settings_dict['gaussian_sigma'],
                        mode='nearest',
                        truncate=3.0
                    )
                    smoothed_data[~valid_upsampled] = np.nan
                else:
                    smoothed_data = upsampled_data
                
                if contour_interval is None or contour_interval <= 0:
                    max_contours = 15 if quality == 'fast' else 20
                    contour_levels = np.linspace(data_min, data_max, min(11, max_contours))[1:-1]
                else:
                    start_level = np.ceil(data_min / contour_interval) * contour_interval
                    end_level = np.floor(data_max / contour_interval) * contour_interval
                    if start_level <= end_level:
                        contour_levels = np.arange(start_level, end_level + contour_interval, contour_interval)
                        if len(contour_levels) > 50:
                            contour_levels = contour_levels[::2]
                    else:
                        contour_levels = np.array([np.nanmean(data)])
                
                data_for_contour = smoothed_data.copy()
                nan_mask = np.isnan(data_for_contour)
                
                if np.sum(nan_mask) > 0:
                    data_for_contour[nan_mask] = data_min - abs(data_max - data_min)
                
                geojson_features = []
                contour_statistics = {
                    'total_contours': 0,
                    'contour_levels': [],
                    'elevation_range': {'min': float(data_min), 'max': float(data_max)},
                    'contour_interval': contour_interval,
                    'quality_setting': quality
                }
                
                for level in contour_levels:
                    try:
                        contours = measure.find_contours(data_for_contour, level)
                        
                        for contour_idx, contour in enumerate(contours):
                            if len(contour) < 6:
                                continue
                            
                            if len(contour) > settings_dict['max_points_per_contour']:
                                step = len(contour) // settings_dict['max_points_per_contour']
                                contour = contour[::step]
                            
                            contour_coords = []
                            for point in contour:
                                row, col = float(point[0]), float(point[1])
                                x, y = rasterio.transform.xy(upsampled_transform, row, col)
                                contour_coords.append([float(x), float(y)])
                            
                            if len(contour_coords) < 3:
                                continue
                            
                            if smooth:
                                if settings_dict['smooth_method'] == 'simple':
                                    contour_coords = self.fast_simple_smooth(contour_coords)
                                elif settings_dict['smooth_method'] == 'savgol':
                                    contour_coords = self.fast_savgol_smooth(contour_coords)
                                else:
                                    contour_coords = self.fast_bspline_smooth(contour_coords)
                            
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
            print(f"[ERROR] Contour generation error: {str(e)}")
            return None

    def fast_simple_smooth(self, coords: List, window: int = 3) -> List:
        """Ultra-fast simple smoothing."""
        if len(coords) < window:
            return coords
        
        coords = np.array(coords)
        smoothed = coords.copy()
        
        for i in range(1, len(coords) - 1):
            smoothed[i] = (coords[i-1] + 2*coords[i] + coords[i+1]) / 4.0
        
        return smoothed.tolist()

    def fast_savgol_smooth(self, coords: List, window: int = 5) -> List:
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

    def fast_bspline_smooth(self, coords: List, max_points: int = 200) -> List:
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

    def get_arcmap_colors(self, parameter: str, data_type: Optional[str] = None) -> Tuple[List[str], List[str]]:
        """Get ArcMap-style colors for parameter."""
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

    def create_colored_raster(self, data: np.ndarray, colors: List[str], num_classes: int = 8) -> Tuple[np.ndarray, np.ndarray]:
        """Create colored raster with classification."""
        print(f"[DEBUG] Creating colored raster with {num_classes} classes")
        valid_data = data[~np.isnan(data)]
        
        if len(valid_data) == 0:
            print("[ERROR] No valid data for classification")
            return np.zeros((*data.shape, 3), dtype=np.uint8), np.array([])
        
        percentiles = np.linspace(0, 100, num_classes + 1)
        breaks = np.percentile(valid_data, percentiles)
        breaks = np.unique(breaks)
        
        if len(breaks) < 2:
            data_min, data_max = np.min(valid_data), np.max(valid_data)
            if data_min == data_max:
                breaks = np.array([data_min - 0.1, data_max + 0.1])
            else:
                breaks = np.linspace(data_min, data_max, num_classes + 1)
        
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

    def create_workspace(self) -> bool:
        """Create GeoServer workspace if not exists."""
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
                print(f"[✓] Workspace '{WORKSPACE}' already exists.")
                return True
            
            response = requests.post(
                url,
                auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                headers=headers,
                data=data,
                timeout=10
            )
            
            if response.status_code in [201, 409]:
                print(f"[✓] Workspace '{WORKSPACE}' created or already exists.")
                return True
            
            return False
        except Exception as e:
            print(f"[ERROR] Workspace creation error: {str(e)}")
            return False

    def publish_geotiff(self, tiff_path: Path, store_name: str) -> bool:
        """Publish GeoTIFF to GeoServer."""
        upload_url = f"{GEOSERVER_URL}/workspaces/{WORKSPACE}/coveragestores/{store_name}/file.geotiff"
        headers = {"Content-type": "image/tiff"}
        
        try:
            with open(tiff_path, 'rb') as f:
                upload_response = requests.put(
                    upload_url,
                    auth=(GEOSERVER_USER, GEOSERVER_PASSWORD),
                    headers=headers,
                    data=f,
                    timeout=30
                )
            
            if upload_response.status_code not in [200, 201, 202]:
                return False
            
            return True
        except Exception as e:
            print(f"[ERROR] GeoTIFF publish error: {str(e)}")
            return False

    def arcgis_style_idw_ckdtree(
        self,
        coords_xy: np.ndarray,
        values: np.ndarray,
        grid_transform: rasterio.Affine,
        grid_shape: Tuple[int, int],
        power: float = 2.0,
        search_mode: str = "variable",
        n_neighbors: int = 12,
        radius: Optional[float] = None
    ) -> np.ndarray:
        """ArcGIS-style IDW interpolation using cKDTree."""
        print(f"[DEBUG] cKDTree IDW | mode={search_mode}, k={n_neighbors}, power={power}")
        
        rows, cols = int(grid_shape[0]), int(grid_shape[1])
        
        xs = (np.arange(cols, dtype=np.float64) * grid_transform.a) + grid_transform.c + (grid_transform.a / 2.0)
        ys = (np.arange(rows, dtype=np.float64) * grid_transform.e) + grid_transform.f + (grid_transform.e / 2.0)
        grid_x, grid_y = np.meshgrid(xs, ys)
        xi = np.column_stack([grid_x.ravel(), grid_y.ravel()])
        
        coords_xy = np.asarray(coords_xy, dtype=np.float64)
        values = np.asarray(values, dtype=np.float64)
        k = min(max(1, int(n_neighbors)), coords_xy.shape[0])
        
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
        return grid

    def kriging_interpolation(self, points: np.ndarray, values: np.ndarray, grid_x: np.ndarray, grid_y: np.ndarray) -> np.ndarray:
        """Kriging-like interpolation using RBF."""
        data_std = np.std(values)
        epsilon = data_std / 10 if data_std > 0 else 1
        
        try:
            rbf = Rbf(points[:, 0], points[:, 1], values,
                      function='multiquadric', epsilon=epsilon, smooth=0.1)
            xi, yi = np.meshgrid(grid_x, grid_y)
            zi = rbf(xi, yi)
            return zi
        except:
            try:
                rbf = Rbf(points[:, 0], points[:, 1], values,
                          function='gaussian', epsilon=epsilon, smooth=0.1)
                xi, yi = np.meshgrid(grid_x, grid_y)
                zi = rbf(xi, yi)
                return zi
            except:
                rbf = Rbf(points[:, 0], points[:, 1], values,
                          function='linear', smooth=0.1)
                xi, yi = np.meshgrid(grid_x, grid_y)
                zi = rbf(xi, yi)
                return zi

    def spline_interpolation(self, points: np.ndarray, values: np.ndarray, grid_x: np.ndarray, grid_y: np.ndarray) -> np.ndarray:
        """Spline interpolation using griddata."""
        xi, yi = np.meshgrid(grid_x, grid_y)
        try:
            zi = griddata(points, values, (xi, yi), method='cubic', fill_value=np.nan)
            nan_percentage = np.sum(np.isnan(zi)) / zi.size * 100
            if nan_percentage > 50:
                zi = griddata(points, values, (xi, yi), method='linear', fill_value=np.nan)
        except:
            zi = griddata(points, values, (xi, yi), method='linear', fill_value=np.nan)
        return zi

    def process_interpolation(
        self,
        csv_path: Path,
        parameter: str,
        method: str,
        village_ids: List,
        place: str,
        create_colored: bool = True,
        contour_interval: Optional[float] = None,
        generate_contours: bool = False,
        search_mode: str = 'variable',
        n_neighbors: int = 12,
        radius: Optional[float] = None,
        power: float = 2.0,
        cell_size: float = 30.0
    ) -> Dict[str, Any]:
        """Main interpolation processing pipeline."""
        
        # Load CSV data
        df = pd.read_csv(csv_path)
        required_columns = ['LONGITUDE', 'LATITUDE', parameter]
        df = df.dropna(subset=required_columns)
        
        if df.empty:
            raise ValueError('No valid data in CSV')
        
        x = df['LONGITUDE'].values
        y = df['LATITUDE'].values
        z = df[parameter].astype(float).values
        
        # ADD MINIMUM 3 POINTS VALIDATION FOR IDW
        if method == 'idw' and len(x) < 3:
            raise ValueError(
                f"IDW interpolation requires minimum 3 data points. "
                f"Found only {len(x)} points. Please choose at least three points."
            )
        # END VALIDATION
        
        # Generate store name
        csv_name = Path(csv_path).stem
        store_name = f"interpolated_raster_{csv_name}_{parameter.replace(' ', '_')}"
        
        # Load and filter villages
        villages_vector = gpd.read_file(VILLAGES_PATH)
        
        if villages_vector.crs is None:
            villages_vector.set_crs("EPSG:4326", inplace=True)
        if villages_vector.crs != "EPSG:4326":
            villages_vector = villages_vector.to_crs("EPSG:4326")
        
        if place == "village":
            village_ids = [float(x) for x in village_ids]
            selected_area = villages_vector[villages_vector['village_co'].isin(village_ids)]
        elif place == "subdistrict":
            village_ids = [int(x) for x in village_ids]
            selected_area = villages_vector[villages_vector['SUBDIS_COD'].isin(village_ids)]
        else:
            raise ValueError("Invalid place parameter")
        
        if selected_area.empty:
            raise ValueError(f"No {place}s found for provided IDs")
        
        selected_area_utm = selected_area.to_crs("EPSG:32644")
        
        # Prepare points in UTM
        points_gdf = gpd.GeoDataFrame(
            {'val': z},
            geometry=gpd.points_from_xy(x, y, crs="EPSG:4326")
        ).to_crs("EPSG:32644")
        
        coords_xy = np.array([(geom.x, geom.y) for geom in points_gdf.geometry], dtype=np.float64)
        values = points_gdf['val'].astype(float).values
        
        # Calculate grid extent
        sel_minx, sel_miny, sel_maxx, sel_maxy = selected_area_utm.total_bounds
        pts_minx, pts_miny = coords_xy[:,0].min(), coords_xy[:,1].min()
        pts_maxx, pts_maxy = coords_xy[:,0].max(), coords_xy[:,1].max()
        
        minx = min(sel_minx, pts_minx) - cell_size
        miny = min(sel_miny, pts_miny) - cell_size
        maxx = max(sel_maxx, pts_maxx) + cell_size
        maxy = max(sel_maxy, pts_maxy) + cell_size
        
        cols = int(np.ceil((maxx - minx) / cell_size))
        rows = int(np.ceil((maxy - miny) / cell_size))
        proj_transform = from_origin(minx, maxy, cell_size, cell_size)
        
        print(f"[DEBUG] Grid: rows={rows}, cols={cols}, cell_size={cell_size}m")
        
        # Perform interpolation
        if method == 'idw':
            Z_proj = self.arcgis_style_idw_ckdtree(
                coords_xy=coords_xy,
                values=values,
                grid_transform=proj_transform,
                grid_shape=(rows, cols),
                power=power,
                search_mode=search_mode,
                n_neighbors=n_neighbors,
                radius=radius
            )
        elif method == 'kriging':
            xs = np.arange(cols) * proj_transform.a + proj_transform.c + proj_transform.a / 2.0
            ys = np.arange(rows) * proj_transform.e + proj_transform.f + proj_transform.e / 2.0
            Z_proj = self.kriging_interpolation(coords_xy, values, xs, ys)
        elif method == 'spline':
            xs = np.arange(cols) * proj_transform.a + proj_transform.c + proj_transform.a / 2.0
            ys = np.arange(rows) * proj_transform.e + proj_transform.f + proj_transform.e / 2.0
            Z_proj = self.spline_interpolation(coords_xy, values, xs, ys)
        else:
            raise ValueError("Invalid interpolation method")
        
        # Statistics
        z_min, z_max = np.nanmin(Z_proj), np.nanmax(Z_proj)
        z_mean, z_std = np.nanmean(Z_proj), np.nanstd(Z_proj)
        nan_percentage = np.sum(np.isnan(Z_proj)) / Z_proj.size * 100.0
        
        print(f"[DEBUG] Data range: min={z_min:.3f}, max={z_max:.3f}, mean={z_mean:.3f}")
        
        # Create initial raster
        initial_tiff_path = TEMP_DIR / f"{store_name}_initial_utm.tif"
        height, width = Z_proj.shape
        
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
        
        # Create colored raster if requested
        colored_tiff_path = None
        classification_breaks = None
        colors = None
        
        if create_colored:
            colors, labels = self.get_arcmap_colors(parameter)
            colored_grid, classification_breaks = self.create_colored_raster(Z_proj, colors, num_classes=len(colors))
            colored_tiff_path = TEMP_DIR / f"{store_name}_colored_utm.tif"
            
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
        
        # Mask to village boundaries
        masked_tiff_path = TEMP_DIR / f"{store_name}_masked_utm.tif"
        masked_colored_path = None
        
        with rasterio.open(initial_tiff_path) as src:
            valid_geometries = [geom if geom.is_valid else geom.buffer(0) 
                            for geom in selected_area_utm.geometry if geom.is_valid or geom.buffer(0).is_valid]
            
            try:
                unified_geometry = unary_union(valid_geometries)
                mask_geometries = [unified_geometry] if unified_geometry.is_valid else valid_geometries
            except:
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
        
        if create_colored and colored_tiff_path:
            masked_colored_path = TEMP_DIR / f"{store_name}_colored_masked_utm.tif"
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
        
        # Final UTM reprojection
        final_tiff_path = TEMP_DIR / f"{store_name}_final_utm.tif"
        final_colored_path = None
        
        with rasterio.open(masked_tiff_path) as src:
            dst_crs = 'EPSG:32644'
            transform_out, width_out, height_out = calculate_default_transform(
                src.crs, dst_crs, src.width, src.height, *src.bounds, resolution=30
            )
            
            kwargs = src.meta.copy()
            kwargs.update({'crs': dst_crs, 'transform': transform_out, 'width': width_out, 'height': height_out})
            
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
        
        if create_colored and masked_colored_path:
            final_colored_path = TEMP_DIR / f"{store_name}_colored_final_utm.tif"
            with rasterio.open(masked_colored_path) as src_colored:
                dst_crs = 'EPSG:32644'
                transform_c, width_c, height_c = calculate_default_transform(
                    src_colored.crs, dst_crs, src_colored.width, src_colored.height, 
                    *src_colored.bounds, resolution=30
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
        
        # Cleanup intermediate files
        for temp_file in [initial_tiff_path, masked_tiff_path, colored_tiff_path, masked_colored_path]:
            if temp_file and temp_file.exists():
                os.remove(temp_file)
        
        # Generate contours
        contour_geojson = None
        if generate_contours and final_tiff_path.exists():
            contour_geojson = self.generate_contours_as_geojson(final_tiff_path, contour_interval)
        
        # Generate PNG visualization
        png_path = None
        png_base64 = None
        if final_tiff_path.exists():
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
        
        # Publish to GeoServer
        if not self.create_workspace():
            raise Exception("Failed to create GeoServer workspace")
        
        if not self.publish_geotiff(final_tiff_path, store_name):
            raise Exception("Failed to publish GeoTIFF to GeoServer")
        
        published_layers = [store_name]
        
        if create_colored and final_colored_path and final_colored_path.exists():
            colored_store_name = f"{store_name}_colored"
            if self.publish_geotiff(final_colored_path, colored_store_name):
                published_layers.append(colored_store_name)
        
        # Cleanup final files
        if final_tiff_path.exists():
            os.remove(final_tiff_path)
        if final_colored_path and final_colored_path.exists():
            os.remove(final_colored_path)
        
        # Prepare response
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
        
        if png_path and png_base64:
            response_data['visualization'] = {
                'png_path': str(png_path),
                'png_filename': os.path.basename(png_path),
                'png_base64': png_base64,
                'download_url': f"/media/temp/{os.path.basename(png_path)}"
            }
        
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
                    'error': 'Failed to generate contours'
                }
        else:
            response_data['contour_generation'] = {'requested': False}
        
        if create_colored and classification_breaks is not None:
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
        
        return response_data
