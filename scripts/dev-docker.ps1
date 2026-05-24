# Sobe MongoDB + API FastAPI via Docker Compose.
# Requisito: Docker Desktop em execução (WSL atualizado: wsl --update).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker nao encontrado no PATH." -ForegroundColor Red
  Write-Host "Instale: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
  exit 1
}

$wslStatus = wsl --status 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
  Write-Host "WSL pode estar desatualizado. Rode como Administrador:" -ForegroundColor Yellow
  Write-Host "  wsl --update" -ForegroundColor Cyan
  Write-Host "Reinicie o PC se precisar, abra o Docker Desktop e execute este script de novo." -ForegroundColor Yellow
}

Write-Host "Construindo e subindo mongo + api..." -ForegroundColor Cyan
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Falhou. Confira se o Docker Desktop esta Running (nao 'Engine starting')." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "MongoDB:  mongodb://localhost:27017  (database: test_database)" -ForegroundColor Green
Write-Host "API:      http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend (fora do Docker):" -ForegroundColor Yellow
Write-Host "  cd frontend" -ForegroundColor Gray
Write-Host "  npx expo start --web" -ForegroundColor Gray
Write-Host "  App: http://localhost:8081" -ForegroundColor Gray
Write-Host ""
