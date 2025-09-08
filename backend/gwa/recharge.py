import pandas as pd
import numpy as np
import geopandas as gpd
from datetime import datetime
import os
import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny


class GroundwaterRechargeView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Extract payload data
        csv_filename = request.data.get('csvFilename')
        selected_villages = request.data.get('selectedVillages')
        selected_subdistricts = request.data.get('selectedSubDistricts')

        # Validate required fields
        if not csv_filename:
            return Response(
                {"success": False, "message": "Missing required field: csvFilename"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not selected_villages and not selected_subdistricts:
            return Response(
                {"success": False, "message": "Either selectedVillages or selectedSubDistricts must be provided"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Step 1: Load seasonal timeseries CSV
            csv_path = os.path.join('media', 'temp', csv_filename)
            if not os.path.exists(csv_path):
                return Response(
                    {"success": False, "message": f"CSV file not found at {csv_path}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            df = pd.read_csv(csv_path)
            if df.empty:
                return Response(
                    {"success": False, "message": "CSV file is empty"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ✅ CLEAN COLUMN NAMES - Remove leading/trailing spaces
            df.columns = df.columns.str.strip()

            print(f"✅ Loaded CSV with {len(df)} rows and columns: {list(df.columns)}")

            # Step 2: Identify Pre/Post columns
            pre_columns = [col for col in df.columns if 'pre' in col.lower()]
            post_columns = [col for col in df.columns if 'post' in col.lower()]

            if not pre_columns or not post_columns:
                return Response(
                    {"success": False, "message": f"Could not find pre/post columns. Found pre: {pre_columns}, post: {post_columns}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"📊 Found pre columns: {pre_columns}")
            print(f"📊 Found post columns: {post_columns}")

            # Step 3: Calculate means
            # Convert columns to numeric, replacing non-numeric values with NaN
            for col in pre_columns + post_columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')

            df['mean_pre'] = df[pre_columns].mean(axis=1, skipna=True)
            df['mean_post'] = df[post_columns].mean(axis=1, skipna=True)

            # Step 4: Calculate water fluctuation
            df['Water_fluctuation'] = abs(df['mean_pre'] - df['mean_post'])

            print(f"🧮 Calculated mean_pre, mean_post, and Water_fluctuation")

            # Step 5: Load and filter centroid shapefile
            centroid_path = os.path.join('media', 'gwa_data', 'gwa_shp', 'Centroid', 'Centroid2.shp')
            if not os.path.exists(centroid_path):
                return Response(
                    {"success": False, "message": f"Centroid shapefile not found at {centroid_path}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            gdf = gpd.read_file(centroid_path)
            if gdf.empty:
                return Response(
                    {"success": False, "message": "Centroid shapefile is empty"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"🗺️ Loaded centroid shapefile with {len(gdf)} features")
            print(f"🗺️ Shapefile columns: {list(gdf.columns)}")

            # Validate required columns in shapefile
            required_shp_columns = ['village_co', 'SUBDIS_COD', 'yield']
            missing_shp_columns = [col for col in required_shp_columns if col not in gdf.columns]
            if missing_shp_columns:
                return Response(
                    {"success": False, "message": f"Missing columns in shapefile: {missing_shp_columns}. Available: {list(gdf.columns)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Filter shapefile based on selection
            if selected_villages:
                # Convert to string for comparison
                gdf['village_co'] = gdf['village_co'].astype(str)
                selected_villages_str = [str(v) for v in selected_villages]
                filtered_gdf = gdf[gdf['village_co'].isin(selected_villages_str)]
                filter_type = "villages"
                filter_values = selected_villages_str
                print(f"🎯 Filtering by villages: {selected_villages_str}")
            else:
                # Convert to numeric for comparison
                gdf['SUBDIS_COD'] = pd.to_numeric(gdf['SUBDIS_COD'], errors='coerce')
                selected_subdistricts_num = [int(s) for s in selected_subdistricts]
                filtered_gdf = gdf[gdf['SUBDIS_COD'].isin(selected_subdistricts_num)]
                filter_type = "subdistricts"
                filter_values = selected_subdistricts_num
                print(f"🎯 Filtering by subdistricts: {selected_subdistricts_num}")

            if filtered_gdf.empty:
                return Response(
                    {"success": False, "message": f"No features found for selected {filter_type}: {filter_values}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            print(f"✅ Filtered shapefile to {len(filtered_gdf)} features")

            # Step 6: Combine data using village_co column
            # Convert filtered shapefile to DataFrame (drop geometry for CSV)
            shp_df = filtered_gdf.drop(columns='geometry') if 'geometry' in filtered_gdf.columns else filtered_gdf

            print(f"📋 Available CSV columns: {list(df.columns)}")
            print(f"📋 Available shapefile columns: {list(shp_df.columns)}")

            # Check if village_co exists in both CSV and shapefile
            if 'village_co' not in df.columns:
                return Response(
                    {"success": False, "message": f"Cannot join: 'village_co' column missing from CSV. Available CSV columns: {list(df.columns)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if 'village_co' not in shp_df.columns:
                return Response(
                    {"success": False, "message": f"Cannot join: 'village_co' column missing from shapefile. Available shapefile columns: {list(shp_df.columns)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Convert both village_co columns to string for consistent comparison
            df['village_co'] = df['village_co'].astype(str)
            shp_df['village_co'] = shp_df['village_co'].astype(str)

            # Perform inner join on village_co
            combined_df = pd.merge(df, shp_df, on='village_co', how='inner')

            print(f"🔗 Successfully joined CSV and shapefile on 'village_co' column")
            print(f"🔗 Combined data: {len(combined_df)} records (CSV: {len(df)}, Shapefile filtered: {len(shp_df)})")

            if combined_df.empty:
                return Response(
                    {"success": False, "message": "No matching records found between CSV and shapefile based on village_co"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Show some sample matches for debugging
            sample_villages = combined_df['village_co'].head(3).tolist()
            print(f"📝 Sample village codes matched: {sample_villages}")

            # Step 7: Calculate recharge
            # Ensure yield column is numeric
            combined_df['yield'] = pd.to_numeric(combined_df['yield'], errors='coerce')
            
            # Calculate recharge = Water_fluctuation × yield
            combined_df['recharge'] = combined_df['Water_fluctuation'] * combined_df['yield']

            print(f"🧮 Calculated recharge column (Water_fluctuation × yield)")

            # Step 8: Save combined CSV
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"recharge_analysis_{timestamp}.csv"
            output_path = os.path.join('media', 'temp', output_filename)
            
            # Ensure temp directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            combined_df.to_csv(output_path, index=False)

            print(f"💾 Saved combined CSV: {output_filename}")

            # ✅ SAFE HELPER FUNCTIONS for JSON serialization
            def safe_float(value):
                """Convert to float, return None if NaN, inf, or invalid"""
                try:
                    if pd.isna(value):
                        return None
                    if isinstance(value, (int, float)) and (np.isinf(value) or np.isnan(value)):
                        return None
                    return float(value)
                except (ValueError, TypeError, OverflowError):
                    return None

            def safe_int(value):
                """Convert to int, return None if NaN or invalid"""
                try:
                    if pd.isna(value):
                        return None
                    return int(value)
                except (ValueError, TypeError, OverflowError):
                    return None

            def safe_value(value):
                """Convert any value to JSON-safe format"""
                # Handle pandas/numpy types
                if pd.isna(value):
                    return None
                
                # Handle numeric types
                if isinstance(value, (np.integer, np.floating)):
                    if np.isnan(value) or np.isinf(value):
                        return None
                    return value.item()  # Convert to Python native type
                
                # Handle regular floats
                if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
                    return None
                    
                return value

            # Prepare summary statistics with safe numeric conversions
            summary_stats = {
                "total_records": len(combined_df),
                "mean_water_fluctuation": safe_float(combined_df['Water_fluctuation'].mean()),
                "mean_yield": safe_float(combined_df['yield'].mean()),
                "mean_recharge": safe_float(combined_df['recharge'].mean()),
                "max_recharge": safe_float(combined_df['recharge'].max()),
                "min_recharge": safe_float(combined_df['recharge'].min()),
                "records_with_valid_recharge": safe_int(combined_df['recharge'].notna().sum()),
                "records_with_missing_yield": safe_int(combined_df['yield'].isna().sum()),
            }

            # Convert DataFrame to dict with safe value conversion
            def dataframe_to_safe_dict(df, limit=None):
                """Convert DataFrame to JSON-safe dictionary records"""
                records = []
                df_subset = df.head(limit) if limit else df
                
                for _, row in df_subset.iterrows():
                    record = {}
                    for col, value in row.items():
                        record[col] = safe_value(value)
                    records.append(record)
                return records

            sample_data = dataframe_to_safe_dict(combined_df, limit=5)
            full_data = dataframe_to_safe_dict(combined_df)

            print(f"🧹 Cleaned all values for JSON serialization")

            # Prepare enhanced response
            response_data = {
                "success": True,
                "message": f"Recharge analysis completed successfully for {len(combined_df)} records",
                "metadata": {
                    "processing_timestamp": datetime.now().isoformat(),
                    "input_csv": csv_filename,
                    "filter_type": filter_type,
                    "filter_values": filter_values,
                    "pre_columns_found": pre_columns,
                    "post_columns_found": post_columns,
                    "join_column": "village_co",
                    "records_before_join": {"csv": len(df), "shapefile_filtered": len(shp_df)},
                    "records_after_join": len(combined_df)
                },
                "output": {
                    "csv_filename": output_filename,
                    "csv_path": output_path,
                    "columns": list(combined_df.columns),
                    "file_size_bytes": os.path.getsize(output_path),
                    "calculation_formula": "recharge = Water_fluctuation × yield"
                },
                "summary_statistics": summary_stats,
                "sample_data": sample_data,  # First 5 records for preview
                "data": full_data  # Full data
            }

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            print(f"❌ Error in recharge analysis: {str(e)}")
            return Response(
                {"success": False, "message": f"Error processing recharge analysis: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
