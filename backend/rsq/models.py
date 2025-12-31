from django.db import models

class GroundWaterData(models.Model):

    # Location Codes
    village_co = models.BigIntegerField(db_index=True)
    block_code = models.BigIntegerField(db_index=True)
    district_code = models.FloatField(null=True, blank=True)
    subdistrict_code = models.FloatField(null=True, blank=True)

    # Time
    year = models.CharField(max_length=10, db_index=True)

    # Area & Factor
    factor = models.FloatField(null=True, blank=True)
    village_area = models.FloatField(null=True, blank=True)
    block_area = models.FloatField(null=True, blank=True)
    total_geographical_area = models.FloatField(null=True, blank=True)
    recharge_worthy_area = models.FloatField(null=True, blank=True)

    # Recharge (MON / NM)
    recharge_rainfall_mon = models.FloatField(null=True, blank=True)
    recharge_other_mon = models.FloatField(null=True, blank=True)
    recharge_rainfall_nm = models.FloatField(null=True, blank=True)
    recharge_other_nm = models.FloatField(null=True, blank=True)

    # Groundwater Balance
    total_annual_recharge = models.FloatField(null=True, blank=True)
    total_natural_discharge = models.FloatField(null=True, blank=True)
    extractable_resource = models.FloatField(null=True, blank=True)

    # Usage
    irrigation_use = models.FloatField(null=True, blank=True)
    industrial_use = models.FloatField(null=True, blank=True)
    domestic_use = models.FloatField(null=True, blank=True)
    total_extraction = models.FloatField(null=True, blank=True)

    # Future Availability
    annual_gw_allocation_domestic = models.FloatField(null=True, blank=True)
    net_future_availability = models.FloatField(null=True, blank=True)

    # Status
    bo_aquifer = models.FloatField(null=True, blank=True)
    stage_of_extraction = models.CharField(max_length=50, null=True, blank=True)
    category = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = "village_groundwater"
        indexes = [
            models.Index(fields=["village_co", "year"]),
            models.Index(fields=["block_code"]),
        ]

    def __str__(self):
        return f"{self.village_co} - {self.year}"




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

