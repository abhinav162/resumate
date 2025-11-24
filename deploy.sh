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

# 2. Determine Environment
ENV_NAME=${1:-prod} # default to prod
if [ "$ENV_NAME" == "staging" ]; then
    print_status "🚀 Deploying to STAGING environment..."
    export IMAGE_TAG="latest-staging"
    export BACKEND_PORT=4310
    export FRONTEND_PORT=3170
    export COMPOSE_PROJECT_NAME="resumate-staging"
    ENV_SUFFIX="staging"
else
    print_status "🚀 Deploying to PRODUCTION environment..."
    export IMAGE_TAG="latest-prod"
    export BACKEND_PORT=4300
    export FRONTEND_PORT=3160
    export COMPOSE_PROJECT_NAME="resumate-prod"
    ENV_SUFFIX="production"
fi

# 3. Setup Environment Files
print_status "📝 Setting up environment files for $ENV_NAME..."

# Ensure directories exist (since we are not cloning the repo)
mkdir -p apps/backend
mkdir -p apps/frontend

# Copy from root-level flat files (e.g., .env.backend.production) to the location docker-compose expects
if [ -f ".env.backend.$ENV_SUFFIX" ]; then
    cp ".env.backend.$ENV_SUFFIX" apps/backend/.env
else
    print_error "Missing backend env file: .env.backend.$ENV_SUFFIX"
    exit 1
fi

if [ -f ".env.frontend.$ENV_SUFFIX" ]; then
    cp ".env.frontend.$ENV_SUFFIX" apps/frontend/.env
else
    print_error "Missing frontend env file: .env.frontend.$ENV_SUFFIX"
    exit 1
fi

# 4. Build and Run
print_status "🐳 Starting containers for $COMPOSE_PROJECT_NAME..."
# Pull latest images first to ensure we aren't using cached ones
docker-compose pull
docker-compose -p $COMPOSE_PROJECT_NAME up -d

print_success "🎉 Deployment to $ENV_NAME completed!"
echo ""
print_status "📊 Status:"
docker-compose -p $COMPOSE_PROJECT_NAME ps

echo ""
print_status "🌐 URLs:"
echo "  Frontend: http://localhost:$FRONTEND_PORT"
echo "  Backend:  http://localhost:$BACKEND_PORT"