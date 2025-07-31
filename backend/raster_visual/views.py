from .models import RasterVisual
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class rasters_get(APIView):
    def get(self,request,format=None):
        raster_objects = RasterVisual.objects.values_list('organisation', flat=True).distinct()
        resp=[{"id":val+1,"name":x} for val,x in enumerate(raster_objects)]
        return Response(resp,status=status.HTTP_200_OK)

    def post(self,request,format=None):
        org=request.data['organisation']
        print("org",org)
        resp = RasterVisual.objects.values_list('name', flat=True).filter(organisation=org)
        resp=[{"id":val+1,"name":x} for val,x in enumerate(resp)]
        return Response(resp,status=status.HTTP_200_OK)

