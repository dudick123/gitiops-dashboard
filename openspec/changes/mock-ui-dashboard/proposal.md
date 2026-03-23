## Why

The PRD Phase 0 gate condition (§12) requires a "working dashboard mockup deployable as a Docker container (React static UI with mock data representing all 3 envs and 2 regions, no live connectors)" before any connector implementation begins. This mockup serves as the **visual contract** for stakeholders — it defines the layout, navigation, data density, and degraded state patterns that all subsequent proposals (PROP-01 through PROP-04) will implement against. Without it, the team builds connectors and UI modules against an imagined interface, risking expensive rework when stakeholder expectations diverge.

The repo scaffold (Phase 0, completed) established the project skeleton. This proposal fills it with the actual dashboard UI — all 4 modules rendered with realistic mock data — so stakeholders can sign off on the env/region layout before live data integration begins.

## What Changes

- Build all 4 dashboard modules (App Status, Image Promotion, Metrics, Network Status) as React components with Tailwind CSS and shadcn/ui
- Create comprehensive MSW (Mock Service Worker) handlers returning static JSON fixtures that simulate all 3 connector APIs
- Generate realistic mock data: 850+ ArgoCD applications across 3 environments × 2 regions, with health/sync states, image tags, promotion pipeline, CPU/memory metrics, namespace quotas, OOM events, NetworkPolicy objects, and Cilium flow data
- Implement the global navigation shell: project scope selector, environment filter, region filter, Platform View vs Project View toggle
- Implement per-module "Last updated" timestamps and degraded state handling (PRD §4.6)
- Implement ApplicationSet → Application hierarchy in Project View (PRD §5.3 Module 1)
- Build the standalone Docker image: frontend + MSW, no backend connectors needed
- Initialize shadcn/ui component library with the project's design tokens

## Capabilities

### New Capabilities

- `mock-data-fixtures`: Static JSON fixtures representing all connector API responses — ArgoCD apps/appsets/projects, Prometheus CPU/memory/quota/OOM metrics, NetworkPolicy objects, Cilium flow data. Covers all 3 envs × 2 regions with 850+ apps.
- `dashboard-shell`: Global navigation layout with project scope selector (localStorage persistence), environment filter (DEV/STAGE/PROD), region filter (East/West/Both), Platform View vs Project View switching, module routing with React.lazy code splitting.
- `app-status-module`: Dashboard Module 1 — ArgoCD Application Status grid. Platform View shows flat app list with env×region columns. Project View shows ApplicationSet→Application hierarchy with health/sync badges.
- `image-promotion-module`: Dashboard Module 2 — Image Promotion pipeline view. Shows deployed image tag per application at each of the 6 promotion steps (DEV-E → DEV-W → STAGE-E → STAGE-W → PROD-E → PROD-W). Highlights tag mismatches and non-semver tags.
- `metrics-module`: Dashboard Module 3 — CPU & Memory metrics with sparklines. Platform View shows namespace-level aggregates. Project View shows workload-level (Deployment/StatefulSet/Job) breakdown with request/limit ratios and OOM events.
- `network-status-module`: Dashboard Module 4 — Namespace Network Status. Shows NetworkPolicy objects per namespace, open egress warnings, Cilium L3/L4 flow drops, denied connections table.

### Modified Capabilities

(none — no existing specs modified)

## Impact

- **frontend/src/**: Major — all 4 module component directories populated, shell layout built, hooks and query integration wired
- **frontend/src/mocks/**: Major — MSW handlers expanded from stubs to full mock API responses for all 3 connector APIs
- **frontend/src/lib/**: Runtime config loader, query-client hooks per module
- **frontend/public/**: Mock data JSON fixtures (or inline in MSW handlers)
- **frontend/Dockerfile**: Verified to build and serve the complete dashboard with mock data
- **frontend/package.json**: shadcn/ui dependencies added, any missing Recharts sub-packages
- **No backend changes**: Connectors are not modified — this is frontend-only
- **No infrastructure changes**: No Kustomize, no deploy repo changes
