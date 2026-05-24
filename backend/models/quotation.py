from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from db.database import Base

class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    quotation_no = Column(String(50), unique=True, index=True, nullable=False)
    client_name = Column(String(255), index=True)
    designer_name = Column(String(255), index=True)
    workstation = Column(String(255), index=True) # "Owner" (Hostname)
    date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    data = Column(Text, nullable=False) # Changed from JSON to Text for MariaDB compatibility
    
    # Collaboration Session Metadata
    is_active = Column(Boolean, default=False)
    password = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    
    # Billing & Monitoring fields
    grand_total = Column(Numeric(10, 2), default=0.0)
    customer_incharge = Column(String(255), nullable=True)
    quotation_status = Column(String(50), default="For Approval")
    project_status = Column(String(50), default="On Going")
    submitted_to_admin_at = Column(DateTime, nullable=True)
    bill_to = Column(String(255), nullable=True)
    date_paid = Column(DateTime, nullable=True)
    updated_by = Column(String(255), nullable=True)
    last_updated_at = Column(DateTime, nullable=True)
    update_detail = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    history = relationship("QuotationHistory", back_populates="quotation", cascade="all, delete-orphan")

class QuotationHistory(Base):
    __tablename__ = "quotation_history"

    id = Column(Integer, primary_key=True, index=True)
    quotation_id = Column(Integer, ForeignKey("quotations.id"), nullable=False)
    label = Column(String(255))
    author = Column(String(255))
    data = Column(Text, nullable=False) # Changed from JSON to Text for MariaDB compatibility
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    quotation = relationship("Quotation", back_populates="history")
