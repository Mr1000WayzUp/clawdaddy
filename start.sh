#!/bin/bash

# ClawDaddy Quick Start Script

echo "🦞 ClawDaddy AI Assistant - Quick Start"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Warning: Node.js version 18+ is recommended. You have: $(node -v)"
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed"
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚙️  Setting up environment configuration..."
    cp .env.example .env
    echo "✅ Created .env file from template"
    echo ""
    echo "⚠️  IMPORTANT: You need to add your API keys to .env file"
    echo "   At minimum, add your Anthropic API key:"
    echo "   ANTHROPIC_API_KEY=your_key_here"
    echo ""
    read -p "Press Enter to open .env file in your editor (or edit it manually later)..."
    if command -v nano &> /dev/null; then
        nano .env
    elif command -v vim &> /dev/null; then
        vim .env
    else
        echo "Please edit .env file manually and add your Anthropic API key"
    fi
fi

# Build the project
echo "🔨 Building the project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Build successful"
echo ""

# Start the server
echo "🚀 Starting ClawDaddy AI Assistant..."
echo ""
echo "======================================"
echo "Dashboard will be available at:"
echo "  http://localhost:3000"
echo ""
echo "API endpoints:"
echo "  http://localhost:3000/api"
echo ""
echo "Press Ctrl+C to stop the server"
echo "======================================"
echo ""

npm run dev
