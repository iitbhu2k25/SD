import os
from datetime import datetime
from typing import List, Dict, Any, Optional

import geopandas as gpd
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny


class StressIdentificationAPIView(APIView):
    """
    Computes stress_value per village using GSR results and shapefile injection data.
    Formula: stress_value = max(recharge - total_demand,0) + (injection / years_count)
    - Accepts GSR results from frontend
    - Matches village_code (GSR) with village_co (shapefile)
    - Returns only stress_value for each village
    """
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.shapefile_path: Optional[str] = None
        self.shapefile_map: Dict[str, float] = {}

    def load_shapefile(self) -> None:
        """
        Load shapefile data once and create a mapping:
            { normalized village_co (str): injection (float) }
        """
        try:
            if self.shapefile_path is None:
                media_dir = os.path.join(settings.BASE_DIR, 'media')
                self.shapefile_path = os.path.join(
                    media_dir, 'gwa_data', 'gwa_shp', 'Final_Village', 'Injection_Water_Need.shp'
                )

            if not os.path.exists(self.shapefile_path):
                raise FileNotFoundError(f"Shapefile not found at {self.shapefile_path}")

            gdf = gpd.read_file(self.shapefile_path)
            
            # Check required columns
            if 'village_co' not in gdf.columns or 'Injection_' not in gdf.columns:
                raise ValueError("Expected columns 'village_co' and 'Injection_' not found in shapefile")

            # Normalize village_co to string and strip spaces
            gdf['village_co'] = gdf['village_co'].astype(str).str.strip()
            
            # Build injection mapping
            shapefile_map: Dict[str, float] = {}
            for _, row in gdf.iterrows():
                village_co = row['village_co']
                try:
                    injection_val = float(row.get('Injection_', 0) or 0)
                except (TypeError, ValueError):
                    injection_val = 0.0
                
                if village_co:
                    shapefile_map[village_co] = injection_val

            self.shapefile_map = shapefile_map
            print(f"✅ Loaded shapefile with {len(self.shapefile_map)} villages with injection data")

        except Exception as e:
            raise Exception(f"Failed to load shapefile: {str(e)}")

    def validate_inputs(self, gsr_data: List[Dict[str, Any]], years_count: int) -> Optional[str]:
        """Validate request inputs."""
        if not gsr_data:
            return "GSR data is required and cannot be empty"

        if not isinstance(years_count, int) or years_count <= 0:
            return "Years count must be a positive integer"

        if years_count < 1 or years_count > 50:
            return "Years count must be between 1 and 50"

        # Check if GSR data has required fields
        if len(gsr_data) > 0:
            first_row = gsr_data[0]
            required_fields = ['village_code', 'recharge', 'total_demand']
            missing_fields = [f for f in required_fields if f not in first_row]
            if missing_fields:
                return f"Missing required fields in GSR data: {missing_fields}"

        return None

    def post(self, request, *args, **kwargs):
        """
        POST body:
        {
            "gsrData": [
                {"village_code": "123", "village_name": "ABC", "recharge": 100, "total_demand": 80, ...},
                ...
            ],
            "years_count": 5,
            "selectedSubDistricts": [...],
            "timestamp": "..."
        }
        """
        try:
            if not request.data:
                return Response({
                    'error': 'No data provided',
                    'message': 'Please provide GSR data and years count in request body'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Extract data from request
            gsr_data = request.data.get('gsrData', [])  # Note: gsrData not gsr_data
            years_count = request.data.get('years_count')
            selected_subdistricts = request.data.get('selectedSubDistricts', [])

            # Validate inputs
            validation_error = self.validate_inputs(gsr_data, years_count)
            if validation_error:
                return Response({
                    'success': False,
                    'error': validation_error,
                    'data': []
                }, status=status.HTTP_400_BAD_REQUEST)

            # Load shapefile map if not loaded
            if not self.shapefile_map:
                self.load_shapefile()

            # Process each GSR village and compute stress
            stress_results: List[Dict[str, Any]] = []
            villages_processed = 0
            villages_with_injection = 0

            for gsr_row in gsr_data:
                # Extract village code - handle different field name variations
                village_code = None
                for field in ['village_code', 'village_co', 'villageCode']:
                    if field in gsr_row:
                        village_code = str(gsr_row[field]).strip()
                        break
                
                if not village_code:
                    continue  # Skip if no village code found
                
                # Check if this village exists in shapefile
                if village_code not in self.shapefile_map:
                    continue  # Skip villages not in shapefile

                # Extract village name
                village_name = gsr_row.get('village_name', gsr_row.get('village', 'Unknown'))

                # Parse numeric values from GSR data - handle different field names
                try:
                    recharge = 0
                    for field in ['recharge', 'Recharge']:
                        if field in gsr_row:
                            recharge = float(gsr_row.get(field, 0) or 0)
                            break
                    
                    total_demand = 0
                    for field in ['total_demand', 'totalDemand', 'total_demand_mld']:
                        if field in gsr_row:
                            total_demand = float(gsr_row.get(field, 0) or 0)
                            break
                            
                except (ValueError, TypeError):
                    continue  # Skip if numeric parsing fails

                # Get injection from shapefile
                injection = self.shapefile_map.get(village_code, 0.0)
                if injection > 0:
                    villages_with_injection += 1

                # Calculate stress value using the formula
                stress_value = (max(recharge - total_demand,0) + (injection / years_count))/1000

                # Create result record (only stress_value, no classification)
                result_row = {
                    'village_code': village_code,
                    'village_name': village_name,
                    'recharge': round(recharge, 4),
                    'total_demand': round(total_demand, 4),
                    'injection': round(injection, 4)/1000,
                    'years_count': years_count,
                    'stress_value': round(stress_value, 2)  # Only stress value, no classification
                }
                stress_results.append(result_row)
                villages_processed += 1

            # Prepare summary statistics
            summary_stats = {
                'total_villages_processed': villages_processed,
                'villages_with_injection_data': villages_with_injection,
                'villages_without_injection_data': villages_processed - villages_with_injection,
                'years_count_used': years_count,
                'shapefile_villages_available': len(self.shapefile_map),
                'gsr_input_villages': len(gsr_data)
            }

            return Response({
                'success': True,
                'data': stress_results,
                'message': f'Stress values computed for {len(stress_results)} villages using {years_count} year{"s" if years_count != 1 else ""}',
                'years_count': years_count,
                'total_villages': len(stress_results),
                'summary_stats': summary_stats,
                'computed_at': datetime.now().isoformat()
            }, status=status.HTTP_200_OK)

        except FileNotFoundError as e:
            return Response({
                'success': False,
                'error': f"Shapefile error: {str(e)}",
                'data': []
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'success': False,
                'error': f"Computation error: {str(e)}",
                'data': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request, *args, **kwargs):
        """Health/info endpoint."""
        try:
            media_dir = os.path.join(settings.BASE_DIR, 'media')
            shapefile_path = os.path.join(
                media_dir, 'gwa_data', 'gwa_shp', 'Final_Village', 'Injection_Water_Need.shp'
            )
            shapefile_exists = os.path.exists(shapefile_path)

            return Response({
                'success': True,
                'message': 'Stress identification service information',
                'data': {
                    'service_name': 'Stress Identification API',
                    'version': '3.0.0',
                    'description': 'Computes stress values using GSR results and shapefile injection data',
                    'formula': 'stress_value = max(recharge - total_demand,0) + (injection / years_count)',
                    'shapefile_path': shapefile_path,
                    'shapefile_exists': shapefile_exists,
                    'required_fields': ['gsrData', 'years_count'],
                    'years_count_range': '1-50',
                    'gsr_data_fields': ['village_code', 'village_name', 'recharge', 'total_demand'],
                    'shapefile_fields': ['village_co', 'Injection_'],
                    'matching': 'Exact match: GSR.village_code == Shapefile.village_co',
                    'output': 'Returns only stress_value for each village (no classification)'
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'error': 'Service information failed',
                'message': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)