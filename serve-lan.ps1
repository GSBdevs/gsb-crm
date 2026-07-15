# Sobe o GrupoSB CRM para a rede local em um único processo (API + frontend buildado).
# Uso:  .\serve-lan.ps1            (usa o banco configurado em backend\.env)
#
# Antes da primeira execução, libere a porta no firewall (PowerShell como admin):
#   New-NetFirewallRule -DisplayName "GrupoSB CRM" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
#
# Atenção: HTTP puro — use apenas em rede interna confiável. Para acesso remoto/HTTPS,
# veja a seção "Rodando na rede local" do README.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ">> Build do frontend (tsc + vite)..." -ForegroundColor Yellow
npm --prefix "$root\frontend" run build
if ($LASTEXITCODE -ne 0) { throw "Build do frontend falhou." }

$env:API_HOST = "0.0.0.0"
$env:API_PORT = "8000"
$env:FRONTEND_DIST = "$root\frontend\dist"

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -match "^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)" } |
    Select-Object -First 1).IPAddress
if (-not $ip) { $ip = "<ip-desta-maquina>" }

Write-Host ""
Write-Host ">> CRM disponível para a rede em:  http://${ip}:8000" -ForegroundColor Green
Write-Host ">> (Ctrl+C para derrubar)" -ForegroundColor DarkGray
Write-Host ""

Set-Location "$root\backend"
& .venv\Scripts\python run.py
