from django.urls import path
from .views import VillagesByCatchmentFileAPI, WellsAPI
from .interpolation import InterpolateRasterView
from .trend import GroundwaterTrendAnalysisView
from .forecast import GroundwaterForecastView
from .upload_temp import CSVUploadView
from .validate import CSVValidationView
from .trends import GroundwaterTrendAnalysisView
from .catchment import VillagesByCatchmentFileAPI
from .recharge2 import GroundwaterRechargeView
from .views import PopulationForecastAPI
from .crops import GetCropsBySeasonView
from .agriculture import AgriculturalDemandAPIView
from .gsr import GSRComputeAPIView
from .stress import StressIdentificationAPIView
from .pdf import PDFGenerationView
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
    path('recharge2', GroundwaterRechargeView.as_view(), name='recharge'),
    path("forecast-population", PopulationForecastAPI.as_view(), name="forecast-population"),
    path('crops', GetCropsBySeasonView.as_view(), name='crops'),
    path('agricultural', AgriculturalDemandAPIView.as_view(), name='agricultural'),
    path('gsr', GSRComputeAPIView.as_view(), name='gsr'),
    path('stress', StressIdentificationAPIView.as_view(), name='stress'),
    path ('pdf', PDFGenerationView.as_view(), name='pdf'),
]