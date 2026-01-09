#!/bin/bash
set -e

echo "Initializing Claude Code credentials..."

# Create Claude config directory
mkdir -p /root/.claude

# Method 1: Write credentials from environment variable (for Railway/cloud)
if [ -n "$CLAUDE_CREDENTIALS_JSON" ]; then
    echo "$CLAUDE_CREDENTIALS_JSON" > /root/.claude/.credentials.json
    echo "Claude credentials initialized from environment variable"
fi

# Method 2: Write settings from environment variable
if [ -n "$CLAUDE_SETTINGS_JSON" ]; then
    echo "$CLAUDE_SETTINGS_JSON" > /root/.claude/settings.json
    echo "Claude settings initialized from environment variable"
fi

# Create default settings if not provided (for unattended operation)
if [ ! -f /root/.claude/settings.json ]; then
    cat > /root/.claude/settings.json << 'EOF'
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Edit(*)",
      "Write(*)",
      "Read(*)",
      "Glob(*)",
      "Grep(*)",
      "WebFetch(*)"
    ],
    "deny": []
  }
}
EOF
    echo "Created default Claude settings for unattended operation"
fi

# Verify Claude CLI is available
if command -v claude &> /dev/null; then
    echo "Claude CLI found: $(which claude)"

    # Check auth status (non-blocking)
    if claude auth status 2>/dev/null | grep -q "authenticated"; then
        echo "Claude is authenticated"
    else
        echo "Warning: Claude may not be authenticated. Ensure credentials are provided."
    fi
else
    echo "Warning: Claude CLI not found in PATH"
fi

echo "Starting application..."

# Execute the main command
exec "$@"
