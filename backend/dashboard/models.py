from django.db import models

class DrainWaterQuality(models.Model):
    location = models.CharField(max_length=150)
    ph = models.FloatField()
    temp = models.FloatField()
    ec_us_cm = models.FloatField("EC (μS/cm)")
    tds_ppm = models.FloatField("TDS (ppm)")
    do_mg_l = models.FloatField("DO (mg/L)")
    turbidity = models.FloatField()
    tss_mg_l = models.FloatField("TSS (mg/L)")
    cod = models.FloatField()
    bod_mg_l = models.FloatField("BOD (mg/L)")
    ts_mg_l = models.FloatField("TS (mg/L)")
    chloride = models.FloatField()
    nitrate = models.FloatField(null=True, blank=True)
    faecal_col = models.CharField(max_length=100, null=True, blank=True)
    total_col = models.CharField(max_length=100, null=True, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lon = models.FloatField(null=True, blank=True)
    stream = models.CharField(max_length=255, null=True, blank=True)
    observation = models.TextField(null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)

    def __str__(self):
        return self.location
