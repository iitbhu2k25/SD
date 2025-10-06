import os
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from django.conf import settings

# Import GeoPandas with error handling
try:
    import geopandas as gpd
    import pandas as pd
    from shapely.geometry import Point
except ImportError as e:
    raise ImportError(
        "GeoPandas and its dependencies are required but not installed. "
        "Run: pip install geopandas"
    ) from e


class VillagesByCatchmentFileAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request, format=None):
        # Validate input
        drain_no = request.data.get("Drain_No", None)
        if drain_no is None:
            return Response(
                {"error": "Drain_No is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Define file paths
        catch_path = os.path.join(
            settings.MEDIA_ROOT, 
            "gwa_data", 
            "gwa_shp", 
            "Catchments", 
            "Catchment.shp"
        )
        village_path = os.path.join(
            settings.MEDIA_ROOT, 
            "gwa_data", 
            "gwa_shp", 
            "Final_Village", 
            "Village.shp"
        )

        # Check if files exist
        if not os.path.exists(catch_path):
            return Response(
                {"error": f"Catchment.shp not found at: {catch_path}"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        if not os.path.exists(village_path):
            return Response(
                {"error": f"Village.shp not found at: {village_path}"}, 
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            # Read shapefiles and convert to WGS84
            print(f"Reading catchment file: {catch_path}")
            catchment_gdf = gpd.read_file(catch_path)
            
            print(f"Reading village file: {village_path}")
            village_gdf = gpd.read_file(village_path)
            
            # Convert to consistent CRS (WGS84)
            catchment_gdf = catchment_gdf.to_crs("EPSG:4326")
            village_gdf = village_gdf.to_crs("EPSG:4326")
            
            print(f"Catchment columns: {list(catchment_gdf.columns)}")
            print(f"Village columns: {list(village_gdf.columns)}")
            
        except Exception as e:
            return Response(
                {"error": f"Failed to read shapefiles: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            # Filter catchment using Drain_No
            selected_catchment = catchment_gdf[
                catchment_gdf['Drain_No'].astype(str) == str(drain_no)
            ]
            
            if selected_catchment.empty:
                return Response(
                    {"error": f"Catchment with Drain_No {drain_no} not found"}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            print(f"Found catchment for Drain_No: {drain_no}")
            
        except KeyError:
            # Handle case where 'Drain_No' column doesn't exist
            available_columns = list(catchment_gdf.columns)
            return Response(
                {
                    "error": f"Column 'Drain_No' not found in catchment shapefile. "
                             f"Available columns: {available_columns}"
                }, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to filter catchment: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        try:
            # Perform spatial join to find villages that intersect with catchment
            # Changed from 'within' to 'intersects' to capture villages with any overlap
            villages_intersecting = gpd.sjoin(
                village_gdf, 
                selected_catchment, 
                predicate='intersects',  # This will capture villages with any overlap
                how='inner'
            )
            
            # Remove duplicates based on village code
            villages_intersecting = villages_intersecting.drop_duplicates(subset=['village_co'])
            
            print(f"Found {len(villages_intersecting)} villages intersecting with catchment")
            
            # Build results with additional information about intersection
            results = []
            for _, row in villages_intersecting.iterrows():
                village_code = row.get('village_co', 'Unknown')
                village_name = row.get('shapeName', f"Village_{village_code}")
                
                # Calculate intersection area percentage (optional - for analysis)
                try:
                    village_geom = row['geometry']
                    catchment_geom = selected_catchment.iloc[0]['geometry']
                    intersection_area = village_geom.intersection(catchment_geom).area
                    village_total_area = village_geom.area
                    overlap_percentage = (intersection_area / village_total_area * 100) if village_total_area > 0 else 0
                except Exception as calc_error:
                    overlap_percentage = None
                    print(f"Could not calculate overlap for village {village_code}: {calc_error}")
                
                village_data = {
                    "village_code": village_code,
                    "name": village_name,
                }
                
                # Add overlap percentage if calculated successfully
                if overlap_percentage is not None:
                    village_data["overlap_percentage"] = round(overlap_percentage, 2)

                results.append(village_data)

        except KeyError as e:
            # Handle missing columns in village shapefile
            available_columns = list(village_gdf.columns)
            return Response(
                {
                    "error": f"Required column missing in village shapefile: {str(e)}. "
                             f"Available columns: {available_columns}"
                }, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Failed to compute villages intersecting with catchment: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        # Return successful response
        return Response({
            "drain_no": drain_no,
            "total_villages": len(results),
            "villages": results,
            "note": "Includes all villages that have any intersection with the catchment boundary"
        }, status=status.HTTP_200_OK)


    def get(self, request, format=None):
        """
        Optional GET endpoint to check if the API is working
        and list available drain numbers
        """
        try:
            catch_path = os.path.join(
                settings.MEDIA_ROOT, 
                "gwa_data", 
                "gwa_shp", 
                "Catchments", 
                "Catchment.shp"
            )
            
            if not os.path.exists(catch_path):
                return Response(
                    {"error": f"Catchment.shp not found at: {catch_path}"}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            catchment_gdf = gpd.read_file(catch_path)
            
            if 'Drain_No' in catchment_gdf.columns:
                drain_numbers = sorted(catchment_gdf['Drain_No'].unique().tolist())
                return Response({
                    "message": "API is working",
                    "available_drain_numbers": drain_numbers,
                    "total_catchments": len(drain_numbers)
                })
            else:
                return Response({
                    "message": "API is working",
                    "error": "Drain_No column not found",
                    "available_columns": list(catchment_gdf.columns)
                })
                
        except Exception as e:
            return Response(
                {"error": f"Failed to check available drain numbers: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )