import os
import json
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, Polygon, MultiPolygon
from scipy.spatial import cKDTree
from scipy import stats
from django.http import JsonResponse
from django.views import View
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import base64
import warnings
import re
from collections import namedtuple
import uuid
from datetime import datetime

warnings.filterwarnings('ignore')

@method_decorator(csrf_exempt, name='dispatch')
class GroundwaterTrendAnalysisView(View):

    def __init__(self):
        super().__init__()
        # Paths
        self.temp_media_dir = os.path.join(settings.MEDIA_ROOT, 'temp')
        self.gwa_data_dir = os.path.join(settings.MEDIA_ROOT, 'gwa_data', 'gwa_shp')
        self.village_shp_path = os.path.join(self.gwa_data_dir, 'Final_Village', 'Village.shp')
        self.centroid_shp_path = os.path.join(self.gwa_data_dir, 'Centroid', 'Centroid1.shp')

        # IMPORTANT: village code column name in shapefiles
        self.VILLAGE_CODE_COL = 'village_co'

        os.makedirs(self.temp_media_dir, exist_ok=True)

    # ---------------------------
    # Filtering helpers
    # ---------------------------
    def filter_shapefiles_by_subdis_cod(self, subdis_codes):
        print(f"🔍 Filtering by SUBDIS_COD: {subdis_codes}")
        try:
            centroids_gdf = gpd.read_file(self.centroid_shp_path)
            villages_gdf = gpd.read_file(self.village_shp_path)

            if 'SUBDIS_COD' not in centroids_gdf.columns:
                raise Exception(f"SUBDIS_COD column not found in centroids shapefile. Available: {list(centroids_gdf.columns)}")
            if 'SUBDIS_COD' not in villages_gdf.columns:
                raise Exception(f"SUBDIS_COD column not found in villages shapefile. Available: {list(villages_gdf.columns)}")

            # Normalize types (accept int or str)
            if isinstance(subdis_codes[0], str):
                try:
                    subdis_codes_conv = [int(code) for code in subdis_codes]
                except ValueError:
                    subdis_codes_conv = subdis_codes
            else:
                subdis_codes_conv = subdis_codes

            filtered_centroids = centroids_gdf[centroids_gdf['SUBDIS_COD'].isin(subdis_codes_conv)]
            filtered_villages = villages_gdf[villages_gdf['SUBDIS_COD'].isin(subdis_codes_conv)]

            if len(filtered_centroids) == 0:
                raise Exception(f"No centroids found for SUBDIS_COD {subdis_codes}")
            if len(filtered_villages) == 0:
                raise Exception(f"No villages found for SUBDIS_COD {subdis_codes}")

            return filtered_centroids, filtered_villages

        except Exception as e:
            raise Exception(f"Error filtering shapefiles by SUBDIS_COD: {str(e)}")

    def filter_shapefiles_by_village_codes(self, village_codes):
        print(f"🔍 Filtering by village codes in column '{self.VILLAGE_CODE_COL}': {village_codes}")
        try:
            centroids_gdf = gpd.read_file(self.centroid_shp_path)
            villages_gdf = gpd.read_file(self.village_shp_path)

            if self.VILLAGE_CODE_COL not in centroids_gdf.columns:
                raise Exception(f"{self.VILLAGE_CODE_COL} column not found in centroids shapefile. Available: {list(centroids_gdf.columns)}")
            if self.VILLAGE_CODE_COL not in villages_gdf.columns:
                raise Exception(f"{self.VILLAGE_CODE_COL} column not found in villages shapefile. Available: {list(villages_gdf.columns)}")

            # Normalize types (accept int or str)
            normalized = []
            for v in village_codes:
                try:
                    normalized.append(int(v))
                except (ValueError, TypeError):
                    normalized.append(str(v))

            filtered_centroids = centroids_gdf[centroids_gdf[self.VILLAGE_CODE_COL].isin(normalized)]
            filtered_villages = villages_gdf[villages_gdf[self.VILLAGE_CODE_COL].isin(normalized)]

            if len(filtered_centroids) == 0:
                raise Exception(f"No centroids found for village_codes {village_codes}")
            if len(filtered_villages) == 0:
                raise Exception(f"No villages found for village_codes {village_codes}")

            return filtered_centroids, filtered_villages

        except Exception as e:
            raise Exception(f"Error filtering shapefiles by village_codes: {str(e)}")

    # ---------------------------
    # Mann-Kendall
    # ---------------------------
    def mann_kendall_test(self, data_series):
        data_clean = data_series.dropna()
        if len(data_clean) < 3:
            MKResult = namedtuple('MKResult', ['tau', 'p_value', 'trend', 'slope'])
            return MKResult(np.nan, np.nan, 'Insufficient Data', np.nan)

        n = len(data_clean)
        S = sum(np.sign(data_clean.values[j] - data_clean.values[i]) for i in range(n - 1) for j in range(i + 1, n))
        var_S = n * (n - 1) * (2 * n + 5) / 18
        Z = (S - 1) / np.sqrt(var_S) if S > 0 else (S + 1) / np.sqrt(var_S) if S < 0 else 0
        p_value = 2 * (1 - stats.norm.cdf(abs(Z)))
        tau = S / (0.5 * n * (n - 1))

        trend = 'Increasing' if p_value < 0.05 and tau > 0 else 'Decreasing' if p_value < 0.05 and tau < 0 else 'No-Trend'

        slopes = [(data_clean.values[j] - data_clean.values[i]) / (j - i) for i in range(n - 1) for j in range(i + 1, n)]
        sen_slope = np.median(slopes) if slopes else 0

        MKResult = namedtuple('MKResult', ['tau', 'p_value', 'trend', 'slope'])
        return MKResult(tau, p_value, trend, sen_slope)

    # ---------------------------
    # Time series creation - GENERATES BOTH SEASONAL AND YEARLY
    # ---------------------------
    def create_village_time_series(self, wells_csv_path, filtered_centroids, filtered_villages, return_stats=False):
        print("🔄 Creating village time series for FILTERED villages (both seasonal and yearly)...")
        centroids_gdf = filtered_centroids.copy()
        villages_gdf = filtered_villages.copy()

        try:
            wells_df = pd.read_csv(wells_csv_path)
            wells_gdf = gpd.GeoDataFrame(
                wells_df,
                geometry=gpd.points_from_xy(wells_df['LONGITUDE'], wells_df['LATITUDE']),
                crs="EPSG:4326"
            )
            print(f"✅ Loaded {len(wells_gdf)} wells")
        except Exception as e:
            raise Exception(f"Error loading wells CSV: {str(e)}")

        common_crs = centroids_gdf.crs
        wells_gdf = wells_gdf.to_crs(common_crs)
        villages_gdf = villages_gdf.to_crs(common_crs)

        depth_columns = [col for col in wells_gdf.columns if any(s in col for s in ['PRE', 'POST'])]
        years = sorted(list({re.search(r'(\d{4})', c).group(1) for c in depth_columns if re.search(r'(\d{4})', c)}))
        if not years:
            raise Exception("No valid year columns found in wells data")

        centroid_coords = np.array(list(centroids_gdf.geometry.apply(lambda g: (g.x, g.y))))
        well_coords = np.array(list(wells_gdf.geometry.apply(lambda g: (g.x, g.y))))
        tree = cKDTree(well_coords)
        distances, indices = tree.query(centroid_coords, k=min(3, len(well_coords)))
        if len(well_coords) == 1:
            distances = distances.reshape(-1, 1); indices = indices.reshape(-1, 1)
        elif len(well_coords) == 2:
            distances = distances.reshape(-1, 2); indices = indices.reshape(-1, 2)
        print("✅ Spatial index built")

        centroid_yearly_records = []
        centroid_seasonal_records = []
        
        for village_distances, village_indices in zip(distances, indices):
            if len(well_coords) == 1:
                village_distances = [village_distances]; village_indices = [village_indices]
            elif len(well_coords) == 2:
                village_distances = village_distances[:2]; village_indices = village_indices[:2]
            else:
                village_distances = village_distances[:3]; village_indices = village_indices[:3]

            epsilon = 1e-10
            weights = 1.0 / (np.array(village_distances) + epsilon)
            weights = weights / weights.sum()

            yearly_data = {}
            seasonal_data = {}
            
            for year in years:
                pre_col, post_col = None, None
                for col in depth_columns:
                    if year in col:
                        if 'PRE' in col.upper(): pre_col = col
                        elif 'POST' in col.upper(): post_col = col

                year_values, year_weights = [], []
                pre_values, pre_weights = [], []
                post_values, post_weights = [], []
                
                for j, well_idx in enumerate(village_indices):
                    w = wells_gdf.iloc[well_idx]
                    pre_val = w[pre_col] if pre_col and not pd.isna(w[pre_col]) else None
                    post_val = w[post_col] if post_col and not pd.isna(w[post_col]) else None
                    
                    # For yearly combined data
                    vals = [v for v in [pre_val, post_val] if v is not None]
                    if vals:
                        year_values.append(np.mean(vals))
                        year_weights.append(weights[j])
                    
                    # For seasonal data
                    if pre_val is not None:
                        pre_values.append(pre_val)
                        pre_weights.append(weights[j])
                    if post_val is not None:
                        post_values.append(post_val)
                        post_weights.append(weights[j])

                # Calculate yearly combined value
                if year_values and year_weights:
                    yweights = np.array(year_weights); yweights = yweights / yweights.sum()
                    yearly_data[year] = float(np.sum(np.array(year_values) * yweights))
                else:
                    yearly_data[year] = np.nan

                # Calculate seasonal values
                if pre_values and pre_weights:
                    pre_weights_norm = np.array(pre_weights); pre_weights_norm = pre_weights_norm / pre_weights_norm.sum()
                    seasonal_data[f"{year}_PRE"] = float(np.sum(np.array(pre_values) * pre_weights_norm))
                else:
                    seasonal_data[f"{year}_PRE"] = np.nan

                if post_values and post_weights:
                    post_weights_norm = np.array(post_weights); post_weights_norm = post_weights_norm / post_weights_norm.sum()
                    seasonal_data[f"{year}_POST"] = float(np.sum(np.array(post_values) * post_weights_norm))
                else:
                    seasonal_data[f"{year}_POST"] = np.nan

            # Add metadata for both datasets
            for j, well_idx in enumerate(village_indices):
                metadata = {
                    f'nearest_well_{j+1}_id': wells_gdf.iloc[well_idx].get('id', f'well_{well_idx}'),
                    f'distance_{j+1}': float(village_distances[j]),
                    f'weight_{j+1}': float(weights[j]) if j < len(weights) else 0.0
                }
                yearly_data.update(metadata)
                seasonal_data.update(metadata)

            centroid_yearly_records.append(yearly_data)
            centroid_seasonal_records.append(seasonal_data)

        # Create DataFrames
        yearly_df = pd.DataFrame(centroid_yearly_records)
        seasonal_df = pd.DataFrame(centroid_seasonal_records)
        
        # Add village codes
        yearly_df[self.VILLAGE_CODE_COL] = centroids_gdf[self.VILLAGE_CODE_COL].values
        seasonal_df[self.VILLAGE_CODE_COL] = centroids_gdf[self.VILLAGE_CODE_COL].values

        # Merge with village data
        villages_with_yearly_depth = villages_gdf.merge(yearly_df, on=self.VILLAGE_CODE_COL, how='left')
        villages_with_seasonal_depth = villages_gdf.merge(seasonal_df, on=self.VILLAGE_CODE_COL, how='left')

        # Save both CSV files
        timestamp = pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')
        yearly_filename = f"village_timeseries_yearly_filtered_all_years_{timestamp}.csv"
        seasonal_filename = f"village_timeseries_seasonal_filtered_all_years_{timestamp}.csv"
        
        yearly_path = os.path.join(self.temp_media_dir, yearly_filename)
        seasonal_path = os.path.join(self.temp_media_dir, seasonal_filename)
        
        villages_with_yearly_depth.drop(columns=['geometry']).to_csv(yearly_path, index=False)
        villages_with_seasonal_depth.drop(columns=['geometry']).to_csv(seasonal_path, index=False)
        
        print(f"✅ Saved yearly time series CSV: {yearly_path}")
        print(f"✅ Saved seasonal time series CSV: {seasonal_path}")

        stats_info = {
            'total_villages': len(villages_with_yearly_depth),
            'total_years_available': len(years),
            'all_years_analyzed': years,
            'avg_distance_to_nearest_well': float(np.mean([r.get('distance_1', 0) for r in centroid_yearly_records])),
            'village_timeseries_yearly_csv': yearly_filename,
            'village_timeseries_seasonal_csv': seasonal_filename,
            'villages_filtered': True,
            'filtered_villages_count': len(villages_with_yearly_depth),
            'original_villages_count': "Filtered from original shapefiles"
        }

        if return_stats:
            return villages_with_yearly_depth, villages_with_seasonal_depth, years, stats_info
        return villages_with_yearly_depth, villages_with_seasonal_depth, years

    # ---------------------------
    # Mann-Kendall Analysis - ONLY ON YEARLY DATA
    # ---------------------------
    def perform_mann_kendall_analysis(self, villages_with_yearly_depth, trend_years, all_available_years):
        print(f"🔬 Mann-Kendall for yearly data using years: {trend_years}")
        
        missing_years = [y for y in trend_years if y not in all_available_years]
        if missing_years:
            print(f"⚠️ Missing requested years: {missing_years}. Proceeding with available.")
            trend_years = [y for y in trend_years if y in all_available_years]
        if len(trend_years) < 3:
            raise Exception(f"Insufficient years for trend analysis. Need ≥3, got {len(trend_years)}: {trend_years}")

        results = []
        for _, row in villages_with_yearly_depth.iterrows():
            ts = row[trend_years]
            ts.index = [int(y) for y in trend_years]
            mk = self.mann_kendall_test(ts)
            results.append({
                'Village_ID': row.get(self.VILLAGE_CODE_COL, 'Unknown'),
                'Village_Name': row.get('village', row.get('VILLAGE', 'Unknown')),
                'Block': row.get('block', row.get('BLOCK', 'Unknown')),
                'District': row.get('district', row.get('DISTRICT', 'Unknown')),
                'SUBDIS_COD': row.get('SUBDIS_COD', 'Unknown'),
                'Mann_Kendall_Tau': mk.tau,
                'P_Value': mk.p_value,
                'Trend_Status': mk.trend,
                'Sen_Slope': mk.slope,
                'Data_Points': ts.count(),
                'Years_Analyzed': ', '.join(trend_years),
                'Start_Year': min([int(y) for y in trend_years]),
                'End_Year': max([int(y) for y in trend_years]),
                'Mean_Depth': float(ts.mean()) if ts.count() > 0 else None,
                'Std_Depth': float(ts.std()) if ts.count() > 1 else None,
                'Min_Depth': float(ts.min()) if ts.count() > 0 else None,
                'Max_Depth': float(ts.max()) if ts.count() > 0 else None,
                'Total_Years_Available': len(all_available_years),
                'All_Years_Available': ', '.join(all_available_years)
            })

        df = pd.DataFrame(results)
        color_map = {
            'Increasing': "#FA4646",
            'Decreasing': "#62D9D1",
            'No-Trend': "#95A5A6",
            'Insufficient Data': '#F39C12'
        }
        df['Color'] = df['Trend_Status'].map(color_map)
        
        print(f"✅ Mann-Kendall complete for {len(df)} villages")
        
        return df

    # ---------------------------
    # Map generation from GeoJSON data - UPDATED to return base64
    # ---------------------------
    def generate_trend_map_from_geojson(self, village_geojson, years_for_trend, subdis_codes=None, village_codes=None):
        """
        Generate a map visualization from village_geojson data and save as image
        Returns tuple: (filename, base64_string)
        """
        try:
            print("🗺️ Generating trend map from GeoJSON data...")
            
            # Pre-allocate lists
            village_polygons = []
            colors = []
            village_names = []
            
            # Process GeoJSON features
            from shapely.geometry import shape
            
            for feature in village_geojson['features']:
                try:
                    geom_data = feature['geometry']
                    properties = feature['properties']
                    
                    # Use shapely's shape() for faster conversion
                    polygon = shape(geom_data)
                    
                    # For MultiPolygon, take first polygon only
                    if polygon.geom_type == 'MultiPolygon':
                        polygon = list(polygon.geoms)[0]
                    
                    village_polygons.append(polygon)
                    colors.append(properties.get('Color', '#95A5A6'))
                    village_names.append(properties.get('Village_Name', 'Unknown'))
                        
                except Exception as e:
                    print(f"⚠️ Skipping feature due to geometry error: {e}")
                    continue
            
            if not village_polygons:
                raise Exception("No valid village polygons found in GeoJSON data")
            
            # Create GeoDataFrame in EPSG:4326 (lat/long degrees, same as PDFGenerationView)
            gdf = gpd.GeoDataFrame({
                'geometry': village_polygons,
                'color': colors,
                'village_name': village_names
            }, crs='EPSG:4326')
            
            print(f"✅ Created GeoDataFrame with {len(gdf)} villages")
            
            # Simplify geometries for faster rendering
            gdf['geometry'] = gdf['geometry'].simplify(
                tolerance=0.0001,
                preserve_topology=True
            )
            
            # Create figure (matching PDFGenerationView size)
            fig, ax = plt.subplots(1, 1, figsize=(15, 12))
            
            # Plot with matching style
            gdf.plot(
                ax=ax, 
                color=gdf['color'], 
                edgecolor='blue',
                alpha=0.6,
                linewidth=1.5
            )
            
            # Set map bounds with padding
            bounds = gdf.total_bounds
            padding = 0.01
            ax.set_xlim(bounds[0] - padding, bounds[2] + padding)
            ax.set_ylim(bounds[1] - padding, bounds[3] + padding)
            
            # Add lightweight basemap
            try:
                import contextily as ctx
                ctx.add_basemap(
                ax,
                crs=gdf.crs,
                source=ctx.providers.CartoDB.Voyager,  # more visible than Positron
                alpha=1,
                zoom=10
            )

            except Exception as e:
                print(f"⚠️ Could not add basemap: {e}")
            
            # Create title
            year_range = f"{min([int(y) for y in years_for_trend])}-{max([int(y) for y in years_for_trend])}"
            
            info_parts = []
            if subdis_codes:
                info_parts.append(f"SUBDIS_COD: {', '.join(map(str, subdis_codes[:3]))}{'...' if len(subdis_codes) > 3 else ''}")
            if village_codes:
                info_parts.append(f"Villages: {', '.join(map(str, village_codes[:3]))}{'...' if len(village_codes) > 3 else ''}")
            
            subtitle = f" ({' | '.join(info_parts)})" if info_parts else ""
            
            ax.set_title(
                f'Groundwater Trend Analysis Map ({year_range}){subtitle}',
                fontsize=14,
                fontweight='bold',
                pad=20
            )
            
            # Add legend
            import matplotlib.patches as mpatches
            legend_elements = [
                mpatches.Patch(color='#FF6B6B', label='Increasing (Worsening)'),
                mpatches.Patch(color='#4ECDC4', label='Decreasing (Improving)'),
                mpatches.Patch(color='#95A5A6', label='No Significant Trend'),
                mpatches.Patch(color='#F39C12', label='Insufficient Data')
            ]
            ax.legend(handles=legend_elements, loc='upper right', fontsize=10)
            
            # Axis labels - matching PDFGenerationView exactly (LONGITUDE/LATITUDE in degrees)
            ax.set_xlabel('LONGITUDE', fontsize=12)
            ax.set_ylabel('LATITUDE', fontsize=12)
            ax.grid(True, alpha=0.3)
            plt.tight_layout()
            
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id = str(uuid.uuid4())[:8]
            
            if subdis_codes:
                tag = "_".join(map(str, subdis_codes[:3])) + ("_etc" if len(subdis_codes) > 3 else "")
                image_filename = f"trend_map_subdis_{tag}_{year_range}_{timestamp}_{unique_id}.png"
            elif village_codes:
                tag = "_".join(map(str, village_codes[:3])) + ("_etc" if len(village_codes) > 3 else "")
                image_filename = f"trend_map_villages_{tag}_{year_range}_{timestamp}_{unique_id}.png"
            else:
                image_filename = f"trend_map_{year_range}_{timestamp}_{unique_id}.png"
            
            # Use BytesIO buffer for faster I/O
            from io import BytesIO
            
            buffer = BytesIO()
            plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight', facecolor='white')
            buffer.seek(0)
            
            # Convert to base64
            b64_string = base64.b64encode(buffer.read()).decode("utf-8")
            trend_map_base64 = f"data:image/png;base64,{b64_string}"
            
            # Save to file
            image_path = os.path.join(self.temp_media_dir, image_filename)
            os.makedirs(os.path.dirname(image_path), exist_ok=True)
            
            buffer.seek(0)
            with open(image_path, 'wb') as f:
                f.write(buffer.read())
            
            plt.close(fig)
            buffer.close()
            
            print(f"💾 Trend map saved to: {image_path}")
            print(f"✅ Trend map converted to base64")
            
            return image_filename, trend_map_base64
            
        except Exception as e:
            print(f"❌ Error generating trend map: {str(e)}")
            return None, None
    # ---------------------------
    # Charts
    # ---------------------------
    def generate_trend_charts(self, trend_summary, year_range, villages_with_depth=None, all_available_years=None, subdis_codes=None, village_codes=None):
        charts = {}
        try:
            plt.style.use('default')
            sns.set_palette("husl")

            # Title context
            info_parts = []
            if subdis_codes:
                info_parts.append(f"SUBDIS_COD: {', '.join(map(str, subdis_codes[:3]))}{'...' if len(subdis_codes) > 3 else ''}")
            if village_codes:
                info_parts.append(f"Villages: {', '.join(map(str, village_codes[:3]))}{'...' if len(village_codes) > 3 else ''}")
            ctx = f" ({' | '.join(info_parts)})" if info_parts else ""

            # 1. Pie chart
            fig, ax = plt.subplots(figsize=(10, 8))
            trend_counts = trend_summary['Trend_Status'].value_counts()
            colors = ['#2ecc71', '#e74c3c', '#f39c12', '#95a5a6']
            ax.pie(trend_counts.values, labels=trend_counts.index, autopct='%1.1f%%', colors=colors, startangle=90)
            ax.set_title(f'Groundwater Trend Distribution ({year_range}){ctx}', fontsize=14, fontweight='bold')
            buffer = BytesIO(); plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight'); buffer.seek(0)
            charts['trend_distribution'] = base64.b64encode(buffer.getvalue()).decode(); plt.close()

        except Exception as e:
            print(f"[WARNING] Chart generation error: {str(e)}")
            charts['error'] = str(e)
        return charts

    # ---------------------------
    # GeoJSON
    # ---------------------------
    def create_village_json_for_map(self, villages_with_depth, trend_results_df, all_available_years):
        print("🗺️ Building GeoJSON...")
        villages_with_trends = villages_with_depth.merge(
            trend_results_df,
            left_on=self.VILLAGE_CODE_COL,
            right_on='Village_ID',
            how='left'
        )
        if villages_with_trends.crs != "EPSG:4326":
            villages_with_trends = villages_with_trends.to_crs("EPSG:4326")

        features, skipped = [], 0
        for idx, row in villages_with_trends.iterrows():
            try:
                if row.geometry is None or row.geometry.is_empty:
                    skipped += 1; continue
                geom = row.geometry
                if not geom.is_valid:
                    from shapely.validation import make_valid
                    geom = make_valid(geom)
                    if not geom.is_valid:
                        skipped += 1; continue

                geom_type = geom.geom_type
                coords = None
                if geom_type == 'Polygon':
                    exterior = list(geom.exterior.coords)
                    coords = [[[float(x), float(y)] for x, y in exterior]]
                    for interior in geom.interiors:
                        coords.append([[float(x), float(y)] for x, y in interior.coords])
                elif geom_type == 'MultiPolygon':
                    coords = []
                    for g in geom.geoms:
                        if g.is_valid and not g.is_empty:
                            outer = [[float(x), float(y)] for x, y in g.exterior.coords]
                            poly = [outer]
                            for interior in g.interiors:
                                poly.append([[float(x), float(y)] for x, y in interior.coords])
                            coords.append(poly)
                else:
                    skipped += 1; continue

                if not coords:
                    skipped += 1; continue

                ts_data = {}
                for year in all_available_years:
                    if year in row and pd.notna(row[year]):
                        try:
                            ts_data[year] = float(row[year])
                        except (ValueError, TypeError):
                            ts_data[year] = None
                    else:
                        ts_data[year] = None

                feature = {
                    'type': 'Feature',
                    'geometry': {'type': geom_type, 'coordinates': coords},
                    'properties': {
                        'Village_ID': str(row.get('Village_ID', row.get(self.VILLAGE_CODE_COL, 'Unknown'))),
                        'Village_Name': str(row.get('Village_Name', row.get('village', row.get('VILLAGE', 'Unknown')))),
                        'Block': str(row.get('Block', row.get('block', row.get('BLOCK', 'Unknown')))),
                        'District': str(row.get('District', row.get('district', row.get('DISTRICT', 'Unknown')))),
                        'SUBDIS_COD': str(row.get('SUBDIS_COD', 'Unknown')),
                        'Mann_Kendall_Tau': float(row['Mann_Kendall_Tau']) if pd.notna(row.get('Mann_Kendall_Tau')) else None,
                        'P_Value': float(row['P_Value']) if pd.notna(row.get('P_Value')) else None,
                        'Trend_Status': str(row.get('Trend_Status', 'No Data')),
                        'Sen_Slope': float(row['Sen_Slope']) if pd.notna(row.get('Sen_Slope')) else None,
                        'Data_Points': int(row['Data_Points']) if pd.notna(row.get('Data_Points')) else 0,
                        'Years_Analyzed': str(row.get('Years_Analyzed', '')),
                        'Mean_Depth': float(row['Mean_Depth']) if pd.notna(row.get('Mean_Depth')) else None,
                        'Color': str(row.get('Color', '#95A5A6')),
                        'time_series': ts_data,
                        'bounds': {
                            'minLng': float(geom.bounds[0]),
                            'minLat': float(geom.bounds[1]),
                            'maxLng': float(geom.bounds[2]),
                            'maxLat': float(geom.bounds[3])
                        }
                    }
                }
                features.append(feature)
            except Exception as e:
                print(f"⚠️ Feature error at {idx}: {str(e)}")
                skipped += 1
                continue

        geojson_data = {
            'type': 'FeatureCollection',
            'features': features,
            'crs': {'type': 'name', 'properties': {'name': 'urn:ogc:def:crs:OGC:1.3:CRS84'}}
        }
        print(f"✅ GeoJSON with {len(features)} features (skipped {skipped})")
        return geojson_data

    # ---------------------------
    # Summary tables
    # ---------------------------
    def create_summary_tables(self, trend_results_df, villages_with_depth, all_available_years):
        tables = {}
        tr = trend_results_df['Trend_Status'].value_counts().reset_index()
        tr.columns = ['Trend_Status', 'Count']
        tr['Percentage'] = (tr['Count'] / len(trend_results_df) * 100).round(2)
        tables['trend_summary'] = tr.to_dict('records')
        return tables

    # ---------------------------
    # Response builder - UPDATED with base64
    # ---------------------------
    def create_comprehensive_response_data(self, villages_with_depth, trend_results_df, all_available_years, years_for_trend, timestamp, subdis_codes=None, village_codes=None):
        print("📊 Building response payload...")
        years_range = f"{min(years_for_trend)}-{max(years_for_trend)}"
        charts = self.generate_trend_charts(trend_results_df, years_range, villages_with_depth, all_available_years, subdis_codes=subdis_codes, village_codes=village_codes)
        village_geojson = self.create_village_json_for_map(villages_with_depth, trend_results_df, all_available_years)
        summary_tables = self.create_summary_tables(trend_results_df, villages_with_depth, all_available_years)

        # UPDATED: Generate trend map from GeoJSON and get both filename and base64
        trend_map_filename, trend_map_base64 = self.generate_trend_map_from_geojson(
            village_geojson, years_for_trend, subdis_codes=subdis_codes, village_codes=village_codes
        )

        trend_counts = trend_results_df['Trend_Status'].value_counts()
        village_trends = []
        for _, row in trend_results_df.iterrows():
            v = {
                'Village_ID': row['Village_ID'],
                'Village_Name': row['Village_Name'],
                'Block': row['Block'],
                'District': row['District'],
                'SUBDIS_COD': row['SUBDIS_COD'],
                'Trend_Status': row['Trend_Status'],
                'Color': row['Color'],
                'Mann_Kendall_Tau': float(row['Mann_Kendall_Tau']) if pd.notna(row['Mann_Kendall_Tau']) else None,
                'P_Value': float(row['P_Value']) if pd.notna(row['P_Value']) else None,
                'Sen_Slope': float(row['Sen_Slope']) if pd.notna(row['Sen_Slope']) else None,
                'Data_Points': int(row['Data_Points']),
                'Years_Analyzed': row['Years_Analyzed'],
                'Mean_Depth': float(row['Mean_Depth']) if pd.notna(row['Mean_Depth']) else None
            }
            village_trends.append(v)

        summary_stats = {
            'file_info': {
                'total_villages': len(trend_results_df),
                'analysis_date': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
                'analysis_timestamp': timestamp,
                'filtered_by_subdis_cod': subdis_codes if subdis_codes else [],
                'filtered_by_village_codes': village_codes if village_codes else [],
                'trend_map_filename': trend_map_filename,
                'trend_map_base64': trend_map_base64
            },
            'trend_distribution': {
                'increasing': int(trend_counts.get('Increasing', 0)),
                'decreasing': int(trend_counts.get('Decreasing', 0)),
                'no_trend': int(trend_counts.get('No-Trend', 0)),
                'insufficient_data': int(trend_counts.get('Insufficient Data', 0)),
                'total': len(trend_results_df)
            }
        }

        color_mapping = {
            'Increasing': {'color': '#FF6B6B', 'description': 'Groundwater level decreasing (depth increasing)'},
            'Decreasing': {'color': '#4ECDC4', 'description': 'Groundwater level rising (depth decreasing)'},
            'No-Trend': {'color': '#95A5A6', 'description': 'No significant trend detected'},
            'Insufficient Data': {'color': '#F39C12', 'description': 'Insufficient data for analysis'}
        }

        return {
            'success': True,
            'summary_stats': summary_stats,
            'village_geojson': village_geojson,
            'village_trends': village_trends,
            'charts': charts,
            'summary_tables': summary_tables,
            'color_mapping': color_mapping,
            'total_villages': len(village_trends),
            'analysis_timestamp': timestamp,
            'filtered_by_subdis_cod': subdis_codes if subdis_codes else [],
            'filtered_by_village_codes': village_codes if village_codes else [],
            'trend_map_filename': trend_map_filename,
            'trend_map_base64': trend_map_base64
        }

    # ---------------------------
    # API docs
    # ---------------------------
    def get(self, request):
        return JsonResponse({
            "api_name": "Groundwater Trend Analysis API with Seasonal and Yearly Time Series + Map Generation",
            "description": "Analyze groundwater trends (Mann-Kendall on yearly data) with seasonal and yearly time series generation + map visualization with base64 image.",
            "endpoints": {
                "POST": {
                    "description": "Perform groundwater trend analysis on filtered villages",
                    "required_parameters": {
                        "wells_csv_filename": "Name of wells CSV file in media/temp/"
                    }
                }
            }
        })

    # ---------------------------
    # POST method
    # ---------------------------
    def post(self, request):
        try:
            data = json.loads(request.body)
            wells_csv_filename = data.get("wells_csv_filename")
            subdis_codes = data.get("subdis_codes")
            village_codes = data.get("village_codes")
            trend_years = data.get("trend_years", None)
            return_type = data.get("return_type", "all")

            if not wells_csv_filename:
                return JsonResponse({"error": "wells_csv_filename is required"}, status=400)

            has_subdis = isinstance(subdis_codes, list) and len(subdis_codes) > 0
            has_village = isinstance(village_codes, list) and len(village_codes) > 0

            if has_subdis and has_village:
                return JsonResponse({"error": "Provide exactly one of subdis_codes or village_codes, not both"}, status=400)
            if not has_subdis and not has_village:
                return JsonResponse({"error": "Provide exactly one of subdis_codes or village_codes"}, status=400)

            wells_csv_path = os.path.join(self.temp_media_dir, wells_csv_filename)
            if not os.path.exists(wells_csv_path):
                return JsonResponse({"error": f"Wells CSV file not found: {wells_csv_filename}"}, status=404)

            print("🔍 Step 0: Filtering shapefiles...")
            if has_subdis:
                filtered_centroids, filtered_villages = self.filter_shapefiles_by_subdis_cod(subdis_codes)
            else:
                filtered_centroids, filtered_villages = self.filter_shapefiles_by_village_codes(village_codes)

            print("🔄 Step 1: Time series for filtered villages...")
            villages_with_yearly_depth, villages_with_seasonal_depth, all_available_years, timeseries_stats = self.create_village_time_series(
                wells_csv_path, filtered_centroids, filtered_villages, return_stats=True
            )

            if trend_years is None or len(trend_years) == 0:
                years_for_trend = all_available_years
            else:
                years_for_trend = [str(y) for y in trend_years]

            print("🔬 Step 2: Mann-Kendall analysis on yearly data...")
            trend_results_df = self.perform_mann_kendall_analysis(
                villages_with_yearly_depth, years_for_trend, all_available_years
            )

            timestamp = pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')
            if has_subdis:
                tag = "subdis_" + "_".join(map(str, subdis_codes[:3])) + ("_etc" if len(subdis_codes) > 3 else "")
            else:
                tag = "vill_" + "_".join(map(str, village_codes[:3])) + ("_etc" if len(village_codes) > 3 else "")

            trend_csv_filename = f"mann_kendall_results_{tag}_{min(years_for_trend)}_{max(years_for_trend)}_{timestamp}.csv"
            trend_csv_path = os.path.join(self.temp_media_dir, trend_csv_filename)
            
            numeric_cols = ['Mann_Kendall_Tau', 'P_Value', 'Sen_Slope', 'Mean_Depth', 'Std_Depth', 'Min_Depth', 'Max_Depth']
            trend_results_df[numeric_cols] = trend_results_df[numeric_cols].round(4)
            trend_results_df.to_csv(trend_csv_path, index=False)
            
            print(f"✅ Saved Mann-Kendall CSV: {trend_csv_path}")

            print("📊 Step 3: Building response data + generating map with base64...")
            response_data = self.create_comprehensive_response_data(
                villages_with_yearly_depth, trend_results_df, all_available_years, years_for_trend, timestamp,
                subdis_codes=subdis_codes if has_subdis else None,
                village_codes=village_codes if has_village else None
            )

            response_data['summary_stats']['file_info'].update({
                'wells_csv_filename': wells_csv_filename,
                'trend_csv_filename': trend_csv_filename,
                'timeseries_yearly_csv_filename': timeseries_stats.get('village_timeseries_yearly_csv', ''),
                'timeseries_seasonal_csv_filename': timeseries_stats.get('village_timeseries_seasonal_csv', '')
            })

            response_data['villages'] = response_data.pop('village_trends')
            print(f"✅ Done. Returning {response_data['total_villages']} villages with GeoJSON data + map image + base64")

            if return_type == 'stats':
                return JsonResponse({'success': True, 'summary_stats': response_data['summary_stats']})
            elif return_type == 'charts':
                return JsonResponse({'success': True, 'summary_stats': response_data['summary_stats'], 'charts': response_data['charts']})
            elif return_type == 'village_data':
                return JsonResponse({'success': True, 'village_geojson': response_data['village_geojson'], 'villages': response_data['villages']})
            elif return_type == 'tables':
                return JsonResponse({'success': True, 'summary_stats': response_data['summary_stats'], 'summary_tables': response_data['summary_tables']})
            else:
                return JsonResponse(response_data)

        except Exception as e:
            print(f"[ERROR] {str(e)}")
            import traceback
            traceback.print_exc()
            return JsonResponse({
                "error": str(e),
                "error_type": type(e).__name__,
                "traceback": traceback.format_exc()
            }, status=500)