# Inicia MongoDB local via Docker (mesma URL do backend/.env: localhost:27017).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "Docker nao encontrado no PATH." -ForegroundColor Red
  Write-Host ""
  Write-Host "Opcao A — Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
  Write-Host "        Depois rode de novo:  .\scripts\dev-mongo.ps1" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Opcao B — MongoDB Atlas (rapido, sem instalar servidor):" -ForegroundColor Yellow
  Write-Host "  1) https://www.mongodb.com/cloud/atlas → cluster gratis → Connect → Drivers" -ForegroundColor Gray
  Write-Host "  2) Network Access → Allow seu IP" -ForegroundColor Gray
  Write-Host "  3) Copie a connection string para backend/.env em MONGO_URL" -ForegroundColor Gray
  Write-Host "  4) Veja modelo em: backend\env.atlas.example" -ForegroundColor Gray
  exit 1
}

docker compose up -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "MongoDB rodando em mongodb://localhost:27017 (database: test_database)" -ForegroundColor Green
Write-Host "API no Docker tambem:  .\scripts\dev-docker.ps1" -ForegroundColor Cyan
Write-Host "Ou backend local: uvicorn na 8000 e frontend Expo na 8081." -ForegroundColor Green
Write-Host ""
