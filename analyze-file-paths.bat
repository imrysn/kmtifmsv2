@echo off
echo ===================================================
echo          KMTIFMS2 File Path Analysis Tool
echo ===================================================
echo.
echo This tool analyzes your database to determine file path patterns
echo and helps fix file deletion issues.
echo.
echo Note: MySQL server must be running.
echo.

set /p confirm=Are you sure you want to proceed? (Y/N): 
if /i not "%confirm%"=="Y" goto :end

echo.
echo Running analysis...
echo.

node analyze-file-paths.js

echo.
echo ===================================================
echo.
echo Analysis complete. If you need to test file deletion,
echo you can use the Admin panel to try deleting files.
echo.
pause

:end
