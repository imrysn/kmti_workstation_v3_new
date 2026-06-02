from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import relationship
from db.database import Base

class CustomPage(Base):
    """
    User-defined translation pages/tabs (e.g., Surface Treatment, Plating).
    """
    __tablename__ = "kmti_custom_pages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), unique=True, nullable=False, index=True)

    mappings = relationship("CustomMapping", back_populates="page", cascade="all, delete-orphan")


class CustomMapping(Base):
    """
    English-Japanese translation rows belonging to a custom page.
    """
    __tablename__ = "kmti_custom_mappings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    page_id = Column(Integer, ForeignKey("kmti_custom_pages.id", ondelete="CASCADE"), nullable=False, index=True)
    english_name = Column(String(1000), nullable=False)
    japanese_name = Column(String(1000), nullable=False)

    page = relationship("CustomPage", back_populates="mappings")
