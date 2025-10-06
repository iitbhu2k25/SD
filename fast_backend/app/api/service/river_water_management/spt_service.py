from sqlalchemy.orm import Session
from app.database.crud.location_crud import Stp_State_crud,Stp_drain_new_crud,Stp_District_crud,Stp_Villages_crud,Stp_SubDistrict_crud,Stp_River_crud,Stp_stretches_crud,Stp_drain_crud,Stp_catchment_crud,Stp_towns_crud
from app.database.crud.stp_crud import STP_priority_crud,Stp_area_crud,STP_suitability_crud,STP_visualization_crud,STP_suitability_visualization_crud
from app.conf.settings import Settings
from app.api.schema.stp_schema import STPCategory
import os


class Stp_location:
    def get_state(db:Session,all_data: bool = False):
        states=Stp_State_crud(db).get_states(all_data)
        states=[{'id': state.state_code,'name':state.state_name} for state in states]
        return states

    def get_district(db:Session,payload:dict):
        districts=Stp_District_crud(db).get_district(payload.state,payload.all_data)
        districts=[{'id': district.district_code,'name':district.district_name} for district in districts]
        return districts

    def get_sub_district(db:Session,payload:dict):
        SubDistricts=Stp_SubDistrict_crud(db).get_subdistrict(payload.districts,payload.all_data)
        SubDistricts=[{'id': SubDistrict.subdistrict_code,'name':SubDistrict.subdistrict_name} for SubDistrict in SubDistricts]
        return SubDistricts
    
    def get_villages(db:Session,payload:dict):
        Villages=Stp_Villages_crud(db).get_villages(payload.subdis_code,payload.all_data)
        Villages=[{'id': Village.id,'name':Village.village_name} for Village in Villages]
        return Villages
        
    def get_town(db:Session,payload:dict):
        towns=Stp_towns_crud(db).get_towns(payload.subdis_code,payload.all_data)
        return towns
    
    def get_town_details(db:Session):
        towns=Stp_towns_crud(db).get_all(True)
        return towns
    
    def get_river(db:Session,all_data:bool=False):
        return Stp_River_crud(db).get_rivers(all_data=all_data)
    
    def get_stretch(db:Session,River_code:int=None):
        return Stp_stretches_crud(db).get_stretches(River_code)
    
    def get_drain(db:Session,stretch_id:list=None):
        return Stp_drain_crud(db).get_drains(stretch_id)
    def get_drain_new(db:Session,stretch_id:list=None):
        return Stp_drain_new_crud(db).get_drains(stretch_id)

    def get_drain_class(db:Session,drain_no:list=None):
        return Stp_drain_new_crud(db).get_drains_class(drain_no)
    
class Stp_service:
    def get_raster(db:Session,payload:STPCategory):
        raster_path=[]
        raster_weights=[]
        for i in payload.data:
            temp_path=STP_priority_crud(db).get_raster_path(i.file_name)
            temp_path=os.path.join(Settings().BASE_DIR+"/"+temp_path)
            temp_path = os.path.abspath(temp_path)

            raster_path.append(temp_path)
            raster_weights.append(float(i.weight))
        return raster_path,raster_weights
    
    def get_raster_suitability(db:Session,category:str,all_data:bool=False):
        return STP_suitability_crud(db).get_suitability_category(category,all_data)

    def get_priority_category(db:Session,all_data:bool=False):
        return STP_priority_crud(db).get_raster_category(all_data)
    
    def get_priority_visual(db:Session,all_data:bool=False):
        return STP_visualization_crud(db).get_visual_path()
    
    def get_suitability_category(db:Session,all_data:bool=False):
        return STP_suitability_visualization_crud(db).get_visual_path()
    
    def get_suitability_area(db:Session):
        return Stp_area_crud(db).get_stp_area()
   