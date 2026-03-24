# GitOps Dashboard

A read-only reporting dashboard for monitoring ArgoCD deployments, Prometheus metrics, and Kubernetes NetworkPolicies across 6 AKS clusters (3 environments x 2 regions).

## What It Does

Aggregates data from three tools into a single interface:

- **ArgoCD** (DEV, STAGE, PROD) — application health, sync status, image tags, promotion tracking
- **Prometheus** (via Azure Monitor Workspace) — CPU, memory, quota, OOM events, Cilium flows
- **Kubernetes API** — NetworkPolicy objects per cluster

The dashboard is **non-mutating** (read-only), **internal-only** (private network), and **Tier II** (no formal SLAs).

## Current Status

| Phase | Status |
|-------|--------|
| Repo scaffold | Complete |
| Methodology POC (argocd-connector /healthz + /apps) | Complete |
| Mock UI Dashboard (React + MSW, all 4 modules) | Complete |
| Phase 1 — ArgoCD connector + frontend modules | Not started |

## Quick Start

See [QUICKSTART.md](QUICKSTART.md) for setup instructions.

## Architecture

```
React 18 Frontend (TypeScript / Vite)
        |
        | REST (OpenAPI)
   +---------+---------+----------+
   |         |         |          |
ArgoCD    Prometheus  Network   Redis
Connector Connector  Connector  (cache)
(x3 envs) (x1)      (x6 clusters)
   |         |         |
ArgoCD   Azure      K8s API
API      Monitor    (NetPol only)
```

Three FastAPI connector microservices, each wrapping a single data source. Redis provides a 30-minute TTL cache. All components deploy to AKS DEV East US cluster via ArgoCD.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.14, FastAPI, Pydantic v2, structlog, httpx, redis |
| Frontend | React 18, TypeScript (strict), Vite, React Query v5, Tailwind CSS, shadcn/ui |
| Package mgmt | `uv` (Python), npm (frontend) |
| Testing | pytest + pytest-asyncio (Python), Vitest + RTL + MSW (frontend) |
| Infrastructure | AKS, ArgoCD, Kustomize, External Secrets Operator |

## Repository Structure

```
gitops-dashboard/
├── connectors/
│   ├── argocd-connector/     # ArgoCD API connector (Python/FastAPI)
│   ├── prometheus-connector/  # Prometheus metrics connector
│   └── network-connector/     # NetworkPolicy connector
├── frontend/                  # React 18 dashboard UI
├── specs/                     # OpenAPI 3.1 YAML specs
├── scripts/                   # Utility scripts
├── docs/                      # PRD, standards, guides, reviews
├── openspec/                  # OpenSpec methodology artifacts
├── Makefile                   # Dev commands (make check-all)
├── docker-compose.yml         # Local dev stack
└── azure-pipelines.yml        # CI pipeline (stub)
```

## Development Commands

```bash
make install        # Install all dependencies (uv + npm)
make check-all      # Full quality gate (lint + typecheck + test, Python + frontend)
make lint           # Ruff check (Python)
make typecheck      # mypy --strict (Python)
make test           # pytest with coverage (Python)
make docker-up      # Start full stack via docker-compose
make docker-down    # Stop
make build          # Build all Docker images
```

## Running the Mock Dashboard

```bash
docker run -p 3000:8080 gitops-dashboard/frontend:mock
```

Open http://localhost:3000 — the dashboard renders with 882 mock applications, all 4 modules functional, no backend required.

## Documentation

| Document | Purpose |
|----------|---------|
| [QUICKSTART.md](QUICKSTART.md) | Step-by-step setup guide |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Common issues and solutions |
| [docs/PROJECT-GUIDE.md](docs/PROJECT-GUIDE.md) | Consolidated project context for contributors |
| [docs/PRD-gitops-dashboard.md](docs/PRD-gitops-dashboard.md) | Full product requirements |
| [docs/TECH-STANDARDS.md](docs/TECH-STANDARDS.md) | Technical development standards |

## Contributing

All changes follow the [OpenSpec](https://github.com/Fission-AI/OpenSpec) methodology:

```
propose → implement → review → archive
```

See [docs/PROJECT-GUIDE.md](docs/PROJECT-GUIDE.md) for the development workflow, quality gates, and review process.

## License

Internal platform tool. Not open-sourced.
