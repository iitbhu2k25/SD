from django.urls import path
from .views import (
    WellsView, 
    WellsByVillageView,
    validate_csv, 
    upload_csv, 
    AvailableYearsView, 
    WellStatsView,
    GenerateGWQIReportView,
    VillageAnalysisView,
    CleanupSessionView
)
# REMOVED: from .interpolation import CSVInterpolationView
from .gwqi import GWQIOverlayView
#from .analysis import GroundwaterQualityAnalysisView
from .catchment import VillagesByCatchmentFileAPI

urlpatterns = [
    # Wells API with year support (for admin system - by subdistrict)
    path('wells', WellsView.as_view(), name='wells-api'),
    
    # Wells API for drain system (village-based from gwa_well table)
    path('wells-by-village', WellsByVillageView.as_view(), name='wells-by-village'),
    
    # Year-related APIs
    path('available-years', AvailableYearsView.as_view(), name='available-years'),
    path('well-stats', WellStatsView.as_view(), name='well-stats'),
    
    # Analysis and GWQI
   # path('analysis/', GroundwaterQualityAnalysisView.as_view(), name='gwqi-analysis'),
    path('gwqi_overlay', GWQIOverlayView.as_view(), name='gwqi_overlay'),
    
    # PDF Report Generation
    path('generate_gwqi_report', GenerateGWQIReportView.as_view(), name='generate_gwqi_report'),
    
    # On-demand Village Analysis
    path('village_analysis', VillageAnalysisView.as_view(), name='village_analysis'),
    
    # Session Management
    path('cleanup_session', CleanupSessionView.as_view(), name='cleanup_session'),
    
    # CSV handling
    path('validate-csv', validate_csv, name='validate-csv'),
    path('upload-csv', upload_csv, name='upload-csv'),
    
    # Village catchment (for drain system)
    path('villagescatchment', VillagesByCatchmentFileAPI.as_view(), name="villages-by-catchment-file"),
    
]