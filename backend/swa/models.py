from django.db import models

class SubbasinFlow(models.Model):
    sub = models.IntegerField()  # Subbasin ID
    year = models.IntegerField()
    month = models.IntegerField()
    area_km2 = models.FloatField()
    flow_in_cms = models.FloatField()
    flow_out_cms = models.FloatField()
    yyyyddd = models.IntegerField()  # e.g., 2021001

    class Meta:
        db_table = "subbasin_flow"  # Custom table name
        indexes = [
            models.Index(fields=["sub"]),
            models.Index(fields=["year", "month"]),
        ]

    def __str__(self):
        return f"Sub {self.sub} - {self.year}-{self.month}"
