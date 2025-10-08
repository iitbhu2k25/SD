import os
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

class CSVUploadView(APIView):
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)
    
    def post(self, request, *args, **kwargs):
        try:
            # Check if CSV file is in the request
            if 'csv_file' not in request.FILES:
                return Response({
                    'error': 'No CSV file provided',
                    'message': 'Please upload a CSV file with key "csv_file"'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            csv_file = request.FILES['csv_file']
            
            # Validate file extension
            if not csv_file.name.endswith('.csv'):
                return Response({
                    'error': 'Invalid file format',
                    'message': 'Only CSV files are allowed'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create temp directory inside media if it doesn't exist
            media_dir = os.path.join(settings.BASE_DIR, 'media')
            temp_dir = os.path.join(media_dir, 'temp')
            os.makedirs(temp_dir, exist_ok=True)
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id = str(uuid.uuid4())[:8]
            filename = f"csv_{timestamp}_{unique_id}.csv"
            file_path = os.path.join(temp_dir, filename)
            
            # Save the CSV file
            with open(file_path, 'wb+') as destination:
                for chunk in csv_file.chunks():
                    destination.write(chunk)
            
            # Get file info
            file_size = os.path.getsize(file_path)
            
            return Response({
                'success': True,
                'message': 'CSV file uploaded successfully',
                'data': {
                    'filename': filename,
                    'original_name': csv_file.name,
                    'file_path': file_path,
                    'file_size': f"{file_size} bytes",
                    'uploaded_at': datetime.now().isoformat(),
                    'temp_directory': temp_dir
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({
                'error': 'Upload failed',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)