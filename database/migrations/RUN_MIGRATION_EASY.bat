@echo off
echo =========================================
echo  KMTIFMS2 - Database Migration
echo  Adding "under_revision" Status
echo =========================================
echo.
echo This will allow the REVISED badge to appear
echo when users resubmit rejected files.
echo.
echo =========================================
echo.

cd /d "%~dp0"
node run_migration_with_config.js

echo.
pause
