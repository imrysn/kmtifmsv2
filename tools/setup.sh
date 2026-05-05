#!/bin/bash

echo "🚀 Setting up Electron React App..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null
then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"
echo ""

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install root dependencies"
    exit 1
fi

echo "✅ Root dependencies installed"
echo ""

# Install client dependencies
echo "📦 Installing client dependencies..."
cd client && npm install && cd ..

if [ $? -ne 0 ]; then
    echo "❌ Failed to install client dependencies"
    exit 1
fi

echo "✅ Client dependencies installed"
echo ""

echo "🎉 Setup complete!"
echo ""
echo "To run the application:"
echo "  npm run dev"
echo ""
echo "Test credentials:"
echo "  Email: test@example.com"
echo "  Password: password123"
echo ""
