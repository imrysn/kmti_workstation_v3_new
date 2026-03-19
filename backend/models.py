"""
SQLAlchemy models reflecting the EXISTING kmtiworkstationvb MySQL schema.
No changes to the original tables.
Real schema confirmed from VB source:
  tblfile: Category, Parts_Type, file, dataFile (no id column)
  char_search: see VB mod files
  heat_trmnt: see VB mod files
"""
from sqlalchemy import Column, String, LargeBinary, Text
from database import Base

class TblFile(Base):
    """Maps to existing `tblfile` table — Purchased Parts + binary drawing data."""
    __tablename__ = "tblfile"

    # 'file' is used as the natural key (filename is unique per record)
    Category = Column(String(255))
    Parts_Type = Column(String(255))
    file = Column(String(255), primary_key=True, index=True)
    dataFile = Column(LargeBinary)  # LONGBLOB — loaded on demand only


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
