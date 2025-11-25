from sqlalchemy import Column, Integer, String, Text
from .db import Base

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    location = Column(String(200))
    date = Column(String(100))
    seats = Column(Integer)
