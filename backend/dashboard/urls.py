# backend/dashboard/urls.py

from django.urls import path
from . import views
from . import dynamic_rivers_api

urlpatterns = [
   path('main', views.get_drain_water_quality, name='drain_water_quality'),
    path('rivers/scan', dynamic_rivers_api.scan_available_rivers, name='scan_rivers'),
    path('rivers/geojson/<str:river_name>', dynamic_rivers_api.get_river_geojson, name='get_river_geojson'),
    path('rivers/styles', dynamic_rivers_api.get_river_styles, name='get_river_styles'),
    path('rivers/refresh', dynamic_rivers_api.refresh_rivers, name='refresh_rivers'),
    path('rivers/test', dynamic_rivers_api.test_rivers_setup, name='test_rivers_setup'),
    
]