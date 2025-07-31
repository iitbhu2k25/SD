from django.urls import path
from .views import rasters_get
urlpatterns = [
    path('categories/',rasters_get.as_view(),name="raster_categories"),
]
