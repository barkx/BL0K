@echo off
cd /d "%~dp0"

rem  Double-clickable wrapper. All the Docker locating lives in
rem  scripts/docker.mjs, so there is one implementation, not two.
rem
rem  run.bat        -> production build in nginx
rem  run.bat dev    -> Vite dev server with hot reload
rem  run.bat stop   -> stop and remove both containers
rem  run.bat logs   -> follow container output
rem
rem  Ports come from docker-compose.yml; the script prints the URL it resolved.

set "MODE=%~1"
if "%MODE%"=="" set "MODE=prod"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo Node is not on PATH, and this wrapper needs it to locate Docker.
    echo Install Node 20 or newer: https://nodejs.org
    echo.
    pause
    exit /b 1
)

if /i "%MODE%"=="stop" goto plain
if /i "%MODE%"=="down" set "MODE=stop" & goto plain
if /i "%MODE%"=="logs" goto plain

node scripts\docker.mjs %MODE% --open
if errorlevel 1 (
    echo.
    pause
    exit /b 1
)
ping -n 3 127.0.0.1 >nul
exit /b 0

:plain
node scripts\docker.mjs %MODE%
if errorlevel 1 (
    echo.
    pause
    exit /b 1
)
exit /b 0
