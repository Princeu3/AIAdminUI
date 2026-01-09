"""MCP (Model Context Protocol) service for managing MCP server connections."""
import json
import os
import tempfile
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pathlib import Path


class MCPServerType(str, Enum):
    STDIO = "stdio"
    SSE = "sse"


@dataclass
class MCPServer:
    """Represents an MCP server configuration."""
    name: str
    type: MCPServerType
    command: Optional[list[str]] = None  # For stdio type
    url: Optional[str] = None  # For SSE type
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    enabled: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result: dict[str, Any] = {
            "type": self.type.value,
        }

        if self.type == MCPServerType.STDIO:
            if self.command:
                result["command"] = self.command[0]
                result["args"] = self.command[1:] + self.args
        elif self.type == MCPServerType.SSE:
            result["url"] = self.url

        if self.env:
            result["env"] = self.env

        return result


class MCPService:
    """
    Manages MCP server configurations.

    This service:
    1. Stores MCP server configurations
    2. Generates MCP config files for Claude CLI
    3. Validates server configurations
    """

    def __init__(self):
        # Server configs stored per user
        self.servers: dict[str, dict[str, MCPServer]] = {}
        # Config file paths per session
        self.config_files: dict[str, str] = {}

    def add_server(
        self,
        user_id: str,
        name: str,
        server_type: MCPServerType,
        command: Optional[list[str]] = None,
        url: Optional[str] = None,
        args: Optional[list[str]] = None,
        env: Optional[dict[str, str]] = None,
    ) -> MCPServer:
        """
        Add or update an MCP server configuration.

        Args:
            user_id: User identifier
            name: Server name (unique per user)
            server_type: Type of server (stdio or sse)
            command: Command to run (for stdio type)
            url: Server URL (for sse type)
            args: Additional arguments
            env: Environment variables

        Returns:
            MCPServer instance
        """
        if user_id not in self.servers:
            self.servers[user_id] = {}

        server = MCPServer(
            name=name,
            type=server_type,
            command=command,
            url=url,
            args=args or [],
            env=env or {},
        )

        self.servers[user_id][name] = server
        return server

    def remove_server(self, user_id: str, name: str) -> bool:
        """
        Remove an MCP server configuration.

        Returns:
            True if removed, False if not found
        """
        if user_id in self.servers and name in self.servers[user_id]:
            del self.servers[user_id][name]
            return True
        return False

    def get_server(self, user_id: str, name: str) -> Optional[MCPServer]:
        """Get a specific server configuration."""
        return self.servers.get(user_id, {}).get(name)

    def list_servers(self, user_id: str) -> list[MCPServer]:
        """List all servers for a user."""
        return list(self.servers.get(user_id, {}).values())

    def toggle_server(self, user_id: str, name: str, enabled: bool) -> bool:
        """
        Enable or disable a server.

        Returns:
            True if toggled, False if not found
        """
        server = self.get_server(user_id, name)
        if server:
            server.enabled = enabled
            return True
        return False

    def generate_config(self, user_id: str) -> dict[str, Any]:
        """
        Generate MCP configuration dictionary for Claude CLI.

        Returns:
            MCP config dict compatible with Claude's --mcp-config
        """
        servers = self.list_servers(user_id)
        enabled_servers = [s for s in servers if s.enabled]

        config = {
            "mcpServers": {
                server.name: server.to_dict()
                for server in enabled_servers
            }
        }

        return config

    def generate_config_file(self, user_id: str, session_id: str) -> str:
        """
        Generate a temporary MCP config file for a session.

        Returns:
            Path to the config file
        """
        config = self.generate_config(user_id)

        # Create a temp file that persists for the session
        config_dir = Path(tempfile.gettempdir()) / "claude_mcp_configs"
        config_dir.mkdir(exist_ok=True)

        config_path = config_dir / f"{session_id}.json"
        config_path.write_text(json.dumps(config, indent=2))

        self.config_files[session_id] = str(config_path)
        return str(config_path)

    def cleanup_config_file(self, session_id: str):
        """Remove the config file for a session."""
        if session_id in self.config_files:
            config_path = Path(self.config_files[session_id])
            if config_path.exists():
                config_path.unlink()
            del self.config_files[session_id]

    def get_config_path(self, session_id: str) -> Optional[str]:
        """Get the config file path for a session."""
        return self.config_files.get(session_id)

    # Pre-configured popular MCP servers
    @staticmethod
    def get_preset_servers() -> list[dict[str, Any]]:
        """Get list of preset MCP server configurations."""
        return [
            {
                "name": "filesystem",
                "description": "Access local filesystem",
                "type": "stdio",
                "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem"],
                "args": [],
            },
            {
                "name": "github",
                "description": "Interact with GitHub repositories",
                "type": "stdio",
                "command": ["npx", "-y", "@modelcontextprotocol/server-github"],
                "env_required": ["GITHUB_PERSONAL_ACCESS_TOKEN"],
            },
            {
                "name": "postgres",
                "description": "Query PostgreSQL databases",
                "type": "stdio",
                "command": ["npx", "-y", "@modelcontextprotocol/server-postgres"],
                "env_required": ["POSTGRES_CONNECTION_STRING"],
            },
            {
                "name": "sqlite",
                "description": "Query SQLite databases",
                "type": "stdio",
                "command": ["npx", "-y", "@modelcontextprotocol/server-sqlite"],
                "args_required": ["database_path"],
            },
            {
                "name": "fetch",
                "description": "Fetch content from URLs",
                "type": "stdio",
                "command": ["npx", "-y", "@modelcontextprotocol/server-fetch"],
            },
            {
                "name": "puppeteer",
                "description": "Browser automation with Puppeteer",
                "type": "stdio",
                "command": ["npx", "-y", "@modelcontextprotocol/server-puppeteer"],
            },
        ]


# Singleton instance
mcp_service = MCPService()
