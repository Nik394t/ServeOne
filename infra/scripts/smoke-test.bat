@echo off
setlocal
cd /d "%~dp0\..\.."
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 .\infra\scripts\smoke-test.py %*
) else (
  python .\infra\scripts\smoke-test.py %*
)
