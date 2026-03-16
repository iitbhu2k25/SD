# mapplot/urls.py (app level)
from django.urls import path #type: ignore
from .views import ShapefileDataAPI, ShapefileDirectoryView, UploadShapefile
from .enhanced_spatial_api import SpatialProcessAPIView, SpatialOperationsListView
from .export import ExportMapPDFView, ExportMapPNGView, GeoJSONToShapefileView
from .spatial_queries_api import SpatialQueryAPIView, SpatialQueryTypesView
from .views_upload_sse import UploadShapefileSSE

urlpatterns = [
    # Spatial analysis endpoints
    path('spatial/process', SpatialProcessAPIView.as_view(), name='spatial_process'),
    path('spatial/operations', SpatialOperationsListView.as_view(), name='spatial_operations'),
    path('spatial/query',       SpatialQueryAPIView.as_view(),   name='spatial_query'),
    path('spatial/query/types', SpatialQueryTypesView.as_view(), name='spatial_query_types'),
    
    # Shapefile endpoints - CORRECTED PATHS
    path('shapefiles', ShapefileDirectoryView.as_view(), name='shapefile_directory'),
    path('get_shapefile', ShapefileDataAPI.as_view(), name='get_shapefile'),
    path('upload-shapefile', UploadShapefileSSE.as_view(), name='upload_shapefile'),

    # Export endpoints
    path('export/png', ExportMapPNGView.as_view(), name='export-png'),
    path('export/pdf', ExportMapPDFView.as_view(), name='export-pdf'),
    path('export/shapefile', GeoJSONToShapefileView.as_view(), name='export-shapefile'),
]