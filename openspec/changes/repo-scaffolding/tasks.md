## 1. Root Configuration Files

- [ ] 1.1 Create `.gitignore` with Python, Node.js, Docker, IDE, and environment file exclusions
- [ ] 1.2 Create `ruff.toml` at repo root with target-version py314, rule sets E/F/I/UP, line-length 100
- [ ] 1.3 Create `Makefile` with targets: install, build, test, lint, format, docker-up, docker-down, generate-stubs, generate-ts-clients
- [ ] 1.4 Update `openspec/config.yaml` with full project context (tech stack, conventions, domain knowledge)

## 2. ArgoCD Connector Scaffold

- [ ] 2.1 Create `connectors/argocd-connector/pyproject.toml` with Python >=3.14, FastAPI, Pydantic v2, structlog, redis, uvicorn, httpx dependencies and hatchling build backend
- [ ] 2.2 Create `connectors/argocd-connector/src/__init__.py` and `connectors/argocd-connector/src/main.py` with minimal FastAPI app (health endpoint only)
- [ ] 2.3 Create empty directory structure: `src/routes/`, `src/models/`, `src/services/` with `__init__.py` files
- [ ] 2.4 Create `connectors/argocd-connector/src/cache.py` with Redis client skeleton (30s TTL constant, connection from env var)
- [ ] 2.5 Create `connectors/argocd-connector/Dockerfile` using python:3.14-slim base, pip install, uvicorn entrypoint
- [ ] 2.6 Create `connectors/argocd-connector/tests/` directory with `__init__.py` and empty `tests/generated/` and `tests/integration/` subdirectories

## 3. Prometheus Connector Scaffold

- [ ] 3.1 Create `connectors/prometheus-connector/pyproject.toml` with Python >=3.14, FastAPI, Pydantic v2, structlog, redis, uvicorn dependencies and hatchling build backend
- [ ] 3.2 Create `connectors/prometheus-connector/src/__init__.py` and `connectors/prometheus-connector/src/main.py` with minimal FastAPI app (health endpoint only)
- [ ] 3.3 Create empty directory structure: `src/routes/`, `src/models/`, `src/services/` with `__init__.py` files
- [ ] 3.4 Create `connectors/prometheus-connector/src/cache.py` with Redis client skeleton (60s TTL constant)
- [ ] 3.5 Create `connectors/prometheus-connector/Dockerfile` using python:3.14-slim base
- [ ] 3.6 Create `connectors/prometheus-connector/tests/` directory with `__init__.py` and empty subdirectories

## 4. Network Connector Scaffold

- [ ] 4.1 Create `connectors/network-connector/pyproject.toml` with Python >=3.14, FastAPI, Pydantic v2, structlog, redis, uvicorn, kubernetes dependencies and hatchling build backend
- [ ] 4.2 Create `connectors/network-connector/src/__init__.py` and `connectors/network-connector/src/main.py` with minimal FastAPI app (health endpoint only)
- [ ] 4.3 Create empty directory structure: `src/routes/`, `src/models/`, `src/services/` with `__init__.py` files
- [ ] 4.4 Create `connectors/network-connector/src/cache.py` with Redis client skeleton (120s TTL constant)
- [ ] 4.5 Create `connectors/network-connector/Dockerfile` using python:3.14-slim base
- [ ] 4.6 Create `connectors/network-connector/tests/` directory with `__init__.py` and empty subdirectories

## 5. Frontend Scaffold

- [ ] 5.1 Create `frontend/package.json` with React 18, TypeScript, Vite, @tanstack/react-query v5, tailwindcss, recharts, and dev dependencies (eslint, prettier, @types/react)
- [ ] 5.2 Create `frontend/vite.config.ts` with React plugin and proxy config for connector APIs
- [ ] 5.3 Create `frontend/tsconfig.json` with strict mode enabled, JSX react-jsx, and path aliases
- [ ] 5.4 Create `frontend/tailwind.config.js` with content paths for src/**/*.{ts,tsx}
- [ ] 5.5 Create `frontend/postcss.config.js` with tailwindcss and autoprefixer plugins
- [ ] 5.6 Create `frontend/.eslintrc.cjs` with TypeScript parser, React rules, and Prettier integration
- [ ] 5.7 Create `frontend/.prettierrc` with consistent formatting settings (semi, singleQuote, trailingComma)
- [ ] 5.8 Create `frontend/src/App.tsx` with minimal React component (placeholder text)
- [ ] 5.9 Create `frontend/src/main.tsx` with React 18 createRoot entry point
- [ ] 5.10 Create `frontend/index.html` with Vite entry point script tag
- [ ] 5.11 Create empty directory structure: `src/api/`, `src/components/`, `src/hooks/`, `src/lib/` with `.gitkeep` files
- [ ] 5.12 Create `frontend/Dockerfile` with multi-stage build: Node for build, nginx for serve

## 6. OpenAPI Spec Placeholders

- [ ] 6.1 Create `specs/argocd-connector/openapi.yaml` with OpenAPI 3.1.0 header, info block (title: ArgoCD Connector API, version: 0.1.0), and empty paths
- [ ] 6.2 Create `specs/prometheus-connector/openapi.yaml` with OpenAPI 3.1.0 header, info block (title: Prometheus Connector API, version: 0.1.0), and empty paths
- [ ] 6.3 Create `specs/network-connector/openapi.yaml` with OpenAPI 3.1.0 header, info block (title: Network Connector API, version: 0.1.0), and empty paths

## 7. Scripts and Docker Compose

- [ ] 7.1 Create `scripts/generate-stubs.py` as a placeholder with docstring explaining it will generate FastAPI stubs from OpenAPI specs
- [ ] 7.2 Create `scripts/generate-ts-clients.sh` as a placeholder with comment explaining it will generate TypeScript clients from OpenAPI specs
- [ ] 7.3 Create `docker-compose.yml` with services: argocd-connector (port 8001), prometheus-connector (port 8002), network-connector (port 8003), frontend (port 3000), redis (port 6379, --save "" flag, no volume)

## 8. Structlog Configuration Template

- [ ] 8.1 Create a shared logging configuration pattern in each connector's `src/logging_config.py` — structlog with JSON output, bound processors for service name and environment
