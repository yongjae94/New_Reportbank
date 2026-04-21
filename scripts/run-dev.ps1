param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "[1/4] Backend setup"
Set-Location "$root\backend"
if (-not (Test-Path ".venv")) {
  python -m venv .venv
}

& ".\.venv\Scripts\python.exe" -m pip install --upgrade pip | Out-Null
if (-not $SkipInstall) {
  & ".\.venv\Scripts\python.exe" -m pip install -e .
}

Write-Host "[2/4] Frontend setup"
Set-Location "$root\frontend"
if (-not $SkipInstall) {
  npm install
}

Write-Host "[3/4] Starting backend (new terminal)"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; .\.venv\Scripts\activate; uvicorn main:app --reload --app-dir . --port 8000"

Write-Host "[4/4] Starting frontend (current terminal)"
Set-Location "$root\frontend"
npm run dev
