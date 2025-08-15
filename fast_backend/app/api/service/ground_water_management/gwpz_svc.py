from sqlalchemy.orm import Session
from app.database.crud.stp_crud import GWZ_crud,GWA_visualization_crud
class Stp_service:
    
    def get_raster_GWZ(db:Session,all_data:bool=False):
        return GWZ_crud(db).get_raster_category(all_data)

    
    def get_GWA_Priority_visual(db:Session,all_data:bool=True):
        return GWA_visualization_crud(db).get_all_visual()