from sqlalchemy.orm import Session
from app.database.crud.gwpz_crud import GWZ_crud,GWA_visualization_crud
from app.api.schema.stp_schema import STPCategory
import os
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
        return GWA_visualization_crud(db).get_all_visual()