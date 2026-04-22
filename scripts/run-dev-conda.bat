@echo off
setlocal EnableExtensions

REM Run both backend and frontend in separate cmd windows.
REM Intended to be launched from Anaconda Prompt.

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"

set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"

if not exist "%BACKEND_DIR%" (
  echo [ERROR] Backend directory not found: "%BACKEND_DIR%"
  exit /b 1
)

if not exist "%FRONTEND_DIR%" (
  echo [ERROR] Frontend directory not found: "%FRONTEND_DIR%"
  exit /b 1
)

REM Keep it simple/reliable: use current Anaconda Prompt environment,
REM then run backend/frontend in separate cmd windows.

start "ReportBank Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && if exist "".venv\Scripts\activate.bat"" (call "".venv\Scripts\activate.bat"") && uvicorn main:app --reload --app-dir . --port 8000"
start "ReportBank Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npm run dev"

echo [OK] Backend and frontend windows started.
exit /b 0
