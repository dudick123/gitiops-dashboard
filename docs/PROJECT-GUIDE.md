# Project Guide — GitOps Dashboard

| Field       | Value                                    |
| ----------- | ---------------------------------------- |
| **Version** | 1.0                                      |
| **Date**    | 2026-03-24                               |
| **Purpose** | Single context document for agents and humans contributing to the GitOps Dashboard |

This is the working reference for the project. It contains what you need to start contributing.
For deep dives, see the full documents listed in [Section 7](#7-reference-documents).

---

## 1. Project Overview

### What

GitOps Dashboard is a read-only reporting dashboard that aggregates data from three separate
tools into a single interface:

- **ArgoCD** (3 instances: DEV, STAGE, PROD) — application health, sync status, image tags
- **Prometheus** (via Azure Monitor Workspace) — CPU, memory, quota, OOM events, Cilium flows
- **Kubernetes API** (6 AKS clusters) — NetworkPolicy objects only

The platform spans 6 AKS clusters (3 environments x 2 regions: East US, West US) with 850+
ArgoCD Applications. The dashboard replaces context-switching between the ArgoCD console,
kubectl, and the Azure portal for routine status checks.

### Why

Platform tenants (developers, tech leads, SREs, security auditors) currently need 3+ tools to
answer basic questions like "has my app promoted to STAGE?" or "what image is running in
PROD-East?". This friction increases onboarding time, slows incident triage, and creates
unnecessary dependency on platform engineers.

### Key Properties

- **Non-mutating**: Displays state but never modifies it. All writes go through existing CI/CD and ArgoCD.
- **Internal-only**: Private network access only. No public internet exposure.
- **Soft tenancy**: Any authenticated user (SSO/OIDC via Azure AD) sees all data. No per-team RBAC.
- **Tier II**: Important but not critical. No formal SLAs. Best-effort availability.

### Status

- Phase 0 (repo scaffold) is complete.
- **Methodology POC is next** — argocd-connector `/healthz` + `/apps` end-to-end, validating the full OpenSpec lifecycle before committing to the multi-phase build.
- No production code committed yet. PRDs and standards define the full technical specification.

---

## 2. Architecture

### Logical Architecture

```text
                        +------------------------+
                        |   React 18 Frontend    |
                        |  (TypeScript / Vite)   |
                        |  Auto-generated API    |
                        |  clients from specs    |
                        +----------+-------------+
                                   | REST (OpenAPI)
                    +--------------+--------------+
                    v              v              v
          +-------------+ +--------------+ +--------------+
          |   ArgoCD    | |  Prometheus  | |   Network    |
          |  Connector  | |  Connector   | |  Connector   |
          |  (x3 envs)  | |  (x1 shared) | |  (x6 clust.) |
          |  FastAPI    | |  FastAPI     | |  FastAPI     |
          +------+------+ +------+-------+ +------+-------+
                 |               |                |
          +------v------+ +------v-------+ +------v-------+
          |  ArgoCD API | | Azure Monitor| |  K8s API     |
          |  (x3 inst.) | |  Workspace   | |  (NetPol     |
          |             | |  (Prometheus)| |   reads only)|
          +-------------+ +--------------+ +--------------+

          +---------------------------------------------------+
          |  Redis (in-cluster, no persistence, 30-min TTL)   |
          +---------------------------------------------------+

          +---------------------------------------------------+
          |  External Secrets Operator --> Azure Key Vault     |
          +---------------------------------------------------+
```

### Connector Microservices

Three types of FastAPI connector, each wrapping a single data source:

| Connector               | Upstream Source                     | Instances | Data Served                                        |
| ----------------------- | ---------------------------------- | --------- | -------------------------------------------------- |
| **argocd-connector**    | ArgoCD REST API                    | 3 (1/env) | App health, sync status, image tags, AppSets       |
| **prometheus-connector**| Azure Monitor Workspace (PromQL)   | 1 shared  | CPU, memory, quota, OOM, Cilium drops/flows        |
| **network-connector**   | Kubernetes API (NetworkPolicy)     | 6 (1/cluster) | NetworkPolicy objects, namespace isolation status |

Key principles:
- **No shared state between connectors.** Cross-connector aggregation happens in the frontend.
- **No direct K8s API queries** except NetworkPolicy reads by the network-connector.
- **OpenAPI 3.1 specs are the source of truth.** Backend stubs and frontend clients are generated from specs.

#### Key Connector Endpoints

**argocd-connector** (per-environment instance):

| Method | Path                | Description                                           |
| ------ | ------------------- | ----------------------------------------------------- |
| GET    | `/projects`         | Lists ArgoCD AppProjects (populates project selector) |
| GET    | `/apps`             | Lists Applications with health/sync. `?project=` filter. |
| GET    | `/apps/{name}/images` | Parsed container image tags from `status.summary.images` |
| GET    | `/appsets`          | Lists ApplicationSets with generated Application names |
| GET    | `/healthz`          | Liveness probe                                        |
| GET    | `/readyz`           | Readiness probe (ArgoCD API + Redis reachable)        |

**prometheus-connector** (single shared instance):

| Method | Path                     | Description                                      |
| ------ | ------------------------ | ------------------------------------------------ |
| GET    | `/metrics/cpu`           | CPU usage by env/cluster. `?namespace=` for workload-level. |
| GET    | `/metrics/memory`        | Memory usage. Same scoping as CPU.               |
| GET    | `/metrics/namespace-quota` | Namespace resource quota utilisation.           |
| GET    | `/metrics/request-limit` | Request/limit ratios (current + 7-day max).      |
| GET    | `/metrics/ooms`          | OOM kill events with container attribution.      |
| GET    | `/metrics/cilium/drops`  | Cilium L3/L4 drop counts from Hubble metrics.   |
| GET    | `/metrics/cilium/flows`  | Cilium denied flow log with policy verdicts.     |

**network-connector** (per-cluster instance):

| Method | Path                            | Description                                  |
| ------ | ------------------------------- | -------------------------------------------- |
| GET    | `/network/policies`             | NetworkPolicy objects. `?namespace=` filter.  |
| GET    | `/network/namespaces/{ns}/status` | Isolation status for a namespace; flags open egress. |

### Degraded State Handling

Connectors handle upstream unavailability gracefully:

| Scenario                        | Dashboard Behaviour                                              |
| ------------------------------- | ---------------------------------------------------------------- |
| ArgoCD instance unreachable     | Affected env columns show "Unknown" with last refresh timestamp  |
| Azure Monitor unreachable       | Metrics module shows "Unavailable". Other modules unaffected.    |
| AKS cluster unreachable         | Affected cluster network status shows "Unknown"                  |
| Redis unavailable               | Connectors fall through to live upstream fetch. Slower, no data loss. |

### Frontend Modules

The React SPA has four dashboard modules, each independently wrapped in an error boundary:

1. **App Status** — Health/sync grid across all envs and regions. ApplicationSet hierarchy in Project View.
2. **Image Promotion** — Tag per pipeline step (DEV-E through PROD-W). Mismatch highlighting.
3. **Metrics** — CPU/memory, quota, request/limit ratios, OOM events. Namespace or workload granularity.
4. **Network Status** — NetworkPolicy inventory, open egress warnings, Cilium drop/flow data.

Two view modes controlled by a persistent project scope selector:
- **Platform View** ("All Projects") — namespace-level aggregates, flat app list.
- **Project View** (specific project) — workload-level detail, ApplicationSet hierarchy, scoped Cilium flows.

### Caching Strategy

Redis is a throwaway in-memory cache. No disk persistence.

- **Uniform 30-minute TTL** across all connectors and data types.
- The dashboard is a reporting tool — it does not need real-time data.
- 30-minute interval avoids overwhelming upstream APIs (ArgoCD serves 850+ apps).
- Cache miss = live upstream fetch. Redis failure = fall through to live fetch (warning, not error).
- Manual "Refresh now" button per module bypasses cache on demand.

### Deployment Topology

All dashboard components (frontend + 10 connectors + Redis = 12 pods) deploy to the
**DEV East US cluster** (`aks-dev-eastus`). The dashboard queries other clusters and ArgoCD
instances over the internal network.

### Data Source Table

| Data Type                       | Source                          | Why This Source                              |
| ------------------------------- | ------------------------------- | -------------------------------------------- |
| App health & sync status        | ArgoCD API (per-env instance)   | Reflects actual deployed state               |
| Container image tags            | ArgoCD API `status.summary.images` | Authoritative for running workload        |
| CPU & memory metrics            | Prometheus via Azure Monitor    | Centralised; all 6 clusters push here        |
| Namespace/pod metrics           | Prometheus via Azure Monitor    | Avoid direct K8s Metrics Server queries      |
| Cilium L3/L4 drops & flows     | Prometheus via Hubble metrics   | Hubble relay pushes to Azure Monitor         |
| NetworkPolicy objects           | Kubernetes API (direct)         | No Prometheus equivalent exists              |

### Environment and Cluster Layout

| Environment | ArgoCD Instance | East US Cluster      | West US Cluster      | ArgoCD API Endpoint                       |
| ----------- | --------------- | -------------------- | -------------------- | ----------------------------------------- |
| **DEV**     | argocd-dev      | aks-dev-eastus       | aks-dev-westus       | `https://argocd-dev.platform.internal`    |
| **STAGE**   | argocd-stage    | aks-stage-eastus     | aks-stage-westus     | `https://argocd-stage.platform.internal`  |
| **PROD**    | argocd-prod     | aks-prod-eastus      | aks-prod-westus      | `https://argocd-prod.platform.internal`   |

### Environment Promotion Order

```
DEV-East -> DEV-West -> STAGE-East -> STAGE-West -> PROD-East -> PROD-West
```

Always East before West within each environment tier.

### Secret Management

All credentials stored in Azure Key Vault. External Secrets Operator (ESO) syncs them into
Kubernetes Secrets. Connectors consume via environment variables. No credentials in images or ConfigMaps.

| Credential                    | Injection Path                                          |
| ----------------------------- | ------------------------------------------------------- |
| ArgoCD tokens (1 per env)     | Key Vault -> ESO -> K8s Secret -> env `ARGOCD_TOKEN`    |
| Azure Monitor creds           | Key Vault -> ESO -> K8s Secret -> env `AZURE_CLIENT_*`  |
| K8s API access (network only) | In-cluster ServiceAccount with minimal ClusterRole      |
| Redis password                | Key Vault -> ESO -> K8s Secret -> env `REDIS_PASSWORD`  |

---

## 3. Tech Stack

### Backend

| Component         | Choice                                                    |
| ----------------- | --------------------------------------------------------- |
| Language          | Python 3.14 (`requires-python = ">=3.14"`)                |
| Framework         | FastAPI + Pydantic v2                                     |
| HTTP client       | httpx (AsyncClient with explicit timeouts)                |
| Caching           | redis.asyncio + orjson serialization                      |
| Logging           | structlog (JSON in prod, console in dev)                  |
| Package manager   | **uv** (never pip). `uv.lock` committed. `uv sync --frozen` in CI/Docker. |

### Frontend

| Component         | Choice                                                    |
| ----------------- | --------------------------------------------------------- |
| Framework         | React 18 + TypeScript (strict mode)                       |
| Build tool        | Vite                                                      |
| Data fetching     | React Query v5 (sole data layer)                          |
| Styling           | Tailwind CSS + shadcn/ui                                  |
| Charts            | Recharts                                                  |
| API clients       | Auto-generated from OpenAPI specs (do not hand-edit)      |
| Package manager   | npm (`npm ci` / `npm install`)                            |

### Testing

| Layer    | Framework                                | Coverage Target |
| -------- | ---------------------------------------- | --------------- |
| Python   | pytest + pytest-asyncio + pytest-cov     | 90%+ per connector |
| Frontend | Vitest + React Testing Library + MSW     | 80%+ component logic |

### Infrastructure

| Component         | Choice                                                    |
| ----------------- | --------------------------------------------------------- |
| Container runtime | AKS (Azure Kubernetes Service)                            |
| GitOps            | ArgoCD (watches deploy repo)                              |
| CI                | Azure DevOps Pipelines                                    |
| Manifests         | Kustomize (no Helm)                                       |
| Secrets           | External Secrets Operator + Azure Key Vault               |

---

## 4. How We Build

### OpenSpec Lifecycle

All work follows the OpenSpec API-first methodology. The lifecycle is:

```
propose -> implement (standards-aware) -> review (1-2 reviewers) -> archive
```

1. **Propose** (`/openspec-propose`) — Generate proposal, design, spec, and tasks in `openspec/changes/<name>/`.
2. **Implement** (`/openspec-apply-change`) — Agent implements all tasks autonomously. Human reviews the complete output at the end.
3. **Review** (`/review`) — Smart router selects 1-2 discipline reviewers based on proposal type. Focuses on design judgment, not tool-enforceable standards.
4. **Archive** (`/openspec-archive-change`) — Sync specs, move change to archive.

The agent should be autonomous during implementation. It works through all tasks without stopping for per-task approval. The human reviews and tests the final output.

#### Change Artifacts

Each OpenSpec change produces structured artifacts in `openspec/changes/<name>/`:

| Artifact          | Purpose                                                           |
| ----------------- | ----------------------------------------------------------------- |
| `proposal.md`     | What is being built and why. Problem statement, scope, success criteria. |
| `design.md`       | How the change will be implemented. Architecture, data flow, integration points. |
| `specs/`          | OpenAPI 3.1 delta specs for this change.                          |
| `tasks.md`        | Ordered implementation checklist. Each task is discrete and completable. |
| `.openspec.yaml`  | Change metadata (status, dates, reviewer assignments).            |

Completed changes are archived to `openspec/changes/archive/YYYY-MM-DD-<name>/`.

### Development Workflow

**Branching**: Feature branches off `main`. Branch naming: `<type>/<short-description>` (e.g., `feat/argocd-connector`, `fix/redis-cache-ttl`).

**Commits**: Conventional Commits format — `type(scope): description`.
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`
- Scopes: `argocd`, `prometheus`, `network`, `frontend`, `infra`, `docs`

**Quality gate**: `make check-all` must pass before merge. This is the single gate — if it passes, most standards are met.

**TDD**: Tests are written before implementation code.
- Python: `tests/unit/` for fast isolated tests, `tests/integration/` for service/network tests.
- Frontend: Tests co-located with components (`*.test.tsx`).

### Review Process

Single primary reviewer per proposal type + optional QA pass. The reviewer selection depends on what changed:

| Proposal Type           | Primary Reviewer     | Optional       |
| ----------------------- | -------------------- | -------------- |
| Connector (Python)      | Python Engineer      | QA             |
| Frontend module         | Frontend Developer   | QA             |
| Infrastructure / deploy | K8s/ArgoCD Engineer  | QA             |
| Security-sensitive      | Security Engineer    | QA             |
| CI/CD pipeline          | DevOps Engineer      | QA             |

Available review skills:

| Skill              | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `/review`          | Smart router: auto-selects 1-2 reviewers             |
| `/review-python`   | Single Python Engineer review                        |
| `/review-frontend` | Single Frontend Developer review                     |
| `/review-k8s`      | Single K8s/ArgoCD Engineer review                    |
| `/review-security` | Single Security Engineer review                      |
| `/review-devops`   | Single DevOps Engineer review                        |
| `/review-qa`       | Single QA Test Engineer review                       |

Reviews focus on design judgment — things tools cannot catch:
- API contract correctness (do Pydantic models match the PRD?)
- Error handling logic (does graceful degradation work?)
- Architecture decisions (is the service layer pattern correct?)
- Accessibility design (colour + text indicators? keyboard nav?)
- Security design (credentials in SecretStr? scrub_secrets in chain?)

### Quality Gates

| Command              | What It Runs                                          |
| -------------------- | ----------------------------------------------------- |
| `make lint`          | Ruff check (19 rule sets) on all connectors           |
| `make typecheck`     | mypy --strict on all connectors                       |
| `make test`          | pytest with 90% coverage across all connectors        |
| `make lint-frontend` | ESLint (6 plugins) on frontend                        |
| `make typecheck-frontend` | tsc --noEmit on frontend                         |
| `make test-frontend` | Vitest on frontend                                    |
| `make check`         | lint + typecheck + test (Python)                      |
| `make check-all`     | check + all frontend checks                          |

Pre-commit hooks run on staged files: ruff, mypy, prettier, eslint, detect-secrets, check-yaml, no-commit-to-branch.

### Testing Strategy

#### Python Testing

- **Framework**: pytest + pytest-asyncio (`asyncio_mode = "auto"` — no decorator needed on async tests).
- **Structure**: `connectors/{name}/tests/unit/` and `connectors/{name}/tests/integration/`.
- **Naming**: Test files mirror source: `src/routes/apps.py` -> `tests/unit/test_routes_apps.py`. Functions: `test_<behaviour>`.
- **Mocking**: Mock at boundaries only. Use `httpx.MockTransport` or `respx` for upstream HTTP. Never mock the unit under test.
- **FastAPI test client**: Use `httpx.AsyncClient` with `ASGITransport` (not deprecated `TestClient`).
- **Fixtures**: Shared fixtures in `conftest.py`. Factory fixtures preferred over complex setup.
- **Generated tests**: Spec-conformance tests in `tests/generated/` — auto-generated, do not hand-edit.

#### Frontend Testing

- **Framework**: Vitest + React Testing Library + MSW (Mock Service Worker).
- **Structure**: Co-located with components (`*.test.tsx`).
- **MSW**: Intercepts HTTP at network level, not by mocking fetch. Mock handlers per connector in `frontend/src/mocks/handlers/`.
- **React Query**: Each test creates a fresh `QueryClient` (no retries, no GC). Use `waitFor` for async assertions.
- **Accessibility**: `vitest-axe` assertions on every module-level component.

#### What to Test (Frontend)

| Type                | Coverage                                                     |
| ------------------- | ------------------------------------------------------------ |
| Render tests        | Component with data, empty state, loading state, error state |
| Interaction tests   | Project selector, search filter, refresh button              |
| Query integration   | React Query hooks fetch, cache, and poll correctly           |
| Error boundary      | Module degrades when connector returns 5xx                   |
| Accessibility       | No axe-core violations per module                            |

### Repository Structure

Two repos:
- **`gitops-dashboard`** (this repo) — source code, specs, tests, CI, docs
- **`gitops-dashboard-deploy`** (separate) — Kustomize manifests, overlays, rendered YAML for ArgoCD

Application repo layout:

```
gitops-dashboard/
├── CLAUDE.md                         # Agent instructions (points here)
├── docs/                             # PRDs, standards, guides
├── openspec/                         # OpenSpec artifacts
│   ├── specs/                        # Approved canonical specs
│   └── changes/                      # Active and archived changes
├── specs/                            # OpenAPI 3.1 YAML (source of truth)
├── connectors/                       # Backend microservices (Python)
│   ├── argocd-connector/
│   ├── prometheus-connector/
│   └── network-connector/
├── frontend/                         # React 18 + TypeScript
├── scripts/                          # Dev and CI utility scripts
├── azure-pipelines.yml               # CI pipeline
└── Makefile                          # Local dev commands
```

---

## 5. Key Technical Rules

The 20% of standards that prevent 80% of issues. For the full specification, see
`docs/TECH-STANDARDS.md`.

### Python

#### Package Management
- **uv for everything.** Never use `pip install` directly.
- `uv.lock` is committed to the repository.
- CI and Docker builds use `uv sync --frozen` for reproducible installs.
- Add dependencies: `uv add <package>`. Dev dependencies: `uv add --group dev <package>`.

#### Naming Conventions (Python)

| Element      | Convention         | Example              |
| ------------ | ------------------ | -------------------- |
| Functions    | `snake_case`       | `get_app_status`     |
| Variables    | `snake_case`       | `cache_ttl`          |
| Modules      | `snake_case`       | `argocd_client.py`   |
| Classes      | `PascalCase`       | `ApplicationStatus`  |
| Constants    | `UPPER_SNAKE_CASE` | `REDIS_TTL_SECONDS`  |
| Env vars     | `UPPER_SNAKE_CASE` | `ARGOCD_SERVER_URL`  |

#### Naming Conventions (Frontend)

| Element      | Convention           | Example                    |
| ------------ | -------------------- | -------------------------- |
| Components   | `PascalCase`         | `AppStatusGrid.tsx`        |
| Hooks        | `use` + `PascalCase` | `useAppStatus.ts`          |
| Utilities    | `camelCase`          | `formatTimestamp.ts`       |
| Constants    | `UPPER_SNAKE_CASE`   | `POLLING_INTERVAL_MS`      |
| File names   | `kebab-case`         | `app-status-grid.tsx`      |
| Test files   | `*.test.tsx`         | `app-status-grid.test.tsx` |

#### Linting and Formatting
- **Ruff** is the single tool for linting and formatting.
- All config lives in `pyproject.toml` under `[tool.ruff]`. No `ruff.toml` files.
- Line length: 99 characters.
- 19 rule sets enabled: E, F, W, I, UP, S, B, A, C4, PT, SIM, TCH, DTZ, PIE, RSE, RET, FBT, ASYNC, RUF.
- `# noqa` comments must include the rule code and justification. Bare `# noqa` is banned.

#### Type Checking
- `mypy --strict` must pass with zero errors.
- All functions and methods must have complete type annotations.
- Avoid `Any` except at true integration boundaries (raw upstream API responses before Pydantic validation).
- Use `TYPE_CHECKING` imports for annotations only needed at type-check time.

#### FastAPI Patterns
- **Lifespan context manager** for startup/shutdown. No `@app.on_event` (deprecated).
- `httpx.AsyncClient` with explicit timeouts: `Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)`. Never `timeout=None`.
- One `httpx.AsyncClient` per process, created at startup, closed at shutdown.
- Dependency injection via `Depends()`. Avoid global mutable state.
- `async def` for all route handlers and upstream API calls.

#### Pydantic v2
- `model_config = ConfigDict(...)` not `class Config:` (deprecated).
- `model_dump()` / `model_dump_json()` not `.dict()` / `.json()` (deprecated).
- `field_validator` / `model_validator` not `validator` / `root_validator` (deprecated).
- `BaseSettings` with `SettingsConfigDict(env_prefix=...)` for config. Prefixes: `ARGOCD_`, `PROMETHEUS_`, `NETWORK_`.
- `ConfigDict(strict=True)` on request/response models.
- `frozen=True` for response schemas — responses are immutable once constructed.
- `SecretStr` for all credentials (tokens, passwords, client secrets). Access raw value only via `.get_secret_value()`.

#### Structured Logging
- **structlog** with JSON rendering in production, console in dev.
- No `print()` statements. No direct `logging` stdlib usage.
- All log entries must include: `connector`, `environment`, `region`, `endpoint`, `request_id`.
- `scrub_secrets` processor must be in the structlog chain for all environments.
- `configure_logging()` must be called at startup.
- Log levels: `debug` (cache hits/misses, request details), `info` (one per request), `warning` (recoverable issues like Redis down), `error` (upstream 5xx, auth failure), `critical` (startup failure).

#### Redis
- Uniform 30-minute TTL on every `SET` operation. No keys without TTL.
- Key naming: `{connector}:{environment}:{region}:{resource}` (e.g., `argocd:dev:eastus:apps`).
- `redis.asyncio` client with password via `REDIS_PASSWORD` env var.
- Serialization: `orjson.dumps()` / `orjson.loads()`. Pydantic via `model_dump_json()` / `model_validate_json()`.
- Cache errors are warnings, not failures. Redis down = fall through to live upstream fetch.
- No `KEYS *`, `FLUSHALL`, `FLUSHDB`, `DEBUG`, `EVAL`, or `EVALSHA`.

#### Environment Variable Naming

All connector env vars follow `{CONNECTOR_PREFIX}_{DESCRIPTOR}`:

| Connector  | Prefix        | Examples                                          |
| ---------- | ------------- | ------------------------------------------------- |
| argocd     | `ARGOCD_`     | `ARGOCD_SERVER_URL`, `ARGOCD_TOKEN`, `ARGOCD_ENV` |
| prometheus | `PROMETHEUS_` | `PROMETHEUS_ENDPOINT`, `PROMETHEUS_CLIENT_ID`     |
| network    | `NETWORK_`    | `NETWORK_CLUSTER`, `NETWORK_REGION`               |
| shared     | (no prefix)   | `REDIS_URL`, `REDIS_PASSWORD`, `LOG_LEVEL`        |

Azure credentials use `AZURE_` prefix: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`.

#### Health Endpoints
- `/healthz` — Liveness. Process running, event loop responsive. No upstream checks.
- `/readyz` — Readiness. Upstream API reachable AND Redis reachable.
- Response includes `status`, `connector`, `environment`, `region`, `checks`, `timestamp`.
- Failed check: status becomes `"degraded"`, response code 503.

#### Error Handling
- Exception hierarchy: `ConnectorError` base, with `UpstreamUnavailableError`, `UpstreamTimeoutError`, `UpstreamAuthError`, `CacheError`.
- Upstream unavailable/timeout: return cached data if available, 502/504 if not.
- Auth failure: 502 (do not leak auth details). Cache error: warning + fall through.
- Error responses use a consistent `ErrorResponse` Pydantic model. No stack traces, file paths, or env vars in production responses.

### Frontend

#### TypeScript Configuration
- `strict: true` plus: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`.
- No `any` types except in auto-generated API client code. Use `unknown` + type narrowing.
- No `@ts-ignore` or `@ts-expect-error` without a linked issue.

#### ESLint
- 6 plugins: `@typescript-eslint`, `react-hooks`, `react`, `jsx-a11y`, `security`, `import`.
- No default exports (exception: `React.lazy()` route components).
- No inline rule disabling without justification and specific rule name.

#### React Query
- React Query v5 is the sole data-fetching layer. No `useEffect` + `fetch`.
- `staleTime`: 30 minutes (matches connector TTL).
- `gcTime`: 60 minutes.
- `refetchIntervalInBackground: false` — pause polling on hidden tabs.
- Query key factory pattern in a single `query-keys.ts` file.
- Components never construct key arrays manually.

#### Component Patterns
- Functional components only. No class components.
- Props typed as `readonly`. Explicit `ReactElement` return types.
- No prop spreading (`<Component {...props} />`).
- Error boundaries per module (app status, image promotion, metrics, network).
- `React.lazy()` code splitting per module. Skeleton loaders (not spinners).

#### Runtime Configuration
- `/config.json` served by nginx (ConfigMap-mounted). Loaded once at startup.
- No `VITE_*` build-time env vars in production. `VITE_*` only for local dev proxy.
- No secrets in config.json — only cluster-internal Service DNS names.

#### Accessibility
- WCAG 2.1 Level AA compliance.
- Every status indicator: colour + text label or icon. Never colour alone.
- Colour contrast: 4.5:1 normal text, 3:1 large text/UI components.
- All interactive elements keyboard-accessible. No tab traps.
- `aria-live="polite"` for data refresh timestamps and status changes.
- Sparkline charts include `aria-label` with trend summary.

#### Security
- No unsafe HTML rendering. Banned project-wide via ESLint `react/no-danger` rule.
- `localStorage` only for UI preferences (project scope, env/region filter) with `gitops-dashboard:` prefix. Never tokens, API responses, or PII.
- Production builds must not ship source maps.

### Docker and Security

#### Container Builds
- Multi-stage builds for all images.
- Connectors: builder runs `uv sync --frozen --no-dev`, final stage `python:3.14-slim`.
- Frontend: builder runs `npm ci && npm run build`, final stage `nginx:alpine`.
- Non-root user (UID 1000) in all containers.
- Base images version-pinned (digest pins when available).

#### Runtime Security
- `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false`.
- Drop ALL capabilities. Seccomp `RuntimeDefault`.
- `automountServiceAccountToken: false` on all pods except network-connector.

#### Network and API Security
- Redis requires password. Authenticated connections only.
- CORS: explicit origins (never `*`), methods restricted to `GET`.
- `TrustedHostMiddleware` with specific allowed hosts.
- TLS verification enabled on all upstream connections. No `verify=False`.
- CSP headers on nginx: `default-src 'self'`, `frame-ancestors 'none'`, `form-action 'none'`.

#### Secret Detection
- `detect-secrets` runs as pre-commit hook and CI step.
- `.secrets.baseline` committed and maintained.
- `.gitignore` includes: `.env`, `*.pem`, `*.key`, `credentials.json`, `**/secrets/`.

---

## 6. Phase Plan

### Methodology POC (Current — Week 0)

Prove the OpenSpec lifecycle works end-to-end with a narrow vertical slice:

- argocd-connector `/healthz` + `/apps` endpoints with mock ArgoCD responses
- Redis caching with 30-min TTL
- structlog with scrub_secrets processor
- TDD test suite (90%+ coverage)
- Docker build and run
- Full lifecycle: propose -> review -> implement -> review -> archive

**Gate**: `make check` passes. Docker image serves `/healthz` (200) and `/apps` (mock data). Review findings addressed and archived.

### Phase 0 — Mock UI Dashboard (Weeks 1-3)

- React frontend with MSW mock data representing all 3 envs x 2 regions
- Visual contract for all subsequent phases
- Docker-deployable static UI
- Docs: README, QUICKSTART, TROUBLESHOOTING

**Gate**: Mockup Docker image builds and runs. Stakeholder sign-off on layout.

### Phase 1 — ArgoCD Connector + App Status (Weeks 4-6)

- PROP-01: argocd-connector full API surface (3 env-parameterised instances)
- PROP-02: Frontend modules 1 (App Status) and 2 (Image Promotion) wired to live data
- Promotion pipeline view operational
- Swagger UI verified on all 3 instances

**Gate**: All 3 ArgoCD environments visible with correct East/West routing.

### Phase 2 — Prometheus Connector + Metrics (Weeks 7-9)

- PROP-03: prometheus-connector wired to Azure Monitor Workspace
- Frontend module 3 (CPU/Memory Metrics) operational
- Multi-env label filtering, namespace and workload-level granularity

**Gate**: Prometheus connector returns correctly labelled metrics for all 6 clusters.

### Phase 3 — Network Connector + Network Status (Weeks 10-12)

- PROP-04: network-connector (6 instances, one per AKS cluster)
- Frontend module 4 (Network Status) operational
- All connectors deployed via ArgoCD with ESO-managed secrets
- OPERATIONS.md and RUNBOOK.md initial versions

**Gate**: All 6 network-connector instances pass integration tests.

### Phase 4 — Integration and Pilot (Weeks 13-15)

- Spec-conformance validation across all connectors
- End-to-end integration tests
- Performance hardening (P95 load time < 3s)
- Pilot rollout to early-adopter tenants
- All documentation reviewed and finalised

**Gate**: Spec-conformance passes. Pilot tenant onboarded. Docs validated.

---

## 7. Reference Documents

| Document | Location | Purpose |
| -------- | -------- | ------- |
| **PRD** | `docs/PRD-gitops-dashboard.md` | Full product requirements — user stories, connector specs, frontend modules, deployment topology, phased rollout. Read for deep dives into specific features. |
| **Tech Standards** | `docs/TECH-STANDARDS.md` | Full technical standards (~2000 lines) — every rule for Python, TypeScript, Docker, K8s, security, CI. Read for specific rule lookups not covered in Section 5. |
| **Feedback Assessment** | `docs/CLAUDE-FEEDBACK.md` | Project methodology critique — documentation-to-code ratio, review overhead, frontend risk, likelihood of MVP. |
| **Acceleration Recommendations** | `docs/CLAUDE-ACCELERATION-RECOMMENDATIONS.md` | Process improvement recommendations — consolidated context, streamlined reviews, agent autonomy, tooling enforcement. |
| **Pipeline PRD** | `docs/PRD-v2-gitops-pipelines.md` | Azure DevOps pipeline templates — container builds, manifest rendering, security scanning. |
| **OpenSpec Artifacts** | `openspec/` | Active and archived proposals, specs, designs, and task lists. |
| **OpenAPI Specs** | `specs/` | Canonical OpenAPI 3.1 YAML files — source of truth for code generation. |

### Key Decisions (Resolved)

These decisions are final. Do not revisit unless explicitly reopened by the project owner.

- **Uniform 30-min cache TTL** — reporting tool, not real-time. Manual refresh available.
- **No direct K8s API** except NetworkPolicy reads.
- **Kustomize only** — no Helm.
- **Dashboard deploys to DEV East US** only. Single deployment target.
- **Non-mutating** — read-only queries. All writes through CI/CD and ArgoCD.
- **Soft tenancy** — all authenticated users see all data. No per-team RBAC.
- **Tier II** — no formal SLAs. Best-effort availability.
- **Methodology POC before Phase 0** — validate the lifecycle produces working code.
- **Agent autonomy during implementation** — agent runs all tasks, human reviews at end.
- **`make check-all` is the quality gate** — not review documents.
