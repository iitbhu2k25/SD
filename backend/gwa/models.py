# gwa/models.py

from django.db import models

class State(models.Model):
    state_code = models.IntegerField(primary_key=True)
    state_name = models.CharField(max_length=40)

    def __str__(self):
        return f"{self.state_name}"


class District(models.Model):
    district_code = models.IntegerField(primary_key=True)
    district_name = models.CharField(max_length=40)
    state_code = models.ForeignKey(State, to_field='state_code', on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.district_name}"


class Subdistrict(models.Model):
    subdistrict_code = models.IntegerField(primary_key=True)
    subdistrict_name = models.CharField(max_length=40)
    district_code = models.ForeignKey(District, to_field='district_code', on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.subdistrict_name}"


class Village(models.Model):
    village_code = models.IntegerField(primary_key=True)
    village_name = models.CharField(max_length=100)
    population_2011 = models.IntegerField()
    subdistrict_code = models.ForeignKey(Subdistrict, to_field='subdistrict_code', on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.village_name} ({self.population_2011})"



class Well(models.Model):
    # Foreign Key relation to Village (village_code must match)
    village_code = models.ForeignKey(
        Village,
        to_field='village_code',
        db_column='village_code',  # <-- force column name to be 'village_code'
        on_delete=models.CASCADE
    )

    # Attributes from CSV
    FID_clip = models.IntegerField(unique=True)
    OBJECTID = models.IntegerField()
    shapeName = models.CharField(max_length=100, null=True, blank=True)
    SUB_DISTRI = models.CharField(max_length=100, null=True, blank=True)
    DISTRICT_C = models.IntegerField(null=True, blank=True)
    DISTRICT = models.CharField(max_length=100, null=True, blank=True)
    STATE_CODE = models.IntegerField(null=True, blank=True)
    STATE = models.CharField(max_length=100, null=True, blank=True)
    population = models.IntegerField(null=True, blank=True)
    SUBDIS_COD = models.IntegerField(null=True, blank=True)
    Area = models.FloatField(null=True, blank=True)
    DISTRICT_1 = models.CharField(max_length=100, null=True, blank=True)
    BLOCK = models.CharField(max_length=100, null=True, blank=True)
    HYDROGRAPH = models.CharField(max_length=100, null=True, blank=True)
    LONGITUDE = models.FloatField(null=True, blank=True)
    LATITUDE = models.FloatField(null=True, blank=True)
    RL = models.FloatField(null=True, blank=True)

    # Time-series data: Pre/Post for 2011 to 2020
    PRE_2011 = models.FloatField(null=True, blank=True)
    POST_2011 = models.FloatField(null=True, blank=True)
    PRE_2012 = models.FloatField(null=True, blank=True)
    POST_2012 = models.FloatField(null=True, blank=True)
    PRE_2013 = models.FloatField(null=True, blank=True)
    POST_2013 = models.FloatField(null=True, blank=True)
    PRE_2014 = models.FloatField(null=True, blank=True)
    POST_2014 = models.FloatField(null=True, blank=True)
    PRE_2015 = models.FloatField(null=True, blank=True)
    POST_2015 = models.FloatField(null=True, blank=True)
    PRE_2016 = models.FloatField(null=True, blank=True)
    POST_2016 = models.FloatField(null=True, blank=True)
    PRE_2017 = models.FloatField(null=True, blank=True)
    POST_2017 = models.FloatField(null=True, blank=True)
    PRE_2018 = models.FloatField(null=True, blank=True)
    POST_2018 = models.FloatField(null=True, blank=True)
    PRE_2019 = models.FloatField(null=True, blank=True)
    POST_2019 = models.FloatField(null=True, blank=True)
    PRE_2020 = models.FloatField(null=True, blank=True)
    POST_2020 = models.FloatField(null=True, blank=True)

    def __str__(self):
        return f"Well FID {self.FID_clip} in village {self.village_code_id}"
    
class Crop(models.Model):
    season = models.CharField(max_length=100)
    crop = models.CharField(max_length=100)
    stage = models.CharField(max_length=100)
    period = models.CharField(max_length=100)
    crop_factor = models.FloatField()

    def __str__(self):
        return f"{self.crop}"