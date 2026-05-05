@echo off
echo ========================================
echo KMTI File Management System - Server
echo ========================================
echo.

REM Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo Starting KMTI FMS Server...
echo.

REM Check if the executable exists
if not exist "KMTI_FMS_Server.exe" (
    echo ERROR: KMTI_FMS_Server.exe not found in %SCRIPT_DIR%
    echo Please run 'npm run build:server-installer' first
    pause
    exit /b 1
)

echo Server executable found. Starting...
echo.

REM Start the server
start "" "KMTI_FMS_Server.exe"

REM Wait a moment for server to start
timeout /t 3 /nobreak >nul

echo Opening web application in browser...
echo URL: http://localhost:3001
echo.

REM Open browser
start http://localhost:3001

echo.
echo Server is running in the background.
echo You can access the application at: http://localhost:3001
echo.
echo To stop the server, close this window or press Ctrl+C
echo.

REM Keep the window open
pause
