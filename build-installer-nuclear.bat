@echo off
echo ========================================
echo KMTI FMS - NUCLEAR CLEAN BUILD
echo ========================================
echo.
echo ⚠️  WARNING: This will perform a COMPLETE clean build!
echo.
echo This script will:
echo - Kill all running Node.js, Electron, and KMTIFMS2 processes
echo - Delete ALL build artifacts (dist/, client/dist/)
echo - Delete ALL node_modules folders
echo - Delete ALL package-lock.json files
echo - Reinstall ALL dependencies from scratch
echo - Rebuild everything from zero
echo.
echo This is useful when:
echo - Dependencies are corrupted
echo - Build keeps failing with weird errors
echo - You want to ensure a completely fresh build
echo.
echo ⏱️  This will take 10-15 minutes!
echo.

set /p confirm="Are you sure you want to continue? (yes/no): "
if /i not "%confirm%"=="yes" (
    echo Build cancelled.
    pause
    exit /b 0
)

echo.
echo Starting nuclear clean build...
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ========================================
echo PHASE 1: TERMINATE PROCESSES
echo ========================================
echo.

echo Killing Node.js processes...
taskkill /F /IM node.exe /T >NUL 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Node.js processes terminated
) else (
    echo ℹ️  No Node.js processes found
)
timeout /t 1 /nobreak >NUL

echo Killing Electron processes...
taskkill /F /IM electron.exe /T >NUL 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Electron processes terminated
) else (
    echo ℹ️  No Electron processes found
)
timeout /t 1 /nobreak >NUL

echo Killing KMTIFMS2 application...
taskkill /F /IM KMTIFMS2.exe /T >NUL 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ KMTIFMS2 application terminated
) else (
    echo ℹ️  No KMTIFMS2 application found
)
timeout /t 1 /nobreak >NUL

echo.
echo Waiting for processes to fully close...
timeout /t 3 /nobreak >NUL
echo ✅ All processes terminated
echo.

echo ========================================
echo PHASE 2: NUCLEAR CLEAN
echo ========================================
echo.

echo [1/6] Removing dist folders...
if exist "dist" (
    echo Removing root dist...
    rmdir /s /q "dist" 2>NUL
    timeout /t 1 /nobreak >NUL
)
if exist "client\dist" (
    echo Removing client dist...
    rmdir /s /q "client\dist" 2>NUL
    timeout /t 1 /nobreak >NUL
)
echo ✅ Dist folders removed
echo.

echo [2/6] Removing build caches...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache" 2>NUL
)
if exist "client\node_modules\.cache" (
    rmdir /s /q "client\node_modules\.cache" 2>NUL
)
if exist ".vite" (
    rmdir /s /q ".vite" 2>NUL
)
if exist "client\.vite" (
    rmdir /s /q "client\.vite" 2>NUL
)
echo ✅ Build caches removed
echo.

echo [3/6] Removing package-lock files...
if exist "package-lock.json" (
    echo Removing root package-lock.json...
    del /f /q "package-lock.json" 2>NUL
)
if exist "client\package-lock.json" (
    echo Removing client package-lock.json...
    del /f /q "client\package-lock.json" 2>NUL
)
echo ✅ Package-lock files removed
echo.

echo [4/6] Removing node_modules folders...
echo ⚠️  This may take 2-3 minutes...
if exist "node_modules" (
    echo Removing root node_modules... (this is slow, please wait)
    rmdir /s /q "node_modules" 2>NUL
    timeout /t 2 /nobreak >NUL
    echo ✅ Root node_modules removed
) else (
    echo ℹ️  No root node_modules found
)

if exist "client\node_modules" (
    echo Removing client node_modules... (this is slow, please wait)
    rmdir /s /q "client\node_modules" 2>NUL
    timeout /t 2 /nobreak >NUL
    echo ✅ Client node_modules removed
) else (
    echo ℹ️  No client node_modules found
)
echo.

echo [5/6] Clearing npm cache...
echo This ensures no corrupted packages...
call npm cache clean --force
if %ERRORLEVEL% EQU 0 (
    echo ✅ npm cache cleared
) else (
    echo ⚠️  Warning: Could not clear npm cache
)
echo.

echo [6/6] Final cleanup check...
timeout /t 2 /nobreak >NUL
echo ✅ Nuclear clean completed!
echo.

echo ========================================
echo PHASE 3: FRESH INSTALLATION
echo ========================================
echo.

echo [1/4] Installing root dependencies...
echo This will take 2-3 minutes...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install root dependencies
    echo.
    echo Troubleshooting:
    echo 1. Check your internet connection
    echo 2. Try running as Administrator
    echo 3. Check npm registry: npm config get registry
    echo.
    pause
    exit /b 1
)
echo ✅ Root dependencies installed
echo.

echo [2/4] Installing client dependencies...
echo This will take 2-3 minutes...
cd client
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install client dependencies
    echo.
    echo Troubleshooting:
    echo 1. Check your internet connection
    echo 2. Delete client folder and restore from backup
    echo 3. Check for disk space
    echo.
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✅ Client dependencies installed
echo.

echo [3/4] Building React client...
echo This will take 2-3 minutes...
cd client
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build React client
    echo.
    echo Check the error messages above for details.
    echo Common issues:
    echo - Syntax errors in React code
    echo - Missing dependencies
    echo - Out of memory (close other applications)
    echo.
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✅ React client built
echo.

echo [4/4] Verifying build output...
if not exist "client\dist\index.html" (
    echo ERROR: Build verification failed
    echo client\dist\index.html not found
    pause
    exit /b 1
)
echo ✅ Build output verified
echo.

echo ========================================
echo PHASE 4: PACKAGE INSTALLER
echo ========================================
echo.

echo Building Electron installer...
echo This will take 3-5 minutes...
echo.

call npm run electron:pack
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build installer
    echo.
    echo Common causes:
    echo - Icon file missing: client\src\assets\fms-icon.ico
    echo - Insufficient disk space
    echo - Antivirus interference
    echo.
    pause
    exit /b 1
)
echo.

echo ========================================
echo VERIFYING INSTALLER
echo ========================================
echo.

if not exist "dist\KMTI_FMS_Installer_*.exe" (
    echo ERROR: Installer not created
    echo Check the error messages above
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ NUCLEAR BUILD COMPLETED!
echo ========================================
echo.
echo 🎉 Fresh build successful!
echo.

REM Get installer details
for %%F in ("dist\KMTI_FMS_Installer_*.exe") do (
    echo 📦 Installer: %%~nxF
    echo 📏 Size: %%~zF bytes
    echo 📁 Location: %%~dpF
)

echo.
echo ========================================
echo BUILD SUMMARY
echo ========================================
echo.
echo ✅ All processes terminated
echo ✅ All artifacts cleaned
echo ✅ Dependencies reinstalled
echo ✅ Client rebuilt from scratch
echo ✅ Installer created
echo.
echo This was a completely fresh build!
echo.
echo ========================================
echo NEXT STEPS
echo ========================================
echo.
echo 1. Test the installer immediately
echo 2. Verify app launches correctly
echo 3. Check for any runtime errors
echo 4. Test all features thoroughly
echo 5. If successful, distribute to users
echo.
echo For installation instructions:
echo - See INSTALLATION_GUIDE.md
echo.
pause
