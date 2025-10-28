#!/bin/bash

# deploy.sh - Deployment script for Resumate
# This script pulls latest code, builds the project, and serves it using tmux

set -e  # Exit on any error

# Configuration
PROJECT_NAME="resumate"
SESSION_NAME="resumate"
PORT=3160
DIST_DIR="dist"

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

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists git; then
    print_error "Git is not installed"
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed"
    exit 1
fi

if ! command_exists tmux; then
    print_error "tmux is not installed"
    exit 1
fi

if ! command_exists npx; then
    print_error "npx is not installed"
    exit 1
fi

print_success "All prerequisites are available"

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_status "Working in directory: $SCRIPT_DIR"

# Git pull latest changes
print_status "Pulling latest changes from git..."
if git pull; then
    print_success "Git pull completed"
else
    print_error "Git pull failed"
    exit 1
fi

# Install dependencies if package.json has changed
print_status "Checking for dependency updates..."
if [ "package-lock.json" -nt "node_modules" ] || [ ! -d "node_modules" ]; then
    print_status "Installing/updating dependencies..."
    if npm install; then
        print_success "Dependencies installed"
    else
        print_error "npm install failed"
        exit 1
    fi
else
    print_status "Dependencies are up to date"
fi

# Build the project
print_status "Building the project..."
if npm run build; then
    print_success "Build completed"
else
    print_error "Build failed"
    exit 1
fi

# Check if dist directory exists
if [ ! -d "$DIST_DIR" ]; then
    print_error "Dist directory not found after build"
    exit 1
fi

# Function to start the server
start_server() {
    print_status "Starting server on port $PORT..."
    npx serve -s "$DIST_DIR" -l "$PORT"
}

# Check if tmux session exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    print_warning "Tmux session '$SESSION_NAME' already exists"
    
    # Kill the existing session and create a new one
    print_status "Stopping existing session..."
    tmux kill-session -t "$SESSION_NAME"
    print_success "Existing session stopped"
    
    print_status "Creating new tmux session '$SESSION_NAME'..."
    tmux new-session -d -s "$SESSION_NAME" -c "$SCRIPT_DIR"
    
    # Start the server in the new session
    tmux send-keys -t "$SESSION_NAME" "npx serve -s $DIST_DIR -l $PORT" Enter
    
else
    print_status "Creating new tmux session '$SESSION_NAME'..."
    tmux new-session -d -s "$SESSION_NAME" -c "$SCRIPT_DIR"
    
    # Start the server in the new session
    tmux send-keys -t "$SESSION_NAME" "npx serve -s $DIST_DIR -l $PORT" Enter
fi

# Wait a moment for the server to start
sleep 2

# Check if the server is running
if curl -f -s "http://localhost:$PORT" > /dev/null; then
    print_success "Server is running successfully!"
    print_success "Application available at: http://localhost:$PORT"
    print_status "Tmux session name: $SESSION_NAME"
    print_status "To attach to the session: tmux attach-session -t $SESSION_NAME"
    print_status "To stop the server: tmux kill-session -t $SESSION_NAME"
else
    print_warning "Server may still be starting up..."
    print_status "Check the tmux session: tmux attach-session -t $SESSION_NAME"
fi

# Show tmux session info
print_status "Current tmux sessions:"
tmux list-sessions 2>/dev/null || print_warning "No tmux sessions found"

print_success "Deployment completed!"
print_status "Access your application at: http://localhost:$PORT"