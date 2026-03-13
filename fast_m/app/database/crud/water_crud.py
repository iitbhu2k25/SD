from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session

from app.database.models.model_water import Stretches, Drain



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