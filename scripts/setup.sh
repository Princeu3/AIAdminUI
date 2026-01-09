#!/bin/bash

# AI Admin UI - Setup Script
# Run this once to set up the development environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Setting up AI Admin UI..."
echo "Project directory: $PROJECT_DIR"
echo ""

# Check for required tools
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "Error: $1 is not installed. Please install it first."
        exit 1
    fi
}

echo "Checking required tools..."
check_command bun
check_command uv
check_command git
check_command claude
echo "All required tools found."
echo ""

# Check Claude Code authentication
echo "Checking Claude Code authentication..."
if claude auth status 2>/dev/null | grep -q "authenticated"; then
    echo "Claude Code is authenticated."
else
    echo ""
    echo "========================================"
    echo "Claude Code is NOT authenticated!"
    echo "========================================"
    echo ""
    echo "Please run 'claude login' to authenticate with your Claude Max subscription."
    echo "This is required for the AI features to work."
    echo ""
    read -p "Would you like to run 'claude login' now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        claude login
    else
        echo "Skipping Claude login. Remember to run 'claude login' before starting the app."
    fi
fi
echo ""

# Setup Backend
echo "Setting up backend..."
cd "$PROJECT_DIR/backend"

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "Created backend/.env from .env.example"
        echo "Please edit backend/.env with your credentials:"
        echo "  - GITHUB_CLIENT_ID"
        echo "  - GITHUB_CLIENT_SECRET"
        echo "  - ENCRYPTION_KEY (generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")"
    else
        echo "Warning: .env.example not found in backend/"
    fi
else
    echo "backend/.env already exists"
fi

# Install Python dependencies
echo "Installing Python dependencies..."
uv sync

echo ""

# Setup Frontend
echo "Setting up frontend..."
cd "$PROJECT_DIR/frontend"

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo "Created frontend/.env.local from .env.example"
    else
        echo "Warning: .env.example not found in frontend/"
    fi
else
    echo "frontend/.env.local already exists"
fi

# Install Node dependencies
echo "Installing Node dependencies..."
bun install

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your GitHub OAuth credentials"
echo "2. Run ./scripts/start.sh to start the development servers"
echo ""
