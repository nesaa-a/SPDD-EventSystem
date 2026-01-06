# Base image
FROM python:3.11-slim

# Set workdir
WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y build-essential netcat-openbsd curl && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

# Expose port (only relevant for services that expose HTTP)
EXPOSE 8000

# Start command — for event-service (FastAPI + Uvicorn)
# Use port 8000 to match infra/docker-compose.yml
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
