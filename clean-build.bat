@echo off
REM ============================================================================
REM KMTI FMS - Clean Build Script
REM ============================================================================
REM This script:
REM 1. Kills any running KMTI FMS processes
REM 2. Cleans old build artifacts
REM 3. Rebuilds the entire application
REM ============================================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================================
echo KMTI File Management System - Clean Build
echo ============================================================================
echo.

REM ============================================================================
REM STEP 1: Kill Running Processes
REM ============================================================================

echo [1/5] Killing running processes...
echo.

REM Kill Electron processes
echo Checking for Electron processes...
tasklist /FI "IMAGENAME eq electron.exe" 2>NUL | find /I /N "electron.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo   - Killing Electron processes...
    taskkill /F /IM electron.exe >NUL 2>&1
    echo   - Electron processes terminated
) else (
    echo   - No Electron processes found
)

REM Kill Node processes (dev server, etc.)
echo Checking for Node processes...
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo   - Killing Node processes...
    taskkill /F /IM node.exe >NUL 2>&1
    echo   - Node processes terminated
) else (
    echo   - No Node processes found
)

REM Kill any KMTI FMS application instances
echo Checking for KMTI FMS application...
tasklist /FI "IMAGENAME eq KMTI File Management.exe" 2>NUL | find /I /N "KMTI File Management.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo   - Killing KMTI FMS application...
    taskkill /F /IM "KMTI File Management.exe" >NUL 2>&1
    echo   - KMTI FMS application terminated
) else (
    echo   - No KMTI FMS application found
)

REM Wait a moment for processes to fully terminate
timeout /t 2 /nobreak >NUL

echo.
echo   ✓ Process cleanup complete
echo.

REM ============================================================================
REM STEP 2: Clean Old Build Artifacts
REM ============================================================================

echo [2/5] Cleaning old build artifacts...
echo.

REM Clean dist folder
if exist "dist" (
    echo   - Removing dist folder...
    rmdir /s /q "dist" 2>NUL
    if exist "dist" (
        echo   ! Warning: Could not fully remove dist folder
    ) else (
        echo   - dist folder removed
    )
) else (
    echo   - dist folder not found (already clean)
)

REM Clean dist-server folder
if exist "dist-server" (
    echo   - Removing dist-server folder...
    rmdir /s /q "dist-server" 2>NUL
    if exist "dist-server" (
        echo   ! Warning: Could not fully remove dist-server folder
    ) else (
        echo   - dist-server folder removed
    )
) else (
    echo   - dist-server folder not found (already clean)
)

REM Clean client dist folder
if exist "client\dist" (
    echo   - Removing client\dist folder...
    rmdir /s /q "client\dist" 2>NUL
    if exist "client\dist" (
        echo   ! Warning: Could not fully remove client\dist folder
    ) else (
        echo   - client\dist folder removed
    )
) else (
    echo   - client\dist folder not found (already clean)
)

REM Clean client build cache
if exist "client\.vite" (
    echo   - Removing Vite cache...
    rmdir /s /q "client\.vite" 2>NUL
    echo   - Vite cache removed
)

REM Clean logs (optional - uncomment if you want to clean logs)
REM if exist "logs" (
REM     echo   - Cleaning logs folder...
REM     del /q "logs\*.*" 2>NUL
REM     echo   - Logs cleaned
REM )

echo.
echo   ✓ Build artifacts cleaned
echo.

REM ============================================================================
REM STEP 3: Build React Client
REM ============================================================================

echo [3/5] Building React client...
echo.

cd client
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   ✗ Client build failed!
    echo   Please check the error messages above.
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo   ✓ Client build complete
echo.

REM ============================================================================
REM STEP 4: Build Server Bundle
REM ============================================================================

echo [4/5] Building server bundle...
echo.

call npm run build:server
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   ✗ Server build failed!
    echo   Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo   ✓ Server build complete
echo.

REM ============================================================================
REM STEP 5: Build Electron Application
REM ============================================================================

echo [5/5] Building Electron application...
echo.

call npm run electron:pack
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo   ✗ Electron build failed!
    echo   Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo   ✓ Electron build complete
echo.

REM ============================================================================
REM Build Summary
REM ============================================================================

echo ============================================================================
echo BUILD COMPLETE!
echo ============================================================================
echo.

REM Check if installer was created
if exist "dist\*.exe" (
    echo Installer created successfully:
    dir /b "dist\*.exe"
    echo.
    echo Location: %CD%\dist\
) else (
    echo Warning: No installer found in dist folder
)

echo.
echo Build artifacts:
echo   - Client: client\dist\
echo   - Server: dist-server\
echo   - Installer: dist\
echo.

REM Ask if user wants to open dist folder
echo.
set /p OPEN_DIST="Open dist folder? (Y/N): "
if /i "%OPEN_DIST%"=="Y" (
    explorer "dist"
)

echo.
echo ============================================================================
echo Press any key to exit...
pause >NUL
