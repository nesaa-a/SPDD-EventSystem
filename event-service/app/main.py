from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from .db import SessionLocal, init_db
from .models import Event
from .kafka_producer import KafkaProducerClient
import os

app = FastAPI()
init_db()  # create tables (if using SQLAlchemy ORM + create_all)

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:9092")
producer = KafkaProducerClient(bootstrap_servers=KAFKA_BROKER)

class EventIn(BaseModel):
    title: str
    description: str = None
    location: str
    date: str
    seats: int

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/events")
def create_event(ev: EventIn):
    db = SessionLocal()
    # create event in Postgres
    event = Event(title=ev.title, description=ev.description, location=ev.location, date=ev.date, seats=ev.seats)
    db.add(event)
    db.commit()
    db.refresh(event)
    db.close()

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
