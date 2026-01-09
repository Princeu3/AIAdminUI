"""Permission service for handling tool use approvals."""
import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Callable, Optional


class ToolType(str, Enum):
    READ = "read"
    WRITE = "write"
    BASH = "bash"
    BROWSER = "browser"
    MCP = "mcp"


class PermissionScope(str, Enum):
    ONCE = "once"
    SESSION = "session"
    ALWAYS = "always"


@dataclass
class PermissionRequest:
    """A pending permission request."""
    id: str
    session_id: str
    tool: ToolType
    description: str
    path: Optional[str] = None
    command: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


class PermissionService:
    """
    Manages permission requests and approvals for tool use.

    This service:
    1. Tracks pending permission requests
    2. Maintains session-level permission grants
    3. Coordinates approval flow between Claude and the user
    """

    def __init__(self):
        # Pending requests waiting for user response
        self.pending_requests: dict[str, PermissionRequest] = {}
        # Events to signal when a request is resolved
        self.request_events: dict[str, asyncio.Event] = {}
        # Results of resolved requests (id -> allowed)
        self.request_results: dict[str, bool] = {}
        # Session permissions (session_id -> {tool:path -> allowed})
        self.session_permissions: dict[str, dict[str, bool]] = {}
        # Callbacks to notify clients of permission requests
        self.request_callbacks: dict[str, Callable] = {}

    def _get_permission_key(self, tool: ToolType, path: Optional[str]) -> str:
        """Generate a permission key for caching."""
        return f"{tool.value}:{path or '*'}"

    def register_callback(self, session_id: str, callback: Callable):
        """Register a callback for permission request notifications."""
        self.request_callbacks[session_id] = callback

    def unregister_callback(self, session_id: str):
        """Unregister a callback."""
        self.request_callbacks.pop(session_id, None)

    def check_permission(
        self,
        session_id: str,
        tool: ToolType,
        path: Optional[str] = None,
    ) -> Optional[bool]:
        """
        Check if permission is already granted.

        Returns:
            True if allowed, False if denied, None if not yet decided
        """
        if session_id not in self.session_permissions:
            return None

        session_perms = self.session_permissions[session_id]

        # Check specific path permission
        specific_key = self._get_permission_key(tool, path)
        if specific_key in session_perms:
            return session_perms[specific_key]

        # Check wildcard permission
        wildcard_key = self._get_permission_key(tool, None)
        if wildcard_key in session_perms:
            return session_perms[wildcard_key]

        return None

    async def request_permission(
        self,
        session_id: str,
        tool: ToolType,
        description: str,
        path: Optional[str] = None,
        command: Optional[str] = None,
        timeout: float = 300.0,  # 5 minutes default timeout
    ) -> bool:
        """
        Request permission for a tool use.

        This will:
        1. Check if permission is already granted
        2. If not, create a request and wait for user response
        3. Store the result based on the scope

        Args:
            session_id: Session identifier
            tool: Type of tool being used
            description: Human-readable description
            path: File path (for read/write tools)
            command: Command string (for bash tool)
            timeout: How long to wait for response

        Returns:
            True if allowed, False if denied
        """
        # Check existing permission
        existing = self.check_permission(session_id, tool, path)
        if existing is not None:
            return existing

        # Create new request
        request_id = str(uuid.uuid4())
        request = PermissionRequest(
            id=request_id,
            session_id=session_id,
            tool=tool,
            description=description,
            path=path,
            command=command,
        )

        self.pending_requests[request_id] = request
        self.request_events[request_id] = asyncio.Event()

        # Notify client via callback
        callback = self.request_callbacks.get(session_id)
        if callback:
            try:
                await callback({
                    "type": "permission_request",
                    "request_id": request_id,
                    "tool": tool.value,
                    "description": description,
                    "path": path,
                    "command": command,
                })
            except Exception as e:
                print(f"Error sending permission request: {e}")

        # Wait for response
        try:
            await asyncio.wait_for(
                self.request_events[request_id].wait(),
                timeout=timeout,
            )
            return self.request_results.pop(request_id, False)
        except asyncio.TimeoutError:
            # Timeout - treat as denied
            return False
        finally:
            # Cleanup
            self.pending_requests.pop(request_id, None)
            self.request_events.pop(request_id, None)

    def resolve_permission(
        self,
        request_id: str,
        allowed: bool,
        scope: PermissionScope,
    ):
        """
        Resolve a pending permission request.

        Args:
            request_id: Request identifier
            allowed: Whether the action is allowed
            scope: How long the permission should be remembered
        """
        request = self.pending_requests.get(request_id)
        if not request:
            return

        # Store result
        self.request_results[request_id] = allowed

        # Store permission based on scope
        if scope in (PermissionScope.SESSION, PermissionScope.ALWAYS):
            session_id = request.session_id
            if session_id not in self.session_permissions:
                self.session_permissions[session_id] = {}

            key = self._get_permission_key(request.tool, request.path)
            self.session_permissions[session_id][key] = allowed

        # Signal the waiting coroutine
        event = self.request_events.get(request_id)
        if event:
            event.set()

    def clear_session_permissions(self, session_id: str):
        """Clear all permissions for a session."""
        self.session_permissions.pop(session_id, None)

    def get_pending_requests(self, session_id: str) -> list[PermissionRequest]:
        """Get all pending requests for a session."""
        return [
            r for r in self.pending_requests.values()
            if r.session_id == session_id
        ]


# Singleton instance
permission_service = PermissionService()
