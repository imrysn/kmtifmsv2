@echo off
echo ========================================
echo KMTI FMS - Pre-Build Verification
echo ========================================
echo.

set ERROR_COUNT=0

echo Checking prerequisites...
echo.

REM Check Node.js
echo [1/10] Checking Node.js installation...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ FAILED: Node.js not found
    echo    Please install Node.js from https://nodejs.org/
    set /a ERROR_COUNT+=1
) else (
    echo ✅ PASSED: Node.js found
    node --version
)
echo.

REM Check npm
echo [2/10] Checking npm installation...
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ FAILED: npm not found
    set /a ERROR_COUNT+=1
) else (
    echo ✅ PASSED: npm found
    npm --version
)
echo.

REM Check package.json
echo [3/10] Checking package.json exists...
if not exist "package.json" (
    echo ❌ FAILED: package.json not found
    set /a ERROR_COUNT+=1
) else (
    echo ✅ PASSED: package.json found
)
echo.

REM Check main.js
echo [4/10] Checking main.js exists...
if not exist "main.js" (
    echo ❌ FAILED: main.js not found
    set /a ERROR_COUNT+=1
) else (
    echo ✅ PASSED: main.js found
)
echo.

REM Check server.js
echo [5/10] Checking server.js exists...
if not exist "server.js" (
    echo ❌ FAILED: server.js not found
    set /a ERROR_COUNT+=1
) else (
    echo ✅ PASSED: server.js found
)
echo.

REM Check preload.js
echo [6/10] Checking preload.js exists...
if not exist "preload.js" (
    echo ❌ FAILED: preload.js not found
    set /a ERROR_COUNT+=1
) else (
    echo ✅ PASSED: preload.js found
)
echo.

REM Check client directory
echo [7/10] Checking client directory exists...
if not exist "client" (
    echo ❌ FAILED: client directory not found
    set /a ERROR_COUNT+=1
) else (
    echo ✅ PASSED: client directory found
)
echo.

REM Check client package.json
echo [8/10] Checking client/package.json exists...
if not exist "client\package.json" (
    echo ❌ FAILED: client/package.json not found
    set /a ERROR_COUNT+=1
) else (
    echo ✅ PASSED: client/package.json found
)
echo.

REM Check icon file
echo [9/10] Checking icon file exists...
if not exist "client\src\assets\fms-icon.ico" (
    echo ⚠️  WARNING: client/src/assets/fms-icon.ico not found
    echo    The installer will work, but won't have a custom icon
) else (
    echo ✅ PASSED: Icon file found
)
echo.

REM Check .env file
echo [10/10] Checking .env configuration...
if not exist ".env" (
    echo ⚠️  WARNING: .env file not found
    echo    Application will use default configuration
) else (
    echo ✅ PASSED: .env file found
)
echo.

REM Check node_modules
echo [BONUS] Checking dependencies...
if not exist "node_modules" (
    echo ⚠️  WARNING: node_modules not found
    echo    Run 'npm install' before building
) else (
    echo ✅ PASSED: Dependencies installed
)
echo.

if not exist "client\node_modules" (
    echo ⚠️  WARNING: client/node_modules not found
    echo    Run 'cd client && npm install' before building
) else (
    echo ✅ PASSED: Client dependencies installed
)
echo.

REM Check disk space
echo [BONUS] Checking available disk space...
for /f "tokens=3" %%a in ('dir /-c ^| find "bytes free"') do set FREE_SPACE=%%a
echo    Free space: %FREE_SPACE% bytes
if %FREE_SPACE% LSS 1000000000 (
    echo ⚠️  WARNING: Low disk space detected
    echo    Recommended: At least 1GB free for building
) else (
    echo ✅ PASSED: Sufficient disk space
)
echo.

REM Summary
echo ========================================
echo VERIFICATION SUMMARY
echo ========================================
echo.

if %ERROR_COUNT% EQU 0 (
    echo ✅ ALL CHECKS PASSED!
    echo.
    echo You are ready to build the installer.
    echo Run: build-installer.bat
    echo.
) else (
    echo ❌ %ERROR_COUNT% ERROR(S) FOUND!
    echo.
    echo Please fix the errors above before building.
    echo.
)

REM Configuration Summary
echo ========================================
echo CONFIGURATION SUMMARY
echo ========================================
echo.

if exist ".env" (
    echo Current .env configuration:
    echo.
    findstr /R "^USE_MYSQL" .env 2>nul
    findstr /R "^DB_HOST" .env 2>nul
    findstr /R "^DB_NAME" .env 2>nul
    findstr /R "^SERVER_PORT" .env 2>nul
    findstr /R "^NODE_ENV" .env 2>nul
    echo.
)

if exist "package.json" (
    echo Application version:
    findstr /C:"version" package.json | findstr /V "devDependencies dependencies"
    echo.
)

echo ========================================
echo NEXT STEPS
echo ========================================
echo.

if %ERROR_COUNT% EQU 0 (
    echo 1. Review the configuration above
    echo 2. Make any necessary changes to .env
    echo 3. Run: build-installer.bat
    echo 4. Wait 5-10 minutes for build to complete
    echo 5. Test the installer from dist/ folder
) else (
    echo 1. Fix the errors listed above
    echo 2. Run this verification script again
    echo 3. Once all checks pass, run: build-installer.bat
)
echo.

pause
