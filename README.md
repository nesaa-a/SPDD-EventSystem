# SPDD-EventSystem — Run instructions

Recommended: run the full stack using Docker Compose (infra + services).

From PowerShell:

```powershell
cd "c:\Users\erina\OneDrive\Desktop\PythonProject\SPDD-EventSystem\infra"
docker compose up --build
```

What changed to make this smooth:
- `event-service` now runs Uvicorn on port `8000` to match `infra/docker-compose.yml`.
- `analytics-service` container runs the consumer via `python -m app.consumer` (no HTTP port exposed).
- Compose no longer exposes a port or performs an HTTP healthcheck for `analytics-service` (it's a Kafka consumer).

Quick local run (in case you prefer running services without building containers):

1) Start infra only:

```powershell
cd "c:\Users\erina\OneDrive\Desktop\PythonProject\SPDD-EventSystem\infra"
docker compose up -d zookeeper kafka postgres mongodb schema-registry
```

2) Run event service locally:

```powershell
cd "c:\Users\erina\OneDrive\Desktop\PythonProject\SPDD-EventSystem\event-service"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:DATABASE_URL="postgresql://user:pass@localhost:5432/eventsdb"
$env:KAFKA_BROKER="localhost:9092"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

3) Run analytics consumer locally:

```powershell
cd "c:\Users\erina\OneDrive\Desktop\PythonProject\SPDD-EventSystem\analytics-service"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:KAFKA_BROKER="localhost:9092"
python -m app.consumer
```

Troubleshooting tips:
- View logs: `docker compose logs -f event-service` (run from `infra` folder).
- Ensure Kafka and DB containers are healthy: `docker compose ps`.
- If the consumer doesn't show activity, verify the topic `event.created` exists and the producer is publishing.

Automation scripts
- `scripts\install_docker.ps1` — checks for `docker` and opens the Docker Desktop download page if missing.
- `scripts\run_infra.ps1` — runs `docker compose up --build` from the `infra` folder. Use `-Detach` to run detached.
- `scripts\run_local_services.ps1` — opens two PowerShell windows and runs the local `event-service` and `analytics` consumer (requires infra running).

Example: open PowerShell (as your normal user) and run:

```powershell
cd "c:\Users\erina\OneDrive\Desktop\PythonProject\SPDD-EventSystem"
.\scripts\run_infra.ps1 -Detach
.\scripts\run_local_services.ps1
```

