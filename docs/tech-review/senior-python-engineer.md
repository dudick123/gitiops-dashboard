---
reviewer: Senior Python Engineer
proposal: repo-scaffolding
date: 2026-03-23
status: Review Complete
---

# Senior Python Engineer — Review: repo-scaffolding

## Summary

The repo-scaffolding proposal provides a solid structural foundation for the monorepo, but it contains several direct contradictions with TECH-STANDARDS.md v1.5 that would create immediate technical debt if implemented as written. The most critical issues are: mandating `pip` and `hatchling` when the standards require `uv` as the sole package manager, placing Ruff configuration in a standalone `ruff.toml` when the standards require it to live in `pyproject.toml`, specifying only 4 of the required 19 Ruff rule sets, and using per-connector TTL values (30s/60s/120s) that were superseded by the uniform 30-minute TTL defined in TECH-STANDARDS.md and CLAUDE.md. These are not subjective recommendations — they are documented, enforceable standards that CI pipelines will gate on.

## Critical Findings

### Finding P-1: Package manager is `pip`/`hatchling` — standards mandate `uv`

- **Artifact**: design.md, tasks.md, spec.md
- **Location**: design.md Decision 2; tasks.md 2.1/3.1/4.1; spec.md Scenario "Connector installs independently"
- **Issue**: The design explicitly chooses `hatchling` as the build backend and `pip install -e .` as the installation command. TECH-STANDARDS.md section 3 ("Dependency Management — Python") states: "`uv` is the sole package manager. Never use `pip install` directly." It further mandates `uv.lock` committed to the repository, `uv sync --frozen` in CI and container builds, and `uv add` for dependency management. The Makefile scenario in spec.md also references pip for `make install`.
- **Impact**: If scaffolded with pip/hatchling, every subsequent proposal (connectors, CI pipelines, Dockerfiles) will build on the wrong package manager. Migrating from pip to uv after code is in place is more disruptive than starting correctly. CI pipelines will fail against the standards.
- **Recommendation**: Replace `hatchling` build backend with `uv`-compatible configuration. Each connector's `pyproject.toml` should work with `uv sync`. Add a root-level `pyproject.toml` declaring the `uv` workspace (per TECH-STANDARDS.md section 3: "Shared dev dependencies... declared in a workspace-level `pyproject.toml` dev group"). All tasks referencing `pip install -e .` should be changed to `uv sync`. Dockerfiles should use `uv sync --frozen --no-dev`. Commit `uv.lock` per connector.

### Finding P-2: Ruff config in `ruff.toml` — standards require `pyproject.toml`

- **Artifact**: design.md, tasks.md, proposal.md, spec.md
- **Location**: design.md Decision 3; tasks.md 1.2; proposal.md bullet 8; spec.md "Ruff configuration targets Python 3.14"
- **Issue**: TECH-STANDARDS.md section 1 ("Formatting") states explicitly: "Config location: All Ruff configuration lives in `pyproject.toml` under `[tool.ruff]`. No `ruff.toml` or `.ruff.toml` files." The proposal creates a standalone `ruff.toml` at the repo root.
- **Impact**: Immediate standards violation. Creates a precedent that will be cargo-culted into future proposals. CI enforcement checking for `ruff.toml` absence will flag this.
- **Recommendation**: Remove the `ruff.toml` task. Place all Ruff configuration under `[tool.ruff]` and `[tool.ruff.lint]` in the root-level workspace `pyproject.toml` (which should exist per Finding P-1). If per-connector overrides are needed, they go in each connector's `pyproject.toml`.

### Finding P-3: Only 4 of 19 required Ruff rule sets specified

- **Artifact**: tasks.md, spec.md
- **Location**: tasks.md 1.2; spec.md "Ruff configuration targets Python 3.14"
- **Issue**: Tasks.md specifies rule sets `E`, `F`, `I`, `UP`. TECH-STANDARDS.md section 1 ("Linting") mandates 19 rule sets: `E`, `F`, `W`, `I`, `UP`, `S`, `B`, `A`, `C4`, `PT`, `SIM`, `TCH`, `DTZ`, `PIE`, `RSE`, `RET`, `FBT`, `ASYNC`, `RUF`. The missing 15 rule sets include critical categories: `S` (bandit/security), `B` (bugbear), `PT` (pytest-style), `TCH` (type-checking imports), and `ASYNC` (async correctness).
- **Impact**: Security-relevant rules (`S`), async correctness rules (`ASYNC`), and pytest-style rules (`PT`) will not be enforced from the start. Code written against the scaffold will accumulate violations that are costly to fix retroactively.
- **Recommendation**: The scaffold task must include all 19 rule sets from TECH-STANDARDS.md. The Ruff config should be: `select = ["E", "F", "W", "I", "UP", "S", "B", "A", "C4", "PT", "SIM", "TCH", "DTZ", "PIE", "RSE", "RET", "FBT", "ASYNC", "RUF"]`.

### Finding P-4: Cache TTL values contradict TECH-STANDARDS.md uniform 30-minute TTL

- **Artifact**: tasks.md
- **Location**: tasks.md 2.4 (30s), 3.4 (60s), 4.4 (120s)
- **Issue**: The tasks specify per-connector TTL values: ArgoCD 30s, Prometheus 60s, Network 120s. These are the old values from an earlier PRD revision. TECH-STANDARDS.md section 4 ("Redis Conventions") and section 2 ("Per-Connector Polling") both establish a uniform 30-minute (1,800,000ms) TTL across all connectors. CLAUDE.md explicitly confirms: "Uniform 30-minute TTL across all connectors."
- **Impact**: If the scaffold hardcodes old TTL constants, every connector proposal will inherit the wrong values. Frontend polling intervals are calibrated to 30 minutes; mismatched TTLs would cause unnecessary upstream load or stale data beyond expectations.
- **Recommendation**: All three `cache.py` skeletons should define `CACHE_TTL_SECONDS = 1800` (30 minutes). Add a comment referencing TECH-STANDARDS.md section 4.

### Finding P-5: Missing `mypy` configuration and enforcement

- **Artifact**: tasks.md, spec.md, design.md
- **Location**: Not present in any artifact
- **Issue**: TECH-STANDARDS.md section 1 ("Type Annotations") mandates: "`mypy --strict` MUST pass with zero errors across all connector packages." The Makefile targets in TECH-STANDARDS.md section 9 include `typecheck: Run mypy --strict on all connectors`. The proposal creates no mypy configuration — no `[tool.mypy]` section in `pyproject.toml`, no `mypy.ini`, and no `typecheck` Makefile target. The tasks.md Makefile target list omits `typecheck` entirely.
- **Impact**: Without mypy configured from the start, the first connector implementation will proceed without type checking. Retrofitting `--strict` mypy compliance onto an existing codebase is significantly more painful than starting with it.
- **Recommendation**: Add a `[tool.mypy]` section in each connector's `pyproject.toml` with `strict = true`. Add `mypy` to the dev dependency group. Add `typecheck` and `check` (lint + typecheck + test) targets to the Makefile.

### Finding P-6: Missing `httpx` dependency in argocd-connector and prometheus-connector

- **Artifact**: tasks.md
- **Location**: tasks.md 2.1, 3.1
- **Issue**: TECH-STANDARDS.md section 4 ("HTTP Client") mandates `httpx` as the HTTP client for all upstream API calls. The argocd-connector task (2.1) lists FastAPI, Pydantic v2, structlog, redis, uvicorn, httpx — but the prometheus-connector task (3.1) omits httpx. Both argocd-connector and prometheus-connector call upstream HTTP APIs and require httpx. The network-connector correctly lists `kubernetes` (which bundles its own HTTP client).
- **Impact**: Prometheus-connector implementation would need to add httpx as a dependency before any upstream API call can be made, creating a deviation from the scaffold.
- **Recommendation**: Explicitly include `httpx` in the prometheus-connector `pyproject.toml` dependency list (task 3.1). Consider also adding it to network-connector for consistency, since TECH-STANDARDS.md mandates it for all connectors.

## Recommendations

### Recommendation P-7: Add workspace-level `pyproject.toml` for shared dev dependencies

- **Artifact**: design.md, tasks.md
- **Location**: Design Decision 1; no corresponding task exists
- **Issue**: TECH-STANDARDS.md section 3 specifies: "Shared dev dependencies: Common dev tools (ruff, mypy, pytest, pytest-asyncio, pytest-cov, pytest-mock) are declared in a workspace-level `pyproject.toml` dev group so all connectors share the same versions." The proposal has no task for creating this root-level `pyproject.toml`.
- **Impact**: Without a shared dev dependency declaration, each connector will independently pin different versions of ruff, mypy, and pytest, leading to inconsistent behavior across connectors.
- **Recommendation**: Add a task to create a root `pyproject.toml` with `[project]` metadata (name = "gitops-dashboard", version = "0.0.0"), `[tool.uv.workspace]` members pointing to each connector, and `[dependency-groups]` dev = [...] listing shared dev tools. This is also the natural home for the `[tool.ruff]` and `[tool.mypy]` configuration (see Findings P-2 and P-5).

### Recommendation P-8: Add `conftest.py` files to test scaffolding

- **Artifact**: tasks.md
- **Location**: tasks.md 2.6, 3.6, 4.6
- **Issue**: TECH-STANDARDS.md section 8 ("Testing Strategy") states: "Shared fixtures live in `conftest.py`." and "Common fixtures across connectors (e.g., mock Redis, mock httpx responses) live in a shared `tests/fixtures/` package." The scaffold creates `tests/` directories with `__init__.py` but no `conftest.py`.
- **Impact**: Every connector implementation will need to create conftest.py from scratch, and without a shared fixtures pattern from the start, each will invent its own approach to mocking Redis and httpx.
- **Recommendation**: Add `conftest.py` to each connector's `tests/` directory (even if initially empty with a docstring). Create `tests/unit/` and `tests/integration/` subdirectories per the TECH-STANDARDS.md section 8 structure, instead of `tests/generated/` and `tests/integration/`. Add a `tests/fixtures/` package placeholder.

### Recommendation P-9: Add `py.typed` marker files

- **Artifact**: tasks.md
- **Location**: tasks.md 2.2/2.3, 3.2/3.3, 4.2/4.3
- **Issue**: PEP 561 requires a `py.typed` marker file in the package root for mypy to recognize the package as typed. Since TECH-STANDARDS.md mandates `mypy --strict`, this marker is required for correct type-checking when one package references another (e.g., during test imports).
- **Impact**: Without `py.typed`, mypy may report missing type stubs for the connector packages themselves when running in strict mode.
- **Recommendation**: Add an empty `py.typed` file to each connector's `src/` directory as part of the scaffold.

### Recommendation P-10: Add `orjson` to connector dependencies

- **Artifact**: tasks.md
- **Location**: tasks.md 2.1, 3.1, 4.1
- **Issue**: TECH-STANDARDS.md section 4 ("Redis Conventions") mandates `orjson.dumps()` / `orjson.loads()` for cache value serialization. The dependency lists in tasks.md do not include `orjson`.
- **Impact**: Cache implementation will require adding orjson as an afterthought. Minor, but the purpose of the scaffold is to have all known dependencies declared from the start.
- **Recommendation**: Add `orjson` to each connector's `pyproject.toml` dependencies.

### Recommendation P-11: Add `pydantic-settings` to connector dependencies

- **Artifact**: tasks.md
- **Location**: tasks.md 2.1, 3.1, 4.1
- **Issue**: TECH-STANDARDS.md section 4 ("Pydantic v2 Conventions") and section 12.4 ("Credential Hygiene") use `BaseSettings` with `SettingsConfigDict(env_prefix=...)` for connector configuration. Since Pydantic v2, `BaseSettings` lives in the separate `pydantic-settings` package. This is not listed in any connector's dependencies.
- **Impact**: The very first configuration implementation will fail to import `BaseSettings` until the developer discovers and adds this dependency.
- **Recommendation**: Add `pydantic-settings` to each connector's `pyproject.toml` dependencies.

### Recommendation P-12: Dockerfile should use multi-stage build with `uv`

- **Artifact**: tasks.md, spec.md
- **Location**: tasks.md 2.5/3.5/4.5; spec.md "Dockerfiles produce minimal container images"
- **Issue**: TECH-STANDARDS.md section 5 ("Production Dockerfiles") specifies: "Multi-stage build. Builder stage runs `uv sync --frozen --no-dev`. Final stage copies the virtual environment into `python:3.14-slim`. Runs as non-root user (UID 1000)." Section 12.6 further requires digest-pinned base images and read-only root filesystem considerations. The proposal references `pip install` and single-stage builds with no mention of non-root users, digest pinning, or multi-stage patterns.
- **Impact**: Dockerfiles that use pip, run as root, and lack multi-stage builds will immediately fail container security scanning (Hadolint, Trivy) required by TECH-STANDARDS.md section 12.7.
- **Recommendation**: Scaffold Dockerfiles should use the multi-stage `uv sync --frozen --no-dev` pattern. Include `USER 1000:1000`, `EXPOSE` on ports > 1024, and a comment placeholder for digest pinning. Even as scaffolds, they should be structurally correct.

### Recommendation P-13: Add `pre-commit` configuration

- **Artifact**: tasks.md
- **Location**: Not present
- **Issue**: TECH-STANDARDS.md section 6 ("Pre-commit Hooks") mandates `.pre-commit-config.yaml` with specific hooks: ruff check, ruff format, mypy, prettier, eslint, check-yaml, check-json, detect-secrets, no-commit-to-branch. The proposal does not include this file.
- **Impact**: Without pre-commit from the start, developers will commit code that fails CI. The standards say "All developers MUST install pre-commit hooks" — having the config in the scaffold is a prerequisite for this.
- **Recommendation**: Add a task to create `.pre-commit-config.yaml` with the hooks listed in TECH-STANDARDS.md section 6. Include `.secrets.baseline` generation.

### Recommendation P-14: Test directory structure should be `tests/unit/` and `tests/integration/`, not `tests/generated/` and `tests/integration/`

- **Artifact**: tasks.md
- **Location**: tasks.md 2.6, 3.6, 4.6
- **Issue**: TECH-STANDARDS.md section 8 defines: "`tests/unit/` for fast isolated tests, `tests/integration/` for tests requiring a running service." It also mentions `tests/generated/` for auto-generated spec-conformance tests. The scaffold should include all three: `tests/unit/`, `tests/integration/`, and `tests/generated/`.
- **Impact**: Minor structural issue, but the tests directory layout in tasks.md (2.6) only mentions `generated/` and `integration/`, missing the primary `unit/` directory where most tests will live.
- **Recommendation**: Create `tests/unit/`, `tests/integration/`, and `tests/generated/` subdirectories in each connector's test scaffold.

### Recommendation P-15: Makefile targets are incomplete compared to TECH-STANDARDS.md section 9

- **Artifact**: tasks.md, spec.md
- **Location**: tasks.md 1.3; spec.md "Makefile provides standard development commands"
- **Issue**: Tasks.md lists Makefile targets: install, build, test, lint, format, docker-up, docker-down, generate-stubs, generate-ts-clients. TECH-STANDARDS.md section 9 defines a larger set including: `typecheck`, `typecheck-frontend`, `lint-frontend`, `format-frontend`, `test-frontend`, `test-unit`, `test-int`, `check`, `check-all`, `security-audit`. Several of these are essential for CI parity.
- **Impact**: Developers will not have a single-command way to run the full CI check suite locally, which is a primary goal of the Makefile.
- **Recommendation**: Include at minimum the `typecheck`, `check` (lint + typecheck + test), `lint-frontend`, `format-frontend`, `test-frontend`, and `test-unit`/`test-int` targets from TECH-STANDARDS.md section 9.

## Observations

### Observation P-16: `line-length` discrepancy (100 vs 99)

Tasks.md 1.2 specifies `line-length 100` in the ruff config. TECH-STANDARDS.md section 1 specifies 99 characters. This is a minor difference but should match exactly — 99 is the standard.

### Observation P-17: Structlog template should include secret scrubbing processor

Design Decision 7 and tasks.md 8.1 describe the structlog template as including "JSON output, bound processors for service name and environment." TECH-STANDARDS.md section 12.4 requires a `scrub_secrets` processor in the structlog processor chain "for all environments (including dev)." The scaffold template should include this processor from the start, even if the implementation is a placeholder.

### Observation P-18: Consider adding `.python-version` file

While not explicitly mandated by TECH-STANDARDS.md, a `.python-version` file (containing `3.14`) at the repo root helps `uv` and other tools auto-detect the target Python version. This is a common convention in `uv`-managed projects.

### Observation P-19: `src/` layout vs standard Python `src/` layout

The proposal uses `connectors/argocd-connector/src/main.py` as the package root. Standard Python packaging convention for the `src` layout is `src/<package_name>/`, e.g., `connectors/argocd-connector/src/argocd_connector/main.py`. The flat `src/` approach may cause import path issues and makes `py.typed` placement ambiguous. Consider whether the package should be namespaced (e.g., `src/argocd_connector/`).

### Observation P-20: Missing `__main__.py` for CLI invocation

While not strictly required for FastAPI services (uvicorn is the entry point), adding `__main__.py` to each connector package enables `python -m argocd_connector` invocation, which is useful for debugging and aligns with Python packaging best practices.

### Observation P-21: `redis` vs `redis[hiredis]` dependency

TECH-STANDARDS.md specifies `redis.asyncio` as the async Redis client. The `redis` package supports an optional `hiredis` C extension for significantly faster parsing. For a caching-heavy application, `redis[hiredis]` is a worthwhile default.

## Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| Python 3.14 minimum | PASS | Correctly specified in all connector pyproject.toml tasks |
| `uv` as sole package manager | FAIL | Proposal uses pip/hatchling; see Finding P-1 |
| `uv.lock` committed | FAIL | Not mentioned in proposal; see Finding P-1 |
| `uv sync --frozen` in containers | FAIL | Dockerfiles use pip install; see Finding P-1, Recommendation P-12 |
| Workspace-level dev dependencies | FAIL | No root pyproject.toml with shared dev group; see Recommendation P-7 |
| Ruff config in `pyproject.toml` | FAIL | Proposal creates `ruff.toml`; see Finding P-2 |
| 19 Ruff rule sets enabled | FAIL | Only 4 of 19 specified; see Finding P-3 |
| Line length 99 | FAIL | Proposal specifies 100; see Observation P-16 |
| `mypy --strict` | FAIL | No mypy configuration or Makefile target; see Finding P-5 |
| Uniform 30-minute cache TTL | FAIL | Old per-connector TTLs (30s/60s/120s); see Finding P-4 |
| `httpx` mandated HTTP client | PARTIAL | Present in argocd-connector, missing from prometheus-connector; see Finding P-6 |
| `orjson` for Redis serialization | FAIL | Not in dependency lists; see Recommendation P-10 |
| `pydantic-settings` for config | FAIL | Not in dependency lists; see Recommendation P-11 |
| Digest-pinned Docker base images | FAIL | Proposal uses mutable tags; see Recommendation P-12 |
| Non-root container user (UID 1000) | FAIL | Not specified in Dockerfile tasks; see Recommendation P-12 |
| Multi-stage Docker builds | FAIL | Not specified for connectors; see Recommendation P-12 |
| Pre-commit hooks configured | FAIL | No `.pre-commit-config.yaml` task; see Recommendation P-13 |
| Test structure (unit/integration/generated) | PARTIAL | Missing `tests/unit/`; see Recommendation P-14 |
| `conftest.py` with shared fixtures | FAIL | Not scaffolded; see Recommendation P-8 |
| `pytest-asyncio` auto mode configured | FAIL | No `asyncio_mode = "auto"` in pyproject.toml |
| Makefile targets per TECH-STANDARDS section 9 | PARTIAL | Missing typecheck, check, frontend-specific targets; see Recommendation P-15 |
| FastAPI lifespan pattern | N/A | Implementation detail, not scaffold scope |
| structlog secret scrubbing | PARTIAL | Template described but scrub processor not mentioned; see Observation P-17 |
| `py.typed` marker | FAIL | Not included; see Recommendation P-9 |
| Google-style docstrings | N/A | No code to evaluate yet |
| PEP 484 type annotations | N/A | No code to evaluate yet |
