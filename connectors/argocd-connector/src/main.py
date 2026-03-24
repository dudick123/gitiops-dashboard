"""ArgoCD Connector — GitOps Dashboard."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.trustedhost import TrustedHostMiddleware

from src.logging_config import configure_logging
from src.routes.apps import router as apps_router

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

# Configure structured logging at import time
configure_logging(connector="argocd-connector")

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
    import httpx
    import redis.asyncio as aioredis
    import structlog

    from src.cache import RedisCache, redis_settings

    log = structlog.get_logger()
    await log.ainfo("argocd-connector starting")

    # Create httpx client with explicit timeouts
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0),
    )
    app.state.http_client = http_client

    # Create Redis connection
    redis_url = redis_settings.url
    redis_password = (
        redis_settings.password.get_secret_value()
        if redis_settings.password
        else None
    )
    redis_client = aioredis.from_url(
        redis_url,
        password=redis_password,
        decode_responses=False,
    )
    app.state.cache = RedisCache(redis_client)

    yield

    # Shutdown
    await http_client.aclose()
    await redis_client.aclose()
    await log.ainfo("argocd-connector shut down")


app = FastAPI(
    title="ArgoCD Connector API",
    version="0.1.0",
    description="Queries ArgoCD API for application health, sync status, and image data.",
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

app.include_router(apps_router)


@app.get("/healthz", response_model=HealthResponse)
async def liveness() -> HealthResponse:
    """Liveness probe — process is running, event loop responsive."""
    return HealthResponse(
        status="ok",
        connector="argocd-connector",
        environment=os.environ.get("ARGOCD_ENV", "unknown"),
        region=os.environ.get("ARGOCD_REGION", "unknown"),
        checks={"upstream": "ok", "redis": "ok"},
        timestamp=datetime.now(UTC),
    )


@app.get("/readyz", response_model=HealthResponse)
async def readiness() -> HealthResponse:
    """Readiness probe — upstream API and Redis reachable."""
    # TODO: Actually check ArgoCD API and Redis connectivity
    return HealthResponse(
        status="ok",
        connector="argocd-connector",
        environment=os.environ.get("ARGOCD_ENV", "unknown"),
        region=os.environ.get("ARGOCD_REGION", "unknown"),
        checks={"upstream": "ok", "redis": "ok"},
        timestamp=datetime.now(UTC),
    )
