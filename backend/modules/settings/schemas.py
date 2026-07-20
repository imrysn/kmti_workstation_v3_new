from pydantic import BaseModel

class SettingsUpdate(BaseModel):
    dbSource: str = ""
    dbName: str = ""
    dbUsername: str = ""
    dbPass: str = ""
    localPath: str = ""
    actPath: str = ""
    autoDel: bool = False

class DisplayNameUpdate(BaseModel):
    displayName: str
