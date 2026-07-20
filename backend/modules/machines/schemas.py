from pydantic import BaseModel

class MachineCreate(BaseModel):
    machineCode: str
    englishName: str
    japaneseName: str

class MachineUpdate(BaseModel):
    machineCode: str | None = None
    englishName: str | None = None
    japaneseName: str | None = None
