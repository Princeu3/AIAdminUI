"""WebSocket endpoint for Claude chat."""
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.claude_service import claude_service
from app.services.permission_service import permission_service, PermissionScope

router = APIRouter()


class ChatConnection:
    """Manages a single WebSocket chat connection."""

    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id
        self.use_streaming = True  # Use streaming by default

    async def send_response(self, response: str):
        """Send Claude response to WebSocket client."""
        try:
            await self.websocket.send_json({
                "type": "response",
                "content": response
            })
        except Exception:
            pass

    async def send_event(self, event: dict):
        """Send a streaming event to WebSocket client."""
        try:
            await self.websocket.send_json(event)
        except Exception:
            pass

    async def handle_stream_event(self, event: dict):
        """Handle streaming events from Claude and forward to client."""
        event_type = event.get("type")

        if event_type == "text_delta":
            await self.websocket.send_json({
                "type": "text_delta",
                "content": event.get("content", ""),
            })

        elif event_type == "tool_use_start":
            await self.websocket.send_json({
                "type": "tool_use",
                "status": "running",
                "tool_id": event.get("tool_id"),
                "tool_name": event.get("tool_name"),
            })

        elif event_type == "tool_use_end":
            await self.websocket.send_json({
                "type": "tool_use",
                "status": "completed",
                "tool_id": event.get("tool_id"),
                "tool_name": event.get("tool_name"),
            })

        elif event_type == "complete":
            await self.websocket.send_json({
                "type": "response",
                "content": event.get("content", ""),
                "tool_uses": event.get("tool_uses", []),
            })

        elif event_type == "error":
            await self.websocket.send_json({
                "type": "error",
                "content": event.get("content", "Unknown error"),
            })

    async def handle(self):
        """Main WebSocket handling loop."""
        # Subscribe to Claude responses
        claude_service.subscribe(self.session_id, self.send_response)

        # Register permission callback
        permission_service.register_callback(self.session_id, self.send_event)

        try:
            # Handle incoming messages
            while True:
                try:
                    data = await self.websocket.receive_json()
                except json.JSONDecodeError:
                    await self.websocket.send_json({
                        "type": "error",
                        "content": "Invalid JSON message"
                    })
                    continue

                msg_type = data.get("type")

                if msg_type == "message":
                    await self._handle_user_message(data)

                elif msg_type == "command":
                    await self._handle_command(data)

                elif msg_type == "permission_response":
                    await self._handle_permission_response(data)

                elif msg_type == "ping":
                    await self.websocket.send_json({"type": "pong"})

        except WebSocketDisconnect:
            pass
        finally:
            claude_service.unsubscribe(self.session_id, self.send_response)
            permission_service.unregister_callback(self.session_id)

    async def _handle_user_message(self, data: dict):
        """Handle user message - send to Claude and return response."""
        content = data.get("content", "").strip()
        mode = data.get("mode", "normal")
        use_streaming = data.get("streaming", self.use_streaming)

        if not content:
            await self.websocket.send_json({
                "type": "error",
                "content": "Empty message"
            })
            return

        # Send typing indicator
        await self.websocket.send_json({"type": "typing", "status": True})

        try:
            if use_streaming:
                # Use streaming method with event callbacks
                await claude_service.send_message_streaming(
                    self.session_id,
                    content,
                    mode=mode,
                    event_callback=self.handle_stream_event,
                )
            else:
                # Use non-streaming method (response via subscriber callback)
                await claude_service.send_message(
                    self.session_id,
                    content,
                    mode=mode
                )

        except ValueError as e:
            await self.websocket.send_json({
                "type": "error",
                "content": str(e)
            })

        except RuntimeError as e:
            await self.websocket.send_json({
                "type": "error",
                "content": str(e)
            })

        except Exception as e:
            await self.websocket.send_json({
                "type": "error",
                "content": f"Unexpected error: {str(e)}"
            })

        finally:
            # Clear typing indicator
            await self.websocket.send_json({"type": "typing", "status": False})

    async def _handle_command(self, data: dict):
        """Handle slash command execution."""
        command = data.get("command", "").strip()
        args = data.get("args", [])

        if not command:
            await self.websocket.send_json({
                "type": "command_error",
                "command": "",
                "error": "Empty command"
            })
            return

        try:
            result = await claude_service.execute_command(
                self.session_id,
                command,
                args
            )

            if result.get("success"):
                await self.websocket.send_json({
                    "type": "command_result",
                    "command": command,
                    "success": True,
                    "content": result.get("content", ""),
                    "data": result.get("data")
                })
            else:
                await self.websocket.send_json({
                    "type": "command_error",
                    "command": command,
                    "error": result.get("content", "Command failed")
                })

        except Exception as e:
            await self.websocket.send_json({
                "type": "command_error",
                "command": command,
                "error": str(e)
            })

    async def _handle_permission_response(self, data: dict):
        """Handle permission response from client."""
        request_id = data.get("request_id")
        allowed = data.get("allowed", False)
        scope = data.get("scope", "once")

        if not request_id:
            await self.websocket.send_json({
                "type": "error",
                "content": "Missing request_id in permission response"
            })
            return

        # Map scope string to enum
        scope_map = {
            "once": PermissionScope.ONCE,
            "session": PermissionScope.SESSION,
            "always": PermissionScope.ALWAYS,
        }
        permission_scope = scope_map.get(scope, PermissionScope.ONCE)

        # Resolve the permission request
        permission_service.resolve_permission(request_id, allowed, permission_scope)


@router.websocket("/ws/chat/{session_id}")
async def chat_websocket(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for Claude chat."""

    # Validate session exists
    session = await claude_service.get_session(session_id)
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    # Accept connection
    await websocket.accept()

    try:
        # Send initial connected message
        await websocket.send_json({
            "type": "connected",
            "session_id": session_id,
            "working_dir": session.working_dir
        })

        # Create connection handler
        connection = ChatConnection(websocket, session_id)
        await connection.handle()
    except WebSocketDisconnect:
        # Client disconnected - this is normal, no need to log
        pass
    except Exception as e:
        # Only log unexpected errors
        print(f"WebSocket error: {e}")


# Keep the old endpoint for backwards compatibility during transition
@router.websocket("/ws/terminal/{session_id}")
async def terminal_websocket_legacy(websocket: WebSocket, session_id: str):
    """Legacy WebSocket endpoint - redirects to chat endpoint."""
    await chat_websocket(websocket, session_id)
