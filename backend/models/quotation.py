from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from db.database import Base

class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    quotation_no = Column(String(50), unique=True, index=True, nullable=False)
    client_name = Column(String(255), index=True)
    designer_name = Column(String(255), index=True)
    date = Column(DateTime, default=datetime.utcnow)
    data = Column(Text, nullable=False) # Changed from JSON to Text for MariaDB compatibility
    
    # Collaboration Session Metadata
    is_active = Column(Boolean, default=False)
    password = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    history = relationship("QuotationHistory", back_populates="quotation", cascade="all, delete-orphan")

class QuotationHistory(Base):
    __tablename__ = "quotation_history"

    id = Column(Integer, primary_key=True, index=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=False)
    label = Column(String(255))
    author = Column(String(255))
    data = Column(Text, nullable=False) # Changed from JSON to Text for MariaDB compatibility
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    quotation = relationship("Quotation", back_populates="history")
