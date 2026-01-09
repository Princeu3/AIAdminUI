"""Claude Code service for running commands via non-interactive mode."""
import asyncio
import json
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Literal, Optional, Set

from app.services.permission_service import (
    permission_service,
    ToolType,
    PermissionScope,
)

# Plan mode system prompt
PLAN_MODE_PROMPT = """You are in PLAN MODE. Before taking any actions:

1. **Analyze the request** - Understand exactly what the user wants to accomplish
2. **Create a detailed plan** - List all the steps needed to complete the task
3. **Output the plan** - Format your plan clearly with numbered steps
4. **Wait for approval** - Do NOT execute any changes until the user approves the plan

Format your plan like this:
## Plan
1. [First step description]
2. [Second step description]
...

After the user approves, execute each step and mark them as completed.
If the user rejects or modifies the plan, adjust accordingly.

Remember: In plan mode, ALWAYS plan first, then wait for explicit approval before making any changes."""


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

    async def send_message(
        self,
        session_id: str,
        message: str,
        mode: Literal["normal", "plan"] = "normal",
    ) -> str:
        """
        Send a message to Claude and get response.

        Uses `-p` mode which skips the workspace trust dialog.
        Uses `--resume` for conversation continuity.

        Args:
            session_id: Session identifier
            message: User message to send
            mode: Session mode - 'normal' or 'plan'

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

        # Prepend plan mode system prompt if in plan mode
        effective_message = message
        if mode == "plan":
            effective_message = f"{PLAN_MODE_PROMPT}\n\n---\n\nUser request: {message}"

        # Build command based on whether this is first message or follow-up
        # Permissions are handled by settings.json (created in init-claude.sh)
        # Only use --permission-mode flag for plan mode
        if session.message_count == 0:
            # First message - use --session-id to create new session
            cmd = [
                "claude",
                "-p", effective_message,
                "--session-id", session.claude_session_id,
                "--output-format", "text",
            ]
        else:
            # Follow-up message - use --resume to continue session
            cmd = [
                "claude",
                "-p", effective_message,
                "--resume", session.claude_session_id,
                "--output-format", "text",
            ]

        # Add plan mode flag if in plan mode
        if mode == "plan":
            cmd.extend(["--permission-mode", "plan"])

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

    async def send_message_streaming(
        self,
        session_id: str,
        message: str,
        mode: Literal["normal", "plan"] = "normal",
        event_callback: Optional[Callable] = None,
    ) -> str:
        """
        Send a message to Claude with streaming JSON output.

        This version uses stream-json format to emit real-time events
        for tool use, text chunks, and other activities.

        Args:
            session_id: Session identifier
            message: User message to send
            mode: Session mode - 'normal' or 'plan'
            event_callback: Async callback for streaming events

        Returns:
            Claude's complete response text
        """
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError("Session not found")

        if not session.is_active:
            raise ValueError("Session is no longer active")

        # Prepend plan mode system prompt if in plan mode
        effective_message = message
        if mode == "plan":
            effective_message = f"{PLAN_MODE_PROMPT}\n\n---\n\nUser request: {message}"

        # Build command with stream-json output
        # Note: --verbose is required when using stream-json with -p
        # Permissions are handled by settings.json (created in init-claude.sh)
        # Only use --permission-mode flag for plan mode
        if session.message_count == 0:
            cmd = [
                "claude",
                "-p", effective_message,
                "--session-id", session.claude_session_id,
                "--output-format", "stream-json",
                "--verbose",
            ]
        else:
            cmd = [
                "claude",
                "-p", effective_message,
                "--resume", session.claude_session_id,
                "--output-format", "stream-json",
                "--verbose",
            ]

        # Add plan mode flag if in plan mode
        if mode == "plan":
            cmd.extend(["--permission-mode", "plan"])

        # Run Claude and stream output
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=session.working_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        full_response = []
        tool_uses = []

        # Read stdout line by line (NDJSON format)
        while True:
            line = await process.stdout.readline()
            if not line:
                break

            try:
                event = json.loads(line.decode().strip())
                event_type = event.get("type")

                if event_type == "assistant":
                    # Text content from Claude
                    message_content = event.get("message", {})
                    content = message_content.get("content", [])
                    for block in content:
                        if block.get("type") == "text":
                            text = block.get("text", "")
                            full_response.append(text)
                            if event_callback:
                                await event_callback({
                                    "type": "text_delta",
                                    "content": text,
                                })

                elif event_type == "content_block_start":
                    # Start of a content block (could be text or tool_use)
                    block = event.get("content_block", {})
                    if block.get("type") == "tool_use":
                        tool_id = block.get("id")
                        tool_name = block.get("name", "unknown")
                        tool_uses.append({
                            "id": tool_id,
                            "name": tool_name,
                            "input": {},
                            "status": "running",
                        })
                        if event_callback:
                            await event_callback({
                                "type": "tool_use_start",
                                "tool_id": tool_id,
                                "tool_name": tool_name,
                            })

                elif event_type == "content_block_delta":
                    # Delta for a content block
                    delta = event.get("delta", {})
                    if delta.get("type") == "text_delta":
                        text = delta.get("text", "")
                        full_response.append(text)
                        if event_callback:
                            await event_callback({
                                "type": "text_delta",
                                "content": text,
                            })
                    elif delta.get("type") == "input_json_delta":
                        # Tool input being streamed
                        partial_json = delta.get("partial_json", "")
                        if tool_uses:
                            # Append to the last tool use
                            pass  # We'll get complete input later

                elif event_type == "content_block_stop":
                    # End of a content block
                    if tool_uses:
                        tool = tool_uses[-1]
                        tool["status"] = "completed"
                        if event_callback:
                            await event_callback({
                                "type": "tool_use_end",
                                "tool_id": tool["id"],
                                "tool_name": tool["name"],
                            })

                elif event_type == "result":
                    # Final result
                    result_text = event.get("result", "")
                    if result_text and not full_response:
                        full_response.append(result_text)

                elif event_type == "error":
                    # Error from Claude
                    error_msg = event.get("error", {}).get("message", "Unknown error")
                    if event_callback:
                        await event_callback({
                            "type": "error",
                            "content": error_msg,
                        })

            except json.JSONDecodeError:
                # Not valid JSON, might be plain text error
                text = line.decode().strip()
                if text:
                    full_response.append(text)

        # Wait for process to complete
        await process.wait()

        # Check for errors
        if process.returncode != 0:
            stderr = await process.stderr.read()
            error_msg = stderr.decode().strip()
            if "not found" in error_msg.lower():
                raise RuntimeError("Claude CLI not found.")
            if error_msg:
                raise RuntimeError(f"Claude error: {error_msg}")

        response = "".join(full_response)
        session.message_count += 1

        # Send completion event via callback (don't use subscribers to avoid duplicates)
        if event_callback:
            await event_callback({
                "type": "complete",
                "content": response,
                "tool_uses": tool_uses,
            })

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

    async def execute_command(
        self, session_id: str, command: str, args: list[str]
    ) -> dict[str, Any]:
        """
        Execute a slash command.

        Args:
            session_id: Session identifier
            command: Command name (without /)
            args: Command arguments

        Returns:
            Command result dict with 'success', 'content', and optional 'data'
        """
        session = self.sessions.get(session_id)
        if not session:
            return {"success": False, "content": "Session not found"}

        # Route to appropriate handler
        handlers = {
            "status": self._cmd_status,
            "files": self._cmd_files,
            "compact": self._cmd_compact,
            "cost": self._cmd_cost,
        }

        handler = handlers.get(command)
        if not handler:
            return {"success": False, "content": f"Unknown command: /{command}"}

        try:
            return await handler(session, args)
        except Exception as e:
            return {"success": False, "content": f"Command error: {str(e)}"}

    async def _cmd_status(
        self, session: ClaudeSession, args: list[str]
    ) -> dict[str, Any]:
        """Get session status."""
        return {
            "success": True,
            "content": (
                f"Session: {session.session_id[:8]}...\n"
                f"Working directory: {session.working_dir}\n"
                f"Messages: {session.message_count}\n"
                f"Created: {session.created_at.isoformat()}\n"
                f"Active: {session.is_active}"
            ),
            "data": {
                "session_id": session.session_id,
                "working_dir": session.working_dir,
                "message_count": session.message_count,
                "created_at": session.created_at.isoformat(),
                "is_active": session.is_active,
            },
        }

    async def _cmd_files(
        self, session: ClaudeSession, args: list[str]
    ) -> dict[str, Any]:
        """List modified files using git status."""
        process = await asyncio.create_subprocess_exec(
            "git",
            "status",
            "--porcelain",
            cwd=session.working_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            return {
                "success": False,
                "content": f"Git error: {stderr.decode().strip()}",
            }

        output = stdout.decode().strip()
        if not output:
            return {"success": True, "content": "No modified files."}

        # Parse git status output
        files = []
        for line in output.split("\n"):
            if line:
                status = line[:2]
                filepath = line[3:]
                files.append({"status": status.strip(), "path": filepath})

        content_lines = ["Modified files:", ""]
        for f in files:
            status_map = {
                "M": "modified",
                "A": "added",
                "D": "deleted",
                "R": "renamed",
                "?": "untracked",
            }
            status_text = status_map.get(f["status"], f["status"])
            content_lines.append(f"  {status_text}: {f['path']}")

        return {
            "success": True,
            "content": "\n".join(content_lines),
            "data": {"files": files},
        }

    async def _cmd_compact(
        self, session: ClaudeSession, args: list[str]
    ) -> dict[str, Any]:
        """Request conversation compaction from Claude."""
        # This sends a special message to Claude asking it to summarize
        try:
            response = await self.send_message(
                session.session_id,
                "/compact - Please summarize our conversation so far in a concise way, highlighting key decisions and changes made.",
            )
            return {
                "success": True,
                "content": "Conversation compacted.",
                "data": {"summary": response},
            }
        except Exception as e:
            return {"success": False, "content": f"Failed to compact: {str(e)}"}

    async def _cmd_cost(
        self, session: ClaudeSession, args: list[str]
    ) -> dict[str, Any]:
        """Show session cost/token usage estimate."""
        # Note: Actual cost tracking would require parsing Claude's output
        # or using the API directly. For now, provide an estimate.
        return {
            "success": True,
            "content": (
                f"Session usage estimate:\n"
                f"  Messages exchanged: {session.message_count}\n"
                f"  Note: Detailed token/cost tracking not yet implemented.\n"
                f"  Use 'claude --cost' in terminal for accurate costs."
            ),
            "data": {
                "message_count": session.message_count,
            },
        }


# Singleton instance
claude_service = ClaudeService()
