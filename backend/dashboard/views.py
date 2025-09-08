from django.http import JsonResponse
from .models import DrainWaterQuality

def get_drain_water_quality(request):
    data = DrainWaterQuality.objects.all().values()
    return JsonResponse(list(data), safe=False)
