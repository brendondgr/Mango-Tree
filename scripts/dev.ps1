# Start Mango Tree frontend and Django API together.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Starting Django API on http://localhost:8000 ..."
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root'; uv run manage.py runserver 8000"
)

Write-Host "Starting Vite frontend on http://localhost:5173 ..."
Set-Location "$root/web"
npm run dev
