from rest_framework import serializers
from .models import Well

class WellSerializer(serializers.ModelSerializer):
    class Meta:
        model = Well
        fields = '__all__'