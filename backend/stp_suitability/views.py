import os
import json
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .attributes import GetMultipleFileAttributesView
# Updated function to extract ACTUAL metadata from raster files using rasterio with correct resolution calculation
def extract_raster_metadata(file_path):
    """
    Extract actual metadata from raster files like TIF/TIFF using rasterio with corrected resolution calculations
    """
    try:
        import rasterio
        with rasterio.open(file_path) as dataset:
            # Get actual coordinate reference system
            if dataset.crs:
                crs = dataset.crs.to_string()
            else:
                crs = "Unknown"
            
            # Get actual resolution with corrected calculations
            if dataset.transform:
                x_res = abs(dataset.transform[0])
                y_res = abs(dataset.transform[4])
                
                # Check if using geographic coordinates (degrees)
                is_geographic = False
                if crs == "EPSG:4326" or "+proj=longlat" in str(dataset.crs):
                    is_geographic = True
                
                # For geographic coordinates, convert degrees to approximate meters
                if is_geographic:
                    if dataset.bounds:
                        center_lat = (dataset.bounds.bottom + dataset.bounds.top) / 2
                        import math
                        lat_scale = 111320
                        lon_scale = 111320 * math.cos(math.radians(center_lat))
                        
                        x_res_meters = x_res * lon_scale
                        y_res_meters = y_res * lat_scale
                    else:
                        x_res_meters = x_res * 111320
                        y_res_meters = y_res * 111320
                else:
                    x_res_meters = x_res
                    y_res_meters = y_res
                
                # Format with appropriate units based on scale
                def format_resolution(res_meters):
                    if res_meters < 0.01:
                        return f"{res_meters*100:.2f}cm"
                    elif res_meters < 1:
                        return f"{res_meters*100:.0f}cm"
                    elif res_meters >= 1000:
                        return f"{res_meters/1000:.2f}km"
                    else:
                        return f"{res_meters:.2f}m"
                
                x_res_str = format_resolution(x_res_meters)
                y_res_str = format_resolution(y_res_meters)
                
                resolution = f"{x_res_str} x {y_res_str}"
                
                raw_resolution = f"{x_res:.10f} x {y_res:.10f} {('degrees' if is_geographic else 'units')}"
            else:
                resolution = "Unknown"
                raw_resolution = "Unknown"
            
            bounds = dataset.bounds
            dimensions = f"{dataset.width}x{dataset.height} pixels"
            bands = dataset.count
            
            return {
                'coordinateSystem': crs,
                'resolution': resolution,
                'rawResolution': raw_resolution,
                'dimensions': dimensions,
                'bands': bands,
                'bounds': {
                    'left': bounds.left,
                    'bottom': bounds.bottom,
                    'right': bounds.right,
                    'top': bounds.top
                } if bounds else None
            }
    except Exception as e:
        import logging
        logging.error(f"Error extracting raster metadata: {str(e)}")
        return {
            'coordinateSystem': "Raster format",
            'resolution': "Unknown",
            'rawResolution': "Unknown"
        }

# Updated function to extract ACTUAL metadata from vector files using fiona/geopandas
def extract_vector_metadata(file_path):
    """
    Extract actual metadata from vector files like SHP using fiona or geopandas
    """
    prj_file_path = os.path.splitext(file_path)[0] + '.prj'
    extracted_crs = None
    
    if os.path.exists(prj_file_path):
        try:
            with open(prj_file_path, 'r') as prj_file:
                wkt = prj_file.read()
                try:
                    import osgeo.osr as osr
                    srs = osr.SpatialReference()
                    srs.ImportFromWkt(wkt)
                    auth_name = srs.GetAuthorityName(None)
                    auth_code = srs.GetAuthorityCode(None)
                    if auth_name and auth_code:
                        extracted_crs = f"{auth_name}:{auth_code}"
                    else:
                        proj4 = srs.ExportToProj4()
                        if "+proj=longlat +datum=WGS84" in proj4:
                            extracted_crs = "WGS84 Geographic"
                        elif "+proj=utm" in proj4 and "+datum=WGS84" in proj4:
                            import re
                            zone_match = re.search(r'\+zone=(\d+)', proj4)
                            hemisphere = "N" if "+south" not in proj4 else "S"
                            if zone_match:
                                zone = zone_match.group(1)
                                extracted_crs = f"UTM Zone {zone}{hemisphere} WGS84"
                            else:
                                extracted_crs = f"UTM WGS84"
                        elif "+proj=merc" in proj4 and "+datum=WGS84" in proj4:
                            extracted_crs = "Web Mercator (WGS84)"
                        else:
                            proj_match = re.search(r'\+proj=(\w+)', proj4)
                            datum_match = re.search(r'\+datum=(\w+)', proj4)
                            
                            proj = proj_match.group(1) if proj_match else "unknown"
                            datum = datum_match.group(1) if datum_match else "unknown"
                            
                            extracted_crs = f"{proj.upper()} {datum}"
                except (ImportError, Exception):
                    if "GEOGCS[\"WGS" in wkt and "84\"" in wkt:
                        extracted_crs = "WGS84 Geographic"
                    elif "PROJCS[\"UTM" in wkt and "WGS" in wkt and "84\"" in wkt:
                        extracted_crs = "UTM WGS84"
                    else:
                        import re
                        name_match = re.search(r'PROJCS\["([^"]+)"', wkt)
                        if name_match:
                            extracted_crs = name_match.group(1)
                        else:
                            name_match = re.search(r'GEOGCS\["([^"]+)"', wkt)
                            if name_match:
                                extracted_crs = name_match.group(1)
                            else:
                                extracted_crs = wkt[:50] + "..." if len(wkt) > 50 else wkt
        except Exception as e:
            import logging
            logging.warning(f"Could not read PRJ file: {str(e)}")
    
    try:
        import fiona
        with fiona.open(file_path) as dataset:
            if not extracted_crs:
                crs = dataset.crs.get('init', dataset.crs) if dataset.crs else "Unknown"
                if isinstance(crs, dict):
                    if 'init' in crs:
                        crs = crs['init'].upper()
                    elif 'name' in crs:
                        crs = crs['name']
                    else:
                        crs = str(crs)
            else:
                crs = extracted_crs
            
            feature_count = len(dataset)
            schema = dataset.schema
            geometry_type = schema['geometry'] if 'geometry' in schema else "Unknown"
            attributes = list(schema['properties'].keys()) if 'properties' in schema else []
            bounds = dataset.bounds if hasattr(dataset, 'bounds') else None
            
            return {
                'coordinateSystem': crs,
                'resolution': "N/A",
                'featureCount': feature_count,
                'geometryType': geometry_type,
                'attributes': attributes,
                'bounds': {
                    'left': bounds[0],
                    'bottom': bounds[1],
                    'right': bounds[2],
                    'top': bounds[3]
                } if bounds else None
            }
    except ImportError:
        try:
            import geopandas as gpd
            gdf = gpd.read_file(file_path)
            
            if not extracted_crs:
                crs = gdf.crs.to_string() if hasattr(gdf.crs, 'to_string') else str(gdf.crs)
            else:
                crs = extracted_crs
            
            feature_count = len(gdf)
            geometry_type = gdf.geometry.geom_type.value_counts().index[0] if not gdf.empty else "Unknown"
            attributes = list(gdf.columns)
            if 'geometry' in attributes:
                attributes.remove('geometry')
            
            bounds = gdf.total_bounds if hasattr(gdf, 'total_bounds') else None
            
            return {
                'coordinateSystem': crs,
                'resolution': "N/A",
                'featureCount': feature_count,
                'geometryType': geometry_type,
                'attributes': attributes,
                'bounds': {
                    'left': bounds[0],
                    'bottom': bounds[1],
                    'right': bounds[2],
                    'top': bounds[3]
                } if bounds is not None else None
            }
        except ImportError:
            import logging
            logging.warning("Neither Fiona nor GeoPandas is available. Install with 'pip install fiona' or 'pip install geopandas' for actual metadata extraction.")
            
            if extracted_crs:
                return {
                    'coordinateSystem': extracted_crs,
                    'resolution': "N/A"
                }
            else:
                return {
                    'coordinateSystem': "Unknown (spatial libraries not installed)",
                    'resolution': "N/A"
                }
        except Exception as e:
            import logging
            logging.error(f"Error extracting vector metadata with geopandas: {str(e)}")
            
            if extracted_crs:
                return {
                    'coordinateSystem': extracted_crs,
                    'resolution': "N/A"
                }
            else:
                return extract_crs_from_prj_file(file_path)
    except Exception as e:
        import logging
        logging.error(f"Error extracting vector metadata with fiona: {str(e)}")
        
        if extracted_crs:
            return {
                'coordinateSystem': extracted_crs,
                'resolution': "N/A"
            }
        else:
            return extract_crs_from_prj_file(file_path)

def extract_crs_from_prj_file(shapefile_path):
    """
    Extracts coordinate system info from a .prj file as a last resort
    """
    prj_file_path = os.path.splitext(shapefile_path)[0] + '.prj'
    
    if os.path.exists(prj_file_path):
        try:
            with open(prj_file_path, 'r') as prj_file:
                wkt = prj_file.read().strip()
                if wkt:
                    if "GEOGCS[\"WGS" in wkt and "84\"" in wkt:
                        return {
                            'coordinateSystem': "WGS84 Geographic",
                            'resolution': "N/A"
                        }
                    elif "PROJCS[\"UTM" in wkt and "WGS" in wkt and "84\"" in wkt:
                        import re
                        zone_match = re.search(r'UTM Zone (\d+)', wkt)
                        if zone_match:
                            zone = zone_match.group(1)
                            hemisphere = "N" if "North" in wkt else "S" if "South" in wkt else ""
                            return {
                                'coordinateSystem': f"UTM Zone {zone}{hemisphere} WGS84",
                                'resolution': "N/A"
                            }
                        else:
                            return {
                                'coordinateSystem': "UTM WGS84",
                                'resolution': "N/A"
                            }
                    elif "PROJCS[\"NAD" in wkt:
                        return {
                            'coordinateSystem': "NAD Projection",
                            'resolution': "N/A"
                        }
                    elif "PROJCS[\"Web_Mercator" in wkt or "PROJCS[\"WGS_1984_Web_Mercator" in wkt:
                        return {
                            'coordinateSystem': "Web Mercator",
                            'resolution': "N/A"
                        }
                    else:
                        import re
                        name_match = re.search(r'PROJCS\["([^"]+)"', wkt)
                        if name_match:
                            return {
                                'coordinateSystem': name_match.group(1),
                                'resolution': "N/A"
                            }
                        else:
                            name_match = re.search(r'GEOGCS\["([^"]+)"', wkt)
                            if name_match:
                                return {
                                    'coordinateSystem': name_match.group(1),
                                    'resolution': "N/A"
                                }
                            else:
                                if wkt.startswith("PROJCS"):
                                    return {
                                        'coordinateSystem': "Projected Coordinate System",
                                        'resolution': "N/A"
                                    }
                                elif wkt.startswith("GEOGCS"):
                                    return {
                                        'coordinateSystem': "Geographic Coordinate System",
                                        'resolution': "N/A"
                                    }
                                else:
                                    return {
                                        'coordinateSystem': "Custom Coordinate System",
                                        'resolution': "N/A"
                                    }
        except Exception as e:
            import logging
            logging.error(f"Error reading PRJ file: {str(e)}")
    
    return {
        'coordinateSystem': "Shapefile (Unknown CRS)",
        'resolution': "N/A"
    }

@api_view(['GET'])
def get_conditioning_factors(request):
    """
    Get all files from the conditioningFactors directory
    """
    conditioning_directory = os.path.join(settings.MEDIA_ROOT,'stp_suitability', 'conditioningFactors')
    
    if not os.path.exists(conditioning_directory):
        return Response(
            {'error': f'Directory not found: {conditioning_directory}'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    file_extensions = {
        'shp': 'Shapefile',
        'shx': 'Shape index',
        'dbf': 'dBase table',
        'prj': 'Projection',
        'tif': 'GeoTIFF',
        'tiff': 'GeoTIFF',
        'sbx': 'Spatial index',
        'sbn': 'Spatial index',
        'cpg': 'Code page',
        'xml': 'XML metadata'
    }
    
    conditioning_files = []
    
    for root, dirs, files in os.walk(conditioning_directory):
        for file in files:
            file_extension = os.path.splitext(file)[1][1:].lower()
            
            if file_extension in file_extensions:
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
                
                file_stats = os.stat(file_path)
                
                file_format = "Raster" if file_extension in ['tif', 'tiff'] else "Vector" if file_extension == 'shp' else "Other"
                
                metadata = {}
                if file_format == "Raster":
                    metadata = extract_raster_metadata(file_path)
                elif file_format == "Vector":
                    metadata = extract_vector_metadata(file_path)
                else:
                    metadata = {
                        'coordinateSystem': "",
                        'resolution': ""
                    }
                
                file_info = {
                    'id': file.replace('.', '_'),
                    'name': file,
                    'type': 'conditioning_factors',
                    'description': f"{file_extensions.get(file_extension, 'Unknown')} file for conditioning factor analysis",
                    'fileType': file_extension,
                    'filePath': relative_path,
                    'size': file_stats.st_size,
                    'lastModified': file_stats.st_mtime,
                    'format': file_format,
                    'coordinateSystem': metadata['coordinateSystem'],
                    'resolution': metadata['resolution']
                }
                
                if 'dimensions' in metadata:
                    file_info['dimensions'] = metadata['dimensions']
                if 'bands' in metadata:
                    file_info['bands'] = metadata['bands']
                if 'featureCount' in metadata:
                    file_info['featureCount'] = metadata['featureCount']
                if 'geometryType' in metadata:
                    file_info['geometryType'] = metadata['geometryType']
                if 'attributes' in metadata:
                    file_info['attributes'] = metadata['attributes']
                if 'bounds' in metadata and metadata['bounds']:
                    file_info['bounds'] = metadata['bounds']
                
                conditioning_files.append(file_info)
    
    return Response(conditioning_files)

@api_view(['GET'])
def get_constraints_factors(request):
    """
    Get all files from the constraintsFactors directory
    """
    constraints_directory = os.path.join(settings.MEDIA_ROOT, 'stp_suitability', 'constraintsFactors')
    
    if not os.path.exists(constraints_directory):
        return Response(
            {'error': f'Directory not found: {constraints_directory}'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    file_extensions = {
        'shp': 'Shapefile',
        'shx': 'Shape index',
        'dbf': 'dBase table',
        'prj': 'Projection',
        'tif': 'GeoTIFF',
        'tiff': 'GeoTIFF',
        'sbx': 'Spatial index',
        'sbn': 'Spatial index',
        'cpg': 'Code page',
        'xml': 'XML metadata'
    }
    
    constraints_files = []
    
    for root, dirs, files in os.walk(constraints_directory):
        for file in files:
            file_extension = os.path.splitext(file)[1][1:].lower()
            
            if file_extension in file_extensions:
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
                
                file_stats = os.stat(file_path)
                
                file_format = "Raster" if file_extension in ['tif', 'tiff'] else "Vector" if file_extension == 'shp' else "Other"
                
                metadata = {}
                if file_format == "Raster":
                    metadata = extract_raster_metadata(file_path)
                elif file_format == "Vector":
                    metadata = extract_vector_metadata(file_path)
                else:
                    metadata = {
                        'coordinateSystem': "",
                        'resolution': ""
                    }
                
                file_info = {
                    'id': file.replace('.', '_'),
                    'name': file,
                    'type': 'constraints_factors',
                    'description': f"{file_extensions.get(file_extension, 'Unknown')} file for constraints analysis",
                    'fileType': file_extension,
                    'filePath': relative_path,
                    'size': file_stats.st_size,
                    'lastModified': file_stats.st_mtime,
                    'format': file_format,
                    'coordinateSystem': metadata['coordinateSystem'],
                    'resolution': metadata['resolution']
                }
                
                if 'dimensions' in metadata:
                    file_info['dimensions'] = metadata['dimensions']
                if 'bands' in metadata:
                    file_info['bands'] = metadata['bands']
                if 'featureCount' in metadata:
                    file_info['featureCount'] = metadata['featureCount']
                if 'geometryType' in metadata:
                    file_info['geometryType'] = metadata['geometryType']
                if 'attributes' in metadata:
                    file_info['attributes'] = metadata['attributes']
                if 'bounds' in metadata and metadata['bounds']:
                    file_info['bounds'] = metadata['bounds']
                
                constraints_files.append(file_info)
    
    return Response(constraints_files)

@api_view(['POST'])
def process_selected_files(request):
    """
    Process the selected datasets (constraints and conditioning factors)
    Works with direct file references instead of database records
    """
    try:
        data = json.loads(request.body)
        constraint_ids = data.get('constraintIds', [])
        conditioning_ids = data.get('conditioningIds', [])
        
        # Validate that at least one dataset is selected
        if not constraint_ids and not conditioning_ids:
            return Response(
                {'error': 'At least one dataset must be selected for analysis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Process constraints files (from constraintsFactors directory)
        constraints_directory = os.path.join(settings.MEDIA_ROOT,'stp_suitability', 'constraintsFactors')
        constraints_files = []
        
        for file_id in constraint_ids:
            filename = file_id.replace('_', '.', 1)
            
            found = False
            for root, _, files in os.walk(constraints_directory):
                if filename in files:
                    file_path = os.path.join(root, filename)
                    relative_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
                    file_extension = os.path.splitext(filename)[1][1:].lower()
                    
                    file_format = "Raster" if file_extension in ['tif', 'tiff'] else "Vector" if file_extension == 'shp' else "Other"
                    
                    metadata = {}
                    if file_format == "Raster":
                        metadata = extract_raster_metadata(file_path)
                    elif file_format == "Vector":
                        metadata = extract_vector_metadata(file_path)
                    else:
                        metadata = {
                            'coordinateSystem': "",
                            'resolution': ""
                        }
                    
                    file_info = {
                        'id': file_id,
                        'name': filename,
                        'filePath': relative_path,
                        'fileType': file_extension,
                        'format': file_format,
                        'coordinateSystem': metadata['coordinateSystem'],
                        'resolution': metadata['resolution']
                    }
                    
                    if 'dimensions' in metadata:
                        file_info['dimensions'] = metadata['dimensions']
                    if 'bands' in metadata:
                        file_info['bands'] = metadata['bands']
                    if 'featureCount' in metadata:
                        file_info['featureCount'] = metadata['featureCount']
                    if 'geometryType' in metadata:
                        file_info['geometryType'] = metadata['geometryType']
                    if 'attributes' in metadata:
                        file_info['attributes'] = metadata['attributes']
                    if 'bounds' in metadata and metadata['bounds']:
                        file_info['bounds'] = metadata['bounds']
                    
                    constraints_files.append(file_info)
                    
                    found = True
                    break
            
            if not found:
                return Response(
                    {'error': f'Constraint file with ID {file_id} not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Process conditioning files (from conditioningFactors directory)
        conditioning_directory = os.path.join(settings.MEDIA_ROOT,'stp_suitability',  'conditioningFactors')
        conditioning_files = []
        
        for file_id in conditioning_ids:
            filename = file_id.replace('_', '.', 1)
            
            found = False
            for root, _, files in os.walk(conditioning_directory):
                if filename in files:
                    file_path = os.path.join(root, filename)
                    relative_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
                    file_extension = os.path.splitext(filename)[1][1:].lower()
                    
                    file_format = "Raster" if file_extension in ['tif', 'tiff'] else "Vector" if file_extension == 'shp' else "Other"
                    
                    metadata = {}
                    if file_format == "Raster":
                        metadata = extract_raster_metadata(file_path)
                    elif file_format == "Vector":
                        metadata = extract_vector_metadata(file_path)
                    else:
                        metadata = {
                            'coordinateSystem': "",
                            'resolution': ""
                        }
                    
                    file_info = {
                        'id': file_id,
                        'name': filename,
                        'filePath': relative_path,
                        'fileType': file_extension,
                        'format': file_format,
                        'coordinateSystem': metadata['coordinateSystem'],
                        'resolution': metadata['resolution']
                    }
                    
                    if 'dimensions' in metadata:
                        file_info['dimensions'] = metadata['dimensions']
                    if 'bands' in metadata:
                        file_info['bands'] = metadata['bands']
                    if 'featureCount' in metadata:
                        file_info['featureCount'] = metadata['featureCount']
                    if 'geometryType' in metadata:
                        file_info['geometryType'] = metadata['geometryType']
                    if 'attributes' in metadata:
                        file_info['attributes'] = metadata['attributes']
                    if 'bounds' in metadata and metadata['bounds']:
                        file_info['bounds'] = metadata['bounds']
                    
                    conditioning_files.append(file_info)
                    
                    found = True
                    break
            
            if not found:
                return Response(
                    {'error': f'Conditioning file with ID {file_id} not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        return Response({
            'message': 'Files selected successfully',
            'selected': {
                'constraints': constraints_files,
                'conditioning': conditioning_files
            }
        })
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def get_file_details(request, file_id):
    """
    Get details for a specific file including metadata
    Works with direct file references instead of database records
    """
    try:
        filename = file_id.replace('_', '.', 1)
        
        directories = [
            os.path.join(settings.MEDIA_ROOT, 'stp_suitability', 'constraintsFactors'),
            os.path.join(settings.MEDIA_ROOT, 'stp_suitability','conditioningFactors')
        ]
        
        found = False
        file_path = None
        file_type = None
        
        for directory in directories:
            if not os.path.exists(directory):
                continue
                
            for root, _, files in os.walk(directory):
                if filename in files:
                    file_path = os.path.join(root, filename)
                    relative_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
                    file_extension = os.path.splitext(filename)[1][1:].lower()
                    
                    if 'constraintsFactors' in directory:
                        file_type = 'constraints_factors'
                    elif 'conditioningFactors' in directory:
                        file_type = 'conditioning_factors'
                    
                    found = True
                    break
            
            if found:
                break
        
        if not found or not file_path:
            return Response(
                {'error': f'File not found: {filename}'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        file_stats = os.stat(file_path)
        
        file_format = "Raster" if file_extension in ['tif', 'tiff'] else "Vector" if file_extension == 'shp' else "Other"
        
        metadata = {}
        if file_format == "Raster":
            metadata = extract_raster_metadata(file_path)
        elif file_format == "Vector":
            metadata = extract_vector_metadata(file_path)
        else:
            metadata = {
                'coordinateSystem': "",
                'resolution': ""
            }
        
        file_info = {
            'id': file_id,
            'name': filename,
            'type': file_type,
            'description': f"{file_type} file ({file_extension})",
            'fileType': file_extension,
            'filePath': relative_path,
            'size': file_stats.st_size,
            'lastModified': file_stats.st_mtime,
            'format': file_format,
            'coordinateSystem': metadata['coordinateSystem'],
            'resolution': metadata['resolution']
        }
        
        file_info['detailed_metadata'] = {}
        
        if 'dimensions' in metadata:
            file_info['detailed_metadata']['dimensions'] = metadata['dimensions']
        if 'bands' in metadata:
            file_info['detailed_metadata']['bands'] = metadata['bands']
        if 'featureCount' in metadata:
            file_info['detailed_metadata']['feature_count'] = metadata['featureCount']
        if 'geometryType' in metadata:
            file_info['detailed_metadata']['geometry_type'] = metadata['geometryType']
        if 'attributes' in metadata:
            file_info['detailed_metadata']['attributes'] = metadata['attributes']
        if 'bounds' in metadata and metadata['bounds']:
            file_info['detailed_metadata']['bounds'] = metadata['bounds']
        
        return Response(file_info)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


