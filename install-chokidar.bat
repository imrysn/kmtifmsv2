@echo off
echo Installing chokidar for file system watching...
cd /d "%~dp0"
npm install chokidar@3.6.0 --save
echo.
echo Done! Please restart the application.
pause
