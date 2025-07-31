from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import geopandas as gpd
import pandas as pd
import numpy as np
import os
from scipy.interpolate import griddata, Rbf
from django.conf import settings
import json
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from matplotlib.cm import ScalarMappable
import matplotlib.colors as mcolors
from shapely.geometry import LineString, Point, Polygon
import uuid
import tempfile
import matplotlib.path
from pykrige.ok import OrdinaryKriging



class BasinBoundaryAPIView(APIView):
    def get(self, request, format=None):
        try:
            # Path to the basin shapefile
            shapefile_path = os.path.join(settings.MEDIA_ROOT, 'gwa_data', 'basin', 'basin.shp')
            
            # Log path information for debugging
            print(f"Looking for basin boundary shapefile")
            print(f"Full path to shapefile: {shapefile_path}")
            print(f"File exists: {os.path.exists(shapefile_path)}")
            
            if not os.path.exists(shapefile_path):
                return Response(
                    {'error': f'Basin shapefile does not exist at path: {shapefile_path}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Read the shapefile using GeoPandas
            gdf = gpd.read_file(shapefile_path)
            
            if gdf.empty:
                return Response(
                    {'error': 'Basin shapefile is empty or contains no valid geometries'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check for invalid geometries
            if not gdf.geometry.is_valid.all():
                print("Invalid geometries found, attempting to fix...")
                gdf.geometry = gdf.geometry.buffer(0)  # Attempt to fix invalid geometries
            
            # Ensure CRS is EPSG:4326 (standard for GeoJSON)
            if gdf.crs and gdf.crs != "EPSG:4326":
                gdf = gdf.to_crs("EPSG:4326")
            
            # Convert to GeoJSON
            geojson = gdf.to_json()
            
            # Parse and validate GeoJSON to catch issues
            try:
                parsed_geojson = json.loads(geojson)
                if parsed_geojson.get("type") != "FeatureCollection":
                    raise ValueError("Generated GeoJSON is not a FeatureCollection")
            except json.JSONDecodeError as e:
                return Response(
                    {'error': 'Failed to generate valid GeoJSON', 'detail': str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            return Response(parsed_geojson, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print("Basin shapefile read error:", e)
            print(traceback.format_exc())
            return Response(
                {
                    'error': str(e),
                    'type': str(type(e).__name__),
                    'detail': traceback.format_exc()
                }, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class WellGeoJSONAPIView(APIView):
    def get(self, request, format=None):
        try:
            well_id = request.GET.get('id', '1')
            well_key = f"well-{well_id}"
            
            shapefile_base = os.path.join(settings.MEDIA_ROOT, 'gwa_data', 'well')
            
            # Log path information for debugging
            print(f"Looking for well with ID: {well_key}")
            print(f"Shapefile base directory: {shapefile_base}")
            
            shapefile_map = {
                'well-1': 'clip.shp',
                # Add more mappings if needed
            }
            
            shapefile_name = shapefile_map.get(well_key, 'clip.shp')
            shapefile_path = os.path.join(shapefile_base, shapefile_name)
            
            print(f"Full path to shapefile: {shapefile_path}")
            print(f"File exists: {os.path.exists(shapefile_path)}")
            
            if not os.path.exists(shapefile_path):
                return Response(
                    {'error': f'Shapefile does not exist at path: {shapefile_path}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            gdf = gpd.read_file(shapefile_path)
            
            if gdf.empty:
                return Response(
                    {'error': 'Shapefile is empty or contains no valid geometries'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check for invalid geometries
            if not gdf.geometry.is_valid.all():
                print("Invalid geometries found, attempting to fix...")
                gdf.geometry = gdf.geometry.buffer(0)  # Attempt to fix invalid geometries
            
            # Ensure CRS is EPSG:4326 (standard for GeoJSON)
            if gdf.crs and gdf.crs != "EPSG:4326":
                gdf = gdf.to_crs("EPSG:4326")
            
            # Convert to GeoJSON
            geojson = gdf.to_json()
            
            # Parse and validate GeoJSON to catch issues
            try:
                parsed_geojson = json.loads(geojson)
                if parsed_geojson.get("type") != "FeatureCollection":
                    raise ValueError("Generated GeoJSON is not a FeatureCollection")
            except json.JSONDecodeError as e:
                return Response(
                    {'error': 'Failed to generate valid GeoJSON', 'detail': str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            return Response(parsed_geojson, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print("Shapefile read error:", e)
            print(traceback.format_exc())
            return Response(
                {
                    'error': str(e),
                    'type': str(type(e).__name__),
                    'detail': traceback.format_exc()
                }, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ContourAPIView(APIView):
    def post(self, request, format=None):
        try:
            # Get parameters from request
            method = request.data.get('method')
            parameter = request.data.get('parameter')
            data_type = request.data.get('data_type')  # 'PRE' or 'POST'
            year = request.data.get('year')
            interval = request.data.get('interval')
            
            # Validate inputs
            if not all([method, parameter, interval]):
                return Response(
                    {'error': 'Missing required parameters: method, parameter, interval'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Handle parameter logic
            if parameter == 'Rainfall':  # Frontend now uses 'Rainfall' directly
                # For Rainfall, always use POST_2011
                data_type = 'POST'
                year = 2011
            elif not all([data_type, year]):
                return Response(
                    {'error': 'Data type (PRE/POST) and Year parameters are required for groundwater level'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Path to shapefile
            shapefile_path = os.path.join(settings.MEDIA_ROOT, 'gwa_data', 'well', 'clip.shp')
            
            if not os.path.exists(shapefile_path):
                return Response(
                    {'error': f'Shapefile not found at: {shapefile_path}'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Read shapefile using GeoPandas
            try:
                gdf = gpd.read_file(shapefile_path)
                
                # Print columns for debugging
                print(f"Shapefile columns: {gdf.columns.tolist()}")
                
                # Handle parameters and determine column to use
                param_column = None
                if parameter == 'Rainfall':
                    # For Rainfall, always use the RL column (as POST_2011)
                    if 'RL' in gdf.columns:
                        param_column = 'RL'
                    else:
                        return Response(
                            {'error': 'RL column not found in shapefile'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                elif parameter == 'gwl':
                    # For gwl, use the specified PRE/POST and year
                    year_str = str(year)
                    column_name = f'{data_type}_{year_str}'
                    
                    if column_name in gdf.columns:
                        param_column = column_name
                    else:
                        return Response(
                            {'error': f'Column {column_name} not found in shapefile. Available columns: {gdf.columns.tolist()}'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
                
                # Extract coordinates and parameter values
                # First check if there are x, y columns
                if 'x' in gdf.columns and 'y' in gdf.columns:
                    x = gdf['x'].values
                    y = gdf['y'].values
                else:
                    # Extract coordinates from geometry
                    x = gdf.geometry.x.values
                    y = gdf.geometry.y.values
                
                # Get parameter values
                z = gdf[param_column].values
                
                # Remove NaN values
                valid_indices = ~np.isnan(z)
                x = x[valid_indices]
                y = y[valid_indices]
                z = z[valid_indices]
                
                if len(z) < 3:
                    return Response(
                        {'error': f'Not enough valid data points for interpolation. Found only {len(z)} points.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Create a DataFrame for debugging
                print(f"Using {len(z)} points for interpolation")
                df = pd.DataFrame({'x': x, 'y': y, 'value': z})
                print(df.head())
                
            except Exception as e:
                return Response(
                    {'error': f'Error reading shapefile: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Prepare data for interpolation
            x = df['x'].values
            y = df['y'].values
            z = df['value'].values
            
            # Create grid for interpolation
            grid_size = 100  # Resolution of the grid
            x_min, x_max = x.min(), x.max()
            y_min, y_max = y.min(), y.max()
            
            xi = np.linspace(x_min, x_max, grid_size)
            yi = np.linspace(y_min, y_max, grid_size)
            xi_grid, yi_grid = np.meshgrid(xi, yi)
            
            # Perform interpolation based on method
            if method == 'idw':
                # Inverse Distance Weighted
                zi_grid = self._idw_interpolation(x, y, z, xi_grid, yi_grid)
            elif method == 'kriging':
                # Kriging
                zi_grid = self._kriging_interpolation(x, y, z, xi_grid, yi_grid)
            elif method == 'spline':
                # Spline (Radial Basis Function)
                zi_grid = self._spline_interpolation(x, y, z, xi_grid, yi_grid)
            else:
                return Response(
                    {'error': f'Unsupported interpolation method: {method}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Generate contours
            geojson_data = self._generate_contours(xi_grid, yi_grid, zi_grid, interval)
            
            # Generate a color map for visualization
            colormap_url = self._generate_colormap(z.min(), z.max(), parameter)
            
            # Get the shapefile boundary as GeoJSON for reference
            boundary_gdf = gpd.read_file(shapefile_path)
            
            # If there's a specific CRS in the shapefile, ensure it's in WGS84 for web mapping
            if boundary_gdf.crs and boundary_gdf.crs != "EPSG:4326":
                boundary_gdf = boundary_gdf.to_crs("EPSG:4326")
            
            # Get the boundary GeoJSON
            boundary_geojson = json.loads(boundary_gdf.to_json())
            
            # Return the GeoJSON, boundary GeoJSON, and colormap URL
            return Response({
                'geojson': geojson_data,
                'boundary_geojson': boundary_geojson,
                'colormap_url': colormap_url,
                'min_value': float(z.min()),
                'max_value': float(z.max()),
                'parameter': parameter,
                'data_type': data_type,
                'year': year,
                'method': method,
                'interval': interval,
                'selected_column': param_column,  # Added this to show which column was actually used
                'point_count': len(z)  # Add point count for reference
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            import traceback
            print("Contour generation error:", e)
            print(traceback.format_exc())
            return Response(
                {
                    'error': str(e),
                    'type': str(type(e).__name__),
                    'detail': traceback.format_exc()
                }, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    # The remaining methods (_idw_interpolation, _kriging_interpolation, etc.) remain unchanged
    def _idw_interpolation(self, x, y, z, xi_grid, yi_grid):
        """Inverse Distance Weighted interpolation"""
        # Flatten the grid coordinates
        points = np.column_stack((x, y))
        xi_flat = xi_grid.flatten()
        yi_flat = yi_grid.flatten()
        grid_points = np.column_stack((xi_flat, yi_flat))
        
        # Perform IDW interpolation
        power = 2  # The power parameter (typical values: 1-3)
        zi_flat = np.zeros(len(grid_points))
        
        for i in range(len(grid_points)):
            # Calculate distances from the point to all known points
            distances = np.sqrt(((points - grid_points[i])**2).sum(axis=1))
            
            # Avoid division by zero by setting a minimum distance
            distances[distances < 1e-10] = 1e-10
            
            # Calculate weights based on distances
            weights = 1.0 / (distances ** power)
            weights_sum = weights.sum()
            
            # Calculate the weighted average
            zi_flat[i] = (weights * z).sum() / weights_sum
        
        # Reshape back to grid
        zi_grid = zi_flat.reshape(xi_grid.shape)
        return zi_grid
    
    def _kriging_interpolation(self, x, y, z, xi_grid, yi_grid):
        """Kriging interpolation using pykrige"""
        try:
            # Create ordinary kriging object
            ok = OrdinaryKriging(
                x, y, z,
                variogram_model='spherical',
                verbose=False,
                enable_plotting=False
            )
            
            # Make the prediction
            zi_grid, variance = ok.execute('grid', xi_grid[0], yi_grid[:, 0])
            return zi_grid
        except Exception as e:
            print(f"Kriging error: {e}")
            # Fallback to griddata if kriging fails
            points = np.column_stack((x, y))
            zi_grid = griddata(points, z, (xi_grid, yi_grid), method='cubic', fill_value=np.nan)
            return zi_grid
    
    def _spline_interpolation(self, x, y, z, xi_grid, yi_grid):
        """Spline interpolation using Radial Basis Functions"""
        try:
            # Create RBF interpolator
            rbf = Rbf(x, y, z, function='thin_plate', smooth=0.1)
            
            # Make prediction
            zi_grid = rbf(xi_grid, yi_grid)
            return zi_grid
        except Exception as e:
            print(f"RBF error: {e}")
            # Fallback to griddata if RBF fails
            points = np.column_stack((x, y))
            zi_grid = griddata(points, z, (xi_grid, yi_grid), method='cubic', fill_value=np.nan)
            return zi_grid
    
    def _generate_contours(self, xi_grid, yi_grid, zi_grid, interval):
        """Generate contour lines and convert to GeoJSON"""
        # Generate contour levels based on the interval
        z_min = np.nanmin(zi_grid)
        z_max = np.nanmax(zi_grid)
        
        # Generate levels with the specified interval
        levels = np.arange(
            np.floor(z_min / interval) * interval,
            np.ceil(z_max / interval) * interval + interval,
            interval
        )
        
        # Generate contours
        fig, ax = plt.subplots()
        contour_data = ax.contour(xi_grid, yi_grid, zi_grid, levels=levels)
        
        # Convert contours to GeoJSON
        features = []
        
        # Use allsegs attribute which is more reliable across matplotlib versions
        for i, level in enumerate(contour_data.levels):
            segments = contour_data.allsegs[i]
            
            for segment in segments:
                if len(segment) > 1:
                    linestring = LineString(segment)
                    
                    feature = {
                        "type": "Feature",
                        "properties": {
                            "value": float(level),
                            "color": self._get_color_for_value(
                                level, 
                                np.nanmin(zi_grid),
                                np.nanmax(zi_grid)
                            )
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [[float(x), float(y)] for x, y in linestring.coords]
                        }
                    }
                    features.append(feature)
        
        # Close the plot to free memory
        plt.close(fig)
        
        # Create GeoJSON FeatureCollection
        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        
        return geojson
    
    def _get_color_for_value(self, value, min_val, max_val):
        """Generate a color for a contour value using a color map"""
        # Use a colormap (e.g., viridis, plasma, inferno, magma, cividis)
        cmap = plt.cm.viridis
        norm = Normalize(vmin=min_val, vmax=max_val)
        rgba = cmap(norm(value))
        
        # Convert RGBA to hex
        hex_color = mcolors.rgb2hex(rgba)
        return hex_color
    
    def _generate_colormap(self, min_val, max_val, parameter):
        """Generate a colormap image and return its URL"""
        # Create a unique filename
        filename = f"colormap_{parameter}_{uuid.uuid4().hex}.png"
        file_path = os.path.join(settings.MEDIA_ROOT, 'colormaps', filename)
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Create the colormap image
        fig, ax = plt.figure(figsize=(6, 1)), plt.axes()
        fig.subplots_adjust(bottom=0.5)
        
        # Use viridis colormap
        cmap = plt.cm.viridis
        norm = Normalize(vmin=min_val, vmax=max_val)
        
        # Create a ScalarMappable with the colormap
        sm = ScalarMappable(cmap=cmap, norm=norm)
        sm.set_array([])
        
        # Create a colorbar
        cbar = plt.colorbar(sm, cax=ax, orientation='horizontal', label=parameter)
        
        # Save the image
        plt.savefig(file_path, bbox_inches='tight', dpi=100)
        plt.close()
        
        # Return the URL to the image
        url = settings.MEDIA_URL + 'colormaps/' + filename
        return url