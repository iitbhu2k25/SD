from app.database.models import Rainwater_raster
from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session
from sqlalchemy import and_,desc

class rainwater_crud(CrudBase):
    def __init__(self,db:Session,Model=Rainwater_raster):
        super().__init__(db,Model)
        self.obj = None
    
    def get_raster(self,user_data:dict,all_data:bool=False,page=1, page_size=5):
        query = self.db.query(self.Model).filter(
            and_(
                self.Model.layer_month == int(user_data.month),
                self.Model.layer_class == user_data.layer_class
            )
        ).order_by(desc(self.Model.modified_at))
    
        if all_data:
            return query.all()
        else:
            # For pagination
            return query.offset((page - 1) * page_size).limit(page_size).all()

       