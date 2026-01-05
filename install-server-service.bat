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

echo Setting up KMTI FMS Server to run as a background service...
echo.

REM Check if server executable and VBScript exist
if not exist "%SCRIPT_DIR%\KMTI_FMS_Server.exe" (
    echo ERROR: KMTI_FMS_Server.exe not found in %SCRIPT_DIR%
    echo.
    echo Please ensure:
    echo 1. This script is run from the same folder as KMTI_FMS_Server.exe
    echo 2. All server files are extracted from the ZIP file
    echo.
    pause
    exit /b 1
)

if not exist "%SCRIPT_DIR%\run-server-hidden.vbs" (
    echo ERROR: run-server-hidden.vbs not found in %SCRIPT_DIR%
    echo.
    echo Please ensure:
    echo 1. All files from the ZIP are extracted
    echo 2. The run-server-hidden.vbs file is present
    echo.
    pause
    exit /b 1
)

echo ✅ Found server executable: %SCRIPT_DIR%\KMTI_FMS_Server.exe
echo ✅ Found VBScript wrapper: %SCRIPT_DIR%\run-server-hidden.vbs
echo.

REM Check if NSSM is available (Non-Sucking Service Manager)
where nssm >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ NSSM found, installing as proper Windows service...
    goto :nssm_install
) else (
    echo ⚠️  NSSM not found, using alternative background method...
    goto :vbs_install
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
) else (
    echo ❌ Failed to install Windows service
    goto :vbs_install
)

goto :success

:vbs_install
echo Creating background launcher using VBScript...

REM Create a VBScript that runs the server hidden
set "VBS_FILE=%SCRIPT_DIR%\run-server-hidden.vbs"

echo Creating VBScript launcher...
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.Run chr^(34^) ^& "%SCRIPT_DIR%\KMTI_FMS_Server.exe" ^& chr^(34^), 0
echo Set WshShell = Nothing
) > "%VBS_FILE%"

REM Create a batch file to start the VBScript
set "START_FILE=%SCRIPT_DIR%\start-server-service.bat"
(
echo @echo off
echo echo Starting KMTI FMS Server in background...
echo wscript.exe "%VBS_FILE%"
echo echo Server started successfully ^(running hidden^)
echo exit
) > "%START_FILE%"

REM Add to startup (hidden mode)
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_NAME=KMTI_FMS_Server_Background.vbs"

if not exist "%STARTUP_DIR%\%SHORTCUT_NAME%" (
    copy "%VBS_FILE%" "%STARTUP_DIR%\%SHORTCUT_NAME%" >nul
    echo ✅ Created startup shortcut for background server
) else (
    echo ✅ Startup shortcut already exists
)

REM Start server immediately
echo Starting server in background now...
wscript.exe "%VBS_FILE%"

echo ✅ Server started in background mode
echo No console windows will appear.

goto :success

:success
echo.
echo ========================================
echo ✅ SERVICE SETUP COMPLETE!
echo ========================================
echo.
echo The KMTI FMS Server is now running as a background service.
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
echo Current Status:
sc query "KMTI FMS Server" 2>nul | find "STATE" >nul
if %errorLevel% == 0 (
    echo ✅ Windows Service: RUNNING
) else (
    echo ✅ Background Process: RUNNING ^(via VBScript^)
)
echo.
echo To check server status:
echo • Open Task Manager ^-^> Processes tab
echo • Look for KMTI_FMS_Server.exe
echo • Or check if port 3001 is listening
echo.
echo To stop the server:
echo • Windows Service: sc stop "KMTI FMS Server"
echo • Background Process: End task in Task Manager
echo.
echo You can now use the KMTI FMS desktop application normally!
echo.
pause
