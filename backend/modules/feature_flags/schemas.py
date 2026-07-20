from pydantic import BaseModel

class FlagUpdate(BaseModel):
    value: bool
