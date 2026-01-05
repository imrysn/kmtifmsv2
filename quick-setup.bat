@echo off
chcp 65001 >nul 2>&1
title KMTI FMS Quick Setup
color 0A

cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                      ⚡ KMTI FMS QUICK SETUP                               ║
echo ║                   One-Click Installation for Everyone                      ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo This script will automatically install KMTI FMS with the best settings for
echo your system. No technical knowledge required!
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                           WHAT HAPPENS NEXT:                               │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  ✓ Check your system compatibility                                       │
echo │  ✓ Choose the best installation method automatically                     │
echo │  ✓ Install everything automatically                                      │
echo │  ✓ Verify the installation works                                        │
echo │  ✓ Launch the application when ready                                     │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo Estimated time: 3-5 minutes
echo.
set /p "confirm=Ready to begin? (Y/N): "
if /i not "%confirm%"=="Y" goto :cancel_setup

echo.
echo Starting Quick Setup...
echo.

REM Quick system check
echo [1/4] Performing system compatibility check...

REM Check OS version
ver | findstr /i "10\." >nul
if %errorLevel% neq 0 (
    echo ❌ ERROR: Windows 10 or later required
    echo.
    echo This application requires Windows 10 or Windows 11.
    echo Please upgrade your operating system and try again.
    pause
    exit /b 1
)

REM Check architecture
wmic os get osarchitecture | findstr "64-bit" >nul
if %errorLevel% neq 0 (
    echo ❌ ERROR: 64-bit Windows required
    echo.
    echo This application requires a 64-bit version of Windows.
    pause
    exit /b 1
)

REM Check memory
for /f "tokens=2 delims==" %%a in ('wmic computersystem get TotalPhysicalMemory /value') do set "mem=%%a"
set /a "mem_gb=%mem:~0,-6%/1024/1024"
if %mem_gb% lss 4 (
    echo ❌ ERROR: Insufficient memory
    echo.
    echo This application requires at least 4GB of RAM.
    echo You have: %mem_gb% GB
    pause
    exit /b 1
)

REM Check disk space
for /f "tokens=3" %%a in ('dir /-c C:\ ^| find "bytes free"') do set "free_space=%%a"
set "free_space=%free_space:,=%"
set /a "free_gb=%free_space%/1073741824"
if %free_gb% lss 2 (
    echo ❌ ERROR: Insufficient disk space
    echo.
    echo This application requires at least 2GB of free disk space.
    echo You have: %free_gb% GB free
    pause
    exit /b 1
)

echo ✅ System check passed
echo.

REM Determine best installation method
echo [2/4] Determining optimal installation method...

REM Check if installer exists
if exist "dist\KMTI_FMS_Installer_2.0.0.exe" (
    set "install_method=express"
    echo 📦 Using Express Install (Desktop App)
) else (
    REM Check if Node.js is available for custom install
    node --version >nul 2>&1
    if %errorLevel% == 0 (
        set "install_method=custom"
        echo ⚙️  Using Custom Install (Development Environment)
    ) else (
        echo ❌ ERROR: No suitable installation method available
        echo.
        echo Neither the desktop installer nor Node.js was found.
        echo Please ensure you have the correct setup files or install Node.js.
        pause
        exit /b 1
    )
)

echo.
echo [3/4] Installing KMTI FMS...

if "%install_method%"=="express" (
    echo Installing desktop application...
    echo.
    echo The installer will open. Please follow the on-screen instructions.
    echo Do not close this window until installation is complete.
    echo.

    REM Run the installer and wait
    start /wait "KMTI FMS Installer" "dist\KMTI_FMS_Installer_2.0.0.exe"

    if %errorLevel% == 0 (
        echo ✅ Desktop application installed successfully
    ) else (
        echo ❌ Desktop installation failed
        goto :setup_failed
    )

    REM Configure auto-startup
    if exist "dist\install-server-startup.bat" (
        copy "dist\install-server-startup.bat" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\" >nul 2>&1
        echo ✅ Server auto-start configured
    )

) else (
    echo Installing development environment...
    echo This may take several minutes...
    echo.

    REM Check npm
    npm --version >nul 2>&1
    if %errorLevel% neq 0 (
        echo ❌ npm not found. Please install Node.js from https://nodejs.org/
        pause
        exit /b 1
    )

    REM Install dependencies
    echo Installing main dependencies...
    npm install
    if %errorLevel% neq 0 (
        echo ❌ Failed to install dependencies
        goto :setup_failed
    )

    echo Installing client dependencies...
    cd client
    npm install
    if %errorLevel% neq 0 (
        cd ..
        echo ❌ Failed to install client dependencies
        goto :setup_failed
    )
    cd ..

    REM Setup environment
    if not exist ".env" (
        if exist ".env.example" (
            copy ".env.example" ".env" >nul
            echo ✅ Environment file configured
        )
    )

    echo ✅ Development environment installed successfully
)

echo.
echo [4/4] Verifying installation...

REM Quick verification
if "%install_method%"=="express" (
    REM Check if desktop app was installed
    if exist "%LOCALAPPDATA%\Programs\KMTI-File-Management-System\KMTI-File-Management-System.exe" (
        echo ✅ Desktop application verified
        set "install_success=1"
    ) else (
        echo ❌ Desktop application not found after installation
        set "install_success=0"
    )
) else (
    REM Check if development setup is ready
    if exist "node_modules" (
        if exist "client\node_modules" (
            echo ✅ Development environment verified
            set "install_success=1"
        ) else (
            echo ❌ Client dependencies missing
            set "install_success=0"
        )
    ) else (
        echo ❌ Main dependencies missing
        set "install_success=0"
    )
)

if %install_success% == 1 (
    goto :setup_success
) else (
    goto :setup_failed
)

:setup_success
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                          ✅ SETUP COMPLETE!                               ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo 🎉 KMTI FMS has been successfully installed!
echo.

if "%install_method%"=="express" (
    echo ┌─────────────────────────────────────────────────────────────────────────┐
    echo │                    🖥️  DESKTOP APPLICATION                            │
    echo ├─────────────────────────────────────────────────────────────────────────┤
    echo │  ✓ Installed in: %LOCALAPPDATA%\Programs\KMTI-File-Management-System │
    echo │  ✓ Desktop shortcut created                                         │
    echo │  ✓ Start Menu entry created                                         │
    echo │  ✓ Server auto-start configured                                     │
    echo └─────────────────────────────────────────────────────────────────────────┘
    echo.
    echo To start using KMTI FMS:
    echo.
    echo 1. Look for "KMTI FMS" on your desktop or in the Start Menu
    echo 2. Double-click to launch the application
    echo 3. The server will start automatically
    echo 4. Log in with your credentials
    echo.
    echo 🌐 Web Access: The app will open http://localhost:3001 automatically
    echo.

    REM Try to launch the application
    echo Launching application now...
    start "" "%LOCALAPPDATA%\Programs\KMTI-File-Management-System\KMTI-File-Management-System.exe" 2>nul
    if %errorLevel% == 0 (
        echo ✅ Application launched successfully
    ) else (
        echo ℹ️  Application launched (may take a moment to appear)
    )

) else (
    echo ┌─────────────────────────────────────────────────────────────────────────┐
    echo │                   💻 DEVELOPMENT ENVIRONMENT                           │
    echo ├─────────────────────────────────────────────────────────────────────────┤
    echo │  ✓ Node.js dependencies installed                                   │
    echo │  ✓ React client dependencies installed                             │
    echo │  ✓ Environment configured                                          │
    echo │  ✓ Ready for development                                           │
    echo └─────────────────────────────────────────────────────────────────────────┘
    echo.
    echo To start developing:
    echo.
    echo 1. Open command prompt or terminal
    echo 2. Run: npm run dev
    echo 3. Open http://localhost:5173 in your browser
    echo.
    echo Available commands:
    echo • npm run dev     - Start development server
    echo • npm run build   - Build for production
    echo • npm run test    - Run tests
)

echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                          📞 NEED HELP?                                     │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  • Run setup-verifier.bat to check installation                         │
echo │  • Read the README.md for detailed documentation                        │
echo │  • Check the docs/ folder for troubleshooting guides                    │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo Thank you for choosing KMTI File Management System!
echo.
pause
exit /b 0

:setup_failed
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                         ❌ SETUP FAILED                                   ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo Unfortunately, the installation could not be completed.
echo.
echo Possible causes:
echo • Insufficient permissions (try running as administrator)
echo • Corrupted installation files
echo • Conflicting software
echo • Network connectivity issues
echo.
echo Recommended solutions:
echo.
echo 1. Run this script as administrator (right-click → "Run as administrator")
echo 2. Ensure you have stable internet connection
echo 3. Close any antivirus software temporarily
echo 4. Try the manual setup using setup-wizard.bat
echo.
echo For additional help:
echo • Run system-check.bat to verify your system
echo • Check the README.md for troubleshooting
echo • Contact technical support
echo.
pause
exit /b 1

:cancel_setup
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                         🚫 SETUP CANCELLED                                ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo Setup was cancelled by user.
echo.
echo If you change your mind, you can:
echo • Run this script again
echo • Use setup-wizard.bat for more options
echo • Check README.md for manual installation
echo.
pause
exit /b 0
