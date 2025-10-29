#!/bin/bash

# Resumate Production Setup Script
# This script sets up the initial environment and dependencies for production

set -e  # Exit on any error

# Configuration
PROJECT_NAME="resumate"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

print_status "🚀 Starting Resumate Production Setup..."

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
print_status "Creating necessary directories..."
mkdir -p "$LOG_DIR"
mkdir -p "$ROOT_DIR/data"
chmod 755 "$ROOT_DIR/data"
print_success "Created logs and data directories with proper permissions"

# Initialize database if it doesn't exist
DB_PATH="$ROOT_DIR/data/resumate.db"
if [ ! -f "$DB_PATH" ]; then
    print_status "Database doesn't exist. Will be created automatically by the backend..."
    chmod 755 "$ROOT_DIR/data"
    touch "$DB_PATH"
    chmod 644 "$DB_PATH"
    print_success "Created empty database file with proper permissions"
fi

# Change to project root
cd "$ROOT_DIR"

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

# Set up production environment files
print_status "Setting up production environment files..."

# Backend environment
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

# Frontend environment
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

print_success "✅ Production setup completed successfully!"
echo ""
print_status "📋 Next Steps:"
echo "  1. Review and update environment files:"
echo "     - apps/backend/.env.production"
echo "     - apps/frontend/.env.production"
echo "  2. Run frontend deployment: ./scripts/deploy-frontend.sh"
echo "  3. Run backend deployment: ./scripts/deploy-backend.sh"
echo "  4. Or run full deployment: ./deploy-production.sh"
echo ""
print_status "📁 Important Files:"
echo "  - Database: $ROOT_DIR/data/resumate.db"
echo "  - Logs: $ROOT_DIR/logs/"
echo "  - Backend env: apps/backend/.env.production"
echo "  - Frontend env: apps/frontend/.env.production"