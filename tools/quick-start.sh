#!/bin/bash
# Quick Start Script for Windows (using Git Bash or WSL)
# You can also run: npm start

clear
echo "=================================="
echo "  KMTI FMS - Quick Start"
echo "=================================="
echo ""
echo "Starting development environment..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

if [ ! -d "client/node_modules" ]; then
    echo "📦 Installing client dependencies..."
    cd client && npm install && cd ..
fi

echo ""
echo "🚀 Starting application with smart startup..."
echo ""
echo "This will:"
echo "  1. Check Express server"
echo "  2. Start Vite dev server"
echo "  3. Wait for Vite to be ready"
echo "  4. Start Electron"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Run the smart startup
npm start
