from pydantic import BaseModel
from typing import Optional

class ClientCreate(BaseModel):
    category: Optional[str] = "CLIENT"
    englishName: str
    code: Optional[str] = None
    companyName: Optional[str] = None
    clientName: Optional[str] = None
    contactPerson: Optional[str] = None
    contact: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    prefix: Optional[str] = None
    email: Optional[str] = ""
    japaneseName: Optional[str] = ""

class ClientUpdate(BaseModel):
    category: Optional[str] = None
    englishName: Optional[str] = None
    code: Optional[str] = None
    companyName: Optional[str] = None
    clientName: Optional[str] = None
    contactPerson: Optional[str] = None
    contact: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    prefix: Optional[str] = None
    email: Optional[str] = None
    japaneseName: Optional[str] = None
