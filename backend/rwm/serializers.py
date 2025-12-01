# serializers.py
from rest_framework import serializers
from .models import SamplingPoint, RiverBuffer, InterpolationResult



class InterpolationResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterpolationResult
        fields = '__all__'
