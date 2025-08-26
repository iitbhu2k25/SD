import rasterio
import numpy as np
import jenkspy
import geopandas as gpd
from rasterio.enums import Resampling
from rasterio.features import shapes
from shapely.geometry import shape
from scipy.ndimage import label
from tqdm import tqdm
import os
import warnings
warnings.filterwarnings('ignore')

# =============================================================================
# CONFIGURATION - MODIFY THESE PARAMETERS
# =============================================================================

# INPUT RASTER PATH
RASTER_PATH = r"C:\Users\resea\OneDrive\Desktop\STP\stp_sutability_24b3189d21324089b2a84d5324763f31_map.tif" # ← CHANGE THIS PATH

# STP PARAMETERS
TREATMENT_TECHNOLOGY = "Membrane Bio Reactor (MBR)" # Choose from technologies below
MLD_CAPACITY = 100.0 # Million Liters per Day
CUSTOM_BUFFER_LAND = None # Set to None for default 5ha buffer, or specify custom (e.g., 2.0)

# AREA FILTERING PARAMETERS
DEFAULT_BUFFER_HA = 5.0 # Default buffer when CUSTOM_BUFFER_LAND is None
EXPORT_REASONABLE_ONLY = True # Only export clusters within reasonable range
MAX_CLUSTERS_TO_EXPORT = 10 # Maximum number of reasonable clusters to export

# OUTPUT PATH
OUTPUT_SHAPEFILE = r"C:\Users\resea\OneDrive\Desktop\STP\stp_suitable_sites_19_08_v2.shp" # Output shapefile path

# ANALYSIS PARAMETERS
N_CLASSES = 5 # Number of classification classes (not used in threshold mode)
USE_THRESHOLD_MODE = True # Set to True to use direct threshold instead of classification
SUITABILITY_THRESHOLD = 0.353 # Minimum pixel value for high suitability
USE_FAST_CLASSIFICATION = True # Only used if USE_THRESHOLD_MODE = False
MAX_SAMPLE_SIZE = 50000 # Only used if USE_THRESHOLD_MODE = False

# =============================================================================
# TECHNOLOGY OPTIONS
# =============================================================================
TECH_OPTIONS = {
    'Trickling Filter (TF)': 0.25,
    'Activated Sludge Process (ASP)': 0.15,
    'Sequential Batch Reactor (SBR)': 0.10,
    'BIOFOR-F': 0.08,
    'Extended Aeration (EA)': 0.15,
    'Membrane Bio Reactor (MBR)': 0.05
}

# =============================================================================
# CORE FUNCTIONS
# =============================================================================

def read_raster(path):
    """Read raster and extract metadata"""
    print(f"📖 Reading raster: {path}")
    
    if not os.path.exists(path):
        raise FileNotFoundError(f"Raster file not found: {path}")
    
    with rasterio.open(path) as src:
        data = src.read(1, resampling=Resampling.nearest)
        profile = src.profile
        transform = src.transform
        crs = src.crs
        bounds = src.bounds
        nodata = src.nodata
        
        print(f"📊 Raw data info:")
        print(f" • NoData value: {nodata}")
        print(f" • Raw data range: {data.min():.3e} - {data.max():.3e}")
        
        # Handle NoData values - convert extreme values to NaN
        if nodata is not None:
            data = np.where(data == nodata, np.nan, data)
        
        # Also handle extremely large negative values (common NoData representation)
        data = np.where(data < -1e10, np.nan, data)
        
        # Handle extremely large positive values
        data = np.where(data > 1e10, np.nan, data)
        
        # For suitability data, values should be between 0-1
        data = np.where((data < 0) | (data > 1), np.nan, data)
        
        # Calculate pixel size
        res_x = abs(transform[0]) # pixel width
        res_y = abs(transform[4]) # pixel height
        
        # Validate cleaned data
        valid_data = data[~np.isnan(data)]
        if len(valid_data) == 0:
            raise ValueError("Raster contains no valid data after cleaning")
        
        data_min, data_max = valid_data.min(), valid_data.max()
        valid_pixels = len(valid_data)
        total_pixels = data.size
        valid_percentage = (valid_pixels / total_pixels) * 100
        
        print(f"✅ Raster loaded and cleaned successfully!")
        print(f" • Size: {data.shape[1]} × {data.shape[0]} pixels")
        print(f" • Resolution: {res_x:.1f}m × {res_y:.1f}m")
        print(f" • Valid data range: {data_min:.3f} - {data_max:.3f}")
        print(f" • Valid pixels: {valid_pixels:,} ({valid_percentage:.1f}%)")
        print(f" • CRS: {crs}")
        
        return data, profile, res_x, res_y, transform, crs, bounds

def apply_threshold_classification(data, threshold=0.353):
    """Apply direct threshold classification (much faster than Jenks)"""
    print(f"🎯 Applying direct threshold classification...")
    print(f" • Suitability threshold: {threshold}")
    
    # Remove NaN and invalid values
    valid_mask = ~np.isnan(data) & (data >= 0) & (data <= 1) & np.isfinite(data)
    valid_pixels = data[valid_mask]
    
    print(f"📊 Data validation:")
    print(f" • Total pixels: {data.size:,}")
    print(f" • Valid pixels: {len(valid_pixels):,}")
    print(f" • Valid percentage: {(len(valid_pixels)/data.size)*100:.1f}%")
    print(f" • Valid data range: {valid_pixels.min():.6f} - {valid_pixels.max():.6f}")
    
    if len(valid_pixels) == 0:
        raise ValueError("No valid pixels found in the dataset")
    
    # Create binary classification: 1 = suitable (>= threshold), 0 = not suitable
    suitable_mask = (data >= threshold) & valid_mask
    
    # Count pixels above threshold
    suitable_pixels = np.sum(suitable_mask)
    suitable_percentage = (suitable_pixels / len(valid_pixels)) * 100
    
    print(f"📈 Threshold analysis results:")
    print(f" • Pixels above threshold ({threshold}): {suitable_pixels:,} ({suitable_percentage:.1f}%)")
    print(f" • Pixels below threshold: {len(valid_pixels) - suitable_pixels:,} ({100-suitable_percentage:.1f}%)")
    
    if suitable_pixels == 0:
        raise ValueError(f"No pixels meet the suitability threshold of {threshold}")
    
    # Create a simple binary classification array (0 = not suitable, 1 = suitable)
    # Note: We'll use value 5 for suitable pixels to maintain compatibility with existing code
    reclassified = np.zeros_like(data, dtype=np.uint8)
    reclassified[suitable_mask] = 5 # Mark suitable pixels as class 5 (highest suitability)
    
    print("✅ Threshold classification completed!")
    
    return reclassified, threshold

def calculate_required_pixels(required_area_m2, res_x, res_y):
    """Calculate number of pixels needed for required area"""
    pixel_area = res_x * res_y
    pixels_needed = int(np.ceil(required_area_m2 / pixel_area))
    kernel_size = int(np.ceil(np.sqrt(pixels_needed)))
    return kernel_size, pixels_needed, pixel_area

def find_suitable_areas(reclassified, kernel_size, required_pixels, threshold_mode=True):
    """Find areas where all pixels meet suitability criteria"""
    if threshold_mode:
        print(f"🔍 Searching for areas where ALL pixels are above threshold...")
        print(f" • Using {kernel_size}×{kernel_size} kernel")
        print(f" • Required pixels per window: {required_pixels}")
    else:
        print(f"🔍 Searching for suitable areas with {kernel_size}×{kernel_size} kernel...")
    
    rows, cols = reclassified.shape
    suitable_mask = np.zeros_like(reclassified, dtype=np.uint8)
    
    # Calculate total number of windows
    total_windows = (rows - kernel_size + 1) * (cols - kernel_size + 1)
    
    print(f"📊 Total windows to analyze: {total_windows:,}")
    
    # Progress bar for window analysis
    with tqdm(total=total_windows, desc="Analyzing windows", unit="windows") as pbar:
        for i in range(rows - kernel_size + 1):
            for j in range(cols - kernel_size + 1):
                window = reclassified[i:i+kernel_size, j:j+kernel_size]
                
                # Check if ALL pixels in window are suitable (value = 5)
                # and the total suitable pixels meet the area requirement
                if np.all(window == 5) and np.sum(window == 5) >= required_pixels:
                    suitable_mask[i:i+kernel_size, j:j+kernel_size] = 1
                
                pbar.update(1)
    
    suitable_pixels = np.sum(suitable_mask)
    print(f"✅ Found {suitable_pixels:,} suitable pixels")
    
    return suitable_mask

def extract_clusters_as_polygons(mask_array, transform, crs, min_area_m2=None):
    """Extract clusters and convert to polygons"""
    print("🌐 Extracting clusters and converting to polygons...")
    
    # Label connected components
    labeled_array, num_features = label(mask_array)
    
    print(f"📍 Found {num_features} connected components")
    
    if num_features == 0:
        return None
    
    # Convert raster clusters to polygons
    polygons = []
    areas = []
    
    print("🔄 Converting raster clusters to vector polygons...")
    
    with tqdm(desc="Processing clusters", unit="cluster") as pbar:
        for geom, value in shapes(labeled_array.astype(np.uint8), transform=transform):
            if value > 0: # Only process non-zero values
                poly = shape(geom)
                area_m2 = poly.area
                
                # Filter by minimum area if specified
                if min_area_m2 is None or area_m2 >= min_area_m2:
                    polygons.append(poly)
                    areas.append(area_m2)
                    pbar.update(1)
    
    if not polygons:
        print("❌ No clusters meet the minimum area requirement")
        return None
    
    # Create GeoDataFrame
    gdf = gpd.GeoDataFrame({
        'cluster_id': range(1, len(polygons) + 1),
        'area_m2': areas,
        'area_ha': [a/10000 for a in areas],
        'geometry': polygons
    }, crs=crs)
    
    print(f"✅ Successfully extracted {len(gdf)} clusters")
    
    return gdf

def filter_reasonable_clusters(clusters_gdf, required_area_ha, buffer_area_ha):
    """Filter clusters based on reasonable area range and calculate efficiency scores"""
    if clusters_gdf is None or len(clusters_gdf) == 0:
        return None
    
    min_area_ha = required_area_ha
    max_area_ha = required_area_ha + buffer_area_ha
    
    print(f"🎯 AREA FILTERING:")
    print(f" • Required Area: {required_area_ha:.2f} ha")
    print(f" • Buffer Area: {buffer_area_ha:.2f} ha")
    print(f" • Acceptable Range: {min_area_ha:.2f} - {max_area_ha:.2f} ha")
    print(f" • Total clusters before filtering: {len(clusters_gdf)}")
    
    # Filter clusters within reasonable range
    reasonable_clusters = clusters_gdf[
        (clusters_gdf['area_ha'] >= min_area_ha) & 
        (clusters_gdf['area_ha'] <= max_area_ha)
    ].copy()
    
    if len(reasonable_clusters) == 0:
        print("❌ No clusters found within reasonable area range")
        return None
    
    print(f"✅ Found {len(reasonable_clusters)} clusters within reasonable range")
    
    # Calculate efficiency metrics
    reasonable_clusters['required_area_ha'] = required_area_ha
    reasonable_clusters['buffer_area_ha'] = buffer_area_ha
    reasonable_clusters['max_allowed_ha'] = max_area_ha
    reasonable_clusters['excess_area_ha'] = reasonable_clusters['area_ha'] - required_area_ha
    reasonable_clusters['efficiency_percent'] = (required_area_ha / reasonable_clusters['area_ha'] * 100).round(1)
    reasonable_clusters['buffer_utilization_percent'] = (
        reasonable_clusters['excess_area_ha'] / buffer_area_ha * 100
    ).round(1)
    reasonable_clusters['waste_land_ha'] = reasonable_clusters['excess_area_ha']
    
    # Calculate efficiency score for ranking (higher = better)
    # Score ranges from 0 to 1, where 1 = perfect fit (required area)
    area_range = max_area_ha - min_area_ha
    if area_range > 0:
        reasonable_clusters['efficiency_score'] = (
            1 - (reasonable_clusters['area_ha'] - min_area_ha) / area_range
        )
    else:
        reasonable_clusters['efficiency_score'] = 1.0
    
    # Sort by efficiency score (best fit first)
    reasonable_clusters = reasonable_clusters.sort_values(
        'efficiency_score', ascending=False
    ).reset_index(drop=True)
    
    # Update cluster IDs based on ranking
    reasonable_clusters['cluster_id'] = range(1, len(reasonable_clusters) + 1)
    
    return reasonable_clusters

def display_results(clusters_gdf, required_area_ha, buffer_area_ha, max_display=10):
    """Display analysis results for reasonable clusters"""
    if clusters_gdf is None or len(clusters_gdf) == 0:
        print("❌ No suitable areas found!")
        return False
    
    print(f"\n🎉 ANALYSIS RESULTS")
    print("=" * 70)
    
    num_clusters = len(clusters_gdf)
    display_clusters = clusters_gdf.head(max_display)
    
    print(f"✅ Found {num_clusters} reasonable cluster(s)!")
    print(f"📋 Top {min(max_display, num_clusters)} clusters (ranked by efficiency):")
    print()
    
    for idx, row in display_clusters.iterrows():
        print(f"🏆 Cluster {row['cluster_id']} (Rank #{idx + 1}):")
        print(f" • Area: {row['area_ha']:.2f} ha ({row['area_m2']:,.0f} m²)")
        print(f" • Efficiency: {row['efficiency_percent']:.1f}%")
        print(f" • Excess Area: {row['excess_area_ha']:.2f} ha")
        print(f" • Buffer Utilization: {row['buffer_utilization_percent']:.1f}%")
        print(f" • Efficiency Score: {row['efficiency_score']:.3f}")
        print()
    
    # Summary statistics
    print(f"📊 SUMMARY STATISTICS:")
    print(f" • Best Efficiency: {clusters_gdf['efficiency_percent'].max():.1f}%")
    print(f" • Average Efficiency: {clusters_gdf['efficiency_percent'].mean():.1f}%")
    print(f" • Average Excess Area: {clusters_gdf['excess_area_ha'].mean():.2f} ha")
    print(f" • Most Efficient Area: {clusters_gdf.iloc[0]['area_ha']:.2f} ha")
    
    return True

def save_results(clusters_gdf, output_path, max_export=10):
    """Save results to shapefile with enhanced attributes"""
    if clusters_gdf is None or len(clusters_gdf) == 0:
        print("❌ No data to save")
        return False
    
    export_clusters = clusters_gdf.head(max_export)
    
    try:
        # Ensure output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # Prepare columns for shapefile (limit field names to 10 characters for .shp compatibility)
        export_gdf = export_clusters.copy()
        export_gdf = export_gdf.rename(columns={
            'cluster_id': 'ClusterID',
            'area_m2': 'Area_m2',
            'area_ha': 'Area_ha',
            'required_area_ha': 'Req_Area',
            'buffer_area_ha': 'Buffer_ha',
            'excess_area_ha': 'Excess_ha',
            'efficiency_percent': 'Effic_pct',
            'buffer_utilization_percent': 'BuffUse_pc',
            'efficiency_score': 'Effic_scr',
            'waste_land_ha': 'Waste_ha'
        })
        
        # Round numerical values for cleaner output
        numerical_cols = ['Area_m2', 'Area_ha', 'Req_Area', 'Buffer_ha', 
                         'Excess_ha', 'Effic_pct', 'BuffUse_pc', 'Effic_scr', 'Waste_ha']
        for col in numerical_cols:
            if col in export_gdf.columns:
                export_gdf[col] = export_gdf[col].round(3)
        
        # Save to shapefile
        export_gdf.to_file(output_path)
        print(f"✅ Results saved to: {output_path}")
        print(f"📁 Saved {len(export_clusters)} reasonable clusters")
        
        # Also save detailed CSV (without geometry)
        csv_path = output_path.replace('.shp', '_detailed.csv')
        detailed_df = clusters_gdf.drop('geometry', axis=1).head(max_export)
        detailed_df.to_csv(csv_path, index=False)
        print(f"📊 Detailed summary saved to: {csv_path}")
        
        # Save summary statistics
        summary_path = output_path.replace('.shp', '_summary.txt')
        with open(summary_path, 'w') as f:
            f.write("STP Site Suitability Analysis - Summary Report\n")
            f.write("=" * 50 + "\n\n")
            f.write(f"Total Reasonable Clusters Found: {len(clusters_gdf)}\n")
            f.write(f"Clusters Exported: {len(export_clusters)}\n")
            f.write(f"Best Efficiency: {clusters_gdf['efficiency_percent'].max():.1f}%\n")
            f.write(f"Average Efficiency: {clusters_gdf['efficiency_percent'].mean():.1f}%\n")
            f.write(f"Average Excess Area: {clusters_gdf['excess_area_ha'].mean():.2f} ha\n")
            f.write(f"Most Efficient Cluster Area: {clusters_gdf.iloc[0]['area_ha']:.2f} ha\n")
        
        print(f"📄 Summary report saved to: {summary_path}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error saving results: {str(e)}")
        return False

# =============================================================================
# MAIN ANALYSIS FUNCTION
# =============================================================================

def run_stp_analysis():
    """Main function to run STP site analysis with area-based filtering"""
    
    print("🏭 STP Site Suitability Analysis (Area-Optimized)")
    print("=" * 60)
    
    # Validate inputs
    if not os.path.exists(RASTER_PATH):
        print(f"❌ Error: Raster file not found: {RASTER_PATH}")
        print("💡 Please update the RASTER_PATH variable in the configuration section")
        return False
    
    if TREATMENT_TECHNOLOGY not in TECH_OPTIONS:
        print(f"❌ Error: Unknown treatment technology: {TREATMENT_TECHNOLOGY}")
        print(f"💡 Available options: {list(TECH_OPTIONS.keys())}")
        return False
    
    # Calculate area requirements
    land_per_mld = TECH_OPTIONS[TREATMENT_TECHNOLOGY] # Always use technology default
    required_area_ha = MLD_CAPACITY * land_per_mld
    required_area_m2 = required_area_ha * 10000
    
    # Calculate buffer area
    buffer_area_ha = CUSTOM_BUFFER_LAND if CUSTOM_BUFFER_LAND is not None else DEFAULT_BUFFER_HA
    max_area_ha = required_area_ha + buffer_area_ha
    max_area_m2 = max_area_ha * 10000
    
    # Configuration summary
    print("⚙️ CONFIGURATION:")
    print(f" • Technology: {TREATMENT_TECHNOLOGY}")
    print(f" • Capacity: {MLD_CAPACITY} MLD")
    print(f" • Land per MLD: {land_per_mld} ha/MLD")
    print(f" • Required Area: {required_area_ha:.2f} ha ({required_area_m2:,.0f} m²)")
    print(f" • Buffer Area: {buffer_area_ha:.2f} ha")
    print(f" • Maximum Acceptable Area: {max_area_ha:.2f} ha ({max_area_m2:,.0f} m²)")
    print(f" • Export Reasonable Only: {EXPORT_REASONABLE_ONLY}")
    print(f" • Max Clusters to Export: {MAX_CLUSTERS_TO_EXPORT}")
    if USE_THRESHOLD_MODE:
        print(f" • Suitability Threshold: {SUITABILITY_THRESHOLD}")
        print(f" • Mode: Direct Threshold (No Classification)")
    else:
        print(f" • Mode: Classification-based Analysis")
    print()
    
    try:
        # Step 1: Read raster
        data, profile, res_x, res_y, transform, crs, bounds = read_raster(RASTER_PATH)
        
        # Step 2: Apply classification or threshold
        if USE_THRESHOLD_MODE:
            reclassified, threshold_info = apply_threshold_classification(data, SUITABILITY_THRESHOLD)
        else:
            # Note: You'll need to implement apply_jenks_classification if using classification mode
            print("❌ Classification mode not implemented in this version")
            return False
        
        # Step 3: Calculate spatial requirements
        kernel_size, required_pixels, pixel_area = calculate_required_pixels(
            required_area_m2, res_x, res_y
        )
        
        print(f"\n🔢 SPATIAL PARAMETERS:")
        print(f" • Kernel Size: {kernel_size} × {kernel_size} pixels")
        print(f" • Required Pixels: {required_pixels:,}")
        print(f" • Pixel Area: {pixel_area:.1f} m²")
        print()
        
        # Step 4: Find suitable areas
        suitable_mask = find_suitable