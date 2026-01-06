# Check for Docker and open Docker Desktop download page if missing
$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
    Write-Output "Docker is installed: $($docker.Path)"
    exit 0
}

Write-Output "Docker is not installed or not in PATH. Opening Docker Desktop download page..."
Start-Process "https://www.docker.com/get-started"
Write-Output "Please download and install Docker Desktop for Windows, enable WSL2 backend if prompted, then restart your shell and re-run the run script."
exit 1
