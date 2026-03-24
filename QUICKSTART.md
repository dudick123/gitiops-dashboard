# Quick Start Guide

Get the GitOps Dashboard running locally in under 5 minutes.

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Python | 3.14+ | `python3 --version` |
| uv | 0.6+ | `uv --version` |
| Node.js | 22+ | `node --version` |
| npm | 10+ | `npm --version` |
| Docker | 24+ | `docker --version` |

## Option 1: Mock Dashboard (No Backend)

The fastest way to see the dashboard — runs the React frontend with 882 mock applications via MSW. No connectors, no Redis, no backend.

```bash
# Build the mock frontend image
docker build -t gitops-dashboard/frontend:mock frontend/

# Run it
docker run -p 3000:8080 gitops-dashboard/frontend:mock
```

Open http://localhost:3000 in your browser. You'll see:

- **App Status** — 882 applications across DEV/STAGE/PROD x East/West with health/sync badges
- **Image Promotion** — tag progression through the 6-step promotion pipeline
- **Metrics** — CPU/memory sparklines, quota bars, OOM events
- **Network Status** — NetworkPolicy inventory, Cilium drop counts, denied connections

Use the **Project Selector** dropdown to switch between "All Projects" (platform view) and individual projects (workload-level detail). The STAGE-West environment shows degraded state (simulated 503) to demonstrate graceful degradation.

## Option 2: Full Local Stack (Docker Compose)

Runs all connectors + frontend + Redis. Connectors serve mock data on their health endpoints.

```bash
# Copy environment template
cp .env.example .env

# Start everything
make docker-up
```

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Dashboard UI |
| ArgoCD Connector | http://localhost:8001/healthz | Health check |
| ArgoCD Connector | http://localhost:8001/apps | Mock application data |
| Prometheus Connector | http://localhost:8002/healthz | Health check |
| Network Connector | http://localhost:8003/healthz | Health check |
| Redis | localhost:6379 | Cache (no persistence) |

Stop everything:

```bash
make docker-down
```

## Option 3: Local Development (No Docker)

For active development with hot-reload.

### Backend (argocd-connector)

```bash
# Install dependencies
cd connectors/argocd-connector
uv sync

# Run the connector
uv run uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload

# Verify
curl http://localhost:8001/healthz
curl http://localhost:8001/apps
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000. The Vite dev server proxies API calls to local connectors (ports 8001-8003). MSW intercepts unproxied calls with mock data.

## Quality Gate

Before committing any changes, run the full quality gate:

```bash
make check-all
```

This runs:
- `ruff check` (19 lint rule sets) on all Python connectors
- `mypy --strict` on all Python connectors
- `pytest` with coverage on all Python connectors
- ESLint (6 plugins) on frontend
- TypeScript strict check on frontend
- Vitest on frontend

All checks must pass before merging.

## Common Next Steps

| Task | Command |
|------|---------|
| Run Python linter | `make lint` |
| Run Python type checker | `make typecheck` |
| Run Python tests | `make test` |
| Run frontend linter | `make lint-frontend` |
| Run frontend tests | `make test-frontend` |
| Build all Docker images | `make build` |
| Format Python code | `make format` |
| Format frontend code | `make format-frontend` |

## Project Context

For architecture details, technical standards, and the development workflow, see [docs/PROJECT-GUIDE.md](docs/PROJECT-GUIDE.md).

For troubleshooting, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
