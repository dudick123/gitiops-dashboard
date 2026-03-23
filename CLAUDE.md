# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitOps Dashboard — an enterprise platform for monitoring and managing ArgoCD deployments, Prometheus metrics, and Kubernetes NetworkPolicies across 6 AKS clusters (3 environments × 2 regions: East US, West US).

**Status**: Early-stage (PRD/architecture phase). No source code committed yet. PRDs in `docs/` define the full technical specification.

## Planned Tech Stack

- **Backend**: Python 3.14, FastAPI, Pydantic v2, structlog, Redis caching
- **Frontend**: React 18, TypeScript (strict), Vite, React Query v5, Tailwind CSS, shadcn/ui, Recharts
- **Infrastructure**: AKS, ArgoCD, Azure DevOps Pipelines, Kustomize, External Secrets Operator + Azure Key Vault
- **Metrics**: Prometheus via Azure Monitor Workspace

## Architecture

### OpenSpec-First Development

OpenAPI 3.1 specs are the source of truth. Backend code and frontend TypeScript clients are generated from specs. All services must be validated against their specs.

### Microservice Connectors (FastAPI)

Three backend microservices, each wrapping a single data source:
1. **argocd-connector** — ArgoCD API (3 instances: DEV/STAGE/PROD)
2. **prometheus-connector** — Azure Monitor Workspace (1 shared instance)
3. **network-connector** — Kubernetes NetworkPolicy queries (1 per cluster, 6 total)

### Caching Strategy (Redis, no persistence)

- Uniform 30-minute TTL across all connectors (ArgoCD, Prometheus, NetworkPolicy)
- Dashboard is a reporting tool — does not require real-time data
- 30-minute interval avoids overwhelming upstream APIs

### Environment Promotion Order

DEV-East → DEV-West → STAGE-East → STAGE-West → PROD-East → PROD-West

## Key Design Decisions

- **No direct Kubernetes API queries** except for NetworkPolicy — all other data comes from ArgoCD or Prometheus
- **Auto-generated TypeScript clients** from OpenAPI specs (team is Python-heavy, minimal React experience)
- **Kustomize** for all manifest rendering (no Helm)
- **Per-connector microservices** for independent scaling and versioning
- **Structured JSON logging** via structlog on all connectors

## Reference Documents

- `docs/PRD-gitops-dahsboard.md` — Main platform PRD (v1.3): topology, data sources, connector specs, frontend modules, phased delivery
- `docs/PRD-v2-gitops-pipelines.md` — Azure DevOps pipeline templates PRD (v2.0): container builds, manifest rendering, security scanning
