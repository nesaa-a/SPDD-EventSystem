# Run infra + app containers using docker compose (from repo infra folder)
param(
    [switch]$Detach
)

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)
$infraPath = Join-Path $repoRoot "infra"

# Check docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Output "Docker not found. Run scripts\install_docker.ps1 or install Docker Desktop first."
    Start-Process "powershell" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$repoRoot\scripts\install_docker.ps1`""
    exit 1
}

Set-Location $infraPath
if ($Detach) {
    docker compose up --build -d
} else {
    docker compose up --build
}
