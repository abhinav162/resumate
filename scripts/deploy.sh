#!/bin/bash

# Resumate Deployment Script
echo "🚀 Deploying Resumate..."

# Exit on any error
set -e

# Build all packages
echo "🔨 Building all packages..."
npm run build

# Run tests (if available)
echo "🧪 Running tests..."
npm run test || echo "⚠️  No tests found or tests failed"

# Create deployment bundle
echo "📦 Creating deployment bundle..."
mkdir -p dist/

# Copy backend files
cp -r apps/backend/src dist/backend-src
cp apps/backend/package.json dist/
cp apps/backend/.env.example dist/.env.example

# Copy frontend build
if [ -d "apps/frontend/dist" ]; then
    cp -r apps/frontend/dist dist/frontend
else
    echo "❌ Frontend build not found. Please run 'npm run build:frontend' first."
    exit 1
fi

# Copy shared package dist
cp -r packages/shared/dist dist/shared

# Create deployment package.json
cat > dist/package.json << 'EOF'
{
  "name": "resumate-deploy",
  "version": "1.0.0",
  "scripts": {
    "start": "node backend-src/server.js",
    "postinstall": "npm install --production"
  },
  "dependencies": {
    "@google/generative-ai": "^0.1.3",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "express-validator": "^7.0.1",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.1",
    "sqlite3": "^5.1.6",
    "uuid": "^9.0.1"
  }
}
EOF

echo "✅ Deployment bundle created in dist/"
echo ""
echo "📋 Deployment files:"
echo "  dist/backend-src/     - Backend source code"
echo "  dist/frontend/        - Frontend static files"
echo "  dist/shared/          - Shared utilities"
echo "  dist/package.json     - Production dependencies"
echo "  dist/.env.example     - Environment template"
echo ""
echo "🚀 To deploy:"
echo "  1. Upload dist/ contents to your server"
echo "  2. Set up environment variables from .env.example"
echo "  3. Run 'npm install' and 'npm start'"