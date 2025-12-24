from rest_framework import serializers # type: ignore
from .models import Block, Village, GroundWaterData


class BlockSerializer(serializers.ModelSerializer):
    class Meta:
        model = Block
        fields = ['block', 'blockcode', 'district']


class VillageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Village
        fields = ['vlcode', 'village']



class GroundWaterDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = GroundWaterData
        fields = "__all__"   # ✅ RETURNS EVERY COLUMN
