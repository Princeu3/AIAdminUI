"""Claude credentials model for storing user's Claude API credentials."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.models.database import Base


class ClaudeCredentials(Base):
    """Model for storing encrypted Claude credentials per user."""

    __tablename__ = "claude_credentials"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), unique=True, nullable=False, index=True)
    credentials_encrypted = Column(Text, nullable=False)  # Encrypted credentials.json content

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user = relationship("User", backref="claude_credentials")

    def __repr__(self):
        return f"<ClaudeCredentials user_id={self.user_id}>"
