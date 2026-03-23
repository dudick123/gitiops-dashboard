# Post-Implementation Security Review

**Reviewer role**: Senior Security Engineer
**Date**: 2026-03-23
**Scope**: Repo-scaffolding change -- all implemented code reviewed against TECH-STANDARDS Section 12 (Security Standards)
**Review type**: Post-implementation

---

## Summary

The scaffolding establishes a solid security baseline: non-root containers, detect-secrets in pre-commit, CSP headers on the frontend, bandit rules via ruff `S`, and `.gitignore` patterns for credential files. However, several TECH-STANDARDS Section 12 requirements are not yet implemented or are implemented incorrectly. Nine findings are documented below, ordered by severity.

---

## Findings

### SEC-001: Credentials stored as plain `str` instead of Pydantic `SecretStr` (HIGH)

**Standard**: TECH-STANDARDS Section 12.4 -- Credential Hygiene and Log Sanitisation
**Files affected**:
- `connectors/argocd-connector/src/cache.py` (line 12)
- `connectors/prometheus-connector/src/cache.py` (line 12)
- `connectors/network-connector/src/cache.py` (line 12)

**Finding**: `REDIS_PASSWORD` is declared as `str | None` and read via bare `os.environ.get()`. Section 12.4 mandates that all credentials be read into Pydantic `SecretStr` fields via `pydantic_settings.BaseSettings`. Plain `str` values are exposed by `repr()`, `str()`, default Python tracebacks, and any logging call that interpolates the variable. The same issue will apply to `ARGOCD_TOKEN` and `AZURE_CLIENT_SECRET` once connector clients are implemented.

**Remediation**: Create a `settings.py` per connector using `pydantic_settings.BaseSettings` with `SecretStr` fields. Replace all `os.environ.get()` credential reads with the settings model. Access raw values only via `.get_secret_value()` at the point of use (HTTP header construction, Redis client init).

---

### SEC-002: Missing `scrub_secrets` structlog processor (HIGH)

**Standard**: TECH-STANDARDS Section 12.4 -- Log Sanitisation
**Files affected**:
- `connectors/argocd-connector/src/logging_config.py`
- `connectors/prometheus-connector/src/logging_config.py`
- `connectors/network-connector/src/logging_config.py`

**Finding**: The structlog processor chain includes `merge_contextvars`, `add_log_level`, `StackInfoRenderer`, `TimeStamper`, and a renderer -- but does NOT include the `scrub_secrets` processor specified in Section 12.4. Without this processor, any log entry that contains a token, password, Authorization header value, or client secret will be emitted in cleartext to stdout (and from there to whatever log aggregation system is configured).

This is especially dangerous because `StackInfoRenderer` is present, which can render full stack frames that may contain credential values from local variables.

**Remediation**: Implement the `scrub_secrets` processor as specified in Section 12.4 (regex-based pattern matching for token, password, secret, credential, authorization, api_key). Insert it into the processor chain immediately before the renderer. The processor must be active in ALL environments, including dev.

---

### SEC-003: Placeholder credential defaults in `docker-compose.yml` (MEDIUM)

**Standard**: TECH-STANDARDS Section 12.2 -- No secrets in code
**File**: `docker-compose.yml`

**Finding**: Several environment variables have hardcoded fallback defaults that function as credentials:
- Line 28: `ARGOCD_TOKEN=${ARGOCD_TOKEN:-placeholder}`
- Line 49: `AZURE_CLIENT_ID=${AZURE_CLIENT_ID:-placeholder}`
- Line 50: `AZURE_CLIENT_SECRET=${AZURE_CLIENT_SECRET:-placeholder}`
- Line 12, 30, 54, 74: `REDIS_PASSWORD=${REDIS_PASSWORD:-local-dev-only}`

The `placeholder` defaults for `ARGOCD_TOKEN`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET` create a risk that services start without real credentials and silently operate with these values. While `docker-compose.yml` is a dev-only file, if any CI pipeline or staging environment inherits this compose file without setting the env vars, the defaults become the runtime credentials. The `REDIS_PASSWORD` default `local-dev-only` is acceptable for local dev but should be flagged with a comment that it must never be used outside local development.

**Remediation**: Remove default values for `ARGOCD_TOKEN`, `AZURE_CLIENT_ID`, and `AZURE_CLIENT_SECRET`. Use bare `${ARGOCD_TOKEN}` (no default) so Docker Compose fails loudly if the variable is not set. Alternatively, use the compose `required` attribute if supported. Add a comment to `REDIS_PASSWORD` documenting that its default is for local dev only.

---

### SEC-004: All Docker base images use mutable tags, not digest pins (MEDIUM)

**Standard**: TECH-STANDARDS Section 12.6 -- Container Security Hardening / Image Build
**Files affected**:
- `connectors/argocd-connector/Dockerfile` (lines 4, 16)
- `connectors/prometheus-connector/Dockerfile` (lines 4, 16)
- `connectors/network-connector/Dockerfile` (lines 4, 16)
- `frontend/Dockerfile` (lines 4, 17)

**Finding**: All Dockerfiles use mutable tags:
- `python:3.14-slim` (used twice per connector Dockerfile -- builder and final stage)
- `node:22-slim` (frontend builder)
- `nginx:alpine` (frontend final stage)

Section 12.6 explicitly states: "Use digest-pinned base images, not mutable tags." Mutable tags can be overwritten at any time by the upstream maintainer. A `docker build` today and a `docker build` tomorrow may produce different images from the same Dockerfile, introducing unaudited changes. This is a supply-chain attack vector.

The Dockerfiles contain `TODO` comments acknowledging this gap, which confirms it was a known deferral.

**Remediation**: Pin all `FROM` lines to `@sha256:` digests. Configure Renovate or Dependabot to auto-raise PRs when new digests are published.

---

### SEC-005: `uv:latest` tag is a mutable supply-chain risk (MEDIUM)

**Standard**: TECH-STANDARDS Section 12.6 -- Container Security Hardening
**Files affected**:
- `connectors/argocd-connector/Dockerfile` (line 9)
- `connectors/prometheus-connector/Dockerfile` (line 9)
- `connectors/network-connector/Dockerfile` (line 9)

**Finding**: The `COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv` line pulls a mutable `:latest` tag. This is the highest supply-chain risk in the current Dockerfiles because:
1. It is a third-party image (not an official Docker library image).
2. `:latest` can be overwritten at any time with arbitrary content.
3. The copied binary `/uv` runs during the build with full filesystem access.

A compromised `uv` binary could exfiltrate build secrets, inject malicious dependencies, or backdoor the resulting virtual environment.

**Remediation**: Pin to a specific version and digest: `COPY --from=ghcr.io/astral-sh/uv:0.5.14@sha256:<digest> /uv /usr/local/bin/uv`. Include this in the Renovate/Dependabot configuration for automated digest updates.

---

### SEC-006: No CORS middleware configured on any connector (MEDIUM)

**Standard**: TECH-STANDARDS Section 12.1 -- CORS Policy
**Files affected**:
- `connectors/argocd-connector/src/main.py`
- `connectors/prometheus-connector/src/main.py`
- `connectors/network-connector/src/main.py`

**Finding**: None of the three connector `main.py` files configure `CORSMiddleware`. Section 12.1 mandates explicit CORS configuration with `allow_origins` set to the specific dashboard origin, `allow_methods` restricted to `GET`, and `allow_credentials=False`. Without CORS middleware, FastAPI's default behavior applies: no CORS headers are sent, which means browsers will block cross-origin requests from the frontend. While this is "fail-closed" from a security perspective, it means the application will not function when the frontend and connectors are on different origins (the standard deployment topology). When a developer inevitably adds `allow_origins=["*"]` to unblock development, it will be an overly permissive fix.

**Remediation**: Add `CORSMiddleware` to each connector's `app` as specified in Section 12.1, with the origin read from the `CORS_ALLOWED_ORIGIN` env var.

---

### SEC-007: No rate limiting middleware (MEDIUM)

**Standard**: TECH-STANDARDS Section 12.11 -- Rate Limiting
**Files affected**:
- `connectors/argocd-connector/src/main.py`
- `connectors/prometheus-connector/src/main.py`
- `connectors/network-connector/src/main.py`

**Finding**: Section 12.11 requires per-client rate limiting (60 req/min per source IP via `slowapi` or equivalent), upstream fan-out semaphores (max 5 concurrent), and global concurrency limiting via `uvicorn --limit-concurrency 100`. None of these are implemented. The `CMD` in each Dockerfile invokes `uvicorn` without `--limit-concurrency`. No `slowapi` dependency or middleware is present.

Without rate limiting, a single misconfigured client or compromised pod could overwhelm upstream data sources (ArgoCD, Azure Monitor, Kubernetes API), causing cascading failures.

**Remediation**: Add `slowapi` to dependencies and configure rate-limiting middleware in each connector. Add `--limit-concurrency 100` to the uvicorn CMD in each Dockerfile. Implement `asyncio.Semaphore` for upstream API calls.

---

### SEC-008: Frontend nginx config generated via inline `RUN echo` (LOW)

**Standard**: TECH-STANDARDS Section 12.12 -- Frontend Security Headers
**File**: `frontend/Dockerfile` (lines 27-39)

**Finding**: The nginx configuration containing all security headers is generated by a `RUN echo '...' > /etc/nginx/conf.d/default.conf` command in the Dockerfile. This approach has several issues:
1. The config is difficult to review, lint, or test in isolation -- it is embedded in a shell string with complex quoting for CSP directives.
2. Any CI step that modifies the Dockerfile (template rendering, variable substitution) could silently corrupt the nginx config, weakening or removing security headers.
3. The config cannot be validated by nginx linting tools (`nginx -t`) until after the image is built.
4. The complex quoting around CSP directives (nested single-quote escaping) is fragile and error-prone.

**Remediation**: Create a standalone `frontend/nginx/default.conf` file that is `COPY`ed into the image. This allows the config to be linted, diffed, and reviewed as a normal file. The COPY approach is also more cache-friendly for Docker layer caching.

---

### SEC-009: No `TrustedHostMiddleware` configured (LOW)

**Standard**: TECH-STANDARDS Section 12.8 -- Security Test Patterns (references host header validation)
**Files affected**:
- `connectors/argocd-connector/src/main.py`
- `connectors/prometheus-connector/src/main.py`
- `connectors/network-connector/src/main.py`

**Finding**: FastAPI provides `TrustedHostMiddleware` to reject requests with unexpected `Host` headers, which mitigates host-header injection attacks (cache poisoning, password reset URL poisoning, SSRF via host header). None of the connectors configure it. While these services are internal, defence-in-depth principles (which the project explicitly follows, per Section 12.13) suggest adding it.

**Remediation**: Add `TrustedHostMiddleware` to each connector with `allowed_hosts` set to the expected service hostname(s).

---

## Positive Observations

The following security controls are correctly implemented:

| Control | Status | Notes |
|---------|--------|-------|
| `.gitignore` credential patterns | PASS | Covers `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials.json`, `**/secrets/` per Section 12.2 |
| `detect-secrets` pre-commit hook | PASS | Configured with `.secrets.baseline` per Section 12.2 |
| `no-commit-to-branch` for `main` | PASS | Prevents direct pushes to main |
| Ruff `S` (bandit) rules | PASS | Static analysis catches hardcoded passwords, unsafe YAML loading, etc. |
| Non-root container users | PASS | All Dockerfiles create and switch to UID 1000 |
| Container health checks | PASS | All Dockerfiles and docker-compose services have health checks |
| ESLint `react/no-danger` rule | PASS | Prevents innerHTML-based XSS vector |
| `sourcemap: false` in Vite build | PASS | Prevents source code exposure in production |
| CSP headers present | PASS | All five required headers from Section 12.12 are present in the nginx config |
| `commitlint` hook | PASS | Enforces conventional commit messages |
| Redis `--requirepass` | PASS | Redis requires authentication in docker-compose |
| Redis persistence disabled | PASS | `--save ""` and `--appendonly no` prevent credential data from persisting to disk |

---

## Risk Summary

| Severity | Count | Findings |
|----------|-------|----------|
| HIGH     | 2     | SEC-001, SEC-002 |
| MEDIUM   | 5     | SEC-003, SEC-004, SEC-005, SEC-006, SEC-007 |
| LOW      | 2     | SEC-008, SEC-009 |

**Recommendation**: SEC-001 and SEC-002 should be resolved before any connector handles real credentials or processes upstream API responses. SEC-003 through SEC-005 should be resolved before the first container image is built in CI. SEC-006 and SEC-007 should be resolved when connector endpoints are implemented. SEC-008 and SEC-009 are lower priority but should be addressed before production deployment.
