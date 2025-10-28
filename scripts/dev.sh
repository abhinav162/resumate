#!/bin/bash

# Resumate Development Script
echo "🚀 Starting Resumate in development mode..."

# Check if setup has been run
if [ ! -d "node_modules" ]; then
    echo "📦 Dependencies not installed. Running setup..."
    ./scripts/setup.sh
fi

# Check if shared package is built
if [ ! -d "packages/shared/dist" ]; then
    echo "🔨 Building shared packages..."
    npm run build:shared
fi

# Start development servers
echo "🌟 Starting frontend and backend..."
npm run dev