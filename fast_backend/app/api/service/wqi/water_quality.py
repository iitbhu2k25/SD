from app.api.schema.wqi import Well_input
from sqlalchemy.orm import session
from app.database.crud.gwpz_crud import WQI
class WQ_Index:
    
    def get_well(self,db: session,payload:Well_input):
        return WQI(db).get_wqi(payload.subdis_cod,payload.year)
