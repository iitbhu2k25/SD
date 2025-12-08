from rest_framework import serializers
from .models import ShapefileRecord

class ShapefileRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShapefileRecord
        fields = ['fid', 'shapefile_name', 'shapefile_path']
