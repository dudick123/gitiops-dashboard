"""ArgoCD applications route."""

from __future__ import annotations

import os
from datetime import UTC, datetime

from fastapi import APIRouter, Query, Request, Response

from src.models.application import ApplicationStatus
from src.models.error import ErrorResponse
from src.services.argocd_client import ArgocdClient

router = APIRouter()


@router.get(
    "/apps",
    response_model=list[ApplicationStatus],
    responses={502: {"model": ErrorResponse}},
)
async def get_applications(
    request: Request,
    project: str | None = Query(default=None, description="Filter by ArgoCD project"),
) -> list[ApplicationStatus] | Response:
    """List ArgoCD applications, optionally filtered by project.

    Checks Redis cache first. On miss, calls ArgoCD client and caches result.
    On upstream error, returns stale cache if available, else 502.
    """
    env = os.environ.get("ARGOCD_ENV", "unknown")
    region = os.environ.get("ARGOCD_REGION", "unknown")
    cache_key = f"argocd:{env}:{region}:apps"
    if project:
        cache_key += f":{project}"

    # Check cache
    cache = getattr(request.app.state, "cache", None)
    if cache:
        cached = await cache.get(cache_key)
        if cached is not None:
            return Response(content=cached, media_type="application/json")

    # Cache miss — call service
    try:
        client = ArgocdClient()
        apps = await client.get_applications(project=project)
    except Exception:
        # Try stale cache on error
        if cache:
            stale = await cache.get(cache_key)
            if stale is not None:
                return Response(content=stale, media_type="application/json")
        error = ErrorResponse(
            error="upstream_unavailable",
            detail="ArgoCD API is unreachable and no cached data is available.",
            connector="argocd-connector",
            timestamp=datetime.now(UTC),
        )
        return Response(
            content=error.model_dump_json(),
            status_code=502,
            media_type="application/json",
        )

    # Serialize and cache
    data = [app.model_dump() for app in apps]
    from src.cache import RedisCache

    serialized = RedisCache.serialize(data)
    if cache:
        await cache.set(cache_key, serialized)

    return apps
