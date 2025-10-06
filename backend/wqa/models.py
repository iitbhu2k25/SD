# gwa/models.py

from django.db import models
from gwa.models import Village


class Well(models.Model):
    # Foreign Key relation to Village (village_code must match)
    village_code = models.ForeignKey(
        Village,
        to_field='village_code',
        db_column='village_code',  # <-- force column name to be 'village_code'
        on_delete=models.CASCADE,
        related_name='gwa_wells' 
    )

    DISTRICT = models.CharField(max_length=100, null=True, blank=True)
    Location = models.CharField(max_length=100, null=True, blank=True)
    Longitude = models.FloatField(null=True, blank=True)
    Latitude = models.FloatField(null=True, blank=True)
    
    # Water Quality Parameters
    ph_level = models.FloatField(null=True, blank=True, help_text="pH level of water")
    electrical_conductivity = models.FloatField(null=True, blank=True, help_text="Electrical conductivity")
    carbonate = models.FloatField(null=True, blank=True, help_text="Carbonate content")
    bicarbonate = models.FloatField(null=True, blank=True, help_text="Bicarbonate content") 
    chloride = models.FloatField(null=True, blank=True, help_text="Chloride content")
    fluoride = models.FloatField(null=True, blank=True, help_text="Fluoride content")
    sulfate = models.FloatField(null=True, blank=True, help_text="Sulfate content")
    nitrate = models.FloatField(null=True, blank=True, help_text="Nitrate content")
    phosphate = models.FloatField(null=True, blank=True, help_text="Phosphate content")
    Hardness = models.FloatField(null=True, blank=True, help_text="Water hardness")
    
    # Mineral Content
    calcium = models.FloatField(null=True, blank=True, help_text="Calcium content")
    magnesium = models.FloatField(null=True, blank=True, help_text="Magnesium content")
    sodium = models.FloatField(null=True, blank=True, help_text="Sodium content")
    potassium = models.FloatField(null=True, blank=True, help_text="Potassium content")
    
    # Heavy Metals and Contaminants
    iron = models.FloatField(null=True, blank=True, help_text="Iron content")
    arsenic = models.FloatField(null=True, blank=True, help_text="Arsenic content")
    uranium = models.FloatField(null=True, blank=True, help_text="Uranium content")
    
    # Identifiers
    FID_Village = models.IntegerField(null=True, blank=True)
    village = models.CharField(max_length=100, null=True, blank=True)
    
    # Administrative Data
    SUB_DISTRI = models.CharField(max_length=100, null=True, blank=True)
    SUBDIS_COD = models.IntegerField(null=True, blank=True)
    DISTRICT_1 = models.CharField(max_length=100, null=True, blank=True) # Second district field
    DISTRICT_C = models.IntegerField(null=True, blank=True)
    STATE = models.CharField(max_length=100, null=True, blank=True)
    STATE_CODE = models.IntegerField(null=True, blank=True)

    YEAR = models.IntegerField(null=True, blank=True, help_text="Sample collection year")

    def __str__(self):
        return f"Well FID {self.FID_clip} in village {self.village_code_id}"