# GuiaFlow no celular (mesma rede Wi-Fi do PC).
# 1) Rode a API:  .\scripts\dev-local.ps1 -Part api
# 2) Rode este script em outro terminal (atualiza frontend\.env com IP da rede)
# 3) Escaneie o QR no Expo Go (Android/iOS)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$frontendEnv = Join-Path $root "frontend\.env"

$ip = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike "127.*" -and
    $_.PrefixOrigin -ne "WellKnown"
  } |
  Sort-Object -Property InterfaceMetric |
  Select-Object -ExpandProperty IPAddress -First 1

if (-not $ip) {
  Write-Host "Nao achei IP da rede local. Conecte o PC ao Wi-Fi e tente de novo." -ForegroundColor Red
  exit 1
}

$apiUrl = "http://${ip}:8000"
$webUrl = "http://${ip}:8081"

$lines = @()
if (Test-Path $frontendEnv) {
  $lines = Get-Content $frontendEnv
}
$lines = $lines | Where-Object {
  $_ -notmatch '^\s*EXPO_PUBLIC_BACKEND_URL\s*=' -and
  $_ -notmatch '^\s*EXPO_PUBLIC_WEB_APP_URL\s*='
}
$lines += "EXPO_PUBLIC_BACKEND_URL=$apiUrl"
$lines += "EXPO_PUBLIC_WEB_APP_URL=$webUrl"
$lines | Set-Content -Encoding utf8 $frontendEnv

Write-Host ""
Write-Host "IP do PC na rede: $ip" -ForegroundColor Green
Write-Host "frontend\.env atualizado:" -ForegroundColor Green
Write-Host "  API:  $apiUrl" -ForegroundColor Gray
Write-Host "  App:  $webUrl" -ForegroundColor Gray
Write-Host ""
Write-Host "Firewall: se o celular nao conectar, permita Python/Node nas portas 8000 e 8081." -ForegroundColor Yellow
Write-Host ""
Write-Host "Iniciando Expo (LAN)..." -ForegroundColor Cyan
Write-Host "  - Instale 'Expo Go' no celular" -ForegroundColor Gray
Write-Host "  - Celular e PC no MESMO Wi-Fi" -ForegroundColor Gray
Write-Host "  - Escaneie o QR code" -ForegroundColor Gray
Write-Host ""

Push-Location (Join-Path $root "frontend")
if (-not (Test-Path "node_modules")) { npm install }
npx expo start --lan -c
Pop-Location
