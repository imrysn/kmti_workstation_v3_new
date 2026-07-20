from pydantic import BaseModel
from typing import Optional

class ClientCreate(BaseModel):
    category: Optional[str] = ""
    englishName: str
    email: Optional[str] = ""
    japaneseName: Optional[str] = ""

class ClientUpdate(BaseModel):
    category: Optional[str] = None
    englishName: Optional[str] = None
    email: Optional[str] = None
    japaneseName: Optional[str] = None
