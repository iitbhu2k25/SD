from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import ShapefileRecord
from .serializers import ShapefileRecordSerializer
from rest_framework.permissions import AllowAny
class ShapefileListAPIView(APIView):
    permission_classes = [AllowAny]
    def get(self, request):
        try:
            shapefiles = ShapefileRecord.objects.all().order_by('fid')
            serializer = ShapefileRecordSerializer(shapefiles, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
