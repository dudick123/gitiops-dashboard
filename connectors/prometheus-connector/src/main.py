"""Prometheus Connector — GitOps Dashboard."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.trustedhost import TrustedHostMiddleware

from src.logging_config import configure_logging

# Configure structured logging at import time
configure_logging(connector="prometheus-connector")

# TECH-STANDARDS §12.1 — CORS origin from env var
import os

CORS_ALLOWED_ORIGIN: str = os.environ.get(
    "CORS_ALLOWED_ORIGIN", "http://localhost:3000"
)


class HealthResponse(BaseModel):
    """Health check response per TECH-STANDARDS §4."""

    status: Literal["ok", "degraded"]
    connector: str
    environment: str
    region: str
    checks: dict[str, str]
    timestamp: datetime


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage startup/shutdown lifecycle per TECH-STANDARDS §4."""
    # TODO: Initialize httpx.AsyncClient for Azure Monitor Workspace, Redis connection pool
    import structlog
    log = structlog.get_logger()
    await log.ainfo("prometheus-connector starting")
    yield
    await log.ainfo("prometheus-connector shutting down")


app = FastAPI(
    title="Prometheus Connector API",
    version="0.1.0",
    description="Queries Azure Monitor Workspace for Prometheus metrics.",
    lifespan=lifespan,
)

# TECH-STANDARDS §12.1 — CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[CORS_ALLOWED_ORIGIN],
    allow_methods=["GET"],
    allow_headers=["Authorization", "X-Request-ID"],
    allow_credentials=False,
    max_age=3600,
)

# TECH-STANDARDS §12.8 — Trusted Host
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(","),
)


@app.get("/healthz", response_model=HealthResponse)
async def liveness() -> HealthResponse:
    """Liveness probe — process is running, event loop responsive."""
    return HealthResponse(
        status="ok",
        connector="prometheus-connector",
        environment=os.environ.get("PROMETHEUS_ENV", "unknown"),
        region=os.environ.get("PROMETHEUS_REGION", "unknown"),
        checks={"upstream": "ok", "redis": "ok"},
        timestamp=datetime.now(UTC),
    )


@app.get("/readyz", response_model=HealthResponse)
async def readiness() -> HealthResponse:
    """Readiness probe — upstream Azure Monitor Workspace and Redis reachable."""
    # TODO: Actually check Azure Monitor Workspace API and Redis connectivity
    return HealthResponse(
        status="ok",
        connector="prometheus-connector",
        environment=os.environ.get("PROMETHEUS_ENV", "unknown"),
        region=os.environ.get("PROMETHEUS_REGION", "unknown"),
        checks={"upstream": "ok", "redis": "ok"},
        timestamp=datetime.now(UTC),
    )
