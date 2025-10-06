# gwa/views.py

from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
import json
import pandas as pd
from .models import Well
from gwa.models import  State, District, Subdistrict,Village
from .pdf_generator import generate_gwqi_report
from .session_manager import session_manager
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# UTILITY FUNCTION FOR YEAR VALIDATION
def validate_year_range(year_int):
    """
    Validate year is between 2019 and current year
    
    Args:
        year_int: Year as integer
    
    Returns:
        tuple: (is_valid, error_message)
    """
    current_year = datetime.now().year
    if year_int < 2019:
        return False, f'Year must be 2019 or later'
    if year_int > current_year:
        return False, f'Year cannot be in the future (current year: {current_year})'
    return True, None


class WellsView(APIView):
    """Optimized Wells API with select_related and only"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            data = request.data
            subdis_cod = data.get('subdis_cod', [])
            year = data.get('year')
            
            print(f"[DEBUG] Wells request - Subdistricts: {subdis_cod}, Year: {year}")
            
            # Validation
            if not subdis_cod:
                return Response({
                    'error': 'No subdistrict codes provided',
                    'code': 'MISSING_SUBDIS_COD'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if not year:
                return Response({
                    'error': 'Year parameter is required',
                    'code': 'MISSING_YEAR'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # UPDATED YEAR VALIDATION
            try:
                year_int = int(year)
                is_valid, error_msg = validate_year_range(year_int)
                if not is_valid:
                    return Response({
                        'error': error_msg,
                        'code': 'INVALID_YEAR_RANGE'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({
                    'error': 'Year must be a valid integer',
                    'code': 'INVALID_YEAR_FORMAT'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                subdis_codes_int = [int(code) for code in subdis_cod]
            except (ValueError, TypeError):
                return Response({
                    'error': 'Invalid subdistrict codes format',
                    'code': 'INVALID_SUBDIS_FORMAT'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            print(f"[DEBUG] Filtering wells: {subdis_codes_int}, year: {year_int}")
            
            # OPTIMIZED QUERY with select_related and only
            wells = Well.objects.filter(
                SUBDIS_COD__in=subdis_codes_int,
                YEAR=year_int
            ).select_related(
                'village_code'
            ).only(
                'id', 'Location', 'Latitude', 'Longitude',
                'DISTRICT', 'SUB_DISTRI', 'SUBDIS_COD', 'village_code_id', 'YEAR',
                'ph_level', 'electrical_conductivity', 'carbonate', 'bicarbonate',
                'chloride', 'fluoride', 'sulfate', 'nitrate', 'phosphate',
                'Hardness', 'calcium', 'magnesium', 'sodium', 'potassium',
                'iron', 'arsenic', 'uranium'
            )
            
            wells_count = wells.count()
            print(f"[DEBUG] Found {wells_count} wells (OPTIMIZED QUERY)")
            
            if wells_count == 0:
                return Response({
                    'message': f'No wells found for year {year_int}',
                    'count': 0,
                    'year': year_int,
                    'subdistricts_searched': subdis_codes_int,
                    'data': []
                }, status=status.HTTP_200_OK)
            
            # Use values() for efficient serialization - single query
            wells_data = list(wells.values(
                'id', 'Location', 'Latitude', 'Longitude',
                'DISTRICT', 'SUB_DISTRI', 'SUBDIS_COD', 'village_code_id', 'YEAR',
                'ph_level', 'electrical_conductivity', 'carbonate', 'bicarbonate',
                'chloride', 'fluoride', 'sulfate', 'nitrate', 'phosphate',
                'Hardness', 'calcium', 'magnesium', 'sodium', 'potassium',
                'iron', 'arsenic', 'uranium'
            ))
            
            print(f"[SUCCESS] Returning {len(wells_data)} wells (1 optimized query)")
            
            return Response(wells_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in WellsView: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to fetch wells: {str(e)}',
                'code': 'WELLS_FETCH_ERROR'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class WellsByVillageView(APIView):
    """Optimized Wells API for drain system - village-based"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            data = request.data
            village_codes = data.get('village_codes', [])
            year = data.get('year')
            
            print(f"[DEBUG] Drain Wells request - Village codes: {village_codes}, Year: {year}")
            
            # Validation
            if not village_codes:
                return Response({
                    'error': 'No village codes provided',
                    'code': 'MISSING_VILLAGE_CODES'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if not year:
                return Response({
                    'error': 'Year parameter is required',
                    'code': 'MISSING_YEAR'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # UPDATED YEAR VALIDATION
            try:
                year_int = int(year)
                is_valid, error_msg = validate_year_range(year_int)
                if not is_valid:
                    return Response({
                        'error': error_msg,
                        'code': 'INVALID_YEAR_RANGE'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({
                    'error': 'Year must be a valid integer',
                    'code': 'INVALID_YEAR_FORMAT'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                village_codes_int = [int(code) for code in village_codes]
            except (ValueError, TypeError):
                return Response({
                    'error': 'Invalid village codes format',
                    'code': 'INVALID_VILLAGE_FORMAT'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            print(f"[DEBUG] Filtering wells: {village_codes_int}, year: {year_int}")
            
            # OPTIMIZED QUERY
            wells_query = Well.objects.filter(
                village_code_id__in=village_codes_int,
                YEAR=year_int
            ).select_related(
                'village_code'
            ).only(
                'id', 'village_code_id', 'Location', 'Latitude', 'Longitude', 'YEAR',
                'DISTRICT', 'SUB_DISTRI', 'SUBDIS_COD', 'STATE', 'STATE_CODE',
                'ph_level', 'electrical_conductivity', 'Hardness',
                'carbonate', 'bicarbonate', 'chloride', 'fluoride',
                'sulfate', 'nitrate', 'phosphate',
                'calcium', 'magnesium', 'sodium', 'potassium',
                'iron', 'arsenic', 'uranium',
                'FID_Village', 'village'
            )
            
            wells_count = wells_query.count()
            print(f"[DEBUG] Found {wells_count} wells for drain system")
            
            if wells_count == 0:
                print(f"[INFO] No wells found for village codes {village_codes_int} and year {year_int}")
                return Response([], status=status.HTTP_200_OK)
            
            # Efficient serialization
            wells_data = list(wells_query.values(
                'id', 'village_code_id', 'Location', 'Latitude', 'Longitude', 'YEAR',
                'DISTRICT', 'SUB_DISTRI', 'SUBDIS_COD', 'STATE', 'STATE_CODE',
                'ph_level', 'electrical_conductivity', 'Hardness',
                'carbonate', 'bicarbonate', 'chloride', 'fluoride',
                'sulfate', 'nitrate', 'phosphate',
                'calcium', 'magnesium', 'sodium', 'potassium',
                'iron', 'arsenic', 'uranium',
                'FID_Village', 'village'
            ))
            
            # Transform to expected format
            transformed_data = []
            for well in wells_data:
                transformed_data.append({
                    'id': well['id'],
                    'VILLAGE_CODE': well['village_code_id'],
                    'LOCATION': well['Location'] or '',
                    'LATITUDE': float(well['Latitude']) if well['Latitude'] else None,
                    'LONGITUDE': float(well['Longitude']) if well['Longitude'] else None,
                    'YEAR': well['YEAR'],
                    'DISTRICT': well['DISTRICT'] or '',
                    'SUB_DISTRICT': well['SUB_DISTRI'] or '',
                    'SUBDIS_CODE': well['SUBDIS_COD'],
                    'STATE': well['STATE'] or '',
                    'STATE_CODE': well['STATE_CODE'],
                    'PH_LEVEL': float(well['ph_level']) if well['ph_level'] is not None else None,
                    'ELECTRICAL_CONDUCTIVITY': float(well['electrical_conductivity']) if well['electrical_conductivity'] is not None else None,
                    'HARDNESS': float(well['Hardness']) if well['Hardness'] is not None else None,
                    'CARBONATE': float(well['carbonate']) if well['carbonate'] is not None else None,
                    'BICARBONATE': float(well['bicarbonate']) if well['bicarbonate'] is not None else None,
                    'CHLORIDE': float(well['chloride']) if well['chloride'] is not None else None,
                    'FLUORIDE': float(well['fluoride']) if well['fluoride'] is not None else None,
                    'SULFATE': float(well['sulfate']) if well['sulfate'] is not None else None,
                    'NITRATE': float(well['nitrate']) if well['nitrate'] is not None else None,
                    'PHOSPHATE': float(well['phosphate']) if well['phosphate'] is not None else None,
                    'CALCIUM': float(well['calcium']) if well['calcium'] is not None else None,
                    'MAGNESIUM': float(well['magnesium']) if well['magnesium'] is not None else None,
                    'SODIUM': float(well['sodium']) if well['sodium'] is not None else None,
                    'POTASSIUM': float(well['potassium']) if well['potassium'] is not None else None,
                    'IRON': float(well['iron']) if well['iron'] is not None else None,
                    'ARSENIC': float(well['arsenic']) if well['arsenic'] is not None else None,
                    'URANIUM': float(well['uranium']) if well['uranium'] is not None else None,
                    'FID_VILLAGE': well['FID_Village'],
                    'VILLAGE_NAME': well['village'],
                })
            
            print(f"[SUCCESS] Returning {len(transformed_data)} groundwater quality wells (1 optimized query)")
            
            return Response(transformed_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"[ERROR] Exception in WellsByVillageView: {str(e)}")
            import traceback
            traceback.print_exc()
            logger.error(f"Error in WellsByVillageView: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to fetch village wells: {str(e)}',
                'code': 'VILLAGE_WELLS_FETCH_ERROR'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@require_http_methods(["POST"])
def validate_csv(request):
    """Validate uploaded CSV files with year context"""
    try:
        if 'csv_file' not in request.FILES:
            return JsonResponse({
                'valid': False,
                'message': 'No CSV file uploaded'
            }, status=400)
        
        csv_file = request.FILES['csv_file']
        
        # Check file extension
        if not csv_file.name.endswith('.csv'):
            return JsonResponse({
                'valid': False,
                'message': 'File must be a CSV format'
            }, status=400)
        
        # Check file size (limit to 50MB)
        if csv_file.size > 50 * 1024 * 1024:
            return JsonResponse({
                'valid': False,
                'message': 'File size must be less than 50MB'
            }, status=400)
        
        # Read and validate CSV content
        try:
            csv_content = csv_file.read().decode('utf-8')
            lines = csv_content.split('\n')
            
            if len(lines) < 2:
                return JsonResponse({
                    'valid': False,
                    'message': 'CSV must contain at least a header row and one data row'
                }, status=400)
            
            header_line = lines[0].strip()
            if not header_line:
                return JsonResponse({
                    'valid': False,
                    'message': 'CSV must have a valid header row'
                }, status=400)
            
            headers = [h.strip().strip('"') for h in header_line.split(',')]
            
            # Check for required columns
            required_coords = ['Latitude', 'Longitude', 'LATITUDE', 'LONGITUDE', 'latitude', 'longitude']
            has_coordinates = any(coord in headers for coord in required_coords)
            
            if not has_coordinates:
                return JsonResponse({
                    'valid': False,
                    'message': 'CSV must contain Latitude and Longitude columns'
                }, status=400)
            
            # Count valid data rows
            valid_rows = 0
            for i in range(1, len(lines)):
                line = lines[i].strip()
                if line:
                    valid_rows += 1
            
            if valid_rows == 0:
                return JsonResponse({
                    'valid': False,
                    'message': 'CSV must contain at least one data row'
                }, status=400)
            
            has_year_column = any(year_col in headers for year_col in ['YEAR', 'Year', 'year'])
            
            # Year validation message
            current_year = datetime.now().year
            year_validation_message = None
            if has_year_column:
                year_validation_message = f'Year column found. Valid range: 2019-{current_year}'
            
            return JsonResponse({
                'valid': True,
                'message': f'CSV is valid. Found {len(headers)} columns and {valid_rows} data rows.',
                'details': {
                    'total_columns': len(headers),
                    'total_rows': valid_rows,
                    'headers': headers,
                    'has_coordinates': has_coordinates,
                    'has_year_column': has_year_column,
                    'year_validation_message': year_validation_message,
                    'file_size_mb': round(csv_file.size / (1024 * 1024), 2),
                    'valid_year_range': f'2019-{current_year}'
                }
            })
            
        except UnicodeDecodeError:
            return JsonResponse({
                'valid': False,
                'message': 'CSV file encoding is not supported. Please use UTF-8 encoding.'
            }, status=400)
        except Exception as parse_error:
            return JsonResponse({
                'valid': False,
                'message': f'Error parsing CSV: {str(parse_error)}'
            }, status=400)
    
    except Exception as e:
        logger.error(f"CSV validation error: {str(e)}", exc_info=True)
        return JsonResponse({
            'valid': False,
            'message': f'Server error during validation: {str(e)}'
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def upload_csv(request):
    """Upload and store CSV files with year information"""
    try:
        if 'csv_file' not in request.FILES:
            return JsonResponse({
                'success': False,
                'message': 'No CSV file uploaded'
            }, status=400)
        
        csv_file = request.FILES['csv_file']
        
        import time
        import os
        timestamp = str(int(time.time()))
        original_name = csv_file.name
        name_parts = os.path.splitext(original_name)
        filename = f"{name_parts[0]}_{timestamp}{name_parts[1]}"
        
        upload_dir = 'media/temp/uploaded_csvs'
        os.makedirs(upload_dir, exist_ok=True)
        
        file_path = os.path.join(upload_dir, filename)
        
        with open(file_path, 'wb') as destination:
            for chunk in csv_file.chunks():
                destination.write(chunk)
        
        csv_content = csv_file.read().decode('utf-8')
        lines = csv_content.split('\n')
        headers = [h.strip().strip('"') for h in lines[0].split(',')]
        
        valid_rows = sum(1 for line in lines[1:] if line.strip())
        
        has_year_column = any(year_col in headers for year_col in ['YEAR', 'Year', 'year'])
        
        current_year = datetime.now().year
        
        return JsonResponse({
            'success': True,
            'message': f'CSV uploaded successfully as {filename}',
            'data': {
                'filename': filename,
                'original_name': original_name,
                'file_path': file_path,
                'file_size': csv_file.size,
                'total_columns': len(headers),
                'total_rows': valid_rows,
                'headers': headers,
                'has_year_column': has_year_column,
                'upload_timestamp': timestamp,
                'valid_year_range': f'2019-{current_year}'
            }
        })
        
    except Exception as e:
        logger.error(f"CSV upload error: {str(e)}", exc_info=True)
        return JsonResponse({
            'success': False,
            'message': f'Server error during upload: {str(e)}'
        }, status=500)


class AvailableYearsView(APIView):
    """Get available years - dynamic from 2019 to current year"""
    permission_classes = [AllowAny]
    
    def get(self, request):
        try:
            current_year = datetime.now().year
            
            # Generate years from 2019 to current year
            available_years = list(range(2019, current_year + 1))
            available_years.reverse()  # Show newest first
            
            print(f"[DEBUG] Available years: {available_years}")
            
            return Response({
                'available_years': available_years,
                'count': len(available_years),
                'range': f'2019-{current_year}',
                'current_year': current_year,
                'message': f'Years from 2019 to {current_year}'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error getting available years: {str(e)}", exc_info=True)
            # Fallback to current year if error
            current_year = datetime.now().year
            fallback_years = list(range(2019, current_year + 1))
            fallback_years.reverse()
            
            return Response({
                'error': f'Error generating years: {str(e)}',
                'available_years': fallback_years,
                'range': f'2019-{current_year}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class WellStatsView(APIView):
    """Get well statistics by year and subdistrict/village"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            data = request.data
            subdis_cod = data.get('subdis_cod', [])
            village_codes = data.get('village_codes', [])
            year = data.get('year')
            
            if (not subdis_cod and not village_codes) or not year:
                return Response({
                    'error': 'Either subdis_cod or village_codes and year parameters are required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # UPDATED YEAR VALIDATION
            try:
                year_int = int(year)
                is_valid, error_msg = validate_year_range(year_int)
                if not is_valid:
                    return Response({
                        'error': error_msg,
                        'code': 'INVALID_YEAR_RANGE'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({
                    'error': 'Year must be a valid integer',
                    'code': 'INVALID_YEAR_FORMAT'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if subdis_cod:
                # Admin system stats - OPTIMIZED
                subdis_codes_int = [int(code) for code in subdis_cod]
                total_wells = Well.objects.filter(
                    SUBDIS_COD__in=subdis_codes_int,
                    YEAR=year_int
                ).count()
            else:
                # Drain system stats - OPTIMIZED
                village_codes_int = [int(code) for code in village_codes]
                total_wells = Well.objects.filter(
                    village_code_id__in=village_codes_int,
                    YEAR=year_int
                ).count()
            
            return Response({
                'year': year_int,
                'total_wells': total_wells,
                'message': f'Found {total_wells} wells for year {year_int}'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error getting well statistics: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to get well statistics: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GenerateGWQIReportView(APIView):
    """Generate PDF report for GWQI analysis with session support"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            data = request.data
            gwqi_data = data.get('gwqi_data')
            selected_year = data.get('selected_year')
            session_id = data.get('session_id')
            
            if not gwqi_data or not selected_year:
                return Response({
                    'error': 'GWQI data and selected year are required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # UPDATED YEAR VALIDATION
            current_year = datetime.now().year
            try:
                year_int = int(selected_year)
                if year_int < 2019 or year_int > current_year:
                    return Response({
                        'error': f'Year must be between 2019 and {current_year}',
                        'code': 'INVALID_YEAR_RANGE'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({
                    'error': 'Year must be a valid integer',
                    'code': 'INVALID_YEAR_FORMAT'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            print(f"[PDF] Generating report for year {selected_year}, session: {session_id}")
            
            # Generate PDF with session support
            pdf_content = generate_gwqi_report(gwqi_data, selected_year, session_id)
            
            if pdf_content is None:
                return Response({
                    'error': 'Failed to generate PDF report'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # Create response with PDF
            response = HttpResponse(pdf_content, content_type='application/pdf')
            filename = f"GWQI_Report_{selected_year}"
            if session_id:
                filename += f"_{session_id[:8]}"
            filename += ".pdf"
            
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            print(f"[PDF] Report generated successfully for year {selected_year}")
            return response
            
        except Exception as e:
            logger.error(f"Error generating GWQI report: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to generate report: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VillageAnalysisView(APIView):
    """On-demand village analysis endpoint"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            from pathlib import Path
            import rasterio
            import numpy as np
            import traceback
            
            GENERATED_RASTERS_DIR = Path("media/temp/sessions")
            
            data = request.data
            selected_year = data.get('selected_year')
            village_ids = data.get('village_ids', [])
            place = data.get('place', 'subdistrict')
            session_id = data.get('session_id')
            
            if not session_id:
                return Response({
                    'error': 'Session ID required for village analysis'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # UPDATED YEAR VALIDATION
            if not selected_year:
                return Response({
                    'error': 'Year is required',
                    'code': 'MISSING_YEAR'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            current_year = datetime.now().year
            try:
                year_int = int(selected_year)
                if year_int < 2019 or year_int > current_year:
                    return Response({
                        'error': f'Year must be between 2019 and {current_year}',
                        'code': 'INVALID_YEAR_RANGE'
                    }, status=status.HTTP_400_BAD_REQUEST)
            except (ValueError, TypeError):
                return Response({
                    'error': 'Year must be a valid integer',
                    'code': 'INVALID_YEAR_FORMAT'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            print(f"[VILLAGE ANALYSIS] On-demand request for session {session_id}")
            
            # Load the NORMALIZED GWQI raster from session directory
            session_dir = GENERATED_RASTERS_DIR / session_id / "output" / selected_year
            gwqi_raster_path = session_dir / f"gwqi_composite_{selected_year}_{session_id[:8]}_normalized.tif"
            
            if not gwqi_raster_path.exists():
                return Response({
                    'error': 'GWQI raster not found. Please generate GWQI first.',
                    'path_checked': str(gwqi_raster_path)
                }, status=status.HTTP_404_NOT_FOUND)
            
            print(f"[VILLAGE ANALYSIS] Using raster: {gwqi_raster_path}")
            
            # Read GWQI raster
            with rasterio.open(gwqi_raster_path) as src:
                gwqi_raster = src.read(1)
                metadata = {
                    'crs': src.crs,
                    'transform': src.transform
                }
            
            # CREATE GWQI OVERLAY INSTANCE AND SET SESSION PATHS
            from .gwqi import GWQIOverlayView
            overlay = GWQIOverlayView()
            
            # SET SESSION PATHS FOR VILLAGE ANALYSIS
            overlay.session_id = session_id
            overlay.session_temp_dir = GENERATED_RASTERS_DIR / session_id / "temp"
            overlay.session_output_dir = GENERATED_RASTERS_DIR / session_id / "output"
            
            # Ensure temp directory exists
            overlay.session_temp_dir.mkdir(parents=True, exist_ok=True)
            
            # Calculate village analysis
            village_analysis = overlay.calculate_village_analysis(
                gwqi_raster, metadata, village_ids, place
            )
            
            print(f"[VILLAGE ANALYSIS] Successfully analyzed {len(village_analysis)} villages")
            
            return Response({
                'village_analysis': village_analysis,
                'village_count': len(village_analysis),
                'message': f'Successfully analyzed {len(village_analysis)} villages',
                'raster_path_used': str(gwqi_raster_path)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"[ERROR] Village analysis error: {str(e)}")
            traceback.print_exc()
            return Response({
                'error': f'Failed to calculate village analysis: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CleanupSessionView(APIView):
    """Session cleanup endpoint"""
    permission_classes = [AllowAny]
    
    def post(self, request):
        try:
            session_id = request.data.get('session_id')
            
            if session_id:
                # Cleanup specific session
                session_manager.cleanup_session(session_id)
                return Response({
                    'message': f'Session {session_id} cleaned successfully'
                })
            else:
                # Cleanup old sessions
                max_hours = request.data.get('hours', 1)
                count = session_manager.cleanup_old_sessions(max_age_hours=max_hours)
                return Response({
                    'message': f'Cleaned {count} old sessions',
                    'cleaned_count': count
                })
                
        except Exception as e:
            return Response({
                'error': f'Cleanup failed: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def get(self, request):
        """Get session statistics"""
        try:
            stats = session_manager.get_session_stats()
            return Response({
                'session_stats': stats,
                'message': 'Session statistics retrieved successfully'
            })
        except Exception as e:
            return Response({
                'error': f'Failed to get stats: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)