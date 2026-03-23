"""Redis cache client.

TECH-STANDARDS §4 — Uniform 30-minute TTL across all connectors.
TECH-STANDARDS §12.4 — Pydantic SecretStr for credentials.
TECH-STANDARDS §12.5 — Redis authentication required.
"""

from pydantic import SecretStr
from pydantic_settings import BaseSettings


class RedisSettings(BaseSettings):
    """Redis connection configuration."""

    url: str = "redis://localhost:6379/0"
    password: SecretStr | None = None

    class Config:
        env_prefix = "REDIS_"


CACHE_TTL_SECONDS: int = 1800  # 30 minutes — uniform across all connectors

redis_settings = RedisSettings()
