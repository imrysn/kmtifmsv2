@echo off
SETLOCAL EnableDelayedExpansion

echo ========================================
echo   KMTI FMS - Quick Database Fix
echo ========================================
echo.

REM Try to find MySQL in common locations
set MYSQL_PATH=
set XAMPP_PATH=C:\xampp\mysql\bin\mysql.exe
set WAMP_PATH=C:\wamp64\bin\mysql\mysql8.0.27\bin\mysql.exe
set PROGRAM_FILES=C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe

echo [1/3] Locating MySQL...

if exist "%XAMPP_PATH%" (
    set MYSQL_PATH=%XAMPP_PATH%
    echo     Found MySQL in XAMPP: %XAMPP_PATH%
) else if exist "%WAMP_PATH%" (
    set MYSQL_PATH=%WAMP_PATH%
    echo     Found MySQL in WAMP: %WAMP_PATH%
) else if exist "%PROGRAM_FILES%" (
    set MYSQL_PATH=%PROGRAM_FILES%
    echo     Found MySQL in Program Files: %PROGRAM_FILES%
) else (
    echo     ERROR: Could not find MySQL installation!
    echo.
    echo     Please manually set the path to mysql.exe in this script.
    echo     Common locations:
    echo       - C:\xampp\mysql\bin\mysql.exe
    echo       - C:\wamp64\bin\mysql\mysql8.0.27\bin\mysql.exe
    echo       - C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Connecting to MySQL...
echo     Database: kmtifms
echo.
echo     Please enter your MySQL root password when prompted.
echo.

REM Execute the SQL script
"%MYSQL_PATH%" -u root -p kmtifms < "%~dp0QUICK_FIX_SIMPLE.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   SUCCESS! Database fixes applied!
    echo ========================================
    echo.
    echo [3/3] Next Steps:
    echo     1. Restart your backend server
    echo     2. Upload a test file
    echo     3. Check if it appears in Windows Explorer
    echo.
    echo     File location: \\KMTI-NAS\Shared\data\uploads\test_user\
    echo.
) else (
    echo.
    echo ========================================
    echo   ERROR! Fix failed to apply
    echo ========================================
    echo.
    echo Possible issues:
    echo   - Wrong MySQL password
    echo   - Database 'kmtifms' doesn't exist
    echo   - MySQL server not running
    echo.
    echo Please check the error message above.
    echo.
)

pause
