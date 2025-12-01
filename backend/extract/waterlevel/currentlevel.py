from rest_framework.views import APIView #type: ignore
from rest_framework.response import Response #type: ignore
from rest_framework import status #type: ignore
from rest_framework.permissions import AllowAny #type: ignore
from selenium import webdriver #type: ignore
from selenium.webdriver.chrome.options import Options #type: ignore
from selenium.webdriver.common.by import By #type: ignore
from selenium.webdriver.support.ui import WebDriverWait #type: ignore
from selenium.webdriver.support import expected_conditions as EC #type: ignore
import requests
import time
import random
import re
from datetime import datetime
import json


class WaterLevelAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        station_code = request.data.get("station_code")

        if not station_code:
            return Response(
                {"error": "station_code is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # URLs
        dashboard_url = f"https://ffs.india-water.gov.in/#/main/station-detail/{station_code}?_={random.randint(1000,999999)}"
        api_url = f"https://ffs.india-water.gov.in/iam/api/layer-station/{station_code}"

        driver = None
        try:
            # === Use Selenium to capture the actual API request ===
            chrome_options = Options()
            chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--window-size=1920x1080")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            
            # Enable performance logging to capture network requests
            chrome_options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})

            driver = webdriver.Chrome(options=chrome_options)
            
            # Navigate to the dashboard page
            driver.get(dashboard_url)
            
            # Wait for the page to load and make the API call
            time.sleep(5)
            
            # Get all network logs
            logs = driver.get_log('performance')
            
            # Find the API request with detailed response
            detailed_data = None
            for log in logs:
                try:
                    log_entry = json.loads(log['message'])
                    message = log_entry.get('message', {})
                    method = message.get('method', '')
                    
                    # Look for Network.responseReceived events for our API
                    if method == 'Network.responseReceived':
                        params = message.get('params', {})
                        response = params.get('response', {})
                        url = response.get('url', '')
                        
                        if api_url in url:
                            request_id = params.get('requestId')
                            
                            # Get the response body
                            try:
                                response_body = driver.execute_cdp_cmd('Network.getResponseBody', {'requestId': request_id})
                                body_content = response_body.get('body', '')
                                
                                if body_content:
                                    response_data = json.loads(body_content)
                                    
                                    # Check if this is the detailed response
                                    if response_data.get('@class') == 'com.eptisa.layer.station.dto.ForecastDetailLayerStationDto':
                                        detailed_data = response_data
                                        break
                                    # If we haven't found detailed data yet, keep this as fallback
                                    elif detailed_data is None:
                                        detailed_data = response_data
                            except:
                                pass
                except:
                    pass
            
            # If we didn't get detailed data from network logs, try extracting cookies and making request
            if not detailed_data or detailed_data.get('@class') != 'com.eptisa.layer.station.dto.ForecastDetailLayerStationDto':
                # Get all cookies from the browser session
                cookies = driver.get_cookies()
                
                # Create a requests session with the cookies
                session = requests.Session()
                for cookie in cookies:
                    session.cookies.set(cookie['name'], cookie['value'], domain=cookie.get('domain', ''))
                
                # Get the current user-agent from Selenium
                user_agent = driver.execute_script("return navigator.userAgent;")
                
                # Make request with browser cookies and headers
                detailed_headers = {
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Encoding": "gzip, deflate, br, zstd",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Host": "ffs.india-water.gov.in",
                    "Pragma": "no-cache",
                    "Referer": f"https://ffs.india-water.gov.in/",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin",
                    "User-Agent": user_agent,
                    "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"'
                }
                
                detailed_response = session.get(api_url, headers=detailed_headers, timeout=30)
                
                if detailed_response.status_code == 200:
                    detailed_data = detailed_response.json()

            # === Extract live water level ===
            try:
                # Wait for water level element
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.XPATH, "//*[contains(text(),'Present Water Level')]"))
                )
                time.sleep(2)
                
                elements = driver.find_elements(By.XPATH, "//*[contains(text(),'Present Water Level')]/following::div")
                wl_value = None
                for el in elements[:5]:
                    text = el.text.strip()
                    match = re.search(r"(\d+\.?\d*)", text)
                    if match:
                        val = float(match.group(1))
                        if 0 < val < 500:  # Increased range for different stations
                            wl_value = val
                            break
            except:
                wl_value = None

            driver.quit()

            # === Use detailed_data directly if it's the full version ===
            if detailed_data and detailed_data.get('@class') == 'com.eptisa.layer.station.dto.ForecastDetailLayerStationDto':
                metadata = detailed_data
            elif detailed_data:
                metadata = detailed_data
            else:
                metadata = {"error": "Could not fetch metadata"}

            # === Final response ===
            result = {
                "Station_Code": station_code,
                "DateTime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "Present_Water_Level_m": wl_value,
                "Metadata": metadata,
                "Status": "Success" if wl_value is not None else "Partial data"
            }

            return Response(result, status=status.HTTP_200_OK)

        except Exception as e:
            if driver:
                try:
                    driver.quit()
                except:
                    pass
            return Response(
                {"error": f"Failed to fetch data: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )