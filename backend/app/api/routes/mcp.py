"""MCP (Model Context Protocol) API routes."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.services.mcp_service import mcp_service, MCPServerType

router = APIRouter(prefix="/mcp", tags=["mcp"])


class MCPServerCreate(BaseModel):
    """Request model for creating an MCP server."""
    name: str
    type: str  # "stdio" or "sse"
    command: Optional[list[str]] = None
    url: Optional[str] = None
    args: Optional[list[str]] = None
    env: Optional[dict[str, str]] = None


class MCPServerResponse(BaseModel):
    """Response model for an MCP server."""
    name: str
    type: str
    command: Optional[list[str]] = None
    url: Optional[str] = None
    args: list[str] = []
    env: dict[str, str] = {}
    enabled: bool = True
    created_at: str


class MCPServerToggle(BaseModel):
    """Request model for toggling a server."""
    enabled: bool


@router.get("/servers")
async def list_servers(user_id: str):
    """List all MCP servers for a user."""
    servers = mcp_service.list_servers(user_id)
    return {
        "servers": [
            MCPServerResponse(
                name=s.name,
                type=s.type.value,
                command=s.command,
                url=s.url,
                args=s.args,
                env=s.env,
                enabled=s.enabled,
                created_at=s.created_at.isoformat(),
            )
            for s in servers
        ]
    }


@router.post("/servers")
async def add_server(user_id: str, server: MCPServerCreate):
    """Add a new MCP server configuration."""
    # Validate type
    try:
        server_type = MCPServerType(server.type)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid server type: {server.type}. Must be 'stdio' or 'sse'."
        )

    # Validate required fields based on type
    if server_type == MCPServerType.STDIO and not server.command:
        raise HTTPException(
            status_code=400,
            detail="Command is required for stdio type servers."
        )
    if server_type == MCPServerType.SSE and not server.url:
        raise HTTPException(
            status_code=400,
            detail="URL is required for sse type servers."
        )

    mcp_server = mcp_service.add_server(
        user_id=user_id,
        name=server.name,
        server_type=server_type,
        command=server.command,
        url=server.url,
        args=server.args,
        env=server.env,
    )

    return {
        "message": "Server added successfully",
        "server": MCPServerResponse(
            name=mcp_server.name,
            type=mcp_server.type.value,
            command=mcp_server.command,
            url=mcp_server.url,
            args=mcp_server.args,
            env=mcp_server.env,
            enabled=mcp_server.enabled,
            created_at=mcp_server.created_at.isoformat(),
        )
    }


@router.delete("/servers/{name}")
async def remove_server(user_id: str, name: str):
    """Remove an MCP server configuration."""
    if not mcp_service.remove_server(user_id, name):
        raise HTTPException(status_code=404, detail="Server not found")
    return {"message": "Server removed successfully"}


@router.patch("/servers/{name}/toggle")
async def toggle_server(user_id: str, name: str, toggle: MCPServerToggle):
    """Enable or disable an MCP server."""
    if not mcp_service.toggle_server(user_id, name, toggle.enabled):
        raise HTTPException(status_code=404, detail="Server not found")
    return {"message": f"Server {'enabled' if toggle.enabled else 'disabled'} successfully"}


@router.get("/servers/{name}")
async def get_server(user_id: str, name: str):
    """Get a specific MCP server configuration."""
    server = mcp_service.get_server(user_id, name)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    return MCPServerResponse(
        name=server.name,
        type=server.type.value,
        command=server.command,
        url=server.url,
        args=server.args,
        env=server.env,
        enabled=server.enabled,
        created_at=server.created_at.isoformat(),
    )


@router.get("/presets")
async def get_presets():
    """Get list of preset MCP server configurations."""
    return {"presets": mcp_service.get_preset_servers()}


@router.get("/config")
async def get_config(user_id: str):
    """Get the generated MCP config for a user."""
    config = mcp_service.generate_config(user_id)
    return {"config": config}
