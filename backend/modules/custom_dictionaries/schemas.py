from pydantic import BaseModel
from typing import Optional

class PageCreate(BaseModel):
    title: str

class MappingCreate(BaseModel):
    englishName: str
    japaneseName: str

class MappingUpdate(BaseModel):
    englishName: Optional[str] = None
    japaneseName: Optional[str] = None
