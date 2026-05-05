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
echo KMTI FMS Server - Background Service Setup
echo ========================================
echo.

REM Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Remove trailing backslash if present
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

echo Setting up KMTI FMS Server...
echo.

REM Check if server executable exists
if not exist "%SCRIPT_DIR%\KMTI_FMS_Server.exe" (
    echo ERROR: KMTI_FMS_Server.exe not found in %SCRIPT_DIR%
    echo.
    echo Please ensure:
    echo 1. This script is run from the same folder as KMTI_FMS_Server.exe
    echo 2. You have built the server executable using 'npm run build:server-exe'
    echo.
    pause
    exit /b 1
)

echo ✅ Found server executable: %SCRIPT_DIR%\KMTI_FMS_Server.exe
echo.

REM Check if NSSM is available (Non-Sucking Service Manager)
where nssm >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ NSSM found, installing as proper Windows service...
    goto :nssm_install
) else (
    echo ⚠️  NSSM not found, trying Windows Task Scheduler...
    goto :task_scheduler_install
)

:nssm_install
echo Installing KMTI FMS Server as Windows service using NSSM...

REM Install service with NSSM
nssm install "KMTI FMS Server" "%SCRIPT_DIR%\KMTI_FMS_Server.exe"
nssm set "KMTI FMS Server" AppDirectory "%SCRIPT_DIR%"
nssm set "KMTI FMS Server" Description "KMTI File Management System Server - Runs in background"
nssm set "KMTI FMS Server" Start SERVICE_AUTO_START
nssm set "KMTI FMS Server" AppStdout "%SCRIPT_DIR%\server.log"
nssm set "KMTI FMS Server" AppStderr "%SCRIPT_DIR%\server-error.log"

REM Start the service
nssm start "KMTI FMS Server"

if %errorLevel% == 0 (
    echo ✅ Windows service installed and started successfully
    echo The server will run in the background without any windows.
    goto :success
) else (
    echo ❌ NSSM Installation failed, trying Task Scheduler...
    goto :task_scheduler_install
)

:task_scheduler_install
echo Creating Windows Task Scheduler entry for background startup...

REM Create a scheduled task that runs on system startup with highest privileges
schtasks /create /tn "KMTI FMS Server" /tr "\"%SCRIPT_DIR%\KMTI_FMS_Server.exe\"" /sc onstart /rl highest /f /NP

if %errorLevel% == 0 (
    echo ✅ System startup task created successfully
    echo The server will start automatically when the computer boots for all users.
    
    REM Start server immediately using VBS to hide window
    echo Starting server in background now...
    goto :create_vbs_wrapper
) else (
    echo ⚠️  System startup task failed, trying User Startup fallback...
    goto :user_startup_fallback
)

:user_startup_fallback
echo Creating user-level startup fallback...

REM Use PowerShell to create a robust shortcut in the Startup folder
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_NAME=KMTI_FMS_Server.lnk"

echo Creating startup shortcut...
powershell -command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%STARTUP_DIR%\%SHORTCUT_NAME%'); $Shortcut.TargetPath = '%SCRIPT_DIR%\KMTI_FMS_Server.exe'; $Shortcut.WorkingDirectory = '%SCRIPT_DIR%'; $Shortcut.Description = 'KMTI File Management System Server'; $Shortcut.WindowStyle = 7; $Shortcut.Save()"

if %errorLevel% == 0 (
    echo ✅ User startup shortcut created successfully (Minimized mode)
    echo The server will start when you log in.
) else (
    echo ⚠️  Shortcut creation failed, standard VBS fallback...
)

:create_vbs_wrapper
REM Create a VBScript that runs the server hidden (used for immediate start and general backgrounding)
set "VBS_FILE=%SCRIPT_DIR%\run-server-hidden.vbs"

if not exist "%VBS_FILE%" (
    echo Creating VBScript background launcher...
    (
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.Run chr^(34^) ^& "%SCRIPT_DIR%\KMTI_FMS_Server.exe" ^& chr^(34^), 0
    echo Set WshShell = Nothing
    ) > "%VBS_FILE%"
)

REM Start server immediately
wscript.exe "%VBS_FILE%"
echo ✅ Server started in background mode

:success
echo.
echo ========================================
echo ✅ SERVICE SETUP COMPLETE!
echo ========================================
echo.
echo The KMTI FMS Server is now configured for background operation.
echo.
echo ┌─────────────────────────────────────────────────────────────┐
echo │                    🎯 WHAT THIS MEANS                        │
echo │                                                             │
echo │  ✓ Server runs completely in background                    │
echo │  ✓ No console windows or terminals                         │
echo │  ✓ Starts automatically with Windows                       │
echo │  ✓ Desktop app connects instantly                          │
echo │  ✓ No manual server management needed                      │
echo └─────────────────────────────────────────────────────────────┘
echo.
echo Troubleshooting:
echo • Look for KMTI_FMS_Server.exe in Task Manager
echo • Check if port 3001 is listening
echo • If it fails to start, run start-server.bat manually
echo.
pause
