@echo off
cls
echo.
echo ========================================
echo  RUNNING MIGRATION TO PRODUCTION
echo  Database: kmtifms on KMTI-NAS
echo ========================================
echo.

cd /d "%~dp0"
node run_migration_production.js

echo.
pause
