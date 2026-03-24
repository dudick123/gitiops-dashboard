"""Error response model."""

from __future__ import annotations

from datetime import datetime  # noqa: TC003 — required at runtime by Pydantic

from pydantic import BaseModel, ConfigDict


class ErrorResponse(BaseModel):
    """Consistent error response per TECH-STANDARDS §4."""

    model_config = ConfigDict(frozen=True)

    error: str
    detail: str
    connector: str
    timestamp: datetime
