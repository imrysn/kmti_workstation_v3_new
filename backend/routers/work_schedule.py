import os
import re
import datetime
import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db, get_fms_db
from core.auth import get_current_user
from models.user import User, UserRole
from models.fms import FmsUser
from models.work_schedule import WorkScheduleJob, WorkScheduleComponent, WorkScheduleAssignment, WorkScheduleMember
from socket_manager import sio

from services.work_schedule_repository import WorkScheduleRepository
from services.excel_schedule_service import ExcelScheduleService

router = APIRouter()

EXCEL_FILE_PATH = r"d:\RAYSAN\KMTI Data Management\Systems\kmti_workstation_v3_new\backend\data\KMTI Work Schedule Monitoring 2026.06.19.xlsx"

# --- Request/Response Pydantic Models ---

class ComponentUpdatePayload(BaseModel):
    status: str
    submitted_date: Optional[str] = None # format YYYY-MM-DD or None

class JobCreatePayload(BaseModel):
    job_id: str
    deadline: Optional[str] = None

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

class MemberRenamePayload(BaseModel):
    old_name: str
    new_name: str

# --- Permission Dependency ---

async def require_schedule_write(
    current_user = Depends(get_current_user),
    fms_db: AsyncSession = Depends(get_fms_db)
):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else current_user.role
    if role_str in ("admin", "it"):
        return current_user
    
    # Check FMS DB role
    try:
        from sqlalchemy import select
        fms_res = await fms_db.execute(select(FmsUser).where(FmsUser.username == current_user.username))
        fms_user = fms_res.scalar_one_or_none()
        if fms_user and fms_user.role.upper().replace("_", " ").strip() in ("TEAM LEADER", "LEADER", "ADMIN"):
            return current_user
    except Exception as e:
        import logging
        logger = logging.getLogger("uvicorn.error")
        logger.warning(f"Error validating Team Leader role in FMS DB: {e}")

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied. Only Admins and Team Leaders can edit the schedule."
    )

# --- Helper functions ---

def normalize_status(status_val):
    if not status_val:
        return "Pending/Not Started"
    s = str(status_val).strip().lower()
    if s in ("completed", "complete", "complete "):
        return "Completed"
    if "checking" in s:
        return "For Checking"
    if s == "-":
        return "Excluded/NA"
    return "Pending/Not Started"

# --- Routing Endpoints ---

@router.get("/permissions")
async def get_permissions(
    current_user = Depends(get_current_user),
    fms_db: AsyncSession = Depends(get_fms_db)
):
    """
    Check if the current user is authorized to edit the work schedule.
    """
    try:
        await require_schedule_write(current_user, fms_db)
        return {"success": True, "can_write": True}
    except Exception:
        return {"success": True, "can_write": False}


@router.get("/jobs")
async def get_jobs(db: AsyncSession = Depends(get_db)):
    """
    Get all schedule jobs with progress metrics.
    """
    jobs = await WorkScheduleRepository.get_all_jobs(db)
    components = await WorkScheduleRepository.get_all_components(db)
    
    # Group components by job_id
    comp_by_job = {}
    for c in components:
        if c.job_id not in comp_by_job:
            comp_by_job[c.job_id] = []
        comp_by_job[c.job_id].append(c)
        
    res = []
    for j in jobs:
        comps = comp_by_job.get(j.job_id, [])
        total = sum(1 for c in comps if c.unit_code.upper().strip() != "POSTPONED")
        completed = sum(1 for c in comps if normalize_status(c.status) == "Completed" and c.unit_code.upper().strip() != "POSTPONED")
        checking = sum(1 for c in comps if normalize_status(c.status) == "For Checking" and c.unit_code.upper().strip() != "POSTPONED")
        progress = (completed / total * 100) if total > 0 else 0.0
        
        res.append({
            "id": j.id,
            "job_id": j.job_id,
            "deadline": j.deadline,
            "total_components": total,
            "completed_components": completed,
            "checking_components": checking,
            "progress_percent": round(progress, 1),
            "components": [
                {
                    "id": c.id,
                    "job_id": c.job_id,
                    "unit_code": c.unit_code,
                    "assembly_3d": c.assembly_3d,
                    "parts_3d": c.parts_3d,
                    "assembly_2d": c.assembly_2d,
                    "parts_2d": c.parts_2d,
                    "status": c.status,
                    "submitted_date": c.submitted_date.strftime("%Y-%m-%d") if c.submitted_date else None,
                    "is_postponed": bool(c.is_postponed)
                }
                for c in comps
            ]
        })
        
    res.sort(key=lambda x: x["job_id"])
    return {"success": True, "jobs": res}


@router.get("/jobs/{job_id}/components")
async def get_components(job_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get all components for a specific job.
    """
    components = await WorkScheduleRepository.get_components_by_job(db, job_id)
    res = [
        {
            "id": c.id,
            "job_id": c.job_id,
            "unit_code": c.unit_code,
            "assembly_3d": c.assembly_3d,
            "parts_3d": c.parts_3d,
            "assembly_2d": c.assembly_2d,
            "parts_2d": c.parts_2d,
            "status": c.status,
            "submitted_date": c.submitted_date.strftime("%Y-%m-%d") if c.submitted_date else None,
            "is_postponed": bool(c.is_postponed)
        }
        for c in components
    ]
    return {"success": True, "components": res}


@router.post("/components/{component_id}/status")
async def update_component_status(
    component_id: int,
    payload: ComponentUpdatePayload,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Update status and submitted date of a component.
    """
    comp = await WorkScheduleRepository.get_component_by_id(db, component_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found.")
        
    comp.status = payload.status
    if comp.status in ("For Checking", "Completed") and comp.is_postponed:
        comp.is_postponed = 0
        
    if payload.submitted_date:
        try:
            comp.submitted_date = datetime.datetime.strptime(payload.submitted_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
    else:
        comp.submitted_date = None
        
    await db.commit()
    await sio.emit('schedule_updated')
    return {
        "success": True, 
        "message": f"Component '{comp.unit_code}' updated successfully.",
        "component": {
            "id": comp.id,
            "status": comp.status,
            "submitted_date": comp.submitted_date.strftime("%Y-%m-%d") if comp.submitted_date else None,
            "is_postponed": bool(comp.is_postponed)
        }
    }


@router.post("/jobs")
async def create_job(
    payload: JobCreatePayload,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Create a new Job Group.
    """
    existing_job = await WorkScheduleRepository.get_job_by_id(db, payload.job_id)
    if existing_job:
        raise HTTPException(status_code=400, detail="Job ID already exists.")
        
    new_job = await WorkScheduleRepository.create_job(db, payload.job_id, payload.deadline)
    await sio.emit('schedule_updated')
    return {"success": True, "job": {"id": new_job.id, "job_id": new_job.job_id, "deadline": new_job.deadline}}


@router.post("/jobs/{job_id}/components")
async def create_component(
    job_id: str,
    payload: ComponentCreatePayload,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Create a new component unit in a job.
    """
    job = await WorkScheduleRepository.get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    sub_date = None
    if payload.submitted_date:
        try:
            sub_date = datetime.datetime.strptime(payload.submitted_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
            
    new_comp = await WorkScheduleRepository.create_component(
        db=db,
        job_id=job_id,
        unit_code=payload.unit_code,
        assembly_3d=payload.assembly_3d,
        parts_3d=payload.parts_3d,
        assembly_2d=payload.assembly_2d,
        parts_2d=payload.parts_2d,
        status=payload.status,
        submitted_date=sub_date,
        is_postponed=1 if payload.is_postponed else 0
    )
    await sio.emit('schedule_updated')
    return {"success": True, "component": {"id": new_comp.id, "unit_code": new_comp.unit_code}}


@router.delete("/jobs/{job_id}")
async def delete_job(
    job_id: str,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Delete a Job Group and cascade delete all its components.
    """
    job = await WorkScheduleRepository.get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    await WorkScheduleRepository.delete_job(db, job)
    await sio.emit('schedule_updated')
    return {"success": True, "message": f"Job '{job_id}' deleted successfully."}


@router.patch("/jobs/{job_id}")
async def patch_job(
    job_id: str,
    payload: JobUpdatePayload,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Modify job details (e.g. job_id, deadline) and cascade updates.
    """
    job = await WorkScheduleRepository.get_job_by_id(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
        
    old_job_id = job.job_id
    new_job_id = payload.job_id
    
    if new_job_id and new_job_id != old_job_id:
        # Check if new job_id already exists
        exists = await WorkScheduleRepository.get_job_by_id(db, new_job_id)
        if exists:
            raise HTTPException(status_code=400, detail="Job ID already exists.")
            
        dialect = db.bind.dialect.name
        if dialect == "mysql":
            await db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
        elif dialect == "sqlite":
            await db.execute(text("PRAGMA foreign_keys = OFF"))
            
        try:
            # Update components referencing old_job_id
            await db.execute(
                text("UPDATE work_schedule_components SET job_id = :new_id WHERE job_id = :old_id"),
                {"new_id": new_job_id, "old_id": old_job_id}
            )
            # Update assignments matching old_job_id
            await db.execute(
                text("UPDATE work_schedule_assignments SET value = :new_id WHERE value = :old_id"),
                {"new_id": new_job_id, "old_id": old_job_id}
            )
            # Update job itself
            job.job_id = new_job_id
            if payload.deadline is not None:
                job.deadline = payload.deadline
            await db.commit()
        except Exception as e:
            await db.rollback()
            raise e
        finally:
            if dialect == "mysql":
                await db.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
            elif dialect == "sqlite":
                await db.execute(text("PRAGMA foreign_keys = ON"))
    else:
        if payload.deadline is not None:
            job.deadline = payload.deadline
        await db.commit()
        
    await sio.emit('schedule_updated')
    return {
        "success": True,
        "message": f"Job updated successfully.",
        "job": {
            "id": job.id,
            "job_id": job.job_id,
            "deadline": job.deadline
        }
    }


@router.delete("/components/{component_id}")
async def delete_component(
    component_id: int,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Delete a specific drawing component unit.
    """
    comp = await WorkScheduleRepository.get_component_by_id(db, component_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found.")
        
    await WorkScheduleRepository.delete_component(db, comp)
    await sio.emit('schedule_updated')
    return {"success": True, "message": "Component deleted successfully."}


@router.patch("/components/{component_id}")
async def patch_component(
    component_id: int,
    payload: ComponentUpdateAllPayload,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Modify any details of a drawing component unit.
    """
    comp = await WorkScheduleRepository.get_component_by_id(db, component_id)
    if not comp:
        raise HTTPException(status_code=404, detail="Component not found.")
        
    if payload.unit_code is not None:
        comp.unit_code = payload.unit_code
    if payload.assembly_3d is not None:
        comp.assembly_3d = payload.assembly_3d
    if payload.parts_3d is not None:
        comp.parts_3d = payload.parts_3d
    if payload.assembly_2d is not None:
        comp.assembly_2d = payload.assembly_2d
    if payload.parts_2d is not None:
        comp.parts_2d = payload.parts_2d
    if payload.status is not None:
        comp.status = payload.status
    if payload.submitted_date is not None:
        if payload.submitted_date:
            try:
                comp.submitted_date = datetime.datetime.strptime(payload.submitted_date, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
        else:
            comp.submitted_date = None
            
    if payload.is_postponed is not None:
        comp.is_postponed = 1 if payload.is_postponed else 0
    elif payload.status is not None:
        if payload.status in ("For Checking", "Completed"):
            comp.is_postponed = 0

    await db.commit()
    await sio.emit('schedule_updated')
    return {
        "success": True, 
        "message": "Component updated successfully.",
        "component": {
            "id": comp.id,
            "unit_code": comp.unit_code,
            "status": comp.status,
            "submitted_date": comp.submitted_date.strftime("%Y-%m-%d") if comp.submitted_date else None,
            "is_postponed": bool(comp.is_postponed)
        }
    }


@router.post("/import")
async def import_from_excel(
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Seed/Import work schedule data from the local Excel spreadsheet.
    DANGER: Clears existing work schedule tables.
    """
    if not os.path.exists(EXCEL_FILE_PATH):
        raise HTTPException(status_code=404, detail="Source Excel file not found on server.")
        
    try:
        jobs_dict = await asyncio.to_thread(ExcelScheduleService.parse_excel_for_import, EXCEL_FILE_PATH)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse Excel workbook: {e}")
        
    try:
        await WorkScheduleRepository.clear_all_components_and_jobs(db)
        # Clear members table during import so it gets re-seeded from the imported layout
        await db.execute(delete(WorkScheduleMember))
        await db.commit()
        
        for jid, job_info in jobs_dict.items():
            db_job = WorkScheduleJob(job_id=jid, deadline=job_info["deadline"])
            db.add(db_job)
            await db.commit()
            await db.refresh(db_job)
            
            for comp in job_info["components"]:
                db_comp = WorkScheduleComponent(
                    job_id=jid,
                    unit_code=comp["unit_code"],
                    assembly_3d=comp["assembly_3d"],
                    parts_3d=comp["parts_3d"],
                    assembly_2d=comp["assembly_2d"],
                    parts_2d=comp["parts_2d"],
                    status=comp["status"],
                    submitted_date=comp["submitted_date"]
                )
                db.add(db_comp)
            await db.commit()
            
        await sio.emit('schedule_updated')
        return {"success": True, "message": f"Successfully imported {len(jobs_dict)} jobs from spreadsheet."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database import transaction failed: {e}")


@router.get("/export")
async def export_to_excel(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Export the current database state back to the Excel file by updating the 
    master file in-place, preserving the original layout, formatting, formulas, and Gantt charts.
    Streams the Excel file to the client for download.
    """
    if not os.path.exists(EXCEL_FILE_PATH):
        raise HTTPException(status_code=404, detail="Source Excel file not found on server.")
        
    db_components = await WorkScheduleRepository.get_all_components(db)
    db_jobs = await WorkScheduleRepository.get_all_jobs(db)
    db_assignments = await WorkScheduleRepository.get_all_assignments(db)
    
    # Load or seed members list
    db_members_obj = await WorkScheduleRepository.get_all_members(db)
    if not db_members_obj:
        layout = await asyncio.to_thread(ExcelScheduleService._load_and_parse_layout, EXCEL_FILE_PATH)
        for m in layout["members"]:
            await WorkScheduleRepository.create_member(db, m)
        db_members_obj = await WorkScheduleRepository.get_all_members(db)
    db_members = [m.name for m in db_members_obj]
    
    try:
        output = await asyncio.to_thread(
            ExcelScheduleService.generate_excel_export,
            EXCEL_FILE_PATH,
            db_components,
            db_jobs,
            db_assignments,
            db_members
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel export: {e}")
        
    headers = {
        'Content-Disposition': 'attachment; filename="KMTI Work Schedule Monitoring 2026.06.19.xlsx"'
    }
    return StreamingResponse(
        output,
        headers=headers,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@router.get("/timeline")
async def get_timeline(db: AsyncSession = Depends(get_db)):
    """
    Parses the Gantt chart timeline columns 20 onwards of the Excel sheet.
    """
    if not os.path.exists(EXCEL_FILE_PATH):
        raise HTTPException(status_code=404, detail="Source Excel file not found on server.")
        
    db_members_obj = await WorkScheduleRepository.get_all_members(db)
    if not db_members_obj:
        layout = await asyncio.to_thread(ExcelScheduleService._load_and_parse_layout, EXCEL_FILE_PATH)
        for m in layout["members"]:
            await WorkScheduleRepository.create_member(db, m)
        db_members_obj = await WorkScheduleRepository.get_all_members(db)
    db_members = [m.name for m in db_members_obj]
    
    db_assignments = await WorkScheduleRepository.get_all_assignments(db)
    
    try:
        res = await ExcelScheduleService.parse_timeline(EXCEL_FILE_PATH, db_assignments, db_members)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load spreadsheet: {e}")
        
    return {
        "success": True,
        "members": res["members"],
        "timeline": res["timeline"]
    }


@router.post("/timeline")
async def update_timeline_cell(
    payload: TimelineUpdatePayload,
    user = Depends(require_schedule_write),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a single Gantt chart cell in the database.
    """
    # Check if member exists in Excel legend OR database
    target_row = await ExcelScheduleService.get_target_row_for_member(EXCEL_FILE_PATH, payload.member_name)
    if not target_row:
        all_members = await WorkScheduleRepository.get_all_members(db)
        if not any(m.name.strip().lower() == payload.member_name.strip().lower() for m in all_members):
            raise HTTPException(status_code=404, detail=f"Member '{payload.member_name}' not found.")
        
    assignment = await WorkScheduleRepository.get_assignment(db, payload.member_name, payload.col_index)
    
    if assignment:
        assignment.value = payload.value if payload.value else None
    else:
        assignment = WorkScheduleAssignment(
            member_name=payload.member_name,
            col_index=payload.col_index,
            value=payload.value if payload.value else None
        )
        db.add(assignment)
        
    await db.commit()
    await sio.emit('schedule_updated')
    return {"success": True, "message": "Timeline cell updated in database."}


@router.post("/timeline/span")
async def update_timeline_span(
    payload: TimelineSpanPayload,
    user = Depends(require_schedule_write),
    db: AsyncSession = Depends(get_db)
):
    """
    Update a range of Gantt chart cells representing a duration span in the database.
    """
    # Check if member exists in Excel legend OR database
    target_row = await ExcelScheduleService.get_target_row_for_member(EXCEL_FILE_PATH, payload.member_name)
    if not target_row:
        all_members = await WorkScheduleRepository.get_all_members(db)
        if not any(m.name.strip().lower() == payload.member_name.strip().lower() for m in all_members):
            raise HTTPException(status_code=404, detail=f"Member '{payload.member_name}' not found.")
        
    start = min(payload.start_col, payload.end_col)
    end = max(payload.start_col, payload.end_col)
    
    existing_list = await WorkScheduleRepository.get_assignments_in_range(db, payload.member_name, start, end)
    existing_assignments = {a.col_index: a for a in existing_list}
    
    center = (start + end) // 2
    for c in range(start, end + 1):
        if not payload.job_code.strip():
            val = None
        else:
            if c == center:
                val = payload.job_code
            else:
                val = "-->"
            
        if c in existing_assignments:
            existing_assignments[c].value = val
        else:
            new_assign = WorkScheduleAssignment(
                member_name=payload.member_name,
                col_index=c,
                value=val
            )
            db.add(new_assign)
            
    await db.commit()
    await sio.emit('schedule_updated')
    return {"success": True, "message": "Timeline span updated in database."}


# --- Employee/Member CRUD Endpoints ---

@router.get("/members")
async def get_members(db: AsyncSession = Depends(get_db)):
    """
    Get all active employees/members from the database.
    """
    members = await WorkScheduleRepository.get_all_members(db)
    return {
        "success": True,
        "members": [{"id": m.id, "name": m.name, "display_order": m.display_order} for m in members]
    }


@router.post("/members")
async def create_member(
    payload: MemberCreatePayload,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Add a new employee/member to the timeline calendar.
    """
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Employee name cannot be empty.")
        
    # Check duplicate
    from sqlalchemy import select
    res = await db.execute(select(WorkScheduleMember).where(WorkScheduleMember.name == name))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Employee '{name}' already exists.")
        
    member = await WorkScheduleRepository.create_member(db, name)
    ExcelScheduleService.clear_cache()  # Invalidate cached Excel layout structure
    await sio.emit('schedule_updated')
    return {"success": True, "member": {"id": member.id, "name": member.name}}


@router.put("/members")
async def rename_member(
    payload: MemberRenamePayload,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Rename an employee/member and automatically migrate their schedule assignments.
    """
    old_name = payload.old_name.strip()
    new_name = payload.new_name.strip()
    if not old_name or not new_name:
        raise HTTPException(status_code=400, detail="Names cannot be empty.")
        
    member = await WorkScheduleRepository.rename_member(db, old_name, new_name)
    if not member:
        raise HTTPException(status_code=404, detail=f"Employee '{old_name}' not found.")
        
    ExcelScheduleService.clear_cache()  # Invalidate cached Excel layout structure
    await sio.emit('schedule_updated')
    return {"success": True, "member": {"id": member.id, "name": member.name}}


@router.delete("/members/{name}")
async def delete_member(
    name: str,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_schedule_write)
):
    """
    Delete an employee/member and remove all their schedule assignments.
    """
    name = name.strip()
    success = await WorkScheduleRepository.delete_member(db, name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Employee '{name}' not found.")
        
    ExcelScheduleService.clear_cache()  # Invalidate cached Excel layout structure
    await sio.emit('schedule_updated')
    return {"success": True, "message": f"Employee '{name}' removed successfully."}
