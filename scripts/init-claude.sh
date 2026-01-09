#!/bin/bash

# AI Admin UI - Container Initialization Script
# Sets up Claude credentials and starts the application

set -e

echo "=== AI Admin UI Container Initialization ==="

# Create necessary directories
mkdir -p /app/repos /app/data /root/.claude

# Initialize Claude credentials from environment variable if provided
if [ -n "$CLAUDE_CREDENTIALS_JSON" ]; then
    echo "Setting up Claude credentials..."
    echo "$CLAUDE_CREDENTIALS_JSON" > /root/.claude/credentials.json
    chmod 600 /root/.claude/credentials.json
    echo "Claude credentials configured."
else
    echo "Warning: CLAUDE_CREDENTIALS_JSON not set. Claude CLI may not work without authentication."
fi

# Set up Anthropic API key if provided
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "ANTHROPIC_API_KEY is configured."
    export ANTHROPIC_API_KEY
fi

# Use Railway's PORT if available, otherwise default to 8000
export PORT="${PORT:-8000}"
echo "Application will listen on port: $PORT"

# Change to app directory
cd /app

echo "Starting application..."
echo "==================================="

# Execute the command passed to the container (CMD)
exec "$@"
