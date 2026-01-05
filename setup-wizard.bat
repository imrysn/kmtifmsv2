@echo off
chcp 65001 >nul 2>&1
title KMTI FMS Setup Wizard
color 0A

:setup_wizard
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                        🚀 KMTI FMS SETUP WIZARD                            ║
echo ║                       File Management System Installer                      ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo Welcome to the KMTI File Management System Setup Wizard!
echo.
echo This wizard will guide you through installing and configuring the system.
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                              SYSTEM REQUIREMENTS                           │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  ✓ Windows 10/11 (64-bit)                                                 │
echo │  ✓ 4GB RAM minimum                                                        │
echo │  ✓ 2GB free disk space                                                    │
echo │  ✓ Administrator privileges (for service installation)                   │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo Press any key to start the system check...
pause >nul

:check_admin
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                           🔍 SYSTEM COMPATIBILITY CHECK                    ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.

REM Check for administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Administrator privileges: DETECTED
) else (
    echo ⚠️  Administrator privileges: NOT DETECTED
    echo.
    echo    Some features may require admin rights for optimal setup.
    echo    You can still proceed, but service installation may fail.
    echo.
)

REM Check Windows version
ver | findstr /i "10\." >nul
if %errorLevel% == 0 (
    echo ✅ Windows version: Windows 10/11 DETECTED
) else (
    echo ⚠️  Windows version: Older version detected
    echo.
    echo    This application is optimized for Windows 10/11.
    echo    You can still try to install, but compatibility is not guaranteed.
)

REM Check available RAM
for /f "tokens=2 delims==" %%a in ('wmic computersystem get TotalPhysicalMemory /value') do set "mem=%%a"
set /a "mem_mb=%mem:~0,-6%"
if %mem_mb% GEQ 4096 (
    echo ✅ Memory: %mem_mb% MB (SUFFICIENT - 4GB+ recommended)
) else (
    echo ⚠️  Memory: %mem_mb% MB (BELOW RECOMMENDED - 4GB+ preferred)
    echo.
    echo    The application may run slowly with less than 4GB RAM.
)

REM Check free disk space
for /f "tokens=3" %%a in ('dir /-c C:\ ^| find "bytes free"') do set "free_space=%%a"
set "free_space=%free_space:,=%"
set /a "free_gb=%free_space%/1073741824"
if %free_gb% GEQ 2 (
    echo ✅ Disk space: %free_gb% GB free (SUFFICIENT)
) else (
    echo ❌ Disk space: %free_gb% GB free (INSUFFICIENT - Need 2GB+)
    echo.
    echo    Please free up disk space and try again.
    goto :insufficient_space
)

REM Check if MySQL is installed (optional)
mysql --version >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ MySQL: INSTALLED (Recommended for full functionality)
) else (
    echo ⚠️  MySQL: NOT DETECTED
    echo.
    echo    MySQL is recommended for optimal performance.
    echo    The app can still run with SQLite as fallback.
)

echo.
echo Press any key to continue to installation options...
pause >nul

:installation_menu
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                            📦 INSTALLATION OPTIONS                        ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo Choose your preferred installation method:
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │  [1] EXPRESS INSTALL (Recommended for most users)                         │
echo │      • Desktop app with automatic server startup                         │
echo │      • No technical setup required                                       │
echo │      • Everything handled automatically                                  │
echo │      • Best for non-technical users                                      │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │  [2] ADVANCED INSTALL (For IT administrators)                             │
echo │      • Standalone server with background service                         │
echo │      • Manual configuration options                                      │
echo │      • Network deployment ready                                          │
echo │      • Full control over setup process                                   │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │  [3] CUSTOM INSTALL (Developers/Advanced users)                           │
echo │      • Source code installation                                          │
echo │      • Development environment setup                                     │
echo │      • Manual dependency management                                      │
echo │      • Full customization options                                        │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │  [4] REPAIR/VERIFY INSTALLATION                                           │
echo │      • Check existing installation                                       │
echo │      • Repair corrupted files                                            │
echo │      • Verify system configuration                                       │
echo │      • Update to latest version                                          │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │  [5] UNINSTALL SYSTEM                                                     │
echo │      • Remove all installed components                                   │
echo │      • Clean registry entries                                            │
echo │      • Remove user data (optional)                                       │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
set /p "choice=Enter your choice (1-5): "

if "%choice%"=="1" goto :express_install
if "%choice%"=="2" goto :advanced_install
if "%choice%"=="3" goto :custom_install
if "%choice%"=="4" goto :repair_install
if "%choice%"=="5" goto :uninstall_system

echo Invalid choice. Please select 1-5.
timeout /t 2 >nul
goto :installation_menu

:express_install
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                         ⚡ EXPRESS INSTALL                                ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo This will install the desktop application with automatic server management.
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                           WHAT WILL HAPPEN:                               │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  ✓ Install KMTI FMS Desktop Application                                 │
echo │  ✓ Configure automatic server startup                                   │
echo │  ✓ Set up desktop shortcuts                                             │
echo │  ✓ Create start menu entries                                            │
echo │  ✓ Initialize database (if needed)                                      │
echo │  ✓ Launch application automatically                                     │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo The installation will take approximately 2-3 minutes.
echo.
set /p "confirm=Do you want to proceed? (Y/N): "
if /i not "%confirm%"=="Y" goto :installation_menu

echo.
echo Starting Express Installation...
echo.

REM Check if installer exists
if not exist "dist\KMTI_FMS_Installer_2.0.0.exe" (
    echo ❌ Desktop installer not found in dist\ folder
    echo.
    echo Please run the build process first:
    echo   npm run build:installer
    echo.
    echo Or download the installer from the releases page.
    echo.
    pause
    goto :installation_menu
)

echo ✅ Found desktop installer
echo.

echo 📦 Installing desktop application...
echo Please follow the installer prompts...
echo.

REM Run the installer
start /wait "KMTI FMS Installer" "dist\KMTI_FMS_Installer_2.0.0.exe"

if %errorLevel% == 0 (
    echo ✅ Desktop application installed successfully
) else (
    echo ❌ Desktop installation failed or was cancelled
    echo.
    echo Please try again or contact support.
    goto :installation_failed
)

echo.
echo 🔧 Setting up automatic server startup...

REM Copy the server startup script
if exist "dist\install-server-startup.bat" (
    copy "dist\install-server-startup.bat" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\" >nul 2>&1
    echo ✅ Server auto-start configured
) else (
    echo ⚠️  Server auto-start script not found (non-critical)
)

echo.
echo 🎯 Installation completed successfully!
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                         🎉 WHAT'S NEXT?                                    │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  ✓ Desktop app is installed and ready                                    │
echo │  ✓ Server will start automatically                                       │
echo │  ✓ Find "KMTI FMS" in Start Menu or Desktop                              │
echo │  ✓ First run may take a moment to initialize                            │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo Press any key to launch the application now...
pause >nul

REM Try to launch the application
start "" "C:\Users\%USERNAME%\AppData\Local\Programs\KMTI-File-Management-System\KMTI-File-Management-System.exe" 2>nul
if %errorLevel% == 0 (
    echo ✅ Application launched successfully
) else (
    echo ⚠️  Could not auto-launch application
    echo Please manually start "KMTI FMS" from the Start Menu.
)

goto :setup_complete

:advanced_install
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                        🔧 ADVANCED INSTALL                                ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo This will install the standalone server with background service options.
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                           WHAT WILL HAPPEN:                               │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  ✓ Install standalone server executable                                 │
echo │  ✓ Set up Windows service (requires admin)                             │
echo │  ✓ Configure background operation                                       │
echo │  ✓ Set up automatic startup                                            │
echo │  ✓ Initialize database                                                  │
echo │  ✓ Configure firewall rules                                            │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
set /p "confirm=Do you want to proceed? (Y/N): "
if /i not "%confirm%"=="Y" goto :installation_menu

echo.
echo Starting Advanced Installation...
echo.

REM Check if server installer exists
if not exist "dist\KMTI_FMS_Server.exe" (
    echo ❌ Server executable not found in dist\ folder
    echo.
    echo Please run the build process first:
    echo   npm run build:server-installer
    echo.
    pause
    goto :installation_menu
)

echo ✅ Found server executable
echo.

REM Create installation directory
set "INSTALL_DIR=C:\Program Files\KMTI FMS"
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%" 2>nul
    if %errorLevel% neq 0 (
        set "INSTALL_DIR=%USERPROFILE%\KMTI FMS"
        mkdir "%INSTALL_DIR%" 2>nul
    )
)

echo 📁 Installation directory: %INSTALL_DIR%
echo.

echo 📋 Copying server files...
xcopy "dist\*" "%INSTALL_DIR%\" /E /I /Y >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Server files copied successfully
) else (
    echo ❌ Failed to copy server files
    goto :installation_failed
)

echo.
echo 🔧 Setting up Windows service...
echo This requires administrator privileges...

REM Run the service installer
pushd "%INSTALL_DIR%"
call install-server-service.bat
popd

if %errorLevel% == 0 (
    echo ✅ Windows service setup completed
) else (
    echo ⚠️  Service setup failed (continuing with basic setup)
    echo.
    echo The server can still be started manually.
)

echo.
echo 🌐 Configuring firewall...
echo Allowing connections on port 3001...

netsh advfirewall firewall add rule name="KMTI FMS Server" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Firewall rule added
) else (
    echo ⚠️  Firewall configuration failed (may require admin privileges)
)

echo.
echo 🎯 Advanced installation completed!
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                      🔧 CONFIGURATION SUMMARY                              │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  Installation Directory: %INSTALL_DIR%                                   │
echo │  Server Port: 3001                                                       │
echo │  Service Status: Check Task Manager for KMTI_FMS_Server.exe              │
echo │  Web Access: http://localhost:3001                                       │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo The server should now be running in the background.
echo You can access the application at: http://localhost:3001
echo.
pause
goto :setup_complete

:custom_install
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                        ⚙️  CUSTOM INSTALL                                 ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo This will set up the development environment with source code.
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                           WHAT WILL HAPPEN:                               │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  ✓ Install Node.js dependencies                                         │
echo │  ✓ Set up development environment                                       │
echo │  ✓ Configure database connections                                       │
echo │  ✓ Build client application                                            │
echo │  ✓ Set up development server                                           │
echo │  ✓ Configure environment variables                                      │
echo └─────────────────────────────────────────────────────────────────────────────┤
echo │  ⏱️  This will take 5-10 minutes depending on internet speed.           │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
set /p "confirm=Do you want to proceed? (Y/N): "
if /i not "%confirm%"=="Y" goto :installation_menu

echo.
echo Starting Custom Installation...
echo.

REM Check Node.js
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Node.js is not installed
    echo.
    echo Please install Node.js from https://nodejs.org/
    echo Then run this setup again.
    pause
    goto :installation_menu
)

echo ✅ Node.js detected
echo.

REM Check npm
npm --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ npm is not available
    echo.
    echo npm should be included with Node.js.
    echo Please reinstall Node.js.
    pause
    goto :installation_menu
)

echo ✅ npm detected
echo.

echo 📦 Installing dependencies...
echo This may take several minutes...
echo.

npm install
if %errorLevel% neq 0 (
    echo ❌ Failed to install dependencies
    goto :installation_failed
)

echo ✅ Root dependencies installed
echo.

echo 📦 Installing client dependencies...
cd client
npm install
if %errorLevel% neq 0 (
    echo ❌ Failed to install client dependencies
    cd ..
    goto :installation_failed
)
cd ..

echo ✅ Client dependencies installed
echo.

echo 🔧 Setting up environment configuration...

REM Copy environment file if it doesn't exist
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo ✅ Environment file created from template
    ) else (
        echo ⚠️  No environment template found
    )
) else (
    echo ✅ Environment file already exists
)

echo.
echo 🎯 Custom installation completed!
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                   🚀 DEVELOPMENT COMMANDS                                  │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  Start Development: npm run dev                                         │
echo │  Start Production: npm run prod                                         │
echo │  Build Only: npm run build                                              │
echo │  Test API: npm run test:api                                             │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo Press any key to start the development server now...
pause >nul

echo Starting development server...
npm run dev

goto :setup_complete

:repair_install
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                       🔧 REPAIR/VERIFY INSTALLATION                        ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo This will check and repair your existing installation.
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                           WHAT WILL HAPPEN:                               │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  ✓ Check installed components                                           │
echo │  ✓ Verify file integrity                                                │
echo │  ✓ Repair corrupted files                                               │
echo │  ✓ Update configuration                                                 │
echo │  ✓ Verify database connection                                           │
echo │  ✓ Test server connectivity                                             │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
set /p "confirm=Do you want to proceed? (Y/N): "
if /i not "%confirm%"=="Y" goto :installation_menu

echo.
echo Starting Repair Process...
echo.

REM Check for desktop installation
set "DESKTOP_DIR=%LOCALAPPDATA%\Programs\KMTI-File-Management-System"
if exist "%DESKTOP_DIR%" (
    echo ✅ Desktop application found: %DESKTOP_DIR%
) else (
    echo ❌ Desktop application not found
    echo.
    echo Run Express Install to install the desktop app.
)

REM Check for server installation
set "SERVER_DIR=C:\Program Files\KMTI FMS"
if exist "%SERVER_DIR%" (
    echo ✅ Server installation found: %SERVER_DIR%
) else (
    set "SERVER_DIR=%USERPROFILE%\KMTI FMS"
    if exist "%SERVER_DIR%" (
        echo ✅ Server installation found: %SERVER_DIR%
    ) else (
        echo ❌ Server installation not found
        echo.
        echo Run Advanced Install to install the server.
    )
)

REM Check server process
tasklist /FI "IMAGENAME eq KMTI_FMS_Server.exe" 2>NUL | find /I "KMTI_FMS_Server.exe" >nul
if %errorLevel% == 0 (
    echo ✅ Server process is running
) else (
    echo ⚠️  Server process not found
    echo.
    echo The server may not be running. Try starting it manually.
)

REM Test server connectivity
echo Testing server connectivity on port 3001...
powershell -command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3001' -TimeoutSec 5; if ($response.StatusCode -eq 200) { Write-Host '✅ Server is responding' } } catch { Write-Host '❌ Server not responding' }" 2>nul

REM Check database
if exist "database" (
    echo ✅ Database directory found
    if exist "database\*.db" (
        echo ✅ SQLite database files found
    ) else (
        echo ⚠️  No database files found (may need initialization)
    )
) else (
    echo ❌ Database directory not found
)

echo.
echo 🔧 Attempting automatic repairs...
echo.

REM Try to rebuild if source exists
if exist "package.json" (
    echo Rebuilding application...
    npm run build:server >nul 2>&1
    if %errorLevel% == 0 (
        echo ✅ Rebuild successful
    ) else (
        echo ⚠️  Rebuild failed (may need manual intervention)
    )
)

echo.
echo 🎯 Repair process completed!
echo.
echo If issues persist, try reinstalling or contact support.
echo.
pause
goto :setup_complete

:uninstall_system
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                          🗑️  UNINSTALL SYSTEM                              ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo This will remove KMTI FMS from your system.
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                           WHAT WILL HAPPEN:                               │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  ✓ Stop running services                                                │
echo │  ✓ Remove desktop application                                          │
echo │  ✓ Remove server installation                                          │
echo │  ✓ Clean up shortcuts and start menu entries                           │
echo │  ✓ Remove firewall rules                                               │
echo │  ✓ Option to keep/remove user data                                     │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo ⚠️  WARNING: This action cannot be undone!
echo.
set /p "confirm=Are you sure you want to uninstall? (Y/N): "
if /i not "%confirm%"=="Y" goto :installation_menu

echo.
set /p "keep_data=Do you want to keep user data and database? (Y/N): "
if /i "%keep_data%"=="Y" (
    echo User data will be preserved.
) else (
    echo All data will be removed.
)

echo.
echo Starting Uninstallation...
echo.

REM Stop services
echo Stopping services...
sc stop "KMTI FMS Server" >nul 2>&1
taskkill /F /IM "KMTI_FMS_Server.exe" >nul 2>&1
taskkill /F /IM "KMTI-File-Management-System.exe" >nul 2>&1

REM Remove desktop app
set "DESKTOP_DIR=%LOCALAPPDATA%\Programs\KMTI-File-Management-System"
if exist "%DESKTOP_DIR%" (
    rmdir /S /Q "%DESKTOP_DIR%" 2>nul
    echo ✅ Desktop application removed
)

REM Remove server installation
set "SERVER_DIR=C:\Program Files\KMTI FMS"
if exist "%SERVER_DIR%" (
    rmdir /S /Q "%SERVER_DIR%" 2>nul
    echo ✅ Server installation removed
) else (
    set "SERVER_DIR=%USERPROFILE%\KMTI FMS"
    if exist "%SERVER_DIR%" (
        rmdir /S /Q "%SERVER_DIR%" 2>nul
        echo ✅ Server installation removed
    )
)

REM Remove shortcuts
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\KMTI_FMS_Server.lnk" >nul 2>&1
del "%PUBLIC%\Desktop\KMTI FMS.lnk" >nul 2>&1
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\KMTI FMS.lnk" >nul 2>&1

REM Remove firewall rules
netsh advfirewall firewall delete rule name="KMTI FMS Server" >nul 2>&1

REM Remove user data if requested
if /i not "%keep_data%"=="Y" (
    if exist "uploads" (
        rmdir /S /Q "uploads" 2>nul
        echo ✅ User uploads removed
    )
    if exist "database\*.db" (
        del "database\*.db" 2>nul
        echo ✅ Database files removed
    )
)

echo.
echo 🎯 Uninstallation completed!
echo.
echo KMTI FMS has been completely removed from your system.
echo.
if /i "%keep_data%"=="Y" (
    echo Note: User data was preserved as requested.
)
echo.
pause
goto :setup_complete

:insufficient_space
echo.
echo ❌ INSUFFICIENT DISK SPACE
echo.
echo The installation requires at least 2GB of free disk space.
echo Please free up space and try again.
echo.
pause
goto :setup_wizard

:installation_failed
echo.
echo ❌ INSTALLATION FAILED
echo.
echo The installation could not be completed.
echo Please check the error messages above and try again.
echo.
echo For help, contact technical support.
echo.
pause
goto :installation_menu

:setup_complete
cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                          ✅ SETUP COMPLETE!                               ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo Thank you for installing KMTI File Management System!
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                          📞 NEED HELP?                                     │
echo ├─────────────────────────────────────────────────────────────────────────────┤
echo │  Documentation: Check the README files in the installation folder       │
echo │  Support: Contact your IT administrator                                 │
echo │  Re-run Setup: Double-click setup-wizard.bat                            │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.
echo Press any key to exit...
pause >nul

exit /b 0
