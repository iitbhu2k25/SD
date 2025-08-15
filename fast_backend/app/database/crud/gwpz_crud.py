from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session
from app.database.models import Groundwater_Zone_Visual_raster,Groundwater_Zone_raster
class GWZ_crud(CrudBase):
    def __init__(self,db:Session,Model=Groundwater_Zone_raster):
        super().__init__(db,Model)
        self.obj = None
    def get_raster_path(self,name:str):
        query=self.db.query(self.Model).filter(
            self.Model.file_name==name)
        return (
            query.first().file_path
        )
    def get_raster_category(self,all_data:bool=False):
        query=self.db.query(self.Model).filter()
        return self._pagination(query,all_data)
    
class GWA_visualization_crud(CrudBase):
    def __init__(self,db:Session,Model=Groundwater_Zone_Visual_raster):
        super().__init__(db,Model)
        self.obj = None
    
    def get_all_visual(self):
        query=self.db.query(self.Model).filter().all()
        return query