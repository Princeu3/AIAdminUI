"""Health check endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def health_check():
    """Basic health check."""
    return {"status": "healthy", "service": "ai-admin-backend"}


@router.get("/ready")
async def readiness_check():
    """Readiness check for load balancers."""
    return {"status": "ready"}
