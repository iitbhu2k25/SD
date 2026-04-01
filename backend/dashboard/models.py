# backend/dashboard/models.py

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

# ============================================
# DRAIN WATER QUALITY MODEL (EXISTING)
# ============================================

class DrainWaterQuality(models.Model):
    location = models.CharField(max_length=150)
    ph = models.FloatField()
    temp = models.FloatField()
    ec_us_cm = models.FloatField("EC (µS/cm)")
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
    
    sampling_time = models.DateTimeField(
        null=True, 
        blank=True, 
        help_text="Date and time when the water sample was collected"
    )
    
    class Meta:
        db_table = 'dashboard_drainwaterquality'
        ordering = ['-sampling_time']
        verbose_name = "Drain Water Quality Data"
        verbose_name_plural = "Drain Water Quality Data"
        indexes = [
            models.Index(fields=['-sampling_time']),
            models.Index(fields=['location']),
            models.Index(fields=['stream']),
        ]

    def __str__(self):
        if self.sampling_time:
            time_str = self.sampling_time.strftime('%Y-%m-%d %H:%M')
            return f"{self.location} - {time_str}"
        return f"{self.location} - No date"


# ============================================
# STORY MAP STATIONS MODEL (NEW)
# ============================================

class StoryMapStation(models.Model):
    """Model for MapStory stations with dynamic data"""
    
    id = models.CharField(
        max_length=50, 
        unique=True, 
        primary_key=True,
        help_text="Unique identifier (e.g., 'station-1')"
    )
    
    location = models.CharField(
        max_length=255,
        help_text="Station location name (e.g., 'Mahadev Mandir')"
    )
    
    image_path = models.URLField(
        max_length=500,
        help_text="URL to station image (e.g., '/Images/dashboard/varuna1.png')"
    )
    
    lat = models.FloatField(
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
        help_text="Latitude coordinate"
    )
    
    lon = models.FloatField(
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
        help_text="Longitude coordinate"
    )
    
    description = models.TextField(
        help_text="Detailed station description"
    )
    
    remarks = models.TextField(
        null=True,
        blank=True,
        help_text="Additional remarks or notes about the station"
    )
    
    other = models.TextField(
        null=True,
        blank=True,
        help_text="Other information or metadata"
    )
    
    class Meta:
        db_table = 'dashboard_mapstory'
        ordering = ['location']
        verbose_name = "Map Story Station"
        verbose_name_plural = "Map Story Stations"
        indexes = [
            models.Index(fields=['location']),
            models.Index(fields=['lat', 'lon']),
        ]
    
    def __str__(self):
        return f"{self.location} - ({self.lat:.4f}, {self.lon:.4f})"
    
    def to_dict(self):
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'location': self.location,
            'image': self.image_path,
            'lat': self.lat,
            'lon': self.lon,
            'description': self.description,
            'remarks': self.remarks,
            'other': self.other,
        }


class DashboardDepth(models.Model):
    district = models.CharField(max_length=100)
    year = models.PositiveSmallIntegerField()
    season = models.CharField(max_length=30)
    depth_m = models.DecimalField(max_digits=5, decimal_places=2)
    description = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'dashboard_depth'
        unique_together = ('district', 'year', 'season')


class DashboardRainfall(models.Model):
    district = models.CharField(max_length=100, db_index=True)
    year = models.PositiveSmallIntegerField(db_index=True)
    annual_rainfall = models.DecimalField(max_digits=15, decimal_places=10)
    observation = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'dashboard_rainfall'
        unique_together = ('district', 'year')


class DashboardDistribution(models.Model):
    year = models.CharField(max_length=20, db_index=True)
    category = models.CharField(max_length=100, db_index=True)
    percentage = models.DecimalField(max_digits=6, decimal_places=2)
    observation = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'dashboard_distribution'
        unique_together = ('year', 'category')


class DashboardIndustrialPollution(models.Model):
    district = models.CharField(max_length=100, db_index=True)
    category = models.CharField(max_length=100, db_index=True)
    pollution_index = models.CharField(max_length=50, null=True, blank=True)
    observation = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'dashboard_industrial_pollution'
