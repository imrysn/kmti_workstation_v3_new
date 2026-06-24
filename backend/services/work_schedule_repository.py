from typing import List, Optional
import datetime
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from models.work_schedule import WorkScheduleJob, WorkScheduleComponent, WorkScheduleAssignment

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
