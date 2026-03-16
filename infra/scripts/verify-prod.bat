@echo off
setlocal
cd /d "%~dp0\..\.."

set COMPOSE=docker compose -f docker-compose.prod.yml

echo.
echo [1/3] Containers
%COMPOSE% ps
if errorlevel 1 exit /b %errorlevel%

echo.
echo [2/3] Smoke-test
call .\infra\scripts\smoke-test.bat %*
if errorlevel 1 (
  echo.
  echo Smoke-test failed. Recent logs:
  %COMPOSE% logs --tail 120 proxy frontend backend db
  exit /b 1
)

echo.
echo [3/3] Recent logs snapshot
%COMPOSE% logs --tail 30 proxy frontend backend db
