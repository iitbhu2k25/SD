import io
import json
import random
import re
import time
import zipfile
from datetime import datetime
from urllib.parse import urljoin

import pyproj
import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from shapely.geometry import mapping, shape
from shapely.ops import transform


class ExtractService:
    def __init__(self):
        self._cache = {}

    def _cache_get(self, key: str):
        item = self._cache.get(key)
        if not item:
            return None
        expire_ts, value = item
        if time.time() > expire_ts:
            self._cache.pop(key, None)
            return None
        return value

    def _cache_set(self, key: str, value, timeout: int = 900):
        self._cache[key] = (time.time() + timeout, value)

    def _extract_js_object(self, html_content: str, var_name: str):
        start_pattern = f"var {var_name} ="
        start_index = html_content.find(start_pattern)
        if start_index == -1:
            return None
        start_index += len(start_pattern)
        brace_start = html_content.find("{", start_index)
        if brace_start == -1:
            return None
        brace_count = 0
        i = brace_start
        while i < len(html_content):
            char = html_content[i]
            if char == "{":
                brace_count += 1
            elif char == "}":
                brace_count -= 1
                if brace_count == 0:
                    js_str = html_content[brace_start : i + 1]
                    break
            i += 1
        else:
            return None

        js_str = js_str.rstrip("; \n\t ")
        js_str = re.sub(r"//.*?$", "", js_str, flags=re.MULTILINE)
        js_str = re.sub(r",\s*([}\]])", r"\1", js_str)
        js_str = re.sub(r"([{,])\s*([a-zA-Z0-9_]+)\s*:", r'\1"\2":', js_str)
        js_str = js_str.replace("'", '"').replace("\\/", "/").strip()
        try:
            return json.loads(js_str)
        except Exception:
            return None

    def _get_rainfall_category(self, departure_str: str):
        try:
            if not departure_str or departure_str == "-100%":
                return "No Rain"
            value = int(departure_str.replace("%", ""))
            if value <= -100:
                return "No Rain"
            if -99 <= value <= -60:
                return "Large Deficient"
            if -59 <= value <= -20:
                return "Deficient"
            if -19 <= value <= 19:
                return "Normal"
            if 20 <= value <= 59:
                return "Excess"
            return "Large Excess"
        except Exception:
            return "No Data"

    def _state_date(self, html: str, period: str):
        patterns = {
            "D": r"Daily\s*\((\d{2}-\d{2}-\d{4})\)",
            "W": r"Weekly\s*\((\d{2}-\d{2}-\d{4}\s+To\s+\d{2}-\d{2}-\d{4})\)",
            "M": r"Monthly\s*\((\d{2}-\d{2}-\d{4}\s+To\s+\d{2}-\d{2}-\d{4})",
            "C": r"Cumulative\s*\((\d{2}-\d{2}-\d{4}\s+To\s+\d{2}-\d{2}-\d{4})\)",
        }
        defaults = {"D": "Today", "W": "This Week", "M": "This Month", "C": "Cumulative"}
        m = re.search(patterns.get(period, patterns["D"]), html)
        return m.group(1) if m else defaults.get(period, "Today")

    def state_rainfall(self, period: str):
        cache_key = f"imd_state_{period}"
        cached = self._cache_get(cache_key)
        if cached:
            return cached

        url = f"https://mausam.imd.gov.in/imd_latest/contents/index_rainfall_state_new.php?msg={period}"
        r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        r.raise_for_status()
        html = r.text
        js_data = self._extract_js_object(html, "countrydataprovider")
        if not js_data:
            raise ValueError("Could not extract JS data")

        date_str = self._state_date(html, period)
        areas = js_data.get("areas", [])
        images = js_data.get("images", [])
        coord_map = {
            img["label"].strip().upper(): [img["longitude"], img["latitude"]]
            for img in images
            if "latitude" in img and "longitude" in img
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
                continue

            balloon = area.get("balloonText", "") or ""
            actual_match = re.search(r"Actual\s*:\s*([\d.]+)", balloon)
            normal_match = re.search(r"Normal\s*:\s*([\d.]+)", balloon)
            departure_match = re.search(r"Departure\s*:\s*([-+0-9.%]+)", balloon)
            actual_val = f"{actual_match.group(1)} mm" if actual_match else "0 mm"
            normal_val = f"{normal_match.group(1)} mm" if normal_match else "0 mm"
            dep_val = departure_match.group(1) if departure_match else area.get("info", "")

            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": coords},
                    "properties": {
                        "state": state_name.title(),
                        "state_id": area.get("id", ""),
                        "actual_rainfall": actual_val,
                        "normal_rainfall": normal_val,
                        "departure": dep_val,
                        "category": self._get_rainfall_category(dep_val),
                        "color": area.get("color", "#FFFFFF"),
                        "data_source": "India Meteorological Department",
                        "last_updated": date_str,
                    },
                }
            )

        out = {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {"title": f"India State-wise {period} Rainfall Data", "source": "India Meteorological Department", "total_states": len(features)},
        }
        self._cache_set(cache_key, out)
        return out

    def _district_period_dates(self, period: str):
        cache_key = f"imd_period_dates_{period}"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        html = requests.get("https://mausam.imd.gov.in/imd_latest/contents/index_rainfall_state_new.php?msg=D", headers={"User-Agent": "Mozilla/5.0"}, timeout=30).text
        soup = BeautifulSoup(html, "html.parser")
        period_dates = {}
        for radio in soup.find_all("input", {"type": "radio", "name": "group"}):
            value = radio.get("value", "")
            label_text = radio.next_sibling
            if label_text and isinstance(label_text, str):
                label_text = label_text.strip()
                m = re.search(r"\(([^)]+)\)", label_text)
                if m:
                    period_dates[value] = {"label": label_text.split("(")[0].strip(), "date_range": m.group(1).strip()}
        self._cache_set(cache_key, period_dates, timeout=3600)
        return period_dates

    def _extract_areas_from_html(self, html: str):
        soup = BeautifulSoup(html, "html.parser")
        target_script = None
        for script in soup.find_all("script"):
            if script.string and "AmCharts.makeChart" in script.string and '"areas": [' in script.string:
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
            if target_script[i] == "[":
                brace_count += 1
            elif target_script[i] == "]":
                brace_count -= 1
            i += 1
        areas_str = target_script[start_pos : i - 1].strip()
        areas_str = re.sub(r",\s*([}\]]|\s*$)", r"\1", areas_str)
        areas_str = re.sub(r"([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:", r'\1"\2":', areas_str)
        try:
            return json.loads("[" + areas_str + "]")
        except Exception:
            return None

    def _district_geojson(self):
        data = requests.get("https://mausam.imd.gov.in/imd_latest/contents/district_shapefiles/DISTRICT_F-2.json", timeout=20).json()
        source_crs = data.get("crs", {}).get("properties", {}).get("name", "EPSG:32644")
        transformer = pyproj.Transformer.from_crs(source_crs, "EPSG:3857", always_xy=True)
        for feature in data.get("features", []):
            geom = shape(feature["geometry"])
            feature["geometry"] = mapping(transform(transformer.transform, geom))
        data["crs"] = {"type": "name", "properties": {"name": "EPSG:4326"}}
        return data

    def district_rainfall(self, period: str):
        cache_key = f"imd_district_{period}"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        html = requests.get(f"https://mausam.imd.gov.in/imd_latest/contents/rainfallinformation.php?msg={period}", headers={"User-Agent": "Mozilla/5.0"}, timeout=30).text
        areas = self._extract_areas_from_html(html)
        if not areas:
            raise ValueError("Failed to extract rainfall data")
        geojson_data = self._district_geojson()
        title_to_area = {a.get("title", "").upper().strip(): a for a in areas if a.get("title")}
        features = []
        for feature in geojson_data.get("features", []):
            props = feature.get("properties", {})
            district_name = props.get("DISTRICT", "").upper().strip()
            rainfall = title_to_area.get(district_name)
            e = props.copy()
            if rainfall:
                e.update({"rainfall_title": rainfall.get("title", district_name), "rainfall_color": rainfall.get("color", "#D8D8D8"), "rainfall_info": rainfall.get("info", "No Data"), "rainfall_balloonText": rainfall.get("balloonText", "")})
            else:
                e.update({"rainfall_title": district_name, "rainfall_color": "#D8D8D8", "rainfall_info": "No Data", "rainfall_balloonText": f"{district_name} : <br/> Departure : No Data <br/> Actual : 0 mm <br/> Normal : 0 mm"})
            features.append({"type": "Feature", "properties": e, "geometry": feature.get("geometry")})
        p = self._district_period_dates(period).get(period, {})
        out = {"type": "FeatureCollection", "period": period, "period_label": p.get("label", ""), "date_range": p.get("date_range", ""), "metadata": {"title": "India District-wise Rainfall Data", "source": "India Meteorological Department", "period": period}, "features": features}
        self._cache_set(cache_key, out)
        return out

    def _fetch_first_rainfall_image(self, page_url: str):
        html = requests.get(page_url, timeout=30, verify=False).text
        soup = BeautifulSoup(html, "html.parser")
        img = soup.find("img", src=re.compile(r".*Rainfall.*\.(png|gif|jpg)"))
        if not img or not img.get("src"):
            raise ValueError("Image not found")
        src = img["src"]
        if src.startswith("../../"):
            src = "https://mausam.imd.gov.in/" + src.replace("../../", "")
        elif src.startswith("../"):
            src = "https://mausam.imd.gov.in/imd_latest/" + src.replace("../", "")
        elif src.startswith("/"):
            src = "https://mausam.imd.gov.in" + src
        elif not src.startswith("http"):
            src = f"https://mausam.imd.gov.in/imd_latest/contents/{src}"
        r = requests.get(src, timeout=30, verify=False)
        r.raise_for_status()
        return r.content, r.headers.get("Content-Type", "image/png")

    def statewise_distribution(self):
        return self._fetch_first_rainfall_image("https://mausam.imd.gov.in/imd_latest/contents/rainfall_statistics.php")

    def statewise_distribution_dc(self):
        return self._fetch_first_rainfall_image("https://mausam.imd.gov.in/imd_latest/contents/rainfall_statistics_4.php")

    def _zip_stats_images(self, page_url: str, path_fragment: str, zip_name: str):
        html = requests.get(page_url, timeout=30, verify=False).text
        soup = BeautifulSoup(html, "html.parser")
        imgs = [img for img in soup.find_all("img") if img.get("src") and path_fragment in img["src"]]
        if not imgs:
            raise ValueError(f"No images found with path {path_fragment}")
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as zf:
            for i, img in enumerate(imgs):
                src = img["src"]
                img_url = urljoin(page_url, src)
                data = requests.get(img_url, timeout=30, verify=False).content
                filename = src.split("/")[-1] or f"image_{i}.png"
                zf.writestr(filename, data)
        zip_buffer.seek(0)
        return zip_buffer.getvalue(), zip_name

    def district_week_cummulative_stats(self):
        return self._zip_stats_images("https://mausam.imd.gov.in/imd_latest/contents/rainfall_statistics_1.php", "/Rainfall/tmpa/", "rainfall_tmpa_images.zip")

    def district_weekly_stats(self):
        return self._zip_stats_images("https://mausam.imd.gov.in/imd_latest/contents/rainfall_statistics_2.php", "/Rainfall/tmpb/", "rainfall_tmpb_images.zip")

    def district_daily_cumm_stats(self):
        return self._zip_stats_images("https://mausam.imd.gov.in/imd_latest/contents/rainfall_statistics_3.php", "/Rainfall/tmpc/", "rainfall_tmpc_images.zip")

    def river_basin(self, day: str):
        base_url = "https://mausam.imd.gov.in/imd_latest/contents/index_qpf.php"
        url = f"{base_url}?msg={day}"
        html = requests.get(url, timeout=30, verify=False).text
        soup = BeautifulSoup(html, "html.parser")

        precip_dict = {}
        m = re.search(r'"areas":\s*\[(.*?)\](?=\s*\})', html, re.DOTALL)
        if m:
            area_objects = re.findall(r"\{[^}]+\}", "[" + m.group(1) + "]")
            for area_obj in area_objects:
                id_match = re.search(r'"id":\s*"(\d+)"', area_obj)
                title_match = re.search(r'"title":\s*"([^"]+)"', area_obj)
                color_match = re.search(r'"color":\s*"([^"]+)"', area_obj)
                if id_match and title_match and color_match:
                    title = title_match.group(1)
                    parts = title.split("<br>")
                    precip_dict[int(id_match.group(1))] = {"title": title, "basin_name": parts[0] if len(parts) > 0 else "Unknown", "fmo": parts[1].replace("FMO:", "") if len(parts) > 1 else "", "precip": parts[2] if len(parts) > 2 else "0 mm", "color": color_match.group(1), "date": parts[3].replace(" Date:", "").strip() if len(parts) > 3 else ""}

        geojson_url = None
        for script in soup.find_all("script"):
            if script.string and "jQuery.getJSON" in script.string:
                match = re.search(r'jQuery\.getJSON\(["\'](.*?)["\']', script.string)
                if match:
                    geojson_url = urljoin(url, match.group(1))
                    break
        if not geojson_url:
            raise ValueError("GeoJSON URL not found in IMD page")

        geojson_data = requests.get(geojson_url, timeout=30, verify=False).json()
        source_epsg = None
        crs_name = geojson_data.get("crs", {}).get("properties", {}).get("name", "")
        if "EPSG" in crs_name or "epsg" in crs_name:
            em = re.search(r"(\d+)", crs_name)
            if em:
                source_epsg = int(em.group(1))
        if source_epsg is None:
            source_epsg = 4326
        if source_epsg != 3857:
            transformer = pyproj.Transformer.from_crs(f"EPSG:{source_epsg}", "EPSG:3857", always_xy=True)
            for feature in geojson_data.get("features", []):
                feature["geometry"] = mapping(transform(transformer.transform, shape(feature["geometry"])))
        geojson_data["crs"] = {"type": "name", "properties": {"name": "EPSG:3857"}}

        for feature in geojson_data.get("features", []):
            props = feature.get("properties", {})
            object_id = props.get("OBJECTID") or props.get("id") or props.get("ID")
            try:
                basin_data = precip_dict.get(int(object_id))
            except Exception:
                basin_data = None
            if basin_data:
                props.update({"title": basin_data["title"], "color": basin_data["color"], "basin_name": basin_data["basin_name"], "fmo_precip": basin_data["fmo"], "precipitation": basin_data["precip"], "date": basin_data["date"]})
            else:
                props.update({"title": props.get("Subbasin_1", "Unknown"), "color": "#FFFFFF", "precipitation": "0 mm", "date": ""})
        return geojson_data

    def hg_station_data(self, station_code: str, start_date: str, end_date: str):
        url = "https://ffs.india-water.gov.in/web-api/getHGStationDataForFFS/"
        payload = {"stationCode": station_code, "startDate": start_date, "endDate": end_date}
        response = requests.post(url, json=payload, timeout=20)
        if response.status_code != 200:
            return {"error": "External API returned an error", "status_code": response.status_code, "details": response.text}, 502
        try:
            data = response.json()
        except Exception:
            return {"message": "External API returned no valid data", "data": []}, 200
        if not data:
            return {"message": "External API returned no data", "data": []}, 200
        return data, 200

    def water_level(self, station_code: str):
        dashboard_url = f"https://ffs.india-water.gov.in/#/main/station-detail/{station_code}?_={random.randint(1000,999999)}"
        api_url = f"https://ffs.india-water.gov.in/iam/api/layer-station/{station_code}"

        chrome_options = Options()
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920x1080")
        chrome_options.add_argument("--disable-blink-features=AutomationControlled")
        chrome_options.set_capability("goog:loggingPrefs", {"performance": "ALL"})

        driver = None
        try:
            driver = webdriver.Chrome(options=chrome_options)
            driver.get(dashboard_url)
            time.sleep(5)
            logs = driver.get_log("performance")
            detailed_data = None
            for log in logs:
                try:
                    msg = json.loads(log["message"]).get("message", {})
                    if msg.get("method") == "Network.responseReceived":
                        params = msg.get("params", {})
                        response = params.get("response", {})
                        if api_url in response.get("url", ""):
                            request_id = params.get("requestId")
                            body = driver.execute_cdp_cmd("Network.getResponseBody", {"requestId": request_id}).get("body", "")
                            if body:
                                response_data = json.loads(body)
                                if response_data.get("@class") == "com.eptisa.layer.station.dto.ForecastDetailLayerStationDto":
                                    detailed_data = response_data
                                    break
                                if detailed_data is None:
                                    detailed_data = response_data
                except Exception:
                    pass

            if not detailed_data or detailed_data.get("@class") != "com.eptisa.layer.station.dto.ForecastDetailLayerStationDto":
                session = requests.Session()
                for cookie in driver.get_cookies():
                    session.cookies.set(cookie["name"], cookie["value"], domain=cookie.get("domain", ""))
                user_agent = driver.execute_script("return navigator.userAgent;")
                detailed_response = session.get(api_url, headers={"Accept": "application/json, text/plain, */*", "Referer": "https://ffs.india-water.gov.in/", "User-Agent": user_agent}, timeout=30)
                if detailed_response.status_code == 200:
                    detailed_data = detailed_response.json()

            wl_value = None
            try:
                WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Present Water Level')]")))
                time.sleep(2)
                for el in driver.find_elements(By.XPATH, "//*[contains(text(),'Present Water Level')]/following::div")[:5]:
                    m = re.search(r"(\d+\.?\d*)", el.text.strip())
                    if m:
                        val = float(m.group(1))
                        if 0 < val < 500:
                            wl_value = val
                            break
            except Exception:
                wl_value = None

            return {"Station_Code": station_code, "DateTime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "Present_Water_Level_m": wl_value, "Metadata": detailed_data or {"error": "Could not fetch metadata"}, "Status": "Success" if wl_value is not None else "Partial data"}
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass
