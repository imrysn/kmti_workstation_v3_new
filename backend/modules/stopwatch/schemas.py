from pydantic import BaseModel
from typing import Optional

class StopwatchRecordCreate(BaseModel):
    name: str
    time: str
    workstation: Optional[str] = None
    user_name: Optional[str] = None

class StopwatchRecordUpdate(BaseModel):
    name: str
