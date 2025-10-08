import os
import re
from typing import List, Dict, Any, Tuple, Optional
import uuid
from datetime import datetime

import geopandas as gpd
import pandas as pd
import json
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for server environments
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
import numpy as np
import base64

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


def parse_to_list(value) -> List[str]:
    """Parses a string, list, or None into a list of strings"""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [s.strip() for s in re.split(r'[,\|]+', str(value)) if s.strip()]


def safe_string_compare(val1, val2) -> bool:
    """Safely compare two values as strings"""
    if pd.isna(val1) or pd.isna(val2):
        return False
    return str(val1).strip().lower() == str(val2).strip().lower()


def load_trend_data(trend_csv_filename: str) -> Dict[str, str]:
    """
    Load trend data from CSV file and return a mapping of Village_ID to trend_status
    """
    trend_map = {}
    
    if not trend_csv_filename:
        return trend_map
    
    try:
        # Construct the full path to the trend CSV file in media/temp/
        csv_path = os.path.join(settings.MEDIA_ROOT, 'temp', trend_csv_filename)
        
        if not os.path.exists(csv_path):
            print(f"⚠️ Trend CSV file not found: {csv_path}")
            return trend_map
        
        # Read the trend CSV file
        trend_df = pd.read_csv(csv_path)
        print(f"📄 Loaded trend CSV with {len(trend_df)} records from: {csv_path}")
        
        # Create mapping from Village_ID to trend_status
        for _, row in trend_df.iterrows():
            village_id = str(row.get('Village_ID', '')).strip()
            trend_status = str(row.get('Trend_Status', 'Unknown')).strip()
            
            if village_id:
                trend_map[village_id] = trend_status
        
        print(f"🎯 Created trend mapping for {len(trend_map)} villages using Village_ID")
        
    except Exception as e:
        print(f"❌ Error loading trend data: {str(e)}")
    
    return trend_map


def load_village_shapefile() -> Optional[gpd.GeoDataFrame]:
    """
    Load village shapefile from the specified path
    """
    try:
        shapefile_path = os.path.join(
            settings.MEDIA_ROOT, 
            'gwa_data', 
            'gwa_shp', 
            'Final_Village', 
            'Village.shp'
        )
        
        if not os.path.exists(shapefile_path):
            print(f"⚠️ Village shapefile not found: {shapefile_path}")
            return None
        
        # Read the shapefile
        village_gdf = gpd.read_file(shapefile_path)
        print(f"🗺️ Loaded village shapefile with {len(village_gdf)} villages from: {shapefile_path}")
        print(f"📋 Shapefile columns: {list(village_gdf.columns)}")
        
        # Ensure village_co column exists and is string type
        if 'village_co' in village_gdf.columns:
            village_gdf['village_co'] = village_gdf['village_co'].astype(str).str.strip()
            print(f"✅ Found village_co column with {len(village_gdf['village_co'].unique())} unique values")
        else:
            print("❌ village_co column not found in shapefile")
            return None
        
        return village_gdf
        
    except Exception as e:
        print(f"❌ Error loading village shapefile: {str(e)}")
        return None


def merge_gsr_with_shapefile(gsr_results: List[Dict[str, Any]], village_gdf: gpd.GeoDataFrame) -> Dict[str, Any]:
    """
    Merge GSR results with village shapefile and return GeoJSON
    Only includes villages that have GSR data (inner join)
    """
    try:
        # Convert GSR results to DataFrame for easier merging
        gsr_df = pd.DataFrame(gsr_results)
        
        # 🔧 FIXED: Use inner join to only get villages that have GSR data
        merged_gdf = village_gdf.merge(
            gsr_df, 
            left_on='village_co', 
            right_on='village_code', 
            how='inner'  # 🎯 Changed from 'left' to 'inner' - only keep matching villages
        )
        
        print(f"🔗 Merged {len(merged_gdf)} villages with GSR data (inner join)")
        print(f"📊 Original GSR data villages: {len(gsr_df)}")
        print(f"📊 Shapefile villages: {len(village_gdf)}")
        print(f"📊 Final merged villages: {len(merged_gdf)}")
        
        # Since we're using inner join, all villages will have GSR data
        # No need to fill NaN values as before
        
        # Convert to GeoJSON
        # Handle any potential issues with geometry serialization
        merged_gdf = merged_gdf.to_crs('EPSG:4326')  # Ensure WGS84 for web compatibility
        
        # Convert to GeoJSON format
        geojson = merged_gdf.to_json()
        geojson_dict = json.loads(geojson)
        
        # Add metadata about the merge
        merge_stats = {
            'total_shapefile_villages': len(village_gdf),
            'total_gsr_villages': len(gsr_df),
            'villages_with_geospatial_data': len(merged_gdf),  # Villages that have both GSR data and shapefile geometry
            'villages_without_geospatial_data': len(gsr_df) - len(merged_gdf),  # GSR villages without matching shapefile
            'match_success_rate': round(len(merged_gdf) / len(gsr_df) * 100, 2) if len(gsr_df) > 0 else 0
        }
        
        return {
            'geojson': geojson_dict,
            'merge_statistics': merge_stats,
            'merged_gdf': merged_gdf  # Return the GeoDataFrame for map plotting
        }
        
    except Exception as e:
        print(f"❌ Error merging GSR data with shapefile: {str(e)}")
        return {
            'geojson': None,
            'merge_statistics': {
                'error': str(e),
                'total_shapefile_villages': len(village_gdf) if village_gdf is not None else 0,
                'total_gsr_villages': len(gsr_results),
                'villages_with_geospatial_data': 0,
                'villages_without_geospatial_data': len(gsr_results),
                'match_success_rate': 0
            },
            'merged_gdf': None
        }


def generate_gsr_map_image(merged_gdf: gpd.GeoDataFrame) -> Optional[str]:
    """
    Generate GSR classification map with performance optimizations.
    Matches PDFGenerationView visual style.
    """
    from io import BytesIO
    import contextily as ctx
    import matplotlib.patches as mpatches

    try:
        if merged_gdf is None or len(merged_gdf) == 0:
            print("⚠️ No merged GeoDataFrame available for map generation")
            return None

        # 1. Simplify geometries for faster rendering
        merged_gdf_simplified = merged_gdf.copy()
        merged_gdf_simplified['geometry'] = merged_gdf_simplified['geometry'].simplify(
            tolerance=0.0001,
            preserve_topology=True
        )

        # 2. Keep in EPSG:4326 (lat/long degrees) - NO reprojection to Web Mercator
        merged_gdf_web = merged_gdf_simplified.to_crs(epsg=4326)

        # 3. Create figure (same size as original)
        fig, ax = plt.subplots(1, 1, figsize=(15, 12))

        # 4. Get unique classifications
        classification_labels = merged_gdf_web['gsr_classification'].unique()
        classification_labels = [cl for cl in classification_labels if cl]

        # 5. Vectorized color mapping
        colors = merged_gdf_web['gsr_classification'].map(get_classification_color).fillna('gray')

        # 6. Plot with same style as original
        merged_gdf_web.plot(
            ax=ax,
            color=colors,
            edgecolor='black',
            linewidth=0.75,  # Same as original
            alpha=1,
            rasterized=True  # Added for performance
        )

        # 7. Add OpenStreetMap basemap (exactly like PDFGenerationView)
        try:
            ctx.add_basemap(
            ax,
            crs=merged_gdf_web.crs,  # Use EPSG:4326
            source=ctx.providers.CartoDB.Voyager,  # CartoDB Voyager basemap
            alpha=1,   # Transparency (1 = opaque, 0 = invisible)
            zoom=10      # Adjust detail level
        )

        except Exception as e:
            print(f"⚠️ Basemap loading failed: {e}")

        # 8. Title and labels (matching PDFGenerationView format)
        ax.set_title('GSR Classification Map\n(Groundwater Supply-Requirement Analysis)',
                     fontsize=16, fontweight='bold', pad=20)
        ax.set_xlabel('LONGITUDE', fontsize=12)  # Uppercase like PDFGenerationView
        ax.set_ylabel('LATITUDE', fontsize=12)   # Uppercase like PDFGenerationView

        # 9. Create legend (using vectorized count for speed)
        classification_counts = merged_gdf_web['gsr_classification'].value_counts()
        
        legend_handles = []
        for cl in classification_labels:
            color = get_classification_color(cl)
            count = classification_counts.get(cl, 0)
            patch = mpatches.Patch(color=color, label=f"{cl} ({count})")
            legend_handles.append(patch)

        ax.legend(
            handles=legend_handles,
            title='GSR Classifications',
            title_fontsize=12,
            fontsize=10,
            loc='upper left',
            bbox_to_anchor=(1.02, 1),
            frameon=True,
            fancybox=True,
            shadow=True
        )

        ax.tick_params(axis='both', which='major', labelsize=10)
        ax.grid(True, alpha=0.3)
        plt.tight_layout()

        # 10. Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"gsr_map_{timestamp}_{unique_id}.png"
        temp_dir = os.path.join(settings.MEDIA_ROOT, 'temp')
        os.makedirs(temp_dir, exist_ok=True)
        filepath = os.path.join(temp_dir, filename)

        # 11. OPTIMIZATION: Use BytesIO buffer for faster I/O
        buffer = BytesIO()
        
        # Save with reduced DPI (150 instead of 300)
        plt.savefig(
            buffer,
            format='png',
            dpi=150,  # Reduced from 300 for speed
            bbox_inches='tight',
            facecolor='white',
            edgecolor='none'
        )
        
        # Write buffer to file
        buffer.seek(0)
        with open(filepath, 'wb') as f:
            f.write(buffer.read())
        
        buffer.close()
        plt.close(fig)

        print(f"🗺️ GSR map image saved successfully: {filepath}")
        print(f"📊 Map contains {len(merged_gdf)} villages with GSR data")
        return filename

    except Exception as e:
        print(f"❌ Error generating GSR map image: {str(e)}")
        plt.close('all')
        return None



def calculate_gsr_classification(gsr_value: float, trend_status: str) -> str:
    """
    Calculate GSR classification based on GSR ratio and trend status
    According to the classification table provided
    """
    if gsr_value is None:
        return "No Data"
    
    # Handle "No Trend Data" case - treat as "No Trend"
    if trend_status == "No Trend Data":
        trend_status = "No Trend"
    
    # Normalize trend status
    trend_status = trend_status.strip().lower()
    
    # Classification logic based on the table
    if trend_status == "increasing":
        if gsr_value < 0.95:
            return "Critical"
        elif 0.95 <= gsr_value <= 1.05:
            return "Safe"
        else:  # gsr_value > 1.05
            return "Very Safe"
    
    elif trend_status == "decreasing":
        if gsr_value < 0.95:
            return "Over Exploited"
        elif 0.95 <= gsr_value <= 1.05:
            return "Critical"
        else:  # gsr_value > 1.05
            return "Very Semi-Critical"
    
    # Handle "No Trend" cases (including any other trend status)
    else:  # This covers "no trend", "stable", and any other trend status
        if gsr_value < 0.95:
            return "Over Exploited"
        elif 0.95 <= gsr_value <= 1.05:
            return "Safe"
        else:  # gsr_value > 1.05
            return "Very Safe"


def get_classification_color(classification: str) -> str:
    """
    Return CSS color name for each of the 6 classifications
    """
    color_map = {
        'Critical': 'red',                  # Was #dc2626 (Red-600)
        'Safe': 'green',                   # Was #16a34a (Green-600)
        'Very Safe': 'teal',               # Was #059669 (Emerald-600)
        'Over Exploited': 'darkred',       # Was #991b1b (Red-800 - Most severe)
        'Very Semi-Critical': 'orange',    # Was #ea580c (Orange-600)
        'No Data': 'gold',                 # Was #ca8a04 (Yellow-600)
    }
    return color_map.get(classification, 'gray')  # Default to gray

def match_village_data(
    recharge_data: List[Dict[str, Any]],
    domestic_data: List[Dict[str, Any]], 
    agricultural_data: List[Dict[str, Any]],
    trend_csv_filename: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Match village data across recharge, domestic, agricultural datasets, and trend data
    """
    # Load trend data if filename is provided
    trend_map = load_trend_data(trend_csv_filename) if trend_csv_filename else {}
    
    # Create mappings for each dataset
    recharge_map = {}
    domestic_map = {}
    agricultural_map = {}
    
    # Process recharge data - using village_co as key
    for item in recharge_data:
        village_code = str(item.get('village_co', '')).strip()
        if village_code:
            recharge_map[village_code] = {
                'recharge': float(item.get('recharge', 0) or 0),
                'raw_data': item
            }
    
    # Process domestic data - using village_code as key
    for item in domestic_data:
        village_code = str(item.get('village_code', '')).strip()
        if village_code:
            domestic_map[village_code] = {
                'domestic_demand': float(item.get('demand_mld', 0) or 0),
                'raw_data': item
            }
    
    # Process agricultural data - using village_code as key
    for item in agricultural_data:
        village_code = str(item.get('village_code', '')).strip()
        if village_code:
            agricultural_map[village_code] = {
                'agricultural_demand': float(item.get('village_demand', 0) or 0),
                'raw_data': item
            }
    
    # Get all unique village codes
    all_village_codes = set(recharge_map.keys()) | set(domestic_map.keys()) | set(agricultural_map.keys())
    
    results = []
    
    for village_code in all_village_codes:
        # Get data for this village
        recharge_info = recharge_map.get(village_code, {})
        domestic_info = domestic_map.get(village_code, {})
        agricultural_info = agricultural_map.get(village_code, {})
        
        recharge = recharge_info.get('recharge', 0)
        domestic_demand = domestic_info.get('domestic_demand', 0)
        agricultural_demand = agricultural_info.get('agricultural_demand', 0)
        
        # Calculate total demand
        total_demand = domestic_demand + agricultural_demand
        
        # Calculate GSR (avoiding division by zero)
        if total_demand > 0:
            gsr = recharge / total_demand
            gsr_status = "Sustainable" if gsr >= 1.0 else "Stressed"
        else:
            gsr = None
            gsr_status = "No Demand"
        
        # Get trend status for this village using Village_ID from trend CSV
        trend_status = trend_map.get(village_code, "No Trend Data")
        
        # ✅ NEW: Calculate GSR classification based on GSR value and trend
        gsr_classification = calculate_gsr_classification(gsr, trend_status)
        
        # ✅ NEW: Get color for the classification
        classification_color = get_classification_color(gsr_classification)
        
        # Get additional village information from raw data
        village_info = {
            'village_name': 'N/A',
            'subdistrict_code': 'N/A'
        }
        
        # Try to get village name and other info from any available dataset
        for raw_data in [recharge_info.get('raw_data', {}), 
                        domestic_info.get('raw_data', {}), 
                        agricultural_info.get('raw_data', {})]:
            if raw_data:
                if village_info['village_name'] == 'N/A':
                    village_info['village_name'] = raw_data.get('village_name', 
                                                             raw_data.get('village', 'N/A'))
                if village_info['subdistrict_code'] == 'N/A':
                    village_info['subdistrict_code'] = raw_data.get('subdistrict_code', 
                                                                  raw_data.get('subdis_cod', 'N/A'))
        
        # ✅ UPDATED: Create result record with classification and color fields
        result = {
            'village_code': village_code,
            'village_name': village_info['village_name'],
            'subdistrict_code': village_info['subdistrict_code'],
            'recharge': round(recharge, 4),
            'domestic_demand': round(domestic_demand, 4),
            'agricultural_demand': round(agricultural_demand, 4),
            'total_demand': round(total_demand, 4),
            'gsr': round(gsr, 4) if gsr is not None else None,
            'gsr_status': gsr_status,
            'trend_status': trend_status,                    # Trend from CSV
            'gsr_classification': gsr_classification,        # ✅ NEW: Classification field
            'classification_color': classification_color,    # ✅ NEW: Color field
            'has_recharge_data': village_code in recharge_map,
            'has_domestic_data': village_code in domestic_map,
            'has_agricultural_data': village_code in agricultural_map,
            'has_trend_data': village_code in trend_map
        }
        
        results.append(result)
    
    return results


def calculate_gsr_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate summary statistics for GSR analysis including classification distribution"""
    
    if not results:
        return {}
    
    total_villages = len(results)
    total_recharge = sum(r['recharge'] for r in results)
    total_domestic = sum(r['domestic_demand'] for r in results)
    total_agricultural = sum(r['agricultural_demand'] for r in results)
    total_demand = sum(r['total_demand'] for r in results)
    
    # Count villages by status
    sustainable_count = sum(1 for r in results if r['gsr_status'] == 'Sustainable')
    stressed_count = sum(1 for r in results if r['gsr_status'] == 'Stressed')
    no_demand_count = sum(1 for r in results if r['gsr_status'] == 'No Demand')
    
    # Count villages by trend status
    trend_counts = {}
    villages_with_trend_data = sum(1 for r in results if r['has_trend_data'])
    
    for result in results:
        trend_status = result['trend_status']
        trend_counts[trend_status] = trend_counts.get(trend_status, 0) + 1
    
    # ✅ NEW: Count villages by classification
    classification_counts = {}
    for result in results:
        classification = result['gsr_classification']
        classification_counts[classification] = classification_counts.get(classification, 0) + 1
    
    # Calculate overall GSR
    overall_gsr = total_recharge / total_demand if total_demand > 0 else None
    
    # Calculate average GSR (excluding villages with no demand)
    valid_gsr_values = [r['gsr'] for r in results if r['gsr'] is not None]
    avg_gsr = sum(valid_gsr_values) / len(valid_gsr_values) if valid_gsr_values else 0
    
    return {
        'total_villages': total_villages,
        'total_recharge': round(total_recharge, 4),
        'total_domestic_demand': round(total_domestic, 4),
        'total_agricultural_demand': round(total_agricultural, 4),
        'total_demand': round(total_demand, 4),
        'overall_gsr': round(overall_gsr, 4) if overall_gsr is not None else None,
        'average_gsr': round(avg_gsr, 4),
        'sustainable_villages': sustainable_count,
        'stressed_villages': stressed_count,
        'no_demand_villages': no_demand_count,
        'sustainability_percentage': round((sustainable_count / total_villages) * 100, 2) if total_villages > 0 else 0,
        'villages_with_trend_data': villages_with_trend_data,
        'trend_distribution': trend_counts,
        'classification_distribution': classification_counts  # ✅ NEW: Classification breakdown
    }


class GSRComputeAPIView(APIView):
    """
    API View to compute GSR (Groundwater Supply-Requirement) analysis with geospatial data
    """
    permission_classes = [AllowAny]
    
    def post(self, request, format=None):
        try:
            data = request.data
            
            # Extract data arrays from request
            recharge_data = data.get('rechargeData', [])
            domestic_data = data.get('domesticData', [])
            agricultural_data = data.get('agriculturalData', [])
            selected_subdistricts = data.get('selectedSubDistricts', [])
            trend_csv_filename = data.get('trendCsvFilename')  # Get trend CSV filename
            
            # Log trend CSV filename
            if trend_csv_filename:
                print(f"🎯 Received trend CSV filename: {trend_csv_filename}")
            else:
                print("⚠️ No trend CSV filename provided")
            
            # Validation
            if not recharge_data:
                return Response({
                    "success": False,
                    "error": "Recharge data is required for GSR analysis"
                }, status=400)
            
            if not domestic_data and not agricultural_data:
                return Response({
                    "success": False,
                    "error": "At least one demand dataset (domestic or agricultural) is required"
                }, status=400)
            
            # Match village data across all datasets including trend data
            matched_results = match_village_data(
                recharge_data, 
                domestic_data, 
                agricultural_data, 
                trend_csv_filename
            )
            
            if not matched_results:
                return Response({
                    "success": False,
                    "error": "No villages could be matched across the provided datasets"
                }, status=404)
            
            # ✅ NEW: Sort by classification priority
            classification_priority = {
                "Over Exploited": 1,      # Most critical
                "Critical": 2,
                "Very Semi-Critical": 3,
                "Safe": 4,
                "Very Safe": 5,          # Best condition
                "Unknown Status": 6,
                "No Data": 7
            }
            
            matched_results.sort(key=lambda x: (
                classification_priority.get(x['gsr_classification'], 999),
                -(x['gsr'] or 0)  # Then by GSR value descending
            ))
            
            # Calculate summary statistics
            summary = calculate_gsr_summary(matched_results)
            
            # ✅ NEW: Load village shapefile and merge with GSR data
            village_gdf = load_village_shapefile()
            geospatial_result = None
            map_image_filename = None
            
            if village_gdf is not None:
                print("🗺️ Merging GSR data with village shapefile...")
                geospatial_result = merge_gsr_with_shapefile(matched_results, village_gdf)
                
                # ✅ NEW: Generate map image if merge was successful
                if geospatial_result.get('merged_gdf') is not None:
                    print("🎨 Generating GSR map image...")
                    map_image_filename = generate_gsr_map_image(geospatial_result['merged_gdf'])
                    map_image_base64 = None
                    if map_image_filename:
                        map_image_path = os.path.join(settings.MEDIA_ROOT, 'temp', map_image_filename)
                        try:
                            with open(map_image_path, "rb") as img_file:
                                map_image_base64 = base64.b64encode(img_file.read()).decode("utf-8")
                        except Exception as e:
                            print(f"❌ Error encoding map image to base64: {str(e)}")

                    
                                    
            else:
                print("⚠️ Could not load village shapefile - proceeding without geospatial data")
                geospatial_result = {
                    'geojson': None,
                    'merge_statistics': {
                        'error': 'Village shapefile not found or could not be loaded',
                        'total_shapefile_villages': 0,
                        'villages_with_gsr_data': 0,
                        'villages_without_gsr_data': 0,
                        'merge_success_rate': 0
                    }
                }
            
            # ✅ NEW: Add debug logging
            if matched_results:
                sample_result = matched_results[0]
                print(f"📊 Sample result with classification:")
                print(f"  - Village: {sample_result['village_name']}")
                print(f"  - GSR: {sample_result['gsr']}")
                print(f"  - Trend: {sample_result['trend_status']}")
                print(f"  - Classification: {sample_result['gsr_classification']}")
                print(f"  - Color: {sample_result['classification_color']}")
            
            # Additional metadata
            metadata = {
                'computation_timestamp': pd.Timestamp.now().isoformat(),
                'input_datasets': {
                    'recharge_villages': len(recharge_data),
                    'domestic_villages': len(domestic_data),
                    'agricultural_villages': len(agricultural_data)
                },
                'selected_subdistricts': selected_subdistricts,
                'trend_csv_filename': trend_csv_filename,
                'map_image_filename': map_image_filename,  # ✅ NEW: Add map image filename
                'flags': {
                    'has_domestic_demand': data.get('hasDomesticDemand', False),
                    'has_agricultural_demand': data.get('hasAgriculturalDemand', False),
                    'has_recharge_data': data.get('hasRechargeData', False),
                    'has_trend_data': trend_csv_filename is not None,
                    'has_geospatial_data': geospatial_result['geojson'] is not None,
                    'has_map_image': map_image_filename is not None  # ✅ NEW: Map image flag
                }
            }
            
            # ✅ ENHANCED: Response with both JSON and GeoJSON data
            response_data = {
            "success": True,
            "message": f"GSR analysis completed successfully for {len(matched_results)} villages",
            "data": matched_results,  # Original JSON GSR results
            "summary": summary,
            "metadata": metadata,
            "villages_count": len(matched_results),
            # ✅ NEW: Geospatial data with merged shapefile + GSR results
            "geospatial_data": geospatial_result['geojson'],
            "merge_statistics": geospatial_result['merge_statistics'],
            "map_image_filename": map_image_filename,  # ✅ NEW: Return map image filename
            "map_image_base64": f"data:image/png;base64,{map_image_base64}" if map_image_base64 else None  # ✅ NEW: Add base64 image string
        }

            
            return Response(response_data, status=200)
            
        except Exception as e:
            return Response({
                "success": False,
                "error": f"Internal server error during GSR computation: {str(e)}"
            }, status=500)
    
    def get(self, request, format=None):
        """
        GET endpoint for API documentation/health check
        """
        return Response({
            "service": "GSR Computation API with Geospatial Integration and Map Image Generation",
            "version": "2.1",
            "description": "Computes GSR analysis with comprehensive classification and returns both JSON and GeoJSON data along with map image",
            "expected_payload": {
                "rechargeData": "Array of recharge data with 'village_co' and 'recharge' fields",
                "domesticData": "Array of domestic demand data with 'village_code' and 'demand_mld' fields", 
                "agriculturalData": "Array of agricultural demand data with 'village_code' and 'village_demand' fields",
                "selectedSubDistricts": "Array of selected subdistrict codes",
                "trendCsvFilename": "Optional filename of trend CSV (stored in media/temp/) with Village_ID field",
                "hasDomesticDemand": "Boolean flag",
                "hasAgriculturalDemand": "Boolean flag", 
                "hasRechargeData": "Boolean flag"
            },
            "response_format": {
                "success": "Boolean",
                "data": "Array of village GSR results with trend_status, gsr_classification and classification_color fields",
                "summary": "Summary statistics including trend and classification distribution",
                "metadata": "Additional computation metadata including map_image_filename",
                "geospatial_data": "GeoJSON FeatureCollection with village polygons and GSR data merged",
                "merge_statistics": "Statistics about shapefile-GSR data merge success",
                "map_image_filename": "Filename of generated map image saved in media/temp/"
            },
            "shapefile_integration": {
                "shapefile_path": "media/gwa_data/gwa_shp/Final_Village/Village.shp",
                "matching_fields": {
                    "shapefile": "village_co",
                    "gsr_data": "village_code (from Village_ID)"
                },
                "merge_type": "inner join (keeps only villages with GSR data)",
                "output_format": "GeoJSON with WGS84 (EPSG:4326) coordinate system"
            },
            "map_image_generation": {
                "description": "Automatically generates a choropleth map image of GSR classifications",
                "output_format": "PNG image at 300 DPI",
                "save_location": "media/temp/",
                "filename_pattern": "gsr_map_YYYYMMDD_HHMMSS_<8-char-uuid>.png",
                "features": [
                    "Color-coded villages by GSR classification",
                    "Legend showing classification meanings and village counts",
                    "Grid lines and coordinate labels",
                    "High-resolution output suitable for reports"
                ]
            },
            "classifications": {
                "Critical": {
                    "description": "GSR < 0.95 with Increasing trend OR GSR 0.95-1.05 with Decreasing trend",
                    "color": "red"
                },
                "Safe": {
                    "description": "GSR 0.95-1.05 with Increasing/No trend",
                    "color": "green"
                },
                "Very Safe": {
                    "description": "GSR > 1.05 with Increasing/No trend",
                    "color": "teal"
                },
                "Over Exploited": {
                    "description": "GSR < 0.95 with Decreasing/No trend",
                    "color": "darkred"
                },
                "Very Semi-Critical": {
                    "description": "GSR > 1.05 with Decreasing trend",
                    "color": "orange"
                },
                "Unknown Status": {
                    "description": "Unknown trend status",
                    "color": "gray"
                },
                "No Data": {
                    "description": "Missing GSR data",
                    "color": "gold"
                }
            }
        }, status=200)