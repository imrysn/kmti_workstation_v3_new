from pydantic import BaseModel
from typing import List, Optional

class ComponentUpdatePayload(BaseModel):
    status: str
    submitted_date: Optional[str] = None

class JobCreatePayload(BaseModel):
    job_id: str
    deadline: Optional[str] = None

class ExportPayload(BaseModel):
    job_ids: List[str]
    target_months: List[str]

class JobUpdatePayload(BaseModel):
    job_id: Optional[str] = None
    deadline: Optional[str] = None

class ComponentCreatePayload(BaseModel):
    unit_code: str
    assembly_3d: Optional[str] = "-"
    parts_3d: Optional[str] = "-"
    assembly_2d: Optional[str] = "-"
    parts_2d: Optional[str] = "-"
    status: Optional[str] = "Pending/Not Started"
    submitted_date: Optional[str] = None
    is_postponed: Optional[bool] = False

class ComponentUpdateAllPayload(BaseModel):
    unit_code: Optional[str] = None
    assembly_3d: Optional[str] = None
    parts_3d: Optional[str] = None
    assembly_2d: Optional[str] = None
    parts_2d: Optional[str] = None
    status: Optional[str] = None
    submitted_date: Optional[str] = None
    is_postponed: Optional[bool] = None

class TimelineUpdatePayload(BaseModel):
    member_name: str
    col_index: int
    value: str

class TimelineSpanPayload(BaseModel):
    member_name: str
    start_col: int
    end_col: int
    job_code: str

class MemberCreatePayload(BaseModel):
    name: str

class ManualNotificationPayload(BaseModel):
    member_name: str
    job_id: str
    message: str

class MemberRenamePayload(BaseModel):
    old_name: str
    new_name: str
