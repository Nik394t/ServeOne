@echo off
setlocal

set ROOT_DIR=%~dp0\..\..
for %%I in ("%ROOT_DIR%") do set ROOT_DIR=%%~fI

if "%~1"=="" (
  set ENV_FILE=%ROOT_DIR%\.env.pages
) else (
  set ENV_FILE=%~1
)

if not exist "%ENV_FILE%" (
  echo Env file not found: %ENV_FILE%
  echo Copy %ROOT_DIR%\.env.pages.example to %ROOT_DIR%\.env.pages and adjust values.
  exit /b 1
)

cd /d "%ROOT_DIR%"
docker compose --env-file "%ENV_FILE%" up -d db backend

echo ServeOne backend started for GitHub Pages mode.
echo Health: http://localhost:8000/api/v1/health
echo Use a public HTTPS tunnel for localhost:8000 if you need external access.
