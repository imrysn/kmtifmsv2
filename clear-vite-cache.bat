@echo off
echo ========================================
echo  Clearing Vite Cache
echo ========================================
echo.

cd client

if exist "node_modules\.vite" (
    echo Deleting node_modules\.vite...
    rmdir /s /q "node_modules\.vite"
    echo ✓ Vite cache cleared!
) else (
    echo No Vite cache found (this is fine)
)

if exist ".vite" (
    echo Deleting .vite...
    rmdir /s /q ".vite"
    echo ✓ .vite folder cleared!
)

echo.
echo ========================================
echo  Cache cleared! Now restart the app.
echo ========================================
pause
