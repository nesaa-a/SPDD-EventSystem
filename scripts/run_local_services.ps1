# Run `event-service` and `analytics-service` locally (requires infra running in Docker)
# This script starts two background PowerShell windows: one for Uvicorn, one for the analytics consumer.

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$eventPath = Join-Path $repoRoot "..\event-service"
$analyticsPath = Join-Path $repoRoot "..\analytics-service"

# Helper to start a new terminal running given command
function Start-TerminalJob($cwd, $command, $title) {
    Start-Process pwsh -ArgumentList @('-NoExit','-Command',"Set-Location `"$cwd`"; $command") -WindowStyle Normal
}

# Event service
Start-TerminalJob -cwd (Resolve-Path $eventPath) -command 'if (-not (Test-Path .venv)) { python -m venv .venv; . .venv\Scripts\Activate.ps1; pip install -r requirements.txt }; . .venv\Scripts\Activate.ps1; $env:DATABASE_URL="postgresql://user:pass@localhost:5432/eventsdb"; $env:KAFKA_BROKER="localhost:9092"; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload' -title 'event-service'

# Analytics consumer
Start-TerminalJob -cwd (Resolve-Path $analyticsPath) -command 'if (-not (Test-Path .venv)) { python -m venv .venv; . .venv\Scripts\Activate.ps1; pip install -r requirements.txt }; . .venv\Scripts\Activate.ps1; $env:KAFKA_BROKER="localhost:9092"; python -m app.consumer' -title 'analytics-service'

Write-Output "Started event-service and analytics-service in new PowerShell windows."
