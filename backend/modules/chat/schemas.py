from pydantic import BaseModel
from typing import List

class GroupCreate(BaseModel):
    name: str
    members: List[str]
