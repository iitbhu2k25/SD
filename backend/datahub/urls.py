from django.urls import path
from .views import ShapefileListAPIView

urlpatterns = [
    path('shapefiles', ShapefileListAPIView.as_view(), name='shapefile-list'),
]
