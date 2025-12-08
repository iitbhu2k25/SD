# schemas/crop.py

from pydantic import BaseModel

class SeasonRequest(BaseModel):
    season: str
