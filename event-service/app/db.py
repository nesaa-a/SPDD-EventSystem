from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@postgres:5432/eventsdb")
# For simplicity use sync engine here (change to async if you prefer)
DATABASE_URL_SYNC = os.getenv("DATABASE_URL_SYNC", "postgresql://user:pass@postgres:5432/eventsdb")

engine = create_engine(DATABASE_URL_SYNC)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

def init_db():
    from .models import Event
    Base.metadata.create_all(bind=engine)
