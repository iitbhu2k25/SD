# backend/dashboard/urls.py - COMPLETE AND CORRECTED FILE

from django.urls import path
from . import views
from . import dynamic_rivers_api

urlpatterns = [
    # ============================================
    # STORY MAP ENDPOINTS - ADD THESE FIRST!
    # ============================================
    path('story-map/stations', 
         views.get_story_map_stations, 
         name='story_map_stations'),
    path('story-map/stations/<str:station_id>', 
         views.get_story_map_station_detail, 
         name='story_map_station_detail'),
    path('story-map/statistics', 
         views.get_story_map_statistics, 
         name='story_map_statistics'),
    
    # ============================================
    # DRAIN WATER QUALITY ENDPOINTS
    # ============================================
    path('main', 
         views.get_drain_water_quality, 
         name='drain_water_quality'),
#     path('depth',
#          views.get_dashboard_depth,
#          name='dashboard_depth'),
    path('depth',
         views.get_dashboard_depth,
         name='dashboard_depth_slash'),
#     path('dashboard-depth',
#          views.get_dashboard_depth,
#          name='dashboard_depth_alias'),
#     path('rainfall',
#          views.get_dashboard_rainfall,
#          name='dashboard_rainfall'),
    path('rainfall',
         views.get_dashboard_rainfall,
         name='dashboard_rainfall_slash'),
#     path('dashboard-rainfall',
#          views.get_dashboard_rainfall,
#          name='dashboard_rainfall_alias'),
#     path('distribution',
#          views.get_dashboard_distribution,
#          name='dashboard_distribution'),
    path('distribution',
         views.get_dashboard_distribution,
         name='dashboard_distribution_slash'),
#     path('dashboard-distribution',
#          views.get_dashboard_distribution,
#          name='dashboard_distribution_alias'),
#     path('industrial',
#          views.get_dashboard_industrial_pollution,
#          name='dashboard_industrial_pollution'),
    path('industrial',
         views.get_dashboard_industrial_pollution,
         name='dashboard_industrial_pollution_slash'),
#     path('dashboard-industrial',
#          views.get_dashboard_industrial_pollution,
#          name='dashboard_industrial_pollution_alias'),
    
    # ============================================
    # RIVERS ENDPOINTS
    # ============================================
    path('rivers/scan', 
         dynamic_rivers_api.scan_available_rivers, 
         name='scan_rivers'),
    path('rivers/geojson/<str:river_name>', 
         dynamic_rivers_api.get_river_geojson, 
         name='get_river_geojson'),
    path('rivers/styles', 
         dynamic_rivers_api.get_river_styles, 
         name='get_river_styles'),
    path('rivers/refresh', 
         dynamic_rivers_api.refresh_rivers, 
         name='refresh_rivers'),
    path('rivers/test', 
         dynamic_rivers_api.test_rivers_setup, 
         name='test_rivers_setup'),
    
    # ============================================
    # SEWAGE INFRASTRUCTURE ENDPOINTS
    # ============================================
    path('sewage-infrastructure/geojson/<str:layer_name>', 
         views.get_sewage_infrastructure_geojson, 
         name='get_sewage_geojson'),
    path('sewage-infrastructure/layers', 
         views.get_available_layers, 
         name='get_available_layers'),
    path('sewage-infrastructure/statistics', 
         views.get_layer_statistics, 
         name='get_layer_statistics'),
    path('sewage-infrastructure/details/<str:layer_name>', 
         views.get_layer_details, 
         name='get_layer_details'),
]
