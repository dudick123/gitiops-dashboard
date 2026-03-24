## Why

The project has invested heavily in methodology — PRD (v2.1), TECH-STANDARDS (v1.5, ~2,000 lines), OpenSpec workflow, 6-discipline review process, and 2 custom review skills. The repo scaffold is complete but has never been validated end-to-end: `make lint`, `make typecheck`, `make test`, and `docker build` have not been run. The post-implementation reviews identified real bugs (broken imports, missing dependencies, empty lifespan functions) that remain unfixed in some areas.

Before committing to a 15-week, 4-phase build producing 12 deployable services, the team needs proof that the methodology actually produces a **working, tested, standards-compliant artifact** — not just documents about how to produce one. This is the Methodology POC gate defined in PRD §12.

The POC builds the narrowest possible vertical slice that exercises every layer of the stack and every step of the OpenSpec lifecycle. If it works, the team has confidence. If it doesn't, the team knows exactly what needs adjusting before scaling up.

## What Changes

- Implement argocd-connector `/healthz`, `/readyz`, and `/apps` endpoints with mock ArgoCD data (no live ArgoCD API — mock responses via httpx MockTransport in tests, static data in the endpoint for demo)
- Wire the FastAPI lifespan with httpx.AsyncClient (connection pool) and redis.asyncio (cache pool)
- Implement Redis caching on `/apps` with 30-minute TTL using orjson serialization
- Add Pydantic v2 response models (ApplicationStatus, HealthResponse) with ConfigDict, frozen=True
- Configure structlog with scrub_secrets processor, called at startup
- Add CORS middleware, TrustedHostMiddleware per TECH-STANDARDS §12
- Write TDD tests: health endpoint smoke tests, `/apps` cache hit/miss tests, error handling tests
- Validate the full CI toolchain: `make lint` (ruff 19 rules), `make typecheck` (mypy --strict), `make test` (pytest 90%+ coverage)
- Validate Docker build: `docker build && docker run` serves `/healthz` (200) and `/apps` (mock data)
- Exercise the full OpenSpec lifecycle: this proposal → discipline review → implement → post-impl review → archive

## Capabilities

### New Capabilities

- `argocd-apps-endpoint`: The `/apps` endpoint on the argocd-connector returning a list of ArgoCD Application status records. Supports optional `?project=` query parameter for filtering. Returns Pydantic models with health, sync, destination, and image summary fields matching PRD §4.3.

### Modified Capabilities

(none)

## Impact

- **connectors/argocd-connector/src/main.py**: Major — lifespan populated, middleware added, `/apps` endpoint implemented
- **connectors/argocd-connector/src/routes/apps.py**: New — `/apps` route handler with Redis caching
- **connectors/argocd-connector/src/models/application.py**: New — Pydantic response models
- **connectors/argocd-connector/src/services/argocd_client.py**: New — httpx-based ArgoCD API client (returns mock data for POC)
- **connectors/argocd-connector/src/cache.py**: Modified — actual Redis client initialization, get/set with orjson
- **connectors/argocd-connector/src/logging_config.py**: Already fixed in scaffold — verify scrub_secrets present
- **connectors/argocd-connector/tests/unit/test_health.py**: Already exists — verify passes
- **connectors/argocd-connector/tests/unit/test_apps.py**: New — cache hit/miss, error handling, query param filtering
- **connectors/argocd-connector/Dockerfile**: Verify builds with all new code
- **No frontend changes**
- **No other connector changes**
- **No infrastructure changes**
