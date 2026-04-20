from sqlalchemy import Column, String, Integer, DateTime, Text, text
from sqlalchemy.sql import func
from db.database import Base

class LibrarianLearnedFact(Base):
    """
    The 'Machine Learning' core of the Librarian.
    Stores distilled technical facts that the AI has 'learned' from previous interactions.
    Shared across ALL workstations.
    """
    __tablename__ = "kmti_librarian_knowledge"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query_pattern = Column(Text, nullable=False) # The original question or topic
    learned_fact = Column(Text, nullable=False) # The distilled technical answer
    source_query = Column(Text, nullable=True) # Verbatim user query
    hit_count = Column(Integer, default=1) # Popularity of this fact
    created_at = Column(DateTime, server_default=func.now())
    last_verified = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Note: For production performance, a FULLTEXT index should be added to 
    # query_pattern and learned_fact fields in the database.
