# GuiaFlow SEM Docker - sobe API + app web.
# Uma vez: coloque MONGO_URL do MongoDB Atlas em backend\.env
param(
  [ValidateSet("all", "api", "web")]
  [string]$Part = "all"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$envFile = Join-Path $backend ".env"
$scriptPath = Join-Path $root "scripts\dev-local.ps1"

function Show-AtlasHelp {
  Write-Host ""
  Write-Host "Banco na nuvem (Atlas, gratis, sem Docker):" -ForegroundColor Yellow
  Write-Host "  1) https://www.mongodb.com/cloud/atlas" -ForegroundColor Gray
  Write-Host "  2) Database Access -> usuario/senha" -ForegroundColor Gray
  Write-Host "  3) Network Access -> Add IP (seu IP ou 0.0.0.0/0 para teste)" -ForegroundColor Gray
  Write-Host "  4) Connect -> Drivers -> URI em backend\.env (MONGO_URL)" -ForegroundColor Gray
  Write-Host "     Modelo: backend\env.atlas.example" -ForegroundColor Gray
  Write-Host ""
}

if (-not (Test-Path $envFile)) {
  Write-Host "Crie backend\.env (copie de env.atlas.example)." -ForegroundColor Red
  Show-AtlasHelp
  exit 1
}

$mongoLine = Get-Content $envFile | Where-Object { $_ -match '^\s*MONGO_URL\s*=' } | Select-Object -First 1
if (-not $mongoLine) {
  Write-Host "Falta MONGO_URL em backend\.env" -ForegroundColor Red
  Show-AtlasHelp
  exit 1
}
if ($mongoLine -match 'localhost' -or $mongoLine -match '127\.0\.0\.1') {
  Write-Host "MONGO_URL aponta para localhost. Use Atlas ou Docker." -ForegroundColor Yellow
  Show-AtlasHelp
  exit 1
}

$venvPython = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
  Write-Host "Criando venv do backend..." -ForegroundColor Cyan
  Push-Location $backend
  python -m venv .venv
  & ".\.venv\Scripts\pip.exe" install -r requirements.txt
  Pop-Location
}

function Start-Api {
  Write-Host "API: http://localhost:8000/docs" -ForegroundColor Green
  Push-Location $backend
  & ".\.venv\Scripts\uvicorn.exe" server:app --reload --host 0.0.0.0 --port 8000
}

function Start-Web {
  Write-Host "App: http://localhost:8081" -ForegroundColor Green
  Push-Location $frontend
  if (-not (Test-Path "node_modules")) { npm install }
  npx expo start --web
}

switch ($Part) {
  "api" { Start-Api }
  "web" { Start-Web }
  "all" {
    Write-Host "Abrindo API em nova janela..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @(
      "-NoExit",
      "-ExecutionPolicy", "Bypass",
      "-File", $scriptPath,
      "-Part", "api"
    )
    Start-Sleep -Seconds 2
    Start-Web
  }
}
