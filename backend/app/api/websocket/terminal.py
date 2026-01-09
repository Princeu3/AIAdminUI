"""WebSocket endpoint for Claude chat."""
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.claude_service import claude_service

router = APIRouter()


class ChatConnection:
    """Manages a single WebSocket chat connection."""

    def __init__(self, websocket: WebSocket, session_id: str):
        self.websocket = websocket
        self.session_id = session_id

    async def send_response(self, response: str):
        """Send Claude response to WebSocket client."""
        try:
            await self.websocket.send_json({
                "type": "response",
                "content": response
            })
        except Exception:
            pass

    async def handle(self):
        """Main WebSocket handling loop."""
        # Subscribe to Claude responses
        claude_service.subscribe(self.session_id, self.send_response)

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

                elif msg_type == "ping":
                    await self.websocket.send_json({"type": "pong"})

        except WebSocketDisconnect:
            pass
        finally:
            claude_service.unsubscribe(self.session_id, self.send_response)

    async def _handle_user_message(self, data: dict):
        """Handle user message - send to Claude and return response."""
        content = data.get("content", "").strip()

        if not content:
            await self.websocket.send_json({
                "type": "error",
                "content": "Empty message"
            })
            return

        # Send typing indicator
        await self.websocket.send_json({"type": "typing", "status": True})

        try:
            # Send message to Claude (response is sent via subscriber callback)
            await claude_service.send_message(
                self.session_id,
                content
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
