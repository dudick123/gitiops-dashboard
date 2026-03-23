## Context

The GitOps Dashboard is a greenfield monorepo with a completed PRD (v2.1) but no source code. The repo currently contains only `CLAUDE.md`, `docs/PRD-gitops-dashboard.md`, mockups, and the `openspec/config.yaml`. The planned tech stack is Python 3.14 + FastAPI for three backend connector microservices, React 18 + TypeScript for the frontend, and Redis for caching. All API contracts follow the OpenSpec methodology with OpenAPI 3.1 specs as the source of truth.

This design covers the project skeleton — the directory layout, dependency declarations, build tooling, containerization, and local development workflow that every subsequent proposal depends on.

## Goals / Non-Goals

**Goals:**

- Establish a consistent monorepo structure matching PRD §8.2 so all future proposals have a known place to land code
- Configure Python 3.14 + FastAPI dependency sets for each connector so `pip install -e .` works from day one
- Configure the React 18 + TypeScript frontend so `npm install && npm run dev` works from day one
- Provide Dockerfiles and docker-compose.yml so the full stack (3 connectors + frontend + Redis) can run locally with `docker compose up`
- Provide a Makefile as the single entry point for common dev operations (build, test, lint, format)
- Establish linting and formatting standards (ruff for Python, ESLint + Prettier for TypeScript) before any code is written
- Create placeholder spec directories so OpenSpec proposals can immediately create spec files

**Non-Goals:**

- No API endpoints, business logic, or route handlers — those come in PROP-01 through PROP-04
- No CI/CD pipeline definition (azure-pipelines.yml) — covered in PRD-v2-gitops-pipelines
- No Kustomize manifests or deploy repo scaffolding — that is PROP-00C (separate deploy repo)
- No mock data or frontend UI components — those come in the mock UI proposal (PROP-00B)
- No authentication, secret management, or ESO configuration — those are runtime concerns
- No actual code generation scripts — placeholders only; real generation scripts ship with connector proposals

## Decisions

### 1. Monorepo with per-service pyproject.toml (not a single pyproject.toml)

Each connector gets its own `pyproject.toml` with its own dependency set. This matches the PRD principle that connectors are independently deployable microservices with no shared imports.

**Alternative considered:** A single root `pyproject.toml` with extras per connector. Rejected because it creates coupling — a dependency bump in one connector would require re-testing all connectors, and Docker builds would need to install the entire dependency tree.

### 2. Python 3.14 with hatchling build backend

Using `hatchling` as the build backend (via `pyproject.toml` `[build-system]`) for simplicity. Each connector is a standard Python package installable with `pip install -e .` for development.

**Alternative considered:** Poetry. Rejected because pyproject.toml with hatchling is the modern standard, requires no extra tooling, and works directly with pip.

### 3. Ruff for all Python linting and formatting

Ruff replaces flake8, isort, black, and pyflakes with a single tool. A shared `ruff.toml` at the repo root applies to all connectors.

**Alternative considered:** Separate black + flake8 + isort. Rejected — ruff is faster and provides a single configuration point.

### 4. Frontend: Vite + pnpm

Vite for dev server and production builds (PRD §5.1). Using pnpm over npm for faster installs and strict dependency isolation.

**Alternative considered:** npm. pnpm is preferred for monorepo-adjacent setups and strict hoisting prevents phantom dependency issues.

### 5. Docker Compose for local dev orchestration

A single `docker-compose.yml` at the repo root runs all services. Connectors use environment variables for configuration (matching the production ESO-injected pattern). Redis runs as a throwaway container with no persistence volume.

Connector instances are parameterized in docker-compose:
- 3 argocd-connector services (env=DEV/STAGE/PROD)
- 1 prometheus-connector service
- 6 network-connector services (one per cluster) — but for local dev, a single instance with mock config is sufficient
- 1 frontend service
- 1 Redis service

For local development simplicity, the initial docker-compose runs one instance of each connector type (not the full 10-instance production topology).

### 6. Makefile as dev command interface

A root Makefile provides consistent commands regardless of which connector or frontend a developer is working on. Targets delegate to the appropriate tool (pip, pnpm, ruff, docker compose).

### 7. Shared structlog configuration pattern

Each connector will use the same structlog JSON configuration. Rather than creating a shared library (which the PRD prohibits — no cross-connector imports), a common pattern will be established via a `logging.py` template in each connector's `src/` directory.

### 8. Spec directory structure

OpenAPI spec directories are created under `specs/` with a placeholder `openapi.yaml` containing only the OpenAPI version header and info block. The actual endpoint definitions will be populated by each connector's proposal.

## Risks / Trade-offs

**Python 3.14 availability** → Python 3.14 is the specified runtime. If base Docker images are not yet available, the Dockerfile will use `python:3.14-slim` and fall back to `python:3.13-slim` with a comment noting the target version. This is a build-time concern only — no code depends on 3.14-specific features in the scaffold.

**Placeholder scripts are not functional** → `generate-stubs.py` and `generate-ts-clients.sh` are empty placeholders. Developers must not expect them to work until the connector proposals ship. Mitigated by clear comments in each script file.

**Docker Compose simplified topology** → Local dev runs one instance per connector type, not the full 3+1+6 production topology. This means environment-specific behavior (e.g., querying different ArgoCD instances) cannot be tested locally without modifying docker-compose overrides. Acceptable for Phase 0 — production topology testing happens in Phase 1+.

**pnpm vs npm lock file** → If the team is unfamiliar with pnpm, they can switch to npm by replacing `pnpm-lock.yaml` with `package-lock.json`. The Makefile and Dockerfile abstract this behind `make install-frontend`.
