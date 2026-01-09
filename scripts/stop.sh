#!/bin/bash

# AI Admin UI - Stop Script
# Stops all running development servers

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping AI Admin UI servers...${NC}"
echo ""

# Kill processes on port 8000 (backend)
BACKEND_PIDS=$(lsof -ti:8000 2>/dev/null)
if [ ! -z "$BACKEND_PIDS" ]; then
    echo "Stopping backend (PIDs: $BACKEND_PIDS)..."
    echo "$BACKEND_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}Backend stopped.${NC}"
else
    echo "Backend not running."
fi

# Kill processes on port 3000 (frontend)
FRONTEND_PIDS=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$FRONTEND_PIDS" ]; then
    echo "Stopping frontend (PIDs: $FRONTEND_PIDS)..."
    echo "$FRONTEND_PIDS" | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}Frontend stopped.${NC}"
else
    echo "Frontend not running."
fi

# Also kill any uvicorn or next processes related to this project
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

echo ""
echo -e "${GREEN}All servers stopped.${NC}"
