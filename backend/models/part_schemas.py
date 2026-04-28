from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from typing import List, Optional
from datetime import datetime

class ProjectSchema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    id: int
    name: str
    root_path: str
    category: str
    total_files: int
    cad_files: int
    is_scanning: bool

class CadFileSchema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    id: int
    project_id: int
    is_folder: bool
    file_name: str
    file_type: str
    file_path: str
    category: Optional[str] = None
    part_type: Optional[str] = None
    size: Optional[int] = None
    last_modified: Optional[float] = None
    parent_path: Optional[str] = None

class CharSearchSchema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    id: int
    eng_char: str
    jp_char: str

class HeatTreatmentSchema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    id: int
    category: Optional[str] = None
    eng_char: Optional[str] = None
    jp_char: Optional[str] = None

class DesignerSchema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    id: int
    category: Optional[str] = None
    english_name: str
    japanese_name: str
    email: Optional[str] = None
