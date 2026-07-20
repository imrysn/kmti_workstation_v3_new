from pydantic import BaseModel
from models.user import UserRole

class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole

class UserUpdate(BaseModel):
    username: str | None = None
    password: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
