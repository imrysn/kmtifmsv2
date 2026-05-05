@echo off
chcp 65001 >nul 2>&1
title KMTI FMS Setup Verification
color 0B

cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                   ✅ KMTI FMS SETUP VERIFICATION TOOL                      ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo This tool will verify that KMTI FMS is properly installed and functioning.
echo.
echo Press any key to begin verification...
pause >nul

REM Initialize counters
set "checks_passed=0"
set "checks_total=0"
set "warnings=0"
set "errors=0"

:verification_start
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                          🔍 VERIFICATION IN PROGRESS                       ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.

echo Running comprehensive system verification...
echo.

REM Check 1: Desktop Application Installation
echo [1/10] Checking Desktop Application Installation...
set /a "checks_total+=1"
set "DESKTOP_DIR=%LOCALAPPDATA%\Programs\KMTI-File-Management-System"
if exist "%DESKTOP_DIR%\KMTI-File-Management-System.exe" (
    echo ✅ Desktop application found: %DESKTOP_DIR%
    set /a "checks_passed+=1"
) else (
    echo ❌ Desktop application not found
    echo    Expected location: %DESKTOP_DIR%
    set /a "errors+=1"
)

REM Check 2: Desktop Shortcuts
echo.
echo [2/10] Checking Desktop Shortcuts...
set /a "checks_total+=1"
if exist "%PUBLIC%\Desktop\KMTI FMS.lnk" (
    echo ✅ Desktop shortcut found
    set /a "checks_passed+=1"
) else (
    if exist "%USERPROFILE%\Desktop\KMTI FMS.lnk" (
        echo ✅ Desktop shortcut found (user profile)
        set /a "checks_passed+=1"
    ) else (
        echo ⚠️  Desktop shortcut not found (non-critical)
        set /a "warnings+=1"
    )
)

REM Check 3: Start Menu Entry
echo.
echo [3/10] Checking Start Menu Entry...
set /a "checks_total+=1"
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\KMTI FMS.lnk" (
    echo ✅ Start Menu shortcut found
    set /a "checks_passed+=1"
) else (
    echo ⚠️  Start Menu shortcut not found (non-critical)
    set /a "warnings+=1"
)

REM Check 4: Server Installation
echo.
echo [4/10] Checking Server Installation...
set /a "checks_total+=1"
set "SERVER_DIR=C:\Program Files\KMTI FMS"
if exist "%SERVER_DIR%\KMTI_FMS_Server.exe" (
    echo ✅ Server installation found: %SERVER_DIR%
    set /a "checks_passed+=1"
    set "server_found=1"
) else (
    set "SERVER_DIR=%USERPROFILE%\KMTI FMS"
    if exist "%SERVER_DIR%\KMTI_FMS_Server.exe" (
        echo ✅ Server installation found: %SERVER_DIR%
        set /a "checks_passed+=1"
        set "server_found=1"
    ) else (
        echo ❌ Server installation not found
        set /a "errors+=1"
        set "server_found=0"
    )
)

REM Check 5: Server Process Running
echo.
echo [5/10] Checking Server Process...
set /a "checks_total+=1"
if %server_found% == 1 (
    tasklist /FI "IMAGENAME eq KMTI_FMS_Server.exe" 2>NUL | find /I "KMTI_FMS_Server.exe" >nul
    if %errorLevel% == 0 (
        echo ✅ Server process is running
        set /a "checks_passed+=1"
        set "server_running=1"
    ) else (
        echo ⚠️  Server process not running
        echo    The server may need to be started manually
        set /a "warnings+=1"
        set "server_running=0"
    )
) else (
    echo ❌ Cannot check server process (server not installed)
    set /a "errors+=1"
    set "server_running=0"
)

REM Check 6: Server Connectivity
echo.
echo [6/10] Checking Server Connectivity...
set /a "checks_total+=1"
if %server_running% == 1 (
    echo Testing connection to http://localhost:3001...
    powershell -command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001' -TimeoutSec 10; if ($response.StatusCode -eq 200) { Write-Host '✅ Server is responding on port 3001' } } catch { Write-Host '❌ Server not responding on port 3001' }" 2>nul
    if %errorLevel% == 0 (
        set /a "checks_passed+=1"
        set "server_responding=1"
    ) else (
        set /a "errors+=1"
        set "server_responding=0"
    )
) else (
    echo ⚠️  Skipping connectivity test (server not running)
    set /a "warnings+=1"
    set "server_responding=0"
)

REM Check 7: Database Files
echo.
echo [7/10] Checking Database Configuration...
set /a "checks_total+=1"
if exist "database\" (
    echo ✅ Database directory found
    if exist "database\*.db" (
        echo ✅ SQLite database files found
        set /a "checks_passed+=1"
    ) else (
        if exist "database\*.sql" (
            echo ⚠️  Database schema files found (database may need initialization)
            set /a "warnings+=1"
        ) else (
            echo ⚠️  No database files found (may need setup)
            set /a "warnings+=1"
        )
    )
) else (
    echo ❌ Database directory not found
    set /a "errors+=1"
)

REM Check 8: Configuration Files
echo.
echo [8/10] Checking Configuration Files...
set /a "checks_total+=1"
if exist ".env" (
    echo ✅ Environment configuration file found
    set /a "checks_passed+=1"
) else (
    echo ⚠️  Environment configuration file not found
    echo    Some features may use default settings
    set /a "warnings+=1"
)

REM Check 9: Uploads Directory
echo.
echo [9/10] Checking Uploads Directory...
set /a "checks_total+=1"
if exist "uploads\" (
    echo ✅ Uploads directory found
    set /a "checks_passed+=1"
) else (
    echo ⚠️  Uploads directory not found (will be created when needed)
    set /a "warnings+=1"
)

REM Check 10: Firewall Rules
echo.
echo [10/10] Checking Firewall Configuration...
set /a "checks_total+=1"
netsh advfirewall firewall show rule name="KMTI FMS Server" >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Firewall rule configured for KMTI FMS Server
    set /a "checks_passed+=1"
) else (
    echo ⚠️  Firewall rule not found (may be configured by application)
    set /a "warnings+=1"
)

REM Calculate results
set /a "percentage=(%checks_passed%*100)/%checks_total%"

:results
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                         📊 VERIFICATION RESULTS                            ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.

echo Verification completed!
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                          OVERALL STATUS                                    │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.

if %errors% == 0 (
    if %warnings% == 0 (
        echo 🎉 ALL CHECKS PASSED!
        echo.
        echo Your KMTI FMS installation appears to be working perfectly.
    ) else (
        echo ✅ MOSTLY WORKING
        echo.
        echo Your installation is functional but has some minor issues.
    )
) else (
    echo ⚠️  ISSUES DETECTED
    echo.
    echo Your installation has some problems that may need attention.
)

echo.
echo Detailed Results:
echo • ✅ Passed: %checks_passed%/%checks_total% (%percentage%%%)
echo • ⚠️  Warnings: %warnings%
echo • ❌ Errors: %errors%
echo.

if %server_responding% == 1 (
    echo 🌐 Server Status: RUNNING and RESPONDING
    echo 📍 Web Access: http://localhost:3001
) else (
    if %server_running% == 1 (
        echo ⚠️  Server Status: RUNNING but not responding
        echo    Check server logs for errors
    ) else (
        echo ❌ Server Status: NOT RUNNING
        echo    Server needs to be started
    )
)

:recommendations
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                         🔧 RECOMMENDATIONS                                 │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.

if %errors% gtr 0 (
    echo Issues that need attention:
    if %checks_passed% lss 1 (
        echo • No desktop application found - Run setup-wizard.bat
    )
    if %server_found% == 0 (
        echo • No server installation found - Run Advanced Install
    )
    if %server_running% == 0 (
        echo • Server not running - Start server manually or check startup settings
    )
    if %server_responding% == 0 (
        echo • Server not responding - Check port 3001 availability and server logs
    )
    echo.
)

if %warnings% gtr 0 (
    echo Optional improvements:
    if not exist ".env" (
        echo • Create .env file for custom configuration
    )
    if not exist "uploads\" (
        echo • Uploads directory will be created automatically when needed
    )
    echo.
)

if %errors% == 0 (
    echo ✅ Your installation is ready to use!
    echo.
    echo To start using KMTI FMS:
    echo 1. Launch from Desktop shortcut or Start Menu
    echo 2. Or open http://localhost:3001 in your web browser
    echo 3. Log in with your credentials
    echo.
    goto :success_message
)

:troubleshooting
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                       🛠️  TROUBLESHOOTING                                 │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.

if %server_running% == 0 (
    echo Starting Server:
    echo • Run "start-server.bat" from the server directory
    echo • Or configure automatic startup with "install-server-startup.bat"
    echo.
)

if %server_responding% == 0 (
    echo Server Connection Issues:
    echo • Check if port 3001 is blocked by firewall
    echo • Verify no other application is using port 3001
    echo • Check server logs for error messages
    echo • Try restarting the server
    echo.
)

echo General Troubleshooting:
echo • Re-run setup-wizard.bat to repair installation
echo • Check the README files for detailed instructions
echo • Contact IT support if problems persist
echo.

:success_message
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                       🎯 QUICK START GUIDE                                 │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo How to use KMTI FMS:
echo.
echo 1. START THE APPLICATION
echo    • Double-click "KMTI FMS" on your desktop
echo    • Or find it in the Start Menu
echo    • The server will start automatically
echo.
echo 2. ACCESS THE INTERFACE
echo    • The app will open with the web interface
echo    • Or open http://localhost:3001 in your browser
echo.
echo 3. LOG IN
echo    • Use your assigned username and password
echo    • Contact your administrator if you need credentials
echo.
echo 4. START WORKING
echo    • Upload files, manage approvals, view reports
echo    • The system is now ready for use!
echo.

echo Press any key to exit...
pause >nul

exit /b 0
