#!/bin/bash

# Resumate Monorepo Setup Script
echo "🚀 Setting up Resumate monorepo..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | cut -d'v' -f2)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared packages
echo "🔨 Building shared packages..."
npm run build:shared

# Create environment files
echo "⚙️  Setting up environment files..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📝 Created .env file from .env.example"
fi

if [ ! -f apps/frontend/.env ]; then
    echo "VITE_API_URL=http://localhost:3001/api" > apps/frontend/.env
    echo "📝 Created frontend .env file"
fi

if [ ! -f apps/backend/.env ]; then
    cp apps/backend/.env.example apps/backend/.env 2>/dev/null || echo "PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
DB_PATH=../../data/resumate.db
JWT_SECRET=resumate_dev_secret_change_in_production
CORS_ORIGIN=http://localhost:3000" > apps/backend/.env
    echo "📝 Created backend .env file"
fi

# Create data directory
mkdir -p data
echo "📁 Created data directory"

# Initialize database
echo "🗄️  Initializing database..."
npm run init-db

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "  1. Run 'npm run dev' to start both frontend and backend"
echo "  2. Frontend will be available at http://localhost:3000"
echo "  3. Backend API will be available at http://localhost:3001"
echo "  4. Visit http://localhost:3001/health to check backend status"
echo ""
echo "💡 Useful commands:"
echo "  npm run dev          - Start both apps in development mode"
echo "  npm run dev:frontend - Start only frontend"
echo "  npm run dev:backend  - Start only backend"
echo "  npm run build        - Build all apps"
echo "  npm run test         - Run all tests"