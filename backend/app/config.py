"""Application configuration loaded from environment variables."""
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment."""

    # App
    APP_NAME: str = "AI Admin UI"
    DEBUG: bool = False

    # Security
    SESSION_SECRET: str = "dev-session-secret-change-in-production"
    JWT_SECRET: str = "dev-jwt-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ENCRYPTION_KEY: str = "dev-encryption-key-change-in-production"

    # GitHub OAuth
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_REDIRECT_URI: str = "http://localhost:8000/api/auth/github/callback"

    # Claude.ai OAuth
    CLAUDE_OAUTH_REDIRECT_URI: str = "http://localhost:8000/api/auth/claude/callback"

    # Vercel
    VERCEL_TOKEN: str = ""
    VERCEL_TEAM_ID: str = ""

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./aiadmin.db"

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Repos storage path
    REPOS_BASE_PATH: str = "/tmp/repos"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
