## 0. Validate Scaffold (run before writing any new code)

- [x] 0.1 Run `uv sync` in the argocd-connector directory — verify dependencies install without errors
- [x] 0.2 Run `make lint` — fix any ruff violations in existing scaffold code
- [x] 0.3 Run `make typecheck` — fix any mypy --strict errors in existing scaffold code
- [x] 0.4 Run `make test` — verify existing smoke tests pass (adjust coverage threshold temporarily if needed for scaffold-only code)
- [x] 0.5 Run `docker build -t gitops-dashboard/argocd-connector:poc connectors/argocd-connector` — verify Docker image builds

## 1. Pydantic Response Models (write types first)

- [x] 1.1 Create `connectors/argocd-connector/src/models/application.py` — `ApplicationStatus` model with fields: name (str), project (str), environment (str), region (str), health (Literal["Healthy", "Degraded", "Progressing", "Suspended", "Missing", "Unknown"]), sync (Literal["Synced", "OutOfSync", "Unknown"]), images (list[str]). Use `model_config = ConfigDict(frozen=True)`.
- [x] 1.2 Create `connectors/argocd-connector/src/models/error.py` — `ErrorResponse` model with fields: error (str), detail (str), connector (str), timestamp (datetime). Per TECH-STANDARDS §4.

## 2. Tests First (TDD — write before implementation)

- [x] 2.1 Create `connectors/argocd-connector/tests/unit/test_apps.py` with tests:
  - `test_apps_returns_list_of_applications` — GET /apps returns 200 with list
  - `test_apps_returns_cached_data_on_cache_hit` — mock Redis has data, no service call
  - `test_apps_falls_through_on_cache_miss` — mock Redis empty, service called, result cached
  - `test_apps_filters_by_project` — ?project=auth-service filters results
  - `test_apps_returns_502_on_service_error` — upstream error + no cache = 502 ErrorResponse
  - `test_apps_returns_stale_cache_on_service_error` — upstream error + stale cache = 200 with data
- [x] 2.2 Verify all tests FAIL (red phase of TDD) — they reference code that doesn't exist yet

## 3. Service Layer

- [x] 3.1 Create `connectors/argocd-connector/src/services/argocd_client.py` — `ArgocdClient` class with `get_applications(project: str | None = None) -> list[ApplicationStatus]` method. Returns mock data for POC (15-20 applications across 3 envs × 2 regions with mixed health/sync statuses). Uses httpx.AsyncClient from app.state.

## 4. Redis Cache Implementation

- [x] 4.1 Update `connectors/argocd-connector/src/cache.py` — Add `RedisCache` class with async `get(key: str) -> bytes | None` and `set(key: str, value: bytes, ttl: int = CACHE_TTL_SECONDS) -> None` methods. Use `orjson.dumps()` / `orjson.loads()` for serialization. Handle `redis.ConnectionError` gracefully (log warning, return None).

## 5. Route Implementation

- [x] 5.1 Create `connectors/argocd-connector/src/routes/apps.py` — FastAPI router with `GET /apps` endpoint. Check Redis cache first (key: `argocd:{env}:{region}:apps`). On miss, call ArgocdClient, cache result, return. On upstream error, return stale cache if available, else 502 ErrorResponse. Support `?project=` query parameter.
- [x] 5.2 Register the apps router in `main.py` via `app.include_router()`.

## 6. Lifespan and Wiring

- [x] 6.1 Update `connectors/argocd-connector/src/main.py` lifespan — create `httpx.AsyncClient` with `Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)`, create `redis.asyncio` connection pool with `RedisSettings` password, store both on `app.state`. Close on shutdown.
- [x] 6.2 Verify `configure_logging(connector="argocd-connector")` is called before the app starts.
- [x] 6.3 Verify CORS middleware and TrustedHostMiddleware are configured.

## 7. Green Phase — Make Tests Pass

- [x] 7.1 Run `make test` — all tests in test_health.py and test_apps.py pass
- [x] 7.2 Run `make lint` — zero ruff violations
- [x] 7.3 Run `make typecheck` — zero mypy errors
- [x] 7.4 Verify coverage is >= 90% for `connectors/argocd-connector/src/`

## 8. Docker Verification

- [x] 8.1 Run `docker build -t gitops-dashboard/argocd-connector:poc connectors/argocd-connector` — builds without errors
- [x] 8.2 Run `docker run -p 8001:8080 -e REDIS_URL=redis://host.docker.internal:6379/0 -e REDIS_PASSWORD=local-dev-only gitops-dashboard/argocd-connector:poc` (with a local Redis running) — container starts
- [x] 8.3 Verify `curl http://localhost:8001/healthz` returns 200 with JSON health response
- [x] 8.4 Verify `curl http://localhost:8001/apps` returns 200 with JSON array of applications
- [x] 8.5 Verify `curl http://localhost:8001/apps?project=auth-service` returns filtered results
