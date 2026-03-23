# Post-Implementation Review: Repo Scaffolding

| Field          | Value                                              |
| -------------- | -------------------------------------------------- |
| **Reviewer**   | Senior Kubernetes & ArgoCD Engineer                |
| **Date**       | 2026-03-23                                         |
| **Scope**      | Connector Dockerfiles, Frontend Dockerfile, docker-compose.yml, health endpoints, alignment with TECH-STANDARDS sections 5, 12, 13 |
| **Verdict**    | **Conditional pass** -- local dev scaffolding is functional, but several findings must be resolved before any image leaves local dev |

---

## Findings Summary

| ID       | Severity    | Category               | Status         |
| -------- | ----------- | ---------------------- | -------------- |
| K8S-001  | **Critical**  | Supply chain           | Open           |
| K8S-002  | **Critical**  | Supply chain           | Open           |
| K8S-003  | **Critical**  | Build reproducibility  | Open           |
| K8S-004  | High        | Build reproducibility  | Open           |
| K8S-005  | Medium      | Container health       | Open           |
| K8S-006  | Medium      | Graceful shutdown      | Open           |
| K8S-007  | Medium      | Container security     | Open           |
| K8S-008  | Medium      | Frontend build         | Open           |
| K8S-009  | Low         | Docker Compose health  | Open           |
| K8S-010  | Medium      | Kustomize / deploy     | Open (expected)|
| K8S-011  | Low         | Frontend image         | Open           |
| K8S-012  | Medium      | Runtime filesystem     | Open           |
| K8S-013  | Medium      | Service account token  | Open (expected)|

---

## Detailed Findings

### K8S-001: Base images use mutable tags, not digest-pinned (Critical)

**Standard**: TECH-STANDARDS section 12.6 -- "Use digest-pinned base images, not mutable tags."

**Observed**: All three connector Dockerfiles and the frontend Dockerfile use mutable tags with only a TODO comment acknowledging the gap:

```
connectors/argocd-connector/Dockerfile:3   # TODO: Replace with digest-pinned image (python:3.14-slim@sha256:...)
connectors/argocd-connector/Dockerfile:4   FROM python:3.14-slim AS builder
connectors/argocd-connector/Dockerfile:16  FROM python:3.14-slim
frontend/Dockerfile:4                      FROM node:22-slim AS builder
frontend/Dockerfile:17                     FROM nginx:alpine
```

Six distinct `FROM` lines reference four unique mutable tags (`python:3.14-slim` x4, `node:22-slim` x1, `nginx:alpine` x1). A registry-side tag mutation (intentional republish or supply-chain compromise) would silently change the image contents on the next build.

**Impact**: Builds are non-reproducible. A compromised or updated base image could introduce vulnerabilities or break behavior between identical source-tree builds. Hadolint (section 12.7 CI pipeline) will flag this as DL3006.

**Remediation**:
1. Pin all `FROM` lines to their current digest immediately:
   ```dockerfile
   FROM python:3.14-slim@sha256:<current_digest> AS builder
   ```
2. Configure Renovate/Dependabot to raise PRs for base image digest updates (section 12.7 already mandates this).
3. Use the same digest for both builder and runtime stages of each connector Dockerfile -- they currently reference the same mutable tag but could diverge after a race between `docker build` layer pulls.

---

### K8S-002: uv copy-from uses :latest tag (Critical)

**Standard**: TECH-STANDARDS section 12.6 -- digest-pinned images; section 3 -- uv is the sole package manager.

**Observed**: All three connector Dockerfiles:
```dockerfile
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
```

The `:latest` tag on `ghcr.io/astral-sh/uv` is mutable. This is a COPY from an external, non-digest-pinned image in the builder stage. A new uv release (or a compromised tag) would silently change the binary copied into the builder.

**Impact**: Same supply-chain risk as K8S-001, compounded by the fact that uv is the tool responsible for resolving and installing all Python dependencies. A compromised uv binary could inject arbitrary packages.

**Remediation**:
```dockerfile
COPY --from=ghcr.io/astral-sh/uv:0.6.x@sha256:<digest> /uv /usr/local/bin/uv
```
Pin to a specific version tag AND digest. Include in Renovate's base-image update automation.

---

### K8S-003: No uv.lock file exists -- `uv sync --frozen` will fail (Critical)

**Standard**: TECH-STANDARDS section 3 -- "uv.lock is committed to the repository. All CI and container builds use uv sync --frozen for reproducible installs."

**Observed**: No `uv.lock` file exists in any connector directory. The Dockerfiles run:
```dockerfile
RUN uv sync --frozen --no-dev
```

The `--frozen` flag tells uv to use an existing lockfile without modification. If no lockfile exists, this command fails with an error. The Dockerfiles also do not COPY a `uv.lock` file -- only `pyproject.toml` is copied.

**Impact**: Every connector Docker build will fail at the `RUN uv sync --frozen --no-dev` step. This scaffolding has never been successfully built.

**Remediation**:
1. Generate lockfiles: run `uv lock` in each connector directory.
2. Commit the resulting `uv.lock` files.
3. Update the Dockerfiles to copy the lockfile:
   ```dockerfile
   COPY pyproject.toml uv.lock ./
   RUN uv sync --frozen --no-dev
   ```

---

### K8S-004: Connector Dockerfiles do not COPY uv.lock (High)

**Standard**: TECH-STANDARDS section 5 -- "Builder stage runs uv sync --frozen --no-dev."

**Observed**: Even if uv.lock files were generated (fixing K8S-003), the Dockerfiles only copy `pyproject.toml`:
```dockerfile
COPY pyproject.toml ./
RUN uv sync --frozen --no-dev
```

The `COPY` instruction does not include `uv.lock`. The lockfile would not be present in the build context at the point `uv sync --frozen` runs.

**Impact**: Directly blocked by K8S-003. Even after lockfiles exist, this COPY omission would still cause build failure.

**Remediation**: Change to:
```dockerfile
COPY pyproject.toml uv.lock ./
```

This also improves Docker layer caching -- the dependency-install layer is invalidated only when `pyproject.toml` or `uv.lock` changes.

---

### K8S-005: HEALTHCHECK uses Python urllib -- suboptimal for container probes (Medium)

**Standard**: TECH-STANDARDS section 13.4 -- Kubernetes probes use httpGet; section 12.6 -- minimal final image.

**Observed**: All connector Dockerfiles:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/healthz')"]
```

This spawns a full Python interpreter (40-80ms cold start on slim images, more under memory pressure) every 30 seconds per container. The `python:3.14-slim` final image does not include `curl` or `wget`.

**Impact**:
- In Docker Compose (local dev), this is the only health probe mechanism, so it serves a purpose.
- In Kubernetes, the Docker HEALTHCHECK is ignored entirely -- K8s uses its own probe configuration (section 13.4). The HEALTHCHECK directive only adds unnecessary overhead to local builds and could mask issues if developers assume it equates to K8s probes.
- The 3-second timeout may be tight if the Python interpreter is slow to start under constrained cgroup limits.

**Remediation**:
- Option A (preferred): Install `curl` in the final image and use `CMD ["curl", "-f", "http://localhost:8080/healthz"]`. The `curl` binary is ~200KB and starts in milliseconds.
- Option B: Accept the Python-based check for local dev only. Add a comment clarifying that Kubernetes probes (section 13.4) replace this in production.
- In either case, add `--start-period` to the HEALTHCHECK to match section 13.4's startup probe concept:
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
      CMD ["curl", "-f", "http://localhost:8080/healthz"]
  ```

---

### K8S-006: No --timeout-graceful-shutdown on uvicorn CMD (Medium)

**Standard**: TECH-STANDARDS section 13.5 -- "In-flight requests complete (up to Uvicorn's --timeout-graceful-shutdown, default 10s)."

**Observed**: All connector Dockerfiles:
```dockerfile
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

The `--timeout-graceful-shutdown` flag is not set. Uvicorn's default is to wait indefinitely for in-flight connections, which can cause the pod to be forcibly killed at `terminationGracePeriodSeconds` (30s, per section 13.5) with connections still open.

**Impact**: During rolling deployments or node drains, if a long-running request (e.g., a slow ArgoCD API fan-out for 850+ apps) is in-flight, uvicorn will not time it out. The pod will be SIGKILL'd at the 30s boundary, potentially returning incomplete responses to the frontend.

**Remediation**:
```dockerfile
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080", "--timeout-graceful-shutdown", "15"]
```

The 15s value accounts for the 5s preStop sleep (section 13.5), leaving 15s for request draining within the 30s termination window, plus 10s margin.

Also consider adding `--limit-concurrency 100` per section 12.11 rate limiting standards.

---

### K8S-007: Final stage images retain shell and package managers (Medium)

**Standard**: TECH-STANDARDS section 12.6 -- "No compilers, build tools, package managers, or shells (except /bin/sh required by the container runtime) in the final image."

**Observed**: The connector final stage (`python:3.14-slim`) retains `pip`, `apt`, and a full shell environment. The Dockerfile does not remove these. The frontend final stage (`nginx:alpine`) retains `apk`.

**Impact**: If a container escape occurs, an attacker has access to package installation tools that can be used to download additional tooling. This is a defense-in-depth concern -- the non-root user and dropped capabilities (once K8s manifests exist) mitigate but do not eliminate this.

**Remediation**: Low priority for scaffolding phase. When preparing for production:
- For connectors: Remove `pip` and `apt` from the final stage: `RUN pip uninstall pip setuptools -y && apt-get purge --auto-remove -y && rm -rf /var/lib/apt/lists/*`
- For frontend: Consider `nginx:alpine` with `apk --purge del apk-tools` or a distroless nginx image.
- Long-term: Evaluate Google distroless or Chainguard images as base for the final stages.

---

### K8S-008: Frontend Dockerfile wildcards pnpm-lock.yaml (Medium)

**Standard**: TECH-STANDARDS section 3 -- "pnpm-lock.yaml is committed. CI uses pnpm install --frozen-lockfile for reproducible installs."

**Observed**:
```dockerfile
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
```

The glob `pnpm-lock.yaml*` means the COPY succeeds even if no lockfile exists. But `pnpm install --frozen-lockfile` will fail without a lockfile, making this a deferred failure rather than a clear build error. No `pnpm-lock.yaml` file exists in the repo.

Additionally, the TECH-STANDARDS section 3 notes the team may use npm or pnpm. The Dockerfile commits to pnpm (via `npm install -g pnpm` and `pnpm install`) but section 3 says "npm (or pnpm if adopted)." This decision should be explicitly documented.

**Impact**: Frontend Docker build will fail at `pnpm install --frozen-lockfile` due to missing lockfile. Similar to K8S-003 -- the scaffolding has not been validated by running `docker build`.

**Remediation**:
1. Initialize the frontend project: `cd frontend && pnpm init && pnpm install` to generate `pnpm-lock.yaml`.
2. Commit `pnpm-lock.yaml`.
3. Change the COPY line to be explicit (drop the wildcard):
   ```dockerfile
   COPY package.json pnpm-lock.yaml ./
   ```
   A missing lockfile should cause an immediate COPY failure, not a silent skip.

---

### K8S-009: Docker Compose health checks duplicate the urllib pattern (Low)

**Standard**: Consistency with Dockerfile HEALTHCHECK and TECH-STANDARDS section 4 health contract.

**Observed**: docker-compose.yml uses the same Python urllib pattern for all three connectors:
```yaml
healthcheck:
  test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/healthz')"]
```

This is functionally correct for local dev, but:
- The `start_period: 10s` is good and aligns with section 13.4's startup probe concept.
- The health checks do not include a `start_interval` (available in Compose spec v2.26+), which would allow faster initial checks.
- The tests call `/healthz` (liveness), not `/readyz` (readiness). For `depends_on: service_healthy`, readiness would be more appropriate -- it confirms upstream connectivity, not just process liveness.

**Impact**: In local dev, a connector can report healthy before Redis is actually reachable from its perspective. The `depends_on: redis: condition: service_healthy` ensures Redis itself is up, but the connector's own Redis pool initialization may not be complete when `/healthz` returns ok (since `/healthz` deliberately skips dependency checks per section 4).

**Remediation**: Change Docker Compose health checks to use `/readyz`:
```yaml
healthcheck:
  test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/readyz')"]
```

---

### K8S-010: No Kustomize manifests, K8s deployments, or deploy-repo structure (Medium)

**Standard**: TECH-STANDARDS section 13.12 -- Kustomize conventions; section 13.1-13.8 -- deployment specs with securityContext, probes, resources, PDB, topology spread, rolling update parameters.

**Observed**: No `kustomization.yaml`, no K8s Deployment/Service/HPA/PDB manifests exist in this repo. No `gitops-dashboard-deploy` repo structure is scaffolded.

**Impact**: The full K8s deployment surface area specified in sections 13.1 through 13.15 is unimplemented. This includes:
- securityContext (section 12.6): readOnlyRootFilesystem, drop ALL, seccompProfile, automountServiceAccountToken: false
- Probe configuration (section 13.4): startupProbe, livenessProbe, readinessProbe with specific timing
- Graceful shutdown (section 13.5): terminationGracePeriodSeconds: 30, preStop sleep 5
- Resource requests/limits (section 13.6)
- PodDisruptionBudget (section 13.7)
- Rolling update strategy (section 13.8): maxSurge: 1, maxUnavailable: 0, topologySpreadConstraints
- ExternalSecret resources (section 13.9)
- AppProject and Application (sections 13.13-13.14)
- Ingress with ingressClassName (section 13.15)

**Note**: This is likely expected at the scaffolding phase. The deploy repo is a separate repository per the standards. However, no tracking issue or TODO references the deploy-repo bootstrapping.

**Remediation**: Create a tracking issue for deploy-repo scaffolding. At minimum, a stub `gitops-dashboard-deploy/` directory with a base kustomization.yaml and one overlay would validate the Kustomize conventions early.

---

### K8S-011: Frontend nginx runs as non-root but may fail on default nginx paths (Low)

**Standard**: TECH-STANDARDS section 12.6 -- non-root UID 1000, readOnlyRootFilesystem (future K8s deployment).

**Observed**:
```dockerfile
USER frontend
CMD ["nginx", "-g", "daemon off;"]
```

The nginx process runs as UID 1000. However, nginx by default writes to `/var/cache/nginx/`, `/var/run/nginx.pid`, and `/var/log/nginx/`. These paths are owned by root in the `nginx:alpine` image. Nginx will fail to start if it cannot write its PID file or cache.

**Impact**: The frontend container may fail at startup. If it works today, it is because the `nginx:alpine` image's default config uses `listen 80` (which requires root) but the inline config overrides to `listen 8080`. However, PID file and cache writes will still fail unless the directories are writable by UID 1000.

**Remediation**:
```dockerfile
RUN mkdir -p /var/cache/nginx /var/run && \
    chown -R 1000:1000 /var/cache/nginx /var/run /var/log/nginx
```

Add this before the `USER frontend` directive. When readOnlyRootFilesystem is enabled in K8s (section 12.6), these paths will need emptyDir volume mounts.

---

### K8S-012: No emptyDir planning for readOnlyRootFilesystem (Medium)

**Standard**: TECH-STANDARDS section 12.6 -- "readOnlyRootFilesystem: true. Connectors write to /tmp only. Mount an emptyDir at /tmp."

**Observed**: The Dockerfiles do not create or prepare writable paths beyond the defaults. When deployed to Kubernetes with `readOnlyRootFilesystem: true`:

- **Connectors**: uvicorn/Python may need writable `/tmp` for temporary files. The Pydantic settings loader, structlog, and Python's `__pycache__` (though .pyc is skipped in slim images by default) may require it.
- **Frontend (nginx)**: Requires writable `/var/cache/nginx`, `/var/run` (PID file), and `/var/log/nginx` (see K8S-011).

**Impact**: Containers will crash with read-only filesystem errors when the K8s securityContext is applied.

**Remediation**: No Dockerfile changes needed -- this is handled at the K8s manifest level via emptyDir volume mounts. Document the required mounts in the deploy-repo scaffolding task (K8S-010):

| Component | emptyDir mounts needed |
| --------- | --------------------- |
| Connectors | `/tmp` |
| Frontend (nginx) | `/tmp`, `/var/cache/nginx`, `/var/run`, `/var/log/nginx` |

---

### K8S-013: automountServiceAccountToken not addressed (Medium)

**Standard**: TECH-STANDARDS section 12.6 -- "All pods that do not need the Kubernetes API MUST set automountServiceAccountToken: false. Only the network-connector requires a mounted token."

**Observed**: No Kubernetes manifests exist (see K8S-010), so this setting is unimplemented. The health endpoint implementations (`/healthz`, `/readyz`) do not reference Kubernetes API access, confirming that argocd-connector, prometheus-connector, and the frontend do not need the service account token.

**Impact**: Without `automountServiceAccountToken: false`, every pod receives a Kubernetes API token by default. If a connector is compromised, the attacker gains a credential to the Kubernetes API -- unnecessary for 4 out of 5 workloads.

**Remediation**: Track as part of K8S-010. When deploy-repo manifests are created, explicitly set:
```yaml
spec:
  template:
    spec:
      automountServiceAccountToken: false  # argocd-connector, prometheus-connector, frontend, redis
```

And for network-connector only:
```yaml
spec:
  template:
    spec:
      automountServiceAccountToken: true
      serviceAccountName: gitops-dashboard-netpol-reader
```

---

## Positive Observations

The scaffolding gets several things right:

1. **Multi-stage builds**: All Dockerfiles use multi-stage builds correctly. Builder dependencies do not leak into the final image.
2. **Non-root users**: All images create and switch to UID/GID 1000, matching section 12.6.
3. **Port 8080**: All containers use an unprivileged port, eliminating the need for NET_BIND_SERVICE capability.
4. **Health endpoint structure**: The `/healthz` and `/readyz` endpoints return the correct JSON schema per section 4, including connector name, environment, region, and per-dependency check status.
5. **Lifespan pattern**: FastAPI lifespan is used correctly (not deprecated `on_event`), per section 4.
6. **Docker Compose topology**: Correct use of `depends_on: condition: service_healthy` for Redis dependency ordering. Environment variable structure matches section 4 naming conventions.
7. **Redis no-persistence**: `--save "" --appendonly no` matches the TECH-STANDARDS section 4 Redis conventions.
8. **Security headers**: Frontend nginx config includes the full CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and Permissions-Policy headers per section 12.12.
9. **.dockerignore files**: All components have .dockerignore files excluding tests, caches, and IDE files from the build context.
10. **.env.example**: Provides a template without real credentials, with a clear warning about .gitignore.

---

## Priority Remediation Order

| Priority | Findings    | Rationale |
| -------- | ----------- | --------- |
| **P0 -- Builds are broken** | K8S-003, K8S-004, K8S-008 | No Docker image can be built. Zero functionality until resolved. |
| **P1 -- Supply chain** | K8S-001, K8S-002 | Mutable tags are a security and reproducibility risk. Must be resolved before any image is pushed to ACR. |
| **P2 -- Runtime correctness** | K8S-006, K8S-011, K8S-012 | Containers may fail or misbehave at runtime. Resolve before integration testing. |
| **P3 -- Hardening** | K8S-005, K8S-007, K8S-009, K8S-013 | Defense-in-depth improvements. Resolve before production deployment. |
| **P4 -- Deploy repo** | K8S-010 | Separate workstream. Track and schedule. |
