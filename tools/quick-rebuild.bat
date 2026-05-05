@echo off
REM ============================================================================
REM KMTI FMS - Quick Rebuild (No Process Cleanup)
REM ============================================================================
REM Use this for faster rebuilds when no processes are running
REM For full cleanup, use clean-build.bat instead
REM ============================================================================

echo.
echo ============================================================================
echo KMTI FMS - Quick Rebuild
echo ============================================================================
echo.

REM Clean build folders
echo Cleaning build folders...
if exist "dist" rmdir /s /q "dist" 2>NUL
if exist "dist-server" rmdir /s /q "dist-server" 2>NUL
if exist "client\dist" rmdir /s /q "client\dist" 2>NUL

echo.
echo Building client...
cd client && call npm run build && cd ..
if %ERRORLEVEL% NEQ 0 exit /b 1

echo.
echo Building server...
call npm run build:server
if %ERRORLEVEL% NEQ 0 exit /b 1

echo.
echo Building Electron app...
call npm run electron:pack
if %ERRORLEVEL% NEQ 0 exit /b 1

echo.
echo ============================================================================
echo BUILD COMPLETE!
echo ============================================================================
echo Installer: %CD%\dist\
echo.
pause
