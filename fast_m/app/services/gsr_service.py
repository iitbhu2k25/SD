# app/services/gsr_service.py

import os
import re
import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from io import BytesIO

import geopandas as gpd
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
import matplotlib.patches as mpatches

BASE_MEDIA = "media"   # same as Django MEDIA_ROOT

# -----------------------------------------------------------
# Helper functions
# -----------------------------------------------------------

def parse_to_list(value) -> List[str]:
    """Parses a string, list, or None into a list of strings"""
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [s.strip() for s in re.split(r"[,\|]+", str(value)) if s.strip()]

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
        csv_path = os.path.join(BASE_MEDIA, "temp", trend_csv_filename)
        
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
            BASE_MEDIA, 
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
        
        # Use inner join to only get villages that have GSR data
        merged_gdf = village_gdf.merge(
            gsr_df, 
            left_on='village_co', 
            right_on='village_code', 
            how='inner'  # Only keep matching villages
        )
        
        print(f"🔗 Merged {len(merged_gdf)} villages with GSR data (inner join)")
        print(f"📊 Original GSR data villages: {len(gsr_df)}")
        print(f"📊 Shapefile villages: {len(village_gdf)}")
        print(f"📊 Final merged villages: {len(merged_gdf)}")
        
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
            'villages_with_geospatial_data': len(merged_gdf),
            'villages_without_geospatial_data': len(gsr_df) - len(merged_gdf),
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
    """
    try:
        import contextlib
        with contextlib.suppress(ImportError):
            import contextily as ctx
            
        if merged_gdf is None or len(merged_gdf) == 0:
            print("⚠️ No merged GeoDataFrame available for map generation")
            return None

        # 1. Simplify geometries for faster rendering
        merged_gdf_simplified = merged_gdf.copy()
        merged_gdf_simplified['geometry'] = merged_gdf_simplified['geometry'].simplify(
            tolerance=0.0001,
            preserve_topology=True
        )

        # 2. Keep in EPSG:4326 (lat/long degrees)
        merged_gdf_web = merged_gdf_simplified.to_crs(epsg=4326)

        # 3. Create figure
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
            linewidth=0.75,
            alpha=1,
            rasterized=True  # Added for performance
        )

        # 7. Add OpenStreetMap basemap if contextily is available
        try:
            if 'ctx' in locals():
                ctx.add_basemap(
                    ax,
                    crs=merged_gdf_web.crs,  # Use EPSG:4326
                    source=ctx.providers.CartoDB.Voyager,  # CartoDB Voyager basemap
                    alpha=1,
                    zoom=10
                )
        except Exception as e:
            print(f"⚠️ Basemap loading failed: {e}")

        # 8. Title and labels
        ax.set_title('GSR Classification Map\n(Groundwater Supply-Requirement Analysis)',
                     fontsize=16, fontweight='bold', pad=20)
        ax.set_xlabel('LONGITUDE', fontsize=12)
        ax.set_ylabel('LATITUDE', fontsize=12)

        # 9. Create legend
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
        temp_dir = os.path.join(BASE_MEDIA, 'temp')
        os.makedirs(temp_dir, exist_ok=True)
        filepath = os.path.join(temp_dir, filename)

        # 11. Save with reduced DPI
        buffer = BytesIO()
        
        plt.savefig(
            buffer,
            format='png',
            dpi=150,
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
        'Critical': 'red',
        'Safe': 'green',
        'Very Safe': 'teal',
        'Over Exploited': 'darkred',
        'Very Semi-Critical': 'orange',
        'No Data': 'transparent',
    }
    return color_map.get(classification, 'gray')

def match_village_data_combined(
    recharge_data: List[Dict[str, Any]],
    combined_demand_data: List[Dict[str, Any]],
    trend_csv_filename: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Match village data between recharge and combined demand datasets, and trend data
    Combined demand data already has domestic, agricultural, and industrial demand aggregated
    """
    # Load trend data if filename is provided
    trend_map = load_trend_data(trend_csv_filename) if trend_csv_filename else {}
    
    # Create mappings for each dataset
    recharge_map = {}
    demand_map = {}
    
    # Process recharge data - using village_co as key
    for item in recharge_data:
        village_code = str(item.get('village_co', '')).strip()
        if village_code:
            recharge_map[village_code] = {
                'recharge': float(item.get('recharge', 0) or 0),
                'village_name': item.get('village_name', 'N/A'),
                'subdistrict_code': item.get('subdis_cod', item.get('subdistrict_code', 'N/A')),
                'raw_data': item
            }
    
    # Process combined demand data - using village_code as key
    for item in combined_demand_data:
        village_code = str(item.get('village_code', '')).strip()
        if village_code:
            demand_map[village_code] = {
                'village_name': item.get('village_name', 'N/A'),
                'domestic_demand': float(item.get('domestic_demand', 0) or 0),
                'agricultural_demand': float(item.get('agricultural_demand', 0) or 0),
                'industrial_demand': float(item.get('industrial_demand', 0) or 0),
                'total_demand': float(item.get('total_demand', 0) or 0),  # Use pre-calculated total
                'raw_data': item
            }
    
    # Get all unique village codes from both datasets
    all_village_codes = set(recharge_map.keys()) | set(demand_map.keys())
    
    results = []
    
    for village_code in all_village_codes:
        # Get data for this village
        recharge_info = recharge_map.get(village_code, {})
        demand_info = demand_map.get(village_code, {})
        
        # Extract values
        recharge = recharge_info.get('recharge', 0)
        domestic_demand = demand_info.get('domestic_demand', 0)
        agricultural_demand = demand_info.get('agricultural_demand', 0)
        industrial_demand = demand_info.get('industrial_demand', 0)
        total_demand = demand_info.get('total_demand', 0)  # Use pre-calculated total from frontend
        
        # Get village info (prefer from recharge data, fallback to demand data)
       
        village_name = demand_info.get('village_name') or recharge_info.get('village_name', 'N/A')
        subdistrict_code = recharge_info.get('subdistrict_code', 'N/A')

        # Debug: Log name matching
        if village_name == 'N/A':
            print(f"⚠️ No village name found for code {village_code}")
            print(f"   Recharge info: {recharge_info.get('village_name', 'missing')}")
            print(f"   Demand info: {demand_info.get('village_name', 'missing')}")
        
        # Calculate GSR (avoiding division by zero)
        if total_demand > 0:
            gsr = recharge / total_demand
            gsr_status = "Sustainable" if gsr >= 1.0 else "Stressed"
        else:
            gsr = None
            gsr_status = "No Demand"
        
        # Get trend status for this village using Village_ID from trend CSV
        trend_status = trend_map.get(village_code, "No Trend Data")
        
        # Calculate GSR classification based on GSR value and trend
        gsr_classification = calculate_gsr_classification(gsr, trend_status)
        
        # Get color for the classification
        classification_color = get_classification_color(gsr_classification)
        
        # Create result record with classification and color fields
        result = {
            'village_code': village_code,
            'village_name': village_name,
            'subdistrict_code': subdistrict_code,
            'recharge': round(recharge, 4),
            'domestic_demand': round(domestic_demand, 4),
            'agricultural_demand': round(agricultural_demand, 4),
            'industrial_demand': round(industrial_demand, 4),
            'total_demand': round(total_demand, 4),
            'gsr': round(gsr, 4) if gsr is not None else None,
            'gsr_status': gsr_status,
            'trend_status': trend_status,                  
            'gsr_classification': gsr_classification,       
            'classification_color': classification_color,    
            'has_recharge_data': village_code in recharge_map,
            'has_demand_data': village_code in demand_map,
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
    total_industrial = sum(r['industrial_demand'] for r in results)
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
    
    # Count villages by classification
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
        'total_industrial_demand': round(total_industrial, 4),
        'total_demand': round(total_demand, 4),
        'overall_gsr': round(overall_gsr, 4) if overall_gsr is not None else None,
        'average_gsr': round(avg_gsr, 4),
        'sustainable_villages': sustainable_count,
        'stressed_villages': stressed_count,
        'no_demand_villages': no_demand_count,
        'sustainability_percentage': round((sustainable_count / total_villages) * 100, 2) if total_villages > 0 else 0,
        'villages_with_trend_data': villages_with_trend_data,
        'trend_distribution': trend_counts,
        'classification_distribution': classification_counts  
    }