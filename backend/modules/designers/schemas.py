from pydantic import BaseModel
from typing import Optional

class DesignerCreate(BaseModel):
    category: Optional[str] = ""
    englishName: Optional[str] = ""
    email: Optional[str] = ""
    japaneseName: Optional[str] = ""

class DesignerUpdate(BaseModel):
    category: Optional[str] = None
    englishName: Optional[str] = None
    email: Optional[str] = None
    japaneseName: Optional[str] = None
