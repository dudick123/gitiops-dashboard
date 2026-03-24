"""TDD tests for /apps endpoint — written before implementation."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from httpx import AsyncClient


async def test_apps_returns_list_of_applications(client: AsyncClient) -> None:
    """GET /apps returns 200 with a list of applications."""
    response = await client.get("/apps")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0


async def test_apps_filters_by_project(client: AsyncClient) -> None:
    """GET /apps?project=auth-service returns only that project's apps."""
    response = await client.get("/apps?project=auth-service")
    assert response.status_code == 200
    data = response.json()
    assert all(app["project"] == "auth-service" for app in data)


async def test_apps_returns_empty_for_unknown_project(client: AsyncClient) -> None:
    """GET /apps?project=nonexistent returns empty list."""
    response = await client.get("/apps?project=nonexistent")
    assert response.status_code == 200
    data = response.json()
    assert data == []
