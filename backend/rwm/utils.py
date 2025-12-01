# @csrf_exempt
from django.conf import settings
import rasterio
from rasterio.transform import from_bounds
from rasterio.mask import geometry_mask
from shapely.geometry import Point 

from scipy.spatial.distance import cdist
from scipy.interpolate import griddata
import numpy as np
import geopandas as gpd
import os
import json
from .models import WaterQuality_sampling_point_data, WaterQuality_upstream, WaterQuality_downstream, Stretches
import pandas as pd
from rasterio.features import geometry_mask
from rasterio.transform import from_bounds
from shapely.ops import unary_union


from .views import *

import pandas as pd
import numpy as np



# Updated parameter labels (EC instead of TDS/TSS, added TS)
labels = [
    "do", "bod", "faecal_coliform", "ph", "turbidity",
    "ec", "ts", "cod", "temperature", "nitrate"
]


# Optimized PCM matrix - meets all requirements
# Top 4: DO (19.22%), BOD (18.42%), Faecal (16.71%), pH (14.59%) = 68.93%
# Consistency Ratio: 0.0108 (< 0.1) ✓
# Maximum WQI: 1117.50 (< 2000) ✓
pcm = np.array([
    [1,     1.05,  1.20,  1.40,  2.00,  3.20,  4.20,  5.20,  6.50,  9.00],  # DO
    [1/1.05, 1,    1.15,  1.35,  1.95,  3.10,  4.00,  5.00,  6.20,  8.50],  # BOD
    [1/1.20, 1/1.15, 1,   1.20,  1.80,  2.90,  3.70,  4.60,  5.80,  8.00],  # Faecal Coliform
    [1/1.40, 1/1.35, 1/1.20, 1,  1.60,  2.60,  3.30,  4.10,  5.30,  7.00],  # pH
    [1/2.00, 1/1.95, 1/1.80, 1/1.60, 1, 2.30,  2.90,  3.60,  4.70,  6.50],  # Turbidity
    [1/3.20, 1/3.10, 1/2.90, 1/2.60, 1/2.30, 1, 1.70, 2.30,  3.10,  4.50],  # EC
    [1/4.20, 1/4.00, 1/3.70, 1/3.30, 1/2.90, 1/1.70, 1, 1.70, 2.40,  3.90],  # TS
    [1/5.20, 1/5.00, 1/4.60, 1/4.10, 1/3.60, 1/2.30, 1/1.70, 1, 1.90, 3.10],  # COD
    [1/6.50, 1/6.20, 1/5.80, 1/5.30, 1/4.70, 1/3.10, 1/2.40, 1/1.90, 1, 2.30],  # Temperature
    [1/9.00, 1/8.50, 1/8.00, 1/7.00, 1/6.50, 1/4.50, 1/3.90, 1/3.10, 1/2.30, 1]   # Nitrate
])


def calculate_ahp_from_pcm(pcm, labels):
    """
    Calculate AHP weights from Pairwise Comparison Matrix
    
    Parameters:
    pcm: numpy array representing the pairwise comparison matrix
    labels: list of parameter names corresponding to PCM rows/columns
    
    Returns:
    dict with weights, consistency index, consistency ratio, and validation status
    """
    n = pcm.shape[0]
    
    # Validate dimensions
    if len(labels) != n:
        raise ValueError(f"Labels ({len(labels)}) must match PCM dimension ({n})")
    
    # Step 1: Normalize matrix
    col_sum = np.sum(pcm, axis=0)
    norm_matrix = pcm / col_sum
    
    # Step 2: Get weights by averaging rows
    weights = np.mean(norm_matrix, axis=1)
    
    # Step 3: Eigenvalue method for λ_max
    weighted_sum = np.dot(pcm, weights)
    lambda_max = np.sum(weighted_sum / weights) / n
    CI = (lambda_max - n) / (n - 1)
    
    # Step 4: Consistency Ratio
    RI_dict = {
        1: 0.0, 2: 0.0, 3: 0.58, 4: 0.9, 5: 1.12,
        6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49
    }
    RI = RI_dict.get(n, 1.49)
    CR = CI / RI if RI != 0 else 0

    return {
        "weights": dict(zip(labels, weights)),
        "ci": CI,
        "cr": CR,
        "lambda_max": lambda_max,
        "is_consistent": CR < 0.1
    }

def WQI(data, pcm, labels):
    """
    WQI calculation using rank-weighted 10-parameter method
    (Maintains same interface but uses different calculation methodology)
    
    Parameters:
    data: DataFrame with water quality parameters
    pcm: not used in this implementation (kept for compatibility)
    labels: not used in this implementation (kept for compatibility)
    
    Returns:
    DataFrame with WQI calculations added
    """
    # Validate input
    if data.empty:
        raise ValueError("Input DataFrame is empty")
    
    # Create copy to avoid modifying original
    data = data.copy()
    
    # Convert all expected columns to numeric
    expected_params = ['do', 'bod', 'faecal_coliform', 'ph', 'turbidity', 'ec', 'ts', 'cod', 'temperature', 'nitrate']
    
    for col in expected_params:
        if col in data.columns:
            data[col] = pd.to_numeric(data[col], errors='coerce')
            # print(f"✓ Converted {col} to numeric")
    
    # -------- Define standards and weights (10-parameter method) --------
    standards = {
        "do": {"ideal": 7.0, "standard": 5.0, "type": "beneficial"},
        "bod": {"ideal": 0.0, "standard": 3.0, "type": "detrimental", "log": True},
        "faecal_coliform": {"ideal": 0.0, "standard": 500.0, "type": "detrimental", "log": True},
        "ph": {"ideal": 7.0, "low": 6.5, "high": 8.5, "type": "pH"},
        "turbidity": {"ideal": 0.0, "standard": 10.0, "type": "detrimental", "log": False},
        "ec": {"ideal": 0.0, "standard": 1500.0, "type": "detrimental", "log": True},
        "ts": {"ideal": 0.0, "standard": 1500.0, "type": "detrimental", "log": True},
        "cod": {"ideal": 0.0, "standard": 30.0, "type": "detrimental", "log": True},
        "temperature": {"ideal": 25.0, "standard": 35.0, "type": "detrimental_temp"},
        "nitrate": {"ideal": 0.0, "standard": 45.0, "type": "detrimental", "log": True}
    }
    
    # Rank-based weights (DO=10, BOD=9, ..., Nitrate=1)
    ranks = ["do", "bod", "faecal_coliform", "ph", "turbidity", "ec", "ts", "cod", "temperature", "nitrate"]
    raw_w = {p: (11 - (i+1)) for i, p in enumerate(ranks)}
    weight_sum = sum(raw_w.values())
    weights = {k: v/weight_sum for k, v in raw_w.items()}
    
    print("\n=== Rank-Based Weights ===")
    for param, weight in weights.items():
        print(f"{param:20s}: {weight:.6f} ({weight*100:.2f}%)")
    
    # -------- Sub-index calculation functions --------
    def qi_beneficial(value, ideal, standard):
        """For parameters where higher is better (DO)"""
        if pd.isna(value):
            return np.nan
        qi = 100 * (ideal - value) / (ideal - standard)
        return float(max(0, min(qi, 300)))
    
    def qi_ph(value, ideal, low, high):
        """For pH - deviation from neutral"""
        if pd.isna(value):
            return np.nan
        dev = abs(value - ideal)
        max_dev = max(abs(low - ideal), abs(high - ideal))
        qi = 100 * dev / max_dev
        return float(max(0, min(qi, 300)))
    
    def qi_detrimental(value, ideal, standard, use_log=False):
        """For pollutants where lower is better"""
        if pd.isna(value):
            return np.nan
        if use_log:
            qi = 100 * (np.log10(value + 1) - np.log10(ideal + 1)) / (np.log10(standard + 1) - np.log10(ideal + 1))
        else:
            qi = 100 * (value - ideal) / (standard - ideal)
        return float(max(0, min(qi, 300)))
    
    def qi_temperature(value, ideal, standard):
        """For temperature - penalizes values above ideal"""
        if pd.isna(value):
            return np.nan
        v = max(value - ideal, 0.0)
        qi = 100 * v / (standard - ideal)
        return float(max(0, min(qi, 300)))
    
    # -------- Compute sub-indices --------
    # print("\n=== Computing Sub-Indices ===")
    for param in ranks:
        if param not in data.columns:
            # print(f"⚠ Skipping {param} - not in data columns")
            data[f"Qi_{param}"] = np.nan
            continue
        
        st = standards[param]
        
        if st["type"] == "beneficial":
            data[f"Qi_{param}"] = data[param].apply(lambda x: qi_beneficial(x, st["ideal"], st["standard"]))
        elif st["type"] == "pH":
            data[f"Qi_{param}"] = data[param].apply(lambda x: qi_ph(x, st["ideal"], st["low"], st["high"]))
        elif st["type"] == "detrimental":
            data[f"Qi_{param}"] = data[param].apply(lambda x: qi_detrimental(x, st["ideal"], st["standard"], st.get("log", False)))
        elif st["type"] == "detrimental_temp":
            data[f"Qi_{param}"] = data[param].apply(lambda x: qi_temperature(x, st["ideal"], st["standard"]))
        
        valid_count = data[f"Qi_{param}"].notna().sum()
        # print(f"✓ Computed Qi_{param}: {valid_count} valid values")
    
    # -------- Calculate final WQI --------
    # print("\n=== Computing Final WQI ===")
    data["WQI"] = 0.0
    
    for param in ranks:
        qi_col = f"Qi_{param}"
        if qi_col in data.columns:
            # Add weighted sub-index to WQI
            data["WQI"] += data[qi_col].fillna(0) * weights[param]
    
    # Set WQI to NaN where all parameters are missing
    qi_cols = [f"Qi_{param}" for param in ranks if f"Qi_{param}" in data.columns]
    all_nan_mask = data[qi_cols].isna().all(axis=1)
    data.loc[all_nan_mask, "WQI"] = np.nan
    
    # -------- Classification --------
    def classify_wqi(v):
        if pd.isna(v):
            return "No Data"
        if v <= 50:
            return "Excellent"
        if v <= 100:
            return "Good"
        if v <= 200:
            return "Poor"
        if v <= 300:
            return "Very Poor"
        return "Unsuitable"
    
    data["WQI_Class"] = data["WQI"].apply(classify_wqi)
    
    # -------- Final statistics --------
    wqi_valid_count = data["WQI"].notna().sum()
    
    if wqi_valid_count == 0:
        print("\n⚠ WARNING: All WQI values are NaN - check parameter columns!")
    else:
        wqi_mean = data["WQI"].mean()
        wqi_min = data["WQI"].min()
        wqi_max = data["WQI"].max()
       
        
        # Show classification distribution
        class_counts = data["WQI_Class"].value_counts()
        
    return data




def load_subdistrict_boundaries(sub_district_codes):
    """
    Load subdistrict boundary geometries based on your shapefile structure
    """
    try:
        shp_path = os.path.join(settings.MEDIA_ROOT, 'rwm_data', 'clipped_subdist', 'clipped_subdist.shp')
        
        if not os.path.exists(shp_path):
            # print(f"Subdistrict shapefile not found at: {shp_path}")
            return gpd.GeoDataFrame()
        
        gdf = gpd.read_file(shp_path)
        # print(f"===========================================Available columns in subdistrict shapefile: {list(gdf.columns)}===========================================")
        
        # Instead of Validating geometries we are Attempting to fix invalids, then drop empties as some valid geometries are dropped in the previous process
        gdf['geometry'] = gdf.geometry.make_valid()
        gdf = gdf[~gdf.geometry.is_empty]
        
        if gdf.empty:
            # print("No valid geometries in subdistrict shapefile")
            return gpd.GeoDataFrame()
        
        # Try different possible column names for subdistrict codes
        possible_columns = ['SUBDIS_COD', 'SUBDIST_CO', 'Sub_District_Code', 'subdist_code']
        subdistrict_column = None
        
        for col in possible_columns:
            if col in gdf.columns:
                subdistrict_column = col
                print(f"Found subdistrict column: {col}")
                break
        
        if subdistrict_column is None:
            # print(f"Warning: No matching subdistrict code column found. Available columns: {list(gdf.columns)}")
            # print(f"Expected one of: {possible_columns}")
            return gpd.GeoDataFrame()
        
        
        # Convert sub_district_codes to string and normalize
        sub_district_codes_str = [str(code).strip().lower() for code in sub_district_codes]
        gdf[subdistrict_column] = gdf[subdistrict_column].astype(str).str.strip().str.lower()
        
        print(f"Looking for subdistrict codes: {sub_district_codes_str}")
        print(f"Available codes in shapefile: {sorted(gdf[subdistrict_column].unique().tolist())}")
        
        # Filter by subdistrict codes
        gdf_filtered = gdf[gdf[subdistrict_column].isin(sub_district_codes_str)]
        
        if gdf_filtered.empty:
            # print(f"No subdistricts found for codes: {sub_district_codes}")
            # print(f"Tried matching: {sub_district_codes_str}")
            # print(f"Against available codes: {gdf[subdistrict_column].unique()[:10]}")
            return gpd.GeoDataFrame()
        
        # Ensure CRS is EPSG:4326
        if gdf_filtered.crs is None:
            # print("Setting subdistrict CRS to EPSG:4326")
            gdf_filtered.set_crs('EPSG:4326', inplace=True)
        elif gdf_filtered.crs != 'EPSG:4326':
            print(f"Reprojecting subdistricts from {gdf_filtered.crs} to EPSG:4326")
            gdf_filtered = gdf_filtered.to_crs('EPSG:4326')
            
        print(f"Successfully loaded {len(gdf_filtered)} subdistrict boundaries")
        return gdf_filtered
        
    except Exception as e:
        # print(f"Error loading subdistrict boundaries: {e}")
        import traceback
        traceback.print_exc()
        return gpd.GeoDataFrame()
    

def load_stretch_lines(stretch_ids):
    """
    Load Stretch boundary geometries based on your shapefile structure
    FIXED: Consistent parameter naming and better error handling
    """
    try:
        shp_path = os.path.join(settings.MEDIA_ROOT, 'rwm_data', 'stretch_shp', 'stretch.shp')
        
        if not os.path.exists(shp_path):
            # print(f"stretch_shp shapefile not found at: {shp_path}")
            return gpd.GeoDataFrame()
        
        gdf = gpd.read_file(shp_path)
        # print(f"Available columns in stretch shapefile: {list(gdf.columns)}")
        # print(f"Total features in stretch shapefile: {len(gdf)}")
        
        # Validate geometries
        gdf = gdf[gdf.geometry.is_valid & ~gdf.geometry.is_empty]
        # print(f"Valid stretch geometries: {len(gdf)}")
        
        if gdf.empty:
            # print("No valid geometries in stretch shapefile")
            return gpd.GeoDataFrame()
        
        # Try different possible column names for stretch codes
        possible_columns = ['Stretch_ID', 'STRETCH_ID', 'stretch_id', 'ID', 'id', 'StretchID', 'STRETCHID']
        stretch_column = None
        
        for col in possible_columns:
            if col in gdf.columns:
                stretch_column = col
                # print(f"Found Stretch column: {col}")
                break
        
        if stretch_column is None:
            # print(f"Warning: No matching Stretch code column found. Available columns: {list(gdf.columns)}")
            # print(f"Expected one of: {possible_columns}")
            # Return unfiltered data if no stretch IDs provided or if column not found
            if not stretch_ids:
                # print("No stretch IDs provided, returning all stretch lines")
                return gdf
            else:
                # print("Stretch IDs provided but no matching column found")
                return gpd.GeoDataFrame()
        
        # If no stretch_ids provided, return all data
        if not stretch_ids:
            # print("No stretch IDs provided for filtering, returning all stretch lines")
            # Ensure proper CRS
            if gdf.crs is None:
                # print("Setting stretch CRS to EPSG:4326")
                gdf.set_crs('EPSG:4326', inplace=True)
            elif gdf.crs != 'EPSG:4326':
                # print(f"Reprojecting stretch from {gdf.crs} to EPSG:4326")
                gdf = gdf.to_crs('EPSG:4326')
            return gdf
        
        # print(f"Using column '{stretch_column}' for filtering")
        # print(f"Sample values in {stretch_column}: {gdf[stretch_column].head().tolist()}")
        
        # Convert stretch_ids to string and normalize
        stretch_ids_str = [str(code).strip().lower() for code in stretch_ids]
        gdf[stretch_column] = gdf[stretch_column].astype(str).str.strip().str.lower()
        
        # print(f"Looking for Stretch codes: {stretch_ids_str}")
        # print(f"Available codes in shapefile: {sorted(gdf[stretch_column].unique().tolist())[:20]}")  # Show first 20
        
        # Filter by stretch codes
        gdf_filtered = gdf[gdf[stretch_column].isin(stretch_ids_str)]
        
        if gdf_filtered.empty:
            # print(f"No Stretch found for codes: {stretch_ids}")
            # print(f"Tried matching: {stretch_ids_str}")
            # print(f"Against available codes: {gdf[stretch_column].unique()[:10]}")
            
            # Try exact match without normalization as fallback
            # print("Trying exact match without case normalization...")
            gdf_original = gpd.read_file(shp_path)
            if stretch_column in gdf_original.columns:
                gdf_exact = gdf_original[gdf_original[stretch_column].isin([str(code) for code in stretch_ids])]
                if not gdf_exact.empty:
                    # print(f"Found {len(gdf_exact)} stretches with exact match")
                    gdf_filtered = gdf_exact
                else:
                    # print("No exact matches found either")
                    return gpd.GeoDataFrame()
            else:
                return gpd.GeoDataFrame()
        
        # Ensure CRS is EPSG:4326
        if gdf_filtered.crs is None:
            # print("Setting Stretch CRS to EPSG:4326")
            gdf_filtered.set_crs('EPSG:4326', inplace=True)
        elif gdf_filtered.crs != 'EPSG:4326':
            # print(f"Reprojecting Stretch from {gdf_filtered.crs} to EPSG:4326")
            gdf_filtered = gdf_filtered.to_crs('EPSG:4326')
            
        # print(f"Successfully loaded {len(gdf_filtered)} Stretch boundaries")
        return gdf_filtered
        
    except Exception as e:
        # print(f"Error loading Stretch boundaries: {e}")
        import traceback
        traceback.print_exc()
        return gpd.GeoDataFrame()





def load_and_clip_sampling_points_stretchbased(Stretch_IDs, season,target_attribute):
    """
    Load and clip sampling points based on subdistrict codes from the shapefile
    Now includes WQI calculation when target_attribute is 'WQI'
    """
    try:
        # If target attribute is WQI, we need to load data from database and calculate WQI
        if target_attribute == 'WQI':
            # print("Loading sampling points with WQI calculation...")
            
            # Load data from database
            if Stretch_IDs:
                db_data = WaterQuality_sampling_point_data.objects.filter(
                    Stretch_ID__in=Stretch_IDs
                ).values(
                    'Stretch_ID','Sub_District', 'Sub_District_Code', 'District_Code', 's_no', 'sampling', 
                    'location', 'status', 'latitude', 'longitude', 'ph', 'tds', 'ec', 
                    'temperature', 'turbidity', 'do', 'orp', 'tss', 'cod', 'bod', 'ts', 
                    'chloride', 'nitrate', 'hardness', 'faecal_coliform', 'total_coliform'
                )
            else:
                db_data = WaterQuality_sampling_point_data.objects.all().values(
                    'Stretch_ID','Sub_District', 'Sub_District_Code', 'District_Code', 's_no', 'sampling', 
                    'location', 'status', 'latitude', 'longitude', 'ph', 'tds', 'ec', 
                    'temperature', 'turbidity', 'do', 'orp', 'tss', 'cod', 'bod', 'ts', 
                    'chloride', 'nitrate', 'hardness', 'faecal_coliform', 'total_coliform'
                )
            
            # Calculate WQI
            df = pd.DataFrame(db_data)
            if not df.empty:
                df = WQI(df, pcm, labels)  # This adds the WQI column
                
                # Create GeoDataFrame from database data
                geometry = [Point(lon, lat) for lon, lat in zip(df['longitude'], df['latitude'])]
                point_gdf_filtered = gpd.GeoDataFrame(df, geometry=geometry, crs='EPSG:4326')
                
                # print(f"Created GeoDataFrame with WQI for {len(point_gdf_filtered)} points")
                return point_gdf_filtered
            else:
                # print("No database records found for WQI calculation")
                return gpd.GeoDataFrame()
        
        # For other attributes, use the original shapefile-based approach
        point_path = os.path.join(settings.MEDIA_ROOT, 'rwm_data', 'DRAINS_Final_point')
        # For other attributes, use the original shapefile-based approach
        # if season == 'pre_monsoon':
        #   shape_file= 'DRAINS_Final_point.shp'   ###DRAINS_Final_point_pre_monsoon.shp
        # elif season == 'during_monsoon':
        #   shape_file= 'DRAINS_Final_point_during_monsoon.shp'   
        # elif season == 'post_monsoon':
        #   shape_file= 'DRAINS_Final_point_post_monsoon.shp'   
        shape_file= 'DRAINS_Final_point.shp'   ###DRAINS_Final_point_pre_monsoon.shp

        
        pointbuffer_full_path = os.path.join(point_path, shape_file)        
        if not os.path.exists(pointbuffer_full_path):
            raise Exception(f"Sampling points shapefile not found at: {pointbuffer_full_path}")
        
        # Read the shapefile
        point_gdf = gpd.read_file(pointbuffer_full_path)
        # print(f"Available columns in sampling points: {list(point_gdf.columns)}")
        
        # Check if target attribute exists (skip for WQI as it's calculated)
        if target_attribute not in point_gdf.columns:
            available_attrs = [col for col in point_gdf.columns if col not in ['geometry', 'Stretch_ID','S_No_', 'Sub_Distri', 'Sub_Dist_1', 'District_C', 'Sampling', 'Location', 'STATUS', 'LATITUDE', 'LONGITUDE']]
            raise Exception(f"Attribute '{target_attribute}' not found. Available attributes: {available_attrs}")
        
        # Validate attribute values
        point_gdf = point_gdf.dropna(subset=[target_attribute])
        point_gdf[target_attribute] = pd.to_numeric(point_gdf[target_attribute], errors='coerce')
        point_gdf = point_gdf.dropna(subset=[target_attribute])
        # print(f"Points with valid {target_attribute} values: {len(point_gdf)}")
        
        # Filter by subdistrict codes if provided
        if Stretch_IDs:
            # Convert sub_district_codes to string and normalize
            Stretch_IDs_str = [str(code).strip().lower() for code in Stretch_IDs]
            
            # Try different possible column names for subdistrict codes
            possible_columns = ['Stretch_ID']
            Stretch_ID_column = None
            
            for col in possible_columns:
                if col in point_gdf.columns:
                    Stretch_ID_column = col
                    break
            
            if Stretch_ID_column:
                point_gdf[Stretch_ID_column] = point_gdf[Stretch_ID_column].astype(str).str.strip().str.lower()
                point_gdf_filtered = point_gdf[point_gdf[Stretch_ID_column].isin( Stretch_IDs_str)]
                
                if point_gdf_filtered.empty:
                    # print(f"No sampling points found for subdistrict codes: {Stretch_IDs}")
                    # print(f"Available subdistrict codes in filtered sampling data: {point_gdf[Stretch_ID_column].unique()[:10]}")
                    # Fallback to spatial intersection
                    point_gdf_filtered = spatial_filter_points_stretchbased(point_gdf, Stretch_IDs)
                else:
                    print(f"Filtered to {len(point_gdf_filtered)} points using attribute filter")
            else:
                # print(f"No subdistrict code column found, using spatial intersection")
                point_gdf_filtered = spatial_filter_points_stretchbased(point_gdf, Stretch_IDs)
        else:
            point_gdf_filtered = point_gdf.copy()
        
        # Ensure geometry column exists and is valid
        if 'geometry' not in point_gdf_filtered.columns:
            if 'LATITUDE' in point_gdf_filtered.columns and 'LONGITUDE' in point_gdf_filtered.columns:
                point_gdf_filtered = point_gdf_filtered.dropna(subset=['LATITUDE', 'LONGITUDE'])
                geometry = [Point(lon, lat) for lon, lat in zip(point_gdf_filtered['LONGITUDE'], point_gdf_filtered['LATITUDE'])]
                point_gdf_filtered = gpd.GeoDataFrame(point_gdf_filtered, geometry=geometry, crs='EPSG:4326')
            else:
                raise Exception("No geometry column found and no LATITUDE/LONGITUDE columns available")
        
        # Validate geometries
        point_gdf_filtered = point_gdf_filtered[point_gdf_filtered.geometry.is_valid & ~point_gdf_filtered.geometry.is_empty]
        # print(f"Valid geometries in sampling points: {len(point_gdf_filtered)}")
        
        # Ensure proper CRS
        if point_gdf_filtered.crs is None:
            # print("Setting sampling points CRS to EPSG:4326")
            point_gdf_filtered.set_crs('EPSG:4326', inplace=True)
        elif point_gdf_filtered.crs != 'EPSG:4326':
            # print(f"Reprojecting sampling points from {point_gdf_filtered.crs} to EPSG:4326")
            point_gdf_filtered = point_gdf_filtered.to_crs('EPSG:4326')
            
        # print(f"Loaded {len(point_gdf_filtered)} sampling points")
        return point_gdf_filtered
        
    except Exception as e:
        # print(f"Error loading sampling points: {e}")
        raise e






def load_and_clip_sampling_points_subdistbased(sub_district_codes, season, target_attribute):
    """
    Load and clip sampling points based on subdistrict codes from the shapefile
    Now includes WQI calculation when target_attribute is 'WQI'
    """
    try:
        # If target attribute is WQI, we need to load data from database and calculate WQI
        if target_attribute == 'WQI':
            # print("Loading sampling points with WQI calculation...")
            
            # Load data from database
            if sub_district_codes:
                db_data = WaterQuality_sampling_point_data.objects.filter(
                    Sub_District_Code__in=sub_district_codes
                ).values(
                    'Sub_District', 'Sub_District_Code', 'District_Code', 's_no', 'sampling', 
                    'location', 'status', 'latitude', 'longitude', 'ph', 'tds', 'ec', 
                    'temperature', 'turbidity', 'do', 'orp', 'tss', 'cod', 'bod', 'ts', 
                    'chloride', 'nitrate', 'hardness', 'faecal_coliform', 'total_coliform'
                )
            else:
                db_data = WaterQuality_sampling_point_data.objects.all().values(
                    'Sub_District', 'Sub_District_Code', 'District_Code', 's_no', 'sampling', 
                    'location', 'status', 'latitude', 'longitude', 'ph', 'tds', 'ec', 
                    'temperature', 'turbidity', 'do', 'orp', 'tss', 'cod', 'bod', 'ts', 
                    'chloride', 'nitrate', 'hardness', 'faecal_coliform', 'total_coliform'
                )
            
            # Calculate WQI
            df = pd.DataFrame(db_data)
            if not df.empty:
                df = WQI(df, pcm, labels)  # This adds the WQI column
                
                # Create GeoDataFrame from database data
                geometry = [Point(lon, lat) for lon, lat in zip(df['longitude'], df['latitude'])]
                point_gdf_filtered = gpd.GeoDataFrame(df, geometry=geometry, crs='EPSG:4326')
                
                # print(f"Created GeoDataFrame with WQI for {len(point_gdf_filtered)} points")
                return point_gdf_filtered
            else:
                # print("No database records found for WQI calculation")
                return gpd.GeoDataFrame()
            

        point_path = os.path.join(settings.MEDIA_ROOT, 'rwm_data', 'DRAINS_Final_point')
        # For other attributes, use the original shapefile-based approach
        # if season == 'pre_monsoon':
        #   shape_file= 'DRAINS_Final_point.shp'   ####DRAINS_Final_point_pre_monsoon
        # elif season == 'during_monsoon':
        #   shape_file= 'DRAINS_Final_point_during_monsoon.shp'   
        # elif season == 'post_monsoon':
        #   shape_file= 'DRAINS_Final_point_post_monsoon.shp'   

        shape_file= 'DRAINS_Final_point.shp'
        pointbuffer_full_path = os.path.join(point_path, shape_file)
        
        if not os.path.exists(pointbuffer_full_path):
            raise Exception(f"Sampling points shapefile not found at: {pointbuffer_full_path}")
        
        # Read the shapefile
        point_gdf = gpd.read_file(pointbuffer_full_path)
        # print(f"===========================================Available columns in sampling points: {list(point_gdf.columns)}===========================================")
        
        # Check if target attribute exists (skip for WQI as it's calculated)
        if target_attribute not in point_gdf.columns:
            available_attrs = [col for col in point_gdf.columns if col not in ['geometry', 'S_No_', 'Sub_Distri', 'Sub_Dist_1', 'District_C', 'Sampling', 'Location', 'STATUS', 'LATITUDE', 'LONGITUDE']]
            raise Exception(f"Attribute '{target_attribute}' not found. Available attributes: {available_attrs}")
        
        # Validate attribute values
        point_gdf = point_gdf.dropna(subset=[target_attribute])
        point_gdf[target_attribute] = pd.to_numeric(point_gdf[target_attribute], errors='coerce')
        point_gdf = point_gdf.dropna(subset=[target_attribute])
        print(f"Points with valid {target_attribute} values: {len(point_gdf)}")
        
        # Filter by subdistrict codes if provided
        if sub_district_codes:
            # Convert sub_district_codes to string and normalize
            sub_district_codes_str = [str(code).strip().lower() for code in sub_district_codes]
            
            # Try different possible column names for subdistrict codes
            possible_columns = ['Sub_Dist_1']
            subdistrict_column = None
            
            for col in possible_columns:
                if col in point_gdf.columns:
                    subdistrict_column = col
                    break
            
            if subdistrict_column:
                point_gdf[subdistrict_column] = point_gdf[subdistrict_column].astype(str).str.strip().str.lower()
                point_gdf_filtered = point_gdf[point_gdf[subdistrict_column].isin(sub_district_codes_str)]
                
                if point_gdf_filtered.empty:
                    # print(f"No sampling points found for subdistrict codes: {sub_district_codes}")
                    # print(f"Available subdistrict codes in filtered sampling data: {point_gdf[subdistrict_column].unique()[:10]}")
                    # Fallback to spatial intersection
                    point_gdf_filtered = spatial_filter_points_subdistbased(point_gdf, sub_district_codes)
                else:
                    print(f"Filtered to {len(point_gdf_filtered)} points using attribute filter")
            else:
                # print(f"No subdistrict code column found, using spatial intersection")
                point_gdf_filtered = spatial_filter_points_subdistbased(point_gdf, sub_district_codes)
        else:
            point_gdf_filtered = point_gdf.copy()
        
        # Ensure geometry column exists and is valid
        if 'geometry' not in point_gdf_filtered.columns:
            if 'LATITUDE' in point_gdf_filtered.columns and 'LONGITUDE' in point_gdf_filtered.columns:
                point_gdf_filtered = point_gdf_filtered.dropna(subset=['LATITUDE', 'LONGITUDE'])
                geometry = [Point(lon, lat) for lon, lat in zip(point_gdf_filtered['LONGITUDE'], point_gdf_filtered['LATITUDE'])]
                point_gdf_filtered = gpd.GeoDataFrame(point_gdf_filtered, geometry=geometry, crs='EPSG:4326')
            else:
                raise Exception("No geometry column found and no LATITUDE/LONGITUDE columns available")
        
        # Validate geometries
        point_gdf_filtered = point_gdf_filtered[point_gdf_filtered.geometry.is_valid & ~point_gdf_filtered.geometry.is_empty]
        print(f"Valid geometries in sampling points: {len(point_gdf_filtered)}")
        
        # Ensure proper CRS
        if point_gdf_filtered.crs is None:
            # print("Setting sampling points CRS to EPSG:4326")
            point_gdf_filtered.set_crs('EPSG:4326', inplace=True)
        elif point_gdf_filtered.crs != 'EPSG:4326':
            # print(f"Reprojecting sampling points from {point_gdf_filtered.crs} to EPSG:4326")
            point_gdf_filtered = point_gdf_filtered.to_crs('EPSG:4326')
            
        # print(f"Loaded {len(point_gdf_filtered)} sampling points")
        return point_gdf_filtered
        
    except Exception as e:
        # print(f"Error loading sampling points: {e}")
        raise e





def spatial_filter_points_stretchbased(point_gdf, Stretch_IDs):
    """
    Filter points using spatial intersection with Stretch_line
    """
    try:
        # Load subdistrict boundaries
        Stretch_line = load_stretch_lines(Stretch_IDs)
        stretch_buffer_union = Stretch_line.geometry.unary_union
        processing_geometry = stretch_buffer_union.buffer(100/111000) 
        if Stretch_line.empty:
            # print("No valid Stretch_line, returning unfiltered points")
            return point_gdf.copy()
        
        # Ensure same CRS
        if point_gdf.crs != Stretch_line.crs:
            # print(f"Reprojecting points from {point_gdf.crs} to {Stretch_line.crs}")
            point_gdf = point_gdf.to_crs(Stretch_line.crs)
        
        
        if processing_geometry.is_empty or not processing_geometry.is_valid:
            # print("Invalid or empty Stretch_line, returning unfiltered points")
            return point_gdf.copy()
        
        # Filter points that intersect with boundaries
        mask = point_gdf.intersects(processing_geometry)
        filtered_points = point_gdf[mask].copy()
        
        # print(f"Spatial filtering: {len(filtered_points)} points found within subdistrict boundaries")
        return filtered_points
        
    except Exception as e:
        # print(f"Error in spatial filtering: {e}")
        return point_gdf.copy()







def spatial_filter_points_subdistbased(point_gdf, sub_district_codes):
    """
    Filter points using spatial intersection with subdistrict boundaries
    """
    try:
        # Load subdistrict boundaries
        subdist_boundaries = load_subdistrict_boundaries(sub_district_codes)
        
        if subdist_boundaries.empty:
            # print("No valid subdistrict boundaries, returning unfiltered points")
            return point_gdf.copy()
        
        # Ensure same CRS
        if point_gdf.crs != subdist_boundaries.crs:
            # print(f"Reprojecting points from {point_gdf.crs} to {subdist_boundaries.crs}")
            point_gdf = point_gdf.to_crs(subdist_boundaries.crs)
        
        # Create union of all subdistrict boundaries
        boundary_union = unary_union(subdist_boundaries.geometry)
        
        if boundary_union.is_empty or not boundary_union.is_valid:
            # print("Invalid or empty subdistrict boundary union, returning unfiltered points")
            return point_gdf.copy()
        
        # Filter points that intersect with boundaries
        mask = point_gdf.intersects(boundary_union)
        filtered_points = point_gdf[mask].copy()
        
        # print(f"Spatial filtering: {len(filtered_points)} points found within subdistrict boundaries")
        return filtered_points
        
    except Exception as e:
        # print(f"Error in spatial filtering: {e}")
        return point_gdf.copy()




def load_and_clip_rivers(sub_district_codes):
    """
    Load and clip river geometries based on subdistrict boundaries
    """
    try:
        river_path = os.path.join(settings.MEDIA_ROOT, 'rwm_data', 'RIVER_SHP')
        river_full_path = os.path.join(river_path, 'Rivers.shp')
        
        if not os.path.exists(river_full_path):
            # print(f"River shapefile not found at: {river_full_path}")
            return gpd.GeoDataFrame()
        
        river_gdf = gpd.read_file(river_full_path)
        # print(f"===========================================Loaded rivers with {len(river_gdf)} features===========================================")
        
        # Validate geometries
        river_gdf = river_gdf[river_gdf.geometry.is_valid & ~river_gdf.geometry.is_empty]
        # print(f"Valid river geometries: {len(river_gdf)}")
        
        if river_gdf.empty:
            # print("No valid river geometries")
            return gpd.GeoDataFrame()
        
        if sub_district_codes:
            # Load subdistrict boundaries
            subdist_boundaries = load_subdistrict_boundaries(sub_district_codes)
            
            if not subdist_boundaries.empty:
                # Ensure same CRS
                if river_gdf.crs != subdist_boundaries.crs:
                    # print(f"Reprojecting rivers from {river_gdf.crs} to {subdist_boundaries.crs}")
                    river_gdf = river_gdf.to_crs(subdist_boundaries.crs)
                
                # Create union of all subdistrict boundaries
                boundary_union = unary_union(subdist_boundaries.geometry)
                
                if boundary_union.is_empty or not boundary_union.is_valid:
                    # print("Invalid or empty subdistrict boundary union")
                    return gpd.GeoDataFrame()
                
                # Clip rivers to boundary
                clipped_rivers = river_gdf[river_gdf.intersects(boundary_union)].copy()
                
                # Perform actual geometric clipping
                try:
                    clipped_rivers['geometry'] = clipped_rivers.geometry.intersection(boundary_union)
                    # Remove empty or invalid geometries
                    clipped_rivers = clipped_rivers[clipped_rivers.geometry.is_valid & ~clipped_rivers.geometry.is_empty]
                except Exception as clip_error:
                    print(f"Geometric clipping failed, using intersection filter: {clip_error}")
                
                print(f"Clipped rivers to {len(clipped_rivers)} features")
                return clipped_rivers
        
        return river_gdf
        
    except Exception as e:
        # print(f"Error loading/clipping rivers: {e}")
        return gpd.GeoDataFrame()





def load_and_clip_river_buffer(a,subdistbased=True):
    """
    Enhanced version with better CRS handling and validation
    """
    try:
        buffer_path = os.path.join(settings.MEDIA_ROOT, 'rwm_data', 'RIVER_BUFFER100M_SHP')
        buffer_full_path = os.path.join(buffer_path, 'River_buffer_100m.shp')
        
        if not os.path.exists(buffer_full_path):
            # print(f"River buffer shapefile not found at: {buffer_full_path}")
            return gpd.GeoDataFrame()
        
        buffer_gdf = gpd.read_file(buffer_full_path)
        # print(f"Loaded river buffer with {len(buffer_gdf)} features")
        # print(f"Original CRS: {buffer_gdf.crs}")
        
        # Validate geometries BEFORE CRS operations
        buffer_gdf = buffer_gdf[buffer_gdf.geometry.is_valid & ~buffer_gdf.geometry.is_empty]
        # print(f"Valid river buffer geometries: {len(buffer_gdf)}")
        
        if buffer_gdf.empty:
            # print("No valid river buffer geometries")
            return gpd.GeoDataFrame()
        
        # Handle CRS properly - don't assume EPSG:4326
        target_crs = 'EPSG:4326'
        if buffer_gdf.crs is None:
            # Try to detect CRS from bounds
            bounds = buffer_gdf.total_bounds
            if bounds[0] > -180 and bounds[2] < 180 and bounds[1] > -90 and bounds[3] < 90:
                # print("Assuming CRS is EPSG:4326 based on bounds")
                buffer_gdf.set_crs(target_crs, inplace=True)
            else:
                # print("Bounds suggest projected CRS, setting to appropriate UTM zone")
                # You'll need to determine the correct CRS for your area
                buffer_gdf.set_crs('EPSG:32643', inplace=True)  # UTM Zone 43N for India
                buffer_gdf = buffer_gdf.to_crs(target_crs)
        elif buffer_gdf.crs != target_crs:
            # print(f"Reprojecting river buffer from {buffer_gdf.crs} to {target_crs}")
            buffer_gdf = buffer_gdf.to_crs(target_crs)
        
        # Validate bounds after CRS transformation
        bounds = buffer_gdf.total_bounds
        if bounds[0] < -180 or bounds[2] > 180 or bounds[1] < -90 or bounds[3] > 90:
            # print(f"Warning: Invalid bounds after CRS transformation: {bounds}")
            return gpd.GeoDataFrame()
        
        # Continue with clipping logic...
        if subdistbased:
           if a:
               subdist_boundaries = load_subdistrict_boundaries(a)
               if not subdist_boundaries.empty:
                   # Ensure same CRS
                   if subdist_boundaries.crs != target_crs:
                       subdist_boundaries = subdist_boundaries.to_crs(target_crs)
                   
                   # Create union and clip
                   boundary_union = unary_union(subdist_boundaries.geometry)
                   
                   if not boundary_union.is_empty and boundary_union.is_valid:
                       clipped_buffer = buffer_gdf[buffer_gdf.intersects(boundary_union)].copy()
                       
                       # Perform geometric clipping with error handling
                       try:
                           clipped_geometries = []
                           for geom in clipped_buffer.geometry:
                               try:
                                   clipped_geom = geom.intersection(boundary_union)
                                   if not clipped_geom.is_empty:
                                       clipped_geometries.append(clipped_geom)
                                   else:
                                       clipped_geometries.append(geom)  # Keep original if intersection fails
                               except Exception as e:
                                #    print(f"Intersection failed for geometry, keeping original: {e}")
                                   clipped_geometries.append(geom)
                           
                           clipped_buffer['geometry'] = clipped_geometries
                           clipped_buffer = clipped_buffer[clipped_buffer.geometry.is_valid & ~clipped_buffer.geometry.is_empty]
                           
                           # Final bounds validation
                           if not clipped_buffer.empty:
                               final_bounds = clipped_buffer.total_bounds
                               if (final_bounds[0] >= -180 and final_bounds[2] <= 180 and 
                                   final_bounds[1] >= -90 and final_bounds[3] <= 90):
                                #    print(f"Successfully clipped river buffer to {len(clipped_buffer)} features")
                                #    print(f"Final bounds: {final_bounds}")
                                   return clipped_buffer
                               else:
                                   print(f"Invalid final bounds: {final_bounds}, returning original")
                       
                       except Exception as clip_error:
                           print(f"Geometric clipping failed: {clip_error}")
        else:
            if a:
               stretch_line = load_stretch_lines(a)
               if not stretch_line.empty:
                   # Ensure same CRS
                   if stretch_line.crs != target_crs:
                       stretch_line = stretch_line.to_crs(target_crs)
                   
                   # Create union and clip
                   boundary_union = unary_union(stretch_line.geometry)
                   
                   if not boundary_union.is_empty and boundary_union.is_valid:
                       clipped_buffer = buffer_gdf[buffer_gdf.intersects(boundary_union)].copy()
                       
                       # Perform geometric clipping with error handling
                       try:
                           clipped_geometries = []
                           for geom in clipped_buffer.geometry:
                               try:
                                   clipped_geom = geom.intersection(boundary_union)
                                   if not clipped_geom.is_empty:
                                       clipped_geometries.append(clipped_geom)
                                   else:
                                       clipped_geometries.append(geom)  # Keep original if intersection fails
                               except Exception as e:
                                #    print(f"Intersection failed for geometry, keeping original: {e}")
                                   clipped_geometries.append(geom)
                           
                           clipped_buffer['geometry'] = clipped_geometries
                           clipped_buffer = clipped_buffer[clipped_buffer.geometry.is_valid & ~clipped_buffer.geometry.is_empty]
                           
                           # Final bounds validation
                           if not clipped_buffer.empty:
                               final_bounds = clipped_buffer.total_bounds
                               if (final_bounds[0] >= -180 and final_bounds[2] <= 180 and 
                                   final_bounds[1] >= -90 and final_bounds[3] <= 90):
                                #    print(f"Successfully clipped river buffer to {len(clipped_buffer)} features")
                                #    print(f"Final bounds: {final_bounds}")
                                   return clipped_buffer
                               else:
                                   print(f"Invalid final bounds: {final_bounds}, returning original")
                       
                       except Exception as clip_error:
                           print(f"Geometric clipping failed: {clip_error}")
      
        return buffer_gdf
        
    except Exception as e:
        # print(f"Error loading/clipping river buffer: {e}")
        import traceback
        traceback.print_exc()
        return gpd.GeoDataFrame()