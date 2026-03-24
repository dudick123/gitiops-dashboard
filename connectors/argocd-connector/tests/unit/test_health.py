"""Smoke tests for health endpoints."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from httpx import AsyncClient


async def test_liveness_returns_ok(client: AsyncClient) -> None:
    """Verify /healthz returns 200 with ok status."""
    response = await client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["connector"] == "argocd-connector"


async def test_readiness_returns_ok(client: AsyncClient) -> None:
    """Verify /readyz returns 200 with ok status."""
    response = await client.get("/readyz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
