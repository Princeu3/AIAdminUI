FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
# Note: Claude CLI requires Node.js runtime
RUN npm install -g @anthropic-ai/claude-code

# Install uv package manager
RUN pip install uv

# Set working directory
WORKDIR /app

# Copy dependency files first (for layer caching)
COPY pyproject.toml uv.lock* ./

# Install Python dependencies
RUN uv sync --frozen --no-dev || uv sync --no-dev

# Copy application code
COPY . .

# Copy init script
COPY scripts/init-claude.sh /init-claude.sh
RUN chmod +x /init-claude.sh

# Create directories
RUN mkdir -p /app/repos /app/data /root/.claude

# Environment variables for unattended operation
ENV CLAUDE_CODE_BYPASS_ALL_PERMISSIONS=1
ENV REPOS_BASE_PATH=/app/repos
ENV PATH="/root/.npm-global/bin:$PATH"

# Expose port
EXPOSE 8000

# Use init script as entrypoint
ENTRYPOINT ["/init-claude.sh"]
CMD ["sh", "-c", "uv run uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
