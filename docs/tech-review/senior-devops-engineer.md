---
reviewer: Senior DevOps Engineer
proposal: repo-scaffolding
date: 2026-03-23
status: Review Complete
---

# Senior DevOps Engineer — Review: repo-scaffolding

## Summary

The repo-scaffolding proposal provides a reasonable Phase 0 foundation for the GitOps Dashboard monorepo, establishing directory structure, dependency declarations, Dockerfiles, Docker Compose, and a Makefile. However, the proposal diverges from TECH-STANDARDS.md in several critical areas: it uses `pip` instead of the mandated `uv` package manager, omits 8 of the 17 required Makefile targets, produces Dockerfiles that lack multi-stage builds, non-root users, and digest-pinned base images, and excludes any CI/CD stub despite the pipeline being tightly coupled to the scaffold's structure. These gaps, if not addressed before implementation, will require substantial rework during the connector and pipeline proposals.

## Critical Findings

### Finding DO-1: Package Manager Mismatch — pip vs uv

- **Artifact**: design.md (Decision 2), tasks.md (Tasks 2.5, 3.5, 4.5), spec.md (install scenario)
- **Location**: design.md Decision 2 ("pip install -e ."), tasks.md Task 2.5 ("pip install, uvicorn entrypoint"), spec.md ("pip SHALL install each connector in editable mode")
- **Issue**: The proposal uses `pip install -e .` for development and `pip install` in Dockerfiles. TECH-STANDARDS.md section 3 explicitly states: "`uv` is the sole package manager. Never use `pip install` directly." Section 5 specifies production Dockerfiles use `uv sync --frozen --no-dev`. CI builds use `uv sync --frozen` for reproducibility.
- **Impact**: Building with `pip` instead of `uv` means no lockfile enforcement (`uv.lock`), no reproducible builds, and every subsequent proposal (connectors, CI pipeline) must retrofit `uv`. The `pyproject.toml` build backend choice of `hatchling` is also inconsistent with a `uv`-managed workflow.
- **Recommendation**: Replace all `pip install` references with `uv sync`. Use `uv sync --frozen` in Dockerfiles and CI. Ensure `uv.lock` is generated and committed as part of the scaffold. The `make install` target should run `uv sync` per connector, not `pip install -e .`.

### Finding DO-2: Makefile Target Coverage — 9 of 17 Required Targets

- **Artifact**: tasks.md (Task 1.3), spec.md (Makefile requirement)
- **Location**: tasks.md Task 1.3, spec.md "Requirement: Makefile provides standard development commands"
- **Issue**: The proposal defines 9 Makefile targets: `install`, `build`, `test`, `lint`, `format`, `docker-up`, `docker-down`, `generate-stubs`, `generate-ts-clients`. TECH-STANDARDS.md section 9 defines 17 targets including: `lint-frontend`, `format-frontend`, `typecheck`, `typecheck-frontend`, `test-frontend`, `test-unit`, `test-int`, `check`, `check-all`, `security-audit`, `generate-sbom`, `render-manifests`, `validate-manifests`, `lighthouse`. Eight targets are missing.
- **Impact**: Missing `typecheck` (mypy) and `check` / `check-all` targets means the CI-equivalent local command is unavailable from day one. Missing `lint-frontend` and `format-frontend` means the combined `lint` and `format` targets must handle both Python and frontend — which works but diverges from the granular structure in the standard. Developers cannot run backend-only or frontend-only checks independently.
- **Recommendation**: Add all 17 targets from section 9. Targets for features not yet implemented (e.g., `render-manifests`, `lighthouse`) should be stubs that print a "not yet implemented" message and exit 0, establishing the interface contract early. At minimum, `typecheck`, `typecheck-frontend`, `test-frontend`, `check`, and `check-all` must be functional since they are required for the PR pipeline (section 14.2).

### Finding DO-3: Connector Dockerfiles Are Not Production-Ready

- **Artifact**: tasks.md (Tasks 2.5, 3.5, 4.5), spec.md (Dockerfile requirement)
- **Location**: tasks.md Tasks 2.5, 3.5, 4.5 — "python:3.14-slim base, pip install, uvicorn entrypoint"
- **Issue**: The proposed connector Dockerfiles violate multiple TECH-STANDARDS.md requirements:
  1. **No multi-stage build** — Section 5 requires "Multi-stage build. Builder stage runs `uv sync --frozen --no-dev`. Final stage copies the virtual environment into `python:3.14-slim`."
  2. **No non-root user** — Section 12.6 requires `runAsUser: 1000`, and section 5 states "Runs as non-root user (UID 1000)." The Dockerfile must create and switch to a non-root user.
  3. **No digest-pinned base image** — Section 12.6 requires `FROM python:3.14-slim@sha256:abc123...` not `FROM python:3.14-slim`.
  4. **Uses pip instead of uv** — As noted in DO-1.
  5. **No HEALTHCHECK** — Section 5 states "All images expose health check endpoints for Kubernetes liveness/readiness probes."
- **Impact**: Images built from these Dockerfiles will fail Hadolint checks in the CI security pipeline (section 14.2), fail kube-linter checks for running as root, and produce non-reproducible builds. Every connector proposal will need to rewrite the Dockerfile.
- **Recommendation**: Scaffold production-quality Dockerfiles from the start. Template:
  ```dockerfile
  FROM python:3.14-slim@sha256:<pin> AS builder
  COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
  WORKDIR /app
  COPY pyproject.toml uv.lock ./
  RUN uv sync --frozen --no-dev
  COPY src/ ./src/

  FROM python:3.14-slim@sha256:<pin>
  RUN groupadd -g 1000 app && useradd -u 1000 -g app app
  COPY --from=builder /app/.venv /app/.venv
  COPY --from=builder /app/src /app/src
  USER 1000
  EXPOSE 8000
  HEALTHCHECK CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
  ENTRYPOINT ["/app/.venv/bin/uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
  ```

### Finding DO-4: No Lockfile Strategy for Reproducible Builds

- **Artifact**: design.md (Decision 2, Decision 4), tasks.md, spec.md
- **Location**: design.md Decision 2 (hatchling), Decision 4 (pnpm)
- **Issue**: The proposal does not mention `uv.lock` for Python or commit strategy for `pnpm-lock.yaml`. TECH-STANDARDS.md section 3 mandates: "`uv.lock` is committed to the repository" and "All CI and container builds use `uv sync --frozen` for reproducible installs." For frontend: "`package-lock.json` (or `pnpm-lock.yaml`) is committed." Without lockfiles in the scaffold, builds are non-deterministic from day one.
- **Impact**: Two developers running `make install` on the same commit may get different dependency versions. Docker builds at different times will produce different images. This breaks the immutable image guarantee in section 13.11.
- **Recommendation**: Generate and commit `uv.lock` for each connector and `pnpm-lock.yaml` for the frontend as part of the scaffold. The `make install` target should use `uv sync` (which respects `uv.lock`) and `pnpm install --frozen-lockfile`.

### Finding DO-5: No CI/CD Pipeline Stub

- **Artifact**: proposal.md (Impact section), design.md (Non-Goals)
- **Location**: proposal.md line 39 — "pipeline definition itself is out of scope"
- **Issue**: While the full pipeline implementation is correctly out of scope (it belongs to PRD-v2-gitops-pipelines), the proposal creates the exact directory structure and build commands that `azure-pipelines.yml` will invoke. Without even a stub pipeline file, there is no validation that the scaffold's structure is CI-compatible. TECH-STANDARDS.md section 14.2 defines 7 pipeline stages that depend on Makefile targets, Dockerfile locations, and test directory structure — all established by this scaffold.
- **Impact**: The pipeline proposal will need to reverse-engineer the scaffold's conventions. A stub pipeline that runs `make check-all` on PR would catch structural issues immediately and provide a working CI loop from the first connector PR.
- **Recommendation**: Add a minimal `azure-pipelines.yml` stub that runs `make check-all` on PR triggers and `make build` on main. This is not "implementing CI/CD" — it is validating that the scaffold works in CI. Full pipeline stages (security, scan, publish, promote) remain out of scope.

### Finding DO-6: Missing Observability Scaffolding

- **Artifact**: tasks.md (Task 8.1), design.md (Decision 7)
- **Location**: tasks.md Task 8.1 — structlog configuration only
- **Issue**: The proposal includes structlog configuration (Task 8.1) but omits `prometheus-fastapi-instrumentator` from connector dependencies and does not scaffold a `/metrics` endpoint. TECH-STANDARDS.md section 15.1 requires every connector to expose Prometheus metrics. The `pyproject.toml` dependency lists in tasks 2.1, 3.1, 4.1 include `fastapi`, `pydantic`, `structlog`, `redis`, `uvicorn`, `httpx` — but not `prometheus-fastapi-instrumentator`.
- **Impact**: Every connector proposal will need to independently add the metrics library and wire it into the FastAPI app. Since the scaffold already creates `src/main.py` with a minimal FastAPI app, this is the natural place to include the instrumentator setup.
- **Recommendation**: Add `prometheus-fastapi-instrumentator` to each connector's `pyproject.toml` dependencies. Add the instrumentator middleware to the scaffolded `src/main.py` alongside the health endpoint. This establishes the observability pattern from day one.

## Recommendations

### Recommendation DO-1: Align Build Tooling with uv from Day One

Replace all references to `pip` and `hatchling` with `uv`-based workflows. The scaffold should produce a working `uv sync` experience for every connector. This is the single highest-impact change because it affects every file in the proposal: `pyproject.toml`, `Makefile`, `Dockerfile`, `docker-compose.yml`, and `spec.md` scenarios.

### Recommendation DO-2: Scaffold All 17 Makefile Targets

Implement the full target list from section 9. Targets for unimplemented features should be no-op stubs with a clear message. This ensures the Makefile interface is stable — downstream proposals and pipeline definitions can reference targets by name without worrying about whether they exist yet.

### Recommendation DO-3: Use Production-Quality Dockerfile Templates

Even though no business logic exists yet, the Dockerfile structure (multi-stage, non-root, digest-pinned, uv-based) should be correct from the start. Retrofitting Dockerfiles is error-prone and typically deferred until it becomes a blocking CI failure.

### Recommendation DO-4: Add a Minimal CI Pipeline Stub

A 20-line `azure-pipelines.yml` that runs `make check-all` on PRs provides immediate validation that the scaffold works in CI. This closes the gap between "scaffold created" and "first connector PR can be validated."

### Recommendation DO-5: Include pre-commit Configuration

TECH-STANDARDS.md section 6 defines 9 required pre-commit hooks. The scaffold should include `.pre-commit-config.yaml` so that code quality enforcement is active from the first commit of real code. This file is trivial to scaffold and has no dependencies on unimplemented features.

### Recommendation DO-6: Add Health Check and Metrics to Scaffold main.py

The scaffolded `src/main.py` already includes a health endpoint. Extend it to include the `prometheus-fastapi-instrumentator` middleware and a basic structlog configuration import. This establishes the patterns that all connector proposals will follow.

### Recommendation DO-7: Define docker-compose.yml with Health Checks and Dependency Ordering

The proposed `docker-compose.yml` should include `healthcheck` definitions for Redis and each connector, and `depends_on` with `condition: service_healthy` to ensure proper startup ordering. Without this, `docker compose up` may start connectors before Redis is ready, causing startup failures.

## Observations

1. **Frontend Dockerfile is closer to standard**: Task 5.12 specifies a multi-stage Node build to nginx, which aligns with section 5. However, it still lacks digest-pinned bases and non-root user configuration.

2. **pnpm vs npm ambiguity**: design.md Decision 4 selects pnpm, but TECH-STANDARDS.md section 3 says "`npm` (or `pnpm` if adopted)". The proposal should commit to one and be consistent across Makefile, Dockerfile, and docker-compose.yml. If pnpm is chosen, the frontend Dockerfile should use `pnpm install --frozen-lockfile`, not `npm ci`.

3. **Docker Compose simplified topology is acceptable**: Running one instance per connector type for local dev is a reasonable trade-off explicitly acknowledged in design.md. The full production topology (3 ArgoCD + 1 Prometheus + 6 Network) is an integration test concern, not a local dev concern.

4. **Placeholder scripts are appropriately scoped**: The decision to make `generate-stubs.py` and `generate-ts-clients.sh` non-functional placeholders is correct. Real generation logic depends on actual OpenAPI specs which do not exist yet.

5. **Missing .pre-commit-config.yaml**: Section 6 of TECH-STANDARDS.md defines 9 mandatory pre-commit hooks. The proposal does not mention pre-commit at all. While hooks require the tools to exist (ruff, mypy, eslint, prettier, detect-secrets), the configuration file itself can be scaffolded with the correct hook definitions.

6. **Missing .devcontainer configuration**: Section 5 of TECH-STANDARDS.md defines a dev container specification. This is not mentioned in the proposal. While not critical for Phase 0, it is a notable omission.

7. **No mypy configuration**: TECH-STANDARDS.md requires `mypy --strict` (sections 6, 9, 14.2). The proposal does not include a `mypy.ini` or `[tool.mypy]` section in `pyproject.toml`. Without this, the `typecheck` Makefile target has no configuration to reference.

8. **Image tagging not reflected in Dockerfiles**: Section 13.11 defines the `gitops-dashboard/{component}` naming convention and `sha-{commit}` / semver tagging strategy. The Dockerfiles and docker-compose.yml should use image names that match this convention (e.g., `image: gitops-dashboard/argocd-connector:local`) so that the naming pattern is established early.

## Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| TECH-STANDARDS.md section 3 (Dependency Management) | Non-Compliant | Uses pip instead of uv; no uv.lock; no frozen installs |
| TECH-STANDARDS.md section 5 (Production Dockerfiles) | Non-Compliant | No multi-stage build, no non-root user, no digest pins for connectors |
| TECH-STANDARDS.md section 6 (Pre-commit Hooks) | Not Addressed | No .pre-commit-config.yaml in proposal |
| TECH-STANDARDS.md section 9 (Makefile Commands) | Partial | 9 of 17 targets defined; missing typecheck, test-frontend, check, check-all, security-audit, generate-sbom, render-manifests, validate-manifests, lighthouse, lint-frontend, format-frontend, typecheck-frontend, test-unit, test-int |
| TECH-STANDARDS.md section 12.6 (Container Security) | Non-Compliant | No digest-pinned bases, no non-root user, no read-only filesystem consideration |
| TECH-STANDARDS.md section 13.11 (Image Registry/Tagging) | Not Addressed | No image naming convention in Dockerfiles or docker-compose.yml |
| TECH-STANDARDS.md section 14 (CI/CD Pipeline) | Out of Scope | Acknowledged in proposal; recommend adding minimal stub |
| TECH-STANDARDS.md section 15 (Observability) | Partial | structlog configured; prometheus-fastapi-instrumentator missing from dependencies |
| PRD section 8.2 (Directory Structure) | Compliant | Monorepo layout matches specification |
| OpenAPI 3.1 Spec Placeholders | Compliant | Correct structure under specs/ |
| Docker Compose Local Dev | Partial | Functional but missing health checks and dependency ordering |
| Linting Configuration (ruff, ESLint, Prettier) | Compliant | ruff.toml, .eslintrc.cjs, .prettierrc all specified |
