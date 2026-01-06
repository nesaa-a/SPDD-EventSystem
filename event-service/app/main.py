from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from .db import SessionLocal, init_db
from .models import Event, Participant
from .kafka_producer import KafkaProducerClient
import os

app = FastAPI()
init_db()  # create tables (if using SQLAlchemy ORM + create_all)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:9092")
producer = KafkaProducerClient(bootstrap_servers=KAFKA_BROKER)

class EventIn(BaseModel):
    title: str
    description: str = None
    location: str
    date: str
    seats: int

class EventOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    location: str
    date: str
    seats: int

    class Config:
        from_attributes = True

class ParticipantIn(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None

class ParticipantOut(BaseModel):
    id: int
    event_id: int
    name: str
    email: str
    phone: Optional[str]

    class Config:
        from_attributes = True

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/events", response_model=List[EventOut])
def get_events():
    db = SessionLocal()
    try:
        events = db.query(Event).all()
        return events
    finally:
        db.close()

@app.get("/events/{event_id}", response_model=EventOut)
def get_event(event_id: int):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return event
    finally:
        db.close()

@app.post("/events")
def create_event(ev: EventIn):
    db = SessionLocal()
    try:
        # create event in Postgres
        event = Event(title=ev.title, description=ev.description, location=ev.location, date=ev.date, seats=ev.seats)
        db.add(event)
        db.commit()
        db.refresh(event)

        # publish to Kafka
        payload = {
            "id": event.id,
            "title": event.title,
            "location": event.location,
            "date": event.date,
            "seats": event.seats
        }
        try:
            producer.publish("event.created", payload)
        except Exception as e:
            # optionally: write to DLQ or log for retry
            raise HTTPException(status_code=500, detail=f"Kafka publish failed: {e}")

        return {"id": event.id, "message": "Event created"}
    finally:
        db.close()

@app.delete("/events/{event_id}")
def delete_event(event_id: int):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Delete all participants for this event first
        db.query(Participant).filter(Participant.event_id == event_id).delete()
        
        # Delete the event
        db.delete(event)
        db.commit()
        return {"message": "Event deleted successfully"}
    finally:
        db.close()

@app.get("/events/{event_id}/participants", response_model=List[ParticipantOut])
def get_participants(event_id: int):
    db = SessionLocal()
    try:
        # Check if event exists
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        participants = db.query(Participant).filter(Participant.event_id == event_id).all()
        return participants
    finally:
        db.close()

@app.post("/events/{event_id}/participants", response_model=ParticipantOut)
def register_participant(event_id: int, participant: ParticipantIn):
    db = SessionLocal()
    try:
        # Check if event exists
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check if seats are available
        participant_count = db.query(Participant).filter(Participant.event_id == event_id).count()
        if participant_count >= event.seats:
            raise HTTPException(status_code=400, detail="Event is full. No more seats available.")
        
        # Check if email already registered for this event
        existing = db.query(Participant).filter(
            Participant.event_id == event_id,
            Participant.email == participant.email
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered for this event")
        
        # Create participant
        new_participant = Participant(
            event_id=event_id,
            name=participant.name,
            email=participant.email,
            phone=participant.phone
        )
        db.add(new_participant)
        db.commit()
        db.refresh(new_participant)
        return new_participant
    finally:
        db.close()

@app.delete("/events/{event_id}/participants/{participant_id}")
def remove_participant(event_id: int, participant_id: int):
    db = SessionLocal()
    try:
        # Check if event exists
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check if participant exists
        participant = db.query(Participant).filter(
            Participant.id == participant_id,
            Participant.event_id == event_id
        ).first()
        if not participant:
            raise HTTPException(status_code=404, detail="Participant not found")
        
        db.delete(participant)
        db.commit()
        return {"message": "Participant removed successfully"}
    finally:
        db.close()
