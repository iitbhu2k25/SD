from Basic.models import Basic_state, Basic_district, Basic_subdistrict, Basic_village, Population_2011
from Basic.serializers import StateSerializer, DistrictSerializer, SubDistrictSerializer, VillageSerializer
from django.http import Http404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import math
from .service import *
from django.db.models import Sum, Q
from .models import PopulationCohort
from django.http import JsonResponse
import os
import json
import geopandas as gpd
import pandas as pd 
from django.conf import settings
import traceback
import logging
from rest_framework.permissions import AllowAny 

logger = logging.getLogger(__name__)


class Locations_stateAPI(APIView):
    permission_classes = [AllowAny] 
    def get(self, request, format=None):
        states = Basic_state.objects.all()
        serial = StateSerializer(states, many=True)
        sorted_data = sorted(serial.data, key=lambda x: x['state_name'])
        return Response(sorted_data, status=status.HTTP_200_OK)
    
class Locations_districtAPI(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        district = Basic_district.objects.all().filter(state_code=request.data['state_code'])
        serial = DistrictSerializer(district, many=True)
        sorted_data = sorted(serial.data, key=lambda x: x['district_name'])
        return Response(sorted_data, status=status.HTTP_200_OK)
    
class Locations_subdistrictAPI(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        print(request.data['district_code'])
        subdistrict = Basic_subdistrict.objects.all().filter(district_code__in=request.data['district_code'])
        serial = SubDistrictSerializer(subdistrict, many=True)
        sorted_data = sorted(serial.data, key=lambda x: x['subdistrict_name'])
        return Response(sorted_data, status=status.HTTP_200_OK)

class Locations_villageAPI(APIView):
    permission_classes = [AllowAny]  
    def post(self, request, format=None):
        village = Basic_village.objects.all().filter(subdistrict_code__in=request.data['subdistrict_code'])
        serial = VillageSerializer(village, many=True)
        sorted_data = sorted(serial.data, key=lambda x: x['village_name'])
        return Response(sorted_data, status=status.HTTP_200_OK)

class Demographic(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        
        base_year = 2011
        # Get data from request
        print('request_data is ',request.data)
        single_year = request.data['year']
        start_year = request.data['start_year']
        end_year = request.data['end_year']
        villages = request.data['villages_props']
        subdistrict = request.data['subdistrict_props']
        total_population = request.data['totalPopulation_props']
        demographic = request.data['demographic']

        print(f"demographic {demographic}")
        annual_birth_rate = demographic['birthRate']
        annual_death_rate = demographic['deathRate']
        annual_emigration_rate = demographic['emigrationRate']
        annual_immigration_rate = demographic['immigrationRate']

        annual_birth_rate = annual_birth_rate/10000
        annual_death_rate = annual_death_rate/10000
        annual_emigration_rate = annual_emigration_rate/10000
        annual_immigration_rate = annual_immigration_rate/10000
        

        # Correcting the subdistrict_id of the villages coming from frontend 
        # Fetch all villages from the database
        village_data = Basic_village.objects.values('village_code', 'subdistrict_code')
        # Create a mapping of village_code to subdistrict_code
        village_mapping = {v['village_code']: v['subdistrict_code'] for v in village_data}
        # Update the villages list with the correct subDistrictId
        for village in villages:
            village_code = village['id']
            if village_code in village_mapping:
                village['subDistrictId'] = village_mapping[village_code]

        main_output={}

        if single_year:
            main_output['demographic'] = Demographic_population_single_year(base_year,single_year,villages,subdistrict,annual_birth_rate,annual_death_rate,annual_emigration_rate,annual_immigration_rate)  
              
        elif start_year and end_year:
            main_output['demographic'] = Demographic_population_range(base_year, start_year, end_year, villages, subdistrict, annual_birth_rate, annual_death_rate, annual_emigration_rate, annual_immigration_rate) 
        print("output",main_output)
        return Response(main_output, status=status.HTTP_200_OK)    

class Time_series(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        base_year = 2011
        # Get data from request
        print('request_data is ',request.data)
        single_year = request.data['year']
        start_year = request.data['start_year']
        end_year = request.data['end_year']
        villages = request.data['villages_props']
        subdistrict = request.data['subdistrict_props']
        total_population = request.data['totalPopulation_props']
        

        # Correcting the subdistrict_id of the villages coming from frontend 
        # Fetch all villages from the database
        village_data = Basic_village.objects.values('village_code', 'subdistrict_code')
        # Create a mapping of village_code to subdistrict_code
        village_mapping = {v['village_code']: v['subdistrict_code'] for v in village_data}
        # Update the villages list with the correct subDistrictId
        for village in villages:
            village_code = village['id']
            if village_code in village_mapping:
                village['subDistrictId'] = village_mapping[village_code]




        main_output={}
        if single_year:
            main_output['Arithmetic']=Arithmetic_population_single_year(base_year,single_year,villages,subdistrict)
            main_output['Geometric']=Geometric_population_single_year(base_year,single_year,villages,subdistrict)
            main_output['Incremental']=Incremental_population_single_year(base_year,single_year,villages,subdistrict)
            main_output['Exponential']=Exponential_population_single_year(base_year,single_year,villages,subdistrict)

        elif start_year and end_year:
            main_output['Arithmetic']=Arithmetic_population_range(base_year,start_year,end_year,villages,subdistrict)  
            main_output['Geometric']=Geometric_population_range(base_year,start_year,end_year,villages,subdistrict)
            main_output['Incremental']=Incremental_population_range(base_year,start_year,end_year,villages,subdistrict)
            main_output['Exponential']=Exponential_population_range(base_year,start_year,end_year,villages,subdistrict)
        else:
            pass
        print("output",main_output)
        return Response(main_output, status=status.HTTP_200_OK)

class SewageCalculation(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        method = request.data.get('method')
        if method == 'water_supply':
            try:
                total_supply = float(request.data.get('total_supply'))
            except (TypeError, ValueError):
                return Response({"error": "Invalid total supply"}, status=status.HTTP_400_BAD_REQUEST)
            if total_supply <= 0:
                return Response({"error": "Total supply must be greater than zero"}, status=status.HTTP_400_BAD_REQUEST)
            sewage_demand = total_supply * 0.84  # example formula
            return Response({"sewage_demand": sewage_demand}, status=status.HTTP_200_OK)
        elif method == 'domestic_sewage':
            load_method = request.data.get('load_method')
            if load_method == 'manual':
                try:
                    domestic_supply = float(request.data.get('domestic_supply'))
                except (TypeError, ValueError):
                    return Response({"error": "Invalid domestic supply"}, status=status.HTTP_400_BAD_REQUEST)
                if domestic_supply <= 0:
                    return Response({"error": "Domestic supply must be greater than zero"}, status=status.HTTP_400_BAD_REQUEST)
                sewage_demand = domestic_supply * 0.84  # example formula
                return Response({"sewage_demand": sewage_demand}, status=status.HTTP_200_OK)
            elif load_method == 'modeled':
                computed_population = request.data.get('computed_population')
                try:
                    unmetered = float(request.data.get('unmetered_supply', 0))
                except (TypeError, ValueError):
                    unmetered = 0
                if not computed_population:
                    return Response({"error": "Computed population data not provided."}, status=status.HTTP_400_BAD_REQUEST)
                result = {}
                for year, pop in computed_population.items():
                    try:
                        pop_val = float(pop)
                    except (TypeError, ValueError):
                        continue
                    multiplier = (135 + unmetered) / 1000000
                    sewage_gen = pop_val * multiplier * 0.80  # example formula
                    result[year] = sewage_gen
                return Response({"sewage_result": result}, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Invalid domestic load method"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "Invalid sewage method"}, status=status.HTTP_400_BAD_REQUEST)
        
class WaterSupplyCalculationAPI(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        data = request.data
        try:
            surface_water = float(data.get("surface_water", 0))
            direct_groundwater = data.get("direct_groundwater")
            if direct_groundwater not in [None, ""]:
                direct_groundwater = float(direct_groundwater)
            else:
                direct_groundwater = 0 # set to 0 if not provided  and before it is None

            num_tubewells = data.get("num_tubewells")
            num_tubewells = float(num_tubewells) if num_tubewells not in [None, ""] else 0

            discharge_rate = data.get("discharge_rate")
            discharge_rate = float(discharge_rate) if discharge_rate not in [None, ""] else 0

            operating_hours = data.get("operating_hours")
            operating_hours = float(operating_hours) if operating_hours not in [None, ""] else 0

            direct_alternate = data.get("direct_alternate")
            if direct_alternate not in [None, ""]:
                direct_alternate = float(direct_alternate)
            else:
                direct_alternate = 0 # set to 0 if not provided and before it is None

            rooftop_tank = data.get("rooftop_tank")
            rooftop_tank = float(rooftop_tank) if rooftop_tank not in [None, ""] else 0

            aquifer_recharge = data.get("aquifer_recharge")
            aquifer_recharge = float(aquifer_recharge) if aquifer_recharge not in [None, ""] else 0

            surface_runoff = data.get("surface_runoff")
            surface_runoff = float(surface_runoff) if surface_runoff not in [None, ""] else 0

            reuse_water = data.get("reuse_water")
            reuse_water = float(reuse_water) if reuse_water not in [None, ""] else 0

            if direct_groundwater > 0 and (num_tubewells > 0 or discharge_rate > 0 or operating_hours > 0):     # changes made here  before 'is not None' 
                return Response(
                    {"error": "Provide either direct groundwater supply or tube well inputs, not both."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if direct_alternate > 0 and (rooftop_tank > 0 or aquifer_recharge > 0 or surface_runoff > 0 or reuse_water > 0):    # changes made here  before 'is not None' 
                return Response(
                    {"error": "Provide either direct alternate supply or alternate component inputs, not both."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if direct_groundwater > 0:  # changes made here before 'is not None' 
                groundwater_supply = direct_groundwater
            else:
                groundwater_supply = num_tubewells * discharge_rate * operating_hours

            if direct_alternate > 0: # changes made here before 'is not None' 
                alternate_supply = direct_alternate
            else:
                alternate_supply = rooftop_tank + aquifer_recharge + surface_runoff + reuse_water

            total_supply = surface_water + groundwater_supply + alternate_supply
        
            return Response({"total_supply": total_supply}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
 
class DomesticWaterDemandCalculationAPIView(APIView):
    permission_classes = [AllowAny]
    def post(self, request, format=None):
        forecast_data = request.data.get("forecast_data")
        per_capita_consumption = request.data.get("per_capita_consumption")
        
        if forecast_data is None or per_capita_consumption is None:
            return Response(
                {"error": "Both 'forecast_data' and 'per_capita_consumption' must be provided."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            per_capita = float(per_capita_consumption)
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid per_capita_consumption value."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate the effective per capita consumption
        effective_consumption = 135 + per_capita
        
        result = {}
        for year, population in forecast_data.items():
            try:
                pop = float(population)
            except (ValueError, TypeError):
                continue
            result[year] = pop * (effective_consumption / 1000000)
        
        return Response(result, status=status.HTTP_200_OK)
    
class FloatingWaterDemandCalculationAPIView(APIView):
    
    permission_classes = [AllowAny]
    """
    API endpoint to calculate floating water demand.
    
    Expected JSON payload:
    {
      "floating_population": <number>,          # Base floating population for 2011
      "facility_type": <string>,                  # One of "provided", "notprovided", "onlypublic"
      "domestic_forecast": {                      # Domestic forecast population for multiple years
          "2011": <number>,
          "2025": <number>,
          "2026": <number>,
          ...
      }
    }
    
    Calculation:
      1. Determine facility multiplier:
          - "provided": 45
          - "notprovided": 25
          - "onlypublic": 15
      2. For each year, compute:
          growth_ratio = domestic_forecast[year] / domestic_forecast["2011"]
          projected_floating_population = floating_population * growth_ratio
          demand = projected_floating_population * (facility_multiplier / 1000000)
    """
    def post(self, request, format=None):
        data = request.data
        floating_population = data.get("floating_population")
        facility_type = data.get("facility_type")
        domestic_forecast = data.get("domestic_forecast")
        
        if floating_population is None or facility_type is None or domestic_forecast is None:
            return Response(
                {"error": "floating_population, facility_type, and domestic_forecast are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            floating_population = float(floating_population)
        except (TypeError, ValueError):
            return Response({"error": "Invalid floating_population value."}, status=status.HTTP_400_BAD_REQUEST)
        
        if "2011" not in domestic_forecast:
            return Response({"error": "domestic_forecast must include a value for 2011."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            base_population = float(domestic_forecast["2011"])
        except (TypeError, ValueError):
            return Response({"error": "Invalid domestic_forecast value for 2011."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Determine facility multiplier
        if facility_type == "provided":
            facility_multiplier = 45
        elif facility_type == "notprovided":
            facility_multiplier = 25
        elif facility_type == "onlypublic":
            facility_multiplier = 15
        else:
            return Response(
                {"error": "Invalid facility_type. Must be 'provided', 'notprovided', or 'onlypublic'."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        result = {}
        # For each year in the domestic forecast, calculate the projected floating demand.
        for year, dom_value in domestic_forecast.items():
            try:
                dom_value = float(dom_value)
            except (TypeError, ValueError):
                continue
            # Calculate growth ratio relative to 2011
            growth_ratio = dom_value / base_population if base_population != 0 else 1
            projected_floating_population = floating_population * growth_ratio
            demand = projected_floating_population * (facility_multiplier / 1000000)
            result[year] = demand
        
        return Response(result, status=status.HTTP_200_OK)

class InstitutionalWaterDemandCalculationAPIView(APIView):
    
    permission_classes = [AllowAny]
    """
    API endpoint to calculate institutional water demand.
    
    Expected JSON payload:
    {
      "institutional_fields": {
         "hospitals100Units": "value",
         "beds100": "value",
         "hospitalsLess100": "value",
         "bedsLess100": "value",
         "hotels": "value",
         "bedsHotels": "value",
         "hostels": "value",
         "residentsHostels": "value",
         "nursesHome": "value",
         "residentsNursesHome": "value",
         "boardingSchools": "value",
         "studentsBoardingSchools": "value",
         "restaurants": "value",
         "seatsRestaurants": "value",
         "airportsSeaports": "value",
         "populationLoadAirports": "value",
         "junctionStations": "value",
         "populationLoadJunction": "value",
         "terminalStations": "value",
         "populationLoadTerminal": "value",
         "intermediateBathing": "value",
         "populationLoadBathing": "value",
         "intermediateNoBathing": "value",
         "populationLoadNoBathing": "value",
         "daySchools": "value",
         "studentsDaySchools": "value",
         "offices": "value",
         "employeesOffices": "value",
         "factorieswashrooms": "value",
         "employeesFactories": "value",
         "factoriesnoWashrooms": "value",
         "employeesFactoriesNoWashrooms": "value",
         "cinemas": "value",
         "populationLoadCinemas": "value"
      },
      "domestic_forecast": {
         "2011": <number>,
         "2025": <number>,
         "2026": <number>,
         ...
      }
    }
    
    Calculation:
      base_demand = (
        (hospitals100Units * beds100 * 450) +
        (hospitalsLess100 * bedsLess100 * 350) +
        (hotels * bedsHotels * 180) +
        (hostels * residentsHostels * 135) +
        (nursesHome * residentsNursesHome * 135) +
        (boardingSchools * studentsBoardingSchools * 135) +
        (restaurants * seatsRestaurants * 70) +
        (airportsSeaports * populationLoadAirports * 70) +
        (junctionStations * populationLoadJunction * 70) +
        (terminalStations * populationLoadTerminal * 45) +
        (intermediateBathing * populationLoadBathing * 45) +
        (intermediateNoBathing * populationLoadNoBathing * 25) +
        (daySchools * studentsDaySchools * 45) +
        (offices * employeesOffices * 45) +
        (factorieswashrooms * employeesFactories * 45) +
        (factoriesnoWashrooms * employeesFactoriesNoWashrooms * 30) +
        (cinemas * populationLoadCinemas * 15)
      ) / 1000000
      
      For each year:
        growth_ratio = domestic_forecast[year] / domestic_forecast["2011"]
        institutional_demand[year] = base_demand * growth_ratio
    """
    def post(self, request, format=None):
        data = request.data
        inst_fields = data.get("institutional_fields")
        domestic_forecast = data.get("domestic_forecast")
        
        if inst_fields is None or domestic_forecast is None:
            return Response(
                {"error": "institutional_fields and domestic_forecast are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if "2011" not in domestic_forecast:
            return Response(
                {"error": "domestic_forecast must include a value for 2011."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            base_domestic = float(domestic_forecast["2011"])
        except (TypeError, ValueError):
            return Response({"error": "Invalid domestic_forecast value for 2011."}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            term1 = float(inst_fields.get("hospitals100Units", 0)) * float(inst_fields.get("beds100", 0)) * 450
            term2 = float(inst_fields.get("hospitalsLess100", 0)) * float(inst_fields.get("bedsLess100", 0)) * 350
            term3 = float(inst_fields.get("hotels", 0)) * float(inst_fields.get("bedsHotels", 0)) * 180
            term4 = float(inst_fields.get("hostels", 0)) * float(inst_fields.get("residentsHostels", 0)) * 135
            term5 = float(inst_fields.get("nursesHome", 0)) * float(inst_fields.get("residentsNursesHome", 0)) * 135
            term6 = float(inst_fields.get("boardingSchools", 0)) * float(inst_fields.get("studentsBoardingSchools", 0)) * 135
            term7 = float(inst_fields.get("restaurants", 0)) * float(inst_fields.get("seatsRestaurants", 0)) * 70
            term8 = float(inst_fields.get("airportsSeaports", 0)) * float(inst_fields.get("populationLoadAirports", 0)) * 70
            term9 = float(inst_fields.get("junctionStations", 0)) * float(inst_fields.get("populationLoadJunction", 0)) * 70
            term10 = float(inst_fields.get("terminalStations", 0)) * float(inst_fields.get("populationLoadTerminal", 0)) * 45
            term11 = float(inst_fields.get("intermediateBathing", 0)) * float(inst_fields.get("populationLoadBathing", 0)) * 45
            term12 = float(inst_fields.get("intermediateNoBathing", 0)) * float(inst_fields.get("populationLoadNoBathing", 0)) * 25
            term13 = float(inst_fields.get("daySchools", 0)) * float(inst_fields.get("studentsDaySchools", 0)) * 45
            term14 = float(inst_fields.get("offices", 0)) * float(inst_fields.get("employeesOffices", 0)) * 45
            term15 = float(inst_fields.get("factorieswashrooms", 0)) * float(inst_fields.get("employeesFactories", 0)) * 45
            term16 = float(inst_fields.get("factoriesnoWashrooms", 0)) * float(inst_fields.get("employeesFactoriesNoWashrooms", 0)) * 30
            term17 = float(inst_fields.get("cinemas", 0)) * float(inst_fields.get("populationLoadCinemas", 0)) * 15

            base_demand = (
                term1 + term2 + term3 + term4 + term5 + term6 + term7 +
                term8 + term9 + term10 + term11 + term12 + term13 +
                term14 + term15 + term16 + term17
            ) / 1000000.0
        except Exception as e:
            return Response({"error": "Error parsing institutional field values: " + str(e)},
                            status=status.HTTP_400_BAD_REQUEST)
        
        result = {}
        for year, value in domestic_forecast.items():
            try:
                year_value = float(value)
            except (TypeError, ValueError):
                continue
            growth_ratio = year_value / base_domestic if base_domestic != 0 else 1
            result[year] = base_demand * growth_ratio
        
        return Response(result, status=status.HTTP_200_OK)

class FirefightingWaterDemandCalculationAPIView(APIView):
    permission_classes = [AllowAny] 
    """
    API endpoint to calculate firefighting water demand for each selected method.
    
    Expected JSON payload:
    {
      "firefighting_methods": {
         "kuchling": true/false,
         "freeman": true/false,
         "buston": true/false,
         "american_insurance": true/false,
         "ministry_urban": true/false
      },
      "domestic_forecast": {
         "2011": <number>,
         "2025": <number>,
         "2026": <number>,
         ...
      }
    }
    
    For each checked method, the demand is calculated as follows:
    
    - kuchling:  
      demand = (4.582 / 100) * sqrt(popVal / 1000)
    
    - freeman:  
      demand = (1.635 / 100) * ((popVal / 5000) + 10)
    
    - buston:  
      demand = (8.155 / 100) * sqrt(popVal / 1000)
    
    - american_insurance:  
      demand = (6.677 / 100) * sqrt(popVal / 1000) * (1 - 0.01 * sqrt(popVal / 1000))
    
    - ministry_urban:  
      demand = sqrt(popVal) / 1000
    
    where popVal is the forecasted population for that year.
    """
    def post(self, request, format=None):
        data = request.data
        methods = data.get("firefighting_methods")
        domestic_forecast = data.get("domestic_forecast")
        
        if methods is None or domestic_forecast is None:
            return Response(
                {"error": "firefighting_methods and domestic_forecast are required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if "2011" not in domestic_forecast:
            return Response(
                {"error": "domestic_forecast must include a value for 2011."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # We don't use a growth ratio here; each year's forecasted population (popVal) is used directly.
        result = {}
        for method, selected in methods.items():
            if selected:
                method_result = {}
                for year, value in domestic_forecast.items():
                    try:
                        popVal = float(value)
                    except (TypeError, ValueError):
                        continue
                    if method == "kuchling":
                        demand = (4.582 / 100) * math.sqrt(popVal / 1000)
                    elif method == "freeman":
                        demand = (1.635 / 100) * ((popVal / 5000) + 10)
                    elif method == "buston":
                        demand = (8.155 / 100) * math.sqrt(popVal / 1000)
                    elif method == "american_insurance":
                        demand = (6.677 / 100) * math.sqrt(popVal / 1000) * (1 - 0.01 * math.sqrt(popVal / 1000))
                    elif method == "ministry_urban":
                        demand = math.sqrt(popVal) / 1000
                    else:
                        demand = 0.0
                    method_result[year] = demand
                result[method] = method_result
        
        return Response(result, status=status.HTTP_200_OK)


#for cohort 
class CohortView(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        
        # Get data from request
        print('request_data is cohort by anas ', request.data)
        
        # Extract parameters from request
        single_year = request.data.get('year')
        start_year = request.data.get('start_year')
        end_year = request.data.get('end_year')
        villages = request.data.get('villages_props', [])
        subdistrict = request.data.get('subdistrict_props', {})
        district = request.data.get('district_props', {})
        state = request.data.get('state_props', {})
        
        # Check if required year parameters are provided
        if not (single_year or (start_year and end_year)):
            error_msg = "Either 'year' or both 'start_year' and 'end_year' must be provided"
            print(error_msg)
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)
        
        # Debug the input parameters
        print(f"Filtering parameters: single_year={single_year}, start_year={start_year}, end_year={end_year}")
        print(f"Location filters: villages={villages}, subdistrict={subdistrict}, district={district}, state={state}")
        
        # Build location filter - apply available filters
        location_filter = Q()
        
        # Apply state filter if provided (SINGLE ONLY)
        if state and state.get('id'):
            state_id = int(state['id'])
            print(f"Adding state filter: {state_id}")
            location_filter &= Q(state_code=state_id)
        
        # Apply district filter if provided (SUPPORTS MULTIPLE)
        if district:
            if isinstance(district, list):
                # Handle multiple districts
                district_ids = [int(d['id']) for d in district if d.get('id')]
                if district_ids:
                    print(f"Adding multiple district filters: {district_ids}")
                    location_filter &= Q(district_code__in=district_ids)
            elif district.get('id'):
                # Handle single district
                district_id = int(district['id'])
                print(f"Adding single district filter: {district_id}")
                location_filter &= Q(district_code=district_id)
        
        # Apply subdistrict filter if provided (SUPPORTS MULTIPLE)
        if subdistrict:
            if isinstance(subdistrict, list):
                # Handle multiple subdistricts
                subdistrict_ids = [int(sd['id']) for sd in subdistrict if sd.get('id')]
                if subdistrict_ids:
                    print(f"Adding multiple subdistrict filters: {subdistrict_ids}")
                    location_filter &= Q(subdistrict_code__in=subdistrict_ids)
            elif subdistrict.get('id'):
                # Handle single subdistrict
                subdistrict_id = int(subdistrict['id'])
                print(f"Adding single subdistrict filter: {subdistrict_id}")
                location_filter &= Q(subdistrict_code=subdistrict_id)
        
        # Apply villages filter if provided (ALREADY SUPPORTS MULTIPLE)
        if villages and len(villages) > 0:
            village_ids = [int(village['id']) for village in villages if village.get('id')]
            if village_ids:
                print(f"Adding villages filter: {village_ids}")
                location_filter &= Q(village_code__in=village_ids)
                
                
        
        # Ensure at least one location filter is applied
        if location_filter == Q():
            error_msg = "At least one location parameter (state, district, subdistrict, or village) is required"
            print(error_msg)
            return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)
        
        # Initialize result
        main_output = {}
        
        if single_year:
            # Handle single year query
            try:
                year_value = int(single_year)
                print(f"Querying for year: {year_value}")
                
                # Determine years to query
                years_to_query = [year_value]
                if year_value != 2011:
                    years_to_query.append(2011)
                
                years_data = []
                for year in years_to_query:
                    # Add year filter
                    query_filter = location_filter & Q(year=year)
                    
                    # Get cohort data for the specified year and location
                    cohort_data = PopulationCohort.objects.filter(query_filter)
                    count = cohort_data.count()
                    print(f"Found {count} records for year {year}")
                    villages_found = cohort_data.values('village_code').distinct().count()
                    print(f"Found {count} records for year {year} across {villages_found} villages")
                    # ADD THESE LINES HERE:
                    if villages and len(villages) > 0:
                        requested_village_ids = [int(village['id']) for village in villages if village.get('id')]
                        found_village_codes = list(cohort_data.values_list('village_code', flat=True).distinct())
                        missing_village_codes = [vid for vid in requested_village_ids if vid not in found_village_codes]
                        
                        #print(f"Year {year} - Requested villages: {requested_village_ids}")
                        #print(f"Year {year} - Found villages with records: {found_village_codes}")
                        print(f"Year {year} - Missing villages (no records): {missing_village_codes}")

                    villages_found = cohort_data.values('village_code').distinct().count()
                    if count > 0:
                        # Process the data
                        result = self.organize_cohort_data(cohort_data)
                        
                        years_data.append({
                            'year': year,
                            'data': result
                        })
                    else:
                        years_data.append({
                            'year': year,
                            'data': {}
                        })
                
                # Sort years with 2011 first if it's included
                years_data.sort(key=lambda x: (x['year'] != 2011, x['year']))
                
                main_output['cohort'] = years_data
                
            except ValueError:
                error_msg = f"Invalid year format: {single_year}"
                print(error_msg)
                return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)
                
        elif start_year and end_year:
            # Handle year range query
            try:
                start = int(start_year)
                end = int(end_year)
                
                if start > end:
                    error_msg = f"start_year ({start}) cannot be greater than end_year ({end})"
                    print(error_msg)
                    return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)
                    
                print(f"Querying for years from {start} to {end}")
                
                # Determine years to query
                years_to_query = list(range(start, end + 1))
                if 2011 not in years_to_query:
                    years_to_query.append(2011)
                
                # Sort years with 2011 first if not in original range
                if 2011 not in range(start, end + 1):
                    years_to_query.sort(key=lambda x: (x != 2011, x))
                else:
                    years_to_query.sort()
                
                years_data = []
                
                for year in years_to_query:
                    # Add year filter
                    query_filter = location_filter & Q(year=year)
                    
                    # Get cohort data for the current year and location
                    cohort_data = PopulationCohort.objects.filter(query_filter)
                    count = cohort_data.count()
                    print(f"Found {count} records for year {year}")
                    villages_found = cohort_data.values('village_code').distinct().count()
                    print(f"Found {count} records for year {year} across {villages_found} villages")
                    # ADD THESE LINES HERE:
                    if villages and len(villages) > 0:
                        requested_village_ids = [int(village['id']) for village in villages if village.get('id')]
                        found_village_codes = list(cohort_data.values_list('village_code', flat=True).distinct())
                        missing_village_codes = [vid for vid in requested_village_ids if vid not in found_village_codes]
                        
                        #print(f"Year {year} - Requested villages: {requested_village_ids}")
                        #print(f"Year {year} - Found villages with records: {found_village_codes}")
                        print(f"Year {year} - Missing villages (no records): {missing_village_codes}")

                    villages_found = cohort_data.values('village_code').distinct().count()
                    if count > 0:  # Only add years with data
                        # Process the data
                        result = self.organize_cohort_data(cohort_data)
                        
                        years_data.append({
                            'year': year,
                            'data': result
                        })
                
                main_output['cohort'] = years_data
            except ValueError:
                error_msg = f"Invalid year format: start_year={start_year}, end_year={end_year}"
                print(error_msg)
                return Response({"error": error_msg}, status=status.HTTP_400_BAD_REQUEST)
        
        print("Final output:", main_output)   
        return Response(main_output, status=status.HTTP_200_OK)
    
    def organize_cohort_data(self, queryset):
        """
        Organizes cohort data by age group and gender
        Input: queryset of PopulationCohort objects
        Output: Structured data by age group and gender
        """
        # Initialize the result dictionary
        result = {}
        
        # Track totals
        total_male = 0
        total_female = 0
        total_overall = 0
        
        # Process each record
        for record in queryset:
            age_group = record.age_group
            gender = record.gender.lower()  # Normalize gender to lowercase
            population = record.population
            
            # Initialize age group data if not present
            if age_group not in result:
                result[age_group] = {'male': 0, 'female': 0, 'total': 0}
            
            # Update gender-specific count
            if gender == 'male':
                result[age_group]['male'] += population
                total_male += population
            elif gender == 'female':
                result[age_group]['female'] += population
                total_female += population
            
            # Update total for this age group
            result[age_group]['total'] = result[age_group]['male'] + result[age_group]['female']
            total_overall += population
        
        # Add a "total" category with sums across all age groups
        if result:
            result['total'] = {
                'male': total_male,
                'female': total_female,
                'total': total_overall
            }
        
        print(f"Organized data: {result}")
        return result
#end cohort logic here

#Below logic for to get shapefile of selected state in basic module 
#these api used only in basic module 

class DefaultBaseMapAPI(APIView):
    permission_classes = [AllowAny] 
    def get(self, request, *args, **kwargs):
        try:
            # Construct path to india.shp
            shapefile_path = os.path.join(settings.MEDIA_ROOT, 'basic_shape', 'B_State')
            shapefile_full_path = os.path.join(shapefile_path, 'B_State.shp')

            if not os.path.exists(shapefile_full_path):
                return Response({'error': 'Shapefile not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Read shapefile using GeoPandas
            gdf = gpd.read_file(shapefile_full_path)

            # Convert to GeoJSON
            geojson_data = json.loads(gdf.to_json())
            
            return Response(geojson_data, status=status.HTTP_200_OK)

        except Exception as e: 
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StateShapefileAPI(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        state_code = request.data.get('state_code')
        
        print(f"Received request with state_code: {state_code}")
        
        if state_code is None:
            return Response(
                {"error": "state_code is required."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Convert to string if it's not already
        original_state_code = str(state_code)
        
        # Path to the state shapefile
        shapefile_path = os.path.join(settings.MEDIA_ROOT, 'basic_shape', 'B_State')
        
        print(f"Looking for shapefile at: {shapefile_path}")
        
        if not os.path.exists(shapefile_path):
            print(f"Directory not found: {shapefile_path}")
            return Response(
                {"error": f"Shapefile directory not found at {shapefile_path}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        try:
            # Read the shapefile using geopandas
            shapefile_full_path = os.path.join(shapefile_path, 'B_State.shp')
            print(f"Attempting to read shapefile from: {shapefile_full_path}")
            
            gdf = gpd.read_file(shapefile_full_path)
            print(f"Shapefile loaded. Columns: {gdf.columns.tolist()}")
            
            # Try different formats of state code
            # First, try the original input
            state_data = gdf[gdf['state_code'] == original_state_code]
            
            # If not found, try with zero padding (if it's a number)
            if state_data.empty and original_state_code.isdigit():
                padded_state_code = original_state_code.zfill(2)  # Pad with leading zero if needed
                print(f"No results for '{original_state_code}', trying padded code: '{padded_state_code}'")
                state_data = gdf[gdf['state_code'] == padded_state_code]
            
            # If still not found, try without padding (if it has leading zeros)
            if state_data.empty and original_state_code.startswith('0'):
                unpadded_state_code = original_state_code.lstrip('0')
                if unpadded_state_code == '':  # Edge case: input was just '0'
                    unpadded_state_code = '0'
                print(f"No results for '{original_state_code}', trying unpadded code: '{unpadded_state_code}'")
                state_data = gdf[gdf['state_code'] == unpadded_state_code]
            
            print(f"Filtered data for state_code. Found {len(state_data)} records.")
            
            if state_data.empty:
                print(f"No data found for any format of state_code: {original_state_code}")
                return Response(
                    {"error": f"No data found for state_code {original_state_code}"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Convert to GeoJSON format
            geojson_data = json.loads(state_data.to_json())
            
            # Print information about the found state
            print(f"State boundary found for: {state_data['State'].values[0]}")
            print(f"GeoJSON type: {geojson_data['type']}")
            print(f"Number of features: {len(geojson_data['features'])}")
            
            return Response(geojson_data, status=status.HTTP_200_OK)
        
        except Exception as e:
            import traceback
            print(f"Error processing shapefile: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": f"Error processing shapefile: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        


        #below code for multiple district json response 


        #end of multiple distcrit logic



class MultipleDistrictsAPI(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        districts_data = request.data.get('districts')
        
        print(f"Received request with districts data: {districts_data}")
        
        if not districts_data or not isinstance(districts_data, list):
            return Response(
                {"error": "districts must be provided as a list of objects containing state_code and district_c."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Path to the district shapefile
        shapefile_path = os.path.join(settings.MEDIA_ROOT, 'basic_shape', 'B_district')
        
        print(f"Looking for shapefile at: {shapefile_path}")
        
        if not os.path.exists(shapefile_path):
            print(f"Directory not found: {shapefile_path}")
            return Response(
                {"error": f"Shapefile directory not found at {shapefile_path}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        try:
            # Read the shapefile using geopandas
            shapefile_full_path = os.path.join(shapefile_path, 'B_district.shp')
            print(f"Attempting to read shapefile from: {shapefile_full_path}")
            
            gdf = gpd.read_file(shapefile_full_path)
            print(f"Shapefile loaded. Columns: {gdf.columns.tolist()}")
            
            # Ensure all code columns are strings for consistent comparison
            gdf['STATE_CODE'] = gdf['STATE_CODE'].astype(str)
            gdf['DISTRICT_C'] = gdf['DISTRICT_C'].astype(str)
            
            # Initialize a list to store matching rows instead of an empty GeoDataFrame
            matched_rows = []
            
            for district_entry in districts_data:
                state_code = str(district_entry.get('state_code', '')).upper()  # Convert to uppercase
                district_c = str(district_entry.get('district_c', '')).upper()  # Convert to uppercase
                
                if not state_code or not district_c:
                    print(f"Skipping entry missing state_code or district_c: {district_entry}")
                    continue
                
                # Try with original codes
                district_match = gdf[(gdf['STATE_CODE'] == state_code) & 
                                    (gdf['DISTRICT_C'] == district_c)]
                
                # Try with padded codes if needed
                if district_match.empty:
                    if state_code.isdigit():
                        padded_state = state_code.zfill(2)
                        district_match = gdf[(gdf['STATE_CODE'] == padded_state) & 
                                           (gdf['DISTRICT_C'] == district_c)]
                    
                    if district_match.empty and district_c.isdigit():
                        padded_district = district_c.zfill(2)
                        district_match = gdf[(gdf['STATE_CODE'] == state_code) & 
                                           (gdf['DISTRICT_C'] == padded_district)]
                    
                    if district_match.empty and state_code.isdigit() and district_c.isdigit():
                        padded_state = state_code.zfill(2)
                        padded_district = district_c.zfill(2)
                        district_match = gdf[(gdf['STATE_CODE'] == padded_state) & 
                                           (gdf['DISTRICT_C'] == padded_district)]
                
                # Try with unpadded codes if needed
                if district_match.empty:
                    if state_code.startswith('0'):
                        unpadded_state = state_code.lstrip('0') or '0'
                        district_match = gdf[(gdf['STATE_CODE'] == unpadded_state) & 
                                           (gdf['DISTRICT_C'] == district_c)]
                    
                    if district_match.empty and district_c.startswith('0'):
                        unpadded_district = district_c.lstrip('0') or '0'
                        district_match = gdf[(gdf['STATE_CODE'] == state_code) & 
                                           (gdf['DISTRICT_C'] == unpadded_district)]
                    
                    if district_match.empty and state_code.startswith('0') and district_c.startswith('0'):
                        unpadded_state = state_code.lstrip('0') or '0'
                        unpadded_district = district_c.lstrip('0') or '0'
                        district_match = gdf[(gdf['STATE_CODE'] == unpadded_state) & 
                                           (gdf['DISTRICT_C'] == unpadded_district)]
                
                if not district_match.empty:
                    # Append the matched rows to our list
                    matched_rows.append(district_match)
                    print(f"Found match for state_code: {state_code}, district_c: {district_c}")
                else:
                    print(f"No match found for state_code: {state_code}, district_c: {district_c}")
            
            if not matched_rows:
                print("No matching districts found.")
                return Response(
                    {"error": "No matching districts found for the provided criteria."},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Concatenate all matched rows into a single GeoDataFrame
            matched_districts = pd.concat(matched_rows, ignore_index=True)
            
            # Convert to GeoJSON format
            geojson_data = json.loads(matched_districts.to_json())
            
            print(f"Total districts found: {len(matched_districts)}")
            print(f"GeoJSON features: {len(geojson_data['features'])}")
            
            return Response(geojson_data, status=status.HTTP_200_OK)
        
        except Exception as e:
            import traceback
            print(f"Error processing districts: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": f"Error processing districts: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MultipleSubdistrictsAPI(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        subdistricts_data = request.data.get('subdistricts')
        
        print(f"Received request with subdistricts data: {subdistricts_data}")
        
        if not subdistricts_data or not isinstance(subdistricts_data, list):
            return Response(
                {"error": "subdistricts must be provided as a list of objects containing subdis_cod."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Path to the subdistrict shapefile
        shapefile_path = os.path.join(settings.MEDIA_ROOT, 'basic_shape', 'B_subdistrict')
        
        print(f"Looking for shapefile at: {shapefile_path}")
        
        if not os.path.exists(shapefile_path):
            print(f"Directory not found: {shapefile_path}")
            return Response(
                {"error": f"Shapefile directory not found at {shapefile_path}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        try:
            # Read the shapefile using geopandas
            shapefile_full_path = os.path.join(shapefile_path, 'B_subdistrict.shp')
            print(f"Attempting to read shapefile from: {shapefile_full_path}")
            
            gdf = gpd.read_file(shapefile_full_path)
            print(f"Shapefile loaded. Columns: {gdf.columns.tolist()}")
            
            # Ensure subdistrict code column is string for consistent comparison
            gdf['SUBDIS_COD'] = gdf['SUBDIS_COD'].astype(str)
            
            # Initialize a list to store matching rows
            matched_rows = []
            
            for subdistrict_entry in subdistricts_data:
                subdis_cod = str(subdistrict_entry.get('subdis_cod', '')).upper()  # Convert to uppercase
                
                if not subdis_cod:
                    print(f"Skipping entry missing subdistrict code: {subdistrict_entry}")
                    continue
                
                # Try with original code
                subdistrict_match = gdf[gdf['SUBDIS_COD'] == subdis_cod]
                
                # Try with padded code if needed
                if subdistrict_match.empty and subdis_cod.isdigit():
                    padded_subdis = subdis_cod.zfill(4)
                    subdistrict_match = gdf[gdf['SUBDIS_COD'] == padded_subdis]
                
                # Try with unpadded code if needed
                if subdistrict_match.empty:
                    unpadded_subdis = subdis_cod.lstrip('0') or '0' if subdis_cod.startswith('0') else subdis_cod
                    subdistrict_match = gdf[gdf['SUBDIS_COD'] == unpadded_subdis]
                
                if not subdistrict_match.empty:
                    # Append the matched rows to our list
                    matched_rows.append(subdistrict_match)
                    print(f"Found match anas for subdis_cod: {subdis_cod}")
                else:
                    print(f"No match found anas for subdis_cod: {subdis_cod}")
            
            if not matched_rows:
                print("No matching subdistricts found.")
                return Response(
                    {"error": "No matching subdistricts found for the provided criteria."},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Import pandas explicitly to avoid the 'pd is not defined' error
            import pandas as pd
            
            # Concatenate all matched rows into a single GeoDataFrame
            matched_subdistricts = gpd.GeoDataFrame(pd.concat(matched_rows, ignore_index=True))
            matched_subdistricts = matched_subdistricts.to_crs(epsg=4326)
            # Convert to GeoJSON format
            geojson_data = json.loads(matched_subdistricts.to_json())
            
            print(f"Total subdistricts found: {len(matched_subdistricts)}")
            print(f"GeoJSON features: {len(geojson_data['features'])}")
            
            return Response(geojson_data, status=status.HTTP_200_OK)
        
        except Exception as e:
            import traceback
            print(f"Error processing subdistricts: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": f"Error processing subdistricts: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MultipleVillagesAPI(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        villages_data = request.data.get('villages')
        
        print(f"Received request with villages data: {villages_data}")
        
        if not villages_data or not isinstance(villages_data, list):
            return Response(
                {"error": "villages must be provided as a list of objects containing shape_id."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Path to the village shapefile
        shapefile_path = os.path.join(settings.MEDIA_ROOT, 'basic_shape', 'Final_Village')
        
        print(f"Looking for shapefile at: {shapefile_path}")
        
        if not os.path.exists(shapefile_path):
            print(f"Directory not found: {shapefile_path}")
            return Response(
                {"error": f"Shapefile directory not found at {shapefile_path}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        try:
            # Read the shapefile using geopandas
            shapefile_full_path = os.path.join(shapefile_path, 'Village.shp')
            print(f"Attempting to read shapefile from: {shapefile_full_path}")
            
            gdf = gpd.read_file(shapefile_full_path)
            print(f"Shapefile loaded. Columns: {gdf.columns.tolist()}")
            
            # Ensure shapeID column is string for consistent comparison
            gdf['shapeID'] = gdf['shapeID'].astype(str)
            
            # Initialize a list to store matching rows
            matched_rows = []
            
            for village_entry in villages_data:
                shape_id = str(village_entry.get('shape_id', '')).upper()  # Convert to uppercase
                
                if not shape_id:
                    print(f"Skipping entry missing shape_id: {village_entry}")
                    continue
                
                # Try with original shape ID
                village_match = gdf[gdf['shapeID'] == shape_id]
                
                # Try with padded shape ID if needed and if it's a number
                if village_match.empty and shape_id.isdigit():
                    # Try different padding lengths (2, 3, 4, 6 digits)
                    for pad_length in [2, 3, 4, 6]:
                        padded_shape_id = shape_id.zfill(pad_length)
                        village_match = gdf[gdf['shapeID'] == padded_shape_id]
                        if not village_match.empty:
                            break
                
                # Try with unpadded shape ID if needed
                if village_match.empty and shape_id.startswith('0'):
                    unpadded_shape_id = shape_id.lstrip('0') or '0' if shape_id == '0' else shape_id.lstrip('0')
                    village_match = gdf[gdf['shapeID'] == unpadded_shape_id]
                
                if not village_match.empty:
                    # Append the matched rows to our list
                    matched_rows.append(village_match)
                    print(f"Found match for shape_id: {shape_id}")
                else:
                    print(f"No match found for shape_id: {shape_id}")
            
            if not matched_rows:
                print("No matching villages found.")
                return Response(
                    {"error": "No matching villages found for the provided criteria."},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Import pandas explicitly to avoid the 'pd is not defined' error
            import pandas as pd
            
            # Concatenate all matched rows into a single GeoDataFrame
            matched_villages = gpd.GeoDataFrame(pd.concat(matched_rows, ignore_index=True))
            matched_villages = matched_villages.to_crs(epsg=4326)
            # Convert to GeoJSON format
            geojson_data = json.loads(matched_villages.to_json())
            
            # Print information about the found villages
            if 'Village' in matched_villages.columns:
                villages_found = matched_villages['Village'].tolist()
                print(f"Villages found: {villages_found}")
            
            print(f"Total villages found: {len(matched_villages)}")
            print(f"GeoJSON features: {len(geojson_data['features'])}")
            
            return Response(geojson_data, status=status.HTTP_200_OK)
        
        except Exception as e:
            import traceback
            print(f"Error processing villages: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": f"Error processing villages: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
###########


#Below code for Drain based approach 
class BasinAPI(APIView):
    permission_classes = [AllowAny] 
    def get(self, request, *args, **kwargs):
        try:
            # Construct path to Rivers.shp
            shapefile_path = os.path.join(settings.MEDIA_ROOT, 'Drain_shp', 'Basin')
            shapefile_full_path = os.path.join(shapefile_path, 'Catchment_Basin_Diss.shp')

            if not os.path.exists(shapefile_full_path):
                return Response({'error': 'River shapefile not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Read shapefile using GeoPandas
            gdf = gpd.read_file(shapefile_full_path)
            gdf = gdf.to_crs("EPSG:4326")
            # Convert to GeoJSON
            geojson_data = json.loads(gdf.to_json())
            
            return Response(geojson_data, status=status.HTTP_200_OK)

        except Exception as e: 
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)  

 

#This os for to get rivers shapefile in drain based approach in basic module 
class RiverMapAPI(APIView):
    permission_classes = [AllowAny] 
    def get(self, request, *args, **kwargs):
        try:
            # Construct path to Rivers.shp
            shapefile_path = os.path.join(settings.MEDIA_ROOT, 'Drain_shp', 'Rivers')
            shapefile_full_path = os.path.join(shapefile_path, 'Rivers.shp')

            if not os.path.exists(shapefile_full_path):
                return Response({'error': 'River shapefile not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Read shapefile using GeoPandas
            gdf = gpd.read_file(shapefile_full_path)
            gdf = gdf.to_crs("EPSG:4326")
            # Convert to GeoJSON
            geojson_data = json.loads(gdf.to_json())
            
            return Response(geojson_data, status=status.HTTP_200_OK)

        except Exception as e: 
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)        
        
#this is for river stretch where we post River_Code and get json accordingly 

class RiverStretched(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, *args, **kwargs):
        try:
            # Get River_Code from request data (optional)
            river_code = request.data.get('River_Code')
            
            # Construct path to Stretches.shp
            shapefile_path = os.path.join(settings.MEDIA_ROOT, 'Drain_shp', 'River_Stretches')
            shapefile_full_path = os.path.join(shapefile_path, 'Stretches.shp')

            if not os.path.exists(shapefile_full_path):
                return Response({'error': 'Stretches shapefile not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Read shapefile using GeoPandas
            gdf = gpd.read_file(shapefile_full_path)
            gdf = gdf.to_crs("EPSG:4326")
            # Filter data based on River_Code if provided
            if river_code:
                filtered_gdf = gdf[gdf['River_Code'] == river_code]
                if filtered_gdf.empty:
                    return Response({'error': f'No data found for River_Code: {river_code}'}, status=status.HTTP_404_NOT_FOUND)
            else:
                filtered_gdf = gdf  # Return all stretches if no River_Code
            
            # Convert to GeoJSON
            geojson_data = json.loads(filtered_gdf.to_json())
            print(f"GeoJSON features: {len(geojson_data['features'])}")
            return Response(geojson_data, status=status.HTTP_200_OK)

        except Exception as e: 
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)      

#this is for drain where we post stretched id and get json accordingly of drain

class Drain(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, *args, **kwargs):
        try:
            # Get Stretch_ID(s) from request data (optional)
            stretch_ids = request.data.get('Stretch_ID', [])
            
            # Construct path to Drains.shp
            shapefile_path = os.path.join(settings.MEDIA_ROOT, 'Drain_shp', 'Drains')
            shapefile_full_path = os.path.join(shapefile_path, 'Drain.shp')

            if not os.path.exists(shapefile_full_path):
                return Response({'error': 'Drains shapefile not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Read shapefile using GeoPandas
            gdf = gpd.read_file(shapefile_full_path)
            gdf = gdf.to_crs("EPSG:4326")
            
            # Filter data based on Stretch_IDs if provided
            if stretch_ids:
                # Convert to list if a single ID is provided
                if not isinstance(stretch_ids, list):
                    stretch_ids = [stretch_ids]
                filtered_gdf = gdf[gdf['Stretch_ID'].isin(stretch_ids)]
                if filtered_gdf.empty:
                    return Response({'error': f'No data found for the provided Stretch_IDs'}, status=status.HTTP_404_NOT_FOUND)
            else:
                filtered_gdf = gdf  # Return all drains if no Stretch_ID
            
            # Convert to GeoJSON
            geojson_data = json.loads(filtered_gdf.to_json())
            
            return Response(geojson_data, status=status.HTTP_200_OK)

        except Exception as e: 
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        


#######################


class Catchments(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, *args, **kwargs):
        try:
            # Get Drain_No from request data
            drain_nos = request.data.get('Drain_No', [])
            
            # Construct path to Catchments.shp
            shapefile_path = os.path.join(settings.MEDIA_ROOT, 'Drain_shp', 'Catchments')
            shapefile_full_path = os.path.join(shapefile_path, 'Catchment.shp')
            
            if not os.path.exists(shapefile_full_path):
                return Response({'error': 'Catchments shapefile not found.'}, status=status.HTTP_404_NOT_FOUND)
            
            # Read shapefile using GeoPandas
            gdf = gpd.read_file(shapefile_full_path)
            gdf = gdf.to_crs("EPSG:4326")
            
            # Filter data based on Drain_No if provided
            if drain_nos:
                # Convert to list if a single ID is provided
                if not isinstance(drain_nos, list):
                    drain_nos = [drain_nos]
                filtered_gdf = gdf[gdf['Drain_No'].isin(drain_nos)]
                if filtered_gdf.empty:
                    return Response({'error': f'No catchment data found for the provided Drain_No'}, status=status.HTTP_404_NOT_FOUND)
            else:
                filtered_gdf = gdf  # Return all catchments if no Drain_No are provided
            
            # Convert to GeoJSON
            geojson_data = json.loads(filtered_gdf.to_json())
            
            return Response(geojson_data, status=status.HTTP_200_OK)
        
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        
class AllStretches(APIView):
    permission_classes = [AllowAny] 
    def get(self, request, *args, **kwargs):
        try:
            # Construct path to Stretches.shp
            shapefile_path = os.path.join(settings.MEDIA_ROOT, 'Drain_shp', 'River_Stretches')
            shapefile_full_path = os.path.join(shapefile_path, 'Stretches.shp')

            if not os.path.exists(shapefile_full_path):
                return Response({'error': 'Stretches shapefile not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Read shapefile using GeoPandas
            gdf = gpd.read_file(shapefile_full_path)
            gdf = gdf.to_crs("EPSG:4326")
            
            # Convert to GeoJSON
            geojson_data = json.loads(gdf.to_json())
            
            return Response(geojson_data, status=status.HTTP_200_OK)

        except Exception as e: 
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

class VillagesCatchmentIntersection(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, *args, **kwargs):
        try:
            # Get Drain_No from request data
            drain_nos = request.data.get('Drain_No', [])
            
            if not drain_nos:
                return Response({'error': 'Drain_No is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Convert to list if a single ID is provided
            if not isinstance(drain_nos, list):
                drain_nos = [drain_nos]
            
            # Construct paths to shapefiles
            catchment_path = os.path.join(settings.MEDIA_ROOT, 'Drain_shp', 'Catchments', 'Catchment.shp')
            village_path = os.path.join(settings.MEDIA_ROOT, 'Drain_shp', 'Final_Village', 'Village.shp')
            
            if not os.path.exists(catchment_path) or not os.path.exists(village_path):
                return Response(
                    {'error': 'One or more required shapefiles not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Read shapefiles
            catchment_gdf = gpd.read_file(catchment_path)
            village_gdf = gpd.read_file(village_path)
            
            # Ensure both are in the same CRS
            catchment_gdf = catchment_gdf.to_crs("EPSG:4326")
            village_gdf = village_gdf.to_crs("EPSG:4326")
            
            # Filter catchments for selected drains
            filtered_catchment = catchment_gdf[catchment_gdf['Drain_No'].isin(drain_nos)]
            
            if filtered_catchment.empty:
                return Response(
                    {'error': f'No catchment data found for the provided Drain_No'}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Find intersections between catchments and villages
            intersected_villages = []
            intersected_village_gdf = gpd.GeoDataFrame()
            
            for idx, catchment in filtered_catchment.iterrows():
                catchment_geom = catchment.geometry
                drain_no = catchment['Drain_No']
                
                for vidx, village in village_gdf.iterrows():
                    if catchment_geom.intersects(village.geometry):
                        village_data = {
                            'shapeID': village.get('shapeID', 'Unknown'),
                            'shapeName': village.get('shapeName', 'Unknown'),
                            'subDistrictName': village.get('SUB_DISTRI', 'Unknown'),
                           
                            'districtName': village.get('DISTRICT', 'Unknown'),
                            'drainNo': drain_no
                        }
                        intersected_villages.append(village_data)
                        intersected_village_gdf = pd.concat(
                            [intersected_village_gdf, village_gdf.loc[[vidx]]],
                            ignore_index=True
                        )
            
            # Remove duplicates based on shapeID
            intersected_village_gdf = intersected_village_gdf.drop_duplicates(subset=['shapeID'])
            
            # Convert village GeoDataFrame to GeoJSON
            village_geojson = json.loads(intersected_village_gdf.to_json()) if not intersected_village_gdf.empty else {
                'type': 'FeatureCollection',
                'features': []
            }
            
            # Convert filtered catchments to GeoJSON
            catchment_geojson = json.loads(filtered_catchment.to_json()) if not filtered_catchment.empty else {
                'type': 'FeatureCollection',
                'features': []
            }
            
            return Response({
                'intersected_villages': intersected_villages,
                'count': len(intersected_villages),
                'village_geojson': village_geojson,
                'catchment_geojson': catchment_geojson
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
            import traceback
            print(f"Error in village-catchment intersection: {str(e)}")
            print(traceback.format_exc())
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VillagePopulationAPI(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        try:
            shape_ids = request.data.get('shapeID', [])
            # print(f"Received shapeIDs: {shape_ids}")

            if not shape_ids or not isinstance(shape_ids, list):
                return Response(
                    {"error": "shapeID must be provided as a list"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            results = []

            for village_id in shape_ids:
                # Generate possible formats for matching village_code
                possible_ids = list({
                    str(village_id),
                    str(int(village_id)) if str(village_id).isdigit() else str(village_id),
                    str(village_id).lstrip('0'),
                    str(village_id).zfill(6) if str(village_id).isdigit() else str(village_id)
                })

                print(f"Trying possible IDs for {village_id}: {possible_ids}")

                village_found = False
                for possible_id in possible_ids:
                    try:
                        village_qs = Basic_village.objects.filter(village_code=possible_id)
                        if village_qs.exists():
                            village_record = village_qs.first()
                            village_found = True

                            # Get population directly from Basic_village model
                            # This is where the fix is - use population_2011 from Basic_village
                            total_pop = village_record.population_2011  

                            # print(f"Found village {possible_id} with population {total_pop}")

                            results.append({
                                'village_code': str(village_id),  # Keep original ID in response
                                'subdistrict_code': str(village_record.subdistrict_code_id),
                                'district_code': str(village_record.subdistrict_code.district_code_id) if hasattr(village_record.subdistrict_code, 'district_code_id') else None,
                                'state_code': str(village_record.subdistrict_code.district_code.state_code_id) if hasattr(village_record.subdistrict_code, 'district_code') and hasattr(village_record.subdistrict_code.district_code, 'state_code_id') else None,
                                'total_population': total_pop
                            })
                            break  # Stop trying more formats
                    except Exception as e:
                        # print(f"Error trying ID {possible_id}: {str(e)}")
                        continue

                if not village_found:
                    print(f"No match found for village {village_id}")
                    # For villages not found, use the fallback approach with a random population
                    # This ensures we have data for visualization while debugging
                    # import random
                    # fallback_pop = random.randint(1000, 5000)
                    
                    # results.append({
                    #     'village_code': str(village_id),
                    #     'subdistrict_code': None,
                    #     'district_code': None,
                    #     'state_code': None,
                    #     'total_population': fallback_pop
                    # })

            print(f"Returning population data for {len(results)} villages")
            return Response(results, status=status.HTTP_200_OK)

        except Exception as e:
            import traceback
            print(f"Unexpected error in VillagePopulationAPI: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class VillagePopulationRawSQL(APIView):
    permission_classes = [AllowAny] 
    def post(self, request, format=None):
        try:
            shape_ids = request.data.get('shapeID', [])
            # print(f"Received shapeIDs for raw SQL: {shape_ids}")
            
            if not shape_ids or not isinstance(shape_ids, list):
                return Response(
                    {"error": "shapeID must be provided as a list"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Use raw SQL to join Basic_village with Population_2011
            with connection.cursor() as cursor:
                # Create placeholders for SQL IN clause
                placeholders = ', '.join(['%s'] * len(shape_ids))
                
                # SQL query to join the two tables
                query = f"""
                    SELECT 
                        bv.village_code,
                        bv.subdistrict_code,
                        bv.district_code,
                        bv.state_code,
                        SUM(p.population) as total_population
                    FROM 
                        Basic_village bv
                    LEFT JOIN 
                        Population_2011 p ON bv.village_code = p.village_code
                    WHERE 
                        bv.village_code IN ({placeholders})
                    GROUP BY 
                        bv.village_code, bv.subdistrict_code, bv.district_code, bv.state_code
                """
                
                cursor.execute(query, shape_ids)
                columns = [col[0] for col in cursor.description]
                results = [dict(zip(columns, row)) for row in cursor.fetchall()]
                
                # Add entries for villages not found
                found_village_codes = [str(result['village_code']) for result in results]
                for village_id in shape_ids:
                    if str(village_id) not in found_village_codes:
                        results.append({
                            'village_code': str(village_id),
                            'subdistrict_code': None,
                            'district_code': None,
                            'state_code': None,
                            'total_population': 0
                        })
                
            # print(f"SQL found {len(results)} villages")
            return Response(results, status=status.HTTP_200_OK)
        
        except Exception as e:
            import traceback
            print(f"Error in raw SQL: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        

