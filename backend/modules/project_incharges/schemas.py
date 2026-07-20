from pydantic import BaseModel
from typing import Optional

class InchargeCreate(BaseModel):
    category: Optional[str] = ""
    englishName: str
    email: Optional[str] = ""
    japaneseName: Optional[str] = ""

class InchargeUpdate(BaseModel):
    category: Optional[str] = None
    englishName: Optional[str] = None
    email: Optional[str] = None
    japaneseName: Optional[str] = None
