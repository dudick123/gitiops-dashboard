"""ArgoCD application status models."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class ApplicationStatus(BaseModel):
    """Single ArgoCD application status record."""

    model_config = ConfigDict(frozen=True)

    name: str
    project: str
    environment: str
    region: str
    health: Literal[
        "Healthy", "Degraded", "Progressing", "Suspended", "Missing", "Unknown"
    ]
    sync: Literal["Synced", "OutOfSync", "Unknown"]
    images: list[str]
