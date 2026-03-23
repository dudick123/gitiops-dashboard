---
reviewer: Senior Kubernetes and ArgoCD Engineer
proposal: repo-scaffolding
date: 2026-03-23
status: Review Complete
---

# Senior Kubernetes and ArgoCD Engineer -- Review: repo-scaffolding

## Summary

The repo-scaffolding proposal establishes the monorepo skeleton for the GitOps Dashboard. From a Kubernetes and ArgoCD deployment perspective, the proposal covers local development orchestration (Docker Compose) and basic project structure, but has significant gaps in container hardening, health endpoint specification, and preparation for production K8s deployment. The Dockerfiles as described do not meet the container security standards in TECH-STANDARDS.md section 12.6, and the health endpoint tasks lack the specificity needed to satisfy the probe configuration requirements in section 13.4. Several of these gaps are explicitly deferred to later proposals (PROP-00C for the deploy repo), but some hardening measures belong in the Dockerfiles and application scaffolding created here, not in a future proposal.

## Critical Findings

### Finding K8S-1: Dockerfiles lack container hardening required by section 12.6

- **Artifact**: tasks.md
- **Location**: Tasks 2.5, 3.5, 4.5, 5.12
- **Issue**: The Dockerfile tasks specify only "python:3.14-slim base, pip install, uvicorn entrypoint" for connectors and "multi-stage Node to nginx" for frontend. There is no mention of: digest-pinned base images, creating a non-root user (UID 1000), setting `USER` directive, ensuring `readOnlyRootFilesystem` compatibility (writable `/tmp`), or dropping capabilities via Dockerfile conventions. TECH-STANDARDS section 12.6 requires digest-pinned base images (`python:3.14-slim@sha256:...`), non-root execution, and minimal final images with no compilers or build tools.
- **Impact**: Dockerfiles built from these tasks will fail Hadolint CI checks (section 12.7) and will need rework before any image can be deployed to AKS. The `securityContext` in K8s Deployments enforces `runAsNonRoot: true` and `runAsUser: 1000` -- containers built without a matching USER directive will fail to start with `CrashLoopBackOff`.
- **Recommendation**: Amend tasks 2.5, 3.5, 4.5, and 5.12 to explicitly require: (1) digest-pinned base images with a comment for the digest value to be filled in, (2) `RUN addgroup --system --gid 1000 app && adduser --system --uid 1000 --gid 1000 app` or equivalent, (3) `USER 1000` directive before the entrypoint, (4) `EXPOSE` with the correct port (>1024), (5) for connectors, a multi-stage build where the final stage copies only the virtual environment and application code. Add a task for a shared `.hadolint.yaml` configuration file to enforce these rules during local development.

### Finding K8S-2: Health endpoints not specified to match K8s probe paths

- **Artifact**: tasks.md
- **Location**: Tasks 2.2, 3.2, 4.2
- **Issue**: Tasks say "minimal FastAPI app (health endpoint only)" but do not specify the endpoint paths. TECH-STANDARDS section 13.4 requires two distinct probe paths: `/healthz` (liveness -- confirms the event loop is responsive, no upstream checks) and `/readyz` (readiness -- confirms upstream connectivity and Redis reachability). The scaffold must create both endpoints with the correct semantics from the start, not a single generic `/health` endpoint.
- **Impact**: If a single `/health` endpoint is created, it will either need to be split later (breaking existing Docker Compose health checks and any integration tests), or it will conflate liveness and readiness semantics, which the standards explicitly separate. A readiness check that includes upstream dependency checks must not be used as a liveness probe -- a slow upstream would cause unnecessary pod restarts.
- **Recommendation**: Amend tasks 2.2, 3.2, 4.2 to explicitly require: (1) `GET /healthz` returning 200 with `{"status": "ok"}` -- no dependency checks, (2) `GET /readyz` returning 200 when Redis is reachable and 503 otherwise. The scaffold can implement `/readyz` as a stub that always returns 200 (since Redis connectivity logic comes later), but the route must exist at the correct path. Also add a `/healthz` and `/readyz` note to the frontend task (5.12) for the nginx configuration.

### Finding K8S-3: Ruff configuration contradicts TECH-STANDARDS

- **Artifact**: tasks.md, spec.md
- **Location**: Task 1.2, spec Requirement "Ruff configuration targets Python 3.14"
- **Issue**: Three contradictions with TECH-STANDARDS section 1: (1) Task 1.2 specifies creating a standalone `ruff.toml` file, but section 1 states "All Ruff configuration lives in `pyproject.toml` under `[tool.ruff]`. No `ruff.toml` or `.ruff.toml` files." (2) Task 1.2 specifies line-length 100, but section 1 states line-length 99. (3) Task 1.2 specifies rule sets E/F/I/UP, but section 1 requires a much broader set: E, F, W, I, UP, S, B, A, C4, PT, SIM, TCH, DTZ, PIE, RSE, RET, FBT, ASYNC, RUF.
- **Impact**: If implemented as specified, the scaffold will immediately violate the project's own tech standards. The missing rule sets (particularly S for security and B for bug detection) mean security linting would not be active from the start.
- **Recommendation**: Amend task 1.2 to: (1) configure Ruff in each connector's `pyproject.toml` under `[tool.ruff]` instead of a standalone `ruff.toml`, (2) use line-length 99, (3) enable the full rule set from TECH-STANDARDS section 1. If a shared configuration is desired, use a root-level `pyproject.toml` with `[tool.ruff]` section that per-connector `pyproject.toml` files inherit from (Ruff supports hierarchical configuration discovery).

### Finding K8S-4: Docker Compose port mapping inconsistent with production probe port

- **Artifact**: tasks.md
- **Location**: Task 7.3
- **Issue**: Docker Compose maps connectors to ports 8001 (argocd), 8002 (prometheus), 8003 (network). However, TECH-STANDARDS section 13.4 defines all probe paths against port 8080. The Ingress in section 13.15 also routes to port 8080 for the frontend Service. The scaffold should establish the internal container port as 8080 for all services (matching the K8s probe and Service definitions), with Docker Compose mapping to different host ports for local access.
- **Impact**: Developers will write code assuming uvicorn listens on port 8001/8002/8003. When deploying to K8s where all containers listen on 8080 (with Services and probes configured accordingly), port configuration must be changed. This creates a local-vs-production divergence that could cause confusion and bugs.
- **Recommendation**: Configure all connector containers to listen on port 8080 internally (matching the K8s probe and Service configuration). Use Docker Compose port mapping to expose different host ports: `8001:8080`, `8002:8080`, `8003:8080`. The uvicorn entrypoint should use `--port 8080` in all environments, with an environment variable override for flexibility.

## Recommendations

### Recommendation K8S-1: Add .dockerignore files

Each service directory should include a `.dockerignore` file that excludes `tests/`, `__pycache__/`, `.venv/`, `*.pyc`, `.git/`, and `node_modules/` (for frontend). This reduces Docker build context size, speeds up builds, and prevents accidental inclusion of test fixtures or local environment files in production images. Add a task for this alongside the Dockerfile tasks.

### Recommendation K8S-2: Add Docker Compose health checks

The `docker-compose.yml` should include health check definitions for each service so that `docker compose up` reports accurate service health and dependent services can use `depends_on` with `condition: service_healthy`. Example for connectors:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/healthz"]
  interval: 10s
  timeout: 3s
  retries: 3
  start_period: 5s
```

This also validates the health endpoints locally before deployment to K8s, where misconfigured probes cause `CrashLoopBackOff`.

### Recommendation K8S-3: Add depends_on ordering to Docker Compose

The `docker-compose.yml` should express service dependencies matching the ArgoCD sync wave ordering from section 13.8: Redis starts first, connectors start after Redis is healthy, frontend starts after connectors are healthy. This mirrors the production startup order and catches dependency issues during local development:

```yaml
services:
  redis:
    # ...
  argocd-connector:
    depends_on:
      redis:
        condition: service_healthy
  frontend:
    depends_on:
      argocd-connector:
        condition: service_healthy
```

### Recommendation K8S-4: Document the deploy repo relationship explicitly

The design.md non-goals mention "PROP-00C (separate deploy repo)" once, but the proposal should include a dedicated section in `design.md` or a note in `proposal.md` clarifying the boundary between the application repo (this repo) and the deploy repo (`gitops-dashboard-deploy`). Specifically: (1) this repo owns Dockerfiles and application code, (2) the deploy repo owns Kustomize bases/overlays, ArgoCD Application/AppProject manifests, ExternalSecret definitions, and all K8s manifests, (3) the CI pipeline bridges the two by building images from this repo and updating image references in the deploy repo. Without this documentation, developers may wonder where K8s manifests should go.

### Recommendation K8S-5: Add SIGTERM handling stub in connector scaffold

TECH-STANDARDS section 13.5 requires graceful shutdown via FastAPI lifespan. The scaffold `main.py` should include the lifespan context manager pattern from the start:

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize clients
    yield
    # Shutdown: close clients, drain connections
```

This establishes the pattern that connector implementation proposals will fill in, rather than requiring a refactor of the app initialization later.

### Recommendation K8S-6: Consider adding a Makefile target for Hadolint

TECH-STANDARDS section 12.7 mandates Hadolint in CI. Adding a `make lint-docker` target that runs Hadolint against all Dockerfiles enables local validation before push. This is inexpensive to add during scaffolding and catches hardening violations early.

### Recommendation K8S-7: Add environment variable documentation for connector configuration

Each connector's scaffold should include a `.env.example` file documenting the environment variables the container expects. This serves as documentation for Docker Compose (which can use `env_file`), mirrors the ESO ExternalSecret data keys from section 13.9, and ensures the local dev environment closely matches production configuration injection. Variables should include at minimum: `REDIS_URL`, `LOG_LEVEL`, `SERVICE_NAME`, `ENVIRONMENT`, and connector-specific upstream URLs.

## Observations

1. **Simplified topology is acceptable for Phase 0.** The decision to run one instance per connector type in Docker Compose (vs the full 3+1+6 production topology) is pragmatic. The proposal correctly identifies this as a trade-off. However, a `docker-compose.override.yml` or `docker-compose.full.yml` should be considered in a future proposal to enable multi-instance testing when environment-specific behavior needs local validation.

2. **Redis no-persistence is correctly specified.** The `--save ""` flag with no volume mount matches TECH-STANDARDS section 13.10 which sets `persistentvolumeclaims: 0` at the namespace level. This is consistent.

3. **The "health endpoint only" approach is the right starting point.** Scaffolding connectors with health endpoints and nothing else aligns with the principle of incremental delivery. The key concern is getting the endpoint paths right from the start (see Finding K8S-2).

4. **No `.hadolint.yaml` or Dockerfile linting in the scaffold.** While CI pipeline definition is out of scope, the Hadolint configuration file could be included to enable local linting. This is a minor gap.

5. **The proposal does not address `automountServiceAccountToken`.** While this is a K8s Deployment-level concern (deploy repo), the scaffold could include a comment in the Dockerfile or a note in a README indicating that production deployments must set `automountServiceAccountToken: false` for all containers except network-connector.

6. **Frontend nginx configuration is unspecified.** Task 5.12 mentions a multi-stage build producing an nginx image, but does not mention a custom `nginx.conf`. The production frontend requires specific proxy timeouts, TLS settings, and health check endpoints per TECH-STANDARDS section 13.15. The scaffold should include a minimal `nginx.conf` that serves static assets and includes a `/healthz` location returning 200.

## Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| 12.6 Container hardening -- digest-pinned images | Not Met | Tasks specify mutable tag `python:3.14-slim`, not digest-pinned |
| 12.6 Container hardening -- non-root user | Not Met | No USER directive or user creation mentioned in Dockerfile tasks |
| 12.6 Container hardening -- minimal final image | Partial | Frontend multi-stage mentioned; connectors appear single-stage |
| 12.7 CI Security -- Hadolint | Not Addressed | No Hadolint config; pipeline is out of scope but config file is not |
| 13.1 Label schema | Not Applicable | Labels apply to K8s manifests in deploy repo, not application repo |
| 13.4 Probe endpoints (/healthz, /readyz) | Partial | Health endpoint mentioned but paths and dual-endpoint pattern not specified |
| 13.5 Graceful shutdown (lifespan) | Not Addressed | No lifespan pattern in connector scaffold |
| 13.6 Resource requests/limits | Not Applicable | Deploy repo concern |
| 13.7 PodDisruptionBudgets | Not Applicable | Deploy repo concern |
| 13.8 Sync wave ordering | Not Addressed | Docker Compose does not express service dependency ordering |
| 13.9 HPA | Not Applicable | Deploy repo concern |
| 13.9 ESO ExternalSecret | Not Applicable | Deploy repo concern, but env var naming should be established here |
| 13.11 Image registry/tagging | Not Addressed | No ACR repository naming or tagging convention in scaffold |
| 13.12 Kustomize conventions | Not Applicable | Explicitly deferred to PROP-00C |
| 13.13 ArgoCD AppProject | Not Applicable | Deploy repo concern |
| 13.14 ArgoCD Application | Not Applicable | Deploy repo concern |
| 13.15 Ingress | Not Applicable | Deploy repo concern, but nginx.conf should be scaffolded here |
| 1.0 Ruff configuration | Not Met | ruff.toml contradicts pyproject.toml requirement; line-length and rule sets do not match |
