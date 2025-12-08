from django.db import models

class ShapefileRecord(models.Model):
    fid = models.AutoField(primary_key=True)
    shapefile_name = models.CharField(max_length=255)
    shapefile_path = models.CharField(max_length=500)

    class Meta:
        db_table = 'shapefile_record'
        verbose_name = "Shapefile Record"
        verbose_name_plural = "Shapefile Records"

    def __str__(self):
        return self.shapefile_name
