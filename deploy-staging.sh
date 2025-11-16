#!/bin/bash

# Resumate Modular Deployment Script
# This script orchestrates the deployment using separate scripts

set -e  # Exit on any error

# Configuration
PROJECT_NAME="resumate"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="$ROOT_DIR/scripts"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[DEPLOY]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[DEPLOY-SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[DEPLOY-WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[DEPLOY-ERROR]${NC} $1"
}

print_status "🚀 Starting Resumate Modular Deployment..."

# Check if scripts directory exists
if [ ! -d "$SCRIPTS_DIR" ]; then
    print_error "Scripts directory not found: $SCRIPTS_DIR"
    exit 1
fi

# Make scripts executable
chmod +x "$SCRIPTS_DIR"/*.sh

# Parse command line arguments
SETUP_ONLY=false
FRONTEND_ONLY=false
BACKEND_ONLY=false
SKIP_SETUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --setup-only)
            SETUP_ONLY=true
            shift
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        --backend-only)
            BACKEND_ONLY=true
            shift
            ;;
        --skip-setup)
            SKIP_SETUP=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --setup-only      Run only the setup script"
            echo "  --frontend-only   Deploy only the frontend"
            echo "  --backend-only    Deploy only the backend"
            echo "  --skip-setup      Skip the setup step"
            echo "  --help, -h        Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Full deployment"
            echo "  $0 --setup-only      # Setup only"
            echo "  $0 --frontend-only   # Frontend deployment only"
            echo "  $0 --backend-only    # Backend deployment only"
            echo "  $0 --skip-setup      # Deploy without setup"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Step 1: Setup (unless skipped or only doing frontend/backend)
if [ "$SKIP_SETUP" = false ] && [ "$FRONTEND_ONLY" = false ] && [ "$BACKEND_ONLY" = false ]; then
    print_status "📋 Step 1: Running setup..."
    if "$SCRIPTS_DIR/setup-staging.sh"; then
        print_success "Setup completed successfully"
    else
        print_error "Setup failed"
        exit 1
    fi
    
    if [ "$SETUP_ONLY" = true ]; then
        print_success "✅ Setup-only deployment completed!"
        exit 0
    fi
fi

# Step 2: Frontend deployment
if [ "$BACKEND_ONLY" = false ]; then
    print_status "🎨 Step 2: Deploying frontend..."
    if "$SCRIPTS_DIR/deploy-frontend-staging.sh"; then
        print_success "Frontend deployment completed successfully"
    else
        print_error "Frontend deployment failed"
        exit 1
    fi
    
    if [ "$FRONTEND_ONLY" = true ]; then
        print_success "✅ Frontend-only deployment completed!"
        exit 0
    fi
fi

# Step 3: Backend deployment
if [ "$FRONTEND_ONLY" = false ]; then
    print_status "⚙️  Step 3: Deploying backend..."
    if "$SCRIPTS_DIR/deploy-backend-staging.sh"; then
        print_success "Backend deployment completed successfully"
    else
        print_error "Backend deployment failed"
        exit 1
    fi
    
    if [ "$BACKEND_ONLY" = true ]; then
        print_success "✅ Backend-only deployment completed!"
        exit 0
    fi
fi

print_success "🎉 Full deployment completed successfully!"
echo ""
print_status "📊 Final Status:"
pm2 status

echo ""
print_status "🌐 Application URLs:"
echo "  Frontend: http://localhost:3170"
echo "  Backend API: http://localhost:4310/api"
echo "  Backend Health: http://localhost:4310/health"
echo "  Production: https://resumate.abhinavaditya.com (if nginx configured)"

echo ""
print_status "📋 Post-Deployment Commands:"
echo "  View all logs:    pm2 logs"
echo "  Monitor:          pm2 monit"
echo "  Restart all:      pm2 restart resumate-backend-staging resumate-frontend-staging"
echo "  Stop all:         pm2 stop resumate-backend-staging resumate-frontend-staging"
echo "  Status:           pm2 status"

echo ""
print_success "✨ Resumate is now running in staging mode!"