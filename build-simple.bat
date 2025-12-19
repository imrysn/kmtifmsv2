@echo off
echo Starting KMTI FMS Build Process...
echo.

REM Navigate to project directory
cd /d "%~dp0"

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found!
    pause
    exit /b 1
)

echo Step 1: Cleaning old builds...
if exist dist rmdir /s /q dist
if exist client\dist rmdir /s /q client\dist
echo Done!
echo.

echo Step 2: Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo Done!
echo.

echo Step 3: Building React app...
cd client
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build React
    pause
    exit /b 1
)
cd ..
echo Done!
echo.

echo Step 4: Creating installer...
call npm run electron:pack
if errorlevel 1 (
    echo ERROR: Failed to create installer
    pause
    exit /b 1
)
echo Done!
echo.

echo ========================================
echo BUILD COMPLETED!
echo ========================================
echo Your installer is in the dist folder
echo.
pause
