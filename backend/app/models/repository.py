"""Repository model for connected GitHub repositories."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy.orm import relationship

from app.models.database import Base


class Repository(Base):
    """Repository model for storing connected GitHub repos."""

    __tablename__ = "repositories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    github_repo_id = Column(Integer, nullable=False)
    full_name = Column(String(255), nullable=False)  # e.g., "org/repo"
    clone_url = Column(String(512), nullable=False)
    local_path = Column(String(512), nullable=False)
    default_branch = Column(String(100), default="main")

    # Vercel integration
    vercel_project_id = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="repositories")

    def __repr__(self):
        return f"<Repository {self.full_name}>"
