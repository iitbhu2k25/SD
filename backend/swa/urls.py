from django.urls import path
from .views import Subbasin, SubbasinStudyAreaMap
from .views import FlowDurationCurveAPI
from .surfacewater import SurplusRunoffAPI
from .eflow import EflowAPI
from .climate import ClimateChangeView, ClimateScenarioComparisonView
from .admin import VillageFlowDurationCurveAPI, VillageSurplusAPI, AdmineflowAPI, ClimateAdminView
from .admin import AdmineflowImageAPI, VillageSurplusImageAPI, VillageFlowDurationCurveImageAPI, ClimateAdminImageView
urlpatterns = [
    path("subbasin", Subbasin.as_view(), name="subbasin-detail"),
     path('generate-subbasin-map', SubbasinStudyAreaMap.as_view(), name='generate-subbasin-map'),
     path("fdc", FlowDurationCurveAPI.as_view(), name="fdc-api"),
     path("surfacewater", SurplusRunoffAPI.as_view(), name="surfacewater-api"),
     path("eflow", EflowAPI.as_view(), name="eflow-api"),
     path('climate', ClimateChangeView.as_view(), name='climate-change'),
     path('climate/comparison', ClimateScenarioComparisonView.as_view(), name='climate-comparison'),
     path("adminfdc", VillageFlowDurationCurveAPI.as_view(), name="fdc-api"),
     path("adminfdcimage", VillageFlowDurationCurveImageAPI.as_view(), name="fdcimage-api"),
     path("adminsurfacewater", VillageSurplusAPI.as_view(), name="surfacewater-api"),
     path("adminsurfacewaterimage", VillageSurplusImageAPI.as_view(), name="surfacewaterimage-api"),
     path("eflowadmin", AdmineflowAPI.as_view(), name="admineflow"),
     path("eflowadminimage", AdmineflowImageAPI.as_view(), name="admineflowimage"),
     path("adminclimate", ClimateAdminView.as_view(), name="adminclimate"),
     path("adminclimateimage", ClimateAdminImageView.as_view(), name="adminclimateimage"),
]
