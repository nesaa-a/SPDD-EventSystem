# SPDD Event System - Technical Documentation
# This file provides comprehensive API documentation

"""
SPDD Event Management System - Complete API Documentation

This documentation covers all API endpoints, data models, and integration patterns
for the SPDD Event Management System.

## Architecture Overview

The system follows a microservices architecture with:
- Event Service (FastAPI): Core API for event and participant management
- Analytics Service: Processes event streams and generates insights
- UI Service (React): Single-page application for user interaction

## Technology Stack

### Backend
- FastAPI: High-performance async web framework
- PostgreSQL: Primary relational database
- MongoDB: Document store for analytics
- Redis: Caching and rate limiting
- Kafka: Event streaming and async messaging
- Elasticsearch: Full-text search

### Infrastructure
- Docker/Docker Compose: Containerization
- Kubernetes: Orchestration
- Istio: Service mesh
- Consul: Service discovery
- Vault: Secrets management

### Monitoring
- Prometheus: Metrics collection
- Grafana: Visualization
- Jaeger: Distributed tracing

## API Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

Request:
```json
{
    "username": "string",
    "email": "user@example.com",
    "password": "string"
}
```

Response (201):
```json
{
    "id": 1,
    "username": "string",
    "email": "user@example.com",
    "role": "user",
    "created_at": "2024-01-15T10:30:00Z"
}
```

#### POST /auth/login
Authenticate and receive JWT token.

Request (form-urlencoded):
- username: string
- password: string

Response (200):
```json
{
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer"
}
```

### Events

#### GET /events
List all events with optional filtering.

Query Parameters:
- category: string (optional)
- skip: int (default: 0)
- limit: int (default: 100)

Response (200):
```json
[
    {
        "id": 1,
        "title": "Tech Conference 2024",
        "description": "Annual technology conference",
        "location": "Convention Center",
        "date": "2024-06-15T09:00:00Z",
        "seats": 500,
        "category": "conference",
        "organizer": "Tech Corp"
    }
]
```

#### POST /events
Create a new event (requires authentication).

Headers:
- Authorization: Bearer <token>

Request:
```json
{
    "title": "string",
    "description": "string",
    "location": "string",
    "date": "2024-06-15T09:00:00Z",
    "seats": 100,
    "category": "string",
    "organizer": "string"
}
```

#### GET /events/{event_id}
Get single event details.

Response (200):
```json
{
    "id": 1,
    "title": "Tech Conference 2024",
    ...
}
```

#### DELETE /events/{event_id}
Delete an event (requires authentication and ownership).

### Participants

#### POST /events/{event_id}/participants
Register a participant for an event.

Request:
```json
{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
}
```

Response includes QR code for check-in.

#### GET /events/{event_id}/participants
List all participants for an event.

#### POST /events/{event_id}/check-in/{participant_id}
Check in a participant using their ID.

### Search

#### GET /events/search
Full-text search across events.

Query Parameters:
- q: string (search query)
- category: string (optional)
- location: string (optional)
- date_from: date (optional)
- date_to: date (optional)

Response includes:
- Matching events with relevance scores
- Highlighted matches
- Category aggregations

### Analytics

#### GET /analytics/summary
Get analytics summary (admin only).

Response:
```json
{
    "total_events": 150,
    "total_participants": 5000,
    "category_distribution": {
        "conference": 50,
        "workshop": 30,
        "meetup": 70
    },
    "fill_rate": {
        "average": 0.75,
        "minimum": 0.2,
        "maximum": 1.0
    }
}
```

## Event-Driven Architecture

### Kafka Topics

1. events.created
   - Published when new event is created
   - Consumed by analytics service

2. participants.registered
   - Published when participant registers
   - Used for analytics and notifications

3. events.dlq
   - Dead letter queue for failed messages
   - Monitored for error investigation

### Message Format (CloudEvents)

```json
{
    "specversion": "1.0",
    "type": "com.spdd.event.created",
    "source": "/event-service",
    "id": "uuid",
    "time": "2024-01-15T10:30:00Z",
    "data": {
        "event_id": 1,
        "title": "Event Name",
        ...
    }
}
```

## Caching Strategy

### Cache Patterns
- Write-through: Cache updated on write
- Write-behind: Async cache updates
- Read-through: Cache populated on read miss

### Cached Endpoints
- GET /events (TTL: 60s)
- GET /events/{id} (TTL: 300s)
- GET /events/search (TTL: 30s)

### Cache Invalidation
- Events invalidated on create/update/delete
- Pattern-based invalidation for related data

## Security

### Authentication
- JWT tokens with configurable expiration
- Argon2 password hashing
- Role-based access control (user, admin)

### Rate Limiting
- 100 requests per minute per IP (default)
- Sliding window algorithm
- Distributed via Redis

### Secrets Management
- HashiCorp Vault integration
- Dynamic database credentials
- Transit encryption for sensitive data

## Deployment

### Blue-Green Deployment
Zero-downtime deployments with instant rollback.

### Canary Deployment
Gradual traffic shifting for safe rollouts:
- 10% to canary version
- Monitor for errors
- Gradually increase or rollback

### CI/CD Pipeline
1. Code quality checks (flake8, black, bandit)
2. Unit tests with coverage
3. Docker image build
4. Security scanning
5. Kubernetes deployment
6. Smoke tests

## Monitoring

### Metrics (Prometheus)
- Request latency histogram
- Request count by status
- Active connections
- Database query times
- Cache hit/miss ratio

### Alerts
- High error rate (>5%)
- High latency (>1s p95)
- Service unavailable
- Disk space low

### Tracing (Jaeger)
Distributed tracing across all services:
- Request flow visualization
- Latency breakdown
- Error tracking

## Data Quality

### Validation Rules
- Event title: 3-200 characters
- Event date: Must be in future
- Seats: Positive integer
- Email: Valid format

### Data Pipeline
ETL processes for analytics:
1. Extract from PostgreSQL/Kafka
2. Transform and enrich
3. Load to MongoDB/Elasticsearch

## Error Handling

### Error Response Format
```json
{
    "detail": "Error description",
    "code": "ERROR_CODE",
    "timestamp": "2024-01-15T10:30:00Z",
    "trace_id": "abc123"
}
```

### Common Error Codes
- 400: Bad Request (validation error)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found
- 429: Rate Limit Exceeded
- 500: Internal Server Error
"""
