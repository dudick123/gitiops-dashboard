## Context

The repo scaffold is complete. The argocd-connector has a FastAPI app with `/healthz` and `/readyz` endpoints, a cache.py with Pydantic SecretStr, a logging_config.py with scrub_secrets, and a conftest.py with AsyncClient fixture. But the lifespan is empty (no httpx client, no Redis pool), there are no real routes beyond health checks, and the CI toolchain (`make lint && make typecheck && make test`) has never been run.

This design covers the minimum implementation needed to prove the methodology: one real endpoint (`/apps`) with Redis caching, Pydantic models, structured logging, TDD tests, and a passing CI pipeline.

## Goals / Non-Goals

**Goals:**

- Populate the FastAPI lifespan with httpx.AsyncClient and redis.asyncio connection pool
- Implement `/apps` endpoint returning mock ArgoCD application data
- Implement Redis caching with 30-min TTL and orjson serialization
- Achieve `make lint && make typecheck && make test` passing with 90%+ coverage
- Achieve `docker build && docker run` serving real HTTP responses
- Exercise the full OpenSpec lifecycle in a single session

**Non-Goals:**

- No live ArgoCD API calls — the `/apps` endpoint returns static mock data (live integration comes in Phase 1 PROP-01)
- No multi-environment fan-out — single connector instance, not 3
- No frontend changes
- No other connector changes
- No Kubernetes deployment
- No CI pipeline execution (azure-pipelines.yml) — local `make check` only

## Decisions

### 1. Mock ArgoCD data via a service layer, not hardcoded in the route

Create `src/services/argocd_client.py` with an `ArgocdClient` class that has a `get_applications()` method returning mock data. The route handler calls this service. When Phase 1 replaces mock data with live ArgoCD API calls, only the service layer changes — the route, models, and tests remain stable.

**Alternative considered:** Hardcoding mock data directly in the route handler. Rejected because it doesn't establish the service layer pattern that every future connector proposal needs.

### 2. Redis caching in the route handler, not in the service layer

The route handler checks Redis first, falls back to the service layer on cache miss, and writes the result to Redis. This matches TECH-STANDARDS §4 (Redis Conventions) — cache is an optimisation layer in front of the upstream client.

**Alternative considered:** Caching inside the ArgocdClient. Rejected because caching is a cross-cutting concern that should be visible at the route level, not hidden inside the client. Different routes may have different cache keys.

### 3. TDD — tests first, then implementation

Write `test_apps.py` with the following test cases before implementing the route:
- `test_apps_returns_list_of_applications` — happy path
- `test_apps_returns_cached_data_on_cache_hit` — Redis has data, no service call
- `test_apps_falls_through_on_cache_miss` — Redis empty, service called, result cached
- `test_apps_filters_by_project` — `?project=auth-service` returns only that project's apps
- `test_apps_returns_502_on_service_error` — upstream failure returns 502 with ErrorResponse

This validates TDD workflow and establishes the test patterns for all future connector proposals.

### 4. Validate scaffold CI toolchain before writing new code

Before writing any new code, run `make lint && make typecheck && make test` on the existing scaffold. Fix any failures. This confirms the scaffold is a solid foundation before building on it.

## Risks / Trade-offs

**Mock data may not match real ArgoCD API shapes** → Acceptable for POC. The Pydantic models are hand-written from PRD §4.3 descriptions. When PROP-01 generates models from the OpenAPI spec, they replace these. The key insight is that the route/cache/test patterns survive regardless of the model shapes.

**90% coverage threshold may be hard with minimal code** → The POC has a focused scope (2 health endpoints + 1 apps endpoint + cache logic). 90% is achievable if tests cover the happy path, cache hit/miss, and error cases.

**Single session scope may be ambitious** → The POC is designed to be small: 1 endpoint, 1 service, 1 set of models, ~5 tests. If time runs out, the partially completed POC still validates whatever lifecycle steps were completed.
