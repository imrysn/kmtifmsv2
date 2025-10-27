@echo off
echo ========================================
echo KMTI File Management System - Fix Vite
echo ========================================
echo.

cd /d "%~dp0client"

echo [1/5] Stopping any running processes on port 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /F /PID %%a 2>nul
)
timeout /t 2 /nobreak >nul

echo [2/5] Cleaning Vite cache...
if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite"
    echo ✓ Vite cache cleared
) else (
    echo ! No Vite cache found
)

echo [3/5] Cleaning dist folder...
if exist "dist" (
    rmdir /s /q "dist"
    echo ✓ Dist folder cleared
) else (
    echo ! No dist folder found
)

echo [4/5] Re-installing dependencies...
echo This may take a moment...
call npm install --legacy-peer-deps

echo [5/5] Starting Vite dev server...
echo.
echo ========================================
echo Vite should now start on port 5173
echo Press Ctrl+C to stop the server
echo ========================================
echo.

call npm run dev

pause
