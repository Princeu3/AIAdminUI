"""User model for storing GitHub OAuth users."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship

from app.models.database import Base


class User(Base):
    """User model storing GitHub OAuth information."""

    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    github_id = Column(Integer, unique=True, nullable=False, index=True)
    github_username = Column(String(255), nullable=False)
    github_email = Column(String(255), nullable=True)
    github_avatar_url = Column(String(512), nullable=True)
    github_access_token = Column(String(512), nullable=False)  # Encrypted

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    repositories = relationship("Repository", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.github_username}>"
