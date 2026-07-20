from pydantic import BaseModel

class MaterialCreate(BaseModel):
    englishName: str
    japaneseName: str

class MaterialUpdate(BaseModel):
    englishName: str | None = None
    japaneseName: str | None = None
