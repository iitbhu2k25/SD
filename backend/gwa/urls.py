from django.urls import path
from .views import VillagesByCatchmentFileAPI, WellsAPI
from .interpolation import InterpolateRasterView
from .trend import GroundwaterTrendAnalysisView
from .forecast import GroundwaterForecastView
from .upload_temp import CSVUploadView
from .validate import CSVValidationView
from .trends import GroundwaterTrendAnalysisView
# from interpolation import InterpolateRasterView

urlpatterns = [
    path('wells', WellsAPI.as_view(), name='wells-api'),
    path('interpolation', InterpolateRasterView.as_view(), name='interpolation'),
    # path('trend', GroundwaterTrendAnalysisView.as_view(), name='trend'),
    path('forecast', GroundwaterForecastView.as_view(), name='forecast'),
    path('upload-csv', CSVUploadView.as_view(), name='upload-csv'),
    path('validate-csv', CSVValidationView.as_view(), name='validate-csv'),
    path('trends', GroundwaterTrendAnalysisView.as_view(), name='trends'),
    path('villagescatchment', VillagesByCatchmentFileAPI.as_view(), name="villages-by-catchment-file"),
]