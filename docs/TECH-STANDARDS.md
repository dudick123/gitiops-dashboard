# Technical Development Standards — GitOps Platform Dashboard

| Field          | Value                          |
| -------------- | ------------------------------ |
| **Version**    | 1.5                            |
| **Status**     | Draft                          |
| **Date**       | 2026-03-22                     |
| **Applies To** | All connectors, frontend, and CI pipelines in the `gitops-dashboard` repository |

> This document defines the enforceable coding, tooling, and workflow standards for the GitOps Dashboard project. It complements the PRD (§4–§8) with implementation-level rules that CI pipelines and code reviews enforce.

---

## 1. Python Code Style (Connectors)

### PEP Compliance

All connector code MUST comply with:

- **PEP 8** — code style
- **PEP 257** — docstrings for public API surfaces
- **PEP 484** — type annotations on all functions and methods

### Python Version

- **Minimum**: Python 3.14. Enforced via `requires-python = ">=3.14"` in each connector's `pyproject.toml`.
- Use modern syntax unconditionally: `X | Y` unions, `type` statements, `match`/`case`. No `from __future__ import annotations` needed.

### Formatting

- **Tool**: Ruff formatter (`ruff format`)
- **Line length**: 99 characters
- **Config location**: All Ruff configuration lives in `pyproject.toml` under `[tool.ruff]`. No `ruff.toml` or `.ruff.toml` files.
- Ruff is the single source of truth for formatting — no manual overrides.

### Linting

- **Tool**: Ruff linter (`ruff check`)
- **Enabled rule sets** (minimum):

| Rule Set | Scope |
| -------- | ----- |
| E        | pycodestyle errors |
| F        | Pyflakes |
| W        | pycodestyle warnings |
| I        | isort (import sorting) |
| UP       | pyupgrade |
| S        | flake8-bandit (security) |
| B        | flake8-bugbear |
| A        | flake8-builtins |
| C4       | flake8-comprehensions |
| PT       | flake8-pytest-style |
| SIM      | flake8-simplify |
| TCH      | flake8-type-checking (TYPE_CHECKING imports) |
| DTZ      | flake8-datetimez (timezone-aware datetimes) |
| PIE      | flake8-pie (misc improvements) |
| RSE      | flake8-raise |
| RET      | flake8-return |
| FBT      | flake8-boolean-trap |
| ASYNC    | flake8-async (async correctness) |
| RUF      | Ruff-specific rules |

- **Suppressing rules**: `# noqa` comments MUST include the rule code (e.g., `# noqa: S101`) and a justification comment. Bare `# noqa` is not permitted. `S` (bandit) suppressions require code review approval.

### Type Annotations

- All functions and methods MUST have complete type annotations.
- `mypy --strict` MUST pass with zero errors across all connector packages.
- Avoid `Any` except at true integration boundaries (e.g., raw upstream API responses before Pydantic validation). Prefer explicit types and generics.
- Use `TYPE_CHECKING` imports for annotations that are only needed at type-check time (enforced by `TCH` rule set).

### Naming Conventions

| Element      | Convention         | Example                |
| ------------ | ------------------ | ---------------------- |
| Functions    | `snake_case`       | `get_app_status`       |
| Variables    | `snake_case`       | `cache_ttl`            |
| Modules      | `snake_case`       | `argocd_client.py`     |
| Classes      | `PascalCase`       | `ApplicationStatus`    |
| Constants    | `UPPER_SNAKE_CASE` | `REDIS_TTL_SECONDS`    |
| Env vars     | `UPPER_SNAKE_CASE` | `ARGOCD_SERVER_URL`    |
| Type aliases | `PascalCase`       | `AppStatusMap`         |

### Imports

- Sorted by Ruff (isort rules): standard library → third-party → local.
- No wildcard imports (`from x import *`).
- Heavy type-only imports (e.g., `from pydantic import ...` used only in annotations) belong behind `if TYPE_CHECKING:`.

### Docstrings

- **Style**: Google style.
- Required on all public modules, classes, and functions.
- Generated stub code retains docstrings from OpenAPI spec descriptions.

---

## 2. TypeScript / React Code Style (Frontend)

> **Team context**: The development team has no prior React experience (PRD §6.1). This section is intentionally prescriptive to establish guardrails. API clients are auto-generated from OpenAPI specs — the team's hand-written TypeScript is limited to component composition, hooks, and layout.

### TypeScript Configuration

- **Strict mode**: `"strict": true` in `tsconfig.json`.
- **Enhanced strictness**: The following additional compiler flags MUST be enabled:

| Flag | Why It Matters |
| ---- | -------------- |
| `noUncheckedIndexedAccess` | API responses are arrays and records. Without this, `apps[0].health` compiles without null-checking even when `apps` might be empty. Critical for a dashboard consuming external data. |
| `exactOptionalPropertyTypes` | Prevents `undefined` from being assignable to optional properties that expect a specific type. Catches connector response mismatches early. |
| `noPropertyAccessFromIndexSignature` | Forces bracket notation for dynamic keys, making it obvious when accessing untyped data. |
| `forceConsistentCasingInFileNames` | Prevents cross-platform import resolution bugs. |
| `verbatimModuleSyntax` | Ensures `import type` is used for type-only imports, matching Python's `TYPE_CHECKING` pattern. |

- No `any` types except in auto-generated API client code. Use `unknown` + type narrowing when the type is genuinely unknown.
- No `@ts-ignore` or `@ts-expect-error` without a linked issue explaining why.

### Formatting and Linting

- **Formatter**: Prettier (configured in `.prettierrc`). Line width: 100 (matches Python's 99).
- **Linter**: ESLint with the following plugins:

| Plugin | Purpose |
| ------ | ------- |
| `@typescript-eslint` | TypeScript-aware linting rules |
| `eslint-plugin-react-hooks` | Enforces Rules of Hooks, dependency arrays |
| `eslint-plugin-react` | JSX best practices, prop validation |
| `eslint-plugin-jsx-a11y` | Accessibility — catches missing `alt`, broken ARIA roles, non-interactive element handlers |
| `eslint-plugin-security` | Detects DOM XSS patterns, unsafe innerHTML, regex DoS |
| `eslint-plugin-import` | Import ordering, no unused imports, no circular dependencies |

- Format on save enabled in IDE configuration.
- **No disabling rules inline**: `// eslint-disable-next-line` requires a justification comment and the specific rule name. Blanket `// eslint-disable` is not permitted.

### TypeScript Naming Conventions

| Element          | Convention           | Example                    |
| ---------------- | -------------------- | -------------------------- |
| Components       | `PascalCase`         | `AppStatusGrid.tsx`        |
| Hooks            | `use` + `PascalCase` | `useAppStatus.ts`          |
| Utilities        | `camelCase`          | `formatTimestamp.ts`       |
| Constants        | `UPPER_SNAKE_CASE`   | `POLLING_INTERVAL_MS`      |
| Types            | `PascalCase`         | `ApplicationResponse`      |
| Enum members     | `PascalCase`         | `HealthStatus.Healthy`     |
| File names       | `kebab-case`         | `app-status-grid.tsx`      |
| Test files       | `*.test.tsx`         | `app-status-grid.test.tsx` |

- **No default exports**: Use named exports everywhere. Default exports make refactoring harder and provide worse IDE auto-import. Exception: `React.lazy()` route components require default exports — wrap the named export.
- **One component per file**: Each `.tsx` file exports a single React component. Co-located hooks, types, and utilities are fine in the same file if tightly coupled and small.

### Auto-Generated Code

- Files under `frontend/src/api/` are auto-generated from OpenAPI specs — **DO NOT hand-edit**.
- Generated files include a header comment: `// This file is auto-generated. Do not edit manually.`
- Regeneration is triggered by `make generate-ts-clients` or the equivalent script.
- Generated types SHOULD be re-exported from a barrel file (`frontend/src/api/index.ts`) so components import from `@/api`, not deep paths.
- The auto-generated client configures the base URL, authorization header, and request interceptors in a single shared instance (`frontend/src/api/client.ts`). Components never construct HTTP requests directly.

### React Component Patterns

#### Component Composition

- **Functional components only**: No class components. All components use function declarations with explicit return types.
- **Props typing**: Every component's props are defined as a dedicated `type` in the same file. Use `readonly` on props and array types to prevent accidental mutation.
- **No prop spreading**: `<Component {...props} />` is banned. It obscures what props a component receives, breaks type safety, and passes unintended DOM attributes. Pass props explicitly.

#### Error Boundaries

Every dashboard module (App Status, Image Promotion, Metrics, Network Status) MUST be wrapped in an error boundary using `react-error-boundary`:

- A connector failure MUST NOT crash the entire dashboard. Each module degrades independently per PRD §4.6 (Degraded State Behaviour).
- The fallback component displays the module name, a "data unavailable" message, and a retry button. No stack traces or technical details shown to the user.
- Use `resetKeys` tied to the project scope selector for automatic recovery when the user changes projects.

#### Memoisation

- Use `React.memo()` on pure presentational components that receive stable props (e.g., status badges, table cells).
- Use `useMemo` for expensive computations only: filtering/sorting 850+ applications, computing promotion pipeline mismatches.
- Use `useCallback` for functions passed as props to memoised children — only when verified necessary via React DevTools profiler.
- **Never premature-optimise**: Add memo/useMemo/useCallback only after identifying a measured performance issue.

#### Suspense and Loading States

- Use `React.Suspense` with skeleton loaders (not spinners) for initial data loading per module — skeletons provide better perceived performance for a data-dense dashboard.
- Background refetches (`refetchInterval`) update silently — no loading indicators. The "Last updated" timestamp (PRD §5.4) indicates data freshness.

### React Query Configuration

React Query v5 is the sole data-fetching layer. No `useEffect` + `fetch`, no `axios` in components, no custom data stores.

#### Query Client Defaults

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,          // 30s — matches fastest connector TTL
      gcTime: 5 * 60_000,         // 5 min garbage collection
      retry: 2,                   // 2 retries on failure
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: true, // refresh stale data when user returns to tab
      refetchOnReconnect: true,   // refresh after network recovery
    },
  },
});
```

#### Per-Connector Polling

| Connector | `refetchInterval` | `staleTime` | Rationale |
| --------- | ------------------ | ----------- | --------- |
| argocd-connector | 30,000 ms | 30,000 ms | Matches 30s Redis TTL |
| prometheus-connector | 60,000 ms | 60,000 ms | Matches 60s Redis TTL |
| network-connector | 120,000 ms | 120,000 ms | Matches 120s Redis TTL |

- **Pause polling on hidden tabs**: Set `refetchIntervalInBackground: false` on all polling queries. A background tab polling 3 connectors every 30s is wasted load.

#### Query Key Convention

Query keys follow a hierarchical factory pattern in a single `query-keys.ts` file:

```tsx
// Pattern: [connector, resource, ...params]
export const queryKeys = {
  argocd: {
    apps: (env: string, project?: string) =>
      ["argocd", "apps", env, project] as const,
    appSets: (env: string, project?: string) =>
      ["argocd", "appsets", env, project] as const,
    projects: (env: string) =>
      ["argocd", "projects", env] as const,
  },
  prometheus: {
    cpu: (env: string, region: string, ns?: string) =>
      ["prometheus", "cpu", env, region, ns] as const,
    memory: (env: string, region: string, ns?: string) =>
      ["prometheus", "memory", env, region, ns] as const,
  },
  network: {
    policies: (cluster: string, ns?: string) =>
      ["network", "policies", cluster, ns] as const,
  },
} as const;
```

- Components never construct key arrays manually.
- Changing the project scope invalidates queries via prefix: `queryClient.invalidateQueries({ queryKey: ["argocd"] })`.

### Frontend Environment Configuration

The React app MUST NOT embed connector URLs at build time. Runtime configuration is injected via a JSON file served by nginx:

```json
{
  "argocdConnectorUrls": {
    "dev": "http://argocd-connector-dev:8080",
    "stage": "http://argocd-connector-stage:8080",
    "prod": "http://argocd-connector-prod:8080"
  },
  "prometheusConnectorUrl": "http://prometheus-connector:8080",
  "networkConnectorUrls": {
    "dev-eastus": "http://network-connector-dev-eastus:8080"
  }
}
```

- **`/config.json`** is a ConfigMap mounted into the nginx container. Changing a connector URL requires a ConfigMap patch, not an image rebuild.
- Loaded once at app startup, before React renders. Failure to load config prevents app boot with a clear error screen.
- **Local development**: `vite.config.ts` proxies `/api/*` to local connector instances. `VITE_*` env vars are used only for the dev proxy config, never baked into production builds.
- **No secrets in config.json**: This file is served publicly by nginx. It contains only cluster-internal Service DNS names. Never include tokens, API keys, or credentials.

### Frontend Performance Standards

#### Code Splitting

Each dashboard module MUST be lazily loaded via `React.lazy()` + `Suspense`. The initial bundle contains only the shell, navigation, and project selector. Module code loads on navigation.

- **Bundle budget**: Initial JavaScript (gzipped) MUST NOT exceed 200KB. Individual module chunks under 100KB. Enforced by a CI step running `bundlesize` or equivalent.

#### Large List Virtualisation

The "All Projects" view renders 850+ applications. Use `@tanstack/react-virtual` for virtualised scrolling:

- Only rows within the viewport (+ overscan buffer) are rendered as DOM nodes.
- Applies to: App Status grid, Image Promotion grid, OOM event log.

#### React Key Strategy

- Use `app.metadata.name + environment + region` as the key for application rows (guaranteed unique per the ArgoCD data model).
- Never use array index as a key — application lists are filtered, sorted, and paginated.

#### Lighthouse Targets

| Metric | Target |
| ------ | ------ |
| Performance score | > 80 |
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Cumulative Layout Shift | < 0.1 |
| Total Blocking Time | < 300ms |

Lighthouse CI runs in the PR pipeline against a production build with mock data.

### Accessibility Standards

The dashboard MUST meet **WCAG 2.1 Level AA** compliance.

#### Colour and Status Indicators

The PRD (§5.3) defines colour-coded health status: green (Healthy), amber (Degraded), red (Error/Unknown). Colour alone is insufficient:

- Every status indicator MUST include a text label or icon alongside the colour: checkmark for Healthy, warning for Degraded, cross for Error.
- Colour contrast ratios MUST meet WCAG AA minimums: 4.5:1 for normal text, 3:1 for large text and UI components.
- Status colours are defined as design tokens in `tailwind.config.ts` and tested against both light and dark backgrounds.

#### Keyboard Navigation

- All interactive elements MUST be keyboard-accessible.
- Focus order follows visual layout. Tab traps are prohibited.
- The project scope selector, environment filter, and region filter are operable via keyboard without a mouse.

#### ARIA and Semantic HTML

- Use semantic HTML elements (`<table>`, `<thead>`, `<th>`, `<nav>`, `<main>`, `<section>`) — not `<div>` soup.
- Data grids use `role="grid"` with proper `role="row"` and `role="gridcell"` when `<table>` is not sufficient.
- Live regions (`aria-live="polite"`) announce data refresh timestamps and status changes without requiring focus.
- Sparkline charts include `aria-label` with the trend summary (e.g., "CPU usage trending up, current 72%").

#### Accessibility Testing

- `eslint-plugin-jsx-a11y` catches structural issues at lint time.
- `@axe-core/react` runs in development mode, logging violations to the browser console.
- Vitest tests include `axe-core` assertions via `vitest-axe` on every module-level component.

### Frontend Security Patterns

#### XSS Prevention

- **No unsafe HTML rendering**: Banned project-wide via ESLint rule `react/no-danger`. Application names, namespace names, and status values from connector APIs are rendered as text nodes, never as HTML.
- If a future requirement needs HTML rendering, use a sanitisation library (`DOMPurify`) with security review approval.
- **No dynamic code execution**: Enforced by CSP `script-src 'self'` (§12.12) and ESLint `security/detect-eval-with-expression`.

#### `localStorage` Security

The PRD requires project selection to persist in `localStorage` (PS-04). Rules:

| What MAY be stored | What MUST NOT be stored |
| ------------------- | ----------------------- |
| Selected project name (string) | Authentication tokens (SSO/OIDC) |
| Environment filter preference | API responses or cached data |
| Region filter preference | User PII (email, name) |
| UI state (collapsed sections) | Connector URLs or configuration |

- `localStorage` is accessible to any JavaScript on the same origin. An XSS vulnerability would expose everything stored there. Only UI preferences — never security-sensitive data.
- Use a namespace prefix for all keys: `gitops-dashboard:projectScope`, `gitops-dashboard:envFilter`.

#### Source Maps

- **Production builds MUST NOT ship source maps**. Source maps expose the component hierarchy, query key structure, and internal logic.
- Vite config: `build: { sourcemap: false }`.
- If source maps are needed for error debugging, upload them to the error reporting service via CI — not to the nginx server.

#### Frontend Error Reporting

Client-side errors (uncaught exceptions, error boundary catches, failed API requests) MUST be captured:

- Use a lightweight error reporting integration (Sentry or Azure Application Insights JS SDK).
- Error boundary `onError` callbacks forward the error to the reporting service.
- React Query global `onError` callbacks (via `QueryCache`) forward failed API requests with the query key and status code.
- **No PII in error reports**: Error payloads include component stack, query key, and connector URL — never user identity, tokens, or localStorage values.

#### Dependency Addition Policy

Before adding a new npm dependency, the following checks must pass:

| Check | Requirement |
| ----- | ----------- |
| Bundle size impact | < 50KB gzipped unless justified (check via `bundlephobia`) |
| Maintenance status | Published within 12 months, > 1 active maintainer |
| Security advisories | `npm audit` clean for the package and transitive dependencies |
| License | MIT, Apache-2.0, or BSD. No copyleft (GPL, LGPL) in runtime dependencies |
| Alternatives | Document why a native API or existing dependency cannot solve the problem |

This is especially important for this team — without React experience, the temptation to add packages for every problem is high. Fewer dependencies means fewer security vectors and less maintenance burden.

---

## 3. Dependency Management

### Python (Connectors)

- **`uv`** is the sole package manager. Never use `pip install` directly.
- Dependencies declared in each connector's `pyproject.toml` under `[project.dependencies]` and `[project.optional-dependencies]`.
- **Pinning strategy**: Use lower-bound pins for direct dependencies (e.g., `fastapi>=0.115.0`). `uv.lock` captures the exact resolved versions. Upper bounds are only added when a known incompatibility exists.
- `uv.lock` is committed to the repository.
- All CI and container builds use `uv sync --frozen` for reproducible installs.
- Add dependencies: `uv add <package>`. Add dev dependencies: `uv add --group dev <package>`.
- **Shared dev dependencies**: Common dev tools (`ruff`, `mypy`, `pytest`, `pytest-asyncio`, `pytest-cov`, `pytest-mock`) are declared in a workspace-level `pyproject.toml` dev group so all connectors share the same versions.
- **Vulnerability scanning**: See §12 Security Standards — Dependency and Supply Chain Security.

### Frontend

- **`npm`** (or `pnpm` if adopted) for frontend package management.
- `package-lock.json` (or `pnpm-lock.yaml`) is committed.
- CI uses `npm ci` (or `pnpm install --frozen-lockfile`) for reproducible installs.
- **Vulnerability scanning**: See §12 Security Standards — Dependency and Supply Chain Security.

---

## 4. Architecture Patterns

### Connector Microservices (Python / FastAPI)

- **One connector per data source**: argocd-connector, prometheus-connector, network-connector. No cross-connector imports.
- **FastAPI + Pydantic v2**: All HTTP endpoints use Pydantic v2 request/response models. No raw `dict` access for configuration or API responses.
- **Dependency injection via function arguments**: Avoid global mutable state. Pass config, Redis clients, metrics collectors, and loggers explicitly. Use FastAPI's `Depends()` for route-level injection.
- **Async-first**: FastAPI runs on an async event loop. Use `async def` for route handlers and upstream API calls. Use `asyncio.Semaphore` or similar for bounded concurrency when fan-out is needed (e.g., argocd-connector querying multiple clusters).

### HTTP Client

- **`httpx`** is the mandated HTTP client for all upstream API calls (ArgoCD API, Azure Monitor Workspace).
- Use `httpx.AsyncClient` with explicit lifecycle management via FastAPI lifespan (see below).
- **Connection pooling**: One `httpx.AsyncClient` instance per connector process, created at startup and closed at shutdown. Do not create per-request clients.
- **Timeouts**: All `httpx.AsyncClient` instances MUST set explicit timeouts. Default: `httpx.Timeout(connect=5.0, read=30.0, write=10.0, pool=5.0)`. Override per-connector if upstream characteristics differ. **Never use `timeout=None`** — unbounded timeouts are a denial-of-service vector.
- **SSL/TLS**: See §12.3 Transport Security.
- **Retries**: Use `httpx` transport-level retries with exponential backoff for transient failures (5xx, connection errors). Max 3 retries. Do not retry 4xx responses.

### FastAPI Lifespan

All connectors MUST use the FastAPI lifespan context manager for startup/shutdown lifecycle:

```python
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Startup: create httpx client, Redis pool, structlog config
    async with httpx.AsyncClient(...) as client:
        app.state.http_client = client
        app.state.redis = await create_redis_pool(...)
        yield
    # Shutdown: connections closed automatically by context managers
```

No `@app.on_event("startup")` / `@app.on_event("shutdown")` — these are deprecated in FastAPI.

See §13.5 for Kubernetes graceful shutdown integration (`terminationGracePeriodSeconds`, `preStop` hook, SIGTERM handling).

### Error Handling

#### Exception Hierarchy

Each connector defines a base exception and specific subtypes:

```text
ConnectorError (base)
├── UpstreamUnavailableError   — upstream API returned 5xx or connection failed
├── UpstreamTimeoutError       — upstream API exceeded read timeout
├── UpstreamAuthError          — 401/403 from upstream API
└── CacheError                 — Redis operation failed (non-fatal)
```

#### HTTP Status Code Mapping

| Connector Exception        | HTTP Response | Behaviour |
| -------------------------- | ------------- | --------- |
| `UpstreamUnavailableError` | 502           | Return last cached data if available, 502 if no cache |
| `UpstreamTimeoutError`     | 504           | Return last cached data if available, 504 if no cache |
| `UpstreamAuthError`        | 502           | Log at `error` level, return 502 (do not leak auth details to client) |
| `CacheError`               | (transparent) | Log at `warning` level, fall through to live upstream fetch |
| Unhandled exception        | 500           | Log full traceback at `error` level, return generic 500 body with no internal details |

#### FastAPI Exception Handlers

Register exception handlers via `app.exception_handler()` at startup. All error responses MUST use a consistent Pydantic error model:

```python
class ErrorResponse(BaseModel):
    error: str          # Machine-readable error code (e.g., "upstream_unavailable")
    detail: str         # Human-readable description (no stack traces, secrets, or internal paths)
    connector: str      # Connector name
    timestamp: datetime  # UTC timestamp
```

### Redis Conventions

- **Client library**: `redis.asyncio` (async Redis client).
- **Authentication**: All Redis connections MUST use a password via `REDIS_PASSWORD` env var, injected from Azure Key Vault through ESO. See §12.5.
- **Connection pooling**: One `redis.asyncio.ConnectionPool` per connector process, created at startup via lifespan.
- **Key naming**: `{connector}:{environment}:{region}:{resource}` — e.g., `argocd:dev:eastus:apps`, `prometheus:prod:westus:cpu`.
- **Serialization**: `orjson.dumps()` / `orjson.loads()` for cache values. Pydantic models serialized via `model.model_dump_json()` and deserialized via `Model.model_validate_json()`.
- **TTL enforcement**: TTLs set on every `SET` operation. No keys without TTL.
- **Fallback on failure**: If Redis is unreachable, log at `warning` level and fall through to live upstream fetch. Redis errors MUST NOT cause 5xx responses — cache is an optimisation, not a dependency.
- **No persistence**: Redis deployed with `save ""` and `appendonly no`. Data is ephemeral.
- **Transport encryption**: See §12.5 for Redis TLS requirements.

### Pydantic v2 Conventions

- Use `model_config = ConfigDict(...)` (class-level), not `class Config:` (deprecated).
- Use `model_dump()` / `model_dump_json()`, not `.dict()` / `.json()` (deprecated).
- Use `field_validator` / `model_validator` decorators, not `validator` / `root_validator` (deprecated).
- `BaseSettings` with `SettingsConfigDict(env_prefix=...)` for connector configuration. Each connector uses a unique prefix: `ARGOCD_`, `PROMETHEUS_`, `NETWORK_`.
- `model_config = ConfigDict(strict=True)` on request/response models to reject type coercion in API inputs.
- Frozen models (`frozen=True`) for response schemas — responses are immutable once constructed.

### Structured Logging

- **structlog** for all Python logging. Configured with JSON rendering in production, console rendering in development.
- No `print()` statements. No direct `logging` stdlib usage — structlog wraps it.
- All log entries MUST include: `connector`, `environment`, `region`, `endpoint`, and `request_id` fields. Use structlog's `bind()` to set these contextually per-request.
- **Secret scrubbing**: See §12.4 for mandatory log sanitisation rules.

#### Log Levels

| Level      | When to use |
| ---------- | ----------- |
| `debug`    | Detailed diagnostic info: cache hits/misses, upstream request/response details, PromQL queries. Disabled in production by default. |
| `info`     | Normal operations: startup complete, upstream fetch succeeded, cache refreshed. One `info` per request is the target — not per sub-operation. |
| `warning`  | Recoverable issues: Redis unreachable (falling through to live fetch), upstream returned unexpected but handleable response, cache deserialization failure. |
| `error`    | Unrecoverable issues for the current request: upstream 5xx, auth failure, unhandled exception. MUST include the exception traceback. |
| `critical` | Process-level failures: invalid configuration at startup, unable to bind to port. The process should exit shortly after a `critical` log. |

### Health Check Contract

Each connector exposes two health endpoints:

| Endpoint   | Probe Type    | What It Checks | Failure Response |
| ---------- | ------------- | -------------- | ---------------- |
| `/healthz` | **Liveness**  | Process is running and event loop is responsive. No upstream dependency checks. | 503 — Kubernetes restarts the pod. |
| `/readyz`  | **Readiness** | Upstream API reachable AND Redis reachable. | 503 — Kubernetes removes pod from Service endpoints; traffic stops. Pod is NOT restarted. |

Response body for both:

```json
{
  "status": "ok",
  "connector": "argocd-connector",
  "environment": "dev",
  "region": "eastus",
  "checks": {
    "upstream": "ok",
    "redis": "ok"
  },
  "timestamp": "2026-03-22T14:30:00Z"
}
```

When a check fails, its value changes to `"degraded"` and the top-level `status` becomes `"degraded"`. The response code becomes 503.

> **Note**: The PRD (§4.3–4.5) references `/health`. Implementations SHOULD use `/healthz` and `/readyz` for Kubernetes probe alignment. `/health` MAY be retained as an alias for `/readyz` for backwards compatibility.

#### Probe Timing and Startup Probe

See §13.4 for Kubernetes probe configuration including `startupProbe`, timing parameters, and failure thresholds.

### Environment Variable Naming

All connector env vars follow the pattern: `{CONNECTOR_PREFIX}_{DESCRIPTOR}`.

| Connector  | Prefix        | Examples |
| ---------- | ------------- | -------- |
| argocd     | `ARGOCD_`     | `ARGOCD_SERVER_URL`, `ARGOCD_TOKEN`, `ARGOCD_ENV` |
| prometheus | `PROMETHEUS_` | `PROMETHEUS_ENDPOINT`, `PROMETHEUS_CLIENT_ID` |
| network    | `NETWORK_`    | `NETWORK_CLUSTER`, `NETWORK_REGION` |
| shared     | (no prefix)   | `REDIS_URL`, `REDIS_PASSWORD`, `LOG_LEVEL`, `LOG_FORMAT` |

Azure-specific credentials use the `AZURE_` prefix as required by Azure SDK conventions: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`.

### Frontend (React / TypeScript)

- **React Query v5** manages all server state. See §2 for full React Query configuration, polling intervals, and query key conventions.
- Polling intervals aligned to connector Redis TTLs (argocd: 30s, prometheus: 60s, network: 120s).
- **Tailwind CSS + shadcn/ui** for styling. No custom CSS unless shadcn/ui does not provide a suitable component.
- **Recharts** for sparkline and time-series visualisations.
- **Error boundaries** per dashboard module — see §2 React Component Patterns.
- **Runtime config** via `/config.json` — see §2 Frontend Environment Configuration.
- **Virtualised scrolling** for 850+ app lists — see §2 Frontend Performance Standards.

---

## 5. Container Development

### Dev Containers

The project supports development via Dev Containers for a consistent, reproducible environment across IDEs.

- **Configuration**: `.devcontainer/devcontainer.json`
- **Base image**: Python 3.14 with `uv` pre-installed. Node.js included for frontend development.
- **Included tools**: Ruff, mypy, pytest, kustomize, kubectl, npm/pnpm.
- **IDE support**:
  - **VS Code**: Open the project folder; VS Code detects `.devcontainer/` and prompts to reopen in container. Requires the "Dev Containers" extension (`ms-vscode-remote.remote-containers`).
  - **JetBrains**: Use the Dev Containers integration (PyCharm 2023.3+, WebStorm). Go to File → Remote Development → Dev Containers, select the project directory.
- **Post-create**: `uv sync` runs automatically for connectors. `npm install` runs for the frontend.
- **Volumes**: Project directory is bind-mounted. `uv` cache, `mypy` cache, and `node_modules` stored in named volumes for persistence across rebuilds.

### Production Dockerfiles

Each connector and the frontend has its own Dockerfile. See §12.6 for container security hardening requirements.

- **Connectors**: Multi-stage build. Builder stage runs `uv sync --frozen --no-dev`. Final stage copies the virtual environment into `python:3.14-slim`. Runs as non-root user (UID 1000).
- **Frontend**: Multi-stage build. Builder stage runs `npm ci && npm run build`. Final stage copies built static assets into an `nginx:alpine` image.
- All images expose health check endpoints for Kubernetes liveness/readiness probes.

---

## 6. Pre-commit Hooks

All developers MUST install pre-commit hooks. The `.pre-commit-config.yaml` in the repo root runs checks at commit time, catching issues before they reach CI.

### Required Hooks

| Hook                  | What It Checks |
| --------------------- | -------------- |
| `ruff check`          | Linting (Python) |
| `ruff format --check` | Formatting (Python) |
| `mypy`                | Type checking (Python) |
| `prettier --check`    | Formatting (frontend) |
| `eslint`              | Linting (frontend) |
| `check-yaml`          | Valid YAML syntax |
| `check-json`          | Valid JSON syntax |
| `detect-secrets`      | Prevents accidental credential commits (see §12.2) |
| `no-commit-to-branch` | Blocks direct commits to `main` |

### Setup

```bash
uv add --group dev pre-commit
pre-commit install
pre-commit install --hook-type commit-msg  # enforces conventional commits
```

Hooks run only on staged files for speed. Full checks run in CI.

---

## 7. IDE Configuration

### VS Code

Recommended extensions (defined in `.vscode/extensions.json`):

- `ms-python.python` — Python language support
- `ms-python.mypy-type-checker` — mypy integration
- `charliermarsh.ruff` — Ruff linting and formatting
- `ms-vscode-remote.remote-containers` — Dev Container support
- `dbaeumer.vscode-eslint` — ESLint for TypeScript
- `esbenp.prettier-vscode` — Prettier formatting

Settings (`.vscode/settings.json`):

- Default Python formatter: Ruff
- Default TypeScript formatter: Prettier
- Format on save: enabled
- Organize imports on save: enabled (via Ruff for Python, ESLint for TypeScript)
- Python interpreter: `.venv/bin/python` (from `uv`)
- mypy enabled in strict mode

### JetBrains (PyCharm / WebStorm)

- Set the project interpreter to the `uv`-managed virtual environment (`.venv/bin/python`)
- Enable Ruff as the external formatter: Settings → Tools → External Tools
- Configure Ruff as a file watcher for format-on-save
- Enable mypy via the Mypy plugin with `--strict` flag
- Mark `connectors/*/src/` as Sources Root and `connectors/*/tests/` as Test Sources Root
- Mark `frontend/src/` as Sources Root

---

## 8. Testing Strategy

This project follows **test-driven development (TDD)**. Tests are written before implementation code. No implementation is considered complete unless all relevant tests pass.

### Python (Connectors)

- **Framework**: pytest with `pytest-asyncio` for async test support.
- **Async mode**: `pytest-asyncio` configured in `pyproject.toml` with `asyncio_mode = "auto"`. All async test functions are collected automatically — no `@pytest.mark.asyncio` decorator required on individual tests.
- **Structure**: `tests/unit/` for fast isolated tests, `tests/integration/` for tests requiring a running service or network access. Located per-connector under `connectors/{name}/tests/`.
- **Coverage**: `pytest-cov` with a minimum threshold enforced in CI. Target: 90%+ line coverage for each connector's `src/` directory.
- **TDD workflow**:
  1. Write a failing test that defines the expected behaviour.
  2. Write the minimal implementation to make the test pass.
  3. Refactor while keeping tests green.
- **Naming**: Test files mirror source files (`src/routes/apps.py` → `tests/unit/test_routes_apps.py`). Test functions use `test_<behaviour_under_test>` naming.
- **Fixtures**: Shared fixtures live in `conftest.py`. Use factory fixtures over complex setup. Prefer `tmp_path` for file-based tests. Common fixtures across connectors (e.g., mock Redis, mock httpx responses) live in a shared `tests/fixtures/` package.
- **Mocking**: Use `pytest-mock` or `unittest.mock`. Mock at boundaries (HTTP responses via `httpx` mock transport, Redis calls, TCP connections). Never mock the unit under test. Use `httpx.MockTransport` or `respx` for mocking upstream HTTP calls — do not monkeypatch `httpx.AsyncClient` methods directly.
- **Async tests**: Collected automatically via `asyncio_mode = "auto"`. Tests for route handlers and upstream API clients are async.
- **Generated tests**: Spec-conformance tests under `tests/generated/` are auto-generated from OpenAPI specs. Do not hand-edit.
- **FastAPI test client**: Use `httpx.AsyncClient` with `ASGITransport` for testing FastAPI routes (replaces deprecated `TestClient` for async routes):

```python
from httpx import ASGITransport, AsyncClient

async def test_get_apps() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/apps")
    assert response.status_code == 200
```

- **Security tests**: See §12.8 for required security test patterns.

### Frontend (React / TypeScript)

- **Framework**: Vitest + React Testing Library + MSW (Mock Service Worker).
- **Structure**: Tests co-located with components (`*.test.tsx`).
- **Coverage**: Target 80%+ for component logic. Auto-generated API client code (`src/api/`) is excluded from coverage.
- **Mocking**: MSW intercepts HTTP requests at the network level — not by mocking `fetch` or the API client. This tests the full React Query → API client → response flow. Define mock handlers per connector in `frontend/src/mocks/handlers/`.

#### What to Test

| Test Type | What It Covers | Example |
| --------- | -------------- | ------- |
| **Render tests** | Component renders with data, empty state, loading state, error state | `AppStatusGrid` renders 3 rows for 3 apps |
| **Interaction tests** | User events trigger expected behaviour | Clicking project selector updates filter, typing in search filters list |
| **Query integration** | React Query hooks fetch, cache, and poll correctly | `useAppStatus` returns cached data while background refetch runs |
| **Accessibility** | No `axe-core` violations on every module component | See §2 Accessibility Testing |
| **Error boundary** | Module degrades gracefully when connector returns 5xx | Metrics module shows fallback when prometheus-connector is down |
| **Responsive** | Key layouts render correctly at different viewport sizes | Application grid collapses environment columns on narrow viewports |

#### Testing React Query Hooks

Wrap components under test in a `QueryClientProvider` with a test-specific `QueryClient` (no retries, no GC):

```tsx
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithQuery(ui: React.ReactElement): RenderResult {
  const client = createTestQueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}
```

- Each test creates a fresh `QueryClient` — no shared cache state between tests.
- Use `waitFor` (from React Testing Library) to assert on async query results — never use `setTimeout` or `act()` loops.

### CI Gate

- All tests must pass before merge.
- No skipped tests without a linked issue explaining why.
- Security scans must pass (see §12.7).

---

## 9. Makefile Commands

The Makefile provides standard development commands across the monorepo:

| Command               | Description |
| --------------------- | ----------- |
| `lint`                | Run `ruff check` on all connectors |
| `lint-frontend`       | Run ESLint on frontend |
| `format`              | Run `ruff format` on all connectors |
| `format-frontend`     | Run Prettier on frontend |
| `typecheck`           | Run `mypy --strict` on all connectors |
| `typecheck-frontend`  | Run `tsc --noEmit` on frontend |
| `test`                | Run pytest with coverage across all connectors |
| `test-frontend`       | Run Vitest on frontend |
| `test-unit`           | Run unit tests only (all connectors) |
| `test-int`            | Run integration tests only (all connectors) |
| `check`               | Run lint + typecheck + test (CI equivalent) |
| `check-all`           | Run check + frontend checks |
| `security-audit`      | Run dependency audit + container scan + secret scan (see §12) |
| `build`               | Build all container images |
| `generate-stubs`      | Generate FastAPI stubs from OpenAPI specs |
| `generate-ts-clients` | Generate TypeScript API clients from OpenAPI specs |
| `generate-sbom`       | Generate SBOM for all connector and frontend images (see §12.9) |
| `render-manifests`    | Run `kustomize build` for all overlays and output to `rendered/` (deploy repo) |
| `validate-manifests`  | Run `kubeconform` + `kube-linter` on rendered manifests (see §14.4) |
| `lighthouse`          | Run Lighthouse CI against production frontend build with mock data (see §2) |

---

## 10. Git Workflow

- **Branching**: Feature branches off `main`. Branch naming: `<type>/<short-description>` (e.g., `feat/argocd-connector`, `fix/redis-cache-ttl`).
- **Commits**: Conventional Commits format — `type(scope): description`. Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`. Scopes: `argocd`, `prometheus`, `network`, `frontend`, `infra`, `docs`.
- **Commit message validation**: Enforced by `commitlint` via pre-commit hook. Commits not matching Conventional Commits format are rejected locally.
- **Pull requests**: All changes go through PR with at least one review. PR description references the relevant OpenSpec change or task.
- **CI checks on PR**: lint (`ruff check`), format verification (`ruff format --check`), type check (`mypy --strict`), tests (`pytest`), frontend lint, frontend typecheck, frontend tests, security audit (§12.7). All must pass.
- **Main branch protection**: No direct pushes to `main`. Squash merge preferred.
- **Generated code commits**: Regenerated stubs and API clients are committed in a separate commit from hand-written logic changes, for cleaner review.
- **Signed commits**: All commits SHOULD be GPG or SSH signed. Enforced as MUST once the team has key infrastructure in place.

---

## 11. Documentation Standards

- **Format**: GitHub-flavoured Markdown.
- **Location**: All documentation lives in the repository — no external wikis.
- **Currency**: Documentation MUST be updated in the same PR as the code change it describes.
- **Code blocks**: MUST specify a language (`yaml`, `bash`, `python`, `json`, `promql`, `typescript`).
- **YAML/JSON examples**: MUST be valid and copy-pasteable.
- **Tables over prose**: Prefer tables for reference material (fields, metrics, commands, env vars).
- See PRD §9 for the full list of required documentation artifacts per component and per phase.

---

## 12. Security Standards

This section defines enforceable security controls for the GitOps Dashboard. The dashboard handles service account tokens for three ArgoCD environments, Azure AD credentials, and Kubernetes ServiceAccount tokens across six clusters. A compromise of any connector exposes read access to the entire platform's deployment state.

> **Threat model context**: The dashboard is internal-only, non-mutating, and Tier II. Controls are calibrated accordingly — no WAF, no penetration testing cadence, no SOC2 evidence collection. But "internal" does not mean "trusted": any pod in the cluster namespace can reach connector APIs, and credentials transit the network and reside in memory.

### 12.1 CORS Policy

All FastAPI connectors MUST configure CORS explicitly via `CORSMiddleware`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[DASHBOARD_ORIGIN],   # e.g., "https://dashboard.platform.internal"
    allow_methods=["GET"],              # read-only dashboard — no POST/PUT/DELETE
    allow_headers=["Authorization", "X-Request-ID"],
    allow_credentials=False,            # no cookies — bearer token auth only
    max_age=3600,                       # preflight cache: 1 hour
)
```

- `allow_origins` MUST be a specific origin, never `["*"]`.
- `allow_methods` is restricted to `GET` — the dashboard is non-mutating.
- The origin value is injected via env var `CORS_ALLOWED_ORIGIN` to support per-environment configuration.

### 12.2 Secret Detection

- **Pre-commit**: `detect-secrets` hook runs on every commit against staged files.
- **Baseline file**: `.secrets.baseline` is committed to the repository. Generated via `detect-secrets scan > .secrets.baseline` and reviewed before commit. Updated when new false positives are identified.
- **CI**: `detect-secrets` runs as a CI step against the full diff of each PR. Failures block merge.
- **`.gitignore`**: The following patterns MUST be present:

```text
# Secrets and credentials
.env
.env.*
*.pem
*.key
*.p12
*.pfx
credentials.json
**/secrets/
```

- **No secrets in code**: Credentials MUST NOT appear in source code, configuration files, Dockerfiles, Makefiles, or CI pipeline definitions. All secrets are injected at runtime via environment variables sourced from Azure Key Vault through External Secrets Operator.

### 12.3 Transport Security

#### Upstream API Connections (httpx)

- TLS verification MUST remain enabled (`verify=True`). No `verify=False` in any code path — including tests. Test environments use mock transports, not TLS bypass.
- For internal CAs (ArgoCD instances behind the platform's internal PKI), configure the CA bundle via the `SSL_CERT_FILE` env var. Do not embed CA certificates in container images.
- **Minimum TLS version**: TLS 1.2. Configured via `ssl.SSLContext` if the default httpx context permits older versions:

```python
import ssl
ctx = ssl.create_default_context()
ctx.minimum_version = ssl.TLSVersion.TLSv1_2
client = httpx.AsyncClient(verify=ctx, ...)
```

#### Frontend (nginx)

The nginx reverse proxy serving the React SPA MUST enforce:

- TLS 1.2+ only (`ssl_protocols TLSv1.2 TLSv1.3;`)
- Strong cipher suites (disable CBC, prefer AEAD)
- HSTS header with `max-age=31536000; includeSubDomains`

TLS termination may occur at the ingress controller level. If so, the nginx container itself does not need TLS configuration, but the ingress MUST enforce the same standards.

### 12.4 Credential Hygiene and Log Sanitisation

#### In-Memory Handling

- Credentials (tokens, client secrets) MUST be read from environment variables into Pydantic `SecretStr` fields, not plain `str`:

```python
from pydantic import SecretStr, SettingsConfigDict
from pydantic_settings import BaseSettings

class ArgocdSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ARGOCD_")

    server_url: str
    token: SecretStr       # SecretStr masks value in repr/str/logs
    env: str
```

- `SecretStr` prevents accidental exposure in `repr()`, `str()`, logging, and serialisation. Access the raw value explicitly via `.get_secret_value()` only when constructing the HTTP `Authorization` header.
- Never store credentials in Python data structures that may be serialised to logs, error responses, or cache (Redis). Credentials are used transiently for HTTP header construction and must not persist beyond that scope.

#### Log Sanitisation

structlog MUST be configured with a processor that scrubs sensitive values before log output:

```python
import re
import structlog

SENSITIVE_PATTERNS = re.compile(
    r"(token|password|secret|credential|authorization|api[_-]?key)"
    r"\s*[:=]\s*\S+",
    re.IGNORECASE,
)

def scrub_secrets(
    logger: structlog.types.WrappedLogger,
    method_name: str,
    event_dict: structlog.types.EventDict,
) -> structlog.types.EventDict:
    for key, value in event_dict.items():
        if isinstance(value, str) and SENSITIVE_PATTERNS.search(value):
            event_dict[key] = SENSITIVE_PATTERNS.sub(
                r"\1=***REDACTED***", value
            )
    return event_dict
```

- This processor MUST be in the structlog processor chain for all environments (including dev).
- Log entries MUST NOT include: raw tokens, client secrets, full Authorization headers, connection strings with embedded passwords, or Azure Key Vault secret values.
- Upstream API request logging (at `debug` level) MUST redact the `Authorization` header. Log the request method, URL, and status code — not headers or body content containing credentials.

#### Error Responses

- The `ErrorResponse` model (§4 Error Handling) MUST NOT include stack traces, file paths, environment variable values, or internal hostnames in production. The `detail` field provides a human-readable description of the failure class, not diagnostic internals.
- FastAPI's default 422 validation error response is acceptable — it exposes field names and validation constraints, which are already public via the OpenAPI spec.

### 12.5 Redis Security

- **Authentication**: Redis MUST require a password. Connection string format: `redis://:${REDIS_PASSWORD}@redis-host:6379/0`. The password is stored in Azure Key Vault and injected via ESO as the `REDIS_PASSWORD` env var.
- **Transport encryption**: If Redis traffic crosses a network boundary (e.g., a managed Redis instance outside the dashboard namespace), TLS MUST be enabled (`rediss://` scheme). For in-namespace Redis (pod-to-pod within the same namespace), unencrypted transport is acceptable given the NetworkPolicy isolation defined in §12.10.
- **Command restriction**: Application code MUST NOT use `KEYS *`, `FLUSHALL`, `FLUSHDB`, or `DEBUG` commands. Use `SCAN` for key enumeration if needed. Enforced via Redis ACL rules that restrict the connector user to `GET`, `SET`, `DEL`, `TTL`, `EXPIRE`, and `SCAN` only.
- **No Lua scripting**: Redis `EVAL` and `EVALSHA` are not permitted. Cache operations are simple get/set patterns — scripting adds unnecessary attack surface.

### 12.6 Container Security Hardening

#### Image Build

- **Base image pinning**: Use digest-pinned base images, not mutable tags:

```dockerfile
# Correct — digest-pinned:
FROM python:3.14-slim@sha256:abc123...
# Incorrect — mutable tag:
FROM python:3.14-slim
```

- Digest pins are updated by Renovate/Dependabot PRs (see §12.7) and reviewed before merge.
- **No build secrets in layers**: Multi-stage builds MUST ensure that credentials, tokens, and private keys used during the build (e.g., for private package indexes) are in the builder stage only and are not copied to the final image. Use `--mount=type=secret` for Docker BuildKit secrets if needed.
- **Minimal final image**: The final stage copies only the virtual environment (connectors) or static assets (frontend). No compilers, build tools, package managers, or shells (except `/bin/sh` required by the container runtime) in the final image.

#### Runtime

All connector and frontend Kubernetes Deployments MUST include the following `securityContext`:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
  seccompProfile:
    type: RuntimeDefault
```

- **Read-only root filesystem**: Connectors write to `/tmp` only (structlog does not write to disk; httpx connection pools are in-memory). Mount an `emptyDir` at `/tmp` if the application requires a writable temp directory.
- **No privilege escalation**: `allowPrivilegeEscalation: false` prevents `setuid`/`setgid` binaries from gaining elevated permissions.
- **Dropped capabilities**: `ALL` capabilities are dropped. No connector requires `NET_BIND_SERVICE` (ports > 1024), `SYS_PTRACE`, or any other Linux capability.
- **Seccomp**: `RuntimeDefault` profile. No `Unconfined`.
- **Service account token**: All pods that do not need the Kubernetes API MUST set `automountServiceAccountToken: false`. Only the network-connector requires a mounted token. The argocd-connector, prometheus-connector, frontend, and Redis pods MUST disable it — unnecessary tokens are unnecessary attack surface.

### 12.7 CI Security Pipeline

The following security checks run in CI on every PR. All are merge-blocking.

| Check | Tool | What It Catches |
| ----- | ---- | --------------- |
| **Dependency audit (Python)** | `uv audit` (or `pip-audit`) | Known CVEs in Python dependencies |
| **Dependency audit (frontend)** | `npm audit --audit-level=high` | Known CVEs in npm dependencies |
| **Container image scan** | Trivy | OS-level and language-level CVEs in built images. Fail on HIGH and CRITICAL. |
| **Secret detection** | `detect-secrets` | Credentials in source code or config files |
| **SAST (Python)** | Ruff `S` rules + Semgrep (Python ruleset) | Code-level security issues: hardcoded secrets, unsafe deserialization, path traversal, SSRF patterns |
| **SAST (frontend)** | ESLint security plugin (`eslint-plugin-security`) | DOM XSS, unsafe dynamic code execution, unsafe `innerHTML` |
| **License compliance** | `uv tree --license` (or `pip-licenses`) | Copyleft or unapproved licenses in dependencies |
| **Dockerfile lint** | Hadolint | Dockerfile best practice violations (running as root, unpinned base images, piped installs) |
| **Manifest validation** | `kubeconform` + `kube-linter` | Invalid K8s YAML, missing securityContext, missing resource limits, running as root (deploy repo PRs) |

#### Automated Dependency Updates

- **Renovate** (or Dependabot) is configured on the repository to raise PRs for:
  - Python dependency updates (patch and minor versions auto-merged after CI passes; major versions require manual review)
  - npm dependency updates (same policy)
  - Docker base image digest updates (auto-merged after CI passes)
  - GitHub Actions version updates
- Security-only updates (`@security`) are flagged with high priority and must be reviewed within 48 hours.

### 12.8 Security Test Patterns

The following test patterns are REQUIRED in each connector's test suite:

#### Input Validation Tests

```python
@pytest.mark.parametrize("namespace", [
    "../etc/passwd",              # path traversal
    "'; DROP TABLE apps; --",     # SQL injection (defense in depth)
    "<script>alert(1)</script>",  # XSS payload
    "a" * 10_000,                 # oversized input
    "",                           # empty string
    "valid-namespace",            # happy path
])
async def test_namespace_param_validation(namespace: str) -> None:
    """Connectors must reject malformed namespace parameters."""
    ...
```

#### Auth Header Handling

- Test that connectors never reflect the `Authorization` header value in responses or logs.
- Test that upstream auth failures return 502 (not 401/403 — do not leak the fact that the connector authenticates to upstream).

#### Error Response Leakage

- Test that 500 responses do not contain stack traces, file paths, or env var values.
- Test that the `detail` field in error responses contains only the predefined human-readable messages, not interpolated internal data.

#### Request Limits

- FastAPI connectors MUST set a maximum request body size via middleware. Although connectors are read-only (GET requests only), this prevents abuse via oversized headers or query strings.
- Trusted host middleware restricts accepted `Host` headers:

```python
from starlette.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["dashboard.platform.internal", "localhost"],
)
```

### 12.9 SBOM Generation

A Software Bill of Materials (SBOM) is generated for every container image published to the registry.

- **Format**: SPDX or CycloneDX JSON.
- **Tool**: Syft (Anchore) or Trivy SBOM mode.
- **When**: Generated as a CI step after image build, before image push.
- **Storage**: SBOM is attached to the container image as an OCI artifact (using `cosign attach sbom` or equivalent). Also committed to the deploy repo under `sbom/{connector}-{version}.spdx.json` for audit trail.
- **Makefile**: `make generate-sbom` runs SBOM generation locally for all images.

### 12.10 Network Policy (Dashboard Namespace)

The dashboard namespace in the DEV East US cluster MUST have NetworkPolicy objects that restrict traffic:

| Policy | Effect |
| ------ | ------ |
| **Default deny ingress** | Deny all ingress to the namespace by default. |
| **Default deny egress** | Deny all egress from the namespace by default. |
| **Allow frontend ingress** | Allow ingress to the frontend nginx pod from the ingress controller namespace only. |
| **Allow connector ingress** | Allow ingress to connector pods from the frontend pod only (pod selector). |
| **Allow ArgoCD egress** | Allow egress from argocd-connector pods to ArgoCD API endpoints (specific IPs/CIDRs or external name services). |
| **Allow Azure Monitor egress** | Allow egress from prometheus-connector to Azure Monitor Workspace endpoint. |
| **Allow K8s API egress** | Allow egress from network-connector pods to the Kubernetes API server. |
| **Allow Redis** | Allow ingress/egress between connector pods and the Redis pod within the namespace. |
| **Allow DNS egress** | Allow egress to kube-dns (UDP/TCP 53) from all pods in the namespace. |

These policies are defined in the deploy repo (`gitops-dashboard-deploy/base/`) and are part of the Kustomize base manifests.

### 12.11 Rate Limiting

Connectors MUST enforce rate limiting to prevent misconfigured clients or rogue pods from overwhelming upstream data sources:

| Layer | Mechanism | Default Limit |
| ----- | --------- | ------------- |
| **Per-client** | FastAPI middleware using `slowapi` or equivalent | 60 requests/minute per source IP |
| **Upstream fan-out** | `asyncio.Semaphore` in connector code | Max 5 concurrent requests to any single upstream API |
| **Global** | Uvicorn `--limit-concurrency` | 100 concurrent connections per connector instance |

Rate limit responses use HTTP 429 with a `Retry-After` header.

### 12.12 Frontend Security Headers

The nginx configuration serving the React SPA MUST include the following response headers:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.platform.internal; frame-ancestors 'none'; base-uri 'self'; form-action 'none';" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()" always;
```

- **CSP `connect-src`**: Scoped to `'self'` and the internal platform domain. No external API calls.
- **`frame-ancestors 'none'`**: Prevents clickjacking — the dashboard must not be embedded in iframes.
- **`form-action 'none'`**: The dashboard has no forms (read-only). Prevents form-based redirect attacks.
- **`style-src 'unsafe-inline'`**: Required by Tailwind CSS utility classes. Scope this to a nonce if Tailwind supports it in the project's version.
- If a charting library (Recharts) requires dynamic code execution, evaluate alternatives before relaxing the `script-src` directive. Document the justification in a PR comment and obtain security review approval.

### 12.13 Inter-Service Authentication

Connector APIs are not public-facing, but they MUST NOT be unauthenticated on the pod network. Any pod in the cluster (or an attacker with a foothold) could query connector APIs to enumerate ArgoCD application state, image tags, and network policies.

- **Mechanism**: Kubernetes ServiceAccount token projection. The frontend pod mounts a projected service account token and passes it as a `Bearer` token in the `Authorization` header to connector APIs.
- **Connector validation**: Connectors validate the token via the Kubernetes TokenReview API (or by verifying the JWT signature against the cluster's OIDC issuer). Tokens are short-lived (15 minutes, auto-rotated by kubelet).
- **Scope**: Connectors accept tokens only from ServiceAccounts in the dashboard namespace. Requests from other namespaces are rejected with 403.

> This is a defence-in-depth measure. The primary network-level control is the NetworkPolicy in §12.10. Token validation adds identity verification on top of network isolation.

### 12.14 Security Review Checklist for PRs

PRs that touch the following areas MUST include an explicit security review comment from a reviewer:

| Change Area | What the Reviewer Checks |
| ----------- | ------------------------ |
| Upstream API client code | TLS verification, timeout configuration, credential handling, no URL construction from user input |
| Error handling / responses | No stack traces, internal paths, or credential fragments in error bodies |
| Redis operations | Key naming follows convention, TTL set on all writes, no disallowed commands |
| Dockerfile changes | Non-root user, digest-pinned base, no secrets in layers, minimal final image |
| Dependency additions | License check, CVE check, justification for the new dependency |
| Environment variable changes | Secrets use `SecretStr`, non-secret config uses plain types, naming follows convention |
| nginx / frontend config | CSP headers present, no wildcard origins |
| Kubernetes manifests (deploy repo) | `securityContext` present, NetworkPolicy updated if new connectivity required, labels match §13.1 schema |

---

## 13. Kubernetes & ArgoCD Standards

This section defines infrastructure-level standards for how connectors, the frontend, and supporting services are deployed and operated on AKS. These standards apply to the deploy repo (`gitops-dashboard-deploy`) and to any Kubernetes-facing code in the application repo.

### 13.1 Kubernetes Label Schema

All Deployment, Service, Pod, and Job manifests MUST include the following labels. These labels drive NetworkPolicy selectors, HPA targets, Prometheus `ServiceMonitor` selectors, and `kubectl` filtering.

```yaml
metadata:
  labels:
    app.kubernetes.io/name: argocd-connector        # component name
    app.kubernetes.io/instance: argocd-connector-dev # component + variant (env/region)
    app.kubernetes.io/version: "1.2.0"               # container image semver tag
    app.kubernetes.io/component: connector            # connector | frontend | cache
    app.kubernetes.io/part-of: gitops-dashboard       # always "gitops-dashboard"
    app.kubernetes.io/managed-by: argocd              # always "argocd"
    platform.internal/environment: dev                # dev | stage | prod
    platform.internal/region: eastus                  # eastus | westus
```

| Label | Purpose | Who Consumes It |
| ----- | ------- | --------------- |
| `app.kubernetes.io/name` | Component identity | NetworkPolicy `podSelector`, Service `selector`, HPA `scaleTargetRef` |
| `app.kubernetes.io/instance` | Unique instance across all env/region combinations | `kubectl` filtering, log correlation |
| `app.kubernetes.io/component` | Logical role | NetworkPolicy rules (e.g., allow `connector` → `cache`) |
| `app.kubernetes.io/part-of` | Groups all dashboard resources | Namespace-wide queries, ArgoCD app-of-apps selector |
| `platform.internal/environment` | Environment tier | Prometheus metric labels, dashboard filtering |
| `platform.internal/region` | Regional identity | Prometheus metric labels, dashboard filtering |

- **Pod template labels**: MUST match the Deployment `spec.selector.matchLabels`. Changing these requires a Deployment recreate — treat as a breaking change.
- **Annotations** (not labels) for non-identifying metadata: `prometheus.io/scrape`, `prometheus.io/port`, commit SHA, pipeline run ID.

### 13.2 ArgoCD RBAC and Token Scoping

#### ArgoCD Version Requirement

All three ArgoCD instances (DEV, STAGE, PROD) MUST run **ArgoCD v2.9+**. This is the minimum version that supports:

- `fields` query parameter on `/api/v1/applications` (required for §13.2 API efficiency)
- `limit`/`continue` pagination on application list endpoints
- Stable RBAC policy syntax for the `dashboard-readonly` role
- Server-side `?project=` filtering that avoids client-side post-filtering

If an ArgoCD instance is below v2.9, the argocd-connector for that environment MUST fall back to client-side filtering and field projection. Log a `warning` at startup indicating the ArgoCD version does not support server-side optimisation.

#### ArgoCD Service Account Tokens

Each argocd-connector instance authenticates to its ArgoCD environment (DEV, STAGE, or PROD) via a long-lived service account token. These tokens MUST be scoped to the minimum required ArgoCD RBAC role.

**Required ArgoCD RBAC policy** (in `argocd-rbac-cm` ConfigMap per ArgoCD instance):

```csv
p, role:dashboard-readonly, applications, get, */*, allow
p, role:dashboard-readonly, applications, list, */*, allow
p, role:dashboard-readonly, projects, get, *, allow
p, role:dashboard-readonly, projects, list, *, allow
g, dashboard-connector, role:dashboard-readonly
```

| Permission | Justification |
| ---------- | ------------- |
| `applications get/list` | Required to fetch health, sync status, and image data. |
| `projects get/list` | Required to populate the project scope selector and resolve project → namespace mappings. |
| **Explicitly denied** | `applications create/update/delete/sync/action/*`, `clusters *`, `repositories *`, `accounts *`, `gpgkeys *`, `certificates *`, `logs *`, `exec *` |

- **No `sync` permission**: The dashboard is non-mutating. The ArgoCD token MUST NOT have `sync`, `action/*`, or any write capability. This is the single most critical ArgoCD RBAC control — a misconfigured token with `sync` permission turns the "read-only dashboard" into a deployment tool.
- **No `exec` permission**: Prevents container exec through the ArgoCD API, which would be equivalent to `kubectl exec` on any managed pod.
- **No `logs` permission**: The dashboard does not display logs. Granting `logs` access would allow reading application container output through the ArgoCD API.
- **Token naming**: `dashboard-connector` service account per ArgoCD instance. Created via `argocd account generate-token --account dashboard-connector`.
- **Token storage**: Azure Key Vault, injected via ESO. Key names: `argocd-dev-dashboard-token`, `argocd-stage-dashboard-token`, `argocd-prod-dashboard-token`.

#### ArgoCD API Efficiency

With 850+ Applications across 3 environments, API efficiency is critical to avoid rate limiting and excessive memory usage:

- **Field selectors**: All `/api/v1/applications` requests MUST use the `fields` query parameter to request only required fields:

```text
GET /api/v1/applications?fields=items.metadata.name,items.metadata.labels,items.spec.project,items.spec.destination,items.status.health,items.status.sync,items.status.summary
```

- **Never fetch full Application specs**: The full Application object includes `status.operationState`, `status.history`, managed resources, and other fields that can be 50-100KB per application. The dashboard needs only: `metadata.name`, `spec.project`, `spec.destination`, `status.health`, `status.sync`, `status.summary.images`.
- **Project-scoped queries**: Use the native `?project={name}` parameter when the user has selected a project. This filters server-side, reducing response size from hundreds to tens of applications.
- **Pagination**: If ArgoCD supports `limit`/`continue` pagination (v2.9+), implement cursor-based pagination for the "All Projects" view. Do not load all 850+ applications into a single response.

### 13.3 Kubernetes RBAC for Network-Connector

The network-connector is the only component permitted to query the Kubernetes API directly. Its ServiceAccount MUST have the absolute minimum ClusterRole.

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: gitops-dashboard-netpol-reader
  labels:
    app.kubernetes.io/part-of: gitops-dashboard
    app.kubernetes.io/component: connector
rules:
  - apiGroups: ["networking.k8s.io"]
    resources: ["networkpolicies"]
    verbs: ["get", "list", "watch"]
```

**Explicitly excluded** — the ClusterRole MUST NOT include:

| Resource | Why Excluded |
| -------- | ------------ |
| `pods`, `deployments`, `services` | Not needed — metrics come from Prometheus, not the K8s API |
| `secrets` | Would expose credentials for every namespace in the cluster |
| `configmaps` | Not needed — configuration comes from ArgoCD API |
| `nodes` | Not needed — node-level data comes from Prometheus |
| `*` (wildcard resources) | Never use wildcard resources in a ClusterRole |
| `namespaces` | Not needed — namespace list comes from ArgoCD project destinations |

- **ClusterRoleBinding, not RoleBinding**: NetworkPolicies must be read across all namespaces, so a ClusterRole is required. A namespaced RoleBinding would limit reads to a single namespace, defeating the purpose.
- **One ServiceAccount per cluster**: Each network-connector instance runs in the DEV East US cluster but reads NetworkPolicies from its target cluster. For remote clusters (all except `aks-dev-eastus`), the ServiceAccount token is a long-lived token created on the target cluster, stored in Key Vault, and injected via ESO. For the local cluster (`aks-dev-eastus`), the in-cluster ServiceAccount is used directly.

### 13.4 Kubernetes Probe Configuration

All connectors MUST configure three probes: startup, liveness, and readiness.

```yaml
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 2
  periodSeconds: 3
  failureThreshold: 10         # 2 + (3 × 10) = 32 seconds max startup time
  timeoutSeconds: 2

livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  periodSeconds: 10
  failureThreshold: 3           # 3 consecutive failures → restart
  timeoutSeconds: 3
  # No initialDelaySeconds — startupProbe gates liveness

readinessProbe:
  httpGet:
    path: /readyz
    port: 8080
  periodSeconds: 5
  failureThreshold: 2           # 2 consecutive failures → remove from Service endpoints
  successThreshold: 1
  timeoutSeconds: 3
```

| Probe | Purpose | Why These Values |
| ----- | ------- | ---------------- |
| **Startup** | Gates liveness/readiness until the connector has established upstream connections and Redis pool. | Connectors need time to establish TLS connections to ArgoCD (up to 3 remote instances), Azure Monitor, or K8s API. 32s max allows for slow DNS resolution and TLS handshakes on cold start. |
| **Liveness** | Detects deadlocked event loops or hung processes. | Checks `/healthz` (no upstream dependency checks) — if the event loop can't serve a simple HTTP response, the process is dead. 30s detection window (3 × 10s) balances speed vs false positives. |
| **Readiness** | Controls traffic routing. | Checks `/readyz` (upstream + Redis reachable). 10s detection window (2 × 5s) quickly removes unhealthy pods from the Service. `successThreshold: 1` re-adds them as soon as they recover. |

- **Frontend (nginx)**: Use a simpler TCP probe on port 8080 for liveness (nginx doesn't hang the way Python event loops can). Readiness can check a static health file.
- **Redis**: Use TCP probe on port 6379 for liveness. No readiness probe needed — Redis is either up or down.

### 13.5 Graceful Shutdown

Connectors MUST handle SIGTERM gracefully to prevent dropped requests during rolling deployments and node drains.

```yaml
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: argocd-connector
      lifecycle:
        preStop:
          exec:
            command: ["sh", "-c", "sleep 5"]
```

| Parameter | Value | Rationale |
| --------- | ----- | --------- |
| `terminationGracePeriodSeconds` | 30 | Gives 30s total for shutdown. Uvicorn's default graceful timeout is 10s — leaves 20s margin for in-flight requests and connection draining. |
| `preStop sleep 5` | 5 seconds | Allows kube-proxy and ingress controllers to remove the pod from endpoints before the process starts rejecting connections. Without this, requests arrive at a pod that's already shutting down. |

**Application-level shutdown** (handled by FastAPI lifespan):

1. SIGTERM received → Uvicorn stops accepting new connections.
2. In-flight requests complete (up to Uvicorn's `--timeout-graceful-shutdown`, default 10s).
3. Lifespan `yield` completes → httpx client and Redis pool close.
4. Process exits.

### 13.6 Resource Requests and Limits

All Deployments MUST declare resource requests and limits. Defaults by component type:

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit |
| --------- | ----------- | --------- | -------------- | ------------ |
| argocd-connector | 100m | 500m | 128Mi | 256Mi |
| prometheus-connector | 100m | 500m | 128Mi | 256Mi |
| network-connector | 50m | 250m | 64Mi | 128Mi |
| frontend (nginx) | 50m | 200m | 64Mi | 128Mi |
| Redis | 100m | 500m | 128Mi | 256Mi |

- **Requests** determine scheduling and QoS class. All pods MUST have requests set to guarantee `Burstable` QoS at minimum.
- **Limits** prevent noisy-neighbor effects. Memory limits are set tight — OOM kills are preferable to unbounded memory growth affecting other pods.
- **Tuning**: These are starting defaults. Monitor actual usage via Prometheus during Phase 1-2 and adjust. Log a `warning` if a connector routinely exceeds 80% of its memory limit.
- **No CPU limit removal**: Some guidance suggests removing CPU limits for better performance. In a shared cluster, keep them. The dashboard is Tier II and must not starve Tier I workloads.

### 13.7 PodDisruptionBudget

All connectors with multiple instances MUST have a PodDisruptionBudget (PDB) to survive node drains and cluster upgrades.

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: argocd-connector
  labels:
    app.kubernetes.io/name: argocd-connector
    app.kubernetes.io/part-of: gitops-dashboard
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: argocd-connector
```

| Component | Instances | PDB Policy | Rationale |
| --------- | --------- | ---------- | --------- |
| argocd-connector | 3 (one per env) | `minAvailable: 1` | Each instance serves a different environment. Losing all 3 simultaneously during a drain means total dashboard blindness. Keep at least 1 serving cached data. |
| network-connector | 6 (one per cluster) | `minAvailable: 3` | Losing all 6 means no network policy data. Keep at least half available. |
| prometheus-connector | 1 | No PDB | Single instance — PDB with `minAvailable: 1` would block node drains entirely. Accept brief unavailability; cached data covers the gap. |
| frontend | 1 | No PDB | Single instance. Same rationale as prometheus-connector. |
| Redis | 1 | No PDB | Single instance, no persistence. Connectors fall through to live fetch if Redis is down. |

### 13.8 Deployment Strategy and Topology Spread

#### Rolling Update Parameters

All connector Deployments MUST define explicit rolling update parameters:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

- **`maxUnavailable: 0`**: Never reduce capacity during a rollout. The dashboard serves cached data — a slow rollout is preferable to a capacity drop that increases upstream API load.
- **`maxSurge: 1`**: One extra pod at a time. Conservative to avoid doubling upstream API connections during rollout.
- **Frontend and Redis**: Same strategy. Redis with `maxUnavailable: 0` ensures the cache is always available during rollout (single-instance Redis means the new pod must be ready before the old one terminates).

#### Topology Spread Constraints

Connectors with multiple instances MUST spread across failure domains:

```yaml
spec:
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: kubernetes.io/hostname
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: argocd-connector
```

- **`topologyKey: kubernetes.io/hostname`**: Spreads pods across nodes. If a node fails, at most one connector instance is lost.
- **`whenUnsatisfiable: ScheduleAnyway`**: Prefer spreading but don't block scheduling if the cluster can't satisfy the constraint (e.g., during scale-up with limited nodes). `DoNotSchedule` would be too aggressive for a Tier II application.
- **Not needed for singletons**: prometheus-connector, frontend, and Redis run one instance — topology spread has no effect.

#### Sync Wave Ordering

ArgoCD sync waves control the order resources are applied. The dashboard requires Redis to be available before connectors start:

| Sync Wave | Resources | Rationale |
| --------- | --------- | --------- |
| `-1` | Namespace, ResourceQuota, LimitRange, NetworkPolicy, ExternalSecrets | Infrastructure must exist before workloads. |
| `0` | Redis Deployment + Service | Cache must be ready before connectors attempt to connect. |
| `1` | All connector Deployments + Services + HPAs + PDBs | Connectors depend on Redis being available for startup readiness. |
| `2` | Frontend Deployment + Service + Ingress | Frontend depends on connector Services existing for DNS resolution. |
| `3` | ArgoCD Notifications ConfigMap (§15.2) | Notifications configured last — dashboard must be running first. |

Applied via annotation: `argocd.argoproj.io/sync-wave: "0"` on each resource.

### 13.9 HPA Configuration

Horizontal Pod Autoscalers are configured for connectors that may need to scale under load:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: argocd-connector-dev
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: argocd-connector-dev
  minReplicas: 1
  maxReplicas: 3
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300   # 5 min cooldown before scale-down
      policies:
        - type: Pods
          value: 1
          periodSeconds: 60             # scale down 1 pod per minute max
    scaleUp:
      stabilizationWindowSeconds: 30
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

- **Conservative scale-down**: 5-minute stabilisation window prevents flapping. The dashboard has predictable traffic patterns (polling, not bursty).
- **Memory as a scaling signal**: ArgoCD API responses for 850+ apps can spike memory. Memory-based scaling catches this before OOM kills.
- **`maxReplicas`**: Capped low (3 per connector variant). Each replica adds upstream API load — scaling too aggressively can trigger ArgoCD rate limiting.

### 13.9 External Secrets Operator (ESO) Configuration

All secrets are synchronized from Azure Key Vault into Kubernetes Secrets via ESO `ExternalSecret` resources.

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: argocd-dev-token
  namespace: gitops-dashboard
  labels:
    app.kubernetes.io/part-of: gitops-dashboard
spec:
  refreshInterval: 5m            # poll Key Vault every 5 minutes
  secretStoreRef:
    name: azure-keyvault
    kind: ClusterSecretStore
  target:
    name: argocd-dev-token
    creationPolicy: Owner         # ESO owns the K8s Secret lifecycle
    deletionPolicy: Delete        # remove K8s Secret when ExternalSecret is deleted
  data:
    - secretKey: token
      remoteRef:
        key: argocd-dev-dashboard-token
```

| Parameter | Value | Rationale |
| --------- | ----- | --------- |
| `refreshInterval` | `5m` | Balances freshness vs Key Vault API cost. Token rotation takes effect within 5 minutes. |
| `creationPolicy: Owner` | ESO manages the Secret | Prevents manual edits to the K8s Secret that would be overwritten on next sync. |
| `deletionPolicy: Delete` | Clean up on removal | Prevents orphaned secrets with stale credentials lingering in the namespace. |

**Token rotation strategy**:

1. Platform team rotates the ArgoCD service account token and updates the value in Azure Key Vault.
2. ESO detects the change within `refreshInterval` (5m) and updates the K8s Secret.
3. Connector pods consume the Secret as an env var. To pick up the new value, pods must be restarted. Options:
   - **Preferred**: Use [Reloader](https://github.com/stakater/Reloader) or the ESO `target.template.metadata.annotations` to trigger a rolling restart when the Secret changes.
   - **Alternative**: Connector reads the token from a mounted Secret volume file (not env var) and reloads it periodically without restart.
4. **Rotation cadence**: ArgoCD tokens SHOULD be rotated every 90 days. Azure Key Vault expiry alerts at 14 days before expiry.

### 13.10 Namespace Resource Quotas

The `gitops-dashboard` namespace MUST have ResourceQuota and LimitRange objects to prevent runaway resource consumption:

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: gitops-dashboard-quota
  namespace: gitops-dashboard
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 4Gi
    limits.cpu: "8"
    limits.memory: 8Gi
    pods: "30"
    services: "15"
    persistentvolumeclaims: "0"     # no PVCs — Redis has no persistence
---
apiVersion: v1
kind: LimitRange
metadata:
  name: gitops-dashboard-limits
  namespace: gitops-dashboard
spec:
  limits:
    - type: Container
      default:
        cpu: 500m
        memory: 256Mi
      defaultRequest:
        cpu: 100m
        memory: 128Mi
      max:
        cpu: "2"
        memory: 1Gi
```

- **`persistentvolumeclaims: 0`**: Enforces the "no persistence" design decision. Redis and all connectors are stateless.
- **LimitRange defaults**: Catches Deployments that forget to set requests/limits. The defaults match the connector sizing in §13.6.
- **Pod count limit (30)**: 3 argocd-connector + 1 prometheus-connector + 6 network-connector + 1 frontend + 1 Redis = 12 base pods. HPA can scale to ~24. Cap at 30 to prevent runaway scaling.

### 13.11 Container Image Registry and Tagging

| Concern | Standard |
| ------- | -------- |
| **Registry** | Azure Container Registry (ACR) in the platform's Azure subscription. Private endpoint — no public pull access. |
| **Repository naming** | `gitops-dashboard/{component}` — e.g., `gitops-dashboard/argocd-connector`, `gitops-dashboard/frontend` |
| **Tag format** | Semver for releases: `1.2.3`. Git SHA for CI builds: `sha-a1b2c3d`. `latest` tag is NOT used — it is mutable and breaks reproducibility. |
| **Immutable tags** | ACR tag immutability is enabled. Once pushed, a tag cannot be overwritten. Rebuild produces a new SHA tag. |
| **Image pull** | AKS uses ACR integration (managed identity attach) — no `imagePullSecrets` needed. The AKS kubelet identity has `AcrPull` role on the registry. |
| **CI pipeline** | Builds produce `sha-{short_commit_sha}` tag. Release pipeline re-tags as semver. Deploy repo references the semver tag (or SHA for pre-release). |

### 13.12 Kustomize Conventions (Deploy Repo)

All manifests in `gitops-dashboard-deploy` follow these Kustomize standards:

#### Base vs Overlay Separation

- **Base** (`base/`): Contains the canonical resource definitions with placeholder values. Every resource is valid YAML on its own — no Kustomize-only constructs in base files.
- **Overlays** (`overlays/{env-region}/`): Environment-specific patches. Currently only `overlays/dev-eastus/` since the dashboard deploys to a single cluster.

#### Patch Strategy

| Patch Type | When to Use | Example |
| ---------- | ----------- | ------- |
| **Strategic merge patch** | Adding/modifying fields in existing resources | Setting `ARGOCD_ENV=DEV` on a connector Deployment |
| **JSON 6902 patch** | Replacing a specific field value, array element manipulation | Updating an image tag, replacing a single env var value |
| **Components** (`components/`) | Reusable cross-cutting concerns applied to multiple overlays | Monitoring sidecar, log shipping agent |

#### Kustomize File Naming

| File | Pattern | Example |
| ---- | ------- | ------- |
| Base resources | `{resource-type}.yaml` | `deployment.yaml`, `service.yaml`, `hpa.yaml` |
| Overlay patches | `{component}-{purpose}.yaml` | `argocd-connector-dev.yaml`, `prometheus-connector-env.yaml` |
| Kustomization | `kustomization.yaml` (never `kustomization.yml`) | — |

#### Common Labels

All Kustomize `kustomization.yaml` files MUST apply `commonLabels` matching the schema in §13.1:

```yaml
commonLabels:
  app.kubernetes.io/part-of: gitops-dashboard
  app.kubernetes.io/managed-by: argocd
```

Component-specific labels (`app.kubernetes.io/name`, `platform.internal/environment`, etc.) are set directly in resource manifests, not via `commonLabels`, to avoid selector mutation issues.

### 13.13 ArgoCD AppProject

The dashboard's ArgoCD Application lives in a dedicated AppProject that constrains what it can deploy and where. The AppProject is the ArgoCD security boundary — without it, an Application can target any namespace or cluster the ArgoCD instance has access to.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: platform-tools
  namespace: argocd
spec:
  description: Platform team internal tooling (dashboard, monitors, utilities)
  sourceRepos:
    - "https://dev.azure.com/org/project/_git/gitops-dashboard-deploy"
  destinations:
    - server: https://kubernetes.default.svc
      namespace: gitops-dashboard
  clusterResourceWhitelist:
    - group: ""
      kind: Namespace
    - group: networking.k8s.io
      kind: NetworkPolicy
    - group: rbac.authorization.k8s.io
      kind: ClusterRole
    - group: rbac.authorization.k8s.io
      kind: ClusterRoleBinding
  namespaceResourceBlacklist:
    - group: ""
      kind: Secret          # Secrets managed by ESO, not ArgoCD
  orphanedResources:
    warn: true               # alert on resources in the namespace not managed by ArgoCD
  roles:
    - name: dashboard-deployer
      description: CI pipeline identity for automated sync
      policies:
        - p, proj:platform-tools:dashboard-deployer, applications, sync, platform-tools/gitops-dashboard, allow
        - p, proj:platform-tools:dashboard-deployer, applications, get, platform-tools/gitops-dashboard, allow
```

| Setting | Rationale |
| ------- | --------- |
| `sourceRepos` | Restricts to the deploy repo only. Prevents the Application from pointing at arbitrary repos. |
| `destinations` | Locked to the local cluster and `gitops-dashboard` namespace. Cannot deploy to STAGE or PROD clusters. |
| `clusterResourceWhitelist` | Explicit allowlist of cluster-scoped resources. Only Namespace, NetworkPolicy, ClusterRole, and ClusterRoleBinding are permitted. No CRDs, no PriorityClasses. |
| `namespaceResourceBlacklist` | ArgoCD cannot manage Secrets directly — ESO owns them. Prevents ArgoCD from overwriting or pruning ESO-managed Secrets. |
| `orphanedResources.warn` | Alerts when manually-created resources appear in the namespace that ArgoCD doesn't know about. Catches drift from `kubectl apply` without triggering deletion. |
| `roles` | Scoped CI identity that can only sync/get the dashboard Application — cannot create new Applications or modify the project. |

### 13.14 ArgoCD Application for the Dashboard

The dashboard itself is deployed via ArgoCD. The ArgoCD Application resource that manages the dashboard MUST follow these standards:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: gitops-dashboard
  namespace: argocd                   # ArgoCD's own namespace
  labels:
    app.kubernetes.io/part-of: gitops-dashboard
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: platform-tools             # dedicated ArgoCD project for platform tooling
  source:
    repoURL: https://dev.azure.com/org/project/_git/gitops-dashboard-deploy
    targetRevision: main
    path: rendered/dev-eastus          # rendered manifests — no in-cluster kustomize
  destination:
    server: https://kubernetes.default.svc
    namespace: gitops-dashboard
  syncPolicy:
    automated:
      prune: true                     # remove resources deleted from Git
      selfHeal: true                  # revert manual kubectl changes
      allowEmpty: false               # prevent accidental deletion of all resources
    syncOptions:
      - CreateNamespace=false         # namespace created by platform team, not ArgoCD
      - PrunePropagationPolicy=foreground
      - PruneLast=true                # prune after sync to avoid ordering issues
    retry:
      limit: 3
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 1m
```

| Setting | Rationale |
| ------- | --------- |
| `automated.prune: true` | Stale resources are cleaned up automatically. Required for the rendered-manifests pattern where the full desired state is in Git. |
| `automated.selfHeal: true` | Reverts manual `kubectl` changes. The dashboard namespace should never be modified outside of Git. |
| `allowEmpty: false` | Prevents an empty rendered output (build error) from deleting all dashboard resources. |
| `CreateNamespace=false` | The `gitops-dashboard` namespace has ResourceQuota, LimitRange, and NetworkPolicy that must be managed by the platform team, not created by ArgoCD. |
| `PruneLast=true` | Ensures new resources are created before old ones are pruned — prevents brief outages during resource rename/replace. |
| `retry` | Transient failures (webhook timeouts, API server overload) don't leave the dashboard in a degraded sync state. |
| `resources-finalizer` | Ensures ArgoCD cleans up all managed resources if the Application itself is deleted. |

### 13.15 Ingress Standards

The frontend Service is exposed via a Kubernetes Ingress resource. Internal-only access enforced at the ingress controller level.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: gitops-dashboard
  namespace: gitops-dashboard
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "1m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "30"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "5"
    # Internal-only: Azure internal load balancer annotation
    service.beta.kubernetes.io/azure-load-balancer-internal: "true"
spec:
  ingressClassName: nginx              # use spec field, not deprecated annotation
  tls:
    - hosts:
        - dashboard.platform.internal
      secretName: dashboard-tls
  rules:
    - host: dashboard.platform.internal
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 8080
```

- **Internal load balancer**: The `azure-load-balancer-internal` annotation ensures the ingress controller's Service gets an internal IP only. No public internet exposure.
- **TLS**: Certificate managed by cert-manager or manually provisioned. The `dashboard-tls` Secret contains the TLS cert/key for `dashboard.platform.internal`.
- **Proxy timeouts**: Aligned with connector httpx timeouts (§4). Connect: 5s. Read: 30s. Prevents long-running proxy connections from accumulating.
- **Body size limit**: 1MB. Defence in depth — GET requests have no body, but this prevents abuse if the ingress routes non-GET traffic due to misconfiguration.
- **No path-based routing to connectors**: The frontend talks to connectors via in-cluster Services (ClusterIP), not through the Ingress. Only the frontend is exposed via Ingress.

---

## 14. CI/CD Pipeline Standards

This section defines the end-to-end deployment pipeline from code commit to running containers. The pipeline implements the rendered manifests pattern referenced in the PRD (§8) and PRD-v2-gitops-pipelines.

### 14.1 Pipeline Architecture

```text
┌──────────────────────────────────────────────────────────────────┐
│  gitops-dashboard (app repo)                                     │
│                                                                  │
│  Developer pushes to feature branch                              │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  PR Pipeline (azure-pipelines.yml)                      │     │
│  │  1. lint + format check (ruff)                          │     │
│  │  2. typecheck (mypy --strict)                           │     │
│  │  3. test (pytest + vitest)                              │     │
│  │  4. security audit (§12.7)                              │     │
│  │  5. build images (docker build)                         │     │
│  │  6. scan images (trivy)                                 │     │
│  │  7. generate SBOM                                       │     │
│  └─────────────────────────────────────────────────────────┘     │
│       │ merge to main                                            │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Main Pipeline                                          │     │
│  │  1. All PR checks (re-run on merge commit)              │     │
│  │  2. Push images to ACR (sha-{commit})                   │     │
│  │  3. Tag images with semver (on release)                 │     │
│  │  4. Update deploy repo (automated PR)                   │     │
│  └─────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  gitops-dashboard-deploy (deploy repo)                           │
│                                                                  │
│  Automated PR: update image tags in overlay patches              │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Deploy Repo PR Pipeline                                │     │
│  │  1. kustomize build (validate all overlays)             │     │
│  │  2. kubeval / kubeconform (validate against K8s schema) │     │
│  │  3. kube-linter (security + best practice checks)       │     │
│  │  4. render manifests to rendered/dev-eastus/            │     │
│  └─────────────────────────────────────────────────────────┘     │
│       │ merge to main                                            │
│       ▼                                                          │
│  ArgoCD detects change → auto-sync → dashboard updated           │
└──────────────────────────────────────────────────────────────────┘
```

### 14.2 App Repo Pipeline Stages

The `azure-pipelines.yml` in the app repo defines these stages:

| Stage | Trigger | Steps | Blocking |
| ----- | ------- | ----- | -------- |
| **Validate** | PR open/update | `ruff check`, `ruff format --check`, `mypy --strict`, `tsc --noEmit`, `eslint` | Yes |
| **Test** | PR open/update | `pytest` (all connectors), `vitest` (frontend), coverage threshold check | Yes |
| **Security** | PR open/update | `detect-secrets`, `uv audit`, `npm audit`, Semgrep, `eslint-plugin-security` | Yes |
| **Build** | PR open/update | `docker build` for all changed connectors + frontend. Tag: `sha-$(Build.SourceVersion)` | Yes |
| **Scan** | PR open/update (after Build) | Trivy image scan (fail on HIGH/CRITICAL), Hadolint, SBOM generation | Yes |
| **Publish** | Merge to `main` | Push images to ACR, attach SBOM as OCI artifact, `cosign sign` image digest | Yes |
| **Promote** | Merge to `main` (after Publish) | Open automated PR on deploy repo with new image tags | No (advisory) |

- **Selective builds**: Only rebuild connector images whose source directories have changed. Use Azure Pipelines path triggers or a `changed-files` check to avoid rebuilding all 4 images on every merge.
- **No deploy from app repo**: The app repo pipeline NEVER applies Kubernetes manifests or triggers ArgoCD sync directly. All deployment flows through the deploy repo.

### 14.3 Image Promotion to Deploy Repo

After the app repo pipeline publishes images to ACR, it opens an automated PR on the deploy repo to update image tags:

```bash
# Automated by CI pipeline after image push
IMAGE_TAG="sha-${COMMIT_SHA:0:7}"
cd gitops-dashboard-deploy

# Update image tags in overlay patches using kustomize edit
cd overlays/dev-eastus
kustomize edit set image \
  gitops-dashboard/argocd-connector=acr.azurecr.io/gitops-dashboard/argocd-connector:${IMAGE_TAG} \
  gitops-dashboard/prometheus-connector=acr.azurecr.io/gitops-dashboard/prometheus-connector:${IMAGE_TAG} \
  gitops-dashboard/network-connector=acr.azurecr.io/gitops-dashboard/network-connector:${IMAGE_TAG} \
  gitops-dashboard/frontend=acr.azurecr.io/gitops-dashboard/frontend:${IMAGE_TAG}

# Render manifests
kustomize build overlays/dev-eastus > rendered/dev-eastus/manifests.yaml

# Commit and open PR
git checkout -b deploy/${IMAGE_TAG}
git add .
git commit -m "chore(deploy): update images to ${IMAGE_TAG}

Source commit: ${COMMIT_SHA}
Pipeline run: ${BUILD_URL}"
git push origin deploy/${IMAGE_TAG}
az repos pr create --title "Deploy ${IMAGE_TAG}" --auto-complete
```

- **Automated PR, not direct push**: Even automated image updates go through a PR. The deploy repo pipeline validates the rendered manifests before merge.
- **Auto-complete**: The PR auto-merges after the deploy repo pipeline passes. No human approval required for image-only updates (the code was already reviewed in the app repo PR).
- **Source traceability**: The deploy repo commit message includes the source commit SHA and pipeline run URL. `git log` in the deploy repo traces back to the exact code change.

### 14.4 Deploy Repo Pipeline

The deploy repo has its own pipeline that validates Kubernetes manifests on every PR:

| Step | Tool | What It Validates |
| ---- | ---- | ----------------- |
| **Kustomize build** | `kustomize build` | All overlays render without errors. Catches invalid patches, missing resources, broken references. |
| **Schema validation** | `kubeconform` | Rendered YAML validates against Kubernetes API schemas (correct apiVersion, required fields, valid types). |
| **Security lint** | `kube-linter` | Checks for missing `securityContext`, running as root, missing resource limits, missing NetworkPolicy, privileged containers. |
| **Diff preview** | `kustomize build \| diff` | Shows the delta between current rendered manifests and the new version. Posted as a PR comment for review. |

- **Fail on any error**: All steps are merge-blocking. Invalid YAML must never reach the `main` branch where ArgoCD watches.
- **No `kubectl apply --dry-run`**: Dry-run requires cluster access from CI. Use `kubeconform` for offline validation.

### 14.5 Rollback Procedure

When a bad deployment reaches the cluster, follow this rollback order:

| Method | Speed | When to Use |
| ------ | ----- | ----------- |
| **ArgoCD rollback** | Seconds | Immediate mitigation. `argocd app rollback gitops-dashboard` reverts to the previous sync. Temporary — next sync will re-apply the bad manifests unless the deploy repo is also reverted. |
| **Deploy repo revert** | Minutes | Definitive fix. `git revert <bad-commit>` in the deploy repo, merge, ArgoCD auto-syncs the revert. This is the standard rollback. |
| **App repo revert + re-deploy** | 10-15 min | When the bad change is in application code (not manifests). Revert in app repo, CI rebuilds image, automated PR updates deploy repo, ArgoCD syncs. |

- **Never use `kubectl` to rollback**: Manual `kubectl rollout undo` will be reverted by ArgoCD's `selfHeal` within seconds. All rollbacks go through Git.
- **ArgoCD rollback is a stopgap**: Use it to stop the bleeding, then immediately revert the deploy repo commit to make the rollback permanent.

---

## 15. Observability Standards

The dashboard monitors other systems but must also be observable itself. This section defines metrics exposition, log aggregation, and alerting for the dashboard's own health.

### 15.1 Prometheus Metrics Exposition

Each connector MUST expose a `/metrics` endpoint in Prometheus exposition format via the `prometheus-fastapi-instrumentator` library (or equivalent):

#### Default Metrics (auto-instrumented)

| Metric | Type | Description |
| ------ | ---- | ----------- |
| `http_requests_total` | Counter | Total HTTP requests by method, path, status code |
| `http_request_duration_seconds` | Histogram | Request latency distribution by method, path |
| `http_requests_in_progress` | Gauge | Currently in-flight requests |

#### Custom Metrics (per connector)

| Metric | Type | Labels | Description |
| ------ | ---- | ------ | ----------- |
| `connector_upstream_request_total` | Counter | `connector`, `environment`, `region`, `status` | Upstream API calls (success/failure) |
| `connector_upstream_request_duration_seconds` | Histogram | `connector`, `environment`, `region` | Upstream API latency |
| `connector_cache_hit_total` | Counter | `connector`, `environment`, `region` | Redis cache hits |
| `connector_cache_miss_total` | Counter | `connector`, `environment`, `region` | Redis cache misses |
| `connector_cache_error_total` | Counter | `connector`, `environment`, `region` | Redis operation failures |
| `connector_upstream_auth_failure_total` | Counter | `connector`, `environment` | Upstream auth failures (token expired/revoked) |

#### ServiceMonitor

Each connector Service has a corresponding `ServiceMonitor` for Prometheus scraping:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: argocd-connector
  namespace: gitops-dashboard
  labels:
    app.kubernetes.io/part-of: gitops-dashboard
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: argocd-connector
  endpoints:
    - port: metrics
      interval: 15s
      path: /metrics
```

- **Scrape interval**: 15s for connectors (aligned with the finest-grain TTL of 30s for ArgoCD cache).
- **Port naming**: The metrics port in the Service MUST be named `metrics` to match the ServiceMonitor `port` field.

### 15.2 ArgoCD Notifications

ArgoCD Notifications alert the platform team when the dashboard's own ArgoCD Application encounters sync issues:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-notifications-cm
  namespace: argocd
data:
  trigger.on-sync-failed: |
    - when: app.status.operationState.phase in ['Error', 'Failed']
      send: [dashboard-sync-failed]
  trigger.on-health-degraded: |
    - when: app.status.health.status == 'Degraded'
      send: [dashboard-health-degraded]
  template.dashboard-sync-failed: |
    message: |
      GitOps Dashboard sync failed: {{.app.status.operationState.message}}
      Application: {{.app.metadata.name}}
      Revision: {{.app.status.sync.revision}}
  template.dashboard-health-degraded: |
    message: |
      GitOps Dashboard health degraded
      Application: {{.app.metadata.name}}
      Health: {{.app.status.health.status}}
```

- **Notification channels**: Configure for the platform team's Slack channel or Teams webhook. Not for tenant-facing channels — this is internal platform tooling health.
- **Annotation on the Application**: `notifications.argoproj.io/subscribe.on-sync-failed.slack: platform-alerts`

### 15.3 Alerting Rules

Prometheus alerting rules for the dashboard's own health:

| Alert | Condition | Severity | Action |
| ----- | --------- | -------- | ------ |
| `DashboardConnectorDown` | `up{job=~".*connector.*"} == 0` for 5m | Warning | Connector pod not responding to scrapes. Check pod status. |
| `DashboardUpstreamAuthFailure` | `rate(connector_upstream_auth_failure_total[5m]) > 0` | Critical | ArgoCD/Azure token expired or revoked. Rotate immediately. |
| `DashboardCacheErrorRate` | `rate(connector_cache_error_total[5m]) / rate(connector_upstream_request_total[5m]) > 0.5` for 5m | Warning | Redis failing on >50% of operations. Check Redis pod. |
| `DashboardHighLatency` | `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 3` for 10m | Warning | P95 latency exceeds 3s SLA target. Check upstream API latency. |
| `DashboardSyncFailed` | ArgoCD Application sync status == `Failed` for 10m | Critical | ArgoCD cannot sync the dashboard. Check deploy repo, image availability, K8s API health. |
| `DashboardImageDrift` | Running image tag differs from deploy repo tag for 15m | Warning | ArgoCD selfHeal not working, or image pull failure. |

- **Alerting destination**: Platform team on-call channel only. No tenant-facing alerts for dashboard health — it's Tier II.
- **Runbook links**: Each alert MUST include a `runbook_url` annotation pointing to the relevant section in `docs/RUNBOOK.md`.

### 15.4 Log Aggregation

Structured JSON logs from connectors are collected by the cluster's log pipeline (Fluent Bit / Azure Monitor agent) and routed to the central log store.

| Concern | Standard |
| ------- | -------- |
| **Output** | `stdout` only. No file-based logging. Kubernetes captures stdout via the container runtime. |
| **Format** | JSON in production (structlog JSON renderer). One JSON object per line — no multi-line logs. |
| **Correlation** | Every log entry includes `request_id` (§4 Structured Logging). The frontend generates a `X-Request-ID` header on each API call; connectors propagate it through all upstream requests and log entries. |
| **Retention** | Follows the cluster's standard log retention policy (typically 30 days in Azure Log Analytics). No dashboard-specific retention override. |
| **Querying** | Logs queryable via Azure Log Analytics using `ContainerLog` table. Filter by `connector`, `environment`, `region` fields within the JSON payload. |
| **No PII** | Dashboard logs contain operational metadata only — app names, health status, image tags, namespace names. No PII, no customer data. Confirmed in PRD §10 (Security & Privacy). |
