from app.database.models import STP_raster,STP_suitability_raster,Stp_suitability_Area,STP_Priority_Visual_raster,STP_suitability_visual_raster
from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session



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

class STP_suitability_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_suitability_raster):
        super().__init__(db,Model)
        self.obj = None
    def get_suitability_category(self,category:str,all_data:bool=False):
        query=self.db.query(self.Model).filter(
            self.Model.raster_category==category)
        return self._pagination(query,all_data)
    
    def get_all(self,all_data:bool=False):
        query=self.db.query(self.Model).filter()
        return self._pagination(query,all_data)


class STP_visualization_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_Priority_Visual_raster):
        super().__init__(db,Model)
        self.obj = None     
    
    def get_visual_path(self):
        query=self.db.query(self.Model).filter().all()
        return query

class STP_suitability_visualization_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_suitability_visual_raster):
        super().__init__(db,Model)
        self.obj = None     
    
    def get_visual_path(self):
        query=self.db.query(self.Model).filter().all()
        return query

class Stp_area_crud(CrudBase):
    def __init__(self,db:Session,Model=Stp_suitability_Area):
        super().__init__(db,Model)
        self.obj = None
    
    def get_stp_area(self):
        query=self.db.query(self.Model).filter().all()
        return query
    
    def get_stp_area_value(self,_id:int):
        query=self.db.query(self.Model.tech_value).filter(
            self.Model.id==_id).first()
        return query