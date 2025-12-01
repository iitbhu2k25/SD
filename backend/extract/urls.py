from django.urls import path
from .rainfall import *
from .waterlevel import *


urlpatterns = [
    path('state/rainfall/daily', RainfallGeoJSONAPIView.as_view(), name='rainfall-daily-geojson'),
    path('state/rainfall/weekly', WeeklyRainfallGeoJSONAPIView.as_view(), name='rainfall-weekly-geojson'),
    path('state/rainfall/monthly', MonthlyRainfallGeoJSONAPIView.as_view(), name='rainfall-monthly-geojson'),
    path('state/rainfall/cumulative', MonthlyRainfallGeoJSONAPIView.as_view(), name='rainfall-cummulative-geojson'),
    path('district/rainfall/daily',  DistrictDailyRainfallAPIView.as_view(), name='district-rainfall-daily'),
    path('district/rainfall/weekly', DistrictWeeklyRainfallGeoJSONAPIView.as_view(), name='district-rainfall-weekly'),
    path('district/rainfall/monthly', DistrictMonthlyRainfallGeoJSONAPIView.as_view(), name='district-rainfall-monthly'),
    path('district/rainfall/cumulative', DistrictCumulativeRainfallGeoJSONAPIView.as_view(), name='district-rainfall-cumulative'),
    path('rainfall_stats/statewise', StatewiseDistributionAPIView.as_view(), name='statewise-rainfall-distribution'),
    path('rainfall_stats/statewiseDC', StatewiseDistributionDailyCummAPIView.as_view(), name='statewiseDC-rainfall-distribution'),
    path('rainfall_stats/district/weekcumm', DistrictWeekCummulativeAPIView.as_view(), name='district-week-cumm-rainfall_stats'),
    path('rainfall_stats/district/weekly', DistrictWeeklyAPIView.as_view(), name='district-weekly-rainfall_stats'),
    path('rainfall_stats/district/D&C', DistrictDailyCummAPIView.as_view(), name='district-weekly-cummulative_stats'),
    path('rainfall/riverbasin/day1', RiverBasinAPIView.as_view(), {'day': 'Day1'}, name='rainfall-riverbasin-day1'),
    path('rainfall/riverbasin/day2', RiverBasinAPIView.as_view(), {'day': 'Day2'}, name='rainfall-riverbasin-day2'),
    path('rainfall/riverbasin/day3', RiverBasinAPIView.as_view(), {'day': 'Day3'}, name='rainfall-riverbasin-day3'),
    path('rainfall/riverbasin/day4', RiverBasinAPIView.as_view(), {'day': 'Day4'}, name='rainfall-riverbasin-day4'),
    path('rainfall/riverbasin/day5', RiverBasinAPIView.as_view(), {'day': 'Day5'}, name='rainfall-riverbasin-day5'),
    path('rainfall/riverbasin/day6', RiverBasinAPIView.as_view(), {'day': 'Day6'}, name='rainfall-riverbasin-day6'),
    path('rainfall/riverbasin/day7', RiverBasinAPIView.as_view(), {'day': 'Day7'}, name='rainfall-riverbasin-day7'),
    path('rainfall/riverbasin/aap', RiverBasinAPIView.as_view(), {'day': 'AAP'}, name='rainfall-riverbasin-aap'),
    path('water-level', WaterLevelAPIView.as_view(), name='water-level'),
    path('level', HGStationDataAPIView.as_view(), name='level'),
]