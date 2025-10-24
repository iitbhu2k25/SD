import pandas as pd
from app.conf.settings import Settings
import os
from fastapi import HTTPException
class ModelWater:

    @staticmethod
    def get_data():
        file_path=Settings().MODELED_WATER
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found.")
        df = pd.read_excel(file_path)
        data = df.to_dict(orient="records")
        return data