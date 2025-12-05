@echo off
REM Quick Start Script for Windows
REM Alternative: npm start

cls
echo ==================================
echo   KMTI FMS - Quick Start
echo ==================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo [32m✓[0m Node.js detected
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

if not exist "client\node_modules" (
    echo Installing client dependencies...
    cd client
    call npm install
    cd ..
)

echo.
echo [36mStarting application with smart startup...[0m
echo.
echo This will:
echo   1. Check Express server
echo   2. Start Vite dev server
echo   3. Wait for Vite to be ready
echo   4. Start Electron
echo.
echo Press Ctrl+C to stop
echo.

REM Run the smart startup
npm start
