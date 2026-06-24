from typing import List, Optional
import datetime
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from models.work_schedule import WorkScheduleJob, WorkScheduleComponent, WorkScheduleAssignment, WorkScheduleMember

class WorkScheduleRepository:
    @staticmethod
    async def get_all_jobs(db: AsyncSession) -> List[WorkScheduleJob]:
        stmt = select(WorkScheduleJob)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_all_components(db: AsyncSession) -> List[WorkScheduleComponent]:
        stmt = select(WorkScheduleComponent)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_components_by_job(db: AsyncSession, job_id: str) -> List[WorkScheduleComponent]:
        stmt = select(WorkScheduleComponent).where(WorkScheduleComponent.job_id == job_id)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_job_by_id(db: AsyncSession, job_id: str) -> Optional[WorkScheduleJob]:
        stmt = select(WorkScheduleJob).where(WorkScheduleJob.job_id == job_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def get_component_by_id(db: AsyncSession, component_id: int) -> Optional[WorkScheduleComponent]:
        return await db.get(WorkScheduleComponent, component_id)

    @staticmethod
    async def create_job(db: AsyncSession, job_id: str, deadline: Optional[str]) -> WorkScheduleJob:
        new_job = WorkScheduleJob(job_id=job_id, deadline=deadline)
        db.add(new_job)
        await db.commit()
        await db.refresh(new_job)
        return new_job

    @staticmethod
    async def delete_job(db: AsyncSession, job: WorkScheduleJob) -> None:
        await db.delete(job)
        await db.commit()

    @staticmethod
    async def create_component(
        db: AsyncSession,
        job_id: str,
        unit_code: str,
        assembly_3d: str,
        parts_3d: str,
        assembly_2d: str,
        parts_2d: str,
        status: str,
        submitted_date: Optional[datetime.date],
        is_postponed: Optional[int] = 0
    ) -> WorkScheduleComponent:
        new_comp = WorkScheduleComponent(
            job_id=job_id,
            unit_code=unit_code,
            assembly_3d=assembly_3d,
            parts_3d=parts_3d,
            assembly_2d=assembly_2d,
            parts_2d=parts_2d,
            status=status,
            submitted_date=submitted_date,
            is_postponed=is_postponed if is_postponed is not None else 0
        )
        db.add(new_comp)
        await db.commit()
        await db.refresh(new_comp)
        return new_comp

    @staticmethod
    async def delete_component(db: AsyncSession, comp: WorkScheduleComponent) -> None:
        await db.delete(comp)
        await db.commit()

    @staticmethod
    async def get_all_assignments(db: AsyncSession) -> List[WorkScheduleAssignment]:
        stmt = select(WorkScheduleAssignment)
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def get_assignment(db: AsyncSession, member_name: str, col_index: int) -> Optional[WorkScheduleAssignment]:
        stmt = select(WorkScheduleAssignment).where(
            WorkScheduleAssignment.member_name == member_name,
            WorkScheduleAssignment.col_index == col_index
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    @staticmethod
    async def get_assignments_in_range(db: AsyncSession, member_name: str, start: int, end: int) -> List[WorkScheduleAssignment]:
        stmt = select(WorkScheduleAssignment).where(
            WorkScheduleAssignment.member_name == member_name,
            WorkScheduleAssignment.col_index >= start,
            WorkScheduleAssignment.col_index <= end
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def clear_all_components_and_jobs(db: AsyncSession) -> None:
        await db.execute(delete(WorkScheduleComponent))
        await db.execute(delete(WorkScheduleJob))
        await db.commit()

    @staticmethod
    async def get_all_members(db: AsyncSession) -> List[WorkScheduleMember]:
        stmt = select(WorkScheduleMember).order_by(WorkScheduleMember.display_order.asc(), WorkScheduleMember.id.asc())
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @staticmethod
    async def create_member(db: AsyncSession, name: str) -> WorkScheduleMember:
        # Check if already exists
        stmt = select(WorkScheduleMember).where(WorkScheduleMember.name == name)
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            return existing
            
        # Get max display order
        stmt = select(WorkScheduleMember)
        res = await db.execute(stmt)
        all_m = res.scalars().all()
        next_order = max((m.display_order for m in all_m), default=0) + 1

        new_member = WorkScheduleMember(name=name, display_order=next_order)
        db.add(new_member)
        await db.commit()
        await db.refresh(new_member)
        return new_member

    @staticmethod
    async def rename_member(db: AsyncSession, old_name: str, new_name: str) -> Optional[WorkScheduleMember]:
        stmt = select(WorkScheduleMember).where(WorkScheduleMember.name == old_name)
        res = await db.execute(stmt)
        member = res.scalar_one_or_none()
        if not member:
            return None
        
        member.name = new_name
        
        # Also update assignments associated with this member name
        from sqlalchemy import update
        await db.execute(
            update(WorkScheduleAssignment)
            .where(WorkScheduleAssignment.member_name == old_name)
            .values(member_name=new_name)
        )
        
        await db.commit()
        await db.refresh(member)
        return member

    @staticmethod
    async def delete_member(db: AsyncSession, name: str) -> bool:
        stmt = select(WorkScheduleMember).where(WorkScheduleMember.name == name)
        res = await db.execute(stmt)
        member = res.scalar_one_or_none()
        if not member:
            return False
            
        await db.delete(member)
        
        # Also delete assignments associated with this member name
        await db.execute(
            delete(WorkScheduleAssignment)
            .where(WorkScheduleAssignment.member_name == name)
        )
        
        await db.commit()
        return True
