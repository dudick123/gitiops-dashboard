"""ArgoCD API client — returns mock data for Methodology POC."""

from __future__ import annotations

from typing import Literal

from src.models.application import ApplicationStatus

HealthType = Literal["Healthy", "Degraded", "Progressing", "Suspended", "Missing", "Unknown"]
SyncType = Literal["Synced", "OutOfSync", "Unknown"]

# Mock data: 48 apps across 3 envs x 2 regions, 3 projects
MOCK_APPLICATIONS: list[ApplicationStatus] = []


def _generate_mock_data() -> list[ApplicationStatus]:
    """Generate mock ArgoCD application data."""
    apps: list[ApplicationStatus] = []
    projects = {
        "platform-infra": ["ingress-controller", "cert-manager", "external-secrets"],
        "auth-service": ["auth-api", "auth-worker"],
        "payment-service": ["payment-api", "payment-webhook", "payment-processor"],
    }
    envs = ["DEV", "STAGE", "PROD"]
    regions = ["eastus", "westus"]
    health_pool: list[HealthType] = [
        "Healthy", "Healthy", "Healthy", "Healthy", "Healthy",
        "Healthy", "Healthy", "Healthy", "Healthy", "Healthy",
        "Healthy", "Healthy", "Healthy", "Healthy",
        "Degraded", "Degraded", "Unknown", "Progressing",
    ]
    sync_pool: list[SyncType] = [
        "Synced", "Synced", "Synced", "Synced", "Synced",
        "Synced", "Synced", "Synced", "Synced", "Synced",
        "Synced", "Synced", "Synced", "Synced", "Synced",
        "OutOfSync", "OutOfSync", "Unknown",
    ]

    idx = 0
    for project, app_names in projects.items():
        for app_name in app_names:
            for env in envs:
                for region in regions:
                    health = health_pool[idx % len(health_pool)]
                    sync = sync_pool[idx % len(sync_pool)]
                    tag = f"1.{idx // 6}.{idx % 6}" if idx % 10 != 0 else "latest"
                    apps.append(
                        ApplicationStatus(
                            name=f"{app_name}-{env.lower()}-{region}",
                            project=project,
                            environment=env,
                            region=region,
                            health=health,
                            sync=sync,
                            images=[f"acr.azurecr.io/{project}/{app_name}:{tag}"],
                        )
                    )
                    idx += 1
    return apps


MOCK_APPLICATIONS = _generate_mock_data()


class ArgocdClient:
    """Client for ArgoCD API. Returns mock data for POC."""

    async def get_applications(
        self,
        project: str | None = None,
    ) -> list[ApplicationStatus]:
        """Return applications, optionally filtered by project."""
        apps = MOCK_APPLICATIONS
        if project:
            apps = [a for a in apps if a.project == project]
        return apps
