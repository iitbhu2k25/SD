from django.urls import path,re_path
from . import views

urlpatterns = [
    path('water_quality', views.water_quality_data, name='water_quality'),
    path('shapefile', views.shapefile_data, name='shapefile_data'),
    # path('shapefile_filtered/', views.shapefile_data_filtered, name='shapefile_data_filtered'),
    path('water_quality/<str:data_type>/<str:season>', views.water_quality_data, name='water_quality_data_typed'), # Static data for charts
    path('shapefile/<str:data_type>/<str:season>', views.shapefile_data, name='shapefile_data_typed'), # Dynamic data for map
    # path('shapefile_filtered/<str:data_type>/', views.shapefile_data_filtered, name='shapefile_data_filtered_typed'),
    path('river_100m_buffer/<str:data_type>', views.River_100m_buffer, name='river_100m_buffer'),
    path('river', views.River, name='river'),
    path('interpolate/<str:attribute>/<str:data_type>/<str:season>', views.optimized_idw_interpolation, name='idw_interpolation'),
    path('clipped_subdist', views.clipped_subdistrict, name='clipped_subdistrict'),
    path('subdistricts', views.get_subdistricts, name='subdistricts'),
    path('stretches', views.get_stretches, name='stretch-list'),
    path('stretch_lines', views.load_stretch_linesAPI, name='stretch-lines'),
    path('test_geoserver', views.test_geoserver_connection, name='test_geoserver'),
    path('health/geoserver', views.geoserver_health_check, name='geoserver_health'),


# DIRECT PDF REPORT ROUTE (temporarily disabled)
    # path('download-pdf-report', views.download_pdf_report_data, name='download_pdf_report_data'),

# ASYNC PDF ROUTES
    path('start-pdf-report', views.start_pdf_report_job, name='start_pdf_report_job'),
    path('job-status/<str:job_id>', views.get_job_status, name='get_job_status'),
    path('job-result/<str:job_id>', views.get_job_result, name='get_job_result'),
    path("cancel-job/<str:job_id>", views.cancel_job, name='cancel_job'),

# GENERAL RIVER UPLOAD API
    path('general/upload', views.upload_river_shapefile, name='upload_river_shapefile'),
    path('general/upload-csv', views.upload_wqi_csv, name='upload_wqi_csv'),
    path('general/wqi-params', views.get_wqi_params_info, name='get_wqi_params_info'),
    path('general/interpolate-wqi', views.general_interpolate_wqi, name='general_interpolate_wqi'),
    path('general/download-raster', views.general_download_raster, name='general_download_raster'),
    path('wqi-profile', views.admin_wqi_profile, name='admin_wqi_profile'),
]


