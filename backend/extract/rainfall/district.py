import re
import json
import requests
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from bs4 import BeautifulSoup
from shapely.geometry import shape, mapping
from shapely.ops import transform
import pyproj

CACHE_KEY = "imd_rainfall_areas"
CACHE_TIMEOUT = 60 * 15  # 15 minutes


class DistrictRainfallBaseAPIView(APIView):
    permission_classes = [AllowAny]

    def create_error_geojson(self, error_message, period):
        return {
            "type": "FeatureCollection",
            "period": period,
            "error": error_message,
            "metadata": {},
            "features": []
        }

    def extract_period_dates(self, param):
        """Extract date information for the given period from IMD state rainfall page"""
        cache_key = f"imd_period_dates_{param}"
        cached_dates = cache.get(cache_key)
        if cached_dates:
            return cached_dates
        
        url = "https://mausam.imd.gov.in/imd_latest/contents/index_rainfall_state_new.php?msg=D"
        headers = {
            'User-Agent': 'Mozilla/5.0'
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            html_content = response.text
            soup = BeautifulSoup(html_content, 'html.parser')
            radio_inputs = soup.find_all('input', {'type': 'radio', 'name': 'group'})
            
            period_dates = {}
            for radio in radio_inputs:
                value = radio.get('value', '')
                label_text = radio.next_sibling
                if label_text and isinstance(label_text, str):
                    label_text = label_text.strip()
                    match = re.search(r'\(([^)]+)\)', label_text)
                    if match:
                        date_info = match.group(1).strip()
                        period_dates[value] = {
                            'label': label_text.split('(')[0].strip(),
                            'date_range': date_info
                        }
            
            cache.set(cache_key, period_dates, 3600)
            return period_dates
            
        except Exception as e:
            print(f"Failed to extract period dates: {e}")
            return {}

    def extract_areas_from_html(self, html_content):
        soup = BeautifulSoup(html_content, 'html.parser')
        script_tags = soup.find_all('script')
        target_script = None
        for script in script_tags:
            if script.string and 'AmCharts.makeChart' in script.string and '"areas": [' in script.string:
                target_script = script.string
                break

        if not target_script:
            return None

        start_match = re.search(r'"areas"\s*:\s*\[', target_script)
        if not start_match:
            return None
        start_pos = start_match.end()

        brace_count = 1
        i = start_pos
        while i < len(target_script) and brace_count > 0:
            if target_script[i] == '[':
                brace_count += 1
            elif target_script[i] == ']':
                brace_count -= 1
            i += 1
        end_pos = i - 1

        areas_str = target_script[start_pos:end_pos].strip()
        areas_str = re.sub(r',\s*([}\]]|\s*$)', r'\1', areas_str)
        areas_str = re.sub(r'([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:', r'\1"\2":', areas_str)

        try:
            areas = json.loads('[' + areas_str + ']')
            return areas
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print("Sample areas_str:", areas_str[:500])
            return None

    def fetch_geojson(self):
        """Fetch the IMD district GeoJSON and reproject to EPSG:4326"""
        geojson_url = "https://mausam.imd.gov.in/imd_latest/contents/district_shapefiles/DISTRICT_F-2.json"
        try:
            response = requests.get(geojson_url, timeout=10)
            response.raise_for_status()
            data = response.json()

            # Reproject geometries to EPSG:4326
            # Determine source CRS from GeoJSON or default
            source_crs = data.get('crs', {}).get('properties', {}).get('name', 'EPSG:32644')
            transformer = pyproj.Transformer.from_crs(source_crs, 'EPSG:3857', always_xy=True)

            for feature in data.get('features', []):
                geom = shape(feature['geometry'])
                reprojected_geom = transform(transformer.transform, geom)
                feature['geometry'] = mapping(reprojected_geom)

            # Set CRS property to 4326
            data['crs'] = {
                "type": "name",
                "properties": {"name": "EPSG:4326"}
            }

            print(f"GeoJSON CRS transformed to: EPSG:4326")
            return data
        except Exception as e:
            print(f"GeoJSON fetch/reprojection failed: {e}")
            return None

    def get_rainfall_data(self, param):
        url = f"https://mausam.imd.gov.in/imd_latest/contents/rainfallinformation.php?msg={param}"
        headers = {'User-Agent': 'Mozilla/5.0'}
        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            html_content = response.text
        except Exception as e:
            return None, f"Failed to fetch data: {str(e)}"

        areas = self.extract_areas_from_html(html_content)
        if not areas:
            return None, "Failed to extract rainfall data"

        return areas, None

    def build_output(self, param, areas, geojson_data):
        title_to_area = {area.get('title', '').upper().strip(): area for area in areas if area.get('title')}

        features = []
        for feature in geojson_data.get('features', []):
            props = feature.get('properties', {})
            district_name = props.get('DISTRICT', '').upper().strip()
            enhanced_props = props.copy()

            if district_name in title_to_area:
                rainfall = title_to_area[district_name]
                enhanced_props.update({
                    'rainfall_title': rainfall.get('title', district_name),
                    'rainfall_color': rainfall.get('color', '#D8D8D8'),
                    'rainfall_info': rainfall.get('info', 'No Data'),
                    'rainfall_balloonText': rainfall.get('balloonText', f"{district_name} : <br/> Departure : No Data <br/> Actual : 0 mm <br/> Normal : 0 mm")
                })
            else:
                enhanced_props.update({
                    'rainfall_title': district_name,
                    'rainfall_color': '#D8D8D8',
                    'rainfall_info': 'No Data',
                    'rainfall_balloonText': f"{district_name} : <br/> Departure : No Data <br/> Actual : 0 mm <br/> Normal : 0 mm"
                })

            features.append({
                'type': 'Feature',
                'properties': enhanced_props,
                'geometry': feature.get('geometry')
            })

        period_dates = self.extract_period_dates(param)
        period_info = period_dates.get(param, {})

        metadata = {
            "title": "India District-wise Rainfall Data",
            "source": "India Meteorological Department",
            "period": param,
            "period_label": period_info.get('label', ''),
            "date_range": period_info.get('date_range', ''),
            "legend": {
                "No Rain": {"range": "-100%", "color": "#FFFFFF"},
                "Large Deficient": {"range": "-99% to -60%", "color": "#FFFF00"},
                "Deficient": {"range": "-59% to -20%", "color": "#FF0012"},
                "Normal": {"range": "-19% to 19%", "color": "#00FF3E"},
                "Excess": {"range": "20% to 59%", "color": "#58CCED"},
                "Large Excess": {"range": "≥60%", "color": "#3895D3"}
            }
        }

        return {
            "type": "FeatureCollection",
            "period": param,
            "period_label": period_info.get('label', ''),
            "date_range": period_info.get('date_range', ''),
            "metadata": metadata,
            "features": features
        }



class DistrictDailyRainfallAPIView(DistrictRainfallBaseAPIView):
    def get(self, request):
        param = request.GET.get('msg', 'D')
        cache_key = f"{CACHE_KEY}_daily_{param}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        areas, error = self.get_rainfall_data(param)
        if error:
            return Response(self.create_error_geojson(error, param), status=500)

        geojson_data = self.fetch_geojson()
        if not geojson_data:
            return Response(self.create_error_geojson("Failed to fetch GeoJSON", param), status=500)

        output = self.build_output(param, areas, geojson_data)
        cache.set(cache_key, output, CACHE_TIMEOUT)
        return Response(output)


class DistrictWeeklyRainfallGeoJSONAPIView(DistrictRainfallBaseAPIView):
    def get(self, request):
        param = request.GET.get('msg', 'W')
        cache_key = f"{CACHE_KEY}_weekly_{param}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        areas, error = self.get_rainfall_data(param)
        if error:
            return Response(self.create_error_geojson(error, param), status=500)

        geojson_data = self.fetch_geojson()
        if not geojson_data:
            return Response(self.create_error_geojson("Failed to fetch GeoJSON", param), status=500)

        output = self.build_output(param, areas, geojson_data)
        cache.set(cache_key, output, CACHE_TIMEOUT)
        return Response(output)


class DistrictMonthlyRainfallGeoJSONAPIView(DistrictRainfallBaseAPIView):
    def get(self, request):
        param = request.GET.get('msg', 'M')
        cache_key = f"{CACHE_KEY}_monthly_{param}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        areas, error = self.get_rainfall_data(param)
        if error:
            return Response(self.create_error_geojson(error, param), status=500)

        geojson_data = self.fetch_geojson()
        if not geojson_data:
            return Response(self.create_error_geojson("Failed to fetch GeoJSON", param), status=500)

        output = self.build_output(param, areas, geojson_data)
        cache.set(cache_key, output, CACHE_TIMEOUT)
        return Response(output)


class DistrictCumulativeRainfallGeoJSONAPIView(DistrictRainfallBaseAPIView):
    def get(self, request):
        param = request.GET.get('msg', 'C')
        cache_key = f"{CACHE_KEY}_cumulative_{param}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        areas, error = self.get_rainfall_data(param)
        if error:
            return Response(self.create_error_geojson(error, param), status=500)

        geojson_data = self.fetch_geojson()
        if not geojson_data:
            return Response(self.create_error_geojson("Failed to fetch GeoJSON", param), status=500)

        output = self.build_output(param, areas, geojson_data)
        cache.set(cache_key, output, CACHE_TIMEOUT)
        return Response(output)