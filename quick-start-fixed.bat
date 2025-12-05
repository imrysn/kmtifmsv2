@echo off
echo ========================================
echo KMTI File Management System
echo Quick Start (Fixed)
echo ========================================
echo.

REM Check if this is first run or if we need to fix Vite
if not exist "client\node_modules\.vite" (
    echo First time setup detected...
    echo Running fix-vite.bat...
    call fix-vite.bat
    goto :end
)

echo [1/3] Checking for port conflicts...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 2^>nul') do (
    echo ! Port 5173 is in use. Killing process...
    taskkill /F /PID %%a 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 2^>nul') do (
    echo ! Port 3001 is in use. Killing process...
    taskkill /F /PID %%a 2>nul
)

echo [2/3] Starting servers...
echo Starting Express server...
start /B "Express Server" cmd /c "node server.js"
timeout /t 3 /nobreak >nul

echo Starting Vite dev server...
start /B "Vite Server" cmd /c "cd client && npm run dev"
timeout /t 5 /nobreak >nul

echo [3/3] Starting Electron app...
echo.
echo ========================================
echo Application is starting...
echo - Express Server: http://localhost:3001
echo - Vite Dev Server: http://localhost:5173
echo ========================================
echo.

call npm start

:end
echo.
echo Application closed.
pause
