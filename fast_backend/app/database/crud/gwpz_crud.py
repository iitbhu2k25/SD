from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session
from app.database.models import Groundwater_Zone_Visual_raster,MAR_suitability_visual_raster,MAR_suitability_raster,Groundwater_Zone_raster,Groundwater_Identification,Groundwater_Identification_visual_raster
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
    
class GWZ_visualization_crud(CrudBase):
    def __init__(self,db:Session,Model=Groundwater_Zone_Visual_raster):
        super().__init__(db,Model)
        self.obj = None
    
    def get_all_visual(self):
        query=self.db.query(self.Model).filter().all()
        return query

class GWPL_crud(CrudBase):
    def __init__(self,db:Session,Model=Groundwater_Identification):
        super().__init__(db,Model)
        self.obj = None
    def get_raster_category(self,category:str,all_data:bool=False):
        query=self.db.query(self.Model).filter(
            self.Model.raster_category==category)
        return self._pagination(query,all_data)
    def get_all(self,all_data:bool=False):
        query=self.db.query(self.Model).filter()
        return self._pagination(query,all_data)

    
class GWPL_visualization_crud(CrudBase):
    def __init__(self,db:Session,Model=Groundwater_Identification_visual_raster):
        super().__init__(db,Model)
        self.obj = None
    
    def get_all_visual(self):
        query=self.db.query(self.Model).filter().all()
        return query
    

class MARSuitability_crud(CrudBase):
    def __init__(self,db:Session,Model=MAR_suitability_raster):
        super().__init__(db,Model)
        self.obj = None
    def get_raster_category(self,category:str,all_data:bool=False):
        query=self.db.query(self.Model).filter(
            self.Model.raster_category==category)
        return self._pagination(query,all_data)
    def get_all(self,all_data:bool=False):
        query=self.db.query(self.Model).filter()
        return self._pagination(query,all_data)

    
class MARSuitability_visualization_crud(CrudBase):
    def __init__(self,db:Session,Model=MAR_suitability_visual_raster):
        super().__init__(db,Model)
        self.obj = None
    
    def get_all_visual(self):
        query=self.db.query(self.Model).filter().all()
        return query