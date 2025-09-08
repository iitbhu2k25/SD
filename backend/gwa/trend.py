from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
import pandas as pd
import numpy as np
import pymannkendall as mk
import logging
import uuid
from typing import Dict, List, Any
import os
from django.conf import settings
from datetime import datetime

logger = logging.getLogger(__name__)

class GroundwaterTrendAnalysisView(APIView):
    """
    Enhanced Groundwater Trend Analysis API View
    Performs Mann-Kendall and Pettitt tests with dynamic year range support
    Returns JSON data for map visualization
    Fetches data from a CSV file in media/temp/ folder
    """
    permission_classes = [AllowAny]

    def post(self, request):
        """
        Main endpoint for groundwater trend analysis
        
        Expected payload:
        {
            "method": "mann_kendall",  # mann_kendall or pettitt
            "data_type": "PRE",        # PRE or POST
            "from_year": 2015,         # Dynamic based on available data
            "to_year": 2020,           # Dynamic based on available data
            "csv_filename": "wells_data.csv"  # Name of CSV file in media/temp/
        }
        """
        print("[DEBUG] Groundwater Trend Analysis POST request received")
        
        try:
            # Validate request data
            method = request.data.get('method')
            data_type = request.data.get('data_type')
            from_year = request.data.get('from_year')
            to_year = request.data.get('to_year')
            csv_filename = request.data.get('csv_filename')
            
            # Basic validation
            validation_error = self.validate_request_data(
                method, data_type, from_year, to_year, csv_filename
            )
            if validation_error:
                return validation_error
            
            print(f"[DEBUG] Analysis parameters: method={method}, data_type={data_type}, "
                  f"period={from_year}-{to_year}, csv_file={csv_filename}")
            
            # Fetch and validate CSV data
            csv_data_result = self.fetch_and_validate_csv_data(csv_filename, data_type, from_year, to_year)
            if 'error' in csv_data_result:
                return Response(csv_data_result, status=status.HTTP_400_BAD_REQUEST)
            
            wells_data = csv_data_result['wells_data']
            available_years = csv_data_result['available_years']
            
            if not wells_data:
                return Response({
                    'error': 'No wells found in the provided CSV file after applying data quality filters'
                }, status=status.HTTP_404_NOT_FOUND)
            
            print(f"[DEBUG] Found {len(wells_data)} wells for analysis")
            print(f"[DEBUG] Available years for {data_type}: {available_years}")
            
            # Validate that requested years are available in the data
            year_validation_error = self.validate_year_availability(
                data_type, from_year, to_year, available_years
            )
            if year_validation_error:
                return year_validation_error
            
            # Perform trend analysis
            trend_results = self.perform_trend_analysis(
                wells_data, method, data_type, from_year, to_year
            )
            
            # Generate response data
            response_data = {
                'success': True,
                'method': method,
                'data_type': data_type,
                'from_year': from_year,
                'to_year': to_year,
                'period_years': to_year - from_year + 1,
                'wells_analyzed': len(trend_results['wells']),
                'available_years': available_years,
                'wells': trend_results['wells'],
                'map_data': trend_results['map_data'],
                'trend_summary': trend_results['summary'],
                'statistics': trend_results['statistics'],
                'table_data': trend_results['table_data'],
                'data_availability': {
                    'csv_filename': csv_filename,
                    'total_wells_in_csv': len(wells_data),
                    'available_year_range': f"{min(available_years)}-{max(available_years)}" if available_years else "No data",
                    'data_type_columns': [f"{data_type}_{year}" for year in available_years]
                },
                'analysis_metadata': {
                    'analysis_timestamp': pd.Timestamp.now().isoformat(),
                    'analysis_id': str(uuid.uuid4()),
                    'csv_filename': csv_filename,
                    'analysis_duration_years': to_year - from_year + 1,
                    'minimum_data_points_required': 3
                }
            }
            
            print(f"[✓] Trend analysis completed successfully")
            print(f"[✓] Wells analyzed: {len(trend_results['wells'])}")
            print(f"[✓] Map bubbles generated: {len(trend_results['map_data'])}")
            print(f"[✓] Year range analyzed: {from_year}-{to_year}")
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in groundwater trend analysis: {str(e)}")
            print(f"[ERROR] Trend analysis failed: {str(e)}")
            return Response({
                'error': f'Internal server error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def validate_request_data(self, method, data_type, from_year, to_year, csv_filename):
        """Validate basic request parameters"""
        
        if not all([method, data_type, from_year, to_year, csv_filename]):
            return Response({
                'error': 'Missing required fields: method, data_type, from_year, to_year, csv_filename'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if data_type not in ['PRE', 'POST']:
            return Response({
                'error': 'data_type must be either PRE or POST'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Convert years to integers
        try:
            from_year = int(from_year)
            to_year = int(to_year)
        except (ValueError, TypeError):
            return Response({
                'error': 'from_year and to_year must be valid integers'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if from_year >= to_year:
            return Response({
                'error': 'from_year must be less than to_year'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # More flexible year validation - allow reasonable range
        current_year = datetime.now().year
        if from_year < 1990 or to_year > current_year:
            return Response({
                'error': f'Years must be within reasonable range (1990 - {current_year})'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Minimum period check for meaningful trend analysis
        if to_year - from_year < 1:
            return Response({
                'error': 'Analysis period must be at least 2 years for meaningful trend detection'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        valid_methods = ['mann_kendall', 'pettitt']
        if method not in valid_methods:
            return Response({
                'error': f'method must be one of: {valid_methods}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate CSV file exists
        temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp')
        csv_path = os.path.join(temp_dir, csv_filename)
        if not os.path.isfile(csv_path):
            return Response({
                'error': f'CSV file {csv_filename} not found in media/temp/ folder'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Prevent directory traversal
        if '..' in csv_filename or '/' in csv_filename or '\\' in csv_filename:
            return Response({
                'error': 'Invalid csv_filename: Directory traversal not allowed'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return None

    def fetch_and_validate_csv_data(self, csv_filename: str, data_type: str, from_year: int, to_year: int) -> Dict:
        """Fetch CSV data and validate year availability"""
        try:
            print(f"[DEBUG] Fetching wells from CSV: {csv_filename}")
            
            # Construct path to CSV file
            temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp')
            csv_path = os.path.join(temp_dir, csv_filename)
            
            # Read CSV file
            df = pd.read_csv(csv_path)
            print(f"[DEBUG] Total rows in CSV: {len(df)}")
            print(f"[DEBUG] Columns in CSV: {df.columns.tolist()}")
            
            # Identify PRE_ and POST_ columns
            pre_columns = [col for col in df.columns if col.upper().startswith('PRE_')]
            post_columns = [col for col in df.columns if col.upper().startswith('POST_')]
            print(f"[DEBUG] PRE columns found: {pre_columns}")
            print(f"[DEBUG] POST columns found: {post_columns}")
            
            # Extract years for the requested data type
            if data_type == 'PRE':
                relevant_columns = pre_columns
            else:  # POST
                relevant_columns = post_columns
            
            # Extract available years from column names
            available_years = []
            for col in relevant_columns:
                try:
                    # Extract year from column name (e.g., 'PRE_2015' -> 2015)
                    year_str = col.split('_')[-1]
                    year = int(year_str)
                    available_years.append(year)
                except (ValueError, IndexError):
                    print(f"[WARNING] Could not extract year from column: {col}")
                    continue
            
            available_years = sorted(list(set(available_years)))  # Remove duplicates and sort
            print(f"[DEBUG] Available years for {data_type}: {available_years}")
            
            # Check if any data is available for the requested data type
            if not available_years:
                return {
                    'error': f'No {data_type} data columns found in CSV. Available columns: {df.columns.tolist()}'
                }
            
            # Apply data quality filters
            required_columns = ['LATITUDE', 'LONGITUDE', 'HYDROGRAPH']
            missing_required = [col for col in required_columns if col not in df.columns]
            if missing_required:
                return {
                    'error': f'Required columns missing from CSV: {missing_required}. Found columns: {df.columns.tolist()}'
                }
            
            df_filtered = df[
                df['LATITUDE'].notnull() &
                df['LONGITUDE'].notnull() &
                df['HYDROGRAPH'].notnull()
            ]
            print(f"[DEBUG] Rows after quality filters: {len(df_filtered)}")
            
            # Convert DataFrame to list of dictionaries
            wells_data = []
            for _, row in df_filtered.iterrows():
                try:
                    well_dict = {
                        'well_id': row.get('id', row.get('well_id', row.name)),  # Use row index as fallback
                        'FID_clip': row.get('FID_clip', None),
                        'hydrograph_code': row['HYDROGRAPH'],
                        'latitude': float(row['LATITUDE']) if pd.notnull(row['LATITUDE']) else None,
                        'longitude': float(row['LONGITUDE']) if pd.notnull(row['LONGITUDE']) else None,
                        'village_name': row.get('shapeName', row.get('VILLAGE', None)),
                        'district_name': row.get('DISTRICT', None),
                        'state_name': row.get('STATE', None),
                        'sub_district_name': row.get('SUB_DISTRI', None),
                        'block_name': row.get('BLOCK', None),
                        'village_code': row.get('village_code', None),
                        'subdistrict_code': row.get('SUBDIS_COD', None),
                        'population': row.get('population', None),
                        'RL': row.get('RL', None),
                    }
                    
                    # Dynamically add all data columns (not just the requested years)
                    for col in pre_columns + post_columns:
                        well_dict[col] = float(row[col]) if pd.notnull(row.get(col)) else None
                    
                    wells_data.append(well_dict)
                except Exception as e:
                    logger.error(f"Error processing well row: {str(e)}")
                    continue
            
            logger.info(f"Successfully fetched {len(wells_data)} well records from CSV")
            print(f"[DEBUG] Found {len(wells_data)} wells matching the criteria")
            
            return {
                'wells_data': wells_data,
                'available_years': available_years
            }
            
        except Exception as e:
            logger.error(f"Error fetching well data from CSV: {str(e)}")
            print(f"[ERROR] CSV Processing Error: {str(e)}")
            return {
                'error': f'Failed to process CSV file: {str(e)}'
            }

    def validate_year_availability(self, data_type: str, from_year: int, to_year: int, available_years: List[int]):
        """Validate that requested years are available in the data"""
        
        if not available_years:
            return Response({
                'error': f'No {data_type} data available in the uploaded CSV'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        min_available = min(available_years)
        max_available = max(available_years)
        
        # Check if requested years are within available range
        if from_year < min_available or to_year > max_available:
            return Response({
                'error': f'Requested year range ({from_year}-{to_year}) is outside available data range ({min_available}-{max_available}) for {data_type} data',
                'available_years': available_years,
                'available_range': f'{min_available}-{max_available}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if specific years are available
        requested_years = list(range(from_year, to_year + 1))
        missing_years = [year for year in requested_years if year not in available_years]
        
        if missing_years:
            return Response({
                'error': f'Some requested years are not available in the data: {missing_years}',
                'available_years': available_years,
                'missing_years': missing_years,
                'suggestion': f'Try using years from the available range: {available_years}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check for minimum data coverage
        available_in_range = [year for year in requested_years if year in available_years]
        if len(available_in_range) < 3:
            return Response({
                'error': f'Insufficient data points for trend analysis. Need at least 3 years, found {len(available_in_range)} years with data',
                'available_years_in_range': available_in_range
            }, status=status.HTTP_400_BAD_REQUEST)
        
        return None

    def perform_trend_analysis(self, wells_data: List[Dict], method: str, data_type: str, 
                             from_year: int, to_year: int) -> Dict[str, Any]:
        """Perform trend analysis on well data using specified method and data type"""
        try:
            # Convert to DataFrame for easier processing
            df = pd.DataFrame(wells_data)
            
            # Identify relevant columns based on data_type and year range
            relevant_columns = []
            for year in range(from_year, to_year + 1):
                col_name = f"{data_type}_{year}"
                if col_name in df.columns:
                    relevant_columns.append(col_name)
            
            print(f"[DEBUG] Relevant columns for {data_type} ({from_year}-{to_year}): {relevant_columns}")
            
            trend_results = []
            
            # Process each well
            for _, well_row in df.iterrows():
                try:
                    well_id = well_row['well_id']
                    hydrograph = well_row['hydrograph_code']
                    lat = well_row['latitude']
                    lon = well_row['longitude']
                    village = well_row['village_name']
                    district = well_row['district_name']
                    state = well_row['state_name']
                    
                    # Extract time series data for the specified period and data type
                    time_series, years_with_data = self.extract_time_series_from_columns(
                        well_row, data_type, from_year, to_year
                    )
                    
                    # Check for sufficient data points
                    if len(time_series) < 3:
                        result = {
                            'well_id': well_id,
                            'hydrograph_code': hydrograph,
                            'latitude': float(lat) if lat is not None else None,
                            'longitude': float(lon) if lon is not None else None,
                            'village_name': village,
                            'district_name': district,
                            'state_name': state,
                            'data_points': len(time_series),
                            'years_available': years_with_data,
                            'time_series': time_series,
                            'trend': 'insufficient_data',
                            'trend_direction': 'insufficient_data',
                            'significance': 'not_applicable',
                            'p_value': None,
                            'method_used': method,
                            'data_coverage_percentage': round((len(time_series) / (to_year - from_year + 1)) * 100, 1)
                        }
                        trend_results.append(result)
                        continue
                    
                    # Calculate trend
                    result = self.calculate_trend(
                        well_id, hydrograph, lat, lon, village, district, state,
                        time_series, years_with_data, method, from_year, to_year
                    )
                    trend_results.append(result)
                
                except Exception as e:
                    logger.error(f"Error processing trend for well {well_row.get('well_id')}: {str(e)}")
                    continue
            
            # Generate summary, map data, statistics, and table data
            summary = self.generate_trend_summary(trend_results)
            map_data = self.generate_map_data(trend_results)
            statistics = self.calculate_statistics(trend_results, from_year, to_year)
            table_data = self.generate_table_data(trend_results)
            
            return {
                'wells': trend_results,
                'map_data': map_data,
                'summary': summary,
                'statistics': statistics,
                'table_data': table_data
            }
            
        except Exception as e:
            logger.error(f"Error in perform_trend_analysis: {str(e)}")
            raise

    def extract_time_series_from_columns(self, well_row: pd.Series, data_type: str, 
                                        from_year: int, to_year: int) -> tuple:
        """Extract time series data from columns matching data_type and year range"""
        time_series = []
        years_with_data = []
        
        for year in range(from_year, to_year + 1):
            column_name = f"{data_type}_{year}"
            value = well_row.get(column_name, None)
            if value is not None and not pd.isna(value) and value != '':
                try:
                    time_series.append(float(value))
                    years_with_data.append(year)
                except (ValueError, TypeError):
                    print(f"[WARNING] Could not convert value '{value}' to float for {column_name}")
                    continue
        
        return time_series, years_with_data

    def calculate_trend(self, well_id: int, hydrograph: str, lat: float, lon: float,
                       village: str, district: str, state: str,
                       time_series: List[float], years_available: List[int], method: str,
                       from_year: int, to_year: int) -> Dict[str, Any]:
        """Calculate trend using specified method"""
        
        base_result = {
            'well_id': well_id,
            'hydrograph_code': hydrograph,
            'latitude': float(lat) if lat is not None else None,
            'longitude': float(lon) if lon is not None else None,
            'village_name': village,
            'district_name': district,
            'state_name': state,
            'data_points': len(time_series),
            'years_available': years_available,
            'time_series': time_series,
            'analysis_period': f"{from_year}-{to_year}",
            'data_coverage_percentage': round((len(time_series) / (to_year - from_year + 1)) * 100, 1)
        }
        
        try:
            if method == 'mann_kendall':
                result = mk.original_test(time_series)
                
                # Map trend to direction for consistency
                trend_direction = result.trend
                if trend_direction == 'increasing':
                    trend_direction = 'increasing'
                elif trend_direction == 'decreasing':
                    trend_direction = 'decreasing'
                else:
                    trend_direction = 'no_trend'
                
                base_result.update({
                    'trend': result.trend,
                    'trend_direction': trend_direction,
                    'significance': 'significant' if result.p < 0.05 else 'not_significant',
                    'tau': float(result.Tau) if hasattr(result, 'Tau') else None,
                    'p_value': float(result.p) if hasattr(result, 'p') else None,
                    'slope': float(result.slope) if hasattr(result, 'slope') else None,
                    'z_score': float(result.z) if hasattr(result, 'z') else None,
                    'method_used': 'mann_kendall',
                    'trend_magnitude': abs(float(result.slope)) if hasattr(result, 'slope') and result.slope else 0
                })
                
            elif method == 'pettitt':
                result = mk.pettitt_test(time_series)
                trend_detected = 'change_point_detected' if result.p < 0.05 else 'no_change_point'
                
                base_result.update({
                    'trend': trend_detected,
                    'trend_direction': trend_detected,
                    'significance': 'significant' if result.p < 0.05 else 'not_significant',
                    'tau': None,  # Pettitt test doesn't provide tau
                    'p_value': float(result.p) if hasattr(result, 'p') else None,
                    'slope': None,  # Pettitt test doesn't provide slope
                    'change_point': int(result.cp) if hasattr(result, 'cp') and result.cp is not None else None,
                    'change_point_year': years_available[int(result.cp)] if (hasattr(result, 'cp') and result.cp is not None and result.cp < len(years_available)) else None,
                    'u_statistic': float(result.U) if hasattr(result, 'U') else None,
                    'method_used': 'pettitt',
                    'trend_magnitude': abs(float(result.U)) if hasattr(result, 'U') and result.U else 0
                })
                
        except Exception as e:
            logger.error(f"Error in trend calculation for well {well_id}: {str(e)}")
            base_result.update({
                'trend': 'error',
                'trend_direction': 'error',
                'significance': 'error',
                'tau': None,
                'p_value': None,
                'slope': None,
                'error_message': str(e),
                'method_used': method,
                'trend_magnitude': 0
            })
        
        return base_result

    def generate_trend_summary(self, trend_results: List[Dict]) -> Dict[str, int]:
        """Generate summary statistics of trends"""
        summary = {
            'total_wells': len(trend_results),
            'increasing': 0,
            'decreasing': 0,
            'no_trend': 0,
            'change_point_detected': 0,
            'no_change_point': 0,
            'insufficient_data': 0,
            'error': 0,
            'significant': 0,
            'not_significant': 0,
            'wells_with_valid_data': 0
        }
        
        for result in trend_results:
            trend = result.get('trend_direction', result.get('trend', 'error'))
            significance = result.get('significance', 'error')
            
            # Count by trend direction
            if trend in summary:
                summary[trend] += 1
            
            # Count by significance
            if significance == 'significant':
                summary['significant'] += 1
            elif significance == 'not_significant':
                summary['not_significant'] += 1
            
            # Count wells with valid data
            if result.get('data_points', 0) >= 3:
                summary['wells_with_valid_data'] += 1
        
        return summary

    def generate_map_data(self, trend_results: List[Dict]) -> List[Dict]:
        """Generate bubble data for map plotting"""
        map_data = []
        
        # Color mapping for different trend types
        color_map = {
            'increasing': '#00ff00',           # Green
            'decreasing': '#ff0000',           # Red
            'no_trend': '#808080',             # Gray
            'change_point_detected': '#ff8c00', # Orange
            'no_change_point': '#87ceeb',      # Sky Blue
            'insufficient_data': '#000000',    # Black
            'error': '#ff00ff'                 # Magenta
        }
        
        for result in trend_results:
            if result['latitude'] is not None and result['longitude'] is not None:
                # Calculate bubble size based on significance and method
                if result.get('method_used') == 'mann_kendall':
                    tau = result.get('tau', 0)
                    bubble_size = max(8, min(25, abs(tau) * 30)) if tau is not None else 8
                else:  # Pettitt method
                    bubble_size = 15  # Fixed size for Pettitt
                
                # Adjust size based on significance
                if result.get('significance') == 'significant':
                    bubble_size *= 1.2  # Make significant trends larger
                
                trend_direction = result.get('trend_direction', result.get('trend', 'no_trend'))
                
                bubble = {
                    'well_id': result['well_id'],
                    'hydrograph_code': result['hydrograph_code'],
                    'latitude': result['latitude'],
                    'longitude': result['longitude'],
                    'village_name': result['village_name'],
                    'district_name': result['district_name'],
                    'trend': result['trend'],
                    'trend_direction': trend_direction,
                    'significance': result['significance'],
                    'tau': result.get('tau'),
                    'p_value': result['p_value'],
                    'slope': result.get('slope'),
                    'data_points': result['data_points'],
                    'method_used': result.get('method_used'),
                    'color': color_map.get(trend_direction, '#000000'),
                    'size': bubble_size,
                    'opacity': 0.8 if result.get('significance') == 'significant' else 0.6,
                    'trend_strength': self.classify_trend_strength(result),
                    'change_point': result.get('change_point'),
                    'change_point_year': result.get('change_point_year'),
                    'u_statistic': result.get('u_statistic'),
                    'data_coverage_percentage': result.get('data_coverage_percentage', 0),
                    'analysis_period': result.get('analysis_period')
                }
                map_data.append(bubble)
        
        return map_data

    def classify_trend_strength(self, result: Dict) -> str:
        """Classify trend strength based on method and values"""
        method = result.get('method_used')
        
        if method == 'mann_kendall':
            tau = result.get('tau')
            if tau is None:
                return 'unknown'
            
            abs_tau = abs(tau)
            if abs_tau >= 0.7:
                return 'very_strong'
            elif abs_tau >= 0.5:
                return 'strong'
            elif abs_tau >= 0.3:
                return 'moderate'
            elif abs_tau >= 0.1:
                return 'weak'
            else:
                return 'very_weak'
                
        elif method == 'pettitt':
            if result.get('significance') == 'significant':
                return 'significant_change_point'
            else:
                return 'no_significant_change_point'
        
        return 'unknown'

    def generate_table_data(self, trend_results: List[Dict]) -> List[Dict]:
        """Generate data for trend analysis table"""
        table_data = []
        
        for result in trend_results:
            row = {
                'well_id': result['well_id'],
                'hydrograph_code': result['hydrograph_code'],
                'village_name': result['village_name'],
                'district_name': result['district_name'],
                'trend': result['trend'],
                'trend_direction': result.get('trend_direction', result['trend']),
                'significance': result['significance'],
                'p_value': round(result['p_value'], 4) if result['p_value'] else None,
                'data_points': result['data_points'],
                'method_used': result.get('method_used'),
                'trend_strength': self.classify_trend_strength(result),
                'latitude': result['latitude'],
                'longitude': result['longitude'],
                'data_coverage_percentage': result.get('data_coverage_percentage', 0),
                'analysis_period': result.get('analysis_period')
            }
            
            if result.get('method_used') == 'mann_kendall':
                row.update({
                    'tau': round(result['tau'], 4) if result['tau'] else None,
                    'slope': round(result['slope'], 4) if result['slope'] else None,
                    'z_score': round(result.get('z_score'), 4) if result.get('z_score') else None
                })
            elif result.get('method_used') == 'pettitt':
                row.update({
                    'change_point': result.get('change_point'),
                    'change_point_year': result.get('change_point_year'),
                    'u_statistic': round(result.get('u_statistic'), 4) if result.get('u_statistic') else None
                })
            
            table_data.append(row)
        
        # Sort by significance and p-value
        table_data.sort(key=lambda x: (
            0 if x['significance'] == 'significant' else 1,
            x['p_value'] if x['p_value'] else 1
        ))
        
        return table_data

    def calculate_statistics(self, trend_results: List[Dict], from_year: int, to_year: int) -> Dict[str, Any]:
        """Calculate overall statistics"""
        
        valid_results = [r for r in trend_results if r['p_value'] is not None]
        significant_results = [r for r in valid_results if r['significance'] == 'significant']
        mann_kendall_results = [r for r in valid_results if r.get('method_used') == 'mann_kendall']
        pettitt_results = [r for r in valid_results if r.get('method_used') == 'pettitt']
        
        statistics = {
            'analysis_period': f"{from_year}-{to_year}",
            'total_years': to_year - from_year + 1,
            'wells_with_data': len(valid_results),
            'wells_with_significant_trends': len(significant_results),
            'confidence_level': '95%',
            'significance_threshold': 0.05,
            'data_quality_summary': {
                'total_wells': len(trend_results),
                'wells_with_sufficient_data': len(valid_results),
                'wells_with_insufficient_data': len([r for r in trend_results if r.get('trend') == 'insufficient_data']),
                'average_data_coverage': round(np.mean([r.get('data_coverage_percentage', 0) for r in trend_results]), 1)
            }
        }
        
        if mann_kendall_results:
            tau_values = [r['tau'] for r in mann_kendall_results if r['tau'] is not None]
            slope_values = [r['slope'] for r in mann_kendall_results if r['slope'] is not None]
            
            statistics.update({
                'mann_kendall_wells': len(mann_kendall_results),
                'average_tau': round(np.mean(tau_values), 4) if tau_values else None,
                'median_tau': round(np.median(tau_values), 4) if tau_values else None,
                'std_tau': round(np.std(tau_values), 4) if tau_values else None,
                'average_slope': round(np.mean(slope_values), 4) if slope_values else None,
                'median_slope': round(np.median(slope_values), 4) if slope_values else None,
                'std_slope': round(np.std(slope_values), 4) if slope_values else None,
            })
        
        if pettitt_results:
            change_points = [r['change_point_year'] for r in pettitt_results if r.get('change_point_year')]
            
            statistics.update({
                'pettitt_wells': len(pettitt_results),
                'wells_with_change_points': len([r for r in pettitt_results if r['trend'] == 'change_point_detected']),
                'change_point_years': change_points,
                'most_common_change_point_year': max(set(change_points), key=change_points.count) if change_points else None
            })
        
        return statistics