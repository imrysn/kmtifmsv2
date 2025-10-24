@echo off
echo ========================================
echo   KMTI File Management System
echo   Quick Start with Diagnostics
echo ========================================
echo.

echo Step 1: Checking Vite port availability...
netstat -ano | findstr :5173 > nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 5173 is in use!
    echo.
    choice /C YN /M "Kill the process using port 5173?"
    if errorlevel 2 goto skip_kill
    if errorlevel 1 (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
            echo Killing process %%a...
            taskkill /PID %%a /F
        )
    )
) else (
    echo [OK] Port 5173 is available
)

:skip_kill
echo.
echo Step 2: Checking Express port availability...
netstat -ano | findstr :3001 > nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 3001 is in use!
) else (
    echo [OK] Port 3001 is available
)

echo.
echo Step 3: Starting application...
echo ----------------------------------------
echo.
echo [INFO] GPU acceleration: DISABLED (prevents crashes)
echo [INFO] CSP: Configured for Google Fonts
echo [INFO] Startup mode: PARALLEL (fast)
echo.
echo The application will start shortly...
echo - Splash screen should appear within 1 second
echo - Main window should load within 3-5 seconds
echo.
echo ========================================
echo.

npm start
