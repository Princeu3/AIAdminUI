"""Claude Code session management routes."""
import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.services.claude_service import claude_service
from app.models.database import async_session_maker
from app.models.user import User
from app.models.repository import Repository

router = APIRouter()


class CreateSessionRequest(BaseModel):
    """Request to create a new Claude session."""
    repo_id: str


@router.post("")
async def create_session(user_id: str, request: CreateSessionRequest):
    """
    Create a new Claude Code session.

    Uses the server's Claude authentication (from `claude login`).
    """
    async with async_session_maker() as db:
        # Verify user exists
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify repository exists
        result = await db.execute(
            select(Repository).where(
                Repository.id == request.repo_id,
                Repository.user_id == user_id
            )
        )
        repo = result.scalar_one_or_none()
        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Create session (uses server's Claude credentials via CLI)
        try:
            session_id = str(uuid.uuid4())
            session = await claude_service.create_session(
                session_id=session_id,
                user_id=user_id,
                repo_id=request.repo_id,
                working_dir=repo.local_path,
            )

            return {
                "session_id": session.session_id,
                "repo_id": session.repo_id,
                "repo_path": session.working_dir,
                "status": "active" if session.is_active else "inactive",
                "created_at": session.created_at.isoformat(),
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


@router.get("")
async def list_sessions(user_id: str):
    """List active sessions for a user."""
    sessions = await claude_service.list_sessions(user_id)

    return {
        "sessions": [
            {
                "id": s.session_id,
                "repo_id": s.repo_id,
                "status": "active" if s.is_active else "inactive",
                "created_at": s.created_at.isoformat(),
            }
            for s in sessions
        ]
    }


@router.get("/{session_id}")
async def get_session(user_id: str, session_id: str):
    """Get session details."""
    session = await claude_service.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "id": session.session_id,
        "repo_id": session.repo_id,
        "repo_path": session.working_dir,
        "status": "active" if session.is_active else "inactive",
        "created_at": session.created_at.isoformat(),
        "is_alive": session.is_active,
        "message_count": session.message_count,
    }


@router.delete("/{session_id}")
async def terminate_session(user_id: str, session_id: str):
    """Terminate a session."""
    session = await claude_service.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    await claude_service.terminate_session(session_id)

    return {"message": "Session terminated"}


@router.post("/{session_id}/message")
async def send_message(user_id: str, session_id: str, message: str):
    """
    Send a message to Claude in a session.

    Alternative to WebSocket for simple request/response.
    """
    session = await claude_service.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        response = await claude_service.send_message(session_id, message)
        return {
            "response": response,
            "message_count": session.message_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
