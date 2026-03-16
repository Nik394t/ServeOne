@echo off
setlocal
cd /d "%~dp0\..\.."

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo .env not found. Template .env created. Fill secrets and run deploy.bat again.
  exit /b 1
)

docker compose -f docker-compose.prod.yml up -d --build
if errorlevel 1 exit /b %errorlevel%

docker compose -f docker-compose.prod.yml ps
