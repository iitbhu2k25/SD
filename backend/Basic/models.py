from django.db import models

# Create your models here.
class Basic_state(models.Model):
    state_code = models.IntegerField(primary_key=True)
    state_name = models.CharField(max_length=40)

    def __str__(self):
        return f"{self.state_name}"

class Basic_district(models.Model):
    district_code = models.IntegerField(primary_key=True)
    district_name = models.CharField(max_length=40)
    state_code = models.ForeignKey(Basic_state, to_field='state_code', on_delete=models.CASCADE)
    
    def __str__(self):
        return f"{self.district_name}"

class Basic_subdistrict(models.Model):
    subdistrict_code = models.IntegerField(primary_key=True)
    subdistrict_name = models.CharField(max_length=40)
    district_code = models.ForeignKey(Basic_district, to_field='district_code', on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.subdistrict_name}"

class Basic_village(models.Model):
    village_code = models.IntegerField(primary_key=True)
    village_name = models.CharField(max_length=100)
    population_2011 = models.IntegerField()
    subdistrict_code = models.ForeignKey(Basic_subdistrict, to_field='subdistrict_code', on_delete=models.CASCADE)
    
    def __str__(self):
        return f"{self.village_name} ({self.population_2011})"
    
class Population_2011(models.Model):
       subdistrict_code = models.IntegerField(primary_key=True)
       region_name = models.CharField(max_length=40)
       population_1951 = models.BigIntegerField()
       population_1961 = models.BigIntegerField()
       population_1971 = models.BigIntegerField()
       population_1981 = models.BigIntegerField()
       population_1991 = models.BigIntegerField()
       population_2001 = models.BigIntegerField()
       population_2011 = models.BigIntegerField()

       def __str__(self):
           return f"{self.region_name},{self.subdistrict_code},{self.population_1951},{self.population_1961},{self.population_1971},{self.population_1981},{self.population_1991},{self.population_2001},{self.population_2011}"



class PopulationCohort(models.Model):
    state_code = models.BigIntegerField()
    district_code = models.BigIntegerField()
    subdistrict_code = models.BigIntegerField()
    village_code = models.BigIntegerField()

    region_name = models.CharField(max_length=100)
    year = models.IntegerField()
    age_group = models.CharField(max_length=20)
    gender = models.CharField(max_length=10)
    population = models.BigIntegerField()

    def __str__(self):
        return f"{self.region_name}, {self.year}, {self.age_group}, {self.gender}: {self.population}"



class BasicRunoffCoefficient(models.Model):
    # Duration
    duration_t_minutes = models.IntegerField()

    # Sector coefficients
    sector_impervious = models.FloatField()
    sector_60percent_impervious = models.FloatField()
    sector_40percent_impervious = models.FloatField()
    sector_pervious = models.FloatField()

    # Rectangle coefficients
    rectangle_impervious = models.FloatField()
    rectangle_50percent_impervious = models.FloatField()
    rectangle_30percent_impervious = models.FloatField()
    rectangle_pervious = models.FloatField()

    class Meta:
        db_table = "basic_runoffcoefficient"  # PostgreSQL table name
        ordering = ["duration_t_minutes"]

    def __str__(self):
        return f"Runoff Coefficient ({self.duration_t_minutes} min)"


#Below model for boundary of state , district, subdistrict, villages

