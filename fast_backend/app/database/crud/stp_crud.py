from app.database.models import STP_raster,STP_sutability_raster,STP_Priority_Visual_raster,Groundwater_Zone_Visual_raster,Groundwater_Zone_raster,STP_sutability_visual_raster
from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session
import sqlalchemy as sq
from sqlalchemy import func


class STP_priority_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_raster):
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

class STP_sutability_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_sutability_raster):
        super().__init__(db,Model)
        self.obj = None
    def get_sutability_category(self,category:str,all_data:bool=False):
        query=self.db.query(self.Model).filter(
            self.Model.raster_category==category)
        return self._pagination(query,all_data)
    
    def get_all(self,all_data:bool=False):
        query=self.db.query(self.Model).filter()
        return self._pagination(query,all_data)

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
    
class STP_visualization_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_Priority_Visual_raster):
        super().__init__(db,Model)
        self.obj = None     
    
    def get_visual_path(self):
        query=self.db.query(self.Model).filter().all()
        return query

class STP_sutability_visualization_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_sutability_visual_raster):
        super().__init__(db,Model)
        self.obj = None     
    
    def get_visual_path(self):
        query=self.db.query(self.Model).filter().all()
        return query

class GWA_visualization_crud(CrudBase):
    def __init__(self,db:Session,Model=Groundwater_Zone_Visual_raster):
        super().__init__(db,Model)
        self.obj = None
    
    def get_all_visual(self):
        query=self.db.query(self.Model).filter().all()
        return query