# Troubleshooting Guide

Common issues encountered during development of the GitOps Dashboard, organized by category.

## Python / Backend

### `uv sync` fails with "No `pyproject.toml` found"

**Cause**: Running `uv sync` from the wrong directory. The workspace root has a `pyproject.toml` but each connector also has its own.

**Fix**: Run from the repo root for workspace-level sync, or from a specific connector directory:

```bash
# Workspace root
cd /path/to/gitops-dashboard
uv sync

# Specific connector
cd connectors/argocd-connector
uv sync
```

### `uv sync --frozen` fails with "lockfile not up to date"

**Cause**: `pyproject.toml` dependencies were changed without regenerating `uv.lock`.

**Fix**:

```bash
uv lock
# Then retry
uv sync --frozen
```

### mypy reports errors about missing stubs

**Cause**: Third-party packages may not ship type stubs.

**Fix**: Add the package to `[[tool.mypy.overrides]]` in the connector's `pyproject.toml`:

```toml
[[tool.mypy.overrides]]
module = ["redis.*", "orjson"]
ignore_missing_imports = true
```

### Tests fail with "400 Bad Request" on health endpoints

**Cause**: `TrustedHostMiddleware` rejects the test client's `Host` header.

**Fix**: The test client in `conftest.py` must use `localhost` as the host:

```python
async with AsyncClient(
    transport=transport,
    base_url="http://localhost",
    headers={"Host": "localhost"},
) as ac:
    yield ac
```

### `make test` fails with "Coverage failure: total of X is less than fail-under"

**Cause**: Coverage threshold (90% for connectors, 60% during scaffold) not met.

**Fix during development**: Temporarily lower the threshold in the connector's `pyproject.toml`:

```toml
[tool.pytest.ini_options]
addopts = "--cov=src --cov-report=term-missing --cov-fail-under=60"
```

Raise it back to 90 before merging.

### Ruff reports TCH002/TCH003 errors for Pydantic imports

**Cause**: Ruff's type-checking rules want to move imports behind `TYPE_CHECKING`, but Pydantic needs them at runtime for model validation.

**Fix**: Add a `noqa` comment with the correct rule code:

```python
from pydantic import SecretStr  # noqa: TC002 — required at runtime by Pydantic
```

### structlog "scrub_secrets" not working

**Cause**: `configure_logging()` is defined but never called.

**Fix**: Ensure `configure_logging(connector="<name>")` is called at module import time in `main.py`, before the FastAPI app is created.

## Frontend

### `npm install` fails with "vitest-axe" version not found

**Cause**: `vitest-axe@^1.0.0` doesn't exist. The package uses `^0.1.0`.

**Fix**: In `frontend/package.json`, change:

```json
"vitest-axe": "^0.1.0"
```

### TypeScript errors about "possibly undefined" on array access

**Cause**: `noUncheckedIndexedAccess` is enabled (TECH-STANDARDS §2). Array indexing returns `T | undefined`.

**Fix**: Use non-null assertion (`!`) when you're certain the array is non-empty, or nullish coalescing (`??`):

```typescript
// When array is guaranteed non-empty:
const item = arr[idx]!;

// When a fallback is acceptable:
const item = arr[idx] ?? defaultValue;
```

### TypeScript errors about "Property comes from an index signature"

**Cause**: `noPropertyAccessFromIndexSignature` is enabled. MSW params use an index signature.

**Fix**: Use bracket notation instead of dot notation:

```typescript
// Wrong:
const env = params.env as string;

// Correct:
const env = params["env"] as string;
```

### TypeScript errors about "not assignable with exactOptionalPropertyTypes"

**Cause**: `exactOptionalPropertyTypes` distinguishes between `string | undefined` and optional `string`.

**Fix**: Explicitly include `undefined` in the optional prop type:

```typescript
interface Props {
  readonly previousTag?: string | undefined;  // allows undefined assignment
}
```

### ESLint fails with flat config errors

**Cause**: ESLint 9.x defaults to flat config, but the project uses legacy `.eslintrc.cjs`.

**Fix**: The `lint` script in `package.json` should include `ESLINT_USE_FLAT_CONFIG=false`:

```json
"lint": "ESLINT_USE_FLAT_CONFIG=false eslint src/ --ext .ts,.tsx"
```

### MSW not intercepting requests in the built Docker image

**Cause**: MSW only starts in development mode (`import.meta.env.DEV`). The Docker image is a production build.

**Expected behavior**: The mock dashboard Docker image uses MSW's browser service worker which is baked into the build. If MSW isn't intercepting, check that `public/mockServiceWorker.js` exists in the Docker build context.

**Fix**: Generate the service worker file:

```bash
cd frontend
npx msw init public/ --save
```

### Dashboard shows blank page in Docker

**Cause**: nginx can't find the built assets, or the SPA routing is misconfigured.

**Fix**: Verify the nginx config has the SPA fallback:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

And verify the `COPY --from=builder /app/dist /usr/share/nginx/html` line in the Dockerfile.

## Docker

### Docker build fails with "uv.lock not found"

**Cause**: The connector Dockerfile expects `uv.lock` in the build context, but the workspace uses a single root-level lockfile.

**Fix**: Use `make build` or `make docker-up` — they automatically copy the root `uv.lock` to each connector directory before building. If building manually:

```bash
cp uv.lock connectors/argocd-connector/uv.lock
docker build -t gitops-dashboard/argocd-connector:poc connectors/argocd-connector
```

Or use `make build` which handles this automatically.

### nginx "Permission denied" errors in Docker

**Cause**: The container runs as non-root (UID 1000) but nginx needs writable directories for cache and PID files.

**Fix**: The Dockerfile must create and chown these directories before switching to the non-root user:

```dockerfile
RUN mkdir -p /var/cache/nginx /var/run /var/log/nginx && \
    chown -R frontend:frontend /var/cache/nginx /var/run /var/log/nginx /run && \
    touch /run/nginx.pid && chown frontend:frontend /run/nginx.pid
```

### Docker Compose: Redis healthcheck fails / "dependency failed to start: container is unhealthy"

**Cause**: The Redis healthcheck command can't authenticate. The `$$REDIS_PASSWORD` env var may not be available inside the container.

**Fix**: Use a direct `CMD` healthcheck with the hardcoded local-dev password:

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "-a", "local-dev-only", "ping"]
```

### Docker Compose: Redis "NOAUTH Authentication required"

**Cause**: Redis is configured with `--requirepass` but the connector isn't passing the password.

**Fix**: Ensure `REDIS_PASSWORD` is set in the connector's environment in `docker-compose.yml`. The default is `local-dev-only`. Check `.env.example` for all required variables.

### Docker Compose: "port already in use"

**Cause**: Another process is using port 3000, 8001, 8002, 8003, or 6379.

**Fix**:

```bash
# Find what's using the port
lsof -i :3000

# Kill it or change the port in docker-compose.yml
```

## Git / Pre-commit

### Pre-commit hook fails on first run

**Cause**: Hooks not installed.

**Fix**:

```bash
uv run pre-commit install
uv run pre-commit install --hook-type commit-msg
```

### detect-secrets flags a false positive

**Cause**: A string in the code looks like a secret to the heuristic scanner.

**Fix**: Update the baseline:

```bash
detect-secrets scan --baseline .secrets.baseline
# Review the new entries, then commit the updated baseline
```

## Getting Help

- **Project context**: [docs/PROJECT-GUIDE.md](docs/PROJECT-GUIDE.md)
- **Technical standards**: [docs/TECH-STANDARDS.md](docs/TECH-STANDARDS.md)
- **Report issues**: https://github.com/anthropics/claude-code/issues
