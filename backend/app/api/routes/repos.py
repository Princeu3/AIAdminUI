"""Repository management routes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.github_oauth import github_oauth_service
from app.services.git_service import git_service
from app.services.crypto_service import crypto_service
from app.models.database import async_session_maker
from app.models.user import User
from app.models.repository import Repository

router = APIRouter()


class ConnectRepoRequest(BaseModel):
    """Request to connect a repository."""
    github_repo_id: int
    full_name: str
    clone_url: str
    default_branch: str = "main"


@router.get("")
async def list_github_repos(user_id: str, page: int = 1, per_page: int = 30):
    """List user's GitHub repositories."""
    async with async_session_maker() as session:
        # Get user
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Decrypt access token
        access_token = crypto_service.decrypt(user.github_access_token)

        # Fetch repos from GitHub
        repos = await github_oauth_service.get_user_repos(
            access_token=access_token,
            page=page,
            per_page=per_page,
        )

        return {
            "repos": [
                {
                    "id": repo["id"],
                    "full_name": repo["full_name"],
                    "name": repo["name"],
                    "description": repo.get("description"),
                    "clone_url": repo["clone_url"],
                    "default_branch": repo.get("default_branch", "main"),
                    "private": repo["private"],
                    "updated_at": repo["updated_at"],
                }
                for repo in repos
            ],
            "page": page,
            "per_page": per_page,
        }


@router.get("/connected")
async def list_connected_repos(user_id: str):
    """List repositories connected to AI Admin."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Repository).where(Repository.user_id == user_id)
        )
        repos = result.scalars().all()

        return {
            "repos": [
                {
                    "id": repo.id,
                    "github_repo_id": repo.github_repo_id,
                    "full_name": repo.full_name,
                    "local_path": repo.local_path,
                    "default_branch": repo.default_branch,
                    "vercel_project_id": repo.vercel_project_id,
                }
                for repo in repos
            ]
        }


@router.post("/connect")
async def connect_repository(user_id: str, request: ConnectRepoRequest):
    """Connect and clone a repository."""
    async with async_session_maker() as session:
        # Get user
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if already connected
        result = await session.execute(
            select(Repository).where(
                Repository.user_id == user_id,
                Repository.github_repo_id == request.github_repo_id
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            raise HTTPException(status_code=400, detail="Repository already connected")

        # Decrypt access token
        access_token = crypto_service.decrypt(user.github_access_token)

        # Clone repository
        repo_name = f"{user_id}_{request.full_name.replace('/', '_')}"

        try:
            local_path = await git_service.clone_repository(
                clone_url=request.clone_url,
                repo_name=repo_name,
                access_token=access_token,
                branch=request.default_branch,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to clone: {str(e)}")

        # Create repository record
        repo = Repository(
            user_id=user_id,
            github_repo_id=request.github_repo_id,
            full_name=request.full_name,
            clone_url=request.clone_url,
            local_path=str(local_path),
            default_branch=request.default_branch,
        )
        session.add(repo)
        await session.commit()
        await session.refresh(repo)

        return {
            "id": repo.id,
            "full_name": repo.full_name,
            "local_path": repo.local_path,
            "message": "Repository connected successfully",
        }


@router.delete("/{repo_id}")
async def disconnect_repository(user_id: str, repo_id: str):
    """Disconnect a repository."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Repository).where(
                Repository.id == repo_id,
                Repository.user_id == user_id
            )
        )
        repo = result.scalar_one_or_none()

        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Optionally delete local clone
        import shutil
        from pathlib import Path
        local_path = Path(repo.local_path)
        if local_path.exists():
            shutil.rmtree(local_path)

        await session.delete(repo)
        await session.commit()

        return {"message": "Repository disconnected"}


@router.post("/{repo_id}/sync")
async def sync_repository(user_id: str, repo_id: str):
    """Pull latest changes for a repository."""
    async with async_session_maker() as session:
        # Get repo
        result = await session.execute(
            select(Repository).where(
                Repository.id == repo_id,
                Repository.user_id == user_id
            )
        )
        repo = result.scalar_one_or_none()

        if not repo:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Get user for access token
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()

        access_token = crypto_service.decrypt(user.github_access_token)

        try:
            from pathlib import Path
            await git_service.pull_latest(
                local_path=Path(repo.local_path),
                access_token=access_token,
                branch=repo.default_branch,
            )
            return {"message": "Repository synced successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")
