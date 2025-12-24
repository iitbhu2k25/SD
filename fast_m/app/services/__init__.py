# app/services/__init__.py
from .trend_service import TrendService
from .recharge_service import RechargeService
from .population_service import PopulationService
from .stress_identification_service import StressIdentificationService
from .forecast_service import ForecastService
from .interpolation_service import InterpolationService
from .industrial_service import IndustrialForecastService
from .pdf_service import PDFMapService
from .admin_unit_service import fetch_admin_units_from_villages

__all__ = [
    "PopulationService",
    "RechargeService",
    "StressIdentificationService",
    "ForecastService",
    "InterpolationService",
    "TrendService",
    "PDFMapService",
    "IndustrialForecastService",
    "fetch_admin_units_from_villages"
    
]

