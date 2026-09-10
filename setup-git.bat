@echo off
cd /d "%~dp0"

echo ============================================
echo   BL0K - first-time Git setup
echo   Folder: %CD%
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
    echo Git is not installed, or not on your PATH.
    echo Install it from https://git-scm.com/download/win then run this again.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('git config --global user.name') do set GITNAME=%%i
if not defined GITNAME (
    echo Git needs a name and email before it can commit.
    set /p NEWNAME="Your name: "
    set /p NEWMAIL="Your email: "
    git config --global user.name "%NEWNAME%"
    git config --global user.email "%NEWMAIL%"
    echo.
)

if exist ".git" (
    echo This folder is already a Git repo - skipping init.
) else (
    git init
)

if not exist ".gitignore" (
    echo Writing .gitignore
    (
        echo node_modules/
        echo dist/
        echo build/
        echo .env
        echo .env.local
        echo *.log
        echo .DS_Store
        echo Thumbs.db
        echo .vite/
    ) > .gitignore
)

git add .
git commit -m "Initial commit" || echo Nothing to commit - carrying on.

git branch -M main

git remote remove origin 2>nul
git remote add origin https://github.com/barkx/BL0K.git

echo.
echo Pushing to GitHub. A browser window may open for sign-in.
echo.
git push -u origin main

if errorlevel 1 (
    echo.
    echo Push was rejected. This usually means GitHub already has a commit
    echo that your local folder does not - a README or .gitignore made on the site.
    echo Merging the two histories, then retrying.
    echo.
    git pull origin main --allow-unrelated-histories
    git push -u origin main
)

echo.
echo Done. From now on use push.bat.
pause
