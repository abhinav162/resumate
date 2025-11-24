#!/bin/bash

# Resumate Production Setup Script (Docker Version)
# Sets up environment files and directories

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[SETUP]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
DATA_DIR="$ROOT_DIR/data"

print_status "🚀 Setting up Resumate environment..."

# 1. Create Directories
print_status "Creating directories..."
mkdir -p "$LOG_DIR"
mkdir -p "$DATA_DIR"
chmod 755 "$DATA_DIR"

# 2. Setup Database File (for volume mounting)
DB_PATH="$DATA_DIR/resumate.db"
if [ ! -f "$DB_PATH" ]; then
    print_status "Creating empty database file..."
    touch "$DB_PATH"
    chmod 666 "$DB_PATH" # Needs to be writable by container user
fi

# 3. Environment Files
print_status "Configuring environment files..."

# Backend .env
if [ ! -f "$ROOT_DIR/apps/backend/.env" ]; then
    if [ -f "$ROOT_DIR/apps/backend/.env.example" ]; then
        print_warning "Creating apps/backend/.env from example"
        cp "$ROOT_DIR/apps/backend/.env.example" "$ROOT_DIR/apps/backend/.env"
        # Adjust DB path for Docker (inside container path)
        sed -i.bak "s|DB_PATH=.*|DB_PATH=/app/data/resumate.db|g" "$ROOT_DIR/apps/backend/.env"
        rm "$ROOT_DIR/apps/backend/.env.bak" 2>/dev/null || true
    else
        print_error "No .env.example found for backend"
    fi
fi

# Frontend .env
if [ ! -f "$ROOT_DIR/apps/frontend/.env" ]; then
    if [ -f "$ROOT_DIR/apps/frontend/.env.example" ]; then
        print_status "Creating apps/frontend/.env from example"
        cp "$ROOT_DIR/apps/frontend/.env.example" "$ROOT_DIR/apps/frontend/.env"
    else
        print_error "No .env.example found for frontend"
    fi
fi

print_success "✅ Setup completed! You can now run ./deploy.sh"