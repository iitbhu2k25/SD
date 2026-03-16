from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session
import sqlalchemy as sq
from app.database.models.model_water import Stretches, Drain, WaterState, WaterDistrict, WaterSubDistrict, WaterSTP_villages, WaterTowns
from sqlalchemy import func


class Stretches_crud(CrudBase):
    def __init__(self,db:Session,Model=Stretches):
        super().__init__(db,Model)
        self.obj = None

    def get_stretches(self,river_code:int=None,all_data:bool=True):
        # 1. SELECT only the Stretch_ID column
        query = self.db.query(self.Model.Stretch_ID)
        
        # 2. FILTER by River_Code if provided
        if river_code is not None:
            query = query.filter(self.Model.River_Code == river_code)
            
        # 3. Deduplicate and Sort
        query = query.distinct().order_by(self.Model.Stretch_ID.asc())
        
        # 4. Execute query and flatten result to list of ints: [1, 2, 3]
        ids_list = [row[0] for row in query.all()]
        
        # 5. RETURN A DICTIONARY matching the response model
        return {"stretch_ids": ids_list} 
    
class Drain_crud(CrudBase):
    def __init__(self,db:Session,Model=Drain):
        super().__init__(db,Model)
        self.obj = None

    def get_drains(self,stretch_id:int,all_data:bool=True):
        # 1. SELECT only the Drain_No column
        query = self.db.query(self.Model.Drain_No)
        
        # 2. FILTER by Stretch_ID
        # Using typical comparison: Model.Column == Value
        if stretch_id is not None:
            query = query.filter(self.Model.Stretch_ID == stretch_id)
            
        # 3. DISTINCT & ORDER BY (Good practice to sort results)
        query = query.distinct().order_by(self.Model.Drain_No.asc())
        
        # 4. EXECUTE and Flatten: [(10,), (20,)] -> [10, 20]
        drains_list = [row[0] for row in query.all()]
        
        # 5. RETURN Dictionary matching DrainOutput model
        return {"drains": drains_list}
    


class Stp_State_crud(CrudBase):
    def __init__(self,db:Session,Model=WaterState):
        super().__init__(db,Model)
        self.obj = None
    
    def get_states(self,all_data:bool=True,page=1, page_size=5):
        query= self.db.query(self.Model).filter().order_by(
            sq.asc(self.Model.state_name))
        return self._pagination(query,all_data,page,page_size)

class Stp_District_crud(CrudBase):
    def __init__(self,db:Session,Model=WaterDistrict):
        super().__init__(db,Model)
        self.obj = None

    def get_district(self,state_id:int,all_data:bool=True):
        query=self.db.query(self.Model).filter(
            self.Model.state_code==state_id).order_by( sq.asc(self.Model.district_name))
        return self._pagination(query,all_data)

    def get_district_all(self):
        query=self.db.query(self.Model).order_by( sq.asc(self.Model.district_name))
        return self._pagination(query,True)

class Stp_SubDistrict_crud(CrudBase):
    def __init__(self,db:Session,Model=WaterSubDistrict):
        super().__init__(db,Model)
        self.obj = None

    def get_subdistrict(self,district:list,all_data:bool=True):
        query=self.db.query(self.Model).filter(
            self.Model.district_code.in_(district)).order_by(sq.asc(self.Model.subdistrict_name))
        return self._pagination(query,all_data)
    
    def get_subdistrict_all(self,all_data:bool=True):
        query=self.db.query(self.Model).order_by( sq.asc(self.Model.subdistrict_name))
        return self._pagination(query,all_data)

class Stp_Villages_crud(CrudBase):
    def __init__(self,db:Session,Model=WaterSTP_villages):
        super().__init__(db,Model)
        self.obj = None

    def get_villages(self,sub_district:list,all_data:bool=True):
        query=self.db.query(self.Model).filter(
            self.Model.subdistrict_code.in_(sub_district)).order_by(sq.asc(self.Model.village_name))
        return self._pagination(query,all_data)
    
    def get_all_villages(self,sub_district:list,all_data:bool=True):
        query=self.db.query(self.Model).order_by(sq.asc(self.Model.village_name))
        return self._pagination(query,all_data)

class Stp_towns_crud(CrudBase):
    def __init__(self,db:Session,Model=WaterTowns):
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

    def get_all_towns(self,all_data:bool=True):
        query=self.db.query(self.Model).order_by(sq.asc(self.Model.name))
        return self._pagination(query,all_data)    