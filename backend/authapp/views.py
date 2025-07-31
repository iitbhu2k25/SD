from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from .models import LoginCredential
from django.conf import settings
import json

@csrf_exempt
def home(request):
    username = request.session.get('username')
    if username:
        return JsonResponse({'message': f'Welcome back, {username}!'})
    return JsonResponse({'message': 'You are not logged in'}, status=401)

@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        try:
            user = LoginCredential.objects.get(username=username)
            if user.password == password:
                request.session['username'] = user.username
                return JsonResponse({'message': 'Login successful'})
            else:
                return JsonResponse({'message': 'Invalid credentials'}, status=401)
        except LoginCredential.DoesNotExist:
            return JsonResponse({'message': 'User does not exist'}, status=401)

@csrf_exempt
def logout_view(request):
    if request.method == 'POST':
        request.session.flush()
        return JsonResponse({'message': 'Logged out successfully'})


def home(request):
    return HttpResponse(f"Loaded home! SETTINGS_MODULE = {settings.SETTINGS_MODULE}")