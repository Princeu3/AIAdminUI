"""Git operations service using GitPython."""
import asyncio
import os
from pathlib import Path
from typing import Optional

from git import Repo
from git.exc import GitCommandError

from app.config import settings


class GitService:
    """Handles git operations for repositories."""

    def __init__(self, repos_base_path: Optional[str] = None):
        self.repos_base_path = Path(repos_base_path or settings.REPOS_BASE_PATH)
        self.repos_base_path.mkdir(parents=True, exist_ok=True)

    async def clone_repository(
        self,
        clone_url: str,
        repo_name: str,
        access_token: str,
        branch: Optional[str] = None,
    ) -> Path:
        """
        Clone a repository with authentication.

        Args:
            clone_url: GitHub clone URL (https)
            repo_name: Name for local directory
            access_token: GitHub access token
            branch: Optional branch to checkout

        Returns:
            Path to cloned repository
        """
        local_path = self.repos_base_path / repo_name

        # Remove existing if present
        if local_path.exists():
            import shutil
            shutil.rmtree(local_path)

        # Inject token into clone URL for authentication
        authenticated_url = clone_url.replace(
            "https://github.com",
            f"https://x-access-token:{access_token}@github.com"
        )

        # Run clone in executor to avoid blocking
        loop = asyncio.get_event_loop()

        clone_kwargs = {"depth": 1}  # Shallow clone for speed
        if branch:
            clone_kwargs["branch"] = branch

        await loop.run_in_executor(
            None,
            lambda: Repo.clone_from(
                authenticated_url,
                str(local_path),
                **clone_kwargs
            )
        )

        # Configure git user for commits
        repo = Repo(str(local_path))
        with repo.config_writer() as config:
            config.set_value("user", "name", "AI Admin Bot")
            config.set_value("user", "email", "bot@aiadmin.local")

        return local_path

    async def pull_latest(
        self,
        local_path: Path,
        access_token: str,
        branch: str = "main",
    ):
        """Pull latest changes from remote."""
        repo = Repo(str(local_path))

        # Update remote URL with token
        self._set_authenticated_remote(repo, access_token)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: repo.remotes.origin.pull(branch)
        )

    async def create_branch(
        self,
        local_path: Path,
        branch_name: str,
        from_branch: str = "main",
    ):
        """Create and checkout a new branch."""
        repo = Repo(str(local_path))

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: repo.git.checkout("-b", branch_name)
        )

    async def commit_changes(
        self,
        local_path: Path,
        message: str,
        files: Optional[list[str]] = None,
    ) -> str:
        """
        Stage and commit changes.

        Args:
            local_path: Path to repository
            message: Commit message
            files: Optional list of files to stage (all if None)

        Returns:
            Commit SHA
        """
        repo = Repo(str(local_path))

        loop = asyncio.get_event_loop()

        if files:
            await loop.run_in_executor(
                None,
                lambda: repo.index.add(files)
            )
        else:
            # Add all changes
            await loop.run_in_executor(
                None,
                lambda: repo.git.add("-A")
            )

        commit = await loop.run_in_executor(
            None,
            lambda: repo.index.commit(message)
        )

        return str(commit.hexsha)

    async def push_branch(
        self,
        local_path: Path,
        branch: str,
        access_token: str,
    ):
        """Push branch to remote."""
        repo = Repo(str(local_path))

        # Update remote URL with token
        self._set_authenticated_remote(repo, access_token)

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: repo.remotes.origin.push(branch, set_upstream=True)
        )

    async def get_current_branch(self, local_path: Path) -> str:
        """Get current branch name."""
        repo = Repo(str(local_path))
        return repo.active_branch.name

    async def get_status(self, local_path: Path) -> dict:
        """Get repository status."""
        repo = Repo(str(local_path))

        return {
            "branch": repo.active_branch.name,
            "is_dirty": repo.is_dirty(),
            "untracked_files": repo.untracked_files,
            "changed_files": [item.a_path for item in repo.index.diff(None)],
        }

    def _set_authenticated_remote(self, repo: Repo, access_token: str):
        """Set authenticated URL for origin remote."""
        origin = repo.remotes.origin
        original_url = origin.url

        if "x-access-token" not in original_url:
            authenticated_url = original_url.replace(
                "https://github.com",
                f"https://x-access-token:{access_token}@github.com"
            )
            origin.set_url(authenticated_url)


# Singleton instance
git_service = GitService()
