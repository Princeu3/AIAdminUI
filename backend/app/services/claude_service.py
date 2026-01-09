"""Claude Code service for running commands via non-interactive mode."""
import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable, Optional, Set


@dataclass
class ClaudeSession:
    """Represents a Claude Code session."""

    session_id: str
    user_id: str
    repo_id: str
    working_dir: str
    claude_session_id: str  # UUID for Claude --session-id / --resume
    subscribers: Set[Callable] = field(default_factory=set)
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    message_count: int = 0


class ClaudeService:
    """
    Service for running Claude Code CLI in non-interactive mode.

    Uses `-p` (print) mode with `--resume` for session persistence.
    This bypasses the workspace trust dialog while maintaining conversation context.
    """

    def __init__(self):
        self.sessions: dict[str, ClaudeSession] = {}

    async def create_session(
        self,
        session_id: str,
        user_id: str,
        repo_id: str,
        working_dir: str,
    ) -> ClaudeSession:
        """
        Create a new Claude session.

        Args:
            session_id: Unique session identifier
            user_id: User ID
            repo_id: Repository ID
            working_dir: Working directory for Claude

        Returns:
            ClaudeSession instance
        """
        claude_session_id = str(uuid.uuid4())
        session = ClaudeSession(
            session_id=session_id,
            user_id=user_id,
            repo_id=repo_id,
            working_dir=working_dir,
            claude_session_id=claude_session_id,
        )
        self.sessions[session_id] = session
        return session

    async def send_message(self, session_id: str, message: str) -> str:
        """
        Send a message to Claude and get response.

        Uses `-p` mode which skips the workspace trust dialog.
        Uses `--resume` for conversation continuity.

        Args:
            session_id: Session identifier
            message: User message to send

        Returns:
            Claude's response text

        Raises:
            ValueError: If session not found
            RuntimeError: If Claude returns an error
        """
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("Session not found")

        if not session.is_active:
            raise ValueError("Session is no longer active")

        # Build command based on whether this is first message or follow-up
        if session.message_count == 0:
            # First message - use --session-id to create new session
            cmd = [
                "claude",
                "-p", message,
                "--session-id", session.claude_session_id,
                "--output-format", "text",
            ]
        else:
            # Follow-up message - use --resume to continue session
            cmd = [
                "claude",
                "-p", message,
                "--resume", session.claude_session_id,
                "--output-format", "text",
            ]

        # Run Claude and capture output
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=session.working_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode().strip()
            # Check for common errors
            if "not found" in error_msg.lower():
                raise RuntimeError("Claude CLI not found. Please ensure 'claude' is installed and in PATH.")
            raise RuntimeError(f"Claude error: {error_msg}")

        response = stdout.decode()
        session.message_count += 1

        # Broadcast to subscribers (for WebSocket clients)
        for callback in list(session.subscribers):
            try:
                await callback(response)
            except Exception as e:
                print(f"Error broadcasting to subscriber: {e}")

        return response

    async def get_session(self, session_id: str) -> Optional[ClaudeSession]:
        """Get session by ID."""
        return self.sessions.get(session_id)

    async def list_sessions(self, user_id: str) -> list[ClaudeSession]:
        """List all active sessions for a user."""
        return [
            s for s in self.sessions.values()
            if s.user_id == user_id and s.is_active
        ]

    async def terminate_session(self, session_id: str):
        """Terminate a session."""
        session = self.sessions.get(session_id)
        if session:
            session.is_active = False

    def subscribe(self, session_id: str, callback: Callable):
        """Subscribe to session responses."""
        session = self.sessions.get(session_id)
        if session:
            session.subscribers.add(callback)

    def unsubscribe(self, session_id: str, callback: Callable):
        """Unsubscribe from session responses."""
        session = self.sessions.get(session_id)
        if session:
            session.subscribers.discard(callback)


# Singleton instance
claude_service = ClaudeService()
