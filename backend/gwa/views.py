from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from .models import Well
from .serializers import WellSerializer
from .interpolation import InterpolateRasterView
from .trend import GroundwaterTrendAnalysisView
from .forecast import GroundwaterForecastView
from .upload_temp import CSVUploadView
from .validate import CSVValidationView
from .trends import GroundwaterTrendAnalysisView
from django.conf import settings
from django.contrib.gis.gdal import DataSource
from django.contrib.gis.geos import GEOSGeometry
import os




class WellsAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request, format=None):
        # Accept both raw list and object payloads for backward compatibility
        if isinstance(request.data, list):
            village_codes = request.data
            subdis_codes = []
        else:
            village_codes = request.data.get('village_code', [])
            subdis_codes = request.data.get('subdis_cod', [])

        if not village_codes and not subdis_codes:
            return Response({"error": "village_code or subdis_cod is required"}, status=status.HTTP_400_BAD_REQUEST)

        wells = Well.objects.all()

        if village_codes:
            if isinstance(village_codes, int):
                village_codes = [village_codes]
            wells = wells.filter(village_code__in=village_codes)

        if subdis_codes:
            if isinstance(subdis_codes, int):
                subdis_codes = [subdis_codes]
            wells = wells.filter(SUBDIS_COD__in=subdis_codes)

        serial = WellSerializer(wells, many=True)
        sorted_data = sorted(serial.data, key=lambda x: x['HYDROGRAPH'])
        return Response(sorted_data, status=status.HTTP_200_OK)

    





class VillagesByCatchmentFileAPI(APIView):
    permission_classes = [AllowAny]

    def post(self, request, format=None):
        """
        Request JSON:
        {
          "catchment_no": 123
        }
        Response: list of villages (code, name) whose geometry intersects with the catchment polygon.
        """
        catchment_no = request.data.get("catchment_no", None)
        if catchment_no is None:
            return Response({"error": "catchment_no is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Shapefile paths in MEDIA
        catch_path = os.path.join(settings.MEDIA_ROOT, "gwa_data", "gwa_shp", "Catchments", "Catchment.shp")
        village_path = os.path.join(settings.MEDIA_ROOT, "gwa_data", "gwa_shp", "Final_Village", "Village.shp")

        # Verify files exist (and rely on .dbf/.shx/.prj being present alongside)
        if not os.path.exists(catch_path):
            return Response({"error": "Catchment.shp not found in MEDIA"}, status=status.HTTP_404_NOT_FOUND)
        if not os.path.exists(village_path):
            return Response({"error": "Village.shp not found in MEDIA"}, status=status.HTTP_404_NOT_FOUND)

        # Open shapefiles
        try:
            ds_c = DataSource(catch_path)
            ds_v = DataSource(village_path)
        except Exception as e:
            return Response({"error": f"Failed to open shapefiles: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Get layers
        try:
            layer_c = ds_c[0]  # First layer from catchment shapefile
            layer_v = ds_v[0]  # First layer from village shapefile
        except IndexError:
            return Response({"error": "No layers found in shapefiles"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Field names mapping
        CATCHMENT_NO_FIELD = "GRIDCODE"    # field in catchment.dbf
        VIL_CODE_FIELD = "village_co"      # field in village.dbf  
        NAME_FIELD = "shapeName"           # village name field

        # Step 1: Find the target catchment polygon by GRIDCODE
        target_catch = None
        try:
            for feat in layer_c:
                catchment_value = feat.get(CATCHMENT_NO_FIELD)
                if catchment_value is not None and str(catchment_value) == str(catchment_no):
                    target_catch = feat
                    break
        except Exception as e:
            return Response({"error": f"Error reading catchment features: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if target_catch is None:
            return Response({"error": f"Catchment with GRIDCODE {catchment_no} not found"}, status=status.HTTP_404_NOT_FOUND)

        # Step 2: Prepare catchment geometry
        try:
            c_geom_ogr = target_catch.geom
            if c_geom_ogr is None:
                return Response({"error": f"Catchment {catchment_no} has no geometry"}, status=status.HTTP_400_BAD_REQUEST)
            
            c_geom = GEOSGeometry(c_geom_ogr.wkt)
            
            # Set SRID for catchment geometry
            if c_geom_ogr.srs and c_geom_ogr.srs.srid:
                c_geom.srid = c_geom_ogr.srs.srid
            else:
                # Default to WGS84 if no SRID found
                c_geom.srid = 4326
                
        except Exception as e:
            return Response({"error": f"Failed to process catchment geometry: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        results = []

        # Step 3: Iterate through all villages and check spatial relationship
        try:
            for v_feat in layer_v:
                try:
                    # Get village geometry
                    v_geom_ogr = v_feat.geom
                    if v_geom_ogr is None:
                        continue  # Skip villages without geometry
                    
                    v_geom = GEOSGeometry(v_geom_ogr.wkt)
                    
                    # Set SRID for village geometry
                    if v_geom_ogr.srs and v_geom_ogr.srs.srid:
                        v_geom.srid = v_geom_ogr.srs.srid
                    else:
                        v_geom.srid = c_geom.srid  # Use catchment SRID as fallback
                    
                    # Transform coordinates if SRIDs don't match
                    if v_geom.srid != c_geom.srid:
                        try:
                            v_geom.transform(c_geom.srid)
                        except Exception:
                            continue  # Skip if transformation fails
                    
                    # Step 4: Spatial intersection test
                    # Check if village polygon intersects with catchment polygon
                    if v_geom.intersects(c_geom):
                        # Get village attributes
                        village_code = v_feat.get(VIL_CODE_FIELD)
                        village_name = v_feat.get(NAME_FIELD)
                        
                        # Create result item
                        item = {
                            "village_code": village_code if village_code is not None else "Unknown",
                            "name": village_name if village_name is not None else f"Village_{village_code or 'Unknown'}"
                        }
                        results.append(item)
                        
                except Exception as e:
                    # Log error but continue processing other villages
                    print(f"Error processing village feature: {str(e)}")
                    continue
                    
        except Exception as e:
            return Response({"error": f"Error processing village features: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Step 5: Return results
        return Response({
            "catchment_no": catchment_no,
            "total_villages": len(results),
            "villages": results
        }, status=status.HTTP_200_OK)