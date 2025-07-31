from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import os
import logging
import json
from django.conf import settings

logger = logging.getLogger(__name__)

class GetMultipleFileAttributesView(APIView):
    def post(self, request, *args, **kwargs):
        try:
            # Get file paths from request - support both single path and list of paths
            file_paths = request.data.get('file_paths', [])
            
            # Convert to list if a single string is provided
            if isinstance(file_paths, str):
                file_paths = [file_paths]
            
            # Also support JSON string input
            if isinstance(file_paths, str) and (file_paths.startswith('[') or file_paths.startswith('{')):
                try:
                    file_paths = json.loads(file_paths)
                except:
                    pass
            
            if not file_paths:
                return Response({'error': 'No file paths provided'}, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"Processing file paths: {file_paths}")
            
            attributes_result = {}
            
            # Process each file path
            for file_path in file_paths:
                # Construct the full path
                full_path = os.path.join(settings.MEDIA_ROOT, file_path)
                logger.info(f"Processing file: {full_path}")
                
                # Check if file exists
                if not os.path.exists(full_path):
                    logger.error(f"File does not exist: {full_path}")
                    base_name = os.path.splitext(os.path.basename(file_path))[0]
                    attributes_result[base_name] = {'error': 'File not found', 'attributes': []}
                    continue
                
                # Extract attributes based on file type
                attributes = self.extract_attributes(full_path)
                
                # Get the base name without extension for the response
                base_name = os.path.splitext(os.path.basename(file_path))[0]
                attributes_result[base_name] = attributes
            
            return Response(
                {'attributes': attributes_result}, 
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error(f"Error processing files: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def extract_attributes(self, file_path):
        """Extract attributes from a spatial file based on its type"""
        file_ext = os.path.splitext(file_path)[1].lower()
        
        try:
            if file_ext == '.shp':
                return self.extract_shapefile_attributes(file_path)
            elif file_ext == '.dbf':
                return self.extract_dbf_attributes(file_path)
            else:
                logger.warning(f"Unsupported file type for attribute extraction: {file_path}")
                return []
        except Exception as e:
            logger.error(f"Error extracting attributes: {str(e)}")
            return []
    
    def extract_dbf_attributes(self, file_path):
        """Extract attributes from a DBF file"""
        # Try dbfread first
        try:
            import dbfread
            logger.info(f"Reading DBF with dbfread: {file_path}")
            table = dbfread.DBF(file_path)
            fields = table.field_names
            if fields:
                logger.info(f"Extracted attributes from DBF: {fields}")
                return fields
        except Exception as e:
            logger.error(f"Dbfread extraction failed: {str(e)}")
        
        # Try simpledbf as fallback
        try:
            from simpledbf import Dbf5
            logger.info(f"Reading DBF with simpledbf: {file_path}")
            dbf = Dbf5(file_path)
            df = dbf.to_dataframe()
            columns = list(df.columns)
            if columns:
                logger.info(f"Extracted attributes using simpledbf: {columns}")
                return columns
        except Exception as e:
            logger.error(f"Simpledbf extraction failed: {str(e)}")
        
        # Try pandas as last resort
        try:
            import pandas as pd
            logger.info(f"Reading DBF with pandas: {file_path}")
            # Try different pandas methods
            try:
                # Try using pyarrow engine
                df = pd.read_table(file_path, sep='\t')
            except:
                try:
                    # Try using PyTables
                    store = pd.HDFStore(file_path)
                    df = store.select('table')
                    store.close()
                except:
                    # Last attempt - try to read as csv
                    df = pd.read_csv(file_path, encoding='latin1')
            
            columns = list(df.columns)
            if columns:
                logger.info(f"Extracted attributes from DBF using pandas: {columns}")
                return columns
        except Exception as e:
            logger.error(f"Pandas extraction failed: {str(e)}")
        
        # If all methods fail, return empty list
        logger.warning(f"All DBF extraction methods failed for {file_path}")
        return []
    
    def extract_shapefile_attributes(self, file_path):
        """Extract attributes from a shapefile"""
        # Try geopandas first
        try:
            import geopandas as gpd
            logger.info(f"Reading shapefile with geopandas: {file_path}")
            gdf = gpd.read_file(file_path)
            
            # Get attribute columns (exclude geometry)
            columns = [col for col in gdf.columns if col.lower() != 'geometry']
            if columns:
                logger.info(f"Extracted attributes using geopandas: {columns}")
                return columns
        except Exception as e:
            logger.error(f"Geopandas extraction failed: {str(e)}")
        
        # Try pyshp as fallback
        try:
            import shapefile
            logger.info(f"Reading shapefile with pyshp: {file_path}")
            sf = shapefile.Reader(file_path)
            fields = [field[0] for field in sf.fields if field[0] != 'DeletionFlag']
            if fields:
                logger.info(f"Extracted attributes using pyshp: {fields}")
                return fields
        except Exception as e:
            logger.error(f"Pyshp extraction failed: {str(e)}")
        
        # Try fiona as another fallback
        try:
            import fiona
            logger.info(f"Reading shapefile with fiona: {file_path}")
            with fiona.open(file_path) as source:
                schema = source.schema
                fields = list(schema['properties'].keys())
                if fields:
                    logger.info(f"Extracted attributes using fiona: {fields}")
                    return fields
        except Exception as e:
            logger.error(f"Fiona extraction failed: {str(e)}")
        
        # If all methods fail, check for associated DBF file
        try:
            dbf_path = os.path.splitext(file_path)[0] + '.dbf'
            if os.path.exists(dbf_path):
                return self.extract_dbf_attributes(dbf_path)
        except Exception:
            pass
        
        # If everything fails, return empty list
        return []