@echo off
echo ========================================
echo KMTI FMS - Build Installer
echo ========================================
echo.
echo This will build: KMTI_FMS_Installer_2.0.0.exe
echo.
pause

REM Close any running instances
echo [1/5] Closing any running app instances...
taskkill /F /IM KMTIFMS2.exe 2>nul
timeout /t 2 /nobreak >nul
echo.

REM Clean old builds
echo [2/5] Cleaning old build files...
if exist "dist" rmdir /s /q dist
if exist "client\dist" rmdir /s /q client\dist
echo.

REM Clear cache
echo [3/5] Clearing electron-builder cache...
if exist "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign" (
    rmdir /s /q "%LOCALAPPDATA%\electron-builder\Cache\winCodeSign"
)
echo.

REM Build React
echo [4/5] Building React client...
cd client
call npm run build
if errorlevel 1 (
    echo ERROR: Client build failed
    cd ..
    pause
    exit /b 1
)
cd ..
echo SUCCESS
echo.

REM Build Electron
echo [5/5] Building Electron app...
echo This takes 2-3 minutes...
echo.

set CSC_IDENTITY_AUTO_DISCOVERY=false
set ELECTRON_BUILDER_ALLOW_UNRESOLVED_DEPENDENCIES=true

call npx electron-builder --win --x64 --publish never

echo.
echo ========================================
echo BUILD COMPLETE
echo ========================================
echo.

if exist "dist\KMTI_FMS_Installer_2.0.0.exe" (
    echo SUCCESS! Installer created:
    echo dist\KMTI_FMS_Installer_2.0.0.exe
    echo.
    dir dist\KMTI_FMS_Installer_*.exe
    echo.
    start explorer dist
) else if exist "dist\win-unpacked\KMTIFMS2.exe" (
    echo App packaged but no installer.
    echo Creating portable ZIP instead...
    cd dist
    powershell -Command "Compress-Archive -Path win-unpacked -DestinationPath KMTI_FMS_Portable_2.0.0.zip -Force"
    cd ..
    echo.
    echo Created: dist\KMTI_FMS_Portable_2.0.0.zip
    echo.
    start explorer dist
) else (
    echo Build failed. Check errors above.
)

echo.
pause
