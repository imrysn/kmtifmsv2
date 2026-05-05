@echo off
echo 🚀 Setting up Electron React App...
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

:: Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo ✅ Node.js and npm are installed
echo.

:: Install root dependencies
echo 📦 Installing root dependencies...
npm install
if errorlevel 1 (
    echo ❌ Failed to install root dependencies
    pause
    exit /b 1
)

echo ✅ Root dependencies installed
echo.

:: Install client dependencies
echo 📦 Installing client dependencies...
cd client
npm install
if errorlevel 1 (
    echo ❌ Failed to install client dependencies
    pause
    exit /b 1
)
cd ..

echo ✅ Client dependencies installed
echo.

echo 🎉 Setup complete!
echo.
echo To run the application:
echo   npm run dev
echo.
echo Test credentials:
echo   Email: test@example.com
echo   Password: password123
echo.
pause
