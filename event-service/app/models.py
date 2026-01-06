from sqlalchemy import Column, Integer, String, Text, ForeignKey
from .db import Base

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    location = Column(String(200))
    date = Column(String(100))
    seats = Column(Integer)
    organizer = Column(String(200))  # Speaker/Organizer name

class Participant(Base):
    __tablename__ = "participants"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False)
    phone = Column(String(50))
