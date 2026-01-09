"""GitHub OAuth authentication routes."""
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.services.github_oauth import github_oauth_service
from app.services.crypto_service import crypto_service
from app.models.database import async_session_maker
from app.models.user import User

router = APIRouter()

# In-memory state storage (use Redis in production)
oauth_states: dict[str, bool] = {}


@router.get("/github")
async def github_login(request: Request):
    """Initiate GitHub OAuth flow."""
    auth_url, state = github_oauth_service.get_authorization_url()

    # Store state for CSRF protection
    oauth_states[state] = True

    return {"auth_url": auth_url, "state": state}


@router.get("/github/callback")
async def github_callback(
    code: str,
    state: str,
    response: Response,
):
    """Handle GitHub OAuth callback."""
    # Verify state for CSRF protection
    if state not in oauth_states:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

    del oauth_states[state]

    try:
        # Exchange code for token
        access_token = await github_oauth_service.exchange_code_for_token(code)

        # Get user info
        github_user = await github_oauth_service.get_user_info(access_token)

        # Create or update user in database
        async with async_session_maker() as session:
            # Check if user exists
            result = await session.execute(
                select(User).where(User.github_id == github_user["id"])
            )
            user = result.scalar_one_or_none()

            encrypted_token = crypto_service.encrypt(access_token)

            if user:
                # Update existing user
                user.github_username = github_user["login"]
                user.github_email = github_user.get("email")
                user.github_avatar_url = github_user.get("avatar_url")
                user.github_access_token = encrypted_token
            else:
                # Create new user
                user = User(
                    github_id=github_user["id"],
                    github_username=github_user["login"],
                    github_email=github_user.get("email"),
                    github_avatar_url=github_user.get("avatar_url"),
                    github_access_token=encrypted_token,
                )
                session.add(user)

            await session.commit()
            await session.refresh(user)

            user_id = user.id

        # Redirect to frontend with user ID (frontend will store in state)
        redirect_url = f"{settings.FRONTEND_URL}/callback?user_id={user_id}"
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
async def get_current_user(user_id: str):
    """Get current authenticated user."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "id": user.id,
            "github_username": user.github_username,
            "github_email": user.github_email,
            "github_avatar_url": user.github_avatar_url,
        }


@router.post("/logout")
async def logout():
    """Logout user (frontend clears state)."""
    return {"message": "Logged out successfully"}
