import re
import json
import requests
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

CACHE_KEY = "imd_rainfall_geojson"
CACHE_TIMEOUT = 60 * 15  # cache for 15 minutes

class RainfallGeoJSONAPIView(APIView):

    permission_classes = [AllowAny]

    def extract_js_object(self, html_content, var_name):
        start_pattern = f'var {var_name} ='
        start_index = html_content.find(start_pattern)
        if start_index == -1:
            print("Var not found")
            return None
        start_index += len(start_pattern)

        brace_start = html_content.find('{', start_index)
        if brace_start == -1:
            print("Brace not found")
            return None

        brace_count = 0
        i = brace_start
        while i < len(html_content):
            char = html_content[i]
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    js_str = html_content[brace_start:i + 1]
                    break
            i += 1
        else:
            print("End of file without closing brace")
            return None

        # Remove trailing ; and whitespace
        js_str = js_str.rstrip('; \n\t ')

        # Remove JS single line comments
        js_str = re.sub(r'//.*?$', '', js_str, flags=re.MULTILINE)

        # Remove trailing commas before } or ]
        js_str = re.sub(r',\s*([}\]])', r'\1', js_str)

        # Handle unquoted keys if any
        js_str = re.sub(r'([{,])\s*([a-zA-Z0-9_]+)\s*:', r'\1"\2":', js_str)

        # Replace single quotes with double
        js_str = js_str.replace("'", '"')

        # Replace escaped slashes
        js_str = js_str.replace("\\/", "/")

        # Strip whitespace
        js_str = js_str.strip()

        try:
            parsed = json.loads(js_str)
            print("Parsed successfully")
            return parsed
        except Exception as e:
            print(f"JSON parse failed: {e}")
            print("JS str preview:", repr(js_str[:500]))  # For debugging
            return None

    def extract_date_from_html(self, html_content):
        """Extract the date from the Daily radio button in the HTML"""
        # Look for pattern: Daily (DD-MM-YYYY)
        date_match = re.search(r'Daily\s*\((\d{2}-\d{2}-\d{4})\)', html_content)
        if date_match:
            return date_match.group(1)
        return "Today"

    def get_rainfall_category(self, departure_str):
        try:
            if not departure_str or departure_str == "-100%":
                return "No Rain"
            value = int(departure_str.replace("%", ""))
            if value <= -100:
                return "No Rain"
            elif -99 <= value <= -60:
                return "Large Deficient"
            elif -59 <= value <= -20:
                return "Deficient"
            elif -19 <= value <= 19:
                return "Normal"
            elif 20 <= value <= 59:
                return "Excess"
            else:
                return "Large Excess"
        except:
            return "No Data"

    def get(self, request):
        # Serve from cache if available
        cached_geojson = cache.get(CACHE_KEY)
        if cached_geojson:
            return Response(cached_geojson)

        url = "https://mausam.imd.gov.in/imd_latest/contents/index_rainfall_state_new.php?msg=D"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            html_content = response.text
            print("Fetched HTML length:", len(html_content))  # Debug
        except Exception as e:
            return Response({"error": f"Fetch failed: {str(e)}"}, status=500)

        # Extract the date from HTML
        extracted_date = self.extract_date_from_html(html_content)

        js_data = self.extract_js_object(html_content, "countrydataprovider")
        if not js_data:
            return Response({"error": "Could not extract JS data"}, status=500)

        areas = js_data.get("areas", [])
        images = js_data.get("images", [])

        coord_map = {
            img["label"].strip().upper(): [img["longitude"], img["latitude"]]
            for img in images if "latitude" in img and "longitude" in img
        }

        features = []
        for area in areas:
            state_name = area["title"].strip().upper()
            if "REGION" in state_name or "COUNTRY" in state_name:
                continue

            # Clean state name for matching
            state_clean = state_name.replace(" (UT)", "").replace(" & ", " AND ").strip()

            coords = None
            for key, coord in coord_map.items():
                key_clean = key.replace(" AND ", " & ").strip()
                if key_clean in state_clean or state_clean in key_clean:
                    coords = coord
                    break
            if not coords:
                print(f"No coordinates found for {state_name}")
                continue

            balloon = area.get("balloonText", "") or ""
            actual_match = re.search(r'Actual\s*:\s*([\d.]+)', balloon)
            normal_match = re.search(r'Normal\s*:\s*([\d.]+)', balloon)
            departure_match = re.search(r'Departure\s*:\s*([-+0-9.%]+)', balloon)

            actual_val = f"{actual_match.group(1)} mm" if actual_match else "0 mm"
            normal_val = f"{normal_match.group(1)} mm" if normal_match else "0 mm"
            dep_val = departure_match.group(1) if departure_match else area.get("info", "")

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": coords
                },
                "properties": {
                    "state": state_name.title(),
                    "state_id": area.get("id", ""),
                    "actual_rainfall": actual_val,
                    "normal_rainfall": normal_val,
                    "departure": dep_val,
                    "category": self.get_rainfall_category(dep_val),
                    "color": area.get("color", "#FFFFFF"),
                    "data_source": "India Meteorological Department",
                    "last_updated": extracted_date
                }
            })

        geojson = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "title": "India State-wise Rainfall Data",
                "source": "India Meteorological Department",
                "total_states": len(features),
                "legend": {
                    "No Rain": {"range": "-100%", "color": "#FFFFFF"},
                    "Large Deficient": {"range": "-99% to -60%", "color": "#FFFF00"},
                    "Deficient": {"range": "-59% to -20%", "color": "#FF0012"},
                    "Normal": {"range": "-19% to 19%", "color": "#00FF3E"},
                    "Excess": {"range": "20% to 59%", "color": "#58CCED"},
                    "Large Excess": {"range": "≥60%", "color": "#3895D3"}
                }
            }
        }

        cache.set(CACHE_KEY, geojson, CACHE_TIMEOUT)
        return Response(geojson)
    
class WeeklyRainfallGeoJSONAPIView(APIView):
    permission_classes = [AllowAny]

    def extract_js_object(self, html_content, var_name):
        start_pattern = f'var {var_name} ='
        start_index = html_content.find(start_pattern)
        if start_index == -1:
            print("Var not found")
            return None
        start_index += len(start_pattern)

        brace_start = html_content.find('{', start_index)
        if brace_start == -1:
            print("Brace not found")
            return None

        brace_count = 0
        i = brace_start
        while i < len(html_content):
            char = html_content[i]
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    js_str = html_content[brace_start:i + 1]
                    break
            i += 1
        else:
            print("End of file without closing brace")
            return None

        js_str = js_str.rstrip('; \n\t ')
        js_str = re.sub(r'//.*?$', '', js_str, flags=re.MULTILINE)
        js_str = re.sub(r',\s*([}\]])', r'\1', js_str)
        js_str = re.sub(r'([{,])\s*([a-zA-Z0-9_]+)\s*:', r'\1"\2":', js_str)
        js_str = js_str.replace("'", '"')
        js_str = js_str.replace("\\/", "/")
        js_str = js_str.strip()

        try:
            parsed = json.loads(js_str)
            print("Parsed successfully")
            return parsed
        except Exception as e:
            print(f"JSON parse failed: {e}")
            print("JS str preview:", repr(js_str[:500]))
            return None

    def extract_date_from_html(self, html_content):
        """Extract the date range from the Weekly radio button in the HTML"""
        # Look for pattern: Weekly (DD-MM-YYYY To DD-MM-YYYY)
        date_match = re.search(r'Weekly\s*\((\d{2}-\d{2}-\d{4}\s+To\s+\d{2}-\d{2}-\d{4})\)', html_content)
        if date_match:
            return date_match.group(1)
        return "This Week"

    def get_rainfall_category(self, departure_str):
        try:
            if not departure_str or departure_str == "-100%":
                return "No Rain"
            value = int(departure_str.replace("%", ""))
            if value <= -100:
                return "No Rain"
            elif -99 <= value <= -60:
                return "Large Deficient"
            elif -59 <= value <= -20:
                return "Deficient"
            elif -19 <= value <= 19:
                return "Normal"
            elif 20 <= value <= 59:
                return "Excess"
            else:
                return "Large Excess"
        except:
            return "No Data"

    def get(self, request):
        cached_geojson = cache.get(CACHE_KEY + "_weekly")
        if cached_geojson:
            return Response(cached_geojson)

        url = "https://mausam.imd.gov.in/imd_latest/contents/index_rainfall_state_new.php?msg=W"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            html_content = response.text
            print("Fetched HTML length:", len(html_content))
        except Exception as e:
            return Response({"error": f"Fetch failed: {str(e)}"}, status=500)

        # Extract the date from HTML
        extracted_date = self.extract_date_from_html(html_content)

        js_data = self.extract_js_object(html_content, "countrydataprovider")
        if not js_data:
            return Response({"error": "Could not extract JS data"}, status=500)

        areas = js_data.get("areas", [])
        images = js_data.get("images", [])

        coord_map = {
            img["label"].strip().upper(): [img["longitude"], img["latitude"]]
            for img in images if "latitude" in img and "longitude" in img
        }

        features = []
        for area in areas:
            state_name = area["title"].strip().upper()
            if "REGION" in state_name or "COUNTRY" in state_name:
                continue

            state_clean = state_name.replace(" (UT)", "").replace(" & ", " AND ").strip()

            coords = None
            for key, coord in coord_map.items():
                key_clean = key.replace(" AND ", " & ").strip()
                if key_clean in state_clean or state_clean in key_clean:
                    coords = coord
                    break
            if not coords:
                print(f"No coordinates found for {state_name}")
                continue

            balloon = area.get("balloonText", "") or ""
            actual_match = re.search(r'Actual\s*:\s*([\d.]+)', balloon)
            normal_match = re.search(r'Normal\s*:\s*([\d.]+)', balloon)
            departure_match = re.search(r'Departure\s*:\s*([-+0-9.%]+)', balloon)

            actual_val = f"{actual_match.group(1)} mm" if actual_match else "0 mm"
            normal_val = f"{normal_match.group(1)} mm" if normal_match else "0 mm"
            dep_val = departure_match.group(1) if departure_match else area.get("info", "")

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": coords
                },
                "properties": {
                    "state": state_name.title(),
                    "state_id": area.get("id", ""),
                    "actual_rainfall": actual_val,
                    "normal_rainfall": normal_val,
                    "departure": dep_val,
                    "category": self.get_rainfall_category(dep_val),
                    "color": area.get("color", "#FFFFFF"),
                    "data_source": "India Meteorological Department",
                    "last_updated": extracted_date
                }
            })

        geojson = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "title": "India State-wise Weekly Rainfall Data",
                "source": "India Meteorological Department",
                "total_states": len(features),
                "legend": {
                    "No Rain": {"range": "-100%", "color": "#FFFFFF"},
                    "Large Deficient": {"range": "-99% to -60%", "color": "#FFFF00"},
                    "Deficient": {"range": "-59% to -20%", "color": "#FF0012"},
                    "Normal": {"range": "-19% to 19%", "color": "#00FF3E"},
                    "Excess": {"range": "20% to 59%", "color": "#58CCED"},
                    "Large Excess": {"range": "≥60%", "color": "#3895D3"}
                }
            }
        }

        cache.set(CACHE_KEY + "_weekly", geojson, CACHE_TIMEOUT)

        return Response(geojson)


class MonthlyRainfallGeoJSONAPIView(APIView):
    permission_classes = [AllowAny]

    def extract_js_object(self, html_content, var_name):
        start_pattern = f'var {var_name} ='
        start_index = html_content.find(start_pattern)
        if start_index == -1:
            print("Var not found")
            return None
        start_index += len(start_pattern)

        brace_start = html_content.find('{', start_index)
        if brace_start == -1:
            print("Brace not found")
            return None

        brace_count = 0
        i = brace_start
        while i < len(html_content):
            char = html_content[i]
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    js_str = html_content[brace_start:i + 1]
                    break
            i += 1
        else:
            print("End of file without closing brace")
            return None

        js_str = js_str.rstrip('; \n\t ')
        js_str = re.sub(r'//.*?$', '', js_str, flags=re.MULTILINE)
        js_str = re.sub(r',\s*([}\]])', r'\1', js_str)
        js_str = re.sub(r'([{,])\s*([a-zA-Z0-9_]+)\s*:', r'\1"\2":', js_str)
        js_str = js_str.replace("'", '"')
        js_str = js_str.replace("\\/", "/")
        js_str = js_str.strip()

        try:
            parsed = json.loads(js_str)
            print("Parsed successfully")
            return parsed
        except Exception as e:
            print(f"JSON parse failed: {e}")
            print("JS str preview:", repr(js_str[:500]))
            return None

    def extract_date_from_html(self, html_content):
        """Extract the date range from the Monthly radio button in the HTML"""
        # Look for pattern: Monthly (DD-MM-YYYY To DD-MM-YYYY)
        date_match = re.search(r'Monthly\s*\((\d{2}-\d{2}-\d{4}\s+To\s+\d{2}-\d{2}-\d{4})', html_content)
        if date_match:
            return date_match.group(1)
        return "This Month"

    def get_rainfall_category(self, departure_str):
        try:
            if not departure_str or departure_str == "-100%":
                return "No Rain"
            value = int(departure_str.replace("%", ""))
            if value <= -100:
                return "No Rain"
            elif -99 <= value <= -60:
                return "Large Deficient"
            elif -59 <= value <= -20:
                return "Deficient"
            elif -19 <= value <= 19:
                return "Normal"
            elif 20 <= value <= 59:
                return "Excess"
            else:
                return "Large Excess"
        except:
            return "No Data"

    def get(self, request):
        cached_geojson = cache.get(CACHE_KEY + "_monthly")
        if cached_geojson:
            return Response(cached_geojson)

        url = "https://mausam.imd.gov.in/imd_latest/contents/index_rainfall_state_new.php?msg=M"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            html_content = response.text
            print("Fetched HTML length:", len(html_content))
        except Exception as e:
            return Response({"error": f"Fetch failed: {str(e)}"}, status=500)

        # Extract the date from HTML
        extracted_date = self.extract_date_from_html(html_content)

        js_data = self.extract_js_object(html_content, "countrydataprovider")
        if not js_data:
            return Response({"error": "Could not extract JS data"}, status=500)

        areas = js_data.get("areas", [])
        images = js_data.get("images", [])

        coord_map = {
            img["label"].strip().upper(): [img["longitude"], img["latitude"]]
            for img in images if "latitude" in img and "longitude" in img
        }

        features = []
        for area in areas:
            state_name = area["title"].strip().upper()
            if "REGION" in state_name or "COUNTRY" in state_name:
                continue

            state_clean = state_name.replace(" (UT)", "").replace(" & ", " AND ").strip()

            coords = None
            for key, coord in coord_map.items():
                key_clean = key.replace(" AND ", " & ").strip()
                if key_clean in state_clean or state_clean in key_clean:
                    coords = coord
                    break
            if not coords:
                print(f"No coordinates found for {state_name}")
                continue

            balloon = area.get("balloonText", "") or ""
            actual_match = re.search(r'Actual\s*:\s*([\d.]+)', balloon)
            normal_match = re.search(r'Normal\s*:\s*([\d.]+)', balloon)
            departure_match = re.search(r'Departure\s*:\s*([-+0-9.%]+)', balloon)

            actual_val = f"{actual_match.group(1)} mm" if actual_match else "0 mm"
            normal_val = f"{normal_match.group(1)} mm" if normal_match else "0 mm"
            dep_val = departure_match.group(1) if departure_match else area.get("info", "")

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": coords
                },
                "properties": {
                    "state": state_name.title(),
                    "state_id": area.get("id", ""),
                    "actual_rainfall": actual_val,
                    "normal_rainfall": normal_val,
                    "departure": dep_val,
                    "category": self.get_rainfall_category(dep_val),
                    "color": area.get("color", "#FFFFFF"),
                    "data_source": "India Meteorological Department",
                    "last_updated": extracted_date
                }
            })

        geojson = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "title": "India State-wise Monthly Rainfall Data",
                "source": "India Meteorological Department",
                "total_states": len(features),
                "legend": {
                    "No Rain": {"range": "-100%", "color": "#FFFFFF"},
                    "Large Deficient": {"range": "-99% to -60%", "color": "#FFFF00"},
                    "Deficient": {"range": "-59% to -20%", "color": "#FF0012"},
                    "Normal": {"range": "-19% to 19%", "color": "#00FF3E"},
                    "Excess": {"range": "20% to 59%", "color": "#58CCED"},
                    "Large Excess": {"range": "≥60%", "color": "#3895D3"}
                }
            }
        }

        cache.set(CACHE_KEY + "_monthly", geojson, CACHE_TIMEOUT)

        return Response(geojson)


class CumulativeRainfallGeoJSONAPIView(APIView):
    permission_classes = [AllowAny]

    def extract_js_object(self, html_content, var_name):
        start_pattern = f'var {var_name} ='
        start_index = html_content.find(start_pattern)
        if start_index == -1:
            print("Var not found")
            return None
        start_index += len(start_pattern)

        brace_start = html_content.find('{', start_index)
        if brace_start == -1:
            print("Brace not found")
            return None

        brace_count = 0
        i = brace_start
        while i < len(html_content):
            char = html_content[i]
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    js_str = html_content[brace_start:i + 1]
                    break
            i += 1
        else:
            print("End of file without closing brace")
            return None

        js_str = js_str.rstrip('; \n\t ')
        js_str = re.sub(r'//.*?$', '', js_str, flags=re.MULTILINE)
        js_str = re.sub(r',\s*([}\]])', r'\1', js_str)
        js_str = re.sub(r'([{,])\s*([a-zA-Z0-9_]+)\s*:', r'\1"\2":', js_str)
        js_str = js_str.replace("'", '"')
        js_str = js_str.replace("\\/", "/")
        js_str = js_str.strip()

        try:
            parsed = json.loads(js_str)
            print("Parsed successfully")
            return parsed
        except Exception as e:
            print(f"JSON parse failed: {e}")
            print("JS str preview:", repr(js_str[:500]))
            return None

    def extract_date_from_html(self, html_content):
        """Extract the date range from the Cumulative radio button in the HTML"""
        # Look for pattern: Cumulative (DD-MM-YYYY To DD-MM-YYYY)
        date_match = re.search(r'Cumulative\s*\((\d{2}-\d{2}-\d{4}\s+To\s+\d{2}-\d{2}-\d{4})\)', html_content)
        if date_match:
            return date_match.group(1)
        return "Cumulative"

    def get_rainfall_category(self, departure_str):
        try:
            if not departure_str or departure_str == "-100%":
                return "No Rain"
            value = int(departure_str.replace("%", ""))
            if value <= -100:
                return "No Rain"
            elif -99 <= value <= -60:
                return "Large Deficient"
            elif -59 <= value <= -20:
                return "Deficient"
            elif -19 <= value <= 19:
                return "Normal"
            elif 20 <= value <= 59:
                return "Excess"
            else:
                return "Large Excess"
        except:
            return "No Data"

    def get(self, request):
        cached_geojson = cache.get(CACHE_KEY + "_cumulative")
        if cached_geojson:
            return Response(cached_geojson)

        url = "https://mausam.imd.gov.in/imd_latest/contents/index_rainfall_state_new.php?msg=C"

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            html_content = response.text
            print("Fetched HTML length:", len(html_content))
        except Exception as e:
            return Response({"error": f"Fetch failed: {str(e)}"}, status=500)

        # Extract the date from HTML
        extracted_date = self.extract_date_from_html(html_content)

        js_data = self.extract_js_object(html_content, "countrydataprovider")
        if not js_data:
            return Response({"error": "Could not extract JS data"}, status=500)

        areas = js_data.get("areas", [])
        images = js_data.get("images", [])

        coord_map = {
            img["label"].strip().upper(): [img["longitude"], img["latitude"]]
            for img in images if "latitude" in img and "longitude" in img
        }

        features = []
        for area in areas:
            state_name = area["title"].strip().upper()
            if "REGION" in state_name or "COUNTRY" in state_name:
                continue

            state_clean = state_name.replace(" (UT)", "").replace(" & ", " AND ").strip()

            coords = None
            for key, coord in coord_map.items():
                key_clean = key.replace(" AND ", " & ").strip()
                if key_clean in state_clean or state_clean in key_clean:
                    coords = coord
                    break
            if not coords:
                print(f"No coordinates found for {state_name}")
                continue

            balloon = area.get("balloonText", "") or ""
            actual_match = re.search(r'Actual\s*:\s*([\d.]+)', balloon)
            normal_match = re.search(r'Normal\s*:\s*([\d.]+)', balloon)
            departure_match = re.search(r'Departure\s*:\s*([-+0-9.%]+)', balloon)

            actual_val = f"{actual_match.group(1)} mm" if actual_match else "0 mm"
            normal_val = f"{normal_match.group(1)} mm" if normal_match else "0 mm"
            dep_val = departure_match.group(1) if departure_match else area.get("info", "")

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": coords
                },
                "properties": {
                    "state": state_name.title(),
                    "state_id": area.get("id", ""),
                    "actual_rainfall": actual_val,
                    "normal_rainfall": normal_val,
                    "departure": dep_val,
                    "category": self.get_rainfall_category(dep_val),
                    "color": area.get("color", "#FFFFFF"),
                    "data_source": "India Meteorological Department",
                    "last_updated": extracted_date
                }
            })

        geojson = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "title": "India State-wise Cumulative Rainfall Data",
                "source": "India Meteorological Department",
                "total_states": len(features),
                "legend": {
                    "No Rain": {"range": "-100%", "color": "#FFFFFF"},
                    "Large Deficient": {"range": "-99% to -60%", "color": "#FFFF00"},
                    "Deficient": {"range": "-59% to -20%", "color": "#FF0012"},
                    "Normal": {"range": "-19% to 19%", "color": "#00FF3E"},
                    "Excess": {"range": "20% to 59%", "color": "#58CCED"},
                    "Large Excess": {"range": "≥60%", "color": "#3895D3"}
                }
            }
        }

        cache.set(CACHE_KEY + "_cumulative", geojson, CACHE_TIMEOUT)

        return Response(geojson)