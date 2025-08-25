import os
import json
import numpy as np
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
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
        self.VILLAGE_CODE_COL = 'village_co'   # <- per your instruction

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

            # 1. Pie
            fig, ax = plt.subplots(figsize=(10, 8))
            trend_counts = trend_summary['Trend_Status'].value_counts()
            colors = ['#2ecc71', '#e74c3c', '#f39c12', '#95a5a6']
            ax.pie(trend_counts.values, labels=trend_counts.index, autopct='%1.1f%%', colors=colors, startangle=90)
            ax.set_title(f'Groundwater Trend Distribution ({year_range}){ctx}', fontsize=14, fontweight='bold')
            buffer = BytesIO(); plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight'); buffer.seek(0)
            charts['trend_distribution'] = base64.b64encode(buffer.getvalue()).decode(); plt.close()

            # 2. Bar
            fig, ax = plt.subplots(figsize=(12, 6))
            trend_counts.plot(kind='bar', ax=ax, color=['#2ecc71', '#e74c3c', '#f39c12', '#95a5a6'])
            ax.set_title(f'Groundwater Trend Distribution ({year_range}){ctx}', fontsize=14, fontweight='bold')
            ax.set_xlabel('Trend Status'); ax.set_ylabel('Number of Villages'); ax.tick_params(axis='x', rotation=45)
            buffer = BytesIO(); plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight'); buffer.seek(0)
            charts['trend_bar_chart'] = base64.b64encode(buffer.getvalue()).decode(); plt.close()

            # 3. Tau hist
            valid_tau = trend_summary['Mann_Kendall_Tau'].dropna()
            if len(valid_tau) > 0:
                fig, ax = plt.subplots(figsize=(10, 6))
                ax.hist(valid_tau, bins=20, color='skyblue', alpha=0.7, edgecolor='black')
                ax.axvline(x=0, color='red', linestyle='--', alpha=0.8, label='No Trend (τ=0)')
                ax.set_xlabel('Mann-Kendall Tau (τ)'); ax.set_ylabel('Frequency')
                ax.set_title(f'Distribution of Tau Values ({year_range}){ctx}'); ax.legend(); ax.grid(True, alpha=0.3)
                buffer = BytesIO(); plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight'); buffer.seek(0)
                charts['tau_distribution'] = base64.b64encode(buffer.getvalue()).decode(); plt.close()

            # 4. P-value hist
            valid_p = trend_summary['P_Value'].dropna()
            if len(valid_p) > 0:
                fig, ax = plt.subplots(figsize=(10, 6))
                ax.hist(valid_p, bins=20, color='lightcoral', alpha=0.7, edgecolor='black')
                ax.axvline(x=0.05, color='red', linestyle='--', alpha=0.8, label='Significance Level (p=0.05)')
                ax.set_xlabel('P-Value'); ax.set_ylabel('Frequency')
                ax.set_title(f'Distribution of P-Values ({year_range}){ctx}'); ax.legend(); ax.grid(True, alpha=0.3)
                buffer = BytesIO(); plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight'); buffer.seek(0)
                charts['p_value_distribution'] = base64.b64encode(buffer.getvalue()).decode(); plt.close()

            # 5. Sen slope hist
            valid_slope = trend_summary['Sen_Slope'].dropna()
            if len(valid_slope) > 0:
                fig, ax = plt.subplots(figsize=(10, 6))
                ax.hist(valid_slope, bins=20, color='lightgreen', alpha=0.7, edgecolor='black')
                ax.axvline(x=0, color='red', linestyle='--', alpha=0.8, label='No Change (slope=0)')
                ax.set_xlabel("Sen's Slope (m/year)"); ax.set_ylabel('Frequency')
                ax.set_title(f"Distribution of Sen's Slope ({year_range}){ctx}"); ax.legend(); ax.grid(True, alpha=0.3)
                buffer = BytesIO(); plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight'); buffer.seek(0)
                charts['slope_distribution'] = base64.b64encode(buffer.getvalue()).decode(); plt.close()

            # 6. Tau vs P
            if len(valid_tau) > 0 and len(valid_p) > 0:
                fig, ax = plt.subplots(figsize=(10, 8))
                for trend, color in [('Increasing', '#e74c3c'), ('Decreasing', '#2ecc71'), ('No-Trend', '#95a5a6')]:
                    mask = trend_summary['Trend_Status'] == trend
                    if mask.any():
                        ax.scatter(trend_summary.loc[mask, 'Mann_Kendall_Tau'], trend_summary.loc[mask, 'P_Value'],
                                   c=color, label=trend, alpha=0.7, s=50)
                ax.axhline(y=0.05, color='red', linestyle='--', alpha=0.8, label='Significance Level (p=0.05)')
                ax.axvline(x=0, color='black', linestyle='-', alpha=0.5, label='No Trend (τ=0)')
                ax.set_xlabel('Mann-Kendall Tau (τ)'); ax.set_ylabel('P-Value')
                ax.set_title(f'Tau vs P-Value Scatter Plot ({year_range}){ctx}'); ax.legend(); ax.grid(True, alpha=0.3)
                buffer = BytesIO(); plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight'); buffer.seek(0)
                charts['tau_pvalue_scatter'] = base64.b64encode(buffer.getvalue()).decode(); plt.close()

            # 7. Time series overview
            if villages_with_depth is not None and all_available_years is not None:
                fig, ax = plt.subplots(figsize=(14, 8))
                year_stats = {}
                for year in all_available_years:
                    if year in villages_with_depth.columns:
                        values = villages_with_depth[year].dropna()
                        if len(values) > 0:
                            year_stats[year] = {
                                'mean': values.mean(),
                                'median': values.median(),
                                'q25': values.quantile(0.25),
                                'q75': values.quantile(0.75),
                                'min': values.min(),
                                'max': values.max()
                            }
                if year_stats:
                    years = list(year_stats.keys())
                    years_int = [int(y) for y in years]
                    means = [year_stats[y]['mean'] for y in years]
                    medians = [year_stats[y]['median'] for y in years]
                    q25s = [year_stats[y]['q25'] for y in years]
                    q75s = [year_stats[y]['q75'] for y in years]
                    ax.plot(years_int, means, 'o-', label='Mean', linewidth=2, markersize=6)
                    ax.plot(years_int, medians, 's-', label='Median', linewidth=2, markersize=6)
                    ax.fill_between(years_int, q25s, q75s, alpha=0.3, label='25th-75th Percentile')
                    ax.set_xlabel('Year'); ax.set_ylabel('Groundwater Depth (m)')
                    ax.set_title(f'Regional Groundwater Depth Overview ({min(years)}-{max(years)}){ctx}')
                    ax.legend(); ax.grid(True, alpha=0.3)
                    buffer = BytesIO(); plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight'); buffer.seek(0)
                    charts['time_series_overview'] = base64.b64encode(buffer.getvalue()).decode(); plt.close()

            # 8. Box by trend
            if 'Mean_Depth' in trend_summary.columns:
                fig, ax = plt.subplots(figsize=(12, 8))
                trend_data, trend_labels = [], []
                for trend in ['Increasing', 'Decreasing', 'No-Trend', 'Insufficient Data']:
                    data = trend_summary[trend_summary['Trend_Status'] == trend]['Mean_Depth'].dropna()
                    if len(data) > 0:
                        trend_data.append(data)
                        trend_labels.append(f'{trend}\n(n={len(data)})')
                if trend_data:
                    box_plot = ax.boxplot(trend_data, labels=trend_labels, patch_artist=True)
                    colors = ['#e74c3c', '#2ecc71', '#95a5a6', '#f39c12']
                    for patch, color in zip(box_plot['boxes'], colors[:len(box_plot['boxes'])]):
                        patch.set_facecolor(color); patch.set_alpha(0.7)
                    ax.set_ylabel('Mean Groundwater Depth (m)')
                    ax.set_title(f'Groundwater Depth Distribution by Trend Status ({year_range}){ctx}')
                    ax.grid(True, alpha=0.3)
                    buffer = BytesIO(); plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight'); buffer.seek(0)
                    charts['depth_by_trend_boxplot'] = base64.b64encode(buffer.getvalue()).decode(); plt.close()

            # 9. District-wise stacked
            if 'District' in trend_summary.columns:
                district_trend = trend_summary.groupby(['District', 'Trend_Status']).size().unstack(fill_value=0)
                if len(district_trend) > 0:
                    fig, ax = plt.subplots(figsize=(14, 8))
                    district_trend.plot(kind='bar', stacked=True, ax=ax, color=['#e74c3c', '#2ecc71', '#95a5a6', '#f39c12'])
                    ax.set_title(f'Trend Distribution by District ({year_range}){ctx}')
                    ax.set_xlabel('District'); ax.set_ylabel('Number of Villages')
                    ax.legend(title='Trend Status', bbox_to_anchor=(1.05, 1), loc='upper left')
                    plt.xticks(rotation=45)
                    buffer = BytesIO(); plt.savefig(buffer, format='png', dpi=300, bbox_inches='tight'); buffer.seek(0)
                    charts['district_trend_summary'] = base64.b64encode(buffer.getvalue()).decode(); plt.close()

        except Exception as e:
            print(f"[WARNING] Chart generation error: {str(e)}")
            charts['error'] = str(e)
        return charts

    # ---------------------------
    # Time series creation
    # ---------------------------
    def create_village_time_series(self, wells_csv_path, filtered_centroids, filtered_villages, return_stats=False):
        print("🔄 Creating village time series for FILTERED villages (all available years)...")
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

        centroid_well_records = []
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

            centroid_data = {}
            for year in years:
                pre_col, post_col = None, None
                for col in depth_columns:
                    if year in col:
                        if 'PRE' in col.upper(): pre_col = col
                        elif 'POST' in col.upper(): post_col = col

                year_values, year_weights = [], []
                for j, well_idx in enumerate(village_indices):
                    w = wells_gdf.iloc[well_idx]
                    pre_val = w[pre_col] if pre_col and not pd.isna(w[pre_col]) else None
                    post_val = w[post_col] if post_col and not pd.isna(w[post_col]) else None
                    vals = [v for v in [pre_val, post_val] if v is not None]
                    if vals:
                        year_values.append(np.mean(vals))
                        year_weights.append(weights[j])

                if year_values and year_weights:
                    yweights = np.array(year_weights); yweights = yweights / yweights.sum()
                    centroid_data[year] = float(np.sum(np.array(year_values) * yweights))
                else:
                    centroid_data[year] = np.nan

            for j, well_idx in enumerate(village_indices):
                centroid_data[f'nearest_well_{j+1}_id'] = wells_gdf.iloc[well_idx].get('id', f'well_{well_idx}')
                centroid_data[f'distance_{j+1}'] = float(village_distances[j])
                centroid_data[f'weight_{j+1}'] = float(weights[j]) if j < len(weights) else 0.0

            centroid_well_records.append(centroid_data)

        centroid_df = pd.DataFrame(centroid_well_records)
        # Maintain the joining key as the village unique identifier (use village_co)
        centroid_df[self.VILLAGE_CODE_COL] = centroids_gdf[self.VILLAGE_CODE_COL].values

        villages_with_depth = villages_gdf.merge(centroid_df, on=self.VILLAGE_CODE_COL, how='left')

        # Persist CSV without geometry
        ts_filename = f"village_timeseries_filtered_all_years_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.csv"
        ts_path = os.path.join(self.temp_media_dir, ts_filename)
        villages_with_depth.drop(columns=['geometry']).to_csv(ts_path, index=False)
        print(f"✅ Saved time series CSV: {ts_path}")

        stats_info = {
            'total_villages': len(villages_with_depth),
            'total_years_available': len(years),
            'all_years_analyzed': years,
            'avg_distance_to_nearest_well': float(np.mean([r.get('distance_1', 0) for r in centroid_well_records])),
            'village_timeseries_csv': ts_filename,
            'villages_filtered': True,
            'filtered_villages_count': len(villages_with_depth),
            'original_villages_count': "Filtered from original shapefiles"
        }

        if return_stats:
            return villages_with_depth, years, stats_info
        return villages_with_depth, years

    # ---------------------------
    # Trend analysis
    # ---------------------------
    def perform_mann_kendall_analysis(self, villages_with_depth, trend_years, all_available_years):
        print(f"🔬 Mann-Kendall for years: {trend_years}")
        missing_years = [y for y in trend_years if y not in all_available_years]
        if missing_years:
            print(f"⚠️ Missing requested years: {missing_years}. Proceeding with available.")
            trend_years = [y for y in trend_years if y in all_available_years]
        if len(trend_years) < 3:
            raise Exception(f"Insufficient years for trend analysis. Need ≥3, got {len(trend_years)}: {trend_years}")

        results = []
        for _, row in villages_with_depth.iterrows():
            ts = row[trend_years]
            ts.index = [int(y) for y in trend_years]
            mk = self.mann_kendall_test(ts)
            results.append({
                'Village_ID': row.get(self.VILLAGE_CODE_COL, 'Unknown'),  # set village unique id
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
            'Increasing': '#FF6B6B',
            'Decreasing': '#4ECDC4',
            'No-Trend': '#95A5A6',
            'Insufficient Data': '#F39C12'
        }
        df['Color'] = df['Trend_Status'].map(color_map)
        print(f"✅ MK complete for {len(df)} villages")
        return df

    # ---------------------------
    # FIXED GeoJSON for map - THIS WAS THE MAIN BUG!
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

                # FIXED: The bounds bug was here - missing indices [2] and [3]
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
                        'Std_Depth': float(row['Std_Depth']) if pd.notna(row.get('Std_Depth')) else None,
                        'Min_Depth': float(row['Min_Depth']) if pd.notna(row.get('Min_Depth')) else None,
                        'Max_Depth': float(row['Max_Depth']) if pd.notna(row.get('Max_Depth')) else None,

                        'Color': str(row.get('Color', '#95A5A6')),

                        'time_series': ts_data,

                        'nearest_well_1_id': str(row.get('nearest_well_1_id', 'Unknown')),
                        'nearest_well_2_id': str(row.get('nearest_well_2_id', 'Unknown')),
                        'nearest_well_3_id': str(row.get('nearest_well_3_id', 'Unknown')),
                        'distance_1': float(row['distance_1']) if pd.notna(row.get('distance_1')) else None,
                        'distance_2': float(row['distance_2']) if pd.notna(row.get('distance_2')) else None,
                        'distance_3': float(row['distance_3']) if pd.notna(row.get('distance_3')) else None,
                        'weight_1': float(row['weight_1']) if pd.notna(row.get('weight_1')) else None,
                        'weight_2': float(row['weight_2']) if pd.notna(row.get('weight_2')) else None,
                        'weight_3': float(row['weight_3']) if pd.notna(row.get('weight_3')) else None,

                        'significance': 'Significant' if pd.notna(row.get('P_Value')) and row.get('P_Value') < 0.05 else 'Not Significant',
                        'confidence_level': '99%' if pd.notna(row.get('P_Value')) and row.get('P_Value') < 0.01 else '95%' if pd.notna(row.get('P_Value')) and row.get('P_Value') < 0.05 else 'Not Significant',

                        # FIXED: Added the missing indices [2] and [3] for bounds
                        'bounds': {
                            'minLng': float(geom.bounds[0]),
                            'minLat': float(geom.bounds[1]),
                            'maxLng': float(geom.bounds[2]),  # FIXED: Was missing [2]
                            'maxLat': float(geom.bounds[3])   # FIXED: Was missing [3]
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
        if features:
            all_bounds = [f['properties']['bounds'] for f in features]
            overall_bounds = {
                'minLng': min(b['minLng'] for b in all_bounds),
                'minLat': min(b['minLat'] for b in all_bounds),
                'maxLng': max(b['maxLng'] for b in all_bounds),
                'maxLat': max(b['maxLat'] for b in all_bounds)
            }
            geojson_data['metadata'] = {
                'total_features': len(features),
                'skipped_features': skipped,
                'bounds': overall_bounds,
                'coordinate_system': 'WGS84 (EPSG:4326)',
                'generated_at': pd.Timestamp.now().isoformat()
            }
        print(f"✅ GeoJSON with {len(features)} features (skipped {skipped})")
        return geojson_data

    # ---------------------------
    # Summary tables and response builder
    # ---------------------------
    def create_summary_tables(self, trend_results_df, villages_with_depth, all_available_years):
        tables = {}
        tr = trend_results_df['Trend_Status'].value_counts().reset_index()
        tr.columns = ['Trend_Status', 'Count']
        tr['Percentage'] = (tr['Count'] / len(trend_results_df) * 100).round(2)
        tables['trend_summary'] = tr.to_dict('records')

        if 'District' in trend_results_df.columns:
            district_summary = trend_results_df.groupby(['District', 'Trend_Status']).size().unstack(fill_value=0)
            district_summary['Total'] = district_summary.sum(axis=1)
            tables['district_summary'] = district_summary.reset_index().to_dict('records')

        if 'Block' in trend_results_df.columns:
            block_summary = trend_results_df.groupby(['Block', 'Trend_Status']).size().unstack(fill_value=0)
            block_summary['Total'] = block_summary.sum(axis=1)
            tables['block_summary'] = block_summary.reset_index().to_dict('records')

        if 'SUBDIS_COD' in trend_results_df.columns:
            sd_summary = trend_results_df.groupby(['SUBDIS_COD', 'Trend_Status']).size().unstack(fill_value=0)
            sd_summary['Total'] = sd_summary.sum(axis=1)
            tables['subdis_summary'] = sd_summary.reset_index().to_dict('records')

        significance_table = []
        for trend in ['Increasing', 'Decreasing']:
            strong = len(trend_results_df[(trend_results_df['Trend_Status'] == trend) & (trend_results_df['P_Value'] < 0.01)])
            moderate = len(trend_results_df[(trend_results_df['Trend_Status'] == trend) & (trend_results_df['P_Value'] >= 0.01) & (trend_results_df['P_Value'] < 0.05)])
            total = len(trend_results_df[trend_results_df['Trend_Status'] == trend])
            significance_table.append({
                'Trend': trend,
                'Strong_Significance_99%': strong,
                'Moderate_Significance_95%': moderate,
                'Total': total,
                'Strong_Percentage': round(strong/total*100, 2) if total > 0 else 0,
                'Moderate_Percentage': round(moderate/total*100, 2) if total > 0 else 0
            })
        tables['significance_summary'] = significance_table

        dq = []
        for points in sorted(trend_results_df['Data_Points'].unique()):
            count = len(trend_results_df[trend_results_df['Data_Points'] == points])
            dq.append({'Data_Points': int(points), 'Village_Count': count, 'Percentage': round(count / len(trend_results_df) * 100, 2)})
        tables['data_quality'] = dq

        if not trend_results_df['Mann_Kendall_Tau'].isna().all():
            top_inc = trend_results_df.nlargest(5, 'Mann_Kendall_Tau')[['Village_Name', 'District', 'SUBDIS_COD', 'Mann_Kendall_Tau', 'P_Value', 'Trend_Status']].to_dict('records')
            top_dec = trend_results_df.nsmallest(5, 'Mann_Kendall_Tau')[['Village_Name', 'District', 'SUBDIS_COD', 'Mann_Kendall_Tau', 'P_Value', 'Trend_Status']].to_dict('records')
            tables['top_increasing_trends'] = top_inc
            tables['top_decreasing_trends'] = top_dec

        return tables

    def create_comprehensive_response_data(self, villages_with_depth, trend_results_df, all_available_years, years_for_trend, timestamp, subdis_codes=None, village_codes=None):
        print("📊 Building response payload...")
        years_range = f"{min(years_for_trend)}-{max(years_for_trend)}"
        charts = self.generate_trend_charts(trend_results_df, years_range, villages_with_depth, all_available_years, subdis_codes=subdis_codes, village_codes=village_codes)
        
        # IMPORTANT: This creates the village GeoJSON data that was missing!
        village_geojson = self.create_village_json_for_map(villages_with_depth, trend_results_df, all_available_years)
        
        summary_tables = self.create_summary_tables(trend_results_df, villages_with_depth, all_available_years)

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
                'Mean_Depth': float(row['Mean_Depth']) if pd.notna(row['Mean_Depth']) else None,
                'Std_Depth': float(row['Std_Depth']) if pd.notna(row['Std_Depth']) else None,
                'Min_Depth': float(row['Min_Depth']) if pd.notna(row['Min_Depth']) else None,
                'Max_Depth': float(row['Max_Depth']) if pd.notna(row['Max_Depth']) else None,
                'Significance': 'Significant' if pd.notna(row['P_Value']) and row['P_Value'] < 0.05 else 'Not Significant',
                'Confidence_Level': '99%' if pd.notna(row['P_Value']) and row['P_Value'] < 0.01 else '95%' if pd.notna(row['P_Value']) and row['P_Value'] < 0.05 else 'Not Significant'
            }
            # attach full time series
            vw = villages_with_depth[villages_with_depth[self.VILLAGE_CODE_COL] == row['Village_ID']]
            if len(vw) > 0:
                vw_row = vw.iloc[0]
                ts = {}
                for year in all_available_years:
                    if year in vw_row and pd.notna(vw_row[year]):
                        ts[year] = float(vw_row[year])
                    else:
                        ts[year] = None
                v['time_series'] = ts
            village_trends.append(v)

        summary_stats = {
            'file_info': {
                'total_villages': len(trend_results_df),
                'analysis_date': pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'),
                'analysis_timestamp': timestamp,
                'filtered_by_subdis_cod': subdis_codes if subdis_codes else [],
                'filtered_by_village_codes': village_codes if village_codes else [],
                'subdis_cod_count': len(subdis_codes) if subdis_codes else 0,
                'village_codes_count': len(village_codes) if village_codes else 0,
                'filter_kind': 'subdistrict' if subdis_codes else 'village' if village_codes else 'none'
            },
            'trend_distribution': {
                'increasing': int(trend_counts.get('Increasing', 0)),
                'decreasing': int(trend_counts.get('Decreasing', 0)),
                'no_trend': int(trend_counts.get('No-Trend', 0)),
                'insufficient_data': int(trend_counts.get('Insufficient Data', 0)),
                'total': len(trend_results_df)
            },
            'trend_percentages': {
                'increasing_percent': float(trend_counts.get('Increasing', 0) / len(trend_results_df) * 100) if len(trend_results_df) else 0.0,
                'decreasing_percent': float(trend_counts.get('Decreasing', 0) / len(trend_results_df) * 100) if len(trend_results_df) else 0.0,
                'no_trend_percent': float(trend_counts.get('No-Trend', 0) / len(trend_results_df) * 100) if len(trend_results_df) else 0.0,
                'insufficient_data_percent': float(trend_counts.get('Insufficient Data', 0) / len(trend_results_df) * 100) if len(trend_results_df) else 0.0
            },
            'statistical_summary': {
                'mean_tau': float(trend_results_df['Mann_Kendall_Tau'].mean()) if not trend_results_df['Mann_Kendall_Tau'].isna().all() else None,
                'median_tau': float(trend_results_df['Mann_Kendall_Tau'].median()) if not trend_results_df['Mann_Kendall_Tau'].isna().all() else None,
                'mean_sen_slope': float(trend_results_df['Sen_Slope'].mean()) if not trend_results_df['Sen_Slope'].isna().all() else None,
                'median_sen_slope': float(trend_results_df['Sen_Slope'].median()) if not trend_results_df['Sen_Slope'].isna().all() else None,
                'significant_trends_count': len(trend_results_df[trend_results_df['P_Value'] < 0.05]) if not trend_results_df['P_Value'].isna().all() else 0,
                'significant_trends_percent': float(len(trend_results_df[trend_results_df['P_Value'] < 0.05]) / len(trend_results_df) * 100) if not trend_results_df['P_Value'].isna().all() else 0,
                'min_tau': float(trend_results_df['Mann_Kendall_Tau'].min()) if not trend_results_df['Mann_Kendall_Tau'].isna().all() else None,
                'max_tau': float(trend_results_df['Mann_Kendall_Tau'].max()) if not trend_results_df['Mann_Kendall_Tau'].isna().all() else None,
                'min_sen_slope': float(trend_results_df['Sen_Slope'].min()) if not trend_results_df['Sen_Slope'].isna().all() else None,
                'max_sen_slope': float(trend_results_df['Sen_Slope'].max()) if not trend_results_df['Sen_Slope'].isna().all() else None,
                'std_tau': float(trend_results_df['Mann_Kendall_Tau'].std()) if not trend_results_df['Mann_Kendall_Tau'].isna().all() else None,
                'std_sen_slope': float(trend_results_df['Sen_Slope'].std()) if not trend_results_df['Sen_Slope'].isna().all() else None
            },
            'data_quality': {
                'avg_data_points_per_village': float(trend_results_df['Data_Points'].mean()) if len(trend_results_df) else 0.0,
                'min_data_points': int(trend_results_df['Data_Points'].min()) if len(trend_results_df) else 0,
                'max_data_points': int(trend_results_df['Data_Points'].max()) if len(trend_results_df) else 0,
                'villages_with_full_data': len(trend_results_df[trend_results_df['Data_Points'] == len(years_for_trend)]) if len(trend_results_df) else 0,
                'data_completeness_percent': float(len(trend_results_df[trend_results_df['Data_Points'] == len(years_for_trend)]) / len(trend_results_df) * 100) if len(trend_results_df) else 0.0
            },
            'trend_breakdown': {
                'increasing_strong': len(trend_results_df[(trend_results_df['Trend_Status'] == 'Increasing') & (trend_results_df['P_Value'] < 0.01)]),
                'increasing_moderate': len(trend_results_df[(trend_results_df['Trend_Status'] == 'Increasing') & (trend_results_df['P_Value'] >= 0.01) & (trend_results_df['P_Value'] < 0.05)]),
                'decreasing_strong': len(trend_results_df[(trend_results_df['Trend_Status'] == 'Decreasing') & (trend_results_df['P_Value'] < 0.01)]),
                'decreasing_moderate': len(trend_results_df[(trend_results_df['Trend_Status'] == 'Decreasing') & (trend_results_df['P_Value'] >= 0.01) & (trend_results_df['P_Value'] < 0.05)])
            },
            'analysis_parameters': {
                'years_for_trend_analysis': years_for_trend,
                'total_years_available': all_available_years,
                'analysis_year_range': f"{min(years_for_trend)}-{max(years_for_trend)}",
                'total_analysis_years': len(years_for_trend),
                'subdis_cod_filter': subdis_codes if subdis_codes else [],
                'village_codes_filter': village_codes if village_codes else []
            }
        }

        color_mapping = {
            'Increasing': {'color': '#FF6B6B', 'description': 'Groundwater level decreasing (depth increasing)', 'icon': '⬆️'},
            'Decreasing': {'color': '#4ECDC4', 'description': 'Groundwater level rising (depth decreasing)', 'icon': '⬇️'},
            'No-Trend': {'color': '#95A5A6', 'description': 'No significant trend detected', 'icon': '➡️'},
            'Insufficient Data': {'color': '#F39C12', 'description': 'Insufficient data for analysis', 'icon': '❓'}
        }

        return {
            'success': True,
            'summary_stats': summary_stats,
            'village_geojson': village_geojson,  # ✅ FIXED: Now properly returns GeoJSON data
            'village_trends': village_trends,
            'charts': charts,
            'summary_tables': summary_tables,
            'color_mapping': color_mapping,
            'total_villages': len(village_trends),
            'analysis_timestamp': timestamp,
            'filtered_by_subdis_cod': subdis_codes if subdis_codes else [],
            'filtered_by_village_codes': village_codes if village_codes else []
        }

    # ---------------------------
    # API docs
    # ---------------------------
    def get(self, request):
        return JsonResponse({
            "api_name": "Groundwater Trend Analysis API (subdistrict OR village filter)",
            "description": "Analyze groundwater trends (Mann-Kendall) with exactly one filter: subdis_codes OR village_codes.",
            "endpoints": {
                "POST": {
                    "description": "Perform groundwater trend analysis on filtered villages",
                    "required_parameters": {
                        "wells_csv_filename": "Name of wells CSV file in media/temp/"
                    },
                    "exactly_one_filter_required": {
                        "subdis_codes": "List of SUBDIS_COD values. Includes ALL villages in those subdistricts.",
                        "village_codes": f"List of village codes in shapefiles column '{self.VILLAGE_CODE_COL}'. Includes ONLY these villages."
                    },
                    "optional_parameters": {
                        "trend_years": "List of years for trend analysis (e.g., ['2015', '2016', ...]). If omitted, all available years are used.",
                        "return_type": "Options: 'all' (default), 'stats', 'charts', 'village_data', 'tables'"
                    },
                    "example_requests": {
                        "subdistrict_filter": {
                            "wells_csv_filename": "groundwater_wells_2024.csv",
                            "subdis_codes": ["101", "102", "103", "104"],
                            "trend_years": ["2015","2016","2017","2018","2019","2020"],
                            "return_type": "all"
                        },
                        "village_filter": {
                            "wells_csv_filename": "groundwater_wells_2024.csv",
                            "village_codes": ["50001","50002","50003"],
                            "trend_years": ["2015","2016","2017","2018","2019","2020"],
                            "return_type": "all"
                        }
                    }
                }
            },
            "response_structure": {
                "success": "Boolean indicating success",
                "summary_stats": "Comprehensive statistical analysis",
                "village_geojson": "GeoJSON FeatureCollection for map visualization with village polygons and trend data",
                "villages": "Array of village trend data with time series",
                "charts": "Base64 encoded visualization charts",
                "summary_tables": "Statistical summary tables",
                "color_mapping": "Color codes for different trend statuses",
                "total_villages": "Number of villages analyzed"
            }
        })

    # ---------------------------
    # POST
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

            # XOR filter rule: exactly one of subdis_codes or village_codes
            has_subdis = isinstance(subdis_codes, list) and len(subdis_codes) > 0
            has_village = isinstance(village_codes, list) and len(village_codes) > 0

            if has_subdis and has_village:
                return JsonResponse({"error": "Provide exactly one of subdis_codes or village_codes, not both"}, status=400)
            if not has_subdis and not has_village:
                return JsonResponse({"error": "Provide exactly one of subdis_codes or village_codes"}, status=400)

            wells_csv_path = os.path.join(self.temp_media_dir, wells_csv_filename)
            if not os.path.exists(wells_csv_path):
                return JsonResponse({"error": f"Wells CSV file not found: {wells_csv_filename}"}, status=404)

            if not os.path.exists(self.village_shp_path):
                return JsonResponse({"error": f"Village shapefile not found at: {self.village_shp_path}"}, status=404)
            if not os.path.exists(self.centroid_shp_path):
                return JsonResponse({"error": f"Centroid shapefile not found at: {self.centroid_shp_path}"}, status=404)

            print("🔍 Step 0: Filtering shapefiles...")
            try:
                if has_subdis:
                    filtered_centroids, filtered_villages = self.filter_shapefiles_by_subdis_cod(subdis_codes)
                else:
                    filtered_centroids, filtered_villages = self.filter_shapefiles_by_village_codes(village_codes)
            except Exception as e:
                return JsonResponse({"error": f"Filtering error: {str(e)}"}, status=400)

            print("🔄 Step 1: Time series for filtered villages...")
            villages_with_depth, all_available_years, timeseries_stats = self.create_village_time_series(
                wells_csv_path, filtered_centroids, filtered_villages, return_stats=True
            )

            if trend_years is None or len(trend_years) == 0:
                years_for_trend = all_available_years
            else:
                years_for_trend = [str(y) for y in trend_years]

            print("🔬 Step 3: Mann-Kendall analysis...")
            trend_results_df = self.perform_mann_kendall_analysis(
                villages_with_depth, years_for_trend, all_available_years
            )

            # CSV naming reflects filter used
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
            print(f"✅ Saved MK CSV: {trend_csv_path}")

            print("📊 Step 5: Building response data...")
            response_data = self.create_comprehensive_response_data(
                villages_with_depth, trend_results_df, all_available_years, years_for_trend, timestamp,
                subdis_codes=subdis_codes if has_subdis else None,
                village_codes=village_codes if has_village else None
            )

            response_data['summary_stats']['file_info'].update({
                'wells_csv_filename': wells_csv_filename,
                'trend_csv_filename': trend_csv_filename,
                'timeseries_csv_filename': timeseries_stats.get('village_timeseries_csv', '')
            })

            # Backward-compatible alias
            response_data['villages'] = response_data.pop('village_trends')
            print(f"✅ Done. Returning {response_data['total_villages']} villages with GeoJSON data")

            # Optionally filter the payload by return_type
            if return_type == 'stats':
                return JsonResponse({'success': True, 'summary_stats': response_data['summary_stats']})
            elif return_type == 'charts':
                return JsonResponse({'success': True, 'summary_stats': response_data['summary_stats'], 'charts': response_data['charts']})
            elif return_type == 'village_data':
                return JsonResponse({'success': True, 'village_geojson': response_data['village_geojson'], 'villages': response_data['villages']})
            elif return_type == 'tables':
                return JsonResponse({'success': True, 'summary_stats': response_data['summary_stats'], 'summary_tables': response_data['summary_tables']})
            else:
                # ✅ FIXED: Now returns ALL data including village_geojson
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