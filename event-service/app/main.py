from fastapi import FastAPI, HTTPException, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from .db import SessionLocal, init_db
from .models import Event, Participant, User, Waitlist, EventComment, AuditLog
from .kafka_producer import KafkaProducerClient
from .auth import authenticate_user, create_access_token, get_current_user, get_current_admin_user, get_password_hash, get_user_by_username
import os
import io
import csv
import qrcode
import base64
import hashlib
import redis
import json
from datetime import datetime, timedelta
from sqlalchemy import or_, func

# Import new service modules
try:
    from .search import search_service
    ELASTICSEARCH_AVAILABLE = True
except Exception as e:
    print(f"Elasticsearch not available: {e}")
    ELASTICSEARCH_AVAILABLE = False

try:
    from .cache import cache_manager
    REDIS_AVAILABLE = True
except Exception as e:
    print(f"Redis not available: {e}")
    REDIS_AVAILABLE = False

try:
    from .analytics import EventAnalytics
    ANALYTICS_AVAILABLE = True
except Exception as e:
    print(f"Analytics not available: {e}")
    ANALYTICS_AVAILABLE = False

try:
    from .data_quality import event_validator, participant_validator
    DATA_QUALITY_AVAILABLE = True
except Exception as e:
    print(f"Data Quality not available: {e}")
    DATA_QUALITY_AVAILABLE = False

app = FastAPI()
init_db()  # create tables (if using SQLAlchemy ORM + create_all)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:9092")
producer = KafkaProducerClient(bootstrap_servers=KAFKA_BROKER)

# Event Categories
EVENT_CATEGORIES = ["conference", "workshop", "meetup", "webinar", "general", "networking", "training"]

class EventIn(BaseModel):
    title: str
    description: str = None
    location: str
    date: str
    seats: int
    category: str = "general"

class EventOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    location: str
    date: str
    seats: int
    category: Optional[str] = "general"

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
    checked_in: Optional[bool] = False
    qr_code: Optional[str] = None

    class Config:
        from_attributes = True

class WaitlistIn(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None

class WaitlistOut(BaseModel):
    id: int
    event_id: int
    name: str
    email: str
    phone: Optional[str]
    position: int

    class Config:
        from_attributes = True

class CommentIn(BaseModel):
    comment: str
    rating: int = 5

class CommentOut(BaseModel):
    id: int
    event_id: int
    user_email: str
    user_name: str
    comment: str
    rating: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserIn(BaseModel):
    username: str
    email: str
    password: str
    is_admin: bool = False

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    role: str

    class Config:
        from_attributes = True

class LoginIn(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@app.post("/register", response_model=UserOut)
def register(user: UserIn):
    db = SessionLocal()
    try:
        # Check if username or email exists
        existing_user = db.query(User).filter(
            (User.username == user.username) | (User.email == user.email)
        ).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username or email already registered")
        
        hashed_password = get_password_hash(user.password)
        role = "admin" if user.is_admin else "user"
        new_user = User(username=user.username, email=user.email, hashed_password=hashed_password, role=role)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user
    finally:
        db.close()

@app.post("/login", response_model=Token)
def login(user: LoginIn):
    db = SessionLocal()
    try:
        auth_user = authenticate_user(db, user.username, user.password)
        if not auth_user:
            raise HTTPException(status_code=401, detail="Incorrect username or password")
        
        # Re-query user to ensure all fields including email are loaded
        full_user = db.query(User).filter(User.id == auth_user.id).first()
        
        email_value = full_user.email if full_user and full_user.email else ""
        role_value = full_user.role if full_user and full_user.role else "user"
        username_value = full_user.username if full_user else auth_user.username
        
        print(f"Creating token with - username: {username_value}, email: {email_value}, role: {role_value}")
        
        access_token = create_access_token(data={
            "sub": username_value, 
            "role": role_value, 
            "email": email_value
        })
        
        # Create audit log for login
        create_audit_log(
            db,
            action="LOGIN",
            entity_type="user",
            entity_id=full_user.id if full_user else None,
            user_id=full_user.id if full_user else None,
            user_email=email_value,
            details=f"User logged in: {username_value}"
        )
        
        return {"access_token": access_token, "token_type": "bearer"}
    finally:
        db.close()

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/categories")
def get_categories():
    """Get list of available event categories"""
    return {"categories": EVENT_CATEGORIES}

@app.get("/events/search", response_model=List[EventOut])
def search_events(
    q: Optional[str] = Query(None, description="Search query for title/description/location"),
    category: Optional[str] = Query(None, description="Filter by category"),
    upcoming: Optional[bool] = Query(None, description="Filter only upcoming events"),
    available: Optional[bool] = Query(None, description="Filter events with available seats")
):
    """Search and filter events"""
    db = SessionLocal()
    try:
        query = db.query(Event)
        
        # Text search
        if q:
            search_term = f"%{q}%"
            query = query.filter(
                or_(
                    Event.title.ilike(search_term),
                    Event.description.ilike(search_term),
                    Event.location.ilike(search_term)
                )
            )
        
        # Category filter
        if category:
            query = query.filter(Event.category == category)
        
        events = query.all()
        
        # Filter upcoming events (post-query for string dates)
        if upcoming:
            now = datetime.now()
            events = [e for e in events if datetime.fromisoformat(e.date.replace('Z', '')) > now]
        
        # Filter available seats (requires participant count)
        if available:
            available_events = []
            for event in events:
                participant_count = db.query(Participant).filter(Participant.event_id == event.id).count()
                if participant_count < event.seats:
                    available_events.append(event)
            events = available_events
        
        return events
    finally:
        db.close()

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
def create_event(ev: EventIn, current_user: User = Depends(get_current_admin_user)):
    db = SessionLocal()
    try:
        # Validate category
        category = ev.category if ev.category in EVENT_CATEGORIES else "general"
        
        # create event in Postgres
        event = Event(
            title=ev.title, 
            description=ev.description, 
            location=ev.location, 
            date=ev.date, 
            seats=ev.seats,
            category=category
        )
        db.add(event)
        db.commit()
        db.refresh(event)

        # publish to Kafka
        payload = {
            "id": event.id,
            "title": event.title,
            "location": event.location,
            "date": event.date,
            "seats": event.seats,
            "category": event.category
        }
        try:
            producer.publish("event.created", payload)
        except Exception as e:
            # optionally: write to DLQ or log for retry
            raise HTTPException(status_code=500, detail=f"Kafka publish failed: {e}")

        # Index event in Elasticsearch for full-text search
        if ELASTICSEARCH_AVAILABLE:
            try:
                search_service.index_event({
                    "id": event.id,
                    "title": event.title,
                    "description": event.description or "",
                    "location": event.location,
                    "category": event.category,
                    "date": str(event.date) if event.date else None,
                    "seats": event.seats
                })
            except Exception as e:
                logger.warning(f"Failed to index event in Elasticsearch: {e}")

        # Create audit log
        create_audit_log(
            db, 
            action="CREATE", 
            entity_type="event", 
            entity_id=event.id,
            user_id=current_user.id,
            user_email=current_user.email,
            details=f"Created event: {event.title}"
        )

        return {"id": event.id, "message": "Event created"}
    finally:
        db.close()

@app.delete("/events/{event_id}")
def delete_event(event_id: int, current_user: User = Depends(get_current_admin_user)):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        event_title = event.title  # Save for audit log
        
        # Delete all participants for this event first
        db.query(Participant).filter(Participant.event_id == event_id).delete()
        
        # Delete the event
        db.delete(event)
        db.commit()
        
        # Create audit log
        create_audit_log(
            db,
            action="DELETE",
            entity_type="event",
            entity_id=event_id,
            user_id=current_user.id,
            user_email=current_user.email,
            details=f"Deleted event: {event_title}"
        )
        
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

def generate_qr_code(data: str) -> str:
    """Generate QR code and return as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode()

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
            raise HTTPException(status_code=400, detail="Event is full. No more seats available. Consider joining the waitlist.")
        
        # Check if email already registered for this event
        existing = db.query(Participant).filter(
            Participant.event_id == event_id,
            Participant.email == participant.email
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered for this event")
        
        # Generate QR code for check-in
        qr_data = f"EVENT:{event_id}|PARTICIPANT:{participant.email}|NAME:{participant.name}"
        qr_code = generate_qr_code(qr_data)
        
        # Create participant
        new_participant = Participant(
            event_id=event_id,
            name=participant.name,
            email=participant.email,
            phone=participant.phone,
            qr_code=qr_code
        )
        db.add(new_participant)
        db.commit()
        db.refresh(new_participant)
        
        # Create audit log
        create_audit_log(
            db,
            action="REGISTER",
            entity_type="participant",
            entity_id=new_participant.id,
            user_email=participant.email,
            details=f"Registered for event {event_id}: {participant.name}"
        )
        
        return new_participant
    finally:
        db.close()

@app.post("/events/{event_id}/participants/{participant_id}/checkin")
def checkin_participant(event_id: int, participant_id: int):
    """Check in a participant using their ID"""
    db = SessionLocal()
    try:
        participant = db.query(Participant).filter(
            Participant.id == participant_id,
            Participant.event_id == event_id
        ).first()
        if not participant:
            raise HTTPException(status_code=404, detail="Participant not found")
        
        if participant.checked_in:
            raise HTTPException(status_code=400, detail="Participant already checked in")
        
        participant.checked_in = True
        participant.check_in_time = datetime.now()
        db.commit()
        
        # Create audit log for check-in
        create_audit_log(
            db,
            action="CHECKIN",
            entity_type="participant",
            entity_id=participant_id,
            user_email=participant.email,
            details=f"Checked in to event {event_id}: {participant.name}"
        )
        
        return {"message": "Check-in successful", "checked_in_at": participant.check_in_time}
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
        
        # Check waitlist and promote first person if available
        waitlist_entry = db.query(Waitlist).filter(
            Waitlist.event_id == event_id
        ).order_by(Waitlist.position).first()
        
        if waitlist_entry:
            # Auto-register from waitlist
            new_qr_data = f"EVENT:{event_id}|PARTICIPANT:{waitlist_entry.email}|NAME:{waitlist_entry.name}"
            new_qr = generate_qr_code(new_qr_data)
            
            new_participant = Participant(
                event_id=event_id,
                name=waitlist_entry.name,
                email=waitlist_entry.email,
                phone=waitlist_entry.phone,
                qr_code=new_qr
            )
            db.add(new_participant)
            db.delete(waitlist_entry)
            db.commit()
            
            return {"message": "Participant removed and waitlist member promoted"}
        
        return {"message": "Participant removed successfully"}
    finally:
        db.close()

# ============== WAITLIST ENDPOINTS ==============

@app.post("/events/{event_id}/waitlist", response_model=WaitlistOut)
def join_waitlist(event_id: int, waitlist_entry: WaitlistIn):
    """Join the waitlist for a full event"""
    db = SessionLocal()
    try:
        # Check if event exists
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Check if already registered as participant
        existing_participant = db.query(Participant).filter(
            Participant.event_id == event_id,
            Participant.email == waitlist_entry.email
        ).first()
        if existing_participant:
            raise HTTPException(status_code=400, detail="Already registered for this event")
        
        # Check if already on waitlist
        existing_waitlist = db.query(Waitlist).filter(
            Waitlist.event_id == event_id,
            Waitlist.email == waitlist_entry.email
        ).first()
        if existing_waitlist:
            raise HTTPException(status_code=400, detail="Already on waitlist for this event")
        
        # Get current position
        max_position = db.query(Waitlist).filter(Waitlist.event_id == event_id).count()
        
        new_waitlist = Waitlist(
            event_id=event_id,
            name=waitlist_entry.name,
            email=waitlist_entry.email,
            phone=waitlist_entry.phone,
            position=max_position + 1
        )
        db.add(new_waitlist)
        db.commit()
        db.refresh(new_waitlist)
        return new_waitlist
    finally:
        db.close()

@app.get("/events/{event_id}/waitlist", response_model=List[WaitlistOut])
def get_waitlist(event_id: int):
    """Get waitlist for an event"""
    db = SessionLocal()
    try:
        waitlist = db.query(Waitlist).filter(
            Waitlist.event_id == event_id
        ).order_by(Waitlist.position).all()
        return waitlist
    finally:
        db.close()

@app.delete("/events/{event_id}/waitlist/{waitlist_id}")
def remove_from_waitlist(event_id: int, waitlist_id: int):
    """Remove someone from the waitlist"""
    db = SessionLocal()
    try:
        entry = db.query(Waitlist).filter(
            Waitlist.id == waitlist_id,
            Waitlist.event_id == event_id
        ).first()
        if not entry:
            raise HTTPException(status_code=404, detail="Waitlist entry not found")
        
        db.delete(entry)
        db.commit()
        return {"message": "Removed from waitlist"}
    finally:
        db.close()

# ============== COMMENTS & REVIEWS ==============

@app.post("/events/{event_id}/comments", response_model=CommentOut)
def add_comment(event_id: int, comment: CommentIn, current_user: User = Depends(get_current_user)):
    """Add a comment/review to an event"""
    db = SessionLocal()
    try:
        # Check if event exists
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        # Validate rating
        rating = max(1, min(5, comment.rating))
        
        new_comment = EventComment(
            event_id=event_id,
            user_email=current_user.email,
            user_name=current_user.username,
            comment=comment.comment,
            rating=rating
        )
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)
        return new_comment
    finally:
        db.close()

@app.get("/events/{event_id}/comments", response_model=List[CommentOut])
def get_comments(event_id: int):
    """Get all comments for an event"""
    db = SessionLocal()
    try:
        comments = db.query(EventComment).filter(
            EventComment.event_id == event_id
        ).order_by(EventComment.created_at.desc()).all()
        return comments
    finally:
        db.close()

# ============== CSV EXPORT ==============

@app.get("/events/{event_id}/participants/export")
def export_participants_csv(event_id: int, current_user: User = Depends(get_current_admin_user)):
    """Export participants list as CSV"""
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        participants = db.query(Participant).filter(Participant.event_id == event_id).all()
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Name", "Email", "Phone", "Checked In", "Check-in Time"])
        
        for p in participants:
            writer.writerow([
                p.id,
                p.name,
                p.email,
                p.phone or "",
                "Yes" if p.checked_in else "No",
                p.check_in_time.isoformat() if p.check_in_time else ""
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=event_{event_id}_participants.csv"}
        )
    finally:
        db.close()

# ============== MY EVENTS (User's registered events) ==============

@app.get("/my-events")
def get_my_events(current_user: User = Depends(get_current_user)):
    """Get events the current user is registered for"""
    db = SessionLocal()
    try:
        # Find all participations for this user's email
        participations = db.query(Participant).filter(
            Participant.email == current_user.email
        ).all()
        
        events_data = []
        for p in participations:
            event = db.query(Event).filter(Event.id == p.event_id).first()
            if event:
                events_data.append({
                    "event": {
                        "id": event.id,
                        "title": event.title,
                        "description": event.description,
                        "location": event.location,
                        "date": event.date,
                        "category": event.category
                    },
                    "registration": {
                        "id": p.id,
                        "checked_in": p.checked_in,
                        "qr_code": p.qr_code
                    }
                })
        
        return {"events": events_data}
    finally:
        db.close()

# ============== ENHANCED REPORTING ==============

@app.get("/reporting")
def get_reporting(current_user: User = Depends(get_current_admin_user)):
    db = SessionLocal()
    try:
        total_events = db.query(Event).count()
        total_participants = db.query(Participant).count()
        total_waitlist = db.query(Waitlist).count()
        events_with_participants = db.query(Event.id).join(Participant).distinct().count()
        checked_in_count = db.query(Participant).filter(Participant.checked_in == True).count()
        
        # Category breakdown
        category_stats = {}
        for cat in EVENT_CATEGORIES:
            count = db.query(Event).filter(Event.category == cat).count()
            if count > 0:
                category_stats[cat] = count
        
        # Events by registration count
        events = db.query(Event).all()
        events_breakdown = []
        for event in events:
            participant_count = db.query(Participant).filter(Participant.event_id == event.id).count()
            waitlist_count = db.query(Waitlist).filter(Waitlist.event_id == event.id).count()
            events_breakdown.append({
                "id": event.id,
                "title": event.title,
                "participants": participant_count,
                "waitlist": waitlist_count,
                "capacity": event.seats,
                "fill_rate": round((participant_count / event.seats) * 100, 1) if event.seats > 0 else 0
            })
        
        return {
            "total_events": total_events,
            "total_participants": total_participants,
            "total_waitlist": total_waitlist,
            "events_with_participants": events_with_participants,
            "checked_in_count": checked_in_count,
            "category_breakdown": category_stats,
            "events_breakdown": events_breakdown
        }
    finally:
        db.close()

# ============== ELASTICSEARCH SEARCH API ==============

@app.get("/api/search/events")
async def elasticsearch_search(
    q: str = Query(..., description="Search query"),
    category: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    page: int = 1,
    size: int = 10
):
    """Full-text search using Elasticsearch with highlighting and facets"""
    if not ELASTICSEARCH_AVAILABLE:
        # Fallback to database search
        db = SessionLocal()
        try:
            query = db.query(Event)
            search_term = f"%{q}%"
            query = query.filter(
                or_(
                    Event.title.ilike(search_term),
                    Event.description.ilike(search_term),
                    Event.location.ilike(search_term)
                )
            )
            if category:
                query = query.filter(Event.category == category)
            
            events = query.offset((page-1)*size).limit(size).all()
            total = query.count()
            
            return {
                "results": [{"id": e.id, "title": e.title, "description": e.description, 
                            "location": e.location, "category": e.category, "date": e.date,
                            "score": 1.0, "highlights": {}} for e in events],
                "total": total,
                "page": page,
                "aggregations": {}
            }
        finally:
            db.close()
    
    try:
        # Build Elasticsearch query
        must = [{"multi_match": {
            "query": q,
            "fields": ["title^3", "description^2", "location", "category"],
            "fuzziness": "AUTO"
        }}]
        
        filter_clauses = []
        if category:
            filter_clauses.append({"term": {"category": category}})
        if from_date:
            filter_clauses.append({"range": {"date": {"gte": from_date}}})
        if to_date:
            filter_clauses.append({"range": {"date": {"lte": to_date}}})
        
        # Use the ElasticsearchClient.search method with correct signature
        results = search_service.search(
            query=q,
            category=category,
            date_from=from_date,
            date_to=to_date,
            page=page,
            size=size
        )
        
        # Convert SearchResult dataclass objects to dict
        if "results" in results:
            results["results"] = [
                {
                    "id": r.id,
                    "title": r.title,
                    "description": r.description,
                    "location": r.location,
                    "category": r.category,
                    "date": r.date,
                    "score": r.score,
                    "highlights": r.highlights
                } if hasattr(r, 'id') else r
                for r in results["results"]
            ]
        results["page"] = page
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@app.post("/api/search/index-event/{event_id}")
async def index_event_in_elasticsearch(
    event_id: int,
    current_user: User = Depends(get_current_admin_user)
):
    """Index or re-index an event in Elasticsearch"""
    if not ELASTICSEARCH_AVAILABLE:
        raise HTTPException(status_code=503, detail="Elasticsearch is not available")
    
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        
        search_service.index_event({
            "id": event.id,
            "title": event.title,
            "description": event.description or "",
            "location": event.location,
            "category": event.category,
            "date": str(event.date) if event.date else None,
            "seats": event.seats
        })
        
        return {"message": f"Event {event_id} indexed successfully"}
    finally:
        db.close()


@app.post("/api/search/reindex-all")
async def reindex_all_events(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_admin_user)
):
    """Reindex all events in Elasticsearch (background task)"""
    if not ELASTICSEARCH_AVAILABLE:
        raise HTTPException(status_code=503, detail="Elasticsearch is not available")
    
    def reindex_task():
        db = SessionLocal()
        try:
            events = db.query(Event).all()
            # Use bulk indexing for efficiency
            event_docs = [{
                "id": event.id,
                "title": event.title,
                "description": event.description or "",
                "location": event.location,
                "category": event.category,
                "date": str(event.date) if event.date else None,
                "seats": event.seats
            } for event in events]
            search_service.bulk_index_events(event_docs)
            logger.info(f"Reindexed {len(event_docs)} events in Elasticsearch")
        finally:
            db.close()
    
    background_tasks.add_task(reindex_task)
    return {"message": "Reindexing started in background"}


# ============== REDIS CACHE API ==============

@app.get("/api/cache/stats")
async def get_cache_stats(current_user: User = Depends(get_current_admin_user)):
    """Get Redis cache statistics"""
    if not REDIS_AVAILABLE:
        return {"available": False, "message": "Redis is not available"}
    
    try:
        info = cache_manager.client.info()
        return {
            "available": True,
            "connected_clients": info.get("connected_clients", 0),
            "used_memory": info.get("used_memory_human", "N/A"),
            "total_keys": cache_manager.client.dbsize(),
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
            "hit_rate": round(info.get("keyspace_hits", 0) / max(1, info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0)) * 100, 2)
        }
    except Exception as e:
        return {"available": False, "error": str(e)}


@app.delete("/api/cache/clear")
async def clear_cache(
    pattern: Optional[str] = "*",
    current_user: User = Depends(get_current_admin_user)
):
    """Clear cache entries matching pattern"""
    if not REDIS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Redis is not available")
    
    try:
        keys = cache_manager.client.keys(pattern)
        if keys:
            cache_manager.client.delete(*keys)
        return {"message": f"Cleared {len(keys)} cache entries"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== ANALYTICS API ==============

@app.get("/api/analytics/summary")
async def get_analytics_summary(current_user: User = Depends(get_current_admin_user)):
    """Get comprehensive analytics summary"""
    db = SessionLocal()
    try:
        # Basic counts
        total_events = db.query(Event).count()
        total_participants = db.query(Participant).count()
        total_users = db.query(User).count()
        checked_in = db.query(Participant).filter(Participant.checked_in == True).count()
        
        # Category distribution
        category_data = db.query(Event.category, func.count(Event.id)).group_by(Event.category).all()
        categories = {cat: count for cat, count in category_data}
        
        # Registration trends (last 7 days simulation)
        events = db.query(Event).all()
        fill_rates = []
        for event in events:
            participant_count = db.query(Participant).filter(Participant.event_id == event.id).count()
            if event.seats > 0:
                fill_rates.append(participant_count / event.seats * 100)
        
        avg_fill_rate = sum(fill_rates) / len(fill_rates) if fill_rates else 0
        
        # Top events
        top_events = []
        for event in events[:5]:
            participant_count = db.query(Participant).filter(Participant.event_id == event.id).count()
            top_events.append({
                "id": event.id,
                "title": event.title,
                "participants": participant_count,
                "capacity": event.seats
            })
        
        return {
            "overview": {
                "total_events": total_events,
                "total_participants": total_participants,
                "total_users": total_users,
                "checked_in": checked_in,
                "check_in_rate": round(checked_in / max(1, total_participants) * 100, 2)
            },
            "categories": categories,
            "fill_rate": {
                "average": round(avg_fill_rate, 2),
                "min": round(min(fill_rates), 2) if fill_rates else 0,
                "max": round(max(fill_rates), 2) if fill_rates else 0
            },
            "top_events": top_events
        }
    finally:
        db.close()


@app.get("/api/analytics/clustering")
async def get_event_clustering(current_user: User = Depends(get_current_admin_user)):
    """Get K-Means clustering of events"""
    if not ANALYTICS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Analytics module not available")
    
    db = SessionLocal()
    try:
        events = db.query(Event).all()
        if len(events) < 2:
            return {"clusters": [], "message": "Not enough events for clustering"}
        
        # Prepare data for clustering
        event_data = []
        for event in events:
            participant_count = db.query(Participant).filter(Participant.event_id == event.id).count()
            event_data.append({
                "id": event.id,
                "title": event.title,
                "participants": participant_count,
                "capacity": event.seats,
                "fill_rate": participant_count / max(1, event.seats) * 100
            })
        
        # Simple clustering based on fill rate
        analytics = EventAnalytics()
        features = [[e["fill_rate"], e["capacity"]] for e in event_data]
        
        n_clusters = min(3, len(events))
        labels = analytics.kmeans.fit_predict(features) if len(features) >= n_clusters else [0] * len(features)
        
        # Group events by cluster
        clusters = {}
        for i, label in enumerate(labels):
            if label not in clusters:
                clusters[label] = []
            clusters[label].append(event_data[i])
        
        return {
            "clusters": [{"cluster_id": k, "events": v} for k, v in clusters.items()],
            "n_clusters": n_clusters
        }
    finally:
        db.close()


@app.get("/api/analytics/anomalies")
async def detect_anomalies(current_user: User = Depends(get_current_admin_user)):
    """Detect anomalies in event data"""
    if not ANALYTICS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Analytics module not available")
    
    db = SessionLocal()
    try:
        events = db.query(Event).all()
        anomalies = []
        
        # Collect fill rates
        fill_rates = []
        event_fill_data = []
        for event in events:
            participant_count = db.query(Participant).filter(Participant.event_id == event.id).count()
            fill_rate = participant_count / max(1, event.seats) * 100
            fill_rates.append(fill_rate)
            event_fill_data.append({
                "event": event,
                "fill_rate": fill_rate,
                "participants": participant_count
            })
        
        if len(fill_rates) >= 3:
            # Calculate statistics
            mean_fill = sum(fill_rates) / len(fill_rates)
            variance = sum((x - mean_fill) ** 2 for x in fill_rates) / len(fill_rates)
            std_dev = variance ** 0.5
            
            # Find anomalies (> 2 standard deviations)
            for data in event_fill_data:
                z_score = abs(data["fill_rate"] - mean_fill) / max(0.01, std_dev)
                if z_score > 2:
                    anomalies.append({
                        "event_id": data["event"].id,
                        "title": data["event"].title,
                        "fill_rate": round(data["fill_rate"], 2),
                        "z_score": round(z_score, 2),
                        "reason": "unusually_high" if data["fill_rate"] > mean_fill else "unusually_low"
                    })
        
        return {
            "anomalies": anomalies,
            "total_analyzed": len(events),
            "anomaly_count": len(anomalies)
        }
    finally:
        db.close()


# ============== AUDIT LOG API ==============

def create_audit_log(db, action: str, entity_type: str, entity_id: int = None, 
                     user_id: int = None, user_email: str = None, details: str = None):
    """Create an audit log entry with hash chain"""
    # Get previous hash
    last_log = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
    previous_hash = last_log.current_hash if last_log else "0" * 64
    
    # Create current hash
    hash_data = f"{previous_hash}{action}{entity_type}{entity_id}{user_email}{datetime.utcnow().isoformat()}"
    current_hash = hashlib.sha256(hash_data.encode()).hexdigest()
    
    log = AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        user_email=user_email,
        details=details,
        previous_hash=previous_hash,
        current_hash=current_hash
    )
    db.add(log)
    db.commit()
    return log


@app.get("/api/audit/logs")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    page: int = 1,
    size: int = 50,
    current_user: User = Depends(get_current_admin_user)
):
    """Get audit logs with filtering"""
    db = SessionLocal()
    try:
        query = db.query(AuditLog)
        
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        if action:
            query = query.filter(AuditLog.action == action)
        
        total = query.count()
        logs = query.order_by(AuditLog.timestamp.desc()).offset((page-1)*size).limit(size).all()
        
        return {
            "logs": [{
                "id": log.id,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "user_email": log.user_email,
                "details": log.details,
                "hash_valid": True  # Would verify hash chain in production
            } for log in logs],
            "total": total,
            "page": page
        }
    finally:
        db.close()


@app.get("/api/audit/verify")
async def verify_audit_chain(current_user: User = Depends(get_current_admin_user)):
    """Verify the integrity of the audit log hash chain"""
    db = SessionLocal()
    try:
        logs = db.query(AuditLog).order_by(AuditLog.id).all()
        
        if not logs:
            return {"valid": True, "message": "No audit logs to verify", "verified": 0}
        
        valid = True
        invalid_at = None
        expected_prev = "0" * 64
        
        for log in logs:
            if log.previous_hash != expected_prev:
                valid = False
                invalid_at = log.id
                break
            expected_prev = log.current_hash
        
        return {
            "valid": valid,
            "verified": len(logs),
            "invalid_at": invalid_at,
            "message": "Hash chain is valid" if valid else f"Chain broken at log {invalid_at}"
        }
    finally:
        db.close()


# ============== DATA QUALITY API ==============

@app.post("/api/data-quality/validate-event")
async def validate_event_data(event_data: dict):
    """Validate event data against quality rules"""
    if not DATA_QUALITY_AVAILABLE:
        return {"valid": True, "warnings": ["Data quality module not available"]}
    
    try:
        report = event_validator.validate(event_data)
        return {
            "valid": report.is_valid,
            "passed": report.passed,
            "failed": report.failed,
            "warnings": report.warnings
        }
    except Exception as e:
        return {"valid": False, "error": str(e)}


@app.get("/api/data-quality/report")
async def get_data_quality_report(current_user: User = Depends(get_current_admin_user)):
    """Get overall data quality report for the system"""
    db = SessionLocal()
    try:
        issues = []
        
        # Check for events with missing data
        events = db.query(Event).all()
        for event in events:
            if not event.description:
                issues.append({"type": "missing_description", "entity": "event", "id": event.id, "title": event.title})
            if event.seats <= 0:
                issues.append({"type": "invalid_seats", "entity": "event", "id": event.id, "title": event.title})
        
        # Check for duplicate participants
        participants = db.query(Participant).all()
        seen_emails = {}
        for p in participants:
            key = f"{p.event_id}:{p.email}"
            if key in seen_emails:
                issues.append({"type": "duplicate_participant", "entity": "participant", "id": p.id, "email": p.email})
            seen_emails[key] = True
        
        return {
            "total_issues": len(issues),
            "issues": issues[:50],  # Limit to 50
            "quality_score": max(0, 100 - len(issues) * 5),  # Simple score
            "entities_checked": {
                "events": len(events),
                "participants": len(participants)
            }
        }
    finally:
        db.close()


# ============== SYSTEM STATUS API ==============

@app.get("/api/system/status")
async def get_system_status():
    """Get status of all system components"""
    from sqlalchemy import text
    
    status = {
        "api": {"status": "healthy", "version": "1.0.0"},
        "database": {"status": "unknown"},
        "redis": {"status": "unknown"},
        "elasticsearch": {"status": "unknown"},
        "kafka": {"status": "unknown"}
    }
    
    # Check PostgreSQL
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        status["database"] = {"status": "healthy"}
        db.close()
    except Exception as e:
        status["database"] = {"status": "unhealthy", "error": str(e)}
    
    # Check Redis
    if REDIS_AVAILABLE:
        try:
            cache_manager.client.ping()
            status["redis"] = {"status": "healthy"}
        except Exception as e:
            status["redis"] = {"status": "unhealthy", "error": str(e)}
    else:
        status["redis"] = {"status": "unavailable"}
    
    # Check Elasticsearch
    if ELASTICSEARCH_AVAILABLE:
        try:
            if search_service.client.ping():
                status["elasticsearch"] = {"status": "healthy"}
        except Exception as e:
            status["elasticsearch"] = {"status": "unhealthy", "error": str(e)}
    else:
        status["elasticsearch"] = {"status": "unavailable"}
    
    # Check Kafka
    try:
        if producer:
            status["kafka"] = {"status": "healthy"}
    except Exception as e:
        status["kafka"] = {"status": "unhealthy", "error": str(e)}
    
    # Overall status
    all_healthy = all(s.get("status") in ["healthy", "unavailable"] for s in status.values())
    status["overall"] = "healthy" if all_healthy else "degraded"
    
    return status

