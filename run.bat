@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

rem  run.bat        -> production build in nginx, http://localhost:8080
rem  run.bat dev    -> Vite dev server with hot reload, http://localhost:5173
rem  run.bat stop   -> stop and remove both containers
rem  run.bat logs   -> follow container output
rem
rem  Docker Desktop is installed per-user on this machine, so docker.exe is not
rem  on PATH. This script finds it and puts that folder on PATH for this process
rem  only - the credential helper and the compose plugin live in the same folder
rem  and image pulls fail without them. Nothing outside this window is changed.

set "MODE=%~1"
if "%MODE%"=="" set "MODE=prod"

rem ---------------------------------------------------------- locate docker
set "DOCKERDIR="
set "DESKTOP="
set "FOUND="

where docker >nul 2>nul
if not errorlevel 1 set "FOUND=path"

if not defined FOUND if exist "%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe" (
    set "FOUND=user"
    set "DOCKERDIR=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin"
    set "DESKTOP=%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
)

if not defined FOUND if exist "%ProgramFiles%\Docker\Docker\resources\bin\docker.exe" (
    set "FOUND=machine"
    set "DOCKERDIR=%ProgramFiles%\Docker\Docker\resources\bin"
    set "DESKTOP=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
)

if not defined FOUND (
    echo.
    echo Could not find docker.exe.
    echo Install Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo.
    pause
    exit /b 1
)

if defined DOCKERDIR set "PATH=%DOCKERDIR%;%PATH%"

rem ------------------------------------------------------- engine running?
docker info >nul 2>nul
if not errorlevel 1 goto ready

echo.
echo Docker engine is not responding.
if not defined DESKTOP goto no_desktop
if not exist "%DESKTOP%" goto no_desktop

echo Starting Docker Desktop - a cold start takes a minute or two.
start "" "%DESKTOP%"

for /l %%i in (1,1,60) do (
    ping -n 4 127.0.0.1 >nul
    docker info >nul 2>nul
    if not errorlevel 1 goto ready
    echo   waiting for the engine... [%%i/60]
)

echo.
echo Engine did not come up. Open Docker Desktop yourself, wait until it says
echo "Engine running", then run this script again.
pause
exit /b 1

:no_desktop
echo Start Docker Desktop, wait for "Engine running", then run this again.
pause
exit /b 1

:ready

rem --------------------------------------------------------------- dispatch
if /i "%MODE%"=="stop" goto do_stop
if /i "%MODE%"=="down" goto do_stop
if /i "%MODE%"=="logs" goto do_logs
if /i "%MODE%"=="dev" goto do_dev
if /i "%MODE%"=="prod" goto do_prod

echo Unknown mode "%MODE%". Use: prod ^| dev ^| stop ^| logs
pause
exit /b 1

:do_stop
echo Stopping containers.
docker compose down
exit /b 0

:do_logs
docker compose logs -f
exit /b 0

:do_dev
set "SERVICE=dev"
set "URL=http://localhost:5173"
goto launch

:do_prod
set "SERVICE=prod"
set "URL=http://localhost:8080"
goto launch

:launch
echo.
echo Building and starting "%SERVICE%". The first run pulls base images.
echo.
docker compose up -d --build %SERVICE%
if errorlevel 1 (
    echo.
    echo Failed. See the output above.
    pause
    exit /b 1
)

echo.
echo   Running at %URL%
echo   Logs:  run.bat logs
echo   Stop:  run.bat stop
echo.
start "" "%URL%"
ping -n 3 127.0.0.1 >nul
exit /b 0
