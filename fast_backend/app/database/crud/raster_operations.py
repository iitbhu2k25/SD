from app.database.models import RasterMetadata,RasterStorage
from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session
from app.api.schema.raster_operation import rasteroperSchema,rasterMetaSchame


class rasterstorecrud(CrudBase):
    def __init__(self,db:Session,Model=RasterStorage):
        super().__init__(db,Model)
        self.obj=None

    def get_details(self,file_id:str):
        return self.db.query(self.Model).filter(self.Model.file_id==file_id).first()

    def create_details(self,payload:rasteroperSchema):
        return self.create(payload.model_dump())

class rasterMetacrud(CrudBase):
    def __init__(self,db:Session,Model=RasterMetadata):
        super().__init__(db,Model)
        self.obj=None

    def get_details(self,file_id:str):
        return self.db.query(self.Model).filter(self.Model.file_id==file_id).first()
    
    def create_details(self,payload:rasterMetaSchame):
        return self.create(payload.model_dump())