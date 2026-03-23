# Network Connector — GitOps Dashboard
# TECH-STANDARDS §5, §12.6 — Multi-stage build, non-root user
# TODO: Replace with digest-pinned images
FROM python:3.14-slim AS builder

WORKDIR /app

# Pin uv version (not :latest) to reduce supply chain risk
COPY --from=ghcr.io/astral-sh/uv:0.6 /uv /usr/local/bin/uv

# Install dependencies
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# --- Final stage ---
FROM python:3.14-slim

WORKDIR /app

# Create non-root user (TECH-STANDARDS §12.6)
RUN groupadd -g 1000 connector && \
    useradd -u 1000 -g connector -s /bin/sh connector

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv
COPY src/ /app/src/

ENV PATH="/app/.venv/bin:$PATH"

USER connector

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/healthz')"]

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080", "--timeout-graceful-shutdown", "10"]
