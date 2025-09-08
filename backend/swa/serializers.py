from rest_framework import serializers
from .models import SubbasinFlow

class SubbasinFlowSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubbasinFlow
        fields = "__all__"
