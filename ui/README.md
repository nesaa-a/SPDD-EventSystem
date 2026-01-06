# Event Management System - React Frontend

Modern React frontend application for creating and managing events and participants.

## Features

- ✅ Create new events
- ✅ List all events
- ✅ Register participants for events
- ✅ Manage participants (view and remove)
- ✅ Modern and responsive UI
- ✅ Communication with FastAPI backend

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Backend server running on `http://localhost:8000`

## Installation

1. Install dependencies:
```bash
npm install
```

2. (Optional) Create a `.env` file if you want to change the API URL:
```
VITE_API_URL=http://localhost:8000
```

## Running the Frontend

For development:
```bash
npm run dev
```

The application will open at `http://localhost:3000`

For production build:
```bash
npm run build
```

## Running the Backend

**IMPORTANT:** The frontend requires the backend to be running. You have two options:

### Option 1: Using Docker Compose (Recommended)

1. Start the full stack (infrastructure + services):
```powershell
cd ..\infra
docker compose up --build
```

This will start:
- PostgreSQL database
- Kafka
- Event Service (backend API) on port 8000
- Analytics Service

### Option 2: Running Backend Locally

1. Start infrastructure only:
```powershell
cd ..\infra
docker compose up -d zookeeper kafka postgres mongodb schema-registry
```

2. Run the event service locally:
```powershell
cd ..\event-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL="postgresql://user:pass@localhost:5432/eventsdb"
$env:KAFKA_BROKER="localhost:9092"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Troubleshooting

### Network Error

If you see "Network Error" in the frontend:

1. **Check if backend is running:**
   - Open `http://localhost:8000/health` in your browser
   - You should see `{"status":"ok"}`

2. **Verify the API URL:**
   - The frontend expects the backend at `http://localhost:8000`
   - Check `src/utils/constants.js` if you need to change it

3. **Check CORS settings:**
   - Make sure the backend allows requests from `http://localhost:3000`
   - The backend should have CORS middleware configured

### Backend Endpoints Required

The frontend expects these backend endpoints:

**Events:**
- `GET /events` - List all events
- `POST /events` - Create new event
- `GET /events/{id}` - Get event details
- `DELETE /events/{id}` - Delete event

**Participants:**
- `GET /events/{event_id}/participants` - List participants for an event
- `POST /events/{event_id}/participants` - Register a participant
- `DELETE /events/{event_id}/participants/{participant_id}` - Remove a participant

**Note:** Currently, the backend only has `POST /events`. You may need to add the other endpoints for full functionality.

## Technologies

- React 18
- Vite
- Axios
- CSS3
