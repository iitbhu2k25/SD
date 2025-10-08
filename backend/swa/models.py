from django.db import models

class SubbasinFlow(models.Model):
    sub = models.IntegerField()  
    year = models.IntegerField()
    month = models.IntegerField()
    area_km2 = models.FloatField()
    flow_in_cms = models.FloatField()
    flow_out_cms = models.FloatField()
    yyyyddd = models.IntegerField() 

    class Meta:
        db_table = "subbasin_flow"
        indexes = [
            models.Index(fields=["sub"]),
            models.Index(fields=["year", "month"]),
        ]

    def __str__(self):
        return f"Sub {self.sub} - {self.year}-{self.month}"


class ClimateDrain(models.Model):
    sub = models.IntegerField() 
    year = models.IntegerField()
    mon = models.IntegerField() 
    areakm2 = models.FloatField()
    flow_incms = models.FloatField()
    flow_outcms = models.FloatField()
    yyyymm = models.IntegerField() 
    rch = models.IntegerField()

    class Meta:
        db_table = "climate_drain" 
        indexes = [
            models.Index(fields=["sub"]),
            models.Index(fields=["year", "mon"]),
            models.Index(fields=["yyyymm"]),
            models.Index(fields=["rch"]),
        ]

    def __str__(self):
        return f"Sub {self.sub} - {self.year}-{self.mon}"



class AdminFlow(models.Model): 
    vlcode = models.BigIntegerField()           
    village = models.CharField(max_length=255)  
    year = models.IntegerField()                
    mon = models.IntegerField()                 
    surq_cnt_m3 = models.FloatField()           
    subdistrict_code_id = models.IntegerField(null=True, blank=True)  

    class Meta:
        db_table = "adminflow"  
        verbose_name = "Admin Flow"
        verbose_name_plural = "Admin Flows"

    def __str__(self):
        return f"{self.village} ({self.vlcode}) - {self.year}-{self.mon}"


class ClimateAdmin(models.Model):   
    vlcode = models.BigIntegerField()           
    village = models.CharField(max_length=255)  
    year = models.IntegerField(db_column="YEAR")   
    mon = models.IntegerField(db_column="MON")    
    surq_cnt_m3 = models.FloatField(db_column="SURQ_CNT_m3")  
    source_id = models.IntegerField() 
    subdistrict_code_id = models.IntegerField(null=True, blank=True)  

    class Meta:
        db_table = "climate_admin"  
        verbose_name = "Climate Admin"
        verbose_name_plural = "Climate Admins"

    def __str__(self):
        return f"{self.village} ({self.vlcode}) - {self.year}-{self.mon}"
