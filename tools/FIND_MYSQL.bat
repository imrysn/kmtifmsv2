@echo off
echo ========================================
echo   MySQL Location Finder
echo ========================================
echo.
echo Searching for MySQL installations...
echo.

SET FOUND=0

REM Check XAMPP
if exist "C:\xampp\mysql\bin\mysql.exe" (
    echo [FOUND] XAMPP MySQL: C:\xampp\mysql\bin\mysql.exe
    SET FOUND=1
)

REM Check WAMP (common versions)
if exist "C:\wamp\bin\mysql\mysql5.7.26\bin\mysql.exe" (
    echo [FOUND] WAMP MySQL: C:\wamp\bin\mysql\mysql5.7.26\bin\mysql.exe
    SET FOUND=1
)

if exist "C:\wamp64\bin\mysql\mysql8.0.27\bin\mysql.exe" (
    echo [FOUND] WAMP64 MySQL: C:\wamp64\bin\mysql\mysql8.0.27\bin\mysql.exe
    SET FOUND=1
)

REM Check Program Files
if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" (
    echo [FOUND] Program Files MySQL: C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe
    SET FOUND=1
)

if exist "C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe" (
    echo [FOUND] Program Files MySQL 5.7: C:\Program Files\MySQL\MySQL Server 5.7\bin\mysql.exe
    SET FOUND=1
)

REM Check if in system PATH
where mysql.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [FOUND] MySQL is in your system PATH:
    where mysql.exe
    SET FOUND=1
)

echo.

if %FOUND% EQU 0 (
    echo [NOT FOUND] Could not locate MySQL on your system.
    echo.
    echo Please check if:
    echo   1. XAMPP/WAMP is installed
    echo   2. MySQL Server is installed
    echo   3. MySQL is running
    echo.
) else (
    echo ========================================
    echo.
    echo Copy one of the paths above and edit RUN_QUICK_FIX_SIMPLE.bat
    echo Change the line: SET MYSQL_PATH=...
    echo.
)

pause
