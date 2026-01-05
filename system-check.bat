@echo off
chcp 65001 >nul 2>&1
title KMTI FMS System Requirements Check
color 0E

cls
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║                    🔍 KMTI FMS SYSTEM REQUIREMENTS CHECK                   ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.
echo Checking your system compatibility for KMTI File Management System...
echo.
echo Please wait while we analyze your system...
echo.

REM Initialize variables
set "score=0"
set "total_checks=8"
set "critical_fail=0"

echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                           SYSTEM ANALYSIS                                  │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.

REM Check 1: Operating System
echo [1/%total_checks%] Checking Operating System...
ver | findstr /i "6\.1\." >nul
if %errorLevel% == 0 (
    echo ❌ Windows 7 detected - NOT SUPPORTED
    echo    Minimum requirement: Windows 10
    set "critical_fail=1"
) else (
    ver | findstr /i "6\.2\." >nul
    if %errorLevel% == 0 (
        echo ❌ Windows 8 detected - NOT SUPPORTED
        echo    Minimum requirement: Windows 10
        set "critical_fail=1"
    ) else (
        ver | findstr /i "10\." >nul
        if %errorLevel% == 0 (
            echo ✅ Windows 10/11 detected - SUPPORTED
            set /a "score+=1"
        ) else (
            echo ⚠️  Windows version unknown - COMPATIBILITY UNCERTAIN
            echo    Recommended: Windows 10 or later
        )
    )
)

REM Check 2: Architecture
echo.
echo [2/%total_checks%] Checking System Architecture...
wmic os get osarchitecture | findstr "64-bit" >nul
if %errorLevel% == 0 (
    echo ✅ 64-bit architecture detected - SUPPORTED
    set /a "score+=1"
) else (
    echo ❌ 32-bit architecture detected - NOT SUPPORTED
    echo    Required: 64-bit operating system
    set "critical_fail=1"
)

REM Check 3: Memory
echo.
echo [3/%total_checks%] Checking Available Memory...
for /f "tokens=2 delims==" %%a in ('wmic computersystem get TotalPhysicalMemory /value') do set "mem=%%a"
set /a "mem_mb=%mem:~0,-6%"
set /a "mem_gb=%mem_mb%/1024"

if %mem_gb% GEQ 8 (
    echo ✅ %mem_gb% GB RAM detected - EXCELLENT
    set /a "score+=1"
) else (
    if %mem_gb% GEQ 4 (
        echo ✅ %mem_gb% GB RAM detected - SUFFICIENT
        set /a "score+=1"
    ) else (
        echo ❌ %mem_gb% GB RAM detected - INSUFFICIENT
        echo    Minimum requirement: 4GB RAM
        echo    Recommended: 8GB+ RAM
        set "critical_fail=1"
    )
)

REM Check 4: Disk Space
echo.
echo [4/%total_checks%] Checking Available Disk Space...
for /f "tokens=3" %%a in ('dir /-c C:\ ^| find "bytes free"') do set "free_space=%%a"
set "free_space=%free_space:,=%"
set /a "free_gb=%free_space%/1073741824"

if %free_gb% GEQ 10 (
    echo ✅ %free_gb% GB free space detected - EXCELLENT
    set /a "score+=1"
) else (
    if %free_gb% GEQ 5 (
        echo ✅ %free_gb% GB free space detected - SUFFICIENT
        set /a "score+=1"
    ) else (
        if %free_gb% GEQ 2 (
            echo ⚠️  %free_gb% GB free space detected - MINIMUM
            echo    Recommended: 5GB+ free space
            set /a "score+=1"
        ) else (
            echo ❌ %free_gb% GB free space detected - INSUFFICIENT
            echo    Minimum requirement: 2GB free space
            set "critical_fail=1"
        )
    )
)

REM Check 5: Administrator Privileges
echo.
echo [5/%total_checks%] Checking Administrator Privileges...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Administrator privileges available - SUPPORTED
    set /a "score+=1"
) else (
    echo ⚠️  Administrator privileges not detected
    echo    Some installation features may be limited
    echo    For full functionality, run as administrator
)

REM Check 6: Internet Connection
echo.
echo [6/%total_checks%] Checking Internet Connection...
ping -n 1 -w 1000 google.com >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ Internet connection available - SUPPORTED
    set /a "score+=1"
) else (
    echo ⚠️  No internet connection detected
    echo    Required for initial setup and updates
    echo    You can still install from local files
)

REM Check 7: Antivirus/Firewall
echo.
echo [7/%total_checks%] Checking Windows Security...
sc query WinDefend | findstr "RUNNING" >nul
if %errorLevel% == 0 (
    echo ✅ Windows Defender active - GOOD
    set /a "score+=1"
) else (
    echo ⚠️  Windows Defender not running
    echo    Consider enabling Windows Security for protection
)

REM Check 8: Required Software
echo.
echo [8/%total_checks%] Checking Required Software...

REM Check if .NET Framework is available (for some components)
reg query "HKLM\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" /v Release >nul 2>&1
if %errorLevel% == 0 (
    echo ✅ .NET Framework detected - SUPPORTED
    set /a "score+=1"
) else (
    echo ⚠️  .NET Framework not found
    echo    May be required for some features
)

echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                          COMPATIBILITY SCORE                               │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.

set /a "percentage=(%score%*100)/%total_checks%"

if %percentage% GEQ 90 (
    echo 🎉 COMPATIBILITY SCORE: %score%/%total_checks% (%percentage%%%) - EXCELLENT
    echo.
    echo Your system is fully compatible with KMTI FMS!
) else (
    if %percentage% GEQ 75 (
        echo ✅ COMPATIBILITY SCORE: %score%/%total_checks% (%percentage%%%) - GOOD
        echo.
        echo Your system is compatible with minor considerations.
    ) else (
        if %percentage% GEQ 50 (
            echo ⚠️  COMPATIBILITY SCORE: %score%/%total_checks% (%percentage%%%) - FAIR
            echo.
            echo Your system may work but some features could be limited.
        ) else (
            echo ❌ COMPATIBILITY SCORE: %score%/%total_checks% (%percentage%%%) - POOR
            echo.
            echo Your system may not be suitable for KMTI FMS.
        )
    )
)

echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                         RECOMMENDATIONS                                    │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.

if %critical_fail% == 1 (
    echo ❌ CRITICAL ISSUES DETECTED:
    if %mem_gb% LSS 4 (
        echo    • Upgrade RAM to at least 4GB
    )
    if %free_gb% LSS 2 (
        echo    • Free up at least 2GB disk space
    )
    echo.
    echo Please resolve these issues before installing KMTI FMS.
    echo.
    goto :show_next_steps
)

echo ✅ System check completed successfully!
echo.
echo Recommended next steps:
echo.

REM Show specific recommendations
if %mem_gb% LSS 8 (
    echo • Consider upgrading to 8GB+ RAM for optimal performance
)

if %free_gb% LSS 5 (
    echo • Consider freeing up disk space for better performance
)

echo • Run setup-wizard.bat to begin installation
echo • Check README files for detailed instructions

:network_check
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                        NETWORK CONFIGURATION                               │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.

echo Testing network connectivity for KMTI FMS...
echo.

REM Test local connectivity
echo Testing local server port (3001)...
netstat -an | findstr ":3001" >nul
if %errorLevel% == 0 (
    echo ⚠️  Port 3001 is already in use
    echo    This may indicate another service is running
    echo    or a previous installation is active
) else (
    echo ✅ Port 3001 is available
)

REM Test common network shares (if applicable)
echo.
echo Testing network access (if applicable)...
net use | findstr "KMTI-NAS" >nul
if %errorLevel% == 0 (
    echo ✅ KMTI-NAS network share detected
) else (
    echo ℹ️  No KMTI-NAS network share found (not required for local mode)
)

:show_next_steps
echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                          WHAT'S NEXT?                                      │
echo └─────────────────────────────────────────────────────────────────────────────┘
echo.

if %critical_fail% == 1 (
    echo ❌ SYSTEM NOT READY FOR INSTALLATION
    echo.
    echo Please resolve the critical issues listed above, then:
    echo 1. Re-run this system check
    echo 2. Run setup-wizard.bat when system is ready
) else (
    echo ✅ SYSTEM READY FOR INSTALLATION
    echo.
    echo Your system is ready to install KMTI FMS!
    echo.
    echo Next steps:
    echo 1. Close this window
    echo 2. Double-click "setup-wizard.bat" to begin installation
    echo 3. Follow the on-screen instructions
    echo.
    echo Or for manual installation:
    echo • Check the README files for detailed instructions
    echo • Run "npm run build:installer" to create installers
)

echo.
echo ┌─────────────────────────────────────────────────────────────────────────────┐
echo │                          SYSTEM DETAILS                                    │
echo └─────────────────────────────────────────────────────────────────────────────┤
systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"System Type" /C:"Total Physical Memory" /C:"Available Physical Memory"
echo └─────────────────────────────────────────────────────────────────────────────┘

echo.
echo Press any key to exit...
pause >nul

exit /b 0
