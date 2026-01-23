@echo off
title KMTIFMS2 Migration - Adding REVISED Status
color 0A
echo.
echo  ╔════════════════════════════════════════════════════════════╗
echo  ║                                                            ║
echo  ║          KMTIFMS2 - DATABASE MIGRATION                     ║
echo  ║          Adding "under_revision" Status                    ║
echo  ║                                                            ║
echo  ╚════════════════════════════════════════════════════════════╝
echo.
echo  This will enable the REVISED badge feature:
echo  • Files that replace rejected ones will show 📝 REVISED
echo  • Automatic replacement of rejected files with same name
echo  • Better file revision tracking
echo.
echo  ════════════════════════════════════════════════════════════
echo.
echo  Press any key to start the migration...
pause >nul
echo.
echo  🔄 Starting migration...
echo.

cd /d "%~dp0"
node run_migration_production.js

if %ERRORLEVEL% EQU 0 (
    color 0A
    echo.
    echo  ╔════════════════════════════════════════════════════════════╗
    echo  ║                                                            ║
    echo  ║          ✅ MIGRATION COMPLETED SUCCESSFULLY! ✅            ║
    echo  ║                                                            ║
    echo  ╚════════════════════════════════════════════════════════════╝
    echo.
    echo  Next steps:
    echo  1. Restart your server (if running)
    echo  2. Upload a file with the same name as a rejected file
    echo  3. See the 📝 REVISED badge appear!
    echo.
) else (
    color 0C
    echo.
    echo  ╔════════════════════════════════════════════════════════════╗
    echo  ║                                                            ║
    echo  ║          ❌ MIGRATION FAILED - SEE ERRORS ABOVE ❌         ║
    echo  ║                                                            ║
    echo  ╚════════════════════════════════════════════════════════════╝
    echo.
    echo  Common issues:
    echo  • MySQL server not running
    echo  • KMTI-NAS not accessible on network
    echo  • Database credentials incorrect
    echo.
    echo  Check START_HERE.md for troubleshooting steps.
    echo.
)

echo  Press any key to exit...
pause >nul
