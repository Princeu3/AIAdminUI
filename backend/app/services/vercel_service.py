"""Vercel API service for deployment and preview URLs."""
import asyncio
from typing import Optional

import httpx

from app.config import settings


class VercelService:
    """Handles Vercel API integration."""

    BASE_URL = "https://api.vercel.com"

    def __init__(self, token: Optional[str] = None, team_id: Optional[str] = None):
        self.token = token or settings.VERCEL_TOKEN
        self.team_id = team_id or settings.VERCEL_TEAM_ID

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def _params(self) -> dict:
        params = {}
        if self.team_id:
            params["teamId"] = self.team_id
        return params

    async def list_deployments(
        self,
        project_id: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict]:
        """List recent deployments."""
        if not self.token:
            return []

        async with httpx.AsyncClient() as client:
            params = self._params()
            params["limit"] = limit
            if project_id:
                params["projectId"] = project_id

            response = await client.get(
                f"{self.BASE_URL}/v6/deployments",
                headers=self._headers(),
                params=params,
            )

            response.raise_for_status()
            return response.json().get("deployments", [])

    async def get_deployment(self, deployment_id: str) -> dict:
        """Get deployment details."""
        if not self.token:
            return {}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/v13/deployments/{deployment_id}",
                headers=self._headers(),
                params=self._params(),
            )

            response.raise_for_status()
            return response.json()

    async def get_preview_url_for_branch(
        self,
        project_id: str,
        branch: str,
    ) -> Optional[str]:
        """
        Find the preview URL for a specific branch.

        Args:
            project_id: Vercel project ID
            branch: Git branch name

        Returns:
            Preview URL or None
        """
        if not self.token:
            return None

        deployments = await self.list_deployments(project_id=project_id, limit=50)

        for deployment in deployments:
            meta = deployment.get("meta", {})
            if meta.get("githubCommitRef") == branch:
                if deployment.get("state") == "READY":
                    return f"https://{deployment['url']}"

        return None

    async def wait_for_deployment(
        self,
        deployment_id: str,
        timeout: int = 300,
        poll_interval: int = 5,
    ) -> dict:
        """
        Wait for deployment to be ready.

        Args:
            deployment_id: Deployment ID
            timeout: Max wait time in seconds
            poll_interval: Time between checks in seconds

        Returns:
            Deployment data when ready

        Raises:
            TimeoutError: If deployment doesn't complete in time
            Exception: If deployment fails
        """
        if not self.token:
            raise ValueError("Vercel token not configured")

        elapsed = 0
        while elapsed < timeout:
            deployment = await self.get_deployment(deployment_id)
            state = deployment.get("state")

            if state == "READY":
                return deployment
            elif state in ("ERROR", "CANCELED"):
                raise Exception(f"Deployment failed with state: {state}")

            await asyncio.sleep(poll_interval)
            elapsed += poll_interval

        raise TimeoutError(f"Deployment did not complete within {timeout} seconds")


# Singleton instance
vercel_service = VercelService()
