@echo off
title KMTI - Quick Fix for Vite Issues
color 0A

echo ╔════════════════════════════════════════════════════════╗
echo ║   KMTI File Management System - Vite Quick Fix        ║
echo ╚════════════════════════════════════════════════════════╝
echo.

:MENU
echo.
echo Select a fix:
echo ═══════════════════════════════════════════════════════
echo  [1] Clear Vite cache (Recommended first)
echo  [2] Kill process on port 5173
echo  [3] Kill process on port 3001
echo  [4] Full reinstall (node_modules)
echo  [5] Check what's using ports
echo  [6] Start app (after fix)
echo  [7] Exit
echo ═══════════════════════════════════════════════════════
echo.

set /p choice="Enter choice (1-7): "

if "%choice%"=="1" goto CLEAR_CACHE
if "%choice%"=="2" goto KILL_5173
if "%choice%"=="3" goto KILL_3001
if "%choice%"=="4" goto REINSTALL
if "%choice%"=="5" goto CHECK_PORTS
if "%choice%"=="6" goto START_APP
if "%choice%"=="7" goto EXIT

echo Invalid choice! Please try again.
timeout /t 2 >nul
cls
goto MENU

:CLEAR_CACHE
echo.
echo ┌─ Clearing Vite Cache ─────────────────────────────────┐
cd client
if exist "node_modules\.vite" (
    echo   Deleting node_modules\.vite...
    rmdir /s /q "node_modules\.vite" 2>nul
    echo   ✓ Cache cleared!
) else (
    echo   ℹ No cache found (already clean)
)
echo └───────────────────────────────────────────────────────┘
cd ..
timeout /t 2 >nul
goto MENU

:KILL_5173
echo.
echo ┌─ Killing Process on Port 5173 ────────────────────────┐
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    echo   Found process: %%a
    taskkill /F /PID %%a >nul 2>&1
    echo   ✓ Process killed!
)
echo └───────────────────────────────────────────────────────┘
timeout /t 2 >nul
goto MENU

:KILL_3001
echo.
echo ┌─ Killing Process on Port 3001 ────────────────────────┐
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo   Found process: %%a
    taskkill /F /PID %%a >nul 2>&1
    echo   ✓ Process killed!
)
echo └───────────────────────────────────────────────────────┘
timeout /t 2 >nul
goto MENU

:REINSTALL
echo.
echo ┌─ Full Reinstall ──────────────────────────────────────┐
echo   ⚠ This will take 5-10 minutes!
set /p confirm="   Are you sure? (Y/N): "
if /i not "%confirm%"=="Y" goto MENU

cd client
echo   Removing node_modules...
rmdir /s /q node_modules 2>nul
echo   Removing package-lock.json...
del package-lock.json 2>nul
echo   Installing dependencies...
call npm install
echo   ✓ Reinstall complete!
echo └───────────────────────────────────────────────────────┘
cd ..
timeout /t 3 >nul
goto MENU

:CHECK_PORTS
echo.
echo ┌─ Checking Ports ──────────────────────────────────────┐
echo   Port 5173 (Vite):
netstat -ano | findstr :5173 | findstr LISTENING
if errorlevel 1 echo   ✓ Available
echo.
echo   Port 3001 (Express):
netstat -ano | findstr :3001 | findstr LISTENING
if errorlevel 1 echo   ✓ Available
echo └───────────────────────────────────────────────────────┘
pause
goto MENU

:START_APP
echo.
echo ┌─ Starting Application ────────────────────────────────┐
echo   Launching in 3 seconds...
timeout /t 3 >nul
echo   Starting...
call npm run dev
goto EXIT

:EXIT
echo.
echo Goodbye!
timeout /t 1 >nul
exit

