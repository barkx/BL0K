@echo off
cd /d "%~dp0"

if not exist ".git" (
    echo No Git repo here yet. Run setup-git.bat first.
    pause
    exit /b 1
)

echo.
git status --short
echo.

set MSG=
set /p MSG="Commit message (Enter for a timestamp): "
if not defined MSG set MSG=Update %DATE% %TIME%

git add .
git commit -m "%MSG%"

if errorlevel 1 (
    echo.
    echo Nothing to commit - your last commit is already up to date.
    pause
    exit /b 0
)

git push

if errorlevel 1 (
    echo.
    echo Push failed. If someone else pushed first, run: git pull --rebase
    pause
    exit /b 1
)

echo.
echo Pushed.
timeout /t 2 >nul
