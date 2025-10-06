from sqlalchemy.orm import Session
from app.database.crud.gwpz_crud import GWZ_crud,MARSuitability_crud,MARSuitability_visualization_crud,GWZ_visualization_crud,GWPL_crud,GWPL_visualization_crud
from app.api.schema.stp_schema import STPCategory
import os
from  app.api.service.river_water_management.spt_service import Stp_service
from app.conf.settings import Settings

class Gwzp_service:
    def get_raster(db:Session,payload:STPCategory):
        raster_path=[]
        raster_weights=[]
        for i in payload.data:
            temp_path=GWZ_crud(db).get_raster_path(i.file_name)
            temp_path=os.path.join(Settings().BASE_DIR+"/"+temp_path)
            temp_path = os.path.abspath(temp_path)
            raster_path.append(temp_path)
            raster_weights.append(float(i.weight))
        return raster_path,raster_weights
    
    def get_raster_GWZ(db:Session,all_data:bool=False):
        return GWZ_crud(db).get_raster_category(all_data)

    def get_GWA_Priority_visual(db:Session,all_data:bool=True):
        return GWZ_visualization_crud(db).get_all_visual()

class GWPL_service:
    # def get_raster(db:Session,payload:STPCategory):
    #     raster_path=[]
    #     raster_weights=[]
    #     for i in payload.data:
    #         temp_path=GWZ_crud(db).get_raster_path(i.file_name)
    #         temp_path=os.path.join(Settings().BASE_DIR+"/"+temp_path)
    #         temp_path = os.path.abspath(temp_path)
    #         raster_path.append(temp_path)
    #         raster_weights.append(float(i.weight))
    #     return raster_path,raster_weights
    
    def get_raster_GWPL(db:Session,category:str,all_data:bool=False):
        return GWPL_crud(db).get_raster_category(category,all_data)

    def get_GWPL_visual(db:Session,all_data:bool=True):
        return GWPL_visualization_crud(db).get_all_visual()

class MARSuitability_svc:
    # def get_raster(db:Session,payload:STPCategory):
    #     raster_path=[]
    #     raster_weights=[]
    #     for i in payload.data:
    #         temp_path=GWZ_crud(db).get_raster_path(i.file_name)
    #         temp_path=os.path.join(Settings().BASE_DIR+"/"+temp_path)
    #         temp_path = os.path.abspath(temp_path)
    #         raster_path.append(temp_path)
    #         raster_weights.append(float(i.weight))
    #     return raster_path,raster_weights
    
    def get_raster_MAR(db:Session,category:str,all_data:bool=False):
        return MARSuitability_crud(db).get_raster_category(category,all_data)

    def get_MAR_visual(db:Session,all_data:bool=True):
        return MARSuitability_visualization_crud(db).get_all_visual()
    
class Raster_visual:
    @staticmethod
    def visual_raster(db):
        temp = Stp_service.get_priority_visual(db)
        temp2 = Stp_service.get_suitability_category(db)
        temp3= Gwzp_service.get_GWA_Priority_visual(db)
        temp4 = GWPL_service.get_GWPL_visual(db)
        temp5=MARSuitability_svc.get_MAR_visual(db)

        
        resp = [
            {
                "module": "Stp priority",
                "category": False,
                "raster": [
                    {"file_name": i.file_name, "layer_name": i.layer_name}
                    for i in temp
                ]
            },
            {
                "module": "Stp suitability",
                "category": True,
                "raster": [
                    {
                        "file_name": i.file_name,
                        "layer_name": i.layer_name,
                        "category": i.raster_category
                    }
                    for i in temp2
                ]
            },
            {
                "module": "Groundwater Potential Zone",
                "category": False,
                "raster": [
                    {"file_name": i.file_name, "layer_name": i.layer_name}
                    for i in temp3
                ]
            },
            {
                "module": "Groundwater Pumping Location",
                "category": True,
                "raster": [
                    {
                        "file_name": i.file_name,
                        "layer_name": i.layer_name,
                        "category": i.raster_category
                    }
                    for i in temp4  # ← Use temp4 here, if intended
                ]
            },
            {
                "module": "MAR Site Suitability",
                "category": True,
                "raster": [
                    {
                        "file_name": i.file_name,
                        "layer_name": i.layer_name,
                        "category": i.raster_category
                    }
                    for i in temp5  # ← Use temp5 here
                ]
            }
        ]

        return resp
