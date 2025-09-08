from django.urls import path
from .views import Subbasin
from .views import FlowDurationCurveAPI

urlpatterns = [
    path("subbasin", Subbasin.as_view(), name="subbasin-detail"),
     path("fdc", FlowDurationCurveAPI.as_view(), name="fdc-api"),
]
