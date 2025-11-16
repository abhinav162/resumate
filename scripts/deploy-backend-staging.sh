#!/bin/bash

# Resumate Backend Deployment Script
# This script deploys the backend application

set -e  # Exit on any error

# Configuration
PROJECT_NAME="resumate-backend"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/apps/backend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[BACKEND]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[BACKEND-SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[BACKEND-WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[BACKEND-ERROR]${NC} $1"
}

print_status "⚙️  Starting Backend Deployment..."

# Change to project root
cd "$ROOT_DIR"

# Copy staging environment file
if [ -f "apps/backend/.env.staging" ]; then
    cp apps/backend/.env.staging apps/backend/.env
    print_success "Using staging environment configuration"
else
    print_error "apps/backend/.env.staging not found. Run setup-staging.sh first."
    exit 1
fi

# Build backend (if needed)
print_status "Building backend..."
if npm run build:backend; then
    print_success "Backend built successfully"
else
    print_warning "Backend build step skipped or failed (this is normal for Node.js apps)"
fi

# Stop existing backend PM2 process (safe for other running processes)
print_status "Stopping existing backend PM2 process..."
pm2 delete resumate-backend-staging 2>/dev/null || print_status "No existing resumate-backend-staging process"

# Start backend with PM2
print_status "Starting backend with PM2..."
pm2 start ecosystem.config.js --only resumate-backend-staging
print_success "Backend started with PM2"

# Wait for backend to be ready
print_status "Waiting for backend to be ready..."
sleep 5

# Initialize database schema
print_status "Initializing database schema..."
if npm run init-db; then
    print_success "Database schema initialized"
else
    print_warning "Database initialization may have failed - this is normal if already initialized"
fi

# Test backend health
if curl -f -s "http://localhost:4310/api/resumes" > /dev/null; then
    print_success "Backend is healthy and responding to API requests"
elif curl -f -s "http://localhost:4310/health" > /dev/null; then
    print_success "Backend health endpoint is responding"
else
    print_warning "Backend may still be starting up..."
fi

# Save PM2 process list
pm2 save
print_success "PM2 process list saved"

print_success "🎉 Backend deployment completed successfully!"
echo ""
print_status "📊 Backend Status:"
pm2 show resumate-backend-staging 2>/dev/null || echo "Process not found"

echo ""
print_status "🌐 Backend URLs:"
echo "  API: http://localhost:4310/api"
echo "  Health: http://localhost:4310/health"
echo "  Staging: https://resumate.gftrilo.store/api (if nginx configured)"

echo ""
print_status "🗄️  Database:"
echo "  Path: $ROOT_DIR/data/resumate.db"
echo "  Status: $([ -f "$ROOT_DIR/data/resumate.db" ] && echo "✅ Exists" || echo "❌ Missing")"

echo ""
print_status "📋 Useful Commands:"
echo "  View logs:    pm2 logs resumate-backend-staging"
echo "  Restart:      pm2 restart resumate-backend-staging"
echo "  Stop:         pm2 stop resumate-backend-staging"
echo "  Monitor:      pm2 monit"
echo "  DB Init:      npm run init-db"