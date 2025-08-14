from app.database.models import State,District,STP_Drain_sutability,SubDistrict,Towns,STP_raster,STP_sutability_raster,STP_Priority_Visual_raster,STP_River,STP_Drain,STP_Stretches,STP_Catchment,Groundwater_Zone_Visual_raster,Groundwater_Zone_raster,STP_sutability_visual_raster
from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session
import sqlalchemy as sq
from sqlalchemy import func

class Stp_State_crud(CrudBase):
    def __init__(self,db:Session,Model=State):
        super().__init__(db,Model)
        self.obj = None
    
    def get_states(self,all_data:bool=False,page=1, page_size=5):
        query= self.db.query(self.Model).filter().order_by(
            sq.asc(self.Model.state_name))
        return self._pagination(query,all_data,page,page_size)

class Stp_District_crud(CrudBase):
    def __init__(self,db:Session,Model=District):
        super().__init__(db,Model)
        self.obj = None

    def get_district(self,state_id:int,all_data:bool=False):
        query=self.db.query(self.Model).filter(
            self.Model.state_code==state_id).order_by( sq.asc(self.Model.district_name))
        return self._pagination(query,all_data)

class Stp_SubDistrict_crud(CrudBase):
    def __init__(self,db:Session,Model=SubDistrict):
        super().__init__(db,Model)
        self.obj = None

    def get_subdistrict(self,district:list,all_data:bool=False):
        query=self.db.query(self.Model).filter(
            self.Model.district_code.in_(district)).order_by(sq.asc(self.Model.subdistrict_name))
        return self._pagination(query,all_data)

class Stp_towns_crud(CrudBase):
    def __init__(self,db:Session,Model=Towns):
        super().__init__(db,Model)
        self.obj = None

    def get_all(self,town_id:list,all_data:bool=True):
        query = self.db.query(func.sum(self.Model.elevation)).filter(
        self.Model.id.in_(town_id))
        total_elevation = query.scalar()  # Returns the sum as a single value
        return total_elevation
        
    def get_towns(self,subdistrict:list,all_data:bool=True):
        query=self.db.query(self.Model).filter(
            self.Model.subdistrict_code.in_(subdistrict)).order_by(sq.asc(self.Model.name))
        return self._pagination(query,all_data)

class Stp_River_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_River):
        super().__init__(db,Model)
        self.obj = None

    def get_rivers(self,all_data:bool=True):
        query=self.db.query(self.Model).filter()
        return self._pagination(query,all_data)

class Stp_stretches_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_Stretches):
        super().__init__(db,Model)
        self.obj = None

    def get_stretches(self,River_code:str=None,all_data:bool=True):
        query=self.db.query(self.Model).distinct(self.Model.Stretch_ID).filter(River_code==self.Model.river_Code)
        return self._pagination(query,all_data)
    
class Stp_drain_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_Drain):
        super().__init__(db,Model)
        self.obj = None

    def get_drains(self,stretch_id:list,all_data:bool=True):
        query=self.db.query(self.Model).filter(self.Model.stretch_id.in_(stretch_id))
        return self._pagination(query,all_data)

class Stp_drain_new_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_Drain_sutability):
        super().__init__(db,Model)
        self.obj = None

    def get_drains(self,stretch_id:list,all_data:bool=True):
        query=self.db.query(self.Model).filter(self.Model.stretch_id.in_(stretch_id))
        return self._pagination(query,all_data)
    
    def get_drains_class(self,drain_no:list,all_data:bool=True):
        print('tempy',drain_no)
        query=self.db.query(self.Model).filter(self.Model.Drain_No.in_(drain_no))
        return self._pagination(query,all_data)
class Stp_catchment_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_Catchment):
        super().__init__(db,Model)
        self.obj = None

    def get_cachement(self,Drain_No:list=None,all_data:bool=True):
        query=self.db.query(self.Model).filter(self.Model.Drain_No.in_(Drain_No))
        return self._pagination(query,all_data)

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

class GWA_crud(CrudBase):
    def __init__(self,db:Session,Model=Groundwater_Zone_Visual_raster):
        super().__init__(db,Model)
        self.obj = None
    
    def get_all_visual(self):
        query=self.db.query(self.Model).filter().all()
        return query