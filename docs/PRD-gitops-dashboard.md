# Product Requirements Document: GitOps Platform Dashboard

## Unified Observability Interface for ArgoCD, Prometheus, and Kubernetes NetworkPolicy

| Field              | Value                                                        |
| ------------------ | ------------------------------------------------------------ |
| **Version**        | 2.0                                                          |
| **Status**         | Draft                                                        |
| **Date**           | 2026-03-22                                                   |
| **Owner**          | Platform Engineering Team                                    |
| **Target Audience**| Platform Tenants (Dev, SRE, Security, Leadership)            |
| **Review Cycle**   | Sprint-aligned (bi-weekly)                                   |
| **Related Standards** | OpenSpec — github.com/Fission-AI/OpenSpec                 |
| **Related PRDs**   | PRD-v2-gitops-pipelines.md (Azure DevOps pipeline templates) |

---

## 1. Executive Summary

### Problem Statement

Platform tenants — developers, tech leads, SREs, and security auditors — currently have no single view of application deployment state across the platform's three ArgoCD environments and six AKS clusters. Observability data is fragmented across the ArgoCD console, kubectl, the Azure portal, and Azure Monitor — each with its own RBAC model, access patterns, and learning curve. Tenants must context-switch between 3+ tools to answer basic questions like "has my app promoted to STAGE?" or "what image is running in PROD-East?". This friction increases onboarding time, slows incident triage, and creates unnecessary dependency on platform engineers for routine status checks.

### Proposed Solution

A unified, read-only reporting dashboard deployed on the internal network that aggregates real-time signals from three ArgoCD instances (DEV, STAGE, PROD), six regional AKS clusters (East US and West US per environment), and a centralised Azure Monitor Workspace (Prometheus) into a single interface. The dashboard is non-mutating — it displays state but does not modify it. All write operations continue through existing CI/CD and ArgoCD patterns.

The dashboard is built as a set of independent FastAPI microservice connectors (Python 3.14) fronted by a React 18 TypeScript UI. All API contracts follow the OpenSpec API-first standard, with OpenAPI 3.1 specifications as the canonical source of truth.

### Success Criteria

| Metric | Target | Measurement |
| ------ | ------ | ----------- |
| **Dashboard load time (P95)** | < 3 s | Synthetic monitoring |
| **ArgoCD data freshness** | ≤ 30 s stale | Redis TTL audit |
| **Prometheus metrics freshness** | ≤ 60 s stale | Redis TTL audit |
| **Connector availability** | Best-effort; not Tier I | AKS liveness probes |
| **Tenant self-service adoption** | Measurable reduction in "status check" requests to platform team | Qualitative team survey post-pilot |
| **Onboarding friction** | New tenants can use the dashboard without training | Observation during pilot |

> **Note**: This is a Tier II reporting application. Success metrics are directional targets, not formal SLAs/SLIs/SLOs. Baselines will be established during the pilot phase and refined post-MVP.

---

## 2. User Experience & Functionality

### User Personas

| Persona | Description |
| ------- | ----------- |
| **Tenant Developer** | Builds features and deploys via CI/CD. Needs to confirm app health in DEV and track promotion to STAGE/PROD. |
| **Tech Lead** | Oversees a team's services across all environments. Needs to confirm promotions completed correctly and spot image drift. |
| **SRE / Ops** | Monitors resource pressure across environments. Needs a quick read on CPU/memory anomalies without opening the Azure portal. |
| **Security Auditor** | Verifies no unapproved images are running in PROD and checks network isolation enforcement. |
| **Engineering Leadership** | Needs high-level platform health at a glance across all environments. |

### User Stories

#### Application Status

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| AS-01 | As a **tenant developer**, I want to see my application's health and sync status across all environments on one screen so that I don't need to log into three ArgoCD instances. | Dashboard displays health (Healthy/Degraded/Unknown) and sync (Synced/OutOfSync/Error) for each app across DEV, STAGE, PROD with East/West sub-columns. |
| AS-02 | As a **tech lead**, I want to filter applications by name or team so that I can focus on my team's services. | Text search filters the application list in real time. |
| AS-03 | As a **tenant developer**, I want to see when data was last refreshed so that I know if I'm looking at stale information. | Each data section displays a "Last updated" timestamp. If a source is unreachable, the section shows "Unknown" status with the last successful refresh time. |

#### Image Promotion

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| IP-01 | As a **tech lead**, I want to see which image tag is deployed at each stage of the promotion pipeline for a given application so that I can confirm promotions completed correctly. | Promotion view shows tag per step: DEV-East → DEV-West → STAGE-East → STAGE-West → PROD-East → PROD-West. |
| IP-02 | As a **tech lead**, I want mismatched tags between pipeline steps highlighted so that stalled or failed promotions are immediately visible. | Cells with tag mismatches between adjacent steps are visually flagged (amber highlight). |
| IP-03 | As a **security auditor**, I want non-semver image tags flagged so that I can identify images that may not follow the approved release process. | Tags not matching semver pattern display a warning indicator. |

#### Metrics

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| MT-01 | As an **SRE**, I want to see CPU and memory usage by namespace and pod, filterable by environment and region, so that I can spot resource pressure without opening the Azure portal. | Metrics module displays CPU/memory at namespace and pod level, filterable by environment (DEV/STAGE/PROD) and region (East/West). |
| MT-02 | As an **SRE**, I want trend sparklines so that I can see directional changes at a glance. | Sparkline charts show the last 10 polling intervals of data. |
| MT-03 | As a **tenant developer**, I want to see namespace resource quota utilisation so that I know how close my namespace is to its limits. | Namespace quota utilisation bar displayed alongside raw usage values. |

#### Network Status

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| NS-01 | As a **security auditor**, I want to see active NetworkPolicy objects per namespace so that I can verify network isolation is enforced. | Network module lists NetworkPolicy objects per namespace, filterable by environment and cluster. |
| NS-02 | As a **security auditor**, I want namespaces with no egress restriction flagged so that I can identify gaps in network policy coverage. | Namespaces with open egress display a warning badge. |

#### Degraded State Handling

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| DG-01 | As a **dashboard user**, I want the dashboard to remain functional when one or more data sources are unreachable so that I can still view available data. | If an ArgoCD instance or AKS cluster is unreachable, affected sections show "Unknown" status with the last successful data refresh timestamp. Unaffected sections continue to render normally. |

### Non-Goals

- **Write operations** — No syncing, rollbacks, restarts, scaling, or any mutation from the dashboard. All changes go through existing CI/CD and ArgoCD workflows.
- **Incident triage / troubleshooting** — This is a reporting dashboard, not a diagnostic tool. Log search, trace analysis, and deep debugging remain in existing tools.
- **Alerting and notifications** — No integration with PagerDuty, Slack, Teams, or any notification system. The dashboard does not fire alerts.
- **Tenant isolation / hard RBAC** — Any user with a valid SSO/OIDC token from the Azure tenant can see all applications. There is no per-team or per-namespace access restriction.
- **Azure Container Apps** — Only AKS workloads managed by ArgoCD are in scope.
- **Manifest diffs / YAML display** — The dashboard shows health and sync status summaries. It does not render, diff, or display Kubernetes manifests.
- **Public internet access** — The dashboard is available on private internal networks only.
- **Formal SLA/SLO commitments** — This is a Tier II application. Availability targets are best-effort.

---

## 3. Platform Topology

### 3.1 Environment and Cluster Layout

The platform comprises three environments — DEV, STAGE, and PROD — each with a dedicated ArgoCD control plane instance. Every ArgoCD instance manages two AKS clusters: one in East US and one in West US. This gives a total of six AKS clusters and approximately 850+ ArgoCD Applications across all environments.

| Environment | ArgoCD Instance | East US Cluster | West US Cluster | ArgoCD API Endpoint |
| ----------- | --------------- | --------------- | --------------- | ------------------- |
| **DEV** | argocd-dev | aks-dev-eastus | aks-dev-westus | https://argocd-dev.platform.internal |
| **STAGE** | argocd-stage | aks-stage-eastus | aks-stage-westus | https://argocd-stage.platform.internal |
| **PROD** | argocd-prod | aks-prod-eastus | aks-prod-westus | https://argocd-prod.platform.internal |

### 3.2 Promotion Pipeline

Applications are promoted in the following order, always starting with East US before West US within each environment tier:

| Step | Environment | Region | Description |
| ---- | ----------- | ------ | ----------- |
| 1 | DEV | East US | Initial deployment and integration testing |
| 2 | DEV | West US | Regional parity validation in DEV |
| 3 | STAGE | East US | Pre-production validation, East region first |
| 4 | STAGE | West US | Pre-production validation, West region |
| 5 | PROD | East US | Production rollout, East region first |
| 6 | PROD | West US | Production rollout, West region |

### 3.3 Dashboard Deployment Target

The dashboard (frontend + all connector microservices + Redis) is deployed into the **DEV East US cluster** (`aks-dev-eastus`). It queries the other clusters and ArgoCD instances over the internal network.

### 3.4 Observability Data Sources

| Data Type | Authoritative Source | Rationale |
| --------- | -------------------- | --------- |
| **Application health & sync status** | ArgoCD API (per environment instance) | Reflects actual deployed state, not desired state |
| **Container image tags** | ArgoCD API — `status.summary.images` | Authoritative for running workload; avoids registry auth complexity |
| **CPU & memory metrics** | Prometheus via Azure Monitor Workspace | Centralised; all six clusters push metrics here |
| **Namespace & pod-level metrics** | Prometheus via Azure Monitor Workspace | Avoid direct Kubernetes Metrics Server queries |
| **Network policy state** | Kubernetes API (unavoidable — no Prometheus equivalent) | K8s API is only viable source for NetworkPolicy objects |

> **Infrastructure readiness**: The Azure Monitor Workspace is already deployed and receiving node and workload metrics from all 6 AKS clusters. All three ArgoCD instances are operational with 850+ applications.

### 3.5 Secret Management

All connector credentials — ArgoCD service account tokens, Azure Monitor Workspace query keys, and Kubernetes service account tokens — are stored in Azure Key Vault. External Secrets Operator (ESO) synchronises them into Kubernetes Secrets within the dashboard namespace at deploy time. Connectors consume credentials exclusively via mounted environment variables; no credentials are embedded in container images or ConfigMaps.

| Credential | Storage | Injection |
| ---------- | ------- | --------- |
| **ArgoCD tokens** (one per env instance) | Azure Key Vault (`argocd-{env}-token`) | ESO → K8s Secret → env var `ARGOCD_TOKEN` |
| **Azure Monitor Workspace credentials** | Azure Key Vault | ESO → K8s Secret → env vars `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` |
| **K8s API access** (network-connector only) | In-cluster ServiceAccount | Minimal ClusterRole scoped to NetworkPolicy reads |

### 3.6 Authentication Model

- **Dashboard access**: SSO/OIDC via the organisation's Azure AD tenant. Any authenticated user can view all dashboard data.
- **Tenancy model**: Soft tenancy. No per-team or per-namespace access restrictions. All authenticated users see the same data.
- **Network restriction**: Dashboard is only accessible on private internal networks. No public internet exposure.

### 3.7 Logical Architecture

```
                        ┌────────────────────────┐
                        │   React 18 Frontend    │
                        │  (TypeScript / Vite)   │
                        │  Auto-generated API    │
                        │  clients from specs    │
                        └──────────┬─────────────┘
                                   │ REST (OpenAPI)
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
          ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
          │   ArgoCD    │ │  Prometheus  │ │   Network    │
          │  Connector  │ │  Connector   │ │  Connector   │
          │  (×3 envs)  │ │  (×1 shared) │ │  (×6 clust.) │
          │  FastAPI    │ │  FastAPI     │ │  FastAPI     │
          └──────┬──────┘ └──────┬───────┘ └──────┬───────┘
                 │               │                │
          ┌──────▼──────┐ ┌──────▼───────┐ ┌──────▼───────┐
          │  ArgoCD API │ │ Azure Monitor│ │  K8s API     │
          │  (×3 inst.) │ │  Workspace   │ │  (NetPol     │
          │             │ │  (Prometheus)│ │   reads only)│
          └─────────────┘ └──────────────┘ └──────────────┘

          ┌─────────────────────────────────────────────────┐
          │  Redis (in-cluster, no persistence,             │
          │         per-connector TTLs)                     │
          └─────────────────────────────────────────────────┘

          ┌─────────────────────────────────────────────────┐
          │  External Secrets Operator → Azure Key Vault     │
          └─────────────────────────────────────────────────┘
```

---

## 4. Technical Specifications

### 4.1 Connector Architecture Principles

- **Language & runtime**: Python 3.14 across all connectors.
- **Framework**: FastAPI with Pydantic v2 request/response models on all HTTP endpoints.
- **Deployment**: Each connector is a separate container image, deployed as an independent Kubernetes Deployment in the dashboard namespace on the DEV East US cluster.
- **OpenAPI spec**: Each service auto-exposes `/openapi.json`; the spec is also committed to the monorepo as the source-of-truth artifact per OpenSpec.
- **No shared state**: Connectors may not import from each other; cross-connector aggregation happens in the React frontend.
- **Caching**: Each connector maintains its own Redis client with TTL values defined per endpoint.
- **Secrets**: All credentials injected via environment variables populated by External Secrets Operator from Azure Key Vault. No credentials in images or ConfigMaps.
- **Kubernetes API avoidance**: Connectors MUST NOT query the Kubernetes API directly for metrics or application state. The only permitted K8s API usage is the network-connector reading NetworkPolicy objects.
- **Structured logging**: All connectors use `structlog` with JSON output.

### 4.2 Connector Inventory

| Connector | Upstream Source | Instances | Data Served | TTL |
| --------- | -------------- | --------- | ----------- | --- |
| **argocd-connector** | ArgoCD REST API | 1 per env (×3) | App health, sync status, image tags per env+cluster | 30 s |
| **prometheus-connector** | Azure Monitor Workspace (Prometheus API) | 1 (shared) | CPU, memory, pod & namespace metrics for all envs | 60 s |
| **network-connector** | Kubernetes API (NetworkPolicy only) | 1 per cluster (×6) | Namespace network policy state | 120 s |

### 4.3 ArgoCD Connector

Three instances deployed — one per environment. Each instance is configured at deploy time with the environment label (DEV, STAGE, or PROD) and the corresponding ArgoCD server URL and service account token.

#### Configuration (per instance)

| Env Var | Example (DEV instance) | Source |
| ------- | ---------------------- | ------ |
| `ARGOCD_ENV` | `DEV` | Deployment manifest (static) |
| `ARGOCD_SERVER_URL` | `https://argocd-dev.platform.internal` | Deployment manifest |
| `ARGOCD_TOKEN` | `<injected>` | External Secrets → Azure Key Vault |

#### Key Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/apps` | Lists all ArgoCD Application resources for this instance's environment, with cluster (East/West) and region context. |
| GET | `/apps/{name}` | Returns health, sync status, and image summary for a single application. |
| GET | `/apps/{name}/images` | Returns parsed container image tags from `status.summary.images`. |
| GET | `/health` | Liveness probe; verifies ArgoCD API reachability. |

#### ArgoCD API Usage Notes

- **Authentication**: Long-lived service account token via `ARGOCD_TOKEN`.
- **Image tag extraction**: Prefer `status.summary.images` (ArgoCD 2.x). Fall back to `spec.source.helm.values` image key parsing only if summary is unavailable.
- **Cluster routing**: Use `dest.server` field on each Application to determine East US vs West US cluster.
- **Scope**: ArgoCD App status and image data only. No manifest diffs, no YAML content.

**Scale consideration**: With 850+ applications across 3 environments, the `/apps` endpoint must handle responses with hundreds of application records per environment. Pagination or streaming may be needed depending on ArgoCD API response characteristics.

### 4.4 Prometheus Connector

A single instance queries the Azure Monitor Workspace, which receives Prometheus metrics from all six AKS clusters.

#### Configuration

| Env Var | Example | Source |
| ------- | ------- | ------ |
| `AZURE_MONITOR_ENDPOINT` | `https://<workspace>.prometheus.monitor.azure.com` | Deployment manifest |
| `AZURE_CLIENT_ID` | `<managed identity or app registration>` | External Secrets → Key Vault |
| `AZURE_CLIENT_SECRET` | `<injected>` | External Secrets → Key Vault |

#### Key Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/metrics/cpu` | CPU usage (pod and namespace) filtered by environment and cluster labels. |
| GET | `/metrics/memory` | Memory usage (pod and namespace) filtered by environment and cluster labels. |
| GET | `/metrics/namespace-quota` | Namespace resource quota utilisation. |
| GET | `/health` | Liveness probe; verifies Azure Monitor Workspace reachability. |

#### Query Strategy

All PromQL queries MUST include label filters for environment and cluster region to scope results correctly. The connector is the single query point for all six clusters; label-based scoping within PromQL replaces the need for per-cluster connector instances.

### 4.5 Network Connector

Six instances deployed — one per AKS cluster. Each uses an in-cluster Kubernetes ServiceAccount with a minimal ClusterRole scoped to read NetworkPolicy objects. This is the only connector permitted to query the Kubernetes API directly, as NetworkPolicy data has no Prometheus equivalent.

#### Key Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/network/policies` | Returns all NetworkPolicy objects in scope for this cluster's dashboard namespaces. |
| GET | `/network/namespaces/{ns}/status` | Network isolation status for a specific namespace; flags open egress. |
| GET | `/health` | Liveness probe. |

### 4.6 Degraded State Behaviour

Connectors must handle upstream unavailability gracefully:

| Scenario | Dashboard Behaviour |
| -------- | ------------------- |
| **ArgoCD instance unreachable** | Affected environment columns show "Unknown" status with last successful refresh timestamp. Other environments render normally. |
| **Azure Monitor Workspace unreachable** | Metrics module shows "Unavailable" with last refresh timestamp. App status and network modules unaffected. |
| **AKS cluster unreachable** (network-connector) | Affected cluster's network status shows "Unknown" with last refresh timestamp. Other clusters render normally. |
| **Redis unavailable** | Connectors fall through to live upstream fetch on every request. Increased latency but no data loss. |

### 4.7 Redis Cache Policy

Redis is used exclusively as a throwaway in-memory cache. No disk persistence is enabled. Cache misses result in a live upstream fetch.

| Connector | Data Type | TTL | Cache Miss Behaviour |
| --------- | --------- | --- | -------------------- |
| **argocd-connector** (×3) | App status, sync, images per env+cluster | 30 s | Live ArgoCD API fetch |
| **prometheus-connector** | CPU / memory / quota metrics | 60 s | Live Azure Monitor Workspace PromQL query |
| **network-connector** (×6) | NetworkPolicy objects per cluster | 120 s | Live Kubernetes API fetch |

---

## 5. Frontend Specification

### 5.1 Technology Stack

| Component | Choice | Notes |
| --------- | ------ | ----- |
| **Framework** | React 18 + TypeScript (strict mode) | Team has no React experience; agent-generated components from OpenAPI specs minimise hand-written TS |
| **API Clients** | Auto-generated TypeScript (`openapi-typescript-codegen`) | Generated from approved OpenSpec specs; team does not write raw API calls |
| **State Management** | React Query v5 | Auto-polling aligned to per-connector Redis TTLs |
| **Styling** | Tailwind CSS + shadcn/ui | Consistent component library; agent scaffolding friendly |
| **Charts** | Recharts | CPU, memory time-series sparklines |
| **Build Tool** | Vite | Fast dev server; Docker image production build |

### 5.2 Environment and Region Navigation

Two global filter controls visible on all modules:

- **Environment selector**: DEV / STAGE / PROD (default: all three shown simultaneously for promotion comparison).
- **Region selector**: East US / West US / Both (default: Both).

Filters are applied client-side against data already returned by connectors. Connector API responses always include environment and region labels so the frontend can filter without additional round trips.

### 5.3 Dashboard Modules

#### Module 1 — ArgoCD Application Status

- Displays health and sync state for all ArgoCD Applications across all three environments and both regions.
- Grouped view: rows are applications, columns are environments (DEV / STAGE / PROD), with East/West sub-columns. Each cell shows the health/sync badge.
- Visual indicators: green (Healthy/Synced), amber (Degraded/OutOfSync), red (Unknown/Error).
- Supports text search to filter applications by name.
- No manifest diffs, no YAML display. Health and sync status summaries only.

#### Module 2 — Image Promotion View

- Shows deployed container image tag per application at each step of the promotion pipeline (DEV-East → DEV-West → STAGE-East → STAGE-West → PROD-East → PROD-West).
- Data sourced exclusively from ArgoCD API (`status.summary.images`) via argocd-connector instances.
- Highlights tag mismatches across adjacent steps (e.g., DEV-East on v1.3.1 but DEV-West still on v1.3.0).
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

### 5.4 Data Freshness Indicators

Every module displays a "Last updated" timestamp sourced from the connector response metadata. When a data source is unreachable, the module shows:

- Status: "Unknown" or "Unavailable"
- Last successful refresh: timestamp
- No error stack traces or technical details exposed to users

---

## 6. Development Methodology — OpenSpec

This project follows the [OpenSpec](https://github.com/Fission-AI/OpenSpec) API-first standard. OpenAPI 3.1 specification files are the canonical source of truth. All FastAPI stubs, frontend API clients, and integration test scaffolds are generated from approved specs. No connector endpoint may be implemented before its spec has been reviewed and merged.

### 6.1 Team Profile and Tooling Choices

| Concern | Decision | Rationale |
| ------- | -------- | --------- |
| **Backend language** | Python 3.14 (FastAPI) | Team's primary language; full proficiency |
| **Frontend language** | TypeScript (React) | Required for dashboard quality; clients auto-generated from specs — team writes no raw TS |
| **Frontend API layer** | Auto-generated from OpenAPI specs | Eliminates manual TS API client work |
| **Agent-assisted development** | OpenSpec AI agents for stub and scaffold generation | Reduces burden for boilerplate; Python logic is the only hand-written code |

### 6.2 Proposal Lifecycle

Each connector microservice corresponds to a discrete OpenSpec proposal. The lifecycle gates implementation behind spec approval:

1. **Draft** — Author writes the OpenAPI 3.1 YAML. Paths, schemas, error codes, and `x-cache-ttl` extension fields defined. No code yet.
2. **Review** — PR opened. OpenSpec AI tooling validates completeness. Human reviewer approves.
3. **Approved** — Spec merged to main. This is the gate event. Code generation may now begin.
4. **Generated** — FastAPI Python 3.14 stubs generated. Frontend TS clients regenerated. Generated files committed; must not be hand-edited.
5. **Implemented** — Team fills business logic into generated stubs. Microservice containerised.
6. **Verified** — Generated integration tests pass against the running container. Proposal closed.

Amendments to an approved spec that change response schemas require a new Draft cycle and a major version increment.

### 6.3 Agent Assistance Options

Within each OpenSpec proposal, the development team has two options for the Generated and Implemented stages. The choice is made per-proposal and recorded in the proposal document:

| Option | Description | When to Use |
| ------ | ----------- | ----------- |
| **Scaffold only** | Agent generates FastAPI stubs with empty function bodies and full type annotations. Developer writes all business logic. | Developer wants full control; straightforward integrations where the API interaction is well understood. |
| **Agent-implemented** | Agent generates stubs and completes the business logic, including API client calls, error handling, and caching. Developer reviews and accepts. | Complex integrations (e.g., multi-env ArgoCD fan-out, Prometheus query construction); developer reviews output rather than writing from scratch. |

### 6.4 Spec Governance

- All specs live in the platform monorepo under `/specs/<connector-name>/openapi.yaml`.
- Breaking changes require a version bump and migration plan.
- Spec reviews are mandatory before any code generation step proceeds.

---

## 7. Security & Privacy

| Concern | Approach |
| ------- | -------- |
| **Authentication** | SSO/OIDC via Azure AD. Valid token from the org Azure tenant required. |
| **Authorization** | Soft tenancy — no per-team access restrictions. All authenticated users see all data. |
| **Network exposure** | Dashboard available on private internal networks only. No public endpoints. |
| **Credential storage** | All secrets in Azure Key Vault, injected via External Secrets Operator. No secrets in images, ConfigMaps, or environment file literals. |
| **Data sensitivity** | Dashboard displays operational metadata (app names, health status, image tags, resource metrics). No PII, no customer data, no secrets displayed. |
| **Non-mutating** | Dashboard performs read-only queries against all data sources. No write, update, or delete operations. |
| **ArgoCD token scope** | Service account tokens scoped to read-only API access per environment instance. |
| **K8s ServiceAccount scope** | network-connector ServiceAccount limited to ClusterRole with NetworkPolicy read-only permissions. |

---

## 8. Non-Functional Requirements

| Category | Requirement |
| -------- | ----------- |
| **Runtime** | Python 3.14 — all connector microservices |
| **Framework** | FastAPI — all connector HTTP interfaces |
| **API Standard** | OpenSpec — specs are source of truth |
| **Environments** | DEV, STAGE, PROD — each with a dedicated ArgoCD instance |
| **Clusters** | 6 AKS clusters total (2 regions × 3 environments) |
| **Application scale** | 850+ ArgoCD Applications across all environments |
| **Dashboard deployment** | DEV East US cluster (`aks-dev-eastus`) |
| **Tier classification** | Tier II — important but not critical |
| **ArgoCD source of truth** | Deployed image tags and app state sourced from ArgoCD API only |
| **Metrics source of truth** | All resource metrics sourced from Prometheus via Azure Monitor Workspace only |
| **K8s API restriction** | Direct K8s API queries permitted only for NetworkPolicy reads |
| **Authentication** | SSO/OIDC via Azure AD; soft tenancy (all authenticated users see all data) |
| **Network access** | Private internal network only; no public internet exposure |
| **Secret management** | External Secrets Operator + Azure Key Vault for all credentials |
| **Observability** | Structured JSON logs (`structlog`); Prometheus `/metrics` on each connector |
| **Scalability** | Connectors support HPA; scale-to-zero on idle |
| **Data residency** | No PII stored; no data written to disk; Redis in-cluster only |
| **Graceful degradation** | Unreachable sources shown as "Unknown" with last refresh timestamp; remaining data unaffected |

---

## 9. Risks & Roadmap

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| **ArgoCD API rate limiting** under 850+ app queries | Medium | High | Redis caching (30s TTL) reduces query frequency. Implement pagination. Monitor ArgoCD API response times during pilot. |
| **Azure Monitor Workspace query latency** for 6-cluster fan-out | Medium | Medium | PromQL queries scoped by label (not per-cluster fan-out). Cache results at 60s TTL. Pre-aggregate where possible. |
| **Team lacks React experience** | High | Medium | Auto-generated TS API clients from OpenAPI specs. Agent-assisted React component scaffolding. shadcn/ui component library reduces custom CSS. |
| **Network connectivity from DEV cluster** to STAGE/PROD ArgoCD instances | Low | High | Verify network routes during Phase 0. Graceful degradation shows "Unknown" status. |
| **Stale data displayed without user awareness** | Medium | Medium | Every module displays last-refresh timestamp. "Unknown" state for unreachable sources. |
| **Single point of failure** (dashboard in DEV cluster only) | Low | Low | Acceptable for Tier II application. Document in runbook. Re-evaluate post-MVP if adoption warrants higher availability. |

### Phased Rollout

Each phase is gated by approval of its OpenSpec proposals. No code generation or implementation work may begin for a given proposal until it has been reviewed and merged. The completed scope of all phases constitutes the MVP.

| Phase | Scope | Deliverables | Gate Condition |
| ----- | ----- | ------------ | -------------- |
| **Phase 0** (Weeks 1–3) | No proposals. Proposal template and review process established. | Repo scaffold. External Secrets / Key Vault wiring. ArgoCD API access verified for all 3 instances. Working dashboard mockup deployable as a Docker container (React static UI with mock data representing all 3 envs and 2 regions, no live connectors). Mockup is the visual contract for subsequent work. | Mockup Docker image builds and runs locally. Stakeholder sign-off on env/region layout. Proposal template merged to main. |
| **Phase 1** (Weeks 4–6) | PROP-01: argocd-connector API surface (env-parameterised). PROP-02: Frontend module contract (app status + image promotion view). | Three argocd-connector instances (DEV/STAGE/PROD). React modules 1 & 2 wired to live connector data. Promotion pipeline view operational. | PROP-01 and PROP-02 approved. Generated tests pass. All 3 ArgoCD environments visible with correct East/West cluster routing. |
| **Phase 2** (Weeks 7–9) | PROP-03: prometheus-connector API surface (multi-env label filtering). | prometheus-connector wired to Azure Monitor Workspace. React module 3 (CPU/Memory) operational across all environments and regions. Redis cache layer with per-connector TTL policy. | PROP-03 approved. Prometheus connector returns correctly labelled metrics for all 6 clusters. Module 3 renders live data with env/region filter. |
| **Phase 3** (Weeks 10–12) | PROP-04: network-connector API surface (per-cluster). | Six network-connector instances (one per AKS cluster). React module 4 (Network Status) operational. All connectors deployed via ArgoCD with ESO-managed secrets. | PROP-04 approved. All 6 network-connector instances pass generated integration tests. Module 4 renders live NetworkPolicy data filterable by env and region. |
| **Phase 4** (Weeks 13–15) | No new proposals. Spec-conformance validation run. | End-to-end integration tests across all environments and regions. Performance hardening. Spec-conformance gate. Internal pilot rollout to early-adopter tenants. | All connectors pass spec-conformance check. P95 load time < 3 s. Pilot tenant group onboarded. |

> **Post-MVP**: Additional features (RBAC refinement, alerting integration, additional data sources) will be evaluated based on pilot feedback and tracked as separate proposals.

---

## 10. Resolved Decisions

| Topic | Decision |
| ----- | -------- |
| **ArgoCD API authentication** | Long-lived service account tokens (one per environment). Stored in Azure Key Vault, injected via ESO. |
| **Manifest diff display** | Dashboard summarises health and sync status only. No manifest diffs, no YAML display. |
| **Azure Container Apps** | Out of scope. Dashboard covers AKS workloads (ArgoCD Applications) only. |
| **Rollout order** | Per-region: East US before West US within each environment tier. Full order: DEV-E → DEV-W → STAGE-E → STAGE-W → PROD-E → PROD-W. |
| **Kubernetes API usage** | Strictly limited to NetworkPolicy reads (network-connector). All other data from ArgoCD API or Prometheus. |
| **Dashboard deployment target** | DEV East US cluster (`aks-dev-eastus`). |
| **Tenancy model** | Soft tenancy via SSO/OIDC. No per-team access restrictions. |
| **Tier classification** | Tier II — important but not critical. No formal SLAs. |
| **Mutability** | Non-mutating. Read-only queries only. All writes through existing CI/CD and ArgoCD. |
| **Network access** | Private internal network only. |

---

## 11. Open Questions

| # | Question | Needed For | Status |
| - | -------- | ---------- | ------ |
| 1 | What are the exact Prometheus label names used to identify environment (DEV/STAGE/PROD) and region (eastus/westus) in the Azure Monitor Workspace? | PROP-03 spec drafting | Open |
| 2 | Are the six AKS clusters accessible from the DEV cluster's network, or does the network-connector need to be deployed into each cluster separately? | PROP-04 architecture and deployment model | Open |
| 3 | Are tenant applications grouped into ArgoCD AppProjects per environment? | PROP-01 `/apps` endpoint filtering logic | Open |
| 4 | Should the East/West region selector persist across browser sessions (localStorage) or be ephemeral? | PROP-02 frontend spec | Open |
| 5 | What is the expected rotation cadence for ArgoCD service account tokens? Does ESO need a rotation trigger? | Security operations | Open |
| 6 | What is the ArgoCD API pagination behaviour for environments with hundreds of applications? | PROP-01 performance design | Open |

---

## 12. Glossary

| Term | Definition |
| ---- | ---------- |
| **ArgoCD** | GitOps continuous delivery tool for Kubernetes. Three separate instances in this platform: argocd-dev, argocd-stage, argocd-prod. |
| **AKS** | Azure Kubernetes Service. Six clusters total: `aks-{env}-{eastus\|westus}` for each of DEV, STAGE, PROD. |
| **Azure Monitor Workspace** | Centralised Prometheus-compatible metrics store. All six AKS clusters push Prometheus metrics here. |
| **ESO** | External Secrets Operator — synchronises secrets from Azure Key Vault into Kubernetes Secrets at deploy time. |
| **FastAPI** | Python async web framework used for all connector microservices. |
| **OpenSpec** | API-first development standard (github.com/Fission-AI/OpenSpec). OpenAPI specs are the source of truth; code is generated from them. |
| **Promotion pipeline** | The ordered sequence DEV-East → DEV-West → STAGE-East → STAGE-West → PROD-East → PROD-West through which a release progresses. |
| **Soft tenancy** | Access model where all authenticated users share the same view. No per-team data isolation. |
| **TTL** | Time-to-live — Redis cache expiry duration per data type. |
| **`dest.server`** | ArgoCD Application field identifying the target cluster URL; used to route applications to the correct regional AKS cluster. |
| **`status.summary.images`** | ArgoCD Application status field listing container images deployed to the workload. Authoritative source for image tag data. |
