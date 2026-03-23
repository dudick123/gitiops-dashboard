## Why

The GitOps Dashboard project has a completed PRD (v2.1) but no source code or project infrastructure. Every subsequent proposal — ArgoCD connector, Prometheus connector, Network connector, and the React frontend — depends on a consistent project skeleton with shared tooling, dependency management, containerization, and local development workflow. Without this foundation, each proposal would need to independently solve build, lint, test, and Docker concerns, leading to inconsistency across connectors. This is the Phase 0 prerequisite that unblocks all implementation work.

## What Changes

- Create the monorepo directory structure as defined in PRD §8.2: `connectors/`, `frontend/`, `specs/`, `scripts/`, `openspec/`
- Add Python 3.14 project configuration (`pyproject.toml`) for each of the three connectors with FastAPI, Pydantic v2, structlog, and redis dependencies
- Add frontend project configuration (`package.json`) with React 18, TypeScript strict, Vite, React Query v5, Tailwind CSS, shadcn/ui, and Recharts
- Add Dockerfile templates for each connector (Python 3.14 base) and the frontend (Node + nginx)
- Add `docker-compose.yml` for local development orchestrating all connectors, frontend, and Redis
- Add `Makefile` with standard dev commands: build, test, lint, format, generate-stubs, generate-ts-clients
- Add linting configuration: `ruff.toml` for Python, ESLint + Prettier for TypeScript
- Add `.gitignore` for Python, Node.js, and Docker artifacts
- Add placeholder OpenAPI 3.1 spec directories under `specs/` for each connector
- Update `openspec/config.yaml` with full project context (tech stack, conventions, domain knowledge)
- Add `scripts/generate-stubs.py` and `scripts/generate-ts-clients.sh` as placeholder scripts
- Add empty `src/` directory structures with `__init__.py` / entry point files for each connector and frontend

## Capabilities

### New Capabilities

- `repo-scaffold`: Project directory structure, build tooling, dependency management, Docker configuration, linting, and local development workflow for the GitOps Dashboard monorepo.

### Modified Capabilities

(none — no existing specs)

## Impact

- **Repository root**: New files at root level (Makefile, docker-compose.yml, .gitignore)
- **connectors/**: Three new connector directories with pyproject.toml, Dockerfile, and src/ skeleton
- **frontend/**: New React project with package.json, Vite config, TypeScript config, Dockerfile, and src/ skeleton
- **specs/**: Placeholder directories for OpenAPI specs (argocd-connector, prometheus-connector, network-connector)
- **scripts/**: Utility scripts for code generation
- **openspec/config.yaml**: Updated with project context
- **Dependencies**: No external service dependencies — this is purely local project structure
- **CI/CD**: Establishes the structure that `azure-pipelines.yml` will build against (pipeline definition itself is out of scope for this proposal)
