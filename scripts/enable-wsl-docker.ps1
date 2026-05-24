# Habilita WSL2 + Plataforma de Maquina Virtual (necessario para Docker Desktop).
# Execute como Administrador: botao direito no PowerShell -> "Executar como administrador"
#   cd C:\Users\Lucas\Downloads\guiaflow-projeto
#   .\scripts\enable-wsl-docker.ps1
# Depois REINICIE o PC.

#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

Write-Host "Habilitando componentes do Windows..." -ForegroundColor Cyan

dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Hyper-V (opcional em Win10 Pro; Docker costuma funcionar so com VMP)
$hyperv = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -ErrorAction SilentlyContinue
if ($hyperv) {
  Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -NoRestart -All
}

Write-Host ""
Write-Host "Atualizando kernel WSL..." -ForegroundColor Cyan
wsl --update

Write-Host ""
Write-Host "Instalando Ubuntu (distro padrao para o Docker)..." -ForegroundColor Cyan
wsl --install -d Ubuntu --no-launch

Write-Host ""
Write-Host "Pronto. REINICIE o computador." -ForegroundColor Green
Write-Host "Apos reiniciar:" -ForegroundColor Yellow
Write-Host "  1) Abra Docker Desktop e clique em Try Again" -ForegroundColor Gray
Write-Host "  2) cd guiaflow-projeto && .\scripts\dev-docker.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "Se ainda falhar: ative Virtualizacao (VT-x/AMD-V) na BIOS/UEFI." -ForegroundColor Yellow
