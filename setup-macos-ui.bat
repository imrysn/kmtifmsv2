@echo off
setlocal EnableDelayedExpansion

REM macOS UI Setup Script for kmtifmsv2 (Windows)
REM This script installs dependencies and sets up the enhanced UI

echo 🚀 Setting up macOS-style UI for kmtifmsv2...
echo =================================================

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the kmtifmsv2 root directory
    pause
    exit /b 1
)

REM Navigate to client directory
echo 📁 Navigating to client directory...
cd client
if errorlevel 1 (
    echo ❌ Error: Client directory not found
    pause
    exit /b 1
)

REM Check if package.json exists in client
if not exist "package.json" (
    echo ❌ Error: Client package.json not found
    pause
    exit /b 1
)

REM Install Anime.js dependency
echo 📦 Installing Anime.js...
call npm install animejs@^3.2.2

REM Check if installation was successful
if errorlevel 1 (
    echo ❌ Error: Failed to install Anime.js
    pause
    exit /b 1
) else (
    echo ✅ Anime.js installed successfully
)

REM Check if node_modules exists and animejs is installed
if exist "node_modules\animejs" (
    echo ✅ Anime.js dependency verified
) else (
    echo ⚠️  Warning: Anime.js installation may be incomplete
)

REM Navigate back to root
cd ..

echo.
echo 🎉 Setup Complete!
echo ===================
echo.
echo 📋 Next Steps:
echo 1. Start the Express server: npm start
echo 2. In a new terminal, start the React client: cd client ^&^& npm run dev
echo 3. Open http://localhost:5173 to view the enhanced UI
echo.
echo 📚 Documentation:
echo - Read MACOS_UI_GUIDE.md for detailed usage instructions
echo - Check components\*.jsx for implementation examples
echo.
echo 🎨 Features Added:
echo - ✨ Smooth Anime.js animations
echo - 🪟 Glassmorphism effects
echo - 📱 Responsive macOS-style design
echo - 🎯 Enhanced user interactions
echo - 🎨 Modern login interface
echo.
echo Happy coding! 🚀
echo.
pause