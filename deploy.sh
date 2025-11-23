#!/bin/bash

# Resumate Docker Deployment Script

set -e  # Exit on any error

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

print_status "� Starting Resumate Deployment..."

# 1. Check for Docker
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose not found. Please install Docker first."
    exit 1
fi

# 2. Setup Environment (if needed)
if [ ! -f "apps/backend/.env" ] || [ ! -f "apps/frontend/.env" ]; then
    print_status "Checking environment configuration..."
    ./scripts/setup-production.sh
fi

# 3. Build and Run
print_status "🐳 Building and starting containers..."
docker-compose up -d --build

print_success "🎉 Deployment completed!"
echo ""
print_status "📊 Status:"
docker-compose ps

echo ""
print_status "🌐 URLs:"
echo "  Frontend: http://localhost:3160"
echo "  Backend:  http://localhost:4300"