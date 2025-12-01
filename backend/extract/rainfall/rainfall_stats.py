import io
import re
import zipfile
import requests
from django.http import HttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from bs4 import BeautifulSoup
from urllib.parse import urljoin

class StatewiseDistributionAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            url = "https://mausam.imd.gov.in/imd_latest/contents/rainfall_statistics.php"
            html = requests.get(url, timeout=30, verify=False).text
            soup = BeautifulSoup(html, 'html.parser')
            img = soup.find('img', src=re.compile(r'.*Rainfall.*\.(png|gif|jpg)'))
            if not img or not img.get('src'):
                return JsonResponse({'error': 'Image not found'}, status=404)
            src = img['src']
            if src.startswith('../../'):
                src = 'https://mausam.imd.gov.in/' + src.replace('../../', '')
            elif src.startswith('../'):
                src = 'https://mausam.imd.gov.in/imd_latest/' + src.replace('../', '')
            elif src.startswith('/'):
                src = 'https://mausam.imd.gov.in' + src
            elif not src.startswith('http'):
                src = f'https://mausam.imd.gov.in/imd_latest/contents/{src}'

            # Fetch the image content
            image_response = requests.get(src, timeout=30, verify=False)
            image_response.raise_for_status()

            content_type = image_response.headers.get('Content-Type', 'image/png')
            return HttpResponse(image_response.content, content_type=content_type)

        except requests.RequestException as e:
            return JsonResponse({'error': f'Failed to fetch image: {str(e)}'}, status=502)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)

class StatewiseDistributionDailyCummAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            url = "https://mausam.imd.gov.in/imd_latest/contents/rainfall_statistics_4.php"
            html = requests.get(url, timeout=30, verify=False).text
            soup = BeautifulSoup(html, 'html.parser')
            img = soup.find('img', src=re.compile(r'.*Rainfall.*\.(png|gif|jpg)'))
            if not img or not img.get('src'):
                return JsonResponse({'error': 'Image not found'}, status=404)
            src = img['src']
            if src.startswith('../../'):
                src = 'https://mausam.imd.gov.in/' + src.replace('../../', '')
            elif src.startswith('../'):
                src = 'https://mausam.imd.gov.in/imd_latest/' + src.replace('../', '')
            elif src.startswith('/'):
                src = 'https://mausam.imd.gov.in' + src
            elif not src.startswith('http'):
                src = f'https://mausam.imd.gov.in/imd_latest/contents/{src}'

            # Fetch the image content
            image_response = requests.get(src, timeout=30, verify=False)
            image_response.raise_for_status()

            content_type = image_response.headers.get('Content-Type', 'image/png')
            return HttpResponse(image_response.content, content_type=content_type)

        except requests.RequestException as e:
            return JsonResponse({'error': f'Failed to fetch image: {str(e)}'}, status=502)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)



class DistrictWeekCummulativeAPIView(APIView):
    permission_classes = [AllowAny]

    INTERNAL_URL = "https://mausam.imd.gov.in/imd_latest/contents/rainfall_statistics_1.php"

    def get(self, request):
        try:
            page_response = requests.get(self.INTERNAL_URL, timeout=30, verify=False)
            page_response.raise_for_status()
            html = page_response.text
            soup = BeautifulSoup(html, 'html.parser')

            # Find all <img> tags with src containing "/Rainfall/tmpa/"
            imgs = [img for img in soup.find_all('img') if img.get('src') and "/Rainfall/tmpa/" in img['src']]
            if not imgs:
                return JsonResponse({'error': 'No images found with path /Rainfall/tmpa/'}, status=404)

            # Create ZIP archive in memory
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w") as zipf:
                for i, img in enumerate(imgs):
                    src = img['src']
                    img_url = urljoin(self.INTERNAL_URL, src)
                    img_resp = requests.get(img_url, timeout=30, verify=False)
                    img_resp.raise_for_status()

                    # Derive filename
                    filename = src.split('/')[-1] or f'image_{i}.png'
                    zipf.writestr(filename, img_resp.content)

            zip_buffer.seek(0)
            response = HttpResponse(zip_buffer.read(), content_type='application/zip')
            response['Content-Disposition'] = 'attachment; filename="rainfall_tmpa_images.zip"'
            return response

        except requests.RequestException as e:
            return JsonResponse({'error': f'Error fetching images: {str(e)}'}, status=502)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
        
class DistrictWeeklyAPIView(APIView):
    permission_classes = [AllowAny]

    INTERNAL_URL = "https://mausam.imd.gov.in/imd_latest/contents/rainfall_statistics_2.php"

    def get(self, request):
        try:
            page_response = requests.get(self.INTERNAL_URL, timeout=30, verify=False)
            page_response.raise_for_status()
            html = page_response.text
            soup = BeautifulSoup(html, 'html.parser')

            # Find all <img> tags with src containing "/Rainfall/tmpb/"
            imgs = [img for img in soup.find_all('img') if img.get('src') and "/Rainfall/tmpb/" in img['src']]
            if not imgs:
                return JsonResponse({'error': 'No images found with path /Rainfall/tmpb/'}, status=404)

            # Create ZIP archive in memory
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w") as zipf:
                for i, img in enumerate(imgs):
                    src = img['src']
                    img_url = urljoin(self.INTERNAL_URL, src)
                    img_resp = requests.get(img_url, timeout=30, verify=False)
                    img_resp.raise_for_status()

                    filename = src.split('/')[-1] or f'image_{i}.png'
                    zipf.writestr(filename, img_resp.content)

            zip_buffer.seek(0)
            response = HttpResponse(zip_buffer.read(), content_type='application/zip')
            response['Content-Disposition'] = 'attachment; filename="rainfall_tmpb_images.zip"'
            return response

        except requests.RequestException as e:
            return JsonResponse({'error': f'Error fetching images: {str(e)}'}, status=502)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
        

class DistrictDailyCummAPIView(APIView):
    permission_classes = [AllowAny]

    INTERNAL_URL = "https://mausam.imd.gov.in/imd_latest/contents/rainfall_statistics_3.php"

    def get(self, request):
        try:
            page_response = requests.get(self.INTERNAL_URL, timeout=30, verify=False)
            page_response.raise_for_status()
            html = page_response.text
            soup = BeautifulSoup(html, 'html.parser')

            # Find all <img> tags with src containing "/Rainfall/tmpc/"
            imgs = [img for img in soup.find_all('img') if img.get('src') and "/Rainfall/tmpc/" in img['src']]
            if not imgs:
                return JsonResponse({'error': 'No images found with path /Rainfall/tmpc/'}, status=404)

            # Create in-memory ZIP archive
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w") as zipf:
                for i, img in enumerate(imgs):
                    src = img['src']
                    img_url = urljoin(self.INTERNAL_URL, src)
                    img_resp = requests.get(img_url, timeout=30, verify=False)
                    img_resp.raise_for_status()

                    filename = src.split('/')[-1] or f'image_{i}.png'
                    zipf.writestr(filename, img_resp.content)

            zip_buffer.seek(0)
            response = HttpResponse(zip_buffer.read(), content_type='application/zip')
            response['Content-Disposition'] = 'attachment; filename="rainfall_tmpc_images.zip"'
            return response

        except requests.RequestException as e:
            return JsonResponse({'error': f'Error fetching images: {str(e)}'}, status=502)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)