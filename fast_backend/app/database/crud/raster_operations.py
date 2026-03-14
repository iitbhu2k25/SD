from app.database.models import RasterMetadata,RasterStorage,CeleryTask
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
    
class rasterOperCrud(CrudBase):
    def __init__(self,db:Session,Model=CeleryTask):
        super().__init__(db,Model)
        self.obj=None
    
    def start(self,task_id:str,file_id:str):
        return self.create({
            "task_id":task_id,
            "file_id":file_id,
            "task_status":"started",
            "task_name":"lol"
            })


    def update(self,task_id:str,status:str,layer_name:str=None,result_path:str=None):
        db_obj=self.db.query(self.Model).filter(self.Model.task_id==task_id).first()
        db_obj.task_status=status
        db_obj.layer_name=layer_name
        db_obj.file_path=result_path
        return self.update(db_obj.model_dump())
    
    def get(self,task_id:str):
        return self.db.query(self.Model).filter(self.Model.task_id==task_id).first()