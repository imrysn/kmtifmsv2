#!/bin/bash

# macOS UI Setup Script for kmtifmsv2
# This script installs dependencies and sets up the enhanced UI

echo "🚀 Setting up macOS-style UI for kmtifmsv2..."
echo "================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the kmtifmsv2 root directory"
    exit 1
fi

# Navigate to client directory
echo "📁 Navigating to client directory..."
cd client || {
    echo "❌ Error: Client directory not found"
    exit 1
}

# Check if package.json exists in client
if [ ! -f "package.json" ]; then
    echo "❌ Error: Client package.json not found"
    exit 1
fi

# Install Anime.js dependency
echo "📦 Installing Anime.js..."
npm install animejs@^3.2.2

# Verify installation
if [ $? -eq 0 ]; then
    echo "✅ Anime.js installed successfully"
else
    echo "❌ Error: Failed to install Anime.js"
    exit 1
fi

# Check if node_modules exists and animejs is installed
if [ -d "node_modules/animejs" ]; then
    echo "✅ Anime.js dependency verified"
else
    echo "⚠️  Warning: Anime.js installation may be incomplete"
fi

# Navigate back to root
cd ..

echo ""
echo "🎉 Setup Complete!"
echo "==================="
echo ""
echo "📋 Next Steps:"
echo "1. Start the Express server: npm start"
echo "2. In a new terminal, start the React client: cd client && npm run dev"
echo "3. Open http://localhost:5173 to view the enhanced UI"
echo ""
echo "📚 Documentation:"
echo "- Read MACOS_UI_GUIDE.md for detailed usage instructions"
echo "- Check components/*.jsx for implementation examples"
echo ""
echo "🎨 Features Added:"
echo "- ✨ Smooth Anime.js animations"
echo "- 🪟 Glassmorphism effects"
echo "- 📱 Responsive macOS-style design"
echo "- 🎯 Enhanced user interactions"
echo "- 🎨 Modern login interface"
echo ""
echo "Happy coding! 🚀"