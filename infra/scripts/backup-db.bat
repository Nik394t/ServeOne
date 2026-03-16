@echo off
setlocal
cd /d "%~dp0\..\.."

if not exist "infra\backups" mkdir "infra\backups"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set TS=%%i
set TARGET=infra\backups\serveone_%TS%.sql

docker compose -f docker-compose.prod.yml exec -T db sh -lc "PGPASSWORD=\"$POSTGRES_PASSWORD\" pg_dump -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\"" > "%TARGET%"
if errorlevel 1 exit /b %errorlevel%

echo Backup saved: %TARGET%
