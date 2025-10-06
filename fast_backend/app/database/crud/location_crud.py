from app.database.models import State,District,STP_Drain_suitability,SubDistrict,STP_villages,Towns,STP_River,STP_Drain,STP_Stretches,STP_Catchment
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

class Stp_Villages_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_villages):
        super().__init__(db,Model)
        self.obj = None

    def get_villages(self,sub_district:list,all_data:bool=False):
        query=self.db.query(self.Model).filter(
            self.Model.subdistrict_code.in_(sub_district)).order_by(sq.asc(self.Model.village_name))
        return self._pagination(query,all_data)

class Stp_towns_crud(CrudBase):
    def __init__(self,db:Session,Model=Towns):
        super().__init__(db,Model)
        self.obj = None

    def get_sum_elevation(self,town_id:list,all_data:bool=True):
        query = self.db.query(func.sum(self.Model.elevation)).filter(
        self.Model.id.in_(town_id))
        total_elevation = query.scalar() 
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
    def __init__(self,db:Session,Model=STP_Drain_suitability):
        super().__init__(db,Model)
        self.obj = None

    def get_drains(self,stretch_id:list,all_data:bool=True):
        query=self.db.query(self.Model).filter(self.Model.stretch_id.in_(stretch_id))
        return self._pagination(query,all_data)
    
    def get_drains_class(self,drain_no:list,all_data:bool=True):
        query=self.db.query(self.Model).filter(self.Model.Drain_No.in_(drain_no))
        return self._pagination(query,all_data)
    
    def get_sum_elevation(self,drain_id:list,all_data:bool=True):
        query = self.db.query(func.sum(self.Model.Elevation)).filter(
        self.Model.id.in_(drain_id))
        total_elevation = query.scalar() 
        return total_elevation
    
class Stp_catchment_crud(CrudBase):
    def __init__(self,db:Session,Model=STP_Catchment):
        super().__init__(db,Model)
        self.obj = None

    def get_cachement(self,Drain_No:list=None,all_data:bool=True):
        query=self.db.query(self.Model).filter(self.Model.Drain_No.in_(Drain_No))
        return self._pagination(query,all_data)
