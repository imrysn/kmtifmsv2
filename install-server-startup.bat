@echo off
:: BatchGotAdmin
:-------------------------------------
REM  --> Check for permissions
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

REM --> If error flag set, we do not have admin.
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    set params = %*:"=""
    echo UAC.ShellExecute "cmd.exe", "/c ""%~s0"" %params%", "", "runas", 1 >> "%temp%\getadmin.vbs"

    "%temp%\getadmin.vbs"
    del "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    pushd "%CD%"
    CD /D "%~dp0"
:--------------------------------------

echo ========================================
echo KMTI FMS Server Auto-Start Setup
echo ========================================
echo.

REM Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo Setting up KMTI FMS Server to start automatically...
echo.

REM Remove trailing backslash if present
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Check if server executable exists in current directory
if not exist "%SCRIPT_DIR%\KMTI_FMS_Server.exe" (
    echo ERROR: KMTI_FMS_Server.exe not found in %SCRIPT_DIR%
    echo.
    echo Please ensure:
    echo 1. This script is run from the same folder as KMTI_FMS_Server.exe
    echo 2. All server files are extracted from the ZIP file
    echo.
    echo Expected location: %SCRIPT_DIR%\KMTI_FMS_Server.exe
    echo.
    pause
    exit /b 1
)

echo ✅ Found server executable: %SCRIPT_DIR%\KMTI_FMS_Server.exe
echo.

echo Setting up automatic server startup...
echo.

REM Try system-wide startup first (administrator mode)
echo Attempting to create system startup task...

REM Create a scheduled task that runs on system startup
schtasks /create /tn "KMTI FMS Server" /tr "\"%SCRIPT_DIR%\KMTI_FMS_Server.exe\"" /sc onstart /rl highest /f /NP

if %errorLevel% == 0 (
    echo ✅ System startup task created successfully
    echo The server will start automatically when the computer boots for all users.
    goto :success
) else (
    echo ⚠️  System startup task failed, trying user startup instead...
)

REM Fallback: Create startup folder shortcut for current user
echo Creating startup folder shortcut for current user...

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_NAME=KMTI_FMS_Server.lnk"

REM Use PowerShell to create shortcut (more reliable than batch)
powershell -command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%STARTUP_DIR%\%SHORTCUT_NAME%'); $Shortcut.TargetPath = '%SCRIPT_DIR%\KMTI_FMS_Server.exe'; $Shortcut.WorkingDirectory = '%SCRIPT_DIR%'; $Shortcut.Description = 'KMTI File Management System Server'; $Shortcut.Save()"

if %errorLevel% == 0 (
    echo ✅ User startup shortcut created successfully
    echo The server will start automatically when you log in.
) else (
    echo ❌ Failed to create startup shortcut
    echo.
    echo MANUAL SETUP REQUIRED:
    echo 1. Press Win+R, type 'shell:startup', press Enter
    echo 2. Create a shortcut to '%SCRIPT_DIR%\KMTI_FMS_Server.exe'
    echo 3. Place the shortcut in the startup folder
    echo.
    goto :success
)

:success
echo.
echo ========================================
echo ✅ SETUP COMPLETE!
echo ========================================
echo.
echo The KMTI FMS Server has been configured to start automatically.
echo.
echo ┌─────────────────────────────────────────────────────────────┐
echo │                  🔄 IMPORTANT NOTICE 🔄                      │
echo │                                                             │
echo │  Please RESTART your computer to activate the changes.     │
echo │                                                             │
echo │  After restart, the server will start automatically and    │
echo │  you can use the KMTI FMS desktop application normally.    │
echo │                                                             │
echo │  To test immediately: Log out and log back in.             │
echo └─────────────────────────────────────────────────────────────┘
echo.
echo What happens after restart:
echo ✓ Server starts automatically in background
echo ✓ Desktop app connects to server instantly
echo ✓ No more manual server startup required
echo.
echo Troubleshooting:
echo • If server doesn't start: Check Task Manager for KMTI_FMS_Server.exe
echo • If app won't connect: Verify server is running on port 3001
echo • For issues: Run start-server.bat manually to test
echo.
pause
