## 1. Root Configuration Files

- [x] 1.1 Create `.gitignore` with Python, Node.js, Docker, IDE, environment file, and secret file exclusions (including `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials.json`, `**/secrets/` per TECH-STANDARDS §12.2)
- [x] 1.2 Create workspace-level `pyproject.toml` at repo root with `[tool.ruff]` config (all 19 rule sets per TECH-STANDARDS §1: E, F, W, I, UP, S, B, A, C4, PT, SIM, TCH, DTZ, PIE, RSE, RET, FBT, ASYNC, RUF), line-length 99, target-version py314, and `[tool.mypy]` strict config. Declare shared dev dependencies (ruff, mypy, pytest, pytest-asyncio, pytest-cov, pytest-mock, respx, pre-commit) in dev group.
- [x] 1.3 Create `Makefile` with all targets per TECH-STANDARDS §9: install, lint, lint-frontend, format, format-frontend, typecheck, typecheck-frontend, test, test-frontend, test-unit, test-int, check, check-all, security-audit, build, generate-stubs, generate-ts-clients, generate-sbom, render-manifests, validate-manifests, lighthouse, docker-up, docker-down
- [x] 1.4 Create `.pre-commit-config.yaml` with all 9 hooks per TECH-STANDARDS §6: ruff check, ruff format --check, mypy, prettier --check, eslint, check-yaml, check-json, detect-secrets, no-commit-to-branch
- [x] 1.5 Create `.secrets.baseline` via detect-secrets scan per TECH-STANDARDS §12.2
- [x] 1.6 Update `openspec/config.yaml` with full project context (tech stack, conventions, domain knowledge, uv as package manager)

## 2. ArgoCD Connector Scaffold

- [x] 2.1 Create `connectors/argocd-connector/pyproject.toml` with Python >=3.14, dependencies (fastapi, pydantic>=2.0, pydantic-settings, structlog, redis, uvicorn, httpx, orjson, prometheus-fastapi-instrumentator), `[tool.pytest.ini_options]` with asyncio_mode="auto" and coverage config, `[tool.mypy]` strict=true. Use uv-compatible project format (no hatchling build backend).
- [x] 2.2 Create `connectors/argocd-connector/src/__init__.py` and `connectors/argocd-connector/src/main.py` with minimal FastAPI app using lifespan pattern, dual health endpoints (`/healthz` liveness, `/readyz` readiness), and `/metrics` endpoint stub
- [x] 2.3 Create directory structure: `src/routes/`, `src/models/`, `src/services/` with `__init__.py` files
- [x] 2.4 Create `connectors/argocd-connector/src/cache.py` with Redis client skeleton — uniform 30-minute TTL constant (CACHE_TTL_SECONDS = 1800), authenticated connection via REDIS_PASSWORD env var
- [x] 2.5 Create `connectors/argocd-connector/Dockerfile` — multi-stage build, uv sync --frozen --no-dev, python:3.14-slim base (with digest pin comment), non-root user (UID 1000), HEALTHCHECK instruction
- [x] 2.6 Create `connectors/argocd-connector/src/logging_config.py` — structlog with JSON output, bound processors for connector name, environment, region
- [x] 2.7 Create `connectors/argocd-connector/tests/` with `__init__.py`, `tests/unit/`, `tests/integration/`, `tests/generated/` subdirectories, and `conftest.py` with AsyncClient/ASGITransport fixture and mock Redis fixture
- [x] 2.8 Create `connectors/argocd-connector/.dockerignore`
- [x] 2.9 Create `connectors/argocd-connector/py.typed` marker file

## 3. Prometheus Connector Scaffold

- [x] 3.1 Create `connectors/prometheus-connector/pyproject.toml` — same structure as argocd-connector, with httpx included in dependencies
- [x] 3.2 Create `connectors/prometheus-connector/src/__init__.py` and `src/main.py` with minimal FastAPI app (lifespan, /healthz, /readyz, /metrics stub)
- [x] 3.3 Create directory structure: `src/routes/`, `src/models/`, `src/services/` with `__init__.py` files
- [x] 3.4 Create `connectors/prometheus-connector/src/cache.py` with Redis client skeleton — CACHE_TTL_SECONDS = 1800, authenticated connection
- [x] 3.5 Create `connectors/prometheus-connector/Dockerfile` — multi-stage, uv, non-root, digest pin comment
- [x] 3.6 Create `connectors/prometheus-connector/src/logging_config.py`
- [x] 3.7 Create `connectors/prometheus-connector/tests/` with unit/, integration/, generated/, conftest.py
- [x] 3.8 Create `connectors/prometheus-connector/.dockerignore` and `py.typed`

## 4. Network Connector Scaffold

- [x] 4.1 Create `connectors/network-connector/pyproject.toml` — same structure, with kubernetes client dependency instead of httpx
- [x] 4.2 Create `connectors/network-connector/src/__init__.py` and `src/main.py` with minimal FastAPI app (lifespan, /healthz, /readyz, /metrics stub)
- [x] 4.3 Create directory structure: `src/routes/`, `src/models/`, `src/services/` with `__init__.py` files
- [x] 4.4 Create `connectors/network-connector/src/cache.py` with Redis client skeleton — CACHE_TTL_SECONDS = 1800, authenticated connection
- [x] 4.5 Create `connectors/network-connector/Dockerfile` — multi-stage, uv, non-root, digest pin comment
- [x] 4.6 Create `connectors/network-connector/src/logging_config.py`
- [x] 4.7 Create `connectors/network-connector/tests/` with unit/, integration/, generated/, conftest.py
- [x] 4.8 Create `connectors/network-connector/.dockerignore` and `py.typed`

## 5. Frontend Scaffold

- [x] 5.1 Create `frontend/package.json` with React 18, TypeScript, Vite, @tanstack/react-query v5, tailwindcss, recharts, react-error-boundary, @tanstack/react-virtual, and dev dependencies (vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, msw, vitest-axe, eslint with all 6 plugins per TECH-STANDARDS §2, prettier, @types/react, @types/react-dom)
- [x] 5.2 Create `frontend/vite.config.ts` with React plugin, proxy config for connector APIs, and build.sourcemap: false
- [x] 5.3 Create `frontend/tsconfig.json` with strict mode + enhanced flags (noUncheckedIndexedAccess, exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature, forceConsistentCasingInFileNames, verbatimModuleSyntax), JSX react-jsx, and path aliases
- [x] 5.4 Create `frontend/tailwind.config.ts` with content paths and status color design tokens
- [x] 5.5 Create `frontend/postcss.config.js` with tailwindcss and autoprefixer plugins
- [x] 5.6 Create `frontend/.eslintrc.cjs` with all 6 required plugins per TECH-STANDARDS §2: @typescript-eslint, react-hooks, react, jsx-a11y, security, import. Ban unsafe HTML rendering via react/no-danger rule.
- [x] 5.7 Create `frontend/.prettierrc` with line width 100, consistent settings
- [x] 5.8 Create `frontend/src/App.tsx` with minimal named-export React component
- [x] 5.9 Create `frontend/src/main.tsx` with React 18 createRoot entry point
- [x] 5.10 Create `frontend/index.html` with Vite entry point script tag
- [x] 5.11 Create directory structure: `src/api/`, `src/components/layout/`, `src/components/app-status/`, `src/components/image-promotion/`, `src/components/metrics/`, `src/components/network-status/`, `src/hooks/`, `src/lib/`, `src/mocks/handlers/` with `.gitkeep` files
- [x] 5.12 Create `frontend/src/lib/query-client.ts` with QueryClient defaults per TECH-STANDARDS §2 (staleTime 30min, gcTime 60min, retry 2)
- [x] 5.13 Create `frontend/src/lib/query-keys.ts` with query key factory pattern per TECH-STANDARDS §2
- [x] 5.14 Create `frontend/vitest.config.ts` and `frontend/src/test-utils.tsx` with renderWithQuery wrapper and createTestQueryClient
- [x] 5.15 Create `frontend/Dockerfile` — multi-stage (Node build, nginx serve), non-root user, security headers in nginx.conf
- [x] 5.16 Create `frontend/.dockerignore`
- [x] 5.17 Create `frontend/public/config.json` placeholder for runtime configuration per TECH-STANDARDS §2

## 6. OpenAPI Spec Placeholders

- [x] 6.1 Create `specs/argocd-connector/openapi.yaml` with OpenAPI 3.1.0 header, info block (title: ArgoCD Connector API, version: 0.1.0), and empty paths
- [x] 6.2 Create `specs/prometheus-connector/openapi.yaml` with OpenAPI 3.1.0 header, info block (title: Prometheus Connector API, version: 0.1.0), and empty paths
- [x] 6.3 Create `specs/network-connector/openapi.yaml` with OpenAPI 3.1.0 header, info block (title: Network Connector API, version: 0.1.0), and empty paths

## 7. Scripts and Docker Compose

- [x] 7.1 Create `scripts/generate-stubs.py` as a placeholder with docstring explaining it will generate FastAPI stubs from OpenAPI specs
- [x] 7.2 Create `scripts/generate-ts-clients.sh` as a placeholder with comment explaining it will generate TypeScript clients from OpenAPI specs
- [x] 7.3 Create `docker-compose.yml` with services: argocd-connector (internal 8080, host 8001), prometheus-connector (internal 8080, host 8002), network-connector (internal 8080, host 8003), frontend (port 3000), redis (port 6379, --save "" flag, --requirepass, no volume). Include health checks and dependency ordering.
- [x] 7.4 Create `.env.example` documenting all environment variables with placeholder values
