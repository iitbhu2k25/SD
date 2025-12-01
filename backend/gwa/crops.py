import os
import tempfile
from datetime import datetime
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import JSONParser
from django.http import JsonResponse
import uuid
from rest_framework.permissions import AllowAny
from .models import Crop  # Import your Crop model


class GetCropsBySeasonView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]
    
    def post(self, request, *args, **kwargs):
        try:
            # Check if season is in the request
            if 'season' not in request.data:
                return Response({
                    'error': 'No season provided',
                    'message': 'Please provide a season in the request body'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            season = request.data.get('season')
            
            # Validate season (optional - you can add your own validation)
            valid_seasons = ['Kharif', 'Rabi', 'Zaid']
            if season not in valid_seasons:
                return Response({
                    'error': 'Invalid season',
                    'message': f'Season must be one of: {", ".join(valid_seasons)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Query crops for the given season
            crops_queryset = Crop.objects.filter(season__iexact=season)
            
            if not crops_queryset.exists():
                return Response({
                    'success': True,
                    'message': f'No crops found for season: {season}',
                    'data': {
                        'season': season,
                        'crops': [],
                        'total_crops': 0,
                        'queried_at': datetime.now().isoformat()
                    }
                }, status=status.HTTP_200_OK)
            
            # Extract crop names (you can modify this based on what data you want to return)
            crop_names = list(crops_queryset.values_list('crop', flat=True).distinct())
            
            # If you want to return more detailed information, use this instead:
            # crop_details = list(crops_queryset.values('id', 'crop', 'stage', 'period', 'crop_factor'))
            
            return Response({
                'success': True,
                'message': f'Crops retrieved successfully for season: {season}',
                'data': {
                    'season': season,
                    'crops': crop_names,  # or crop_details for detailed info
                    'total_crops': len(crop_names),
                    'queried_at': datetime.now().isoformat()
                }
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': 'Query failed',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
