"""Shared test fixtures.

TECH-STANDARDS §8 — AsyncClient with ASGITransport for testing FastAPI routes.
"""

import sys
from collections.abc import AsyncIterator
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

# Ensure src/ is importable regardless of working directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.main import app


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    """Async test client for FastAPI routes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_redis() -> AsyncMock:
    """Mock Redis client for unit tests."""
    redis = AsyncMock()
    redis.get = AsyncMock(return_value=None)
    redis.set = AsyncMock(return_value=True)
    redis.delete = AsyncMock(return_value=1)
    return redis
