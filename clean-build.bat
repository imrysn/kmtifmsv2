@echo off
echo Cleaning build artifacts...

REM Kill any running Electron processes
taskkill /F /IM "KMTI File Management.exe" 2>nul
taskkill /F /IM electron.exe 2>nul

REM Wait 2 seconds
ping 127.0.0.1 -n 3 > nul

REM Clean dist folder
if exist dist rmdir /s /q dist

REM Clean dist-server
if exist dist-server rmdir /s /q dist-server

echo.
echo Cleanup complete!
echo.
echo Now run: npm run prepare:release
pause
