from pydantic import BaseModel

class BannedWordCreate(BaseModel):
    word: str
