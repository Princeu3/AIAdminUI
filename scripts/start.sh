#!/bin/bash

# AI Admin UI - Start Script
# Starts both frontend and backend development servers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting AI Admin UI...${NC}"
echo ""

# Check if .env files exist
if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
    echo -e "${RED}Error: backend/.env not found. Run ./scripts/setup.sh first.${NC}"
    exit 1
fi

# Create logs directory
mkdir -p "$PROJECT_DIR/logs"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping servers...${NC}"

    # Kill background processes
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi

    # Also kill any processes on the ports
    lsof -ti:8000 | xargs kill -9 2>/dev/null || true
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true

    echo -e "${GREEN}Servers stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Backend
echo -e "${GREEN}Starting backend on http://localhost:8000...${NC}"
cd "$PROJECT_DIR/backend"
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > "$PROJECT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 2
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Backend failed to start. Check logs/backend.log${NC}"
    exit 1
fi

# Start Frontend
echo -e "${GREEN}Starting frontend on http://localhost:3000...${NC}"
cd "$PROJECT_DIR/frontend"
bun dev > "$PROJECT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
sleep 3
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}Frontend failed to start. Check logs/frontend.log${NC}"
    cleanup
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}AI Admin UI is running!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Frontend: ${YELLOW}http://localhost:3000${NC}"
echo -e "Backend:  ${YELLOW}http://localhost:8000${NC}"
echo -e "API Docs: ${YELLOW}http://localhost:8000/docs${NC}"
echo -e "Health:   ${YELLOW}http://localhost:8000/api/health${NC}"
echo ""
echo -e "Logs:"
echo -e "  Backend:  ${PROJECT_DIR}/logs/backend.log"
echo -e "  Frontend: ${PROJECT_DIR}/logs/frontend.log"
echo ""
echo -e "Press ${RED}Ctrl+C${NC} to stop all servers"
echo ""

# Keep script running and show logs
tail -f "$PROJECT_DIR/logs/backend.log" "$PROJECT_DIR/logs/frontend.log"
