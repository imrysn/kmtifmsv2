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
echo KMTI FMS Server - Auto-Start Setup
echo ========================================
echo.

REM Get the directory where this batch file is located
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

REM Remove trailing backslash if present
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

echo Setting up KMTI FMS Server to run at startup (hidden)...
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

REM Delete existing task if it exists
echo Checking for existing task...
schtasks /query /tn "KMTI FMS Server" >nul 2>&1
if %errorLevel% == 0 (
    echo Removing existing task...
    schtasks /delete /tn "KMTI FMS Server" /f >nul 2>&1
)

echo Creating Windows Task Scheduler entry...
echo.

REM Create scheduled task that runs VBScript (which hides the console window)
REM Using /V1 for better compatibility and /RU SYSTEM to run for all users
schtasks /create ^
    /tn "KMTI FMS Server" ^
    /tr "wscript.exe \"%SCRIPT_DIR%\run-server-hidden.vbs\"" ^
    /sc onstart ^
    /ru SYSTEM ^
    /rl highest ^
    /f

if %errorLevel% == 0 (
    echo ✅ Task Scheduler entry created successfully
    echo.
    echo Starting server now...
    
    REM Start the server immediately using VBScript (hidden)
    wscript.exe "%SCRIPT_DIR%\run-server-hidden.vbs"
    
    REM Wait a moment for server to start
    timeout /t 2 /nobreak >nul
    
    REM Check if server is running
    tasklist /FI "IMAGENAME eq KMTI_FMS_Server.exe" 2>NUL | find /I /N "KMTI_FMS_Server.exe">NUL
    if "%ERRORLEVEL%"=="0" (
        echo ✅ Server started successfully ^(running hidden in background^)
    ) else (
        echo ⚠️  Server may not have started. Check Task Manager.
    )
    
    goto :success
) else (
    echo ❌ Failed to create Task Scheduler entry
    echo.
    echo Possible reasons:
    echo 1. Insufficient permissions ^(try running as administrator^)
    echo 2. Task Scheduler service is not running
    echo 3. System policy restrictions
    echo.
    pause
    exit /b 1
)

:success
echo.
echo ========================================
echo ✅ SETUP COMPLETE!
echo ========================================
echo.
echo The KMTI FMS Server is now configured to:
echo.
echo  ✓ Start automatically when Windows boots
echo  ✓ Run completely hidden ^(no console window^)
echo  ✓ Run on port 3001 ^(production mode^)
echo  ✓ Work for all users on this computer
echo.
echo ┌─────────────────────────────────────────────────────────────┐
echo │                    🎯 WHAT THIS MEANS                        │
echo │                                                             │
echo │  ✓ Server runs completely in background                    │
echo │  ✓ No console windows or terminals                         │
echo │  ✓ Starts automatically with Windows                       │
echo │  ✓ Desktop app connects instantly to port 3001             │
echo │  ✓ No manual server management needed                      │
echo └─────────────────────────────────────────────────────────────┘
echo.
echo Current Status:
tasklist /FI "IMAGENAME eq KMTI_FMS_Server.exe" 2>NUL | find /I /N "KMTI_FMS_Server.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✅ Server Process: RUNNING ^(hidden in background^)
) else (
    echo ⚠️  Server Process: NOT DETECTED
    echo    ^(May take a moment to start or check Task Manager^)
)
echo.
schtasks /query /tn "KMTI FMS Server" 2>nul | find "KMTI FMS Server" >nul
if %errorLevel% == 0 (
    echo ✅ Task Scheduler: CONFIGURED ^(will run on every boot^)
) else (
    echo ❌ Task Scheduler: NOT CONFIGURED
)
echo.
echo ─────────────────────────────────────────────────────────────
echo 📋 USEFUL COMMANDS:
echo ─────────────────────────────────────────────────────────────
echo.
echo To check if server is running:
echo   • Open Task Manager ^(Ctrl+Shift+Esc^) ^-^> Processes tab
echo   • Look for "KMTI_FMS_Server.exe"
echo   • Or run: netstat -ano ^| findstr ":3001"
echo.
echo To stop the server:
echo   • Task Manager ^-^> End "KMTI_FMS_Server.exe" process
echo   • Or run: taskkill /F /IM "KMTI_FMS_Server.exe"
echo.
echo To remove auto-start:
echo   • Run: schtasks /delete /tn "KMTI FMS Server" /f
echo   • Or delete task in Task Scheduler GUI
echo.
echo To manually start server ^(if stopped^):
echo   • Double-click: run-server-hidden.vbs
echo   • Or run: wscript.exe "%SCRIPT_DIR%\run-server-hidden.vbs"
echo.
echo ─────────────────────────────────────────────────────────────
echo ⚠️  DEVELOPER NOTE:
echo ─────────────────────────────────────────────────────────────
echo.
echo If you are developing this app with 'npm run dev':
echo   • Dev server uses port 3002
echo   • This production server uses port 3001
echo   • Both CAN run on the same PC simultaneously
echo   • Make sure your .env.development uses port 3002
echo.
echo To temporarily stop production server while developing:
echo   • taskkill /F /IM "KMTI_FMS_Server.exe"
echo   • Then run: npm run dev
echo   • Production server will auto-restart on next boot
echo.
echo ─────────────────────────────────────────────────────────────
echo.
echo You can now close this window.
echo The server is running in the background!
echo.
pause
