from django.db import models

class GroundWaterData(models.Model):
    srno = models.BigAutoField(primary_key=True)  

    blockcode = models.IntegerField()
    SUBDIS_COD = models.IntegerField()

    vlcode = models.IntegerField()   

    village = models.CharField(max_length=255)
    blockname = models.CharField(max_length=255, null=True, blank=True)

    Total_Geographical_Area = models.FloatField(null=True, blank=True)
    Recharge_Worthy_Area = models.FloatField(null=True, blank=True)
    Recharge_from_Rainfall_MON = models.FloatField(null=True, blank=True)
    Recharge_from_Other_Sources_MON = models.FloatField(null=True, blank=True)
    Recharge_from_Rainfall_NM = models.FloatField(null=True, blank=True)
    Recharge_from_Other_Sources_NM = models.FloatField(null=True, blank=True)
    Total_Annual_Ground_Water_Recharge = models.FloatField(null=True, blank=True)
    Total_Natural_Discharges = models.FloatField(null=True, blank=True)
    Annual_Extractable_Ground_Water_Resource = models.FloatField(null=True, blank=True)
    Irrigation_Use = models.FloatField(null=True, blank=True)
    Domestic_Use = models.FloatField(null=True, blank=True)
    Total_Extraction = models.FloatField(null=True, blank=True)
    Net_Ground_Water_Availability_for_future_use = models.FloatField(null=True, blank=True)
    Stage_of_Ground_Water_Extraction = models.FloatField(null=True, blank=True)
    Annual_GW_Allocation_for_Domestic_Use_as_on_2025 = models.FloatField(null=True, blank=True)
    Industrial_Use = models.FloatField(null=True, blank=True)

    Year = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.SrNo} - {self.village} ({self.vlcode})"


class Village(models.Model):
    blockcode = models.IntegerField()
    vlcode = models.IntegerField(unique=True)
    village = models.CharField(max_length=255)

    class Meta:
        db_table = "rsq_village"




class Block(models.Model):
    block = models.CharField(max_length=255)        
    blockcode = models.IntegerField(unique=True)  
    district = models.CharField(max_length=255)    
    districtcode = models.IntegerField()          

    class Meta:
        db_table = "rsq_block"  

    def __str__(self):
        return f"{self.block} ({self.blockcode})"

