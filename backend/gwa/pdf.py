import os
import pandas as pd
import geopandas as gpd
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import Polygon
from shapely.geometry import Point
import contextily as ctx
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.conf import settings
import uuid
from datetime import datetime
import numpy as np
import base64

class PDFGenerationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            # Get data from request - handle both camelCase and snake_case
            selected_sub_districts = request.data.get('selectedSubDistricts', [])
            selected_villages = request.data.get('village_codes', [])
            
            # Handle both csvFilename (camelCase from admin) and csv_filename (snake_case from drain)
            csv_filename = request.data.get('csv_filename') or request.data.get('csvFilename')
            
            # Validate input
            if not selected_sub_districts and not selected_villages:
                return Response({
                    "success": False,
                    "error": "Either selectedSubDistricts or village_codes is required"
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Allow null csv_filename but warn about it
            if not csv_filename:
                print("⚠️ Warning: No CSV filename provided, proceeding without well data")
                csv_filename = None

            print(f"🚀 Starting PDF generation for sub-districts: {selected_sub_districts}, villages: {selected_villages}")
            print(f"📁 CSV filename: {csv_filename}")

            # Step 1: Load CSV file from media/temp/ (if provided)
            df_wells = pd.DataFrame()  # Empty dataframe by default
            gdf_wells = None
            
            if csv_filename:
                csv_path = os.path.join(settings.MEDIA_ROOT, "temp", csv_filename)
                
                if not os.path.exists(csv_path):
                    return Response({
                        "success": False,
                        "error": f"CSV file '{csv_filename}' not found in temp folder"
                    }, status=status.HTTP_404_NOT_FOUND)

                print(f"📊 Loading CSV from: {csv_path}")
                df_wells = pd.read_csv(csv_path)
                
                # Validate CSV has required columns
                required_columns = ['LATITUDE', 'LONGITUDE']
                missing_columns = [col for col in required_columns if col not in df_wells.columns]
                if missing_columns:
                    return Response({
                        "success": False,
                        "error": f"CSV missing required columns: {missing_columns}"
                    }, status=status.HTTP_400_BAD_REQUEST)

                print(f"✅ CSV loaded successfully with {len(df_wells)} wells")

                # Create wells geodataframe
                df_wells_clean = df_wells.dropna(subset=['LATITUDE', 'LONGITUDE'])
                
                if len(df_wells_clean) == 0:
                    print("⚠️ Warning: No valid well coordinates found in CSV")
                    gdf_wells = None
                else:
                    # Create geometry points
                    geometry = [Point(xy) for xy in zip(df_wells_clean['LONGITUDE'], df_wells_clean['LATITUDE'])]
                    gdf_wells = gpd.GeoDataFrame(df_wells_clean, geometry=geometry, crs='EPSG:4326')
                    print(f"📍 Created {len(gdf_wells)} well points")

            # Step 2: Load villages shapefile
            villages_shp_path = os.path.join(settings.MEDIA_ROOT, "gwa_data", "gwa_shp", "Final_Village", "Village_New.shp")
            
            if not os.path.exists(villages_shp_path):
                return Response({
                    "success": False,
                    "error": "Villages shapefile not found at media/gwa_data/gwa_shp/Final_Village/Village_New.shp"
                }, status=status.HTTP_404_NOT_FOUND)

            print(f"🗺️ Loading villages shapefile from: {villages_shp_path}")
            gdf_villages = gpd.read_file(villages_shp_path)
            
            # Validate shapefile has required columns
            required_shp_columns = ['SUBDIS_COD', 'village_co']
            missing_shp_columns = [col for col in required_shp_columns if col not in gdf_villages.columns]
            if missing_shp_columns:
                return Response({
                    "success": False,
                    "error": f"Shapefile missing required columns: {missing_shp_columns}"
                }, status=status.HTTP_400_BAD_REQUEST)

            print(f"✅ Villages shapefile loaded with {len(gdf_villages)} villages")

            # Step 3: Filter villages based on input
            filtered_villages = None
            if selected_villages:
                # Convert village_co to match the type of selected_villages
                try:
                    if isinstance(selected_villages[0], int):
                        gdf_villages['village_co'] = pd.to_numeric(gdf_villages['village_co'], errors='coerce')
                    else:
                        selected_villages = [str(x) for x in selected_villages]
                        gdf_villages['village_co'] = gdf_villages['village_co'].astype(str)
                except Exception as e:
                    print(f"⚠️ Warning during village code conversion: {e}")
                    pass
                filtered_villages = gdf_villages[gdf_villages['village_co'].isin(selected_villages)]
                print(f"🔍 Filtering by village codes: {selected_villages}")
            else:
                # Convert SUBDIS_COD to match the type of selected_sub_districts
                try:
                    if selected_sub_districts and isinstance(selected_sub_districts[0], int):
                        gdf_villages['SUBDIS_COD'] = pd.to_numeric(gdf_villages['SUBDIS_COD'], errors='coerce')
                    else:
                        selected_sub_districts = [str(x) for x in selected_sub_districts]
                        gdf_villages['SUBDIS_COD'] = gdf_villages['SUBDIS_COD'].astype(str)
                except Exception as e:
                    print(f"⚠️ Warning during sub-district code conversion: {e}")
                    pass
                filtered_villages = gdf_villages[gdf_villages['SUBDIS_COD'].isin(selected_sub_districts)]
                print(f"🔍 Filtering by sub-districts: {selected_sub_districts}")

            if len(filtered_villages) == 0:
                error_msg = f"No villages found for selected {'village codes' if selected_villages else 'sub-districts'}: {selected_villages or selected_sub_districts}"
                return Response({
                    "success": False,
                    "error": error_msg
                }, status=status.HTTP_404_NOT_FOUND)

            print(f"🔍 Filtered to {len(filtered_villages)} villages")

            # Step 4: Ensure same CRS for both datasets (if wells exist)
            if gdf_wells is not None and filtered_villages.crs != gdf_wells.crs:
                filtered_villages = filtered_villages.to_crs(gdf_wells.crs)

            # Step 5: Create the map
            print("🗺️ Creating map visualization...")
            
            # Create figure and axis
            fig, ax = plt.subplots(1, 1, figsize=(15, 12))
            
            # Plot villages as polygons
            filtered_villages.plot(
                ax=ax,
                color='lightblue',
                edgecolor='blue',
                alpha=0.6,
                linewidth=1.5
            )
            
            # Plot wells as points (if available)
            if gdf_wells is not None:
                gdf_wells.plot(
                    ax=ax,
                    color='red',
                    markersize=50,
                    marker='o',
                    alpha=0.8
                )

            # Set map extent to show all data
            if gdf_wells is not None:
                combined_bounds = gdf_wells.total_bounds
                village_bounds = filtered_villages.total_bounds
                
                # Get overall bounds
                min_x = min(combined_bounds[0], village_bounds[0])
                min_y = min(combined_bounds[1], village_bounds[1]) 
                max_x = max(combined_bounds[2], village_bounds[2])
                max_y = max(combined_bounds[3], village_bounds[3])
            else:
                # Use only village bounds if no wells
                village_bounds = filtered_villages.total_bounds
                min_x, min_y, max_x, max_y = village_bounds
            
            # Add some padding
            padding = 0.01
            ax.set_xlim(min_x - padding, max_x + padding)
            ax.set_ylim(min_y - padding, max_y + padding)

            # Add basemap (optional - comment out if causing issues)
            try:
                ctx.add_basemap(
                    ax,
                    crs=filtered_villages.crs,                
                    source=ctx.providers.CartoDB.Voyager, 
                    alpha=0.7,                                         
                    zoom=10                            
                )
            except Exception as e:
                print(f"⚠️ Could not add basemap: {e}")

            # Customize the plot
            ax.set_title(
                f'Groundwater Assessment Study Area Map',
                fontsize=16,
                fontweight='bold',
                pad=20
            )
            ax.set_xlabel('LONGITUDE', fontsize=12)
            ax.set_ylabel('LATITUDE', fontsize=12)

            # Add legend
            from matplotlib.lines import Line2D
            legend_elements = []
            
            if gdf_wells is not None:
                legend_elements.append(
                    Line2D([0], [0], marker='o', color='w', markerfacecolor='red', markersize=10, label='Wells')
                )
            
            legend_elements.append(
                patches.Patch(facecolor='lightblue', edgecolor='blue', label='Villages')
            )
            
            ax.legend(handles=legend_elements, loc='upper right', fontsize=10)

            # Add grid
            ax.grid(True, alpha=0.3)
            
            # Tight layout
            plt.tight_layout()

            # Step 6: Save the map
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id = str(uuid.uuid4())[:8]
            image_filename = f"gwa_map_{timestamp}_{unique_id}.png"
            image_path = os.path.join(settings.MEDIA_ROOT, "temp", image_filename)

            # Ensure temp directory exists
            os.makedirs(os.path.dirname(image_path), exist_ok=True)

            # Save with high DPI for better quality
            plt.savefig(image_path, dpi=300, bbox_inches='tight', facecolor='white')
            plt.close()  # Close to free memory

            print(f"💾 Map saved to: {image_path}")
            
            # Step 7: Encode image as base64
            with open(image_path, "rb") as img_file:
                b64_string = base64.b64encode(img_file.read()).decode("utf-8")

            # Step 8: Prepare response
            statistics = {
                "villages_count": len(filtered_villages),
                "wells_count": len(gdf_wells) if gdf_wells is not None else 0,
            }
            if selected_villages:
                statistics["selected_villages"] = selected_villages
            else:
                statistics["selected_subdistricts"] = selected_sub_districts

            response_data = {
                "success": True,
                "message": "Map generated successfully",
                "data": {
                    "pdfId": unique_id,
                    "filename": image_filename,
                    "generatedAt": datetime.now().isoformat(),
                    "imageBase64": f"data:image/png;base64,{b64_string}",
                    "statistics": statistics,
                },
            }

            print("✅ Map generation completed successfully")
            return Response(response_data, status=status.HTTP_200_OK)

        except FileNotFoundError as e:
            print(f"❌ File not found: {e}")
            return Response({
                "success": False,
                "error": f"File not found: {str(e)}"
            }, status=status.HTTP_404_NOT_FOUND)

        except pd.errors.EmptyDataError:
            print("❌ CSV file is empty")
            return Response({
                "success": False,
                "error": "CSV file is empty or corrupted"
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                "success": False,
                "error": f"Internal server error: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)