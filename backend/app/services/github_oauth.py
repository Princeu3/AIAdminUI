"""GitHub OAuth service for authentication and API access."""
import secrets
from urllib.parse import urlencode
from typing import Optional

import httpx

from app.config import settings


class GitHubOAuthService:
    """Handles GitHub OAuth authentication flow."""

    AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
    TOKEN_URL = "https://github.com/login/oauth/access_token"
    USER_API_URL = "https://api.github.com/user"
    REPOS_API_URL = "https://api.github.com/user/repos"

    def __init__(self):
        self.client_id = settings.GITHUB_CLIENT_ID
        self.client_secret = settings.GITHUB_CLIENT_SECRET
        self.redirect_uri = settings.GITHUB_REDIRECT_URI

    def get_authorization_url(self, state: Optional[str] = None) -> tuple[str, str]:
        """Generate GitHub OAuth authorization URL."""
        if not state:
            state = secrets.token_urlsafe(32)

        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": "repo user:email",
            "state": state,
        }

        url = f"{self.AUTHORIZE_URL}?{urlencode(params)}"
        return url, state

    async def exchange_code_for_token(self, code: str) -> str:
        """Exchange authorization code for access token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                },
                headers={"Accept": "application/json"},
            )

            response.raise_for_status()
            data = response.json()

            if "error" in data:
                raise ValueError(data.get("error_description", data["error"]))

            return data["access_token"]

    async def get_user_info(self, access_token: str) -> dict:
        """Fetch user info from GitHub API."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.USER_API_URL,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )

            response.raise_for_status()
            return response.json()

    async def get_user_repos(
        self,
        access_token: str,
        page: int = 1,
        per_page: int = 30,
    ) -> list[dict]:
        """Fetch user's repositories."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.REPOS_API_URL,
                params={
                    "page": page,
                    "per_page": per_page,
                    "sort": "updated",
                    "affiliation": "owner,collaborator,organization_member",
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )

            response.raise_for_status()
            return response.json()

    async def create_pull_request(
        self,
        access_token: str,
        owner: str,
        repo: str,
        title: str,
        body: str,
        head: str,
        base: str = "main",
    ) -> dict:
        """Create a pull request on GitHub."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.github.com/repos/{owner}/{repo}/pulls",
                json={
                    "title": title,
                    "body": body,
                    "head": head,
                    "base": base,
                },
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )

            response.raise_for_status()
            return response.json()

    async def merge_pull_request(
        self,
        access_token: str,
        owner: str,
        repo: str,
        pull_number: int,
    ) -> dict:
        """Merge a pull request."""
        async with httpx.AsyncClient() as client:
            response = await client.put(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{pull_number}/merge",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                },
            )

            response.raise_for_status()
            return response.json()


# Singleton instance
github_oauth_service = GitHubOAuthService()
