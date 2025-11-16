#!/bin/bash

# Resumate Frontend Deployment Script
# This script builds and deploys the frontend application

set -e  # Exit on any error

# Configuration
PROJECT_NAME="resumate-frontend"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/apps/frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[FRONTEND]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[FRONTEND-SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[FRONTEND-WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[FRONTEND-ERROR]${NC} $1"
}

print_status "🎨 Starting Frontend Deployment..."

# Change to project root
cd "$ROOT_DIR"

# Copy staging environment file
if [ -f "apps/frontend/.env.staging" ]; then
    cp apps/frontend/.env.staging apps/frontend/.env
    print_success "Using staging environment configuration"
else
    print_error "apps/frontend/.env.staging not found. Run setup-staging.sh first."
    exit 1
fi

# Build frontend
print_status "Building frontend for staging..."
if npm run build:frontend; then
    print_success "Frontend built successfully"
else
    print_error "Frontend build failed"
    exit 1
fi

# Check if frontend build exists
if [ ! -d "apps/frontend/dist" ]; then
    print_error "Frontend build directory not found"
    exit 1
fi

print_success "Frontend build directory verified"

# Stop existing frontend PM2 process (safe for other running processes)
print_status "Stopping existing frontend PM2 process..."
pm2 delete resumate-frontend-staging 2>/dev/null || print_status "No existing resumate-frontend-staging process"

# Start frontend with PM2
print_status "Starting frontend with PM2..."
pm2 start ecosystem.config.js --only resumate-frontend-staging
print_success "Frontend started with PM2"

# Wait for frontend to be ready
print_status "Waiting for frontend to be ready..."
sleep 5

# Test frontend
if curl -f -s "http://localhost:3170" > /dev/null; then
    print_success "Frontend is healthy"
else
    print_warning "Frontend may still be starting up..."
fi

# Save PM2 process list
pm2 save
print_success "PM2 process list saved"

print_success "🎉 Frontend deployment completed successfully!"
echo ""
print_status "📊 Frontend Status:"
pm2 show resumate-frontend 2>/dev/null || echo "Process not found"

echo ""
print_status "🌐 Frontend URL:"
echo "  Local: http://localhost:3160"
echo "  Staging: https://resumate.gftrilo.store (if nginx configured)"

echo ""
print_status "📋 Useful Commands:"
echo "  View logs:    pm2 logs resumate-frontend"
echo "  Restart:      pm2 restart resumate-frontend"
echo "  Stop:         pm2 stop resumate-frontend"
echo "  Monitor:      pm2 monit"