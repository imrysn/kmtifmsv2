@echo off
title KMTI - Startup with Enhanced Monitoring
color 0B

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                                                                ║
echo ║   KMTI File Management System - Enhanced Startup              ║
echo ║   Fixed: Vite timeout issue (20s → 60s)                       ║
echo ║                                                                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

:: Check if this is first run after fix
if exist ".vite-fix-applied" (
    echo [INFO] Vite fix already applied. Starting normally...
    echo.
) else (
    echo [NEW FIX] This is the first run after applying the Vite fix!
    echo [INFO] Timeout increased from 20s to 60s
    echo [INFO] Cache will be rebuilt (takes 30-45s first time)
    echo [INFO] Subsequent starts will be faster (5-15s)
    echo.
    echo Creating marker file...
    echo Fixed on %date% %time% > .vite-fix-applied
    echo.
)

:: Check Node version
echo [CHECK] Checking Node.js version...
node -v
if errorlevel 1 (
    echo [ERROR] Node.js is not installed!
    echo [FIX] Download from: https://nodejs.org
    pause
    exit /b 1
)
echo.

:: Check if ports are in use
echo [CHECK] Checking if ports are available...
echo.

:: Check port 5173
echo   Checking port 5173 (Vite)...
netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if not errorlevel 1 (
    echo   [WARN] Port 5173 is already in use!
    echo   [FIX] Run: quick-fix-vite.bat and choose option [2]
    echo.
    set /p continue="   Continue anyway? (Y/N): "
    if /i not "!continue!"=="Y" exit /b 1
) else (
    echo   ✓ Port 5173 is available
)

:: Check port 3001
echo   Checking port 3001 (Express)...
netstat -ano | findstr :3001 | findstr LISTENING >nul 2>&1
if not errorlevel 1 (
    echo   [WARN] Port 3001 is already in use!
    echo   [FIX] Run: quick-fix-vite.bat and choose option [3]
    echo.
    set /p continue="   Continue anyway? (Y/N): "
    if /i not "!continue!"=="Y" exit /b 1
) else (
    echo   ✓ Port 3001 is available
)

echo.
echo ════════════════════════════════════════════════════════════════
echo  Starting application with enhanced monitoring...
echo ════════════════════════════════════════════════════════════════
echo.
echo [INFO] Watch the console for these messages:
echo        ⏳ "Waiting for Vite dev server..."
echo        ⏳ "Still waiting... (Xs/60s)"
echo        ✅ "Vite dev server is ready!"
echo.
echo [INFO] Startup times:
echo        - First start: 30-45 seconds (rebuilding dependencies)
echo        - Normal start: 5-15 seconds
echo        - Fast start: 2-5 seconds (with warm cache)
echo.
echo [TIP] If timeout occurs again:
echo       1. Run: clear-vite-cache.bat
echo       2. Run: quick-fix-vite.bat
echo       3. Check: VITE_FIX_SUMMARY.md
echo.
echo ════════════════════════════════════════════════════════════════
echo.

:: Start the application
echo [START] Launching KMTI File Management System...
echo.

call npm run dev

:: If we get here, the app closed
echo.
echo ════════════════════════════════════════════════════════════════
echo  Application closed
echo ════════════════════════════════════════════════════════════════
echo.

pause
