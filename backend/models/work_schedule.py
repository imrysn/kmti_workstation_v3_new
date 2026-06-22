from sqlalchemy import Column, String, Integer, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from db.database import Base

class WorkScheduleJob(Base):
    """
    Represents a main Job group monitored in the schedule.
    """
    __tablename__ = "work_schedule_jobs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id = Column(String(100), unique=True, index=True, nullable=False)
    deadline = Column(String(255), nullable=True)

    components = relationship("WorkScheduleComponent", back_populates="job", cascade="all, delete-orphan")


class WorkScheduleComponent(Base):
    """
    Represents a drawing/component unit code monitored within a Job.
    """
    __tablename__ = "work_schedule_components"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id = Column(String(100), ForeignKey("work_schedule_jobs.job_id", ondelete="CASCADE"), index=True, nullable=False)
    unit_code = Column(String(255), nullable=False)
    
    # Assembly/Parts parameters (usually strings like '1', '-', '0.85', etc.)
    assembly_3d = Column(String(50), nullable=True)
    parts_3d = Column(String(50), nullable=True)
    assembly_2d = Column(String(50), nullable=True)
    parts_2d = Column(String(50), nullable=True)
    
    status = Column(String(100), nullable=True, default="Pending/Not Started")
    submitted_date = Column(Date, nullable=True)

    job = relationship("WorkScheduleJob", back_populates="components")


class WorkScheduleAssignment(Base):
    """
    Represents an assignment/arrow value in a specific grid cell (member_name, col_index).
    """
    __tablename__ = "work_schedule_assignments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    member_name = Column(String(255), index=True, nullable=False)
    col_index = Column(Integer, index=True, nullable=False)
    value = Column(String(255), nullable=True)

    __table_args__ = (
        UniqueConstraint('member_name', 'col_index', name='uix_member_col'),
    )

