"""Redis cache client.

TECH-STANDARDS §4 — Uniform 30-minute TTL across all connectors.
TECH-STANDARDS §12.4 — Pydantic SecretStr for credentials.
TECH-STANDARDS §12.5 — Redis authentication required.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import orjson
from pydantic import SecretStr  # noqa: TC002 — required at runtime by Pydantic
from pydantic_settings import BaseSettings

if TYPE_CHECKING:
    import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS: int = 1800  # 30 minutes — uniform across all connectors


class RedisSettings(BaseSettings):
    """Redis connection configuration."""

    url: str = "redis://localhost:6379/0"
    password: SecretStr | None = None

    class Config:
        env_prefix = "REDIS_"


redis_settings = RedisSettings()


class RedisCache:
    """Async Redis cache with orjson serialization."""

    def __init__(self, client: aioredis.Redis) -> None:
        self._client = client

    async def get(self, key: str) -> bytes | None:
        """Get cached value. Returns None on miss or error."""
        try:
            result: bytes | None = await self._client.get(key)
            return result
        except Exception:
            logger.warning("Redis GET failed for key=%s", key, exc_info=True)
            return None

    async def set(
        self, key: str, value: bytes, ttl: int = CACHE_TTL_SECONDS
    ) -> None:
        """Set cached value with TTL. Logs warning on error."""
        try:
            await self._client.set(key, value, ex=ttl)
        except Exception:
            logger.warning("Redis SET failed for key=%s", key, exc_info=True)

    @staticmethod
    def serialize(data: list[dict[str, object]]) -> bytes:
        """Serialize data to bytes using orjson."""
        return orjson.dumps(data)

    @staticmethod
    def deserialize(data: bytes) -> list[dict[str, object]]:
        """Deserialize bytes to data using orjson."""
        result: list[dict[str, object]] = orjson.loads(data)
        return result
