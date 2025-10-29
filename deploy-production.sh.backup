#!/bin/bash

# Resumate Production Deployment Script
# This script builds and deploys the Resumate application for production

set -e  # Exit on any error

# Configuration
PROJECT_NAME="resumate"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

print_status "🚀 Starting Resumate Production Deployment..."

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
fi

if ! command_exists node; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command_exists pm2; then
    print_error "PM2 is not installed. Please install it first: npm install -g pm2"
    exit 1
fi

print_success "✅ All prerequisites are available"

# Create necessary directories with proper permissions
mkdir -p "$LOG_DIR"
mkdir -p "$ROOT_DIR/data"
chmod 755 "$ROOT_DIR/data"
print_status "Created logs and data directories with proper permissions"

# Initialize database if it doesn't exist
DB_PATH="$ROOT_DIR/data/resumate.db"
if [ ! -f "$DB_PATH" ]; then
    print_status "Database doesn't exist. Will be created automatically by the backend..."
    # Ensure the data directory is writable
    chmod 755 "$ROOT_DIR/data"
    touch "$DB_PATH"
    chmod 644 "$DB_PATH"
    print_status "Created empty database file with proper permissions"
fi

# Change to project root
cd "$ROOT_DIR"

# Stop existing Resumate PM2 processes (safe for other running processes)
print_status "Stopping existing Resumate PM2 processes..."
pm2 delete resumate-backend 2>/dev/null || print_status "No existing resumate-backend process"
pm2 delete resumate-frontend 2>/dev/null || print_status "No existing resumate-frontend process"

# Install dependencies
print_status "Installing dependencies..."
if npm install; then
    print_success "Dependencies installed"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Build shared packages first
print_status "Building shared packages..."
if npm run build:shared; then
    print_success "Shared packages built"
else
    print_error "Failed to build shared packages"
    exit 1
fi

# Build frontend
print_status "Building frontend for production..."
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

print_success "✅ All builds completed successfully"

# Set up production environment files
print_status "Setting up production environment..."

# Check if production env files exist, if not create from examples
if [ ! -f "apps/backend/.env.production" ]; then
    if [ -f "apps/backend/.env.example" ]; then
        print_warning "Creating apps/backend/.env.production from .env.example"
        print_warning "⚠️  IMPORTANT: Please review and update JWT_SECRET and other sensitive values!"
        cp apps/backend/.env.example apps/backend/.env.production
        # Update DB_PATH to use absolute path
        sed -i.bak "s|DB_PATH=../../data/resumate.db|DB_PATH=$ROOT_DIR/data/resumate.db|g" apps/backend/.env.production
        rm apps/backend/.env.production.bak 2>/dev/null || true
    else
        print_error "No .env.example found in apps/backend/"
        exit 1
    fi
else
    print_success "Using existing apps/backend/.env.production"
fi

if [ ! -f "apps/frontend/.env.production" ]; then
    if [ -f "apps/frontend/.env.example" ]; then
        print_status "Creating apps/frontend/.env.production from .env.example"
        cp apps/frontend/.env.example apps/frontend/.env.production
    else
        print_error "No .env.example found in apps/frontend/"
        exit 1
    fi
else
    print_success "Using existing apps/frontend/.env.production"
fi

# Copy production environment files to .env
cp apps/backend/.env.production apps/backend/.env
cp apps/frontend/.env.production apps/frontend/.env
print_success "Production environment configured"

# Start services with PM2
print_status "Starting services with PM2..."

# Start backend
pm2 start ecosystem.config.js --only resumate-backend --env production
print_success "Backend started"

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
if curl -f -s "http://localhost:4300/api/resumes" > /dev/null; then
    print_success "Backend is healthy"
else
    print_warning "Backend may still be starting up..."
fi

# Start frontend
pm2 start ecosystem.config.js --only resumate-frontend --env production
print_success "Frontend started"

# Wait for frontend to be ready
print_status "Waiting for frontend to be ready..."
sleep 5

# Test frontend
if curl -f -s "http://localhost:3160" > /dev/null; then
    print_success "Frontend is healthy"
else
    print_warning "Frontend may still be starting up..."
fi

# Save PM2 process list (includes all your existing processes)
pm2 save
print_success "PM2 process list saved (preserving all existing processes)"

# Note: Not running PM2 startup since it's already configured

print_success "🎉 Deployment completed successfully!"
echo ""
print_status "📊 Service Status:"
pm2 status

echo ""
print_status "🌐 Application URLs:"
echo "  Frontend: http://localhost:3160"
echo "  Backend API: http://localhost:4300/api"
echo "  Backend Health: http://localhost:4300/health"

echo ""
print_status "📋 Useful PM2 Commands:"
echo "  View logs:    pm2 logs"
echo "  Monitor:      pm2 monit"
echo "  Restart all:  pm2 restart all"
echo "  Stop all:     pm2 stop all"
echo "  View status:  pm2 status"

echo ""
print_success "✨ Resumate is now running in production mode!"