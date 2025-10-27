@echo off
echo ========================================
echo   Fixing React Import Issues
echo ========================================
echo.

echo Running fix script...
node fix-react-imports.js

echo.
echo ========================================
echo   Testing the application...
echo ========================================
echo.

echo Please wait while we start the app to verify fixes...
timeout /t 3 /nobreak >nul

npm start
