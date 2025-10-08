# csv_validation_views.py

import os
import csv
import io
import tempfile
from datetime import datetime
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import JsonResponse
import uuid
from rest_framework.permissions import AllowAny

# Required CSV columns
REQUIRED_COLUMNS = ['HYDROGRAPH', 'LATITUDE', 'LONGITUDE']

class CSVValidationView(APIView):
    """
    API endpoint to validate CSV file structure
    URL: /api/validate-csv/
    Method: POST
    """
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request, *args, **kwargs):
        try:
            # Check if CSV file is in the request
            if 'csv_file' not in request.FILES:
                return Response({
                    'valid': False,
                    'error': 'No CSV file provided',
                    'message': 'Please upload a CSV file with key "csv_file"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            csv_file = request.FILES['csv_file']
            
            # Validate file extension
            if not csv_file.name.endswith('.csv'):
                return Response({
                    'valid': False,
                    'error': 'Invalid file format',
                    'message': 'Only CSV files are allowed'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check file size (limit to 10MB)
            if csv_file.size > 10 * 1024 * 1024:
                return Response({
                    'valid': False,
                    'error': 'File too large',
                    'message': 'Maximum file size allowed is 10MB'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Read and validate CSV content
            try:
                # Decode file content
                file_content = csv_file.read().decode('utf-8')
                csv_file.seek(0)  # Reset file pointer
                
                # Parse CSV
                csv_reader = csv.DictReader(io.StringIO(file_content))
                headers = csv_reader.fieldnames
                
                if not headers:
                    return Response({
                        'valid': False,
                        'error': 'Empty file',
                        'message': 'CSV file is empty or has no headers'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Clean headers (remove extra spaces and quotes)
                clean_headers = [header.strip().strip('"\'') for header in headers]
                
                # Check for required columns
                missing_columns = []
                for required_col in REQUIRED_COLUMNS:
                    if required_col not in clean_headers:
                        missing_columns.append(required_col)
                
                if missing_columns:
                    return Response({
                        'valid': False,
                        'error': 'Missing required columns',
                        'message': f'Missing required columns: {", ".join(missing_columns)}',
                        'missing_columns': missing_columns,
                        'required_columns': REQUIRED_COLUMNS,
                        'found_columns': clean_headers
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Validate data rows
                rows = list(csv_reader)
                if len(rows) == 0:
                    return Response({
                        'valid': False,
                        'error': 'No data',
                        'message': 'CSV file contains no data rows'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Validate required field values and data types
                validation_errors = []
                for row_num, row in enumerate(rows, start=2):  # Start from 2 (header is row 1)
                    # Check if required fields are empty
                    for required_col in REQUIRED_COLUMNS:
                        if not row.get(required_col, '').strip():
                            validation_errors.append(f'Row {row_num}: {required_col} is empty')
                    
                    # Validate latitude format and range
                    try:
                        LATITUDE = float(row.get('LATITUDE', 0))
                        if not (-90 <= LATITUDE <= 90):
                            validation_errors.append(f'Row {row_num}: Invalid latitude value ({LATITUDE}). Must be between -90 and 90')
                    except (ValueError, TypeError):
                        validation_errors.append(f'Row {row_num}: Invalid latitude format. Must be a number')
                    
                    # Validate longitude format and range
                    try:
                        LONGITUDE = float(row.get('LONGITUDE', 0))
                        if not (-180 <= LONGITUDE <= 180):
                            validation_errors.append(f'Row {row_num}: Invalid longitude value ({LONGITUDE}). Must be between -180 and 180')
                    except (ValueError, TypeError):
                        validation_errors.append(f'Row {row_num}: Invalid longitude format. Must be a number')
                
                # Return validation errors if any (limit to first 10)
                if validation_errors:
                    return Response({
                        'valid': False,
                        'error': 'Data validation failed',
                        'message': f'Found {len(validation_errors)} validation errors',
                        'validation_errors': validation_errors[:10],
                        'total_errors': len(validation_errors)
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # If all validations pass
                return Response({
                    'valid': True,
                    'message': 'CSV file is valid and ready for upload',
                    'data': {
                        'filename': csv_file.name,
                        'file_size': csv_file.size,
                        'file_size_mb': round(csv_file.size / (1024 * 1024), 2),
                        'total_rows': len(rows),
                        'total_columns': len(clean_headers),
                        'columns': clean_headers,
                        'required_columns_found': REQUIRED_COLUMNS,
                        'validated_at': datetime.now().isoformat()
                    }
                }, status=status.HTTP_200_OK)
                
            except UnicodeDecodeError:
                return Response({
                    'valid': False,
                    'error': 'Encoding error',
                    'message': 'Unable to read CSV file. Please ensure it is properly encoded (UTF-8)'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            except csv.Error as e:
                return Response({
                    'valid': False,
                    'error': 'CSV parsing error',
                    'message': f'Error parsing CSV file: {str(e)}'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            return Response({
                'valid': False,
                'error': 'Server error',
                'message': f'Internal server error during validation: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CSVUploadView(APIView):
    """
    API endpoint to upload and process validated CSV file
    URL: /api/upload-csv/
    Method: POST
    """
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request, *args, **kwargs):
        try:
            # Check if CSV file is in the request
            if 'csv_file' not in request.FILES:
                return Response({
                    'success': False,
                    'error': 'No CSV file provided',
                    'message': 'Please upload a CSV file with key "csv_file"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            csv_file = request.FILES['csv_file']
            
            # Validate file extension
            if not csv_file.name.endswith('.csv'):
                return Response({
                    'success': False,
                    'error': 'Invalid file format',
                    'message': 'Only CSV files are allowed'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Quick validation before upload
            validation_result = self.validate_csv_quick(csv_file)
            if not validation_result['valid']:
                return Response({
                    'success': False,
                    'error': 'Validation failed',
                    'message': validation_result['message']
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create temp directory inside media if it doesn't exist
            media_dir = os.path.join(settings.BASE_DIR, 'media')
            uploads_dir = os.path.join(media_dir, 'uploads', 'csv')
            os.makedirs(uploads_dir, exist_ok=True)
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id = str(uuid.uuid4())[:8]
            filename = f"wells_data_{timestamp}_{unique_id}.csv"
            file_path = os.path.join(uploads_dir, filename)
            
            # Save the CSV file
            with open(file_path, 'wb+') as destination:
                for chunk in csv_file.chunks():
                    destination.write(chunk)
            
            # Process CSV data for preview
            csv_file.seek(0)  # Reset file pointer
            file_content = csv_file.read().decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(file_content))
            
            processed_wells = []
            for row_num, row in enumerate(csv_reader, start=1):
                well_data = {
                    'row_number': row_num,
                    'well_name': row.get('HYDROGRAPH', '').strip(),
                    'latitude': float(row.get('LATITUDE', 0)),
                    'longitude': float(row.get('LONGITUDE', 0)),
                    # Include any additional columns
                    'additional_data': {key: value for key, value in row.items() 
                                     if key not in REQUIRED_COLUMNS}
                }
                processed_wells.append(well_data)
            
            # Get file info
            file_size = os.path.getsize(file_path)
            
            # Here you would typically save to database
            # Example:
            # for well in processed_wells:
            #     WellModel.objects.create(
            #         name=well['well_name'],
            #         latitude=well['latitude'],
            #         longitude=well['longitude'],
            #         additional_data=well['additional_data']
            #     )
            
            return Response({
                'success': True,
                'message': 'CSV file uploaded and processed successfully',
                'data': {
                    'upload_id': f"{timestamp}_{unique_id}",
                    'filename': filename,
                    'original_name': csv_file.name,
                    'file_path': file_path,
                    'file_size': f"{file_size} bytes",
                    'file_size_mb': round(file_size / (1024 * 1024), 2),
                    'wells_processed': len(processed_wells),
                    'uploaded_at': datetime.now().isoformat(),
                    'upload_directory': uploads_dir
                },
                'wells_preview': processed_wells[:5],  # Return first 5 wells as preview
                'total_wells': len(processed_wells)
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({
                'success': False,
                'error': 'Upload failed',
                'message': f'Internal server error during upload: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def validate_csv_quick(self, csv_file):
        """
        Quick validation helper method
        """
        try:
            file_content = csv_file.read().decode('utf-8')
            csv_file.seek(0)  # Reset file pointer
            
            csv_reader = csv.DictReader(io.StringIO(file_content))
            headers = csv_reader.fieldnames
            
            if not headers:
                return {'valid': False, 'message': 'CSV file is empty or has no headers'}
            
            clean_headers = [header.strip().strip('"\'') for header in headers]
            
            # Check for required columns
            missing_columns = [col for col in REQUIRED_COLUMNS if col not in clean_headers]
            if missing_columns:
                return {'valid': False, 'message': f'Missing required columns: {", ".join(missing_columns)}'}
            
            return {'valid': True, 'message': 'CSV is valid'}
            
        except Exception as e:
            return {'valid': False, 'message': f'Validation error: {str(e)}'}
