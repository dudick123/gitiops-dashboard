---
reviewer: Senior Security Engineer
proposal: repo-scaffolding
date: 2026-03-23
status: Review Complete
---

# Senior Security Engineer — Review: repo-scaffolding

## Summary

The repo-scaffolding proposal establishes the monorepo skeleton for a platform that handles ArgoCD service account tokens across 3 environments, Azure AD credentials, and Kubernetes ServiceAccount tokens across 6 AKS clusters. While the proposal delivers a functional project structure, it omits or contradicts multiple mandatory security controls defined in TECH-STANDARDS.md v1.5 Section 12. The scaffold is the foundation every subsequent proposal builds on — security gaps introduced here will propagate to every connector and the frontend. Nine findings are documented below, four of which are critical.

## Critical Findings

### Finding SEC-1: .gitignore missing mandatory secret file patterns

- **Artifact**: spec.md, tasks.md (Task 1.1)
- **Location**: Root `.gitignore`
- **Issue**: The spec requires exclusions for Python bytecode, venvs, node_modules, build outputs, IDE files, and `.env`. However, TECH-STANDARDS.md Section 12.2 mandates additional patterns that are absent from the proposal: `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials.json`, and `**/secrets/`. The spec mentions `.env` but not the wildcard `.env.*` variant (e.g., `.env.local`, `.env.production`), and none of the certificate or credential file patterns are specified.
- **Impact**: A developer could accidentally commit TLS private keys, PKCS12 certificate bundles, or service credential files. Given the system handles ArgoCD tokens and Azure AD credentials, a single accidental commit of a `.pem` or `credentials.json` file exposes production secrets in git history permanently (even after removal, the object remains in packfiles).
- **Recommendation**: Add all Section 12.2 patterns verbatim to the `.gitignore` specification in spec.md and to Task 1.1. The required patterns are: `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `credentials.json`, and `**/secrets/`.

### Finding SEC-2: Dockerfiles use mutable tags instead of digest-pinned base images

- **Artifact**: spec.md, tasks.md (Tasks 2.5, 3.5, 4.5), design.md
- **Location**: All connector Dockerfiles and frontend Dockerfile
- **Issue**: The spec states "Dockerfiles use python:3.14-slim base" and tasks reference `python:3.14-slim` without digest pinning. TECH-STANDARDS.md Section 12.6 explicitly mandates digest-pinned images (e.g., `python:3.14-slim@sha256:...`) and marks mutable tags as "Incorrect". The frontend Dockerfile (Task 5.12, multi-stage Node plus nginx) also has no digest pin requirement.
- **Impact**: Mutable tags allow supply chain attacks. A compromised or re-tagged base image would silently enter builds. This is the most common container supply chain vector — an attacker who compromises the Docker Hub `python` image or performs a tag-squatting attack gains code execution inside every connector container. The system handles credentials to 6 Kubernetes clusters and 3 ArgoCD instances.
- **Recommendation**: Require digest-pinned base images in the spec and all Dockerfile tasks. Add a comment in each Dockerfile with the expected tag for human readability alongside the digest. Include the frontend Node and nginx base images. Add a task to run Hadolint (Section 12.7) validation of Dockerfiles as part of the Makefile `lint` target to catch regressions.

### Finding SEC-3: Redis configured without authentication

- **Artifact**: spec.md, tasks.md (Task 7.3), design.md (Decision 5)
- **Location**: `docker-compose.yml` Redis service, connector `cache.py` files
- **Issue**: The spec requires Redis with `--save ""` (no persistence) but makes no mention of authentication. The design explicitly says "Redis with --save and no volume" with no auth discussion. TECH-STANDARDS.md Section 12.5 mandates: "Redis MUST require a password." The `cache.py` skeleton (Tasks 2.4, 3.4, 4.4) describes "connection from env var" but does not specify that REDIS_PASSWORD must be included.
- **Impact**: Even in local development, running Redis without authentication establishes a pattern that developers will replicate. The cache.py skeletons become templates for production code. If the connection string pattern does not include authentication from the start, it is likely to be omitted when deploying to AKS, where any pod in the namespace (or cluster, absent NetworkPolicy) can connect to Redis and read cached ArgoCD application state, deployment metadata, and Prometheus metrics.
- **Recommendation**: Add `--requirepass ${REDIS_PASSWORD}` to the Redis command in docker-compose.yml. Set `REDIS_PASSWORD` as a default env var in docker-compose (e.g., `REDIS_PASSWORD=local-dev-only`). Update cache.py skeletons to read REDIS_PASSWORD from environment and construct the authenticated connection URL. Add a comment in cache.py referencing Section 12.5 ACL requirements for production.

### Finding SEC-4: No detect-secrets or .secrets.baseline in scaffold

- **Artifact**: proposal.md, tasks.md (all tasks)
- **Location**: Repository root (missing files)
- **Issue**: The proposal creates no `.secrets.baseline` file and no `detect-secrets` configuration. TECH-STANDARDS.md Section 12.2 mandates: "`.secrets.baseline` is committed to the repository. Generated via `detect-secrets scan > .secrets.baseline` and reviewed before commit." Section 6 lists `detect-secrets` as a required pre-commit hook. Without the baseline file, the detect-secrets tool cannot run.
- **Impact**: Without detect-secrets in the scaffold, there is no automated mechanism to prevent credential commits from day one. Every subsequent proposal that adds code (connectors with ArgoCD tokens, Azure AD config, Kubernetes service account references) will lack this safety net until someone retroactively adds it. By then, secrets may already be in git history.
- **Recommendation**: Add a task to generate `.secrets.baseline` via `detect-secrets scan` and commit it to the repository root. This should be one of the earliest tasks in the scaffold.

## High Findings

### Finding SEC-5: No .pre-commit-config.yaml in scaffold

- **Artifact**: proposal.md, tasks.md (all tasks)
- **Location**: Repository root (missing file)
- **Issue**: TECH-STANDARDS.md Section 6 defines `.pre-commit-config.yaml` as a mandatory repository file with 9 specific hooks: ruff check, ruff format --check, mypy, prettier --check, eslint, check-yaml, check-json, detect-secrets, and no-commit-to-branch. The proposal does not include creating this file in any task. The design non-goals state "No authentication, secret management" but pre-commit hooks are a development tooling concern, not an authentication concern, and belong in the scaffold.
- **Impact**: Without pre-commit hooks, developers can commit secrets, improperly formatted code, invalid YAML/JSON, and push directly to main. The hooks are the first line of defense and are especially important for a team described as having "minimal React experience" — guardrails must be in place before code is written.
- **Recommendation**: Add a task to create `.pre-commit-config.yaml` with all 9 hooks from Section 6. Add `pre-commit` to dev dependencies. Include setup instructions in the Makefile (`make setup-hooks` target).

### Finding SEC-6: Ruff config missing S (bandit) and 14 other required rule sets

- **Artifact**: spec.md, tasks.md (Task 1.2)
- **Location**: `ruff.toml`
- **Issue**: The spec and Task 1.2 configure ruff with rule sets E, F, I, and UP (4 rule sets). TECH-STANDARDS.md Section 1 mandates 19 rule sets: E, F, W, I, UP, S, B, A, C4, PT, SIM, TCH, DTZ, PIE, RSE, RET, FBT, ASYNC, RUF. The most security-critical omission is the `S` rule set (flake8-bandit), which detects hardcoded passwords, unsafe deserialization, insecure hash functions, and other code-level security issues. Also missing: B (bugbear), A (builtins shadowing), PT (pytest style), and all others.
- **Impact**: Without the S rule set, bandit-class security issues in connector code (e.g., `verify=False` on httpx calls, hardcoded tokens during development) will not be flagged at lint time. Section 12.7 lists "Ruff S rules + Semgrep" as a CI security check — this cannot work if S rules are not configured.
- **Recommendation**: Update the ruff configuration to include all 19 rule sets from Section 1. At minimum, S, B, A, and ASYNC must be added. Additionally, the tech standard specifies configuration belongs in `pyproject.toml` under `[tool.ruff]`, not in a separate `ruff.toml` file — the proposal should be updated to match.

### Finding SEC-7: ESLint config missing eslint-plugin-security

- **Artifact**: tasks.md (Task 5.6)
- **Location**: `frontend/.eslintrc.cjs`
- **Issue**: Task 5.6 creates an ESLint config with "TypeScript parser, React rules, and Prettier integration" but does not mention `eslint-plugin-security`. TECH-STANDARDS.md Section 12.7 mandates this plugin for frontend SAST, specifically to catch DOM XSS, unsafe dynamic code execution, and unsafe innerHTML usage.
- **Impact**: Without the security plugin, XSS vulnerabilities and unsafe DOM manipulation in React components will not be caught at lint time. Given the team has "no prior React experience" (Section 2 preamble), the risk of introducing unsafe patterns without understanding the implications is elevated.
- **Recommendation**: Add `eslint-plugin-security` to the frontend dev dependencies in Task 5.1 and configure it in the ESLint config in Task 5.6. The plugin recommended ruleset should be extended.

## Medium Findings

### Finding SEC-8: Docker Compose connector services may expose credentials via environment variables

- **Artifact**: design.md (Decision 5), tasks.md (Task 7.3)
- **Location**: `docker-compose.yml`
- **Issue**: The design states "Connectors use environment variables for configuration (matching the production ESO-injected pattern)." The docker-compose.yml will define environment variables for connector configuration. If example/placeholder values for ARGOCD_TOKEN, AZURE_CLIENT_SECRET, or similar credential environment variables are included inline in docker-compose.yml, these become committed credential patterns. The spec does not mention using a `.env` file (which is gitignored) or `docker-compose.override.yml` for secrets.
- **Impact**: Developers may add real or realistic-looking credential values to docker-compose.yml during local development and commit them. Even placeholder values like `ARGOCD_TOKEN=changeme` establish a pattern where credentials appear in version-controlled files.
- **Recommendation**: The docker-compose.yml should reference environment variables without defaults for any credential-type config (e.g., `ARGOCD_TOKEN=${ARGOCD_TOKEN}`), and include a `.env.example` file (committed) showing the required variables with empty/dummy values alongside documentation that developers should create a local `.env` file (gitignored). Add this pattern to the spec.

### Finding SEC-9: Dockerfile tasks omit non-root USER directive

- **Artifact**: spec.md, tasks.md (Tasks 2.5, 3.5, 4.5, 5.12)
- **Location**: All Dockerfiles
- **Issue**: The spec states Dockerfiles should "use a Python 3.14 slim base image, install only production dependencies, and expose the service port" but does not mention running as a non-root user. TECH-STANDARDS.md Section 12.6 mandates `runAsUser: 1000` and `runAsNonRoot: true`. While the Kubernetes securityContext enforces this at runtime, the Dockerfile itself should create and switch to a non-root user as defense in depth. If containers are ever run outside Kubernetes (e.g., `docker compose up` for local dev, which is the explicit use case for this scaffold), there is no securityContext enforcement.
- **Impact**: Local development via `docker compose up` runs all containers as root. A vulnerability in any connector (e.g., SSRF leading to file read) has elevated impact when the process runs as root inside the container.
- **Recommendation**: Add USER 1000 directive to all Dockerfile tasks. Create the user in the Dockerfile with `RUN addgroup --gid 1000 appgroup && adduser --uid 1000 --gid 1000 --disabled-password appuser`. This aligns with Section 12.6 and ensures non-root execution in both local dev and production.

## Recommendations

### Recommendation SEC-R1: Add a dedicated security scaffold task group

The current task list has no security-focused task group. Add a "Section 0: Security Baseline" task group that runs before all other tasks, containing:

- 0.1: Create `.pre-commit-config.yaml` with all Section 6 hooks
- 0.2: Generate `.secrets.baseline`
- 0.3: Add Section 12.2 secret patterns to `.gitignore`
- 0.4: Add `detect-secrets` and `pre-commit` to dev dependencies

This establishes the security guardrails before any code or configuration files are created.

### Recommendation SEC-R2: Align ruff configuration location with tech standard

TECH-STANDARDS.md Section 1 states: "Config location: All Ruff configuration lives in `pyproject.toml` under `[tool.ruff]`. No `ruff.toml` or `.ruff.toml` files." The proposal creates a standalone `ruff.toml`. This should be changed to place configuration in a root `pyproject.toml` (or in each connector's `pyproject.toml`), matching the standard.

### Recommendation SEC-R3: Add Hadolint to Makefile lint target

TECH-STANDARDS.md Section 12.7 mandates Hadolint for Dockerfile linting. Since the scaffold creates Dockerfiles, the Makefile `lint` target (Task 1.3) should include a Hadolint step. This catches issues like running as root, unpinned base images, and piped installs from the start.

### Recommendation SEC-R4: Include .env.example pattern for safe credential handling

Create a `.env.example` file listing all expected environment variables with empty or clearly-fake values. Document in the Makefile or a comment that developers should `cp .env.example .env` and fill in local values. This prevents credentials from appearing in docker-compose.yml or being committed to git.

### Recommendation SEC-R5: Add pip install --no-cache-dir to Dockerfiles

Dockerfile tasks should include `--no-cache-dir` on pip install commands to avoid caching downloaded packages in the image layer, reducing image size and eliminating a potential information disclosure vector (cached package metadata).

### Recommendation SEC-R6: Consider uv instead of pip for dependency installation

TECH-STANDARDS.md Section 6 references `uv` as the package manager (`uv add --group dev pre-commit`), and Section 12.7 references `uv audit` for dependency auditing. The proposal uses `pip install -e .` for development. Aligning on `uv` from the scaffold ensures consistent tooling and enables `uv audit` without additional setup.

## Observations

1. **Design non-goal creates a blind spot**: The design lists "No authentication, secret management, or ESO configuration" as a non-goal. This is reasonable for runtime secret injection, but it has been interpreted broadly enough to exclude security tooling (detect-secrets, pre-commit hooks, bandit rules) that is part of development infrastructure, not runtime secret management. The distinction should be clarified.

2. **Structlog logging_config.py (Task 8.1) omits the scrubbing processor**: Section 12.4 mandates a structlog processor that scrubs sensitive patterns from logs. The scaffold creates a logging configuration template but the task description mentions only "JSON output, bound processors for service name and environment" — not the secret scrubbing processor. While full implementation may come later, the scaffold template should at least include a placeholder or TODO for the scrubbing processor to prevent it from being forgotten.

3. **No Renovate/Dependabot configuration in scaffold**: Section 12.7 mandates automated dependency update tooling. While this may be out of scope for the repo scaffold (it could be considered CI/CD configuration), including a `renovate.json` or `.github/dependabot.yml` placeholder would signal intent and prevent it from being forgotten.

4. **Frontend Dockerfile multi-stage build has no explicit security guidance**: Task 5.12 describes "Node for build, nginx for serve" but does not mention the nginx security headers required by Section 12.12. While the nginx configuration itself may come in a later proposal, the Dockerfile task should note that the nginx stage must include a custom config with security headers.

5. **Line length inconsistency**: The spec says line-length 100 (Task 1.2) but TECH-STANDARDS.md Section 1 says 99. Minor, but inconsistencies in the scaffold propagate.

## Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| 12.1 CORS Policy | Not Applicable | Runtime concern, correctly out of scope for scaffold |
| 12.2 Secret Detection | Non-Compliant | No detect-secrets, no .secrets.baseline, .gitignore missing 6 required patterns (SEC-1, SEC-4) |
| 12.3 Transport Security | Not Applicable | Runtime concern, out of scope for scaffold |
| 12.4 Credential Hygiene | Partial | structlog template created but missing scrub processor; no SecretStr pattern in cache.py skeleton |
| 12.5 Redis Security | Non-Compliant | No authentication configured in docker-compose or cache.py (SEC-3) |
| 12.6 Container Hardening | Non-Compliant | Mutable tags (SEC-2), no non-root USER (SEC-9), no digest pinning |
| 12.7 CI Security Pipeline | Not Applicable | CI pipeline out of scope, but scaffold should enable it (Hadolint in Makefile) |
| 12.8 Security Test Patterns | Not Applicable | Test implementation comes in connector proposals |
| 12.9 SBOM Generation | Not Applicable | Build-time concern for CI pipeline |
| 12.10 NetworkPolicy | Not Applicable | Deploy repo concern |
| 12.11 Rate Limiting | Not Applicable | Runtime concern |
| 12.12 Frontend Security Headers | Partial | Dockerfile task exists but no nginx security header guidance |
| 12.13 Inter-Service Auth | Not Applicable | Runtime concern |
| 12.14 Security Review Checklist | Not Applicable | Process concern |
| 6 Pre-commit Hooks | Non-Compliant | No .pre-commit-config.yaml in scaffold (SEC-5) |
| 1 Ruff Linting (S rules) | Non-Compliant | Only 4 of 19 required rule sets; S (bandit) missing (SEC-6) |
| 1 Ruff Config Location | Non-Compliant | Proposal uses ruff.toml; standard requires pyproject.toml under [tool.ruff] |
