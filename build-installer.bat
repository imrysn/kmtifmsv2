@echo off
echo ========================================
echo KMTI FMS - Clean Production Build
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [1/10] Checking Node.js version...
node --version
echo.

echo [2/10] Checking npm version...
npm --version
echo.

echo [3/10] Killing any running instances...
echo Checking for running Node.js processes...
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Found running Node.js processes. Attempting to close...
    taskkill /F /IM node.exe /T >NUL 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Node.js processes terminated
    ) else (
        echo ⚠️  Warning: Could not terminate some processes
    )
    timeout /t 2 /nobreak >NUL
) else (
    echo ✅ No Node.js processes running
)

echo Checking for running Electron processes...
tasklist /FI "IMAGENAME eq electron.exe" 2>NUL | find /I /N "electron.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Found running Electron processes. Attempting to close...
    taskkill /F /IM electron.exe /T >NUL 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo ✅ Electron processes terminated
    ) else (
        echo ⚠️  Warning: Could not terminate some processes
    )
    timeout /t 2 /nobreak >NUL
) else (
    echo ✅ No Electron processes running
)

echo Checking for KMTIFMS2 application...
tasklist /FI "IMAGENAME eq KMTIFMS2.exe" 2>NUL | find /I /N "KMTIFMS2.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Found running KMTIFMS2 application. Attempting to close...
    taskkill /F /IM KMTIFMS2.exe /T >NUL 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo ✅ KMTIFMS2 application terminated
    ) else (
        echo ⚠️  Warning: Could not terminate application
    )
    timeout /t 2 /nobreak >NUL
) else (
    echo ✅ No KMTIFMS2 application running
)

echo.
echo Waiting for processes to fully close...
timeout /t 3 /nobreak >NUL
echo.

echo [4/10] Cleaning old build artifacts...
if exist "dist" (
    echo Removing old dist folder...
    rmdir /s /q "dist" >NUL 2>&1
    if exist "dist" (
        echo ⚠️  Warning: Could not remove dist folder completely
        echo Trying to remove contents...
        del /f /s /q "dist\*.*" >NUL 2>&1
        for /d %%p in ("dist\*") do rmdir /s /q "%%p" >NUL 2>&1
    ) else (
        echo ✅ Old dist folder removed
    )
) else (
    echo ✅ No old dist folder found
)

if exist "client\dist" (
    echo Removing old client build...
    rmdir /s /q "client\dist" >NUL 2>&1
    if exist "client\dist" (
        echo ⚠️  Warning: Could not remove client\dist folder completely
        echo Trying to remove contents...
        del /f /s /q "client\dist\*.*" >NUL 2>&1
        for /d %%p in ("client\dist\*") do rmdir /s /q "%%p" >NUL 2>&1
    ) else (
        echo ✅ Old client build removed
    )
) else (
    echo ✅ No old client build found
)

echo Cleaning build cache...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache" >NUL 2>&1
    echo ✅ Build cache cleared
)

if exist "client\node_modules\.cache" (
    rmdir /s /q "client\node_modules\.cache" >NUL 2>&1
    echo ✅ Client build cache cleared
)

if exist ".vite" (
    rmdir /s /q ".vite" >NUL 2>&1
)

if exist "client\.vite" (
    rmdir /s /q "client\.vite" >NUL 2>&1
)

echo ✅ Cleanup completed
echo.

echo [5/10] Installing root dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install root dependencies
    pause
    exit /b 1
)
echo ✅ Root dependencies installed
echo.

echo [6/10] Installing client dependencies...
cd client
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install client dependencies
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✅ Client dependencies installed
echo.

echo [7/10] Building React client (this may take a few minutes)...
echo This will compile your React application into optimized production files...
cd client
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build React client
    cd ..
    pause
    exit /b 1
)
cd ..
echo ✅ React client built successfully
echo.

echo [8/10] Verifying build output...
if not exist "client\dist\index.html" (
    echo ERROR: Build output not found at client\dist\index.html
    echo The React build may have failed silently.
    pause
    exit /b 1
)

echo Checking build size...
dir "client\dist" | find "File(s)"
echo ✅ Build output verified successfully!
echo.

echo [9/10] Building Electron installer...
echo This will package your application into a Windows installer...
echo Please be patient, this step can take 3-5 minutes...
echo.

call npm run electron:pack
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to build Electron installer
    echo.
    echo Common causes:
    echo - Icon file missing: client\src\assets\fms-icon.ico
    echo - Build configuration error in package.json
    echo - Insufficient disk space
    echo.
    pause
    exit /b 1
)
echo.

echo [10/10] Verifying installer...
if not exist "dist\KMTI_FMS_Installer_*.exe" (
    echo ERROR: Installer not found in dist folder
    echo Expected: dist\KMTI_FMS_Installer_2.0.0.exe
    pause
    exit /b 1
)

echo.
echo ========================================
echo BUILD COMPLETED SUCCESSFULLY!
echo ========================================
echo.
echo 🎉 Your installer is ready!
echo.

REM Get installer details
for %%F in ("dist\KMTI_FMS_Installer_*.exe") do (
    echo Installer File: %%~nxF
    echo File Size: %%~zF bytes ^(~%%~zF KB^)
    echo Location: %%~dpF
)

echo.
echo ========================================
echo NEXT STEPS
echo ========================================
echo.
echo 1. Test the installer on a clean system
echo 2. Verify the app launches correctly
echo 3. Check that the server starts automatically ^(wait 10-15 seconds^)
echo 4. Test all major features
echo 5. Share the installer with users
echo.
echo Documentation for users:
echo - INSTALLATION_GUIDE.md
echo.
echo For troubleshooting, see:
echo - BUILD_INSTALLER_README.md
echo - INSTALLER_SOLUTION_SUMMARY.md
echo.
echo ========================================
pause
