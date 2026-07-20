from pydantic import BaseModel

class CharCreate(BaseModel):
    englishChar: str
    japaneseChar: str

class CharUpdate(BaseModel):
    englishChar: str = None
    japaneseChar: str = None

class HeatTreatmentCreate(BaseModel):
    category: str
    englishChar: str
    japaneseChar: str

class HeatTreatmentUpdate(BaseModel):
    category: str = None
    englishChar: str = None
    japaneseChar: str = None
