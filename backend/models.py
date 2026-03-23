"""
SQLAlchemy models reflecting the EXISTING kmtiworkstationvb MySQL schema.
No changes to the original tables.
Real schema confirmed from VB source:
  tblfile: Category, Parts_Type, file, dataFile (no id column)
  char_search: see VB mod files
  heat_trmnt: see VB mod files
"""
from sqlalchemy import Column, String, LargeBinary, Text, Integer, Float, Boolean, ForeignKey
from database import Base

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True)
    root_path = Column(String(1024))
    total_files = Column(Integer, default=0)
    cad_files = Column(Integer, default=0)
    is_scanning = Column(Boolean, default=False)

class CadFileIndex(Base):
    """Maps to new `cad_file_index` table — NAS CAD file metadata cache."""
    __tablename__ = "cad_file_index"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    is_folder = Column(Boolean, default=False, index=True)
    file_name = Column(String(255), index=True)
    file_type = Column(String(50), index=True)
    file_path = Column(Text)
    category = Column(String(255), index=True)
    part_type = Column(String(255), index=True)
    size = Column(Integer)
    last_modified = Column(Float)
    part_geom_name = Column(String(255), nullable=True)
    bound_x = Column(Float, nullable=True)
    bound_y = Column(Float, nullable=True)
    bound_z = Column(Float, nullable=True)

class CharSearch(Base):
    """Maps to existing `char_search` table — English/Japanese character mapping."""
    __tablename__ = "char_search"

    id = Column(String(255), primary_key=True)
    eng_char = Column(String(255))
    jp_char = Column(String(255))


class HeatTreatment(Base):
    """Maps to existing `heat_trmnt` table — Heat treatment categories."""
    __tablename__ = "heat_trmnt"

    id = Column(String(255), primary_key=True)
    category = Column(String(255))
    eng_char = Column(String(255))
    jp_char = Column(String(255))
