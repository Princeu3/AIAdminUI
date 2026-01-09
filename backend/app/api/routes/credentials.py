"""API routes for managing Claude credentials."""
import json
from fastapi import APIRouter, HTTPException, UploadFile, File
from sqlalchemy import select

from app.models.database import async_session_maker
from app.models.claude_credentials import ClaudeCredentials
from app.services.crypto_service import crypto_service

router = APIRouter(prefix="/credentials", tags=["credentials"])


@router.get("/claude")
async def get_claude_credentials(user_id: str):
    """Check if user has Claude credentials configured."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(ClaudeCredentials).where(ClaudeCredentials.user_id == user_id)
        )
        credentials = result.scalar_one_or_none()

        if credentials:
            return {
                "has_credentials": True,
                "created_at": credentials.created_at.isoformat(),
                "updated_at": credentials.updated_at.isoformat() if credentials.updated_at else None,
            }

        return {"has_credentials": False}


@router.post("/claude")
async def upload_claude_credentials(user_id: str, file: UploadFile = File(...)):
    """Upload Claude credentials.json file."""
    # Validate file name
    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="File must be a .json file")

    # Read and validate JSON content
    try:
        content = await file.read()
        credentials_data = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    # Validate credentials structure (basic validation)
    # Claude credentials.json typically contains oauth tokens or API keys
    if not isinstance(credentials_data, dict):
        raise HTTPException(status_code=400, detail="Credentials must be a JSON object")

    # Encrypt the credentials
    encrypted_credentials = crypto_service.encrypt(json.dumps(credentials_data))

    async with async_session_maker() as session:
        # Check if user already has credentials
        result = await session.execute(
            select(ClaudeCredentials).where(ClaudeCredentials.user_id == user_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing credentials
            existing.credentials_encrypted = encrypted_credentials
            await session.commit()
            return {"message": "Credentials updated successfully"}
        else:
            # Create new credentials
            new_credentials = ClaudeCredentials(
                user_id=user_id,
                credentials_encrypted=encrypted_credentials,
            )
            session.add(new_credentials)
            await session.commit()
            return {"message": "Credentials saved successfully"}


@router.delete("/claude")
async def delete_claude_credentials(user_id: str):
    """Delete user's Claude credentials."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(ClaudeCredentials).where(ClaudeCredentials.user_id == user_id)
        )
        credentials = result.scalar_one_or_none()

        if not credentials:
            raise HTTPException(status_code=404, detail="No credentials found")

        await session.delete(credentials)
        await session.commit()

        return {"message": "Credentials deleted successfully"}


async def get_user_credentials(user_id: str) -> str | None:
    """
    Get decrypted credentials for a user.
    Returns the raw credentials JSON string or None if not found.
    Used internally by claude_service.
    """
    async with async_session_maker() as session:
        result = await session.execute(
            select(ClaudeCredentials).where(ClaudeCredentials.user_id == user_id)
        )
        credentials = result.scalar_one_or_none()

        if credentials:
            return crypto_service.decrypt(credentials.credentials_encrypted)

        return None
