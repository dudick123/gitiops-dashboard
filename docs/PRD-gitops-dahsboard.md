# GitOps Platform Dashboard

## Product Requirements Document

Version 1.3 — March 2026

STATUS: DRAFT — For Internal Review

| Field         | Value                                 |
|-------------------|-------------------------------------------|
| Document Owner    | Platform Engineering Team                 |
| Last Updated      | March 2026                                |
| Version           | 1.3                                       |
| Target Audience   | Platform Tenants (Dev, SRE, Security)     |
| Review Cycle      | Sprint-aligned (bi-weekly)                |
| Related Standards | OpenSpec — github.com/Fission-AI/OpenSpec |

## 1. Executive Summary

The GitOps Platform Dashboard is a unified, read-only observability interface for Kubernetes platform tenants. It aggregates real-time signals from three ArgoCD instances (DEV, STAGE, PROD), six regional AKS clusters, and a centralised Azure Monitor Workspace (Prometheus) into a single interface — eliminating the need to context-switch across the ArgoCD console, kubectl, or Azure portal.

The platform spans three promotion environments. Each environment is managed by a dedicated ArgoCD instance that governs two AKS clusters (East US and West US). Application rollouts progress from DEV → STAGE → PROD on a per-region basis, East first. The dashboard makes this promotion pipeline observable at a glance.

All data connectors are stand-alone FastAPI microservices (Python 3.14) following the [OpenSpec](https://github.com/Fission-AI/OpenSpec) API-first standard. ArgoCD is the authoritative source for deployment state and image tags. Prometheus (via Azure Monitor Workspace) is the authoritative source for all metrics. Direct Kubernetes API queries are avoided except where no suitable alternative exists.

Secret management for all connector credentials is handled by External Secrets Operator, with tokens and credentials stored in Azure Key Vault.

## 2. Goals and Success Metrics

### 2.1 Primary Goals

- Provide a single dashboard view of application health and sync status across all three environments (DEV, STAGE, PROD) and both regions (East US, West US).

- Make the per-region promotion pipeline (DEV → STAGE → PROD, East first) observable — showing which image tag is deployed at each stage in each region.

- Source all deployment state and container image data exclusively from the ArgoCD API. No direct container registry queries.

- Source all resource metrics exclusively from Prometheus via the Azure Monitor Workspace. Avoid direct Kubernetes Metrics Server or kube-apiserver queries for metrics data.

- Eliminate need for tenants to use kubectl, the ArgoCD UI, or the Azure portal for routine observability tasks.

- Support a Python-proficient development team via an OpenSpec workflow that offers both AI-assisted scaffolding and full agent-driven implementation options.

### 2.2 Success Metrics

| Metric                         | Target       | Measurement       |
|------------------------------------|------------------|-----------------------|
| Dashboard load time (P95)          | < 2 s           | Synthetic monitoring  |
| ArgoCD data freshness              | ≤ 30 s stale     | Redis TTL audit       |
| Prometheus metrics freshness       | ≤ 60 s stale     | Redis TTL audit       |
| Connector uptime (all envs)        | ≥ 99.5%          | AKS liveness probes   |
| Tenant onboarding time             | < 1 day         | Onboarding ticket SLA |
| Support tickets (kubectl / portal) | −60% vs baseline | Jira sprint review    |

## 3. User Personas

| Persona      | Primary Need                                                      | Key Dashboard Modules                      |
|------------------|-----------------------------------------------------------------------|------------------------------------------------|
| Tenant Developer | Is my app healthy in DEV? Has it promoted to STAGE yet?               | Env/Region Status, Image Promotion View        |
| Tech Lead        | Confirm all services promoted correctly across all envs; image drift? | Promotion Pipeline, Image Versions, App Status |
| SRE / Ops        | Detect CPU/memory pressure or Prometheus alert anomalies across envs  | Metrics Module, App Status                     |
| Security Auditor | Verify no unapproved images are running in PROD                       | Image Versions (PROD filter), App Status       |

## 4. Platform Topology

### 4.1 Environment and Cluster Layout

The platform comprises three environments — DEV, STAGE, and PROD — each with a dedicated ArgoCD control plane instance. Every ArgoCD instance manages two AKS clusters: one in East US and one in West US. This gives a total of six AKS clusters across the platform.

| Environment | ArgoCD Instance | East US Cluster | West US Cluster | ArgoCD API Endpoint                |
|-----------------|---------------------|---------------------|---------------------|----------------------------------------|
| DEV             | argocd-dev          | aks-dev-eastus      | aks-dev-westus      | https://argocd-dev.platform.internal   |
| STAGE           | argocd-stage        | aks-stage-eastus    | aks-stage-westus    | https://argocd-stage.platform.internal |
| PROD            | argocd-prod         | aks-prod-eastus     | aks-prod-westus     | https://argocd-prod.platform.internal  |

### 4.2 Promotion Pipeline

Applications are promoted in the following order, always starting with the East US region before West US within each environment tier:

| Step | Environment | Region | Description                              |
|----------|-----------------|------------|----------------------------------------------|
| 1        | DEV             | East US    | Initial deployment and integration testing   |
| 2        | DEV             | West US    | Regional parity validation in DEV            |
| 3        | STAGE           | East US    | Pre-production validation, East region first |
| 4        | STAGE           | West US    | Pre-production validation, West region       |
| 5        | PROD            | East US    | Production rollout, East region first        |
| 6        | PROD            | West US    | Production rollout, West region              |

The dashboard Image Promotion View displays the deployed image tag at each step of this pipeline per application, making drift or stalled promotions immediately visible.

### 4.3 Observability Data Sources

| Data Type                    | Authoritative Source                                | Rationale                                                       |
|----------------------------------|---------------------------------------------------------|---------------------------------------------------------------------|
| Application health & sync status | ArgoCD API (per environment instance)                   | Reflects actual deployed state, not desired state                   |
| Container image tags             | ArgoCD API — status.summary.images                      | Authoritative for running workload; avoids registry auth complexity |
| CPU & memory metrics             | Prometheus via Azure Monitor Workspace                  | Centralised; all six clusters push metrics here                     |
| Namespace & pod-level metrics    | Prometheus via Azure Monitor Workspace                  | Avoid direct Kubernetes Metrics Server queries                      |
| Network policy state             | Kubernetes API (unavoidable — no Prometheus equivalent) | K8s API is only viable source for NetworkPolicy objects             |

### 4.4 Secret Management

All connector credentials — ArgoCD service account tokens, Azure Monitor Workspace query keys, and Kubernetes service account tokens — are stored in Azure Key Vault. External Secrets Operator (ESO) synchronises them into Kubernetes Secrets within the dashboard namespace at deploy time. Connectors consume credentials exclusively via mounted environment variables; no credentials are embedded in container images or ConfigMaps.

- ArgoCD tokens: long-lived service account tokens, one per environment instance (argocd-dev, argocd-stage, argocd-prod), stored as separate Key Vault secrets.

- Azure Monitor Workspace: managed identity or client credentials stored in Key Vault, injected into the prometheus-connector at runtime.

- Kubernetes API access (network-connector only): in-cluster ServiceAccount with a minimal ClusterRole scoped to NetworkPolicy reads.

### 4.5 Logical Architecture

```
React Frontend  (Python-generated OpenAPI clients — no hand-written TS)
       ↓  REST — auto-generated clients from OpenAPI specs
FastAPI Connector Microservices  (Python 3.14, stand-alone per connector)
       ↙                ↓                       ↘
ArgoCD APIs (×3 env)   Azure Monitor Workspace   K8s API (network only)
  ↑  ↑  ↑                       ↑
DEV(E+W)  STAGE(E+W)  PROD(E+W) ← Prometheus scraped from all 6 clusters

External Secrets Operator → Azure Key Vault  (all connector credentials)
```

## 5. Development Methodology — OpenSpec

This project follows the [OpenSpec](https://github.com/Fission-AI/OpenSpec) API-first standard. OpenAPI 3.1 specification files are the canonical source of truth. All FastAPI stubs, frontend API clients, and integration test scaffolds are generated from approved specs. No connector endpoint may be implemented before its spec has been reviewed and merged.

### 5.1 Team Profile and Tooling Choices

The development team is proficient in Python and has no React experience. This directly shapes tooling decisions:

| Concern                | Decision                                        | Rationale                                                                             |
|----------------------------|-----------------------------------------------------|-------------------------------------------------------------------------------------------|
| Backend language           | Python 3.14 (FastAPI)                               | Team's primary language; full proficiency                                                 |
| Frontend language          | TypeScript (React)                                  | Required for dashboard quality; clients auto-generated from specs — team writes no raw TS |
| Frontend API layer         | Auto-generated from OpenAPI specs                   | Eliminates manual TS API client work for the team                                         |
| Agent-assisted development | OpenSpec AI agents for stub and scaffold generation | Reduces burden on team for boilerplate; Python logic is the only hand-written code        |

### 5.2 Proposal Lifecycle

Each connector microservice corresponds to a discrete OpenSpec proposal. The lifecycle gates implementation behind spec approval:

1.  Draft — Author writes the OpenAPI 3.1 YAML. Paths, schemas, error codes, and x-cache-ttl extension fields all defined. No code yet.

2.  Review — PR opened. OpenSpec AI tooling validates completeness. Human reviewer approves.

3.  Approved — Spec merged to main. This is the gate event. Code generation may now begin.

4.  Generated — FastAPI Python 3.14 stubs generated. Frontend TS clients regenerated. Generated files committed; must not be hand-edited.

5.  Implemented — Team fills business logic into generated stubs. Microservice containerised.

6.  Verified — Generated integration tests pass against the running container. Proposal closed.

Amendments to an approved spec that change response schemas require a new Draft cycle and a major version increment.

### 5.3 Agent Assistance Options for Python Developers

Within each OpenSpec proposal, the development team has two options for the Generated and Implemented stages. The choice is made per-proposal and recorded in the proposal document:

| Option        | Description                                                                                                                                 | When to Use                                                                                                                                |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| Scaffold only     | Agent generates FastAPI stubs with empty function bodies and full type annotations. Developer writes all business logic.                        | Developer wants full control; straightforward integrations where the API interaction is well understood                                        |
| Agent-implemented | Agent generates stubs and completes the business logic, including API client calls, error handling, and caching. Developer reviews and accepts. | Complex integrations (e.g. multi-env ArgoCD fan-out, Prometheus query construction); developer reviews output rather than writing from scratch |

### 5.4 Spec Governance

- All specs live in the platform monorepo under /specs/<connector-name\>/openapi.yaml.

- Breaking changes require a version bump and migration plan.

- Spec reviews are mandatory before any code generation step proceeds.

## 6. Data Connector Specifications

Each data source is served by a dedicated, stand-alone FastAPI microservice. Connectors are independently deployable, independently scalable, and independently versioned. They share no process space or internal state.

### 6.1 Connector Architecture Principles

- Language & runtime: Python 3.14 across all connectors.

- Framework: FastAPI with Pydantic v2 request/response models on all HTTP endpoints.

- Deployment: each connector is a separate container image, deployed as an independent Kubernetes Deployment in the dashboard namespace.

- OpenAPI spec: each service auto-exposes /openapi.json; the spec is also committed to the monorepo as the source-of-truth artifact per OpenSpec.

- No shared state: connectors may not import from each other; cross-connector aggregation happens in the React frontend.

- Caching: each connector maintains its own Redis client with TTL values defined per endpoint.

- Secrets: all credentials injected via environment variables populated by External Secrets Operator from Azure Key Vault. No credentials in images or ConfigMaps.

- Kubernetes API avoidance: connectors MUST NOT query the Kubernetes API directly for metrics or application state. The only permitted K8s API usage is the network-connector reading NetworkPolicy objects.

### 6.2 Connector Inventory

| Connector        | Upstream Source                      | Instances      | Data Served                                     | TTL |
|----------------------|------------------------------------------|--------------------|-----------------------------------------------------|---------|
| argocd-connector     | ArgoCD REST API                          | 1 per env (×3)     | App health, sync status, image tags per env+cluster | 30 s    |
| prometheus-connector | Azure Monitor Workspace (Prometheus API) | 1 (shared)         | CPU, memory, pod & namespace metrics for all envs   | 60 s    |
| network-connector    | Kubernetes API (NetworkPolicy only)      | 1 per cluster (×6) | Namespace network policy state                      | 120 s   |

Note: the previous k8s-connector (pod status, resource quotas) and metrics-connector (Kubernetes Metrics Server) are superseded. Pod/namespace metrics are now served by prometheus-connector. Network state remains a Kubernetes API query as no Prometheus equivalent exists.

### 6.3 ArgoCD Connector Detail

Three instances of argocd-connector are deployed — one per environment. Each instance is configured at deploy time with the environment label (DEV, STAGE, or PROD) and the corresponding ArgoCD server URL and service account token.

#### Configuration (per instance)

| Env Var       | Example (DEV instance)           | Source                                                  |
|-------------------|--------------------------------------|-------------------------------------------------------------|
| ARGOCD_ENV        | DEV                                  | Deployment manifest (static)                                |
| ARGOCD_SERVER_URL | https://argocd-dev.platform.internal | Deployment manifest                                         |
| ARGOCD_TOKEN      | <injected\>                         | External Secrets → Azure Key Vault secret: argocd-dev-token |

#### Key Endpoints

- GET /apps — lists all ArgoCD Application resources for this instance's environment, with cluster (East/West) and region context.

- GET /apps/{name} — returns health, sync status, and image summary for a single application.

- GET /apps/{name}/images — returns parsed container image tags from status.summary.images.

- GET /health — liveness probe; verifies ArgoCD API reachability.

#### ArgoCD API Usage Notes

- Authentication: long-lived ArgoCD service account token, injected via ARGOCD_TOKEN from External Secrets / Azure Key Vault.

- Image tag extraction: prefer status.summary.images (ArgoCD 2.x). Fall back to spec.source.helm.values image key parsing only if summary is unavailable.

- Cluster routing: use dest.server field on each Application to determine East US vs West US cluster.

- Scope: ArgoCD App status and image data only. No manifest diffs, no YAML content. The dashboard summarises health/sync state; it does not display or parse Kubernetes manifests.

- Scope: AKS workloads only. Azure Container Apps and other Azure-native compute resources are out of scope.

### 6.4 Prometheus Connector Detail

A single prometheus-connector instance queries the Azure Monitor Workspace, which receives scraped Prometheus metrics from all six AKS clusters across all three environments. Metric queries include an environment and cluster label to filter results appropriately.

#### Configuration

| Env Var            | Example                                        | Source                   |
|------------------------|----------------------------------------------------|------------------------------|
| AZURE_MONITOR_ENDPOINT | https://<workspace\>.prometheus.monitor.azure.com | Deployment manifest          |
| AZURE_CLIENT_ID        | <managed identity or app registration\>           | External Secrets → Key Vault |
| AZURE_CLIENT_SECRET    | <injected\>                                       | External Secrets → Key Vault |

#### Key Endpoints

- GET /metrics/cpu — returns CPU usage (pod and namespace) filtered by environment and cluster labels.

- GET /metrics/memory — returns memory usage (pod and namespace) filtered by environment and cluster labels.

- GET /metrics/namespace-quota — returns namespace resource quota utilisation.

- GET /health — liveness probe; verifies Azure Monitor Workspace reachability.

#### Query Strategy

- All PromQL queries MUST include label filters for environment (e.g. cluster_env=~"prod") and cluster region (e.g. cluster_region="eastus") to scope results correctly.

- The connector is the single query point for all six clusters; label-based scoping within PromQL replaces the need for per-cluster connector instances.

### 6.5 Network Connector Detail

Six instances of network-connector are deployed — one per AKS cluster. Each instance uses an in-cluster Kubernetes ServiceAccount with a minimal ClusterRole scoped to read NetworkPolicy objects. This is the only connector permitted to query the Kubernetes API directly, as NetworkPolicy data has no Prometheus equivalent.

#### Key Endpoints

- GET /network/policies — returns all NetworkPolicy objects in scope for this cluster's dashboard namespaces.

- GET /network/namespaces/{ns}/status — returns network isolation status for a specific namespace; flags open egress.

- GET /health — liveness probe.

## 7. Frontend Specification

### 7.1 Technology Stack

| Component    | Choice                                             | Notes                                                                                            |
|------------------|--------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| Framework        | React 18 + TypeScript (strict mode)                    | Team has no React experience; agent-generated components from OpenAPI specs minimise hand-written TS |
| API Clients      | Auto-generated TypeScript (openapi-typescript-codegen) | Generated from approved OpenSpec specs; team does not write raw API calls                            |
| State Management | React Query v5                                         | Auto-polling aligned to per-connector Redis TTLs                                                     |
| Styling          | Tailwind CSS + shadcn/ui                               | Consistent component library; agent scaffolding friendly                                             |
| Charts           | Recharts                                               | CPU, memory time-series sparklines                                                                   |
| Build Tool       | Vite                                                   | Fast dev server; Docker image production build                                                       |

### 7.2 Environment and Region Navigation

The dashboard provides two global filter controls visible on all modules:

- Environment selector: DEV / STAGE / PROD (default: all three shown simultaneously for promotion comparison).

- Region selector: East US / West US / Both (default: Both).

These filters are applied client-side against data already returned by connectors. The connector API responses always include environment and region labels so the frontend can filter without additional round trips.

### 7.3 Dashboard Modules

#### Module 1 — ArgoCD Application Status

- Displays health and sync state for all ArgoCD Applications across all three environments and both regions.

- Grouped view: rows are applications, columns are environments (DEV / STAGE / PROD), with East/West sub-columns. Each cell shows the health/sync badge.

- Visual indicators: green (Healthy/Synced), amber (Degraded/OutOfSync), red (Unknown/Error).

- No manifest diffs, no YAML display. Health and sync status summaries only.

- AKS workloads only — no Azure Container Apps or other compute types.

#### Module 2 — Image Promotion View

- Shows deployed container image tag per application at each step of the promotion pipeline (DEV-East → DEV-West → STAGE-East → STAGE-West → PROD-East → PROD-West).

- Data sourced exclusively from ArgoCD API (status.summary.images) via argocd-connector instances.

- Highlights tag mismatches across steps (e.g. DEV-East on v1.3.1 but DEV-West still on v1.3.0).

- Highlights non-semver tags as a warning indicator.

- No direct registry queries performed.

#### Module 3 — CPU & Memory Metrics

- Pod-level and namespace-level CPU/memory sourced from prometheus-connector (Azure Monitor Workspace).

- Filterable by environment and region using global selectors.

- Trend sparklines for the last 10 polling intervals.

- Namespace quota utilisation bar displayed alongside raw usage.

#### Module 4 — Namespace Network Status

- Renders active NetworkPolicy objects per namespace, sourced from network-connector (Kubernetes API).

- Flags namespaces with no egress restriction (open egress warning).

- Filterable by environment and cluster/region.

## 8. Redis Cache Policy

Redis is used exclusively as a throwaway in-memory cache. No disk persistence is enabled. Cache misses result in a live upstream fetch.

| Connector          | Data Type                            | TTL | Cache Miss Behaviour                  |
|------------------------|------------------------------------------|---------|-------------------------------------------|
| argocd-connector (×3)  | App status, sync, images per env+cluster | 30 s    | Live ArgoCD API fetch                     |
| prometheus-connector   | CPU / memory / quota metrics             | 60 s    | Live Azure Monitor Workspace PromQL query |
| network-connector (×6) | NetworkPolicy objects per cluster        | 120 s   | Live Kubernetes API fetch                 |

## 9. Non-Functional Requirements

| Category            | Requirement                                                                                 |
|-------------------------|-------------------------------------------------------------------------------------------------|
| Runtime                 | Python 3.14 — all connector microservices                                                       |
| Framework               | FastAPI — all connector HTTP interfaces                                                         |
| API Standard            | OpenSpec (github.com/Fission-AI/OpenSpec) — specs are source of truth                           |
| Environments            | DEV, STAGE, PROD — each with a dedicated ArgoCD instance                                        |
| Clusters                | 6 AKS clusters total (2 regions × 3 environments)                                               |
| ArgoCD source of truth  | Deployed image tags and app state sourced from ArgoCD API only                                  |
| Metrics source of truth | All resource metrics sourced from Prometheus via Azure Monitor Workspace only                   |
| K8s API restriction     | Direct K8s API queries permitted only for NetworkPolicy reads (network-connector)               |
| Secret management       | External Secrets Operator + Azure Key Vault for all credentials                                 |
| Security                | Long-lived ArgoCD service account tokens (one per env instance); ESO-managed rotation lifecycle |
| Observability           | Structured JSON logs (structlog); Prometheus /metrics on each connector                         |
| Scalability             | Connectors scale to zero on idle; HPA configured per connector                                  |
| Availability            | 99.5% uptime SLO per connector; multi-replica deployments in PROD                               |
| Data Residency          | No PII stored; no data written to disk; Redis in-cluster only                                   |

## 10. Phased Delivery Plan

Each phase is gated by the approval of its OpenSpec proposals. No code generation or implementation work may begin for a given proposal until it has been reviewed and merged. The Gate Condition column defines the exit criterion for each phase.

| Phase | Timeline | OpenSpec Proposals                                                                                                            | Deliverables                                                                                                                                                                                                                                                                                                                        | Gate Condition                                                                                                                                             |
|-----------|--------------|-----------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0         | Weeks 1–3    | None (pre-proposal). Proposal template and review process established.                                                            | Repo scaffold; External Secrets / Key Vault wiring; ArgoCD API access verified for all three environment instances; working dashboard mockup deployable as a Docker container (React static UI with mock data representing all 3 envs and 2 regions, no live connectors). Mockup is the visual contract for all subsequent module work. | Mockup Docker image builds and runs locally. Stakeholder sign-off on env/region layout. Proposal template merged to main.                                      |
| 1         | Weeks 4–6    | PROP-01: argocd-connector API surface (env-parameterised). PROP-02: Frontend module contract (app status + image promotion view). | Three argocd-connector instances (DEV/STAGE/PROD). React modules 1 & 2 wired to live connector data, replacing mockup. Promotion pipeline view operational.                                                                                                                                                                             | PROP-01 and PROP-02 approved. Generated tests pass. All three ArgoCD environments visible in dashboard with correct East/West cluster routing.                 |
| 2         | Weeks 7–9    | PROP-03: prometheus-connector API surface (multi-env label filtering).                                                            | prometheus-connector wired to Azure Monitor Workspace. React module 3 (CPU/Memory) operational across all environments and regions. Redis cache layer with per-connector TTL policy.                                                                                                                                                    | PROP-03 approved. Prometheus connector returns correctly labelled metrics for all six clusters. Module 3 renders live data with env/region filter.             |
| 3         | Weeks 10–12  | PROP-04: network-connector API surface (per-cluster).                                                                             | Six network-connector instances (one per AKS cluster). React module 4 (Network Status) operational. All connectors deployed via ArgoCD with ESO-managed secrets.                                                                                                                                                                        | PROP-04 approved. All six network-connector instances pass generated integration tests. Module 4 renders live NetworkPolicy data filterable by env and region. |
| 4         | Weeks 13–15  | No new proposals. Spec-conformance validation run against all implemented services.                                               | End-to-end integration tests across all environments and regions; performance hardening; spec-conformance gate; internal pilot rollout to early-adopter tenants.                                                                                                                                                                        | All connectors pass spec-conformance check. P95 load time < 2 s. Pilot tenant group onboarded.                                                                |

## 11. Resolved Decisions

The following items were previously open questions and have been resolved:

| Topic                 | Decision                                                                                                                                              |
|---------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| ArgoCD API authentication | Long-lived service account tokens (one per environment ArgoCD instance). Tokens stored in Azure Key Vault, injected via External Secrets Operator.        |
| Manifest diff display     | Dashboard summarises health and sync status only. No manifest diffs, no YAML display.                                                                     |
| Azure Container Apps      | Out of scope. Dashboard covers AKS workloads (ArgoCD Applications) only.                                                                                  |
| Rollout order             | Per-region basis, East US before West US within each environment tier. Full order: DEV-East → DEV-West → STAGE-East → STAGE-West → PROD-East → PROD-West. |
| Kubernetes API usage      | Strictly limited to NetworkPolicy reads (network-connector). All other data comes from ArgoCD API or Prometheus.                                          |

## 12. Open Questions

- Prometheus label schema: what are the exact label names used to identify environment (DEV/STAGE/PROD) and region (eastus/westus) in the Azure Monitor Workspace? Needed before PROP-03 spec can be drafted.

- network-connector deployment: are the six AKS clusters accessible from a single dashboard deployment namespace, or does the network-connector need to be deployed into each cluster separately?

- ArgoCD AppProject scoping: are tenant applications grouped into ArgoCD AppProjects per environment? This affects the /apps endpoint filtering logic in PROP-01.

- Region B filter persistence: should the East/West region selector persist across browser sessions (localStorage) or be ephemeral?

- Token rotation: what is the expected rotation cadence for ArgoCD service account tokens? Does ESO need a rotation trigger configured?

## 13. Glossary

| Term                | Definition                                                                                                                       |
|-------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| ArgoCD                  | GitOps continuous delivery tool for Kubernetes. Three separate instances in this platform: argocd-dev, argocd-stage, argocd-prod.    |
| AKS                     | Azure Kubernetes Service. Six clusters total: aks-{env}-{eastus\|westus} for each of DEV, STAGE, PROD.                               |
| Azure Monitor Workspace | Centralised Prometheus-compatible metrics store. All six AKS clusters push Prometheus metrics here.                                  |
| ESO                     | External Secrets Operator — synchronises secrets from Azure Key Vault into Kubernetes Secrets at deploy time.                        |
| FastAPI                 | Python async web framework used for all connector microservices.                                                                     |
| OpenSpec                | API-first development standard (github.com/Fission-AI/OpenSpec). OpenAPI specs are the source of truth; code is generated from them. |
| Promotion pipeline      | The ordered sequence DEV-East → DEV-West → STAGE-East → STAGE-West → PROD-East → PROD-West through which a release progresses.       |
| TTL                     | Time-to-live — Redis cache expiry duration per data type.                                                                            |
| dest.server             | ArgoCD Application field identifying the target cluster URL; used to route applications to the correct regional AKS cluster.         |
| status.summary.images   | ArgoCD Application status field listing container images deployed to the workload. Authoritative source for image tag data.          |
