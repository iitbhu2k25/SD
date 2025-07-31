import os
import uuid
import json
import tempfile
import numpy as np
from osgeo import gdal, ogr, osr
from django.conf import settings
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view
import rasterio
import geopandas as gpd
import pandas as pd
from sklearn.neighbors import KNeighborsRegressor
from sklearn.preprocessing import StandardScaler
from scipy.interpolate import Rbf
from pykrige.ok import OrdinaryKriging
from shapely.geometry import Point

from .models import InterpolatedTiff
from .serializers import InterpolatedTiffSerializer


class InterpolatedTiffListView(APIView):
    """API view to list all interpolated TIFF files"""
    
    def get(self, request):
        """Get all interpolated TIFF files"""
        tiffs = InterpolatedTiff.objects.all()
        serializer = InterpolatedTiffSerializer(tiffs, many=True)
        return Response(serializer.data)


class GetMultipleAttributesView(APIView):
    """API view to get attributes from multiple shapefiles"""
    
    def post(self, request):
        file_paths = request.data.get('file_paths', [])
        
        if not file_paths:
            return Response(
                {"error": "No file paths provided"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        attributes = {}
        
        for file_path in file_paths:
            try:
                # Skip non-DBF files for attribute extraction
                if not file_path.lower().endswith('.dbf'):
                    continue
                    
                # Construct the full path to the file
                full_path = os.path.join(settings.BASE_DIR, file_path)
                
                if not os.path.exists(full_path):
                    continue
                
                # For DBF files, read with pandas
                df = gpd.read_file(full_path)
                
                # Get the column names as attributes
                attrs = df.columns.tolist()
                
                # Remove geometry column if it exists
                if 'geometry' in attrs:
                    attrs.remove('geometry')
                
                # Store the attributes
                file_name = os.path.basename(file_path)
                attributes[file_name] = attrs
                
            except Exception as e:
                print(f"Error extracting attributes from {file_path}: {str(e)}")
                # Continue with other files even if one fails
        
        return Response({"attributes": attributes})


class InterpolateView(APIView):
    """API view to perform interpolation on shapefiles"""
    
    def post(self, request):
        interpolation_requests = request.data.get('interpolation_requests', [])
        
        if not interpolation_requests:
            return Response(
                {"error": "No interpolation requests provided"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = []
        
        try:
            for req in interpolation_requests:
                shapefile_path = req.get('shapefile_path')
                dbf_path = req.get('dbf_path')
                attribute = req.get('attribute')
                method = req.get('method', 'idw')
                
                if not all([shapefile_path, attribute, method]):
                    return Response(
                        {"error": f"Missing required parameters for interpolation: shapefile_path, attribute, method"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Construct full paths
                shapefile_full_path = os.path.join(settings.BASE_DIR, 'stp_suitability', 'conditioningFactors', shapefile_path)
                
                # If DBF path is not provided, try to infer it
                if not dbf_path:
                    base_name = os.path.splitext(shapefile_path)[0]
                    dbf_path = f"{base_name}.dbf"
                
                dbf_full_path = os.path.join(settings.BASE_DIR, 'stp_suitability', 'conditioningFactors', dbf_path)
                
                # Check if files exist
                if not os.path.exists(shapefile_full_path):
                    alt_shapefile_path = os.path.join(settings.BASE_DIR, 'stp_suitability', 'constraintsFactors', shapefile_path)
                    if os.path.exists(alt_shapefile_path):
                        shapefile_full_path = alt_shapefile_path
                    else:
                        return Response(
                            {"error": f"Shapefile not found: {shapefile_path}"}, 
                            status=status.HTTP_404_NOT_FOUND
                        )
                
                if not os.path.exists(dbf_full_path):
                    alt_dbf_path = os.path.join(settings.BASE_DIR, 'stp_suitability', 'constraintsFactors', dbf_path)
                    if os.path.exists(alt_dbf_path):
                        dbf_full_path = alt_dbf_path
                
                # Generate a unique output file name
                output_filename = f"interpolated_{method}_{os.path.splitext(shapefile_path)[0]}_{attribute}_{uuid.uuid4().hex[:8]}.tif"
                output_dir = os.path.join(settings.BASE_DIR, 'stp_suitability', 'interpolated_tiffs')
                
                # Create directory if it doesn't exist
                os.makedirs(output_dir, exist_ok=True)
                
                output_path = os.path.join(output_dir, output_filename)
                
                # Perform the interpolation
                result = self.perform_interpolation(
                    shapefile_full_path, 
                    attribute, 
                    method, 
                    output_path
                )
                
                if result.get('success'):
                    # Prepare relative file path for storage
                    relative_file_path = os.path.join('stp_suitability', 'interpolated_tiffs', output_filename)
                    
                    # Save to database
                    tiff_data = {
                        'filename': output_filename,
                        'file_path': relative_file_path,
                        'original_shapefile': shapefile_path,
                        'attribute': attribute,
                        'interpolation_method': method,
                        'metadata': result.get('metadata', {})
                    }
                    
                    serializer = InterpolatedTiffSerializer(data=tiff_data)
                    if serializer.is_valid():
                        tiff_instance = serializer.save()
                        
                        # Add to results
                        results.append({
                            'id': str(tiff_instance.id),
                            'filename': output_filename,
                            'file_path': relative_file_path,
                            'original_shapefile': shapefile_path,
                            'attribute': attribute,
                            'method': method,
                            'metadata': result.get('metadata', {})
                        })
                    else:
                        # Log serializer errors but continue processing
                        print(f"Serializer errors: {serializer.errors}")
                        results.append({
                            'filename': output_filename,
                            'file_path': relative_file_path,
                            'original_shapefile': shapefile_path,
                            'attribute': attribute,
                            'method': method,
                            'metadata': result.get('metadata', {})
                        })
                else:
                    return Response(
                        {"error": result.get('error', 'Unknown error during interpolation')}, 
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            
            return Response({
                "success": True,
                "tiff_files": results
            })
            
        except Exception as e:
            return Response(
                {"error": f"Interpolation failed: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def perform_interpolation(self, shapefile_path, attribute, method, output_path):
        try:
            # Load shapefile with GeoPandas
            gdf = gpd.read_file(shapefile_path)
            
            # Check if the attribute exists
            if attribute not in gdf.columns:
                return {'success': False, 'error': f"Attribute '{attribute}' not found in shapefile"}
            
            # Extract coordinates and values
            coords = []
            values = []
            
            for idx, row in gdf.iterrows():
                if row.geometry is None:
                    continue
                    
                if row.geometry.geom_type == 'Point':
                    x, y = row.geometry.x, row.geometry.y
                    coords.append((x, y))
                    values.append(row[attribute])
                elif row.geometry.geom_type == 'Polygon' or row.geometry.geom_type == 'MultiPolygon':
                    # Use centroid for polygons
                    centroid = row.geometry.centroid
                    coords.append((centroid.x, centroid.y))
                    values.append(row[attribute])
                elif row.geometry.geom_type == 'LineString' or row.geometry.geom_type == 'MultiLineString':
                    # Use centroid for lines
                    centroid = row.geometry.centroid
                    coords.append((centroid.x, centroid.y))
                    values.append(row[attribute])
            
            if not coords:
                return {'success': False, 'error': "No valid geometries found for interpolation"}
            
            # Convert to numpy arrays
            coords = np.array(coords)
            values = np.array(values)
            
            # Check for non-numeric values
            try:
                values = values.astype(float)
            except ValueError:
                return {'success': False, 'error': f"Attribute '{attribute}' contains non-numeric values"}
            
            # Get the bounding box of the data
            min_x, min_y = np.min(coords, axis=0)
            max_x, max_y = np.max(coords, axis=0)
            
            # Add a small buffer around the bounding box
            buffer_x = (max_x - min_x) * 0.1
            buffer_y = (max_y - min_y) * 0.1
            min_x -= buffer_x
            min_y -= buffer_y
            max_x += buffer_x
            max_y += buffer_y
            
            # Set up grid for interpolation
            grid_size = 100  # Default grid size
            x_grid = np.linspace(min_x, max_x, grid_size)
            y_grid = np.linspace(min_y, max_y, grid_size)
            xx, yy = np.meshgrid(x_grid, y_grid)
            
            # Interpolate based on selected method
            if method.lower() == 'idw':
                grid_values = self.idw_interpolation(coords, values, xx, yy)
            elif method.lower() == 'kriging':
                grid_values = self.kriging_interpolation(coords, values, xx, yy)
            elif method.lower() == 'spline':
                grid_values = self.spline_interpolation(coords, values, xx, yy)
            else:
                return {'success': False, 'error': f"Unknown interpolation method: {method}"}
            
            # Create raster from interpolated values
            self.create_raster(grid_values, output_path, min_x, max_y, (max_x - min_x) / grid_size, (max_y - min_y) / grid_size)
            
            # Calculate basic statistics for metadata
            metadata = {
                'min_value': float(np.nanmin(grid_values)),
                'max_value': float(np.nanmax(grid_values)),
                'mean_value': float(np.nanmean(grid_values)),
                'std_dev': float(np.nanstd(grid_values)),
                'resolution_x': float((max_x - min_x) / grid_size),
                'resolution_y': float((max_y - min_y) / grid_size),
                'width': int(grid_size),
                'height': int(grid_size),
                'crs': str(gdf.crs)
            }
            
            return {'success': True, 'metadata': metadata}
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    def idw_interpolation(self, coords, values, xx, yy, p=2):
        """Inverse Distance Weighting interpolation"""
        # Prepare meshgrid points as (x,y) pairs
        grid_points = np.column_stack((xx.flatten(), yy.flatten()))
        
        # Use scikit-learn's KNeighborsRegressor for IDW
        idw = KNeighborsRegressor(
            n_neighbors=min(15, len(coords)),  # Use at most 15 neighbors
            weights=lambda dists: 1.0 / (dists ** p)  # IDW formula
        )
        
        idw.fit(coords, values)
        grid_values = idw.predict(grid_points)
        
        return grid_values.reshape(xx.shape)
    
    def kriging_interpolation(self, coords, values, xx, yy):
        """Ordinary Kriging interpolation"""
        # Extract x and y coordinates
        x = coords[:, 0]
        y = coords[:, 1]
        
        # Create an ordinary kriging model
        OK = OrdinaryKriging(
            x,
            y,
            values,
            variogram_model='spherical',
            verbose=False,
            enable_plotting=False,
        )
        
        # Make a prediction on a grid
        z, ss = OK.execute('grid', xx[0, :], yy[:, 0])
        
        return z
    
    def spline_interpolation(self, coords, values, xx, yy):
        """Radial Basis Function interpolation (spline)"""
        # Extract x and y coordinates
        x = coords[:, 0]
        y = coords[:, 1]
        
        # Create a radial basis function interpolator
        rbf = Rbf(x, y, values, function='thin_plate')
        
        # Interpolate on the grid
        grid_values = rbf(xx, yy)
        
        return grid_values
    
    def create_raster(self, grid_values, output_path, x_min, y_max, pixel_width, pixel_height):
        """Create a GeoTIFF raster from interpolated values"""
        # Flip the grid values to match GeoTIFF orientation
        grid_values = np.flipud(grid_values)
        
        # Create the GeoTIFF file
        driver = gdal.GetDriverByName('GTiff')
        rows, cols = grid_values.shape
        
        # Create the dataset
        dataset = driver.Create(
            output_path, 
            cols, 
            rows, 
            1,  # Number of bands
            gdal.GDT_Float32  # Data type
        )
        
        # Set the geotransform
        dataset.SetGeoTransform((
            x_min,         # Upper left x
            pixel_width,   # W-E pixel resolution
            0,             # Rotation (0 = north up)
            y_max,         # Upper left y
            0,             # Rotation (0 = north up)
            -pixel_height  # N-S pixel resolution (negative value = north up)
        ))
        
        # Set the projection (WGS84)
        srs = osr.SpatialReference()
        srs.ImportFromEPSG(4326)  # WGS84
        dataset.SetProjection(srs.ExportToWkt())
        
        # Write the data
        band = dataset.GetRasterBand(1)
        band.WriteArray(grid_values)
        
        # Compute statistics
        band.FlushCache()
        band.ComputeStatistics(False)
        
        # Close the dataset
        dataset = None