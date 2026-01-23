@echo off
REM ========================================
REM SIMPLE VERSION - Manual MySQL Path
REM ========================================
REM If the automatic version doesn't work, edit the MYSQL_PATH below

REM EDIT THIS LINE if MySQL is in a different location:
SET MYSQL_PATH=C:\xampp\mysql\bin\mysql.exe

REM Check if MySQL exists at the specified path
if not exist "%MYSQL_PATH%" (
    echo ERROR: MySQL not found at: %MYSQL_PATH%
    echo.
    echo Please edit this batch file and set the correct path to mysql.exe
    echo.
    echo Right-click this file ^(RUN_QUICK_FIX_SIMPLE.bat^) and select "Edit"
    echo Then change the line: SET MYSQL_PATH=...
    echo.
    pause
    exit /b 1
)

echo ========================================
echo   Running Database Fix...
echo ========================================
echo.
echo MySQL Path: %MYSQL_PATH%
echo Database: kmtifms
echo.
echo Please enter your MySQL root password:
echo.

"%MYSQL_PATH%" -u root -p kmtifms < "%~dp0QUICK_FIX_SIMPLE.sql"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   SUCCESS!
    echo ========================================
    echo.
    echo Now restart your backend server!
    echo.
) else (
    echo.
    echo ========================================
    echo   ERROR!
    echo ========================================
    echo.
    echo Check the error message above.
    echo.
)

pause
