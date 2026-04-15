from app.database.models import RasterMetadata,UserStorage,CeleryTask,VectorMetadata
from app.database.crud.base import CrudBase
from sqlalchemy.orm import Session
from app.api.schema.raster_operation import useroperSchema,rasterMetaSchame,vectorMetaSchema


class userstorecrud(CrudBase):
    def __init__(self,db:Session,Model=UserStorage):
        super().__init__(db,Model)
        self.obj=None

    def get_details(self,file_id:str):
        return self.db.query(self.Model).filter(self.Model.file_id==file_id).first()

    def create_details(self,payload:useroperSchema):
        return self.create(payload.model_dump())

class rasterMetacrud(CrudBase):
    def __init__(self,db:Session,Model=RasterMetadata):
        super().__init__(db,Model)
        self.obj=None

    def get_details(self,file_id:str):
        return self.db.query(self.Model).filter(self.Model.file_id==file_id).first()
    
    def create_details(self,payload:rasterMetaSchame):
        return self.create(payload.model_dump())
    

class vectorMetacrud(CrudBase):
    def __init__(self,db:Session,Model=VectorMetadata):
        super().__init__(db,Model)
        self.obj=None

    def get_details(self,file_id:str):
        return self.db.query(self.Model).filter(self.Model.file_id==file_id).first()
    
    def create_details(self,payload:vectorMetaSchema):
        return self.create(payload.model_dump())
    
class rasterOperCrud(CrudBase):
    def __init__(self,db:Session,Model=CeleryTask):
        super().__init__(db,Model)
        self.obj=None
    
    def start_task(self,task_id:str,file_id:str,task_name:str="lol"):
        return self.create({
            "task_id":task_id,
            "file_id":file_id,
            "task_status":"started",
            "task_name":task_name
            })


    def update_task(self,task_id:str,status:str,layer_name:str=None,result_path:str=None):
        db_obj=self.db.query(self.Model).filter(self.Model.task_id==task_id).first()
        new_dir={
            "id":db_obj.id,
            "task_status":status,
            "layer_name":layer_name,
            "file_path":result_path

        }
        return self.update(data=new_dir)
    
    def get_task(self,task_id:str):
        return self.db.query(self.Model).filter(self.Model.task_id==task_id).first()