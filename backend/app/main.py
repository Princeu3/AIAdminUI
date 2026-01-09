"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import settings
from app.api.routes import api_router
from app.api.websocket.terminal import router as ws_router
from app.models.database import init_db
from app.services.claude_service import claude_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print("Starting AI Admin UI Backend...")

    # Initialize database
    await init_db()
    print("Database initialized")

    yield

    # Shutdown - cleanup all sessions
    print("Shutting down...")
    for session_id in list(claude_service.sessions.keys()):
        await claude_service.terminate_session(session_id)
    print("All sessions terminated")


app = FastAPI(
    title="AI Admin UI Backend",
    description="Backend for managing Claude Code sessions and GitHub repos",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session middleware
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
)

# Include routers
app.include_router(api_router, prefix="/api")
app.include_router(ws_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "AI Admin UI Backend",
        "status": "running",
        "docs": "/docs",
    }


# For running directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
