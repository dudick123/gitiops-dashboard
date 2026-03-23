## ADDED Requirements

### Requirement: Monorepo directory structure matches PRD §8.2
The repository SHALL contain the following top-level directories: `connectors/`, `frontend/`, `specs/`, `scripts/`, `openspec/`, and `docs/`. Each connector SHALL have its own directory under `connectors/` with `src/`, `tests/`, `Dockerfile`, and `pyproject.toml`. The frontend SHALL have its own directory under `frontend/` with `src/`, `tests/`, `Dockerfile`, and `package.json`.

#### Scenario: All required directories exist after scaffold
- **WHEN** the repository scaffold is created
- **THEN** the following paths SHALL exist: `connectors/argocd-connector/`, `connectors/prometheus-connector/`, `connectors/network-connector/`, `frontend/`, `specs/argocd-connector/`, `specs/prometheus-connector/`, `specs/network-connector/`, `scripts/`

#### Scenario: Each connector has standard Python project layout
- **WHEN** a developer navigates to any connector directory (e.g., `connectors/argocd-connector/`)
- **THEN** the directory SHALL contain `pyproject.toml`, `Dockerfile`, `src/main.py`, `src/__init__.py`, `src/routes/`, `src/models/`, `src/services/`, `src/cache.py`, and `tests/`

#### Scenario: Frontend has standard React project layout
- **WHEN** a developer navigates to `frontend/`
- **THEN** the directory SHALL contain `package.json`, `Dockerfile`, `vite.config.ts`, `tsconfig.json`, and `src/App.tsx`

### Requirement: Python connector dependencies are independently managed
Each connector's `pyproject.toml` SHALL declare its own dependencies independently. Connectors MUST NOT import from each other. Each `pyproject.toml` SHALL specify Python >=3.14 as the required version and SHALL include FastAPI, Pydantic v2, structlog, and redis as dependencies.

#### Scenario: Connector installs independently
- **WHEN** a developer runs `pip install -e .` from any connector directory
- **THEN** the connector's dependencies SHALL install without requiring any other connector to be installed

#### Scenario: Each connector declares required dependencies
- **WHEN** `pyproject.toml` is read for any connector
- **THEN** the dependencies list SHALL include `fastapi`, `pydantic>=2.0`, `structlog`, `redis`, and `uvicorn`

### Requirement: Frontend dependencies are configured for React 18 + TypeScript
The `frontend/package.json` SHALL declare React 18, TypeScript (strict mode), Vite, React Query v5 (`@tanstack/react-query`), Tailwind CSS, and Recharts as dependencies. The `tsconfig.json` SHALL enable strict mode.

#### Scenario: Frontend installs and dev server starts
- **WHEN** a developer runs `pnpm install && pnpm run dev` from `frontend/`
- **THEN** the Vite dev server SHALL start without errors

#### Scenario: TypeScript strict mode is enabled
- **WHEN** `tsconfig.json` is read
- **THEN** `compilerOptions.strict` SHALL be `true`

### Requirement: Docker Compose runs the full local stack
A `docker-compose.yml` at the repository root SHALL define services for: one argocd-connector instance, one prometheus-connector instance, one network-connector instance, the frontend, and Redis. Redis SHALL run without persistence (no volumes for data).

#### Scenario: Full stack starts with docker compose
- **WHEN** a developer runs `docker compose up --build` from the repository root
- **THEN** all five services (argocd-connector, prometheus-connector, network-connector, frontend, redis) SHALL start and reach healthy state

#### Scenario: Redis has no persistence
- **WHEN** the Redis service is defined in docker-compose.yml
- **THEN** no volume SHALL be mounted for Redis data and the `--save ""` flag SHALL be set

### Requirement: Dockerfiles produce minimal container images
Each connector Dockerfile SHALL use a Python 3.14 slim base image, install only production dependencies, and expose the service port. The frontend Dockerfile SHALL use a multi-stage build: Node for building, nginx for serving.

#### Scenario: Connector Dockerfile builds successfully
- **WHEN** `docker build .` is run from any connector directory
- **THEN** the image SHALL build without errors and the entrypoint SHALL run uvicorn on the connector's main app

#### Scenario: Frontend Dockerfile produces nginx image
- **WHEN** `docker build .` is run from `frontend/`
- **THEN** the resulting image SHALL serve the built frontend assets via nginx

### Requirement: Makefile provides standard development commands
A `Makefile` at the repository root SHALL provide targets for: `install`, `build`, `test`, `lint`, `format`, `docker-up`, `docker-down`, `generate-stubs`, and `generate-ts-clients`.

#### Scenario: Make targets delegate to correct tools
- **WHEN** a developer runs `make lint`
- **THEN** ruff SHALL run against all Python code in `connectors/` and ESLint SHALL run against all TypeScript code in `frontend/`

#### Scenario: Make install sets up all dependencies
- **WHEN** a developer runs `make install`
- **THEN** pip SHALL install each connector in editable mode and pnpm SHALL install frontend dependencies

### Requirement: Linting is configured for Python and TypeScript
A `ruff.toml` at the repository root SHALL configure ruff for all Python code. An `.eslintrc.cjs` and `.prettierrc` in the `frontend/` directory SHALL configure ESLint and Prettier for TypeScript code.

#### Scenario: Ruff configuration targets Python 3.14
- **WHEN** `ruff.toml` is read
- **THEN** `target-version` SHALL be set to `"py314"` and the rule set SHALL include `E`, `F`, `I` (isort), and `UP` (pyupgrade)

#### Scenario: ESLint is configured for TypeScript React
- **WHEN** ESLint runs on frontend code
- **THEN** it SHALL use the TypeScript parser and React-specific rules

### Requirement: .gitignore covers Python, Node.js, and Docker artifacts
A `.gitignore` at the repository root SHALL exclude: Python bytecode (`__pycache__/`, `*.pyc`), virtual environments (`venv/`, `.venv/`), Node modules (`node_modules/`), build outputs (`dist/`, `build/`), IDE files (`.idea/`, `.vscode/`), environment files (`.env`), and Docker-specific files.

#### Scenario: Generated files are excluded from git
- **WHEN** a developer builds any connector or the frontend
- **THEN** build artifacts SHALL NOT appear in `git status` output

### Requirement: OpenAPI spec placeholders exist for each connector
Each connector SHALL have a placeholder OpenAPI 3.1 YAML file at `specs/<connector-name>/openapi.yaml` containing the OpenAPI version, info block (title, version, description), and an empty paths object.

#### Scenario: Placeholder spec is valid OpenAPI 3.1
- **WHEN** `specs/argocd-connector/openapi.yaml` is parsed
- **THEN** it SHALL contain `openapi: "3.1.0"`, an `info` block with `title` and `version`, and an empty `paths: {}` object

### Requirement: OpenSpec config.yaml includes project context
The `openspec/config.yaml` SHALL include a `context` field describing the project's tech stack, conventions, and domain knowledge so that AI agents generating artifacts have full context.

#### Scenario: Config context describes tech stack
- **WHEN** `openspec/config.yaml` is read
- **THEN** the `context` field SHALL mention Python 3.14, FastAPI, Pydantic v2, React 18, TypeScript strict, Vite, Redis caching, ArgoCD, Prometheus, and Kubernetes NetworkPolicy
