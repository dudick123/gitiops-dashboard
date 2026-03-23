# Product Requirements Document: GitOps Platform Dashboard

## Unified Observability Interface for ArgoCD, Prometheus, and Kubernetes NetworkPolicy

| Field                 | Value                                                        |
| --------------------- | ------------------------------------------------------------ |
| **Version**           | 2.1                                                          |
| **Status**            | Draft                                                        |
| **Date**              | 2026-03-22                                                   |
| **Owner**             | Platform Engineering Team                                    |
| **Target Audience**   | Platform Tenants (Dev, SRE, Security, Leadership)            |
| **Review Cycle**      | Sprint-aligned (bi-weekly)                                   |
| **Related Standards** | OpenSpec — github.com/Fission-AI/OpenSpec                    |
| **Related PRDs**      | PRD-v2-gitops-pipelines.md (Azure DevOps pipeline templates) |
| **Related Standards** | docs/TECH-STANDARDS.md (development conventions, tooling, and CI rules) |

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
| **ArgoCD data freshness** | ≤ 30 min stale | Redis TTL audit |
| **Prometheus metrics freshness** | ≤ 30 min stale | Redis TTL audit |
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

#### Project Scoping

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| PS-01 | As a **tenant developer**, I want to select my ArgoCD project before viewing dashboard details so that I only see data relevant to my team's workloads. | A persistent project scope selector is visible on all modules. Selecting a project filters all downstream modules to that project's ApplicationSets, Applications, namespaces, metrics, and network data. |
| PS-02 | As an **engineering leader**, I want a platform-wide view that shows aggregated data across all projects so that I can assess overall platform health without selecting a specific project. | An "All Projects" option in the project selector renders the platform-level rollup view. This is the default landing state. |
| PS-03 | As a **tech lead**, I want the project selector to resolve to the correct Kubernetes namespace(s) automatically so that metrics and network data are scoped without manual namespace entry. | Selecting an ArgoCD project automatically resolves to its target namespace(s) via the ArgoCD project spec's `destinations` field. All downstream modules use the resolved namespace(s) for filtering. |
| PS-04 | As a **tenant developer**, I want my project selection to persist across browser sessions so that I don't have to re-select my project each time I open the dashboard. | Project selection is stored in `localStorage` and restored on page load. A "clear" action resets to "All Projects." |

#### Application Status

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| AS-01 | As a **tenant developer**, I want to see my application's health and sync status across all environments on one screen so that I don't need to log into three ArgoCD instances. | Dashboard displays health (Healthy/Degraded/Unknown) and sync (Synced/OutOfSync/Error) for each app across DEV, STAGE, PROD with East/West sub-columns. When a project is selected, only Applications belonging to that project are shown. |
| AS-02 | As a **tech lead**, I want to filter applications by name or team so that I can focus on my team's services. | Text search filters the application list in real time. Search operates within the current project scope. |
| AS-03 | As a **tenant developer**, I want to see when data was last refreshed so that I know if I'm looking at stale information. | Each data section displays a "Last updated" timestamp. If a source is unreachable, the section shows "Unknown" status with the last successful refresh time. |
| AS-04 | As a **tech lead**, I want to see ApplicationSets and their generated Applications grouped together so that I can understand the relationship between my templates and the deployed instances. | When a project is selected, ApplicationSets are displayed as parent rows with their child Applications nested underneath. Each child shows its target environment and region. In "All Projects" mode, ApplicationSets are not expanded (only the flat Application list is shown). |

#### Image Promotion

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| IP-01 | As a **tech lead**, I want to see which image tag is deployed at each stage of the promotion pipeline for a given application so that I can confirm promotions completed correctly. | Promotion view shows tag per step: DEV-East → DEV-West → STAGE-East → STAGE-West → PROD-East → PROD-West. When a project is selected, only that project's Applications are shown in the promotion grid. |
| IP-02 | As a **tech lead**, I want mismatched tags between pipeline steps highlighted so that stalled or failed promotions are immediately visible. | Cells with tag mismatches between adjacent steps are visually flagged (amber highlight). |
| IP-03 | As a **security auditor**, I want non-semver image tags flagged so that I can identify images that may not follow the approved release process. | Tags not matching semver pattern display a warning indicator. |

#### Metrics

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| MT-01 | As an **SRE**, I want to see CPU and memory usage by namespace and pod, filterable by environment and region, so that I can spot resource pressure without opening the Azure portal. | In "All Projects" mode, metrics module displays CPU/memory at namespace level, filterable by environment (DEV/STAGE/PROD) and region (East/West). When a project is selected, metrics display at Deployment, StatefulSet, and Job level within the project's namespace(s). |
| MT-02 | As an **SRE**, I want trend sparklines so that I can see directional changes at a glance. | Sparkline charts show the last 10 polling intervals of data (~5 hours at 30-minute refresh). In project-scoped mode, sparklines are shown per workload (Deployment/Job). |
| MT-03 | As a **tenant developer**, I want to see namespace resource quota utilisation so that I know how close my namespace is to its limits. | Namespace quota utilisation bar displayed alongside raw usage values. In project-scoped mode, the quota section shows quota for the project's resolved namespace(s) only. |
| MT-04 | As a **tenant developer**, I want to see request/limit ratios and OOM events for my specific Deployments so that I can right-size my workloads. | In project-scoped mode, each Deployment/StatefulSet/Job row shows: current request/limit ratio, 7-day max request/limit ratio, current quota usage, 7-day max quota, and OOM kill count (7-day). Container-level breakdown is available as a drill-down. |
| MT-05 | As an **SRE**, I want OOM events attributed to specific containers so that I can identify which sidecar or main process is causing memory pressure. | OOM event log shows pod name, container name, memory at kill vs limit, and timestamp. In project-scoped mode, only OOM events for the selected project's namespace(s) are shown. |

#### Network Status

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| NS-01 | As a **security auditor**, I want to see active NetworkPolicy objects per namespace so that I can verify network isolation is enforced. | Network module lists NetworkPolicy objects per namespace, filterable by environment and cluster. In project-scoped mode, only policies for the project's namespace(s) are shown. |
| NS-02 | As a **security auditor**, I want namespaces with no egress restriction flagged so that I can identify gaps in network policy coverage. | Namespaces with open egress display a warning badge. |
| NS-03 | As a **tenant developer**, I want to see Cilium L3/L4 flow drops and TCP resets involving my namespace so that I can diagnose connectivity issues without access to Hubble CLI. | In project-scoped mode, the Cilium flow summary and denied connections log are filtered to traffic where the selected namespace is either source or destination. Drop counts, reset counts, and policy verdicts are shown per source/dest pair. |
| NS-04 | As a **security auditor**, I want to see which specific connections are being denied by NetworkPolicies so that I can verify policies are working as intended and identify missing allow rules. | Denied connections table shows direction, source namespace, destination namespace, protocol, port, drop count, reset count, cluster, and the policy verdict that caused the deny. |

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
| **DEV** | argocd-dev | aks-dev-eastus | aks-dev-westus | `https://argocd-dev.platform.internal` |
| **STAGE** | argocd-stage | aks-stage-eastus | aks-stage-westus | `https://argocd-stage.platform.internal` |
| **PROD** | argocd-prod | aks-prod-eastus | aks-prod-westus | `https://argocd-prod.platform.internal` |

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

```text
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
- **API documentation (Swagger)**: Each service exposes interactive Swagger UI at `/docs` and ReDoc at `/redoc` (FastAPI built-in). The underlying OpenAPI 3.1 spec is served at `/openapi.json`. Swagger UI is the primary interface for developers to explore, understand, and test connector APIs during development and integration. The spec is also committed to the monorepo as the source-of-truth artifact per OpenSpec.
- **No shared state**: Connectors may not import from each other; cross-connector aggregation happens in the React frontend.
- **Caching**: Each connector maintains its own Redis client with TTL values defined per endpoint.
- **Secrets**: All credentials injected via environment variables populated by External Secrets Operator from Azure Key Vault. No credentials in images or ConfigMaps.
- **Kubernetes API avoidance**: Connectors MUST NOT query the Kubernetes API directly for metrics or application state. The only permitted K8s API usage is the network-connector reading NetworkPolicy objects.
- **Structured logging**: All connectors use `structlog` with JSON output.

### 4.2 Connector Inventory

| Connector | Upstream Source | Instances | Data Served | TTL |
| --------- | -------------- | --------- | ----------- | --- |
| **argocd-connector** | ArgoCD REST API | 1 per env (×3) | App health, sync status, image tags per env+cluster | 30 min |
| **prometheus-connector** | Azure Monitor Workspace (Prometheus API) | 1 (shared) | CPU, memory, pod & namespace metrics for all envs | 30 min |
| **network-connector** | Kubernetes API (NetworkPolicy only) | 1 per cluster (×6) | Namespace network policy state | 30 min |

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
| GET | `/projects` | Lists all ArgoCD AppProject resources for this instance's environment. Returns project name, description, permitted destinations (clusters and namespaces), and source repos. Used to populate the project scope selector. |
| GET | `/projects/{project}` | Returns detail for a single AppProject, including resolved destination namespaces across clusters. |
| GET | `/apps` | Lists all ArgoCD Application resources for this instance's environment, with cluster (East/West) and region context. Supports optional `?project={name}` query parameter to filter by ArgoCD project. |
| GET | `/apps/{name}` | Returns health, sync status, and image summary for a single application. |
| GET | `/apps/{name}/images` | Returns parsed container image tags from `status.summary.images`. |
| GET | `/appsets` | Lists all ArgoCD ApplicationSet resources for this instance's environment. Supports optional `?project={name}` query parameter. Returns ApplicationSet name, generator type, template, and the list of generated Application names. |
| GET | `/appsets/{name}` | Returns detail for a single ApplicationSet, including its generated Applications with their target environments and regions. |
| GET | `/health` | Liveness probe; verifies ArgoCD API reachability. |

#### ArgoCD API Usage Notes

- **Authentication**: Long-lived service account token via `ARGOCD_TOKEN`.
- **Image tag extraction**: Prefer `status.summary.images` (ArgoCD 2.x). Fall back to `spec.source.helm.values` image key parsing only if summary is unavailable.
- **Cluster routing**: Use `dest.server` field on each Application to determine East US vs West US cluster.
- **Project scoping**: The `project` query parameter maps to the ArgoCD `spec.project` field on Application and ApplicationSet resources. When provided, the connector filters at the API query level (ArgoCD supports `?project=` natively), avoiding client-side filtering of large result sets.
- **Project → Namespace resolution**: The `/projects/{project}` endpoint returns the project's `spec.destinations` list, which defines the permitted namespace(s) per cluster. The frontend uses this to resolve a project selection into namespace(s) for Prometheus and Network connector queries.
- **ApplicationSet → Application relationship**: The `/appsets/{name}` endpoint returns the ApplicationSet's generated Application names. The frontend uses this to render the parent/child hierarchy in the App Status grid.
- **Scope**: ArgoCD App/AppSet status and image data only. No manifest diffs, no YAML content.

**Scale consideration**: With 850+ applications across 3 environments, the `/apps` endpoint must handle responses with hundreds of application records per environment. The `?project=` filter reduces response size significantly for project-scoped views. Pagination or streaming may be needed for the unfiltered "All Projects" view depending on ArgoCD API response characteristics.

### 4.4 Prometheus Connector

A single instance queries the Azure Monitor Workspace, which receives Prometheus metrics from all six AKS clusters.

#### Configuration

| Env Var | Example | Source |
| ------- | ------- | ------ |
| `AZURE_MONITOR_ENDPOINT` | `https://<workspace>.prometheus.monitor.azure.com` | Deployment manifest |
| `AZURE_CLIENT_ID` | `<managed identity or app registration>` | External Secrets → Key Vault |
| `AZURE_CLIENT_SECRET` | `<injected>` | External Secrets → Key Vault |

#### Prometheus Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/metrics/cpu` | CPU usage filtered by environment and cluster labels. Supports optional `?namespace={ns}` to scope to a specific namespace. When namespace is provided, returns Deployment/StatefulSet/Job-level breakdown instead of namespace aggregates. |
| GET | `/metrics/memory` | Memory usage filtered by environment and cluster labels. Supports optional `?namespace={ns}` for workload-level breakdown. |
| GET | `/metrics/namespace-quota` | Namespace resource quota utilisation. Supports optional `?namespace={ns}` to return quota for a single namespace. |
| GET | `/metrics/request-limit` | Request/limit ratios for CPU and memory. When `?namespace={ns}` is provided, returns per-Deployment/StatefulSet/Job ratios including current value and 7-day max. Without namespace filter, returns namespace-level aggregates. |
| GET | `/metrics/ooms` | OOM kill events. When `?namespace={ns}` is provided, returns OOM events for that namespace with pod name, container name, memory at kill, limit, and timestamp. Without namespace filter, returns namespace-level OOM counts. |
| GET | `/metrics/cilium/drops` | Cilium L3/L4 drop counts from Hubble metrics (`hubble_drop_total`). Supports `?namespace={ns}` to filter to drops where namespace is source or destination. Returns ingress drops, egress drops, and TCP resets aggregated by source/dest namespace pair. |
| GET | `/metrics/cilium/flows` | Cilium denied flow log from Hubble metrics. Supports `?namespace={ns}` to scope. Returns top denied connections grouped by source/dest pair with direction, protocol, port, drop count, reset count, and policy verdict. |
| GET | `/health` | Liveness probe; verifies Azure Monitor Workspace reachability. |

#### Query Strategy

All PromQL queries MUST include label filters for environment and cluster region to scope results correctly. The connector is the single query point for all six clusters; label-based scoping within PromQL replaces the need for per-cluster connector instances.

When the `namespace` query parameter is provided, the connector shifts query granularity:

| Mode | Granularity | PromQL label strategy |
| ---- | ----------- | --------------------- |
| **Platform view** (no namespace) | Namespace-level aggregates | `sum by (namespace)` — groups across all workloads within each namespace |
| **Project view** (namespace provided) | Workload-level (Deployment, StatefulSet, Job) | `sum by (namespace, workload, workload_type)` — uses `kube_*` metric labels to identify individual workloads |

The Cilium flow endpoints query Hubble Prometheus metrics (`hubble_drop_total`, `hubble_flows_processed_total`) which are pushed to the same Azure Monitor Workspace by the Hubble relay running on each AKS cluster. These metrics include `source_namespace` and `destination_namespace` labels enabling namespace-scoped filtering.

### 4.5 Network Connector

Six instances deployed — one per AKS cluster. Each uses an in-cluster Kubernetes ServiceAccount with a minimal ClusterRole scoped to read NetworkPolicy objects. This is the only connector permitted to query the Kubernetes API directly, as NetworkPolicy data has no Prometheus equivalent.

#### Network Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/network/policies` | Returns all NetworkPolicy objects in scope for this cluster's dashboard namespaces. Supports optional `?namespace={ns}` to return policies for a single namespace only. |
| GET | `/network/namespaces/{ns}/status` | Network isolation status for a specific namespace; flags open egress. Returns policy names, ingress/egress rule summaries, and coverage assessment. |
| GET | `/health` | Liveness probe. |

> **Note on Cilium flow data**: Cilium L3/L4 drop and flow metrics are sourced from Prometheus via Hubble metrics (not from the Kubernetes API), and are therefore served by the prometheus-connector, not the network-connector. The network-connector is strictly limited to Kubernetes API reads for NetworkPolicy objects. See §4.4 Prometheus Endpoints for Cilium flow endpoints.

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
| **argocd-connector** (×3) | App status, sync, images per env+cluster | 30 min | Live ArgoCD API fetch |
| **prometheus-connector** | CPU / memory / quota metrics | 30 min | Live Azure Monitor Workspace PromQL query |
| **network-connector** (×6) | NetworkPolicy objects per cluster | 30 min | Live Kubernetes API fetch |

---

## 5. Frontend Specification

### 5.1 Technology Stack

| Component | Choice | Notes |
| --------- | ------ | ----- |
| **Framework** | React 18 + TypeScript (strict mode) | Team has no React experience; agent-generated components from OpenAPI specs minimise hand-written TS |
| **API Clients** | Auto-generated TypeScript (`openapi-typescript-codegen`) | Generated from approved OpenSpec specs; team does not write raw API calls |
| **State Management** | React Query v5 | Auto-polling at 30-minute intervals aligned to uniform Redis TTL |
| **Styling** | Tailwind CSS + shadcn/ui | Consistent component library; agent scaffolding friendly |
| **Charts** | Recharts | CPU, memory time-series sparklines |
| **Build Tool** | Vite | Fast dev server; Docker image production build |

### 5.2 Global Navigation and Project Scoping

Three persistent global filter controls are visible on all modules:

- **Project scope selector**: Dropdown listing all ArgoCD AppProjects. Default: "All Projects" (platform-wide view). Selecting a project scopes all downstream modules to that project's ApplicationSets, Applications, and resolved namespace(s). Selection persists in `localStorage` across sessions.
- **Environment selector**: DEV / STAGE / PROD (default: all three shown simultaneously for promotion comparison).
- **Region selector**: East US / West US / Both (default: Both).

The dashboard operates in two view modes determined by the project scope selector:

| Mode | Trigger | Behaviour |
| ---- | ------- | --------- |
| **Platform View** | "All Projects" selected (default) | All modules show aggregated, namespace-level data across the entire platform. App Status shows a flat Application list. Metrics show namespace-level bars. Network shows all namespaces. Intended for Engineering Leadership and platform-wide health checks. |
| **Project View** | A specific project selected | All modules scope to the selected project's Applications, ApplicationSets, and resolved namespace(s). App Status shows ApplicationSet → Application hierarchy. Metrics shift to Deployment/Job-level granularity. Network shows only policies and Cilium flows involving the project's namespace(s). Intended for Tenant Developers, Tech Leads, and SREs working on specific services. |

**Project → Namespace resolution**: When a project is selected, the frontend calls `/projects/{project}` on each argocd-connector instance to retrieve the project's `spec.destinations` list. The resolved namespace(s) are then passed as query parameters to the prometheus-connector and network-connector APIs. This resolution happens once on project selection and is cached client-side until the project selection changes.

Environment and region filters are applied client-side against data already returned by connectors. Connector API responses always include environment and region labels so the frontend can filter without additional round trips.

### 5.3 Dashboard Modules

#### Module 1 — ArgoCD Application Status

**Platform View (All Projects):**
- Displays health and sync state for all ArgoCD Applications across all three environments and both regions.
- Grouped view: rows are applications, columns are environments (DEV / STAGE / PROD), with East/West sub-columns. Each cell shows the health/sync badge.
- Visual indicators: green (Healthy/Synced), amber (Degraded/OutOfSync), red (Unknown/Error).
- Supports text search to filter applications by name.
- No manifest diffs, no YAML display. Health and sync status summaries only.

**Project View (specific project selected):**
- Scoped to Applications and ApplicationSets belonging to the selected ArgoCD project.
- ApplicationSets are displayed as collapsible parent rows. Each parent row shows the ApplicationSet name, generator type, and aggregate health (e.g., "5/6 Healthy").
- Child Applications are nested under their parent ApplicationSet, each showing per-environment, per-region health/sync status in the same grid layout.
- Applications not generated by an ApplicationSet are shown as standalone rows below the ApplicationSet groups.
- Text search operates within the project scope.

#### Module 2 — Image Promotion View

- Shows deployed container image tag per application at each step of the promotion pipeline (DEV-East → DEV-West → STAGE-East → STAGE-West → PROD-East → PROD-West).
- Data sourced exclusively from ArgoCD API (`status.summary.images`) via argocd-connector instances.
- Highlights tag mismatches across adjacent steps (e.g., DEV-East on v1.3.1 but DEV-West still on v1.3.0).
- Highlights non-semver tags as a warning indicator.
- No direct registry queries performed.
- In **Project View**, only Applications belonging to the selected project are shown. ApplicationSets are shown as group headers with their child Application tags underneath.

#### Module 3 — CPU & Memory Metrics

**Platform View (All Projects):**
- Namespace-level CPU/memory sourced from prometheus-connector (Azure Monitor Workspace).
- Namespace-level request/limit ratios (current and 7-day max).
- Namespace-level quota utilisation bars (current and 7-day max).
- Namespace-level OOM counts (7-day).
- Filterable by environment and region using global selectors.
- Trend sparklines for the last 10 polling intervals (~5 hours at 30-minute refresh) at namespace granularity.

**Project View (specific project selected):**
- Shifts to **workload-level granularity**: rows are Deployments, StatefulSets, and Jobs within the project's namespace(s).
- Each workload row shows: current CPU/memory usage, request/limit ratio (current and 7-day max), and OOM count (7-day).
- Container-level drill-down available per workload — shows per-container request/limit ratios for workloads with multiple containers (e.g., main process + sidecar).
- Namespace quota section shows quota for the project's resolved namespace(s) only, with current and 7-day max utilisation.
- OOM event log scoped to the project's namespace(s), showing pod, container, memory at kill, limit, and timestamp.
- Trend sparklines shown per workload.

#### Module 4 — Namespace Network Status

**Platform View (All Projects):**
- Renders active NetworkPolicy objects per namespace, sourced from network-connector (Kubernetes API).
- Flags namespaces with no egress restriction (open egress warning).
- Cilium L3/L4 flow drop summary across all namespaces (ingress drops, egress drops, TCP resets).
- Denied connections table showing top source/dest namespace pairs by drop volume.
- Filterable by environment and cluster/region.

**Project View (specific project selected):**
- Scoped to NetworkPolicy objects for the project's resolved namespace(s) only.
- Full policy detail: each policy shown with its ingress/egress rules, selectors, and ports.
- Cilium flow data filtered to traffic where the project's namespace is source or destination.
- Denied connections table scoped to the project's namespace — shows "what connections are my workloads failing on" rather than the full platform firehose.
- Drop rate sparklines for the project's namespace specifically.

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

### 6.2 OpenSpec Methodology Overview

OpenSpec is a spec-driven development methodology where machine-readable specifications are the single source of truth for all API contracts. The methodology enforces a strict ordering: **specification → review → generation → implementation → verification**. No implementation work may begin until the governing spec is approved.

#### Core Principles

- **Spec as contract**: OpenAPI 3.1 YAML files define every endpoint, schema, error code, and caching policy. These files are committed to the monorepo and version-controlled independently of implementation code.
- **Generation over authoring**: Backend stubs (FastAPI + Pydantic), frontend API clients (TypeScript), and integration test scaffolds are generated from specs. Generated code is committed but must not be hand-edited.
- **Change-centric workflow**: All work is organised around named "changes" — discrete units of work with structured artifacts (proposal, design, spec, tasks) that progress through a defined lifecycle.
- **Human-gated transitions**: Spec approval requires human review. The agent assists with generation and implementation; the human owns the "what" and "why."

#### Proposal Lifecycle

Each connector microservice corresponds to a discrete OpenSpec proposal. The lifecycle gates implementation behind spec approval:

```text
 DRAFT ──► REVIEW ──► APPROVED ──► GENERATED ──► IMPLEMENTED ──► VERIFIED
   │          │           │            │               │              │
   │          │           │            │               │              │
   ▼          ▼           ▼            ▼               ▼              ▼
 Author    PR opened.   Spec merged  FastAPI stubs   Team fills    Integration
 writes    AI tooling   to main.     generated.      business      tests pass.
 OpenAPI   validates.   Gate event.  TS clients      logic into    Proposal
 3.1 YAML. Human        Code gen     regenerated.    stubs.        closed.
           approves.    may begin.   Committed.      Containerised.
```

1. **Draft** — Author writes the OpenAPI 3.1 YAML. Paths, schemas, error codes, and `x-cache-ttl` extension fields defined. No code yet.
2. **Review** — PR opened. OpenSpec AI tooling validates completeness. **Discipline-specific deep-thinking reviews** are conducted (see §6.5). Human reviewer approves.
3. **Approved** — Spec merged to main. This is the gate event. Code generation may now begin.
4. **Generated** — FastAPI Python 3.14 stubs generated. Frontend TS clients regenerated. Generated files committed; must not be hand-edited.
5. **Implemented** — Team fills business logic into generated stubs. Microservice containerised. **Implementation review** with relevant discipline reviewers before merge (see §6.5).
6. **Verified** — Generated integration tests pass against the running container. Proposal closed.

Amendments to an approved spec that change response schemas require a new Draft cycle and a major version increment.

#### Change Artifacts

Each OpenSpec change produces a structured set of artifacts that capture the full lifecycle from intent to completion:

| Artifact | Purpose | Created During |
| -------- | ------- | -------------- |
| **proposal.md** | Defines **what** is being built and **why**. Captures the problem statement, scope, and success criteria for the change. | Explore / Propose |
| **design.md** | Defines **how** the change will be implemented. Architecture decisions, data flow, component interactions, and integration points. | Propose |
| **spec (OpenAPI 3.1)** | Machine-readable API contract. Paths, schemas, error codes, cache TTLs. The source of truth from which all code is generated. | Propose / Draft |
| **tasks.md** | Ordered implementation checklist. Each task is a discrete, completable unit of work with clear acceptance criteria. | Propose |

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

### 6.5 Discipline Reviews

Each proposal MUST receive in-depth, deep-thinking reviews from the relevant engineering disciplines at two lifecycle gates: **Review** (before spec approval) and **Implementation Review** (before code merges). These reviews go beyond surface-level checks — reviewers are expected to think critically about edge cases, failure modes, scalability implications, and cross-cutting concerns that the proposal author or AI agent may not have considered.

#### Review Disciplines

| Discipline | Focus Area | When Required |
| ---------- | ---------- | ------------- |
| **Senior Python Engineer** | Code patterns, async correctness, Pydantic model design, error handling, performance of upstream API integrations, structlog usage, type safety | All connector proposals |
| **Senior Front End Developer** | React component architecture, React Query configuration, TypeScript strictness, accessibility (WCAG AA), bundle performance, error boundary design, state management | All frontend module proposals |
| **Senior Kubernetes & ArgoCD Engineer** | Deployment manifests, probe configuration, resource sizing, RBAC, ArgoCD sync policy, HPA/PDB design, Kustomize structure, sync wave ordering | All proposals that add or modify deployable components |
| **Senior Security Engineer** | Credential handling, TLS configuration, CORS/CSP, input validation, container hardening, NetworkPolicy changes, SAST/DAST coverage, supply chain (SBOM, dependency audit) | All proposals (every change has a security surface) |
| **Senior DevOps Engineer** | CI/CD pipeline changes, image promotion flow, rendered manifests pipeline, rollback procedures, observability (metrics, alerts, log aggregation), ArgoCD Notifications | All proposals that change build, deploy, or observability |
| **Senior QA Test Engineer** | Test strategy completeness, coverage targets, TDD adherence, integration test design, mock fidelity (MSW/respx), spec-conformance test coverage, edge case identification | All proposals |

#### How Reviews Work

Reviews are conducted using AI agent personas within Claude Code. Each discipline reviewer is invoked as a deep-thinking review pass against the proposal artifacts (design, spec, tasks) or implementation code. The reviewer:

1. **Reads** the full proposal context (design.md, spec, tasks.md) or the implementation diff.
2. **Thinks critically** about the change from their discipline's perspective — not just "does this look right?" but "what could go wrong?", "what's missing?", and "what would I do differently?"
3. **Produces** concrete, actionable suggestions — not vague feedback. Each suggestion identifies the specific artifact, section, or code location, the issue, and the recommended fix.
4. **Implements** approved suggestions directly into the artifacts or code.

#### Review Gate Matrix

Not every proposal requires every discipline. The matrix below defines the minimum required reviewers per proposal type:

| Proposal Type | Python | Frontend | K8s/ArgoCD | Security | DevOps | QA |
| ------------- | ------ | -------- | ---------- | -------- | ------ | -- |
| New connector (argocd/prometheus/network) | Required | — | Required | Required | Required | Required |
| Frontend module (App Status, Metrics, etc.) | — | Required | — | Required | — | Required |
| API spec change (OpenAPI YAML) | Required | Required | — | Required | — | Required |
| Deployment / manifest change | — | — | Required | Required | Required | — |
| CI/CD pipeline change | — | — | — | Required | Required | Required |
| Cross-cutting (new dependency, auth change) | Required | Required | Required | Required | Required | Required |

- **"Required"** means the review MUST be completed and suggestions addressed before the gate can pass.
- **"—"** means the review is optional — invoke it if the proposal touches that discipline's concerns.
- For cross-cutting changes that affect multiple layers, all six disciplines review.

#### Documenting Reviews

Review findings and resolutions are recorded in the proposal's `design.md` or as PR comments:

- Each discipline review adds a section: `## Review: <Discipline>` with findings, suggestions, and disposition (accepted/deferred/rejected with rationale).
- Deferred findings are tracked as follow-up tasks in `tasks.md` or as issues.
- The proposal cannot move from Review → Approved until all required discipline reviews are complete and all critical findings are resolved.

> **Reference**: The technical standards enforced by each discipline are documented in `docs/TECH-STANDARDS.md`. Reviewers validate proposals and implementations against the standards defined there.

---

## 7. Agentic Development

### 7.1 Role of AI Agents in This Project

This project makes deliberate, structured use of AI coding agents as a core part of the development workflow — not as an afterthought or productivity hack, but as a load-bearing element of the methodology. The team's profile (strong Python, no React experience) and the project's architecture (spec-driven, high boilerplate-to-logic ratio) make it a strong candidate for agent-assisted development.

AI agents participate in four distinct capacities:

| Capacity | What the Agent Does | What the Human Does |
| -------- | ------------------- | ------------------- |
| **Exploration** | Analyses codebase, investigates integration points, maps data flows, surfaces options | Evaluates options, makes architectural decisions, sets constraints |
| **Proposal generation** | Drafts proposals, designs, OpenAPI specs, and task breakdowns from a description of intent | Reviews artifacts for correctness, approves or redirects |
| **Code generation** | Generates FastAPI stubs, Pydantic models, TS API clients, test scaffolds from approved specs | Reviews generated code, fills business logic (scaffold mode) or reviews completed logic (agent-implemented mode) |
| **Implementation** | Executes tasks from the task list — writes code, creates files, wires components | Reviews diffs, validates behaviour, marks tasks complete |

### 7.2 OpenSpec Agentic Workflow

The project's OpenSpec tooling provides four agentic skills that map to the change lifecycle. These skills are invoked through Claude Code and operate on the structured artifacts in the `openspec/` directory.

```text
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ EXPLORE  │────►│ PROPOSE  │────►│  APPLY   │────►│ ARCHIVE  │
│          │     │          │     │          │     │          │
│ Think,   │     │ Generate │     │ Implement│     │ Finalise,│
│ discover,│     │ proposal,│     │ tasks,   │     │ move to  │
│ clarify  │     │ design,  │     │ write    │     │ archive, │
│ require- │     │ spec,    │     │ code,    │     │ sync     │
│ ments    │     │ tasks    │     │ test     │     │ specs    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     ▲                                  │
     └──────────────────────────────────┘
              (iterate if needed)
```

| Skill | Invocation | Purpose | Outputs |
| ----- | ---------- | ------- | ------- |
| **Explore** | `/openspec-explore` | Thinking partner for discovery. Reads code, searches patterns, maps architecture. Does not write implementation code. | Clarified requirements, option analysis, ASCII diagrams, draft artifacts |
| **Propose** | `/openspec-propose` | Creates a named change and generates all artifacts (proposal, design, spec, tasks) in one step. | Complete change directory under `openspec/changes/<name>/` with all artifacts ready for review |
| **Apply** | `/openspec-apply-change` | Implements tasks from a change. Reads context (proposal, design, spec), executes tasks sequentially, writes code. | Working code committed per task. Tasks marked complete in `tasks.md`. |
| **Archive** | `/openspec-archive-change` | Finalises a completed change. Syncs delta specs to main spec directory. Moves change to archive. | Change archived to `openspec/changes/archive/YYYY-MM-DD-<name>/` |

The workflow is **not phase-locked** — teams can loop between Explore and Propose, pause Apply to revisit the design, or Archive a partially completed change if the scope shifts.

### 7.3 Pros and Cons of Agentic Development

#### Advantages

- **Bridges the React gap**: The team is Python-proficient with no React experience. Agent-generated TypeScript API clients and React component scaffolds allow the team to deliver a production frontend without acquiring deep React expertise first. The team reviews and validates agent output rather than authoring from scratch.

- **High boilerplate-to-logic ratio**: Each connector follows the same pattern — FastAPI app, Pydantic models, Redis caching, health endpoint, structured logging. Agents generate this boilerplate reliably, freeing developer time for the business logic that differs between connectors (ArgoCD fan-out, PromQL query construction, NetworkPolicy parsing).

- **Spec-driven guardrails**: Because all generation flows from approved OpenAPI specs, the agent operates within a well-defined contract. Drift between spec and implementation is caught by generated integration tests, not by hope.

- **Faster iteration on proposals**: An agent can generate a complete proposal (design + spec + tasks) in minutes. The human reviews a draft rather than starting from a blank page — a meaningful acceleration for a small team.

- **Consistent patterns across connectors**: Agents apply the same patterns to every connector — consistent error handling, logging, caching, and endpoint structure. Manual implementation across 10+ connector instances invites inconsistency.

#### Risks and Mitigations

| Risk | Description | Mitigation |
| ---- | ----------- | ---------- |
| **Unreviewed code in production** | Agent-generated code that passes tests but contains subtle logic errors, security issues, or incorrect assumptions about upstream APIs. | All agent-generated code goes through human review before merge. Generated integration tests validate spec conformance. Security-sensitive code (credential handling, API auth) is always human-reviewed line by line. Discipline-specific deep-thinking reviews (§6.5) provide targeted scrutiny from Python, frontend, K8s, security, DevOps, and QA perspectives at both spec approval and implementation gates. |
| **Over-reliance on agent for domain understanding** | Agent may generate plausible-looking ArgoCD or Prometheus integration code that misunderstands API behaviour at edge cases (e.g., ArgoCD app-of-apps, multi-source applications). | Team validates agent output against actual ArgoCD/Prometheus API behaviour in DEV. Scaffold-only mode used for integrations where the team wants full control. |
| **Generated code drift** | If specs are updated but generated code is not regenerated, implementation may diverge from the contract. | Spec-conformance gate in Phase 4. CI step validates generated code matches current spec. Generated files are marked with headers indicating they must not be hand-edited. |
| **Debugging agent-generated code** | When agent-generated code fails in production, the team may struggle to debug code they didn't write, particularly on the React/TypeScript side. | Structured JSON logging on all connectors. Generated code includes comments explaining non-obvious logic. Team builds familiarity through the review process. |
| **Agent hallucination in specs** | Agent may propose API endpoints, schemas, or integration patterns that don't align with actual upstream API capabilities. | Explore phase validates assumptions against live APIs before Propose. All specs require human review before approval gate. |

### 7.4 Agentic Skills Catalog

Beyond the four OpenSpec workflow skills, the following agent capabilities are available to augment development across the project lifecycle:

#### Development Skills

| Skill | Invocation | When to Use |
| ----- | ---------- | ----------- |
| **Feature Development** | `/feature-dev` | Guided feature implementation with codebase analysis and architecture focus. Use for implementing dashboard modules, connector logic, or frontend components that require understanding existing patterns before writing code. |
| **Code Review** | `/code-review` | Automated review of pull requests for bugs, security issues, and convention adherence. Use on every PR — particularly important for agent-generated code going through human review. |
| **Simplify** | `/simplify` | Reviews changed code for reuse opportunities, quality issues, and efficiency. Use after a batch of agent-generated code is committed to identify consolidation opportunities across connectors. |

#### Planning and Documentation Skills

| Skill | Invocation | When to Use |
| ----- | ---------- | ----------- |
| **PRD Generation** | `/prd` | Generates product requirements documents. Used to produce this document. Useful for scoping post-MVP features or documenting new connector proposals. |
| **Claude API** | `/claude-api` | Builds applications using the Claude API or Anthropic SDK. Relevant if the dashboard later integrates AI-powered summarisation or natural language queries against platform state. |

#### Recommended Agent-Assisted Tasks by Phase

| Phase | Agent-Assisted Tasks | Human-Owned Tasks |
| ----- | -------------------- | ------------------ |
| **Phase 0** | React scaffold generation (Vite + Tailwind + shadcn/ui). Docker and Kustomize boilerplate. Mock data generation for all 3 envs × 2 regions. | ESO/Key Vault wiring. ArgoCD API access verification. Stakeholder review of mockup. |
| **Phase 1** | OpenAPI spec drafting for argocd-connector. FastAPI stub generation. TypeScript client generation. React module scaffolding (App Status, Image Promotion). Integration test generation. | ArgoCD API behaviour validation in DEV. `dest.server` → region mapping logic. Business logic for image tag extraction fallback. |
| **Phase 2** | OpenAPI spec drafting for prometheus-connector. PromQL query template generation. FastAPI stub generation. React module scaffolding (Metrics). | Azure Monitor Workspace authentication flow. PromQL label schema validation. Sparkline component tuning. |
| **Phase 3** | OpenAPI spec drafting for network-connector. FastAPI stub generation. ClusterRole YAML generation. React module scaffolding (Network Status). | NetworkPolicy parsing logic. Cross-cluster network connectivity validation. |
| **Phase 4** | Spec-conformance test generation. End-to-end test scaffolding. Performance test harness. | Performance tuning. Pilot tenant onboarding. Runbook documentation. |

---

## 8. Repository Structure

### 8.1 GitOps Repository Strategy

The platform team follows a GitOps methodology with **separate repositories for application code and deployment manifests**. This separation ensures that CI pipelines produce artifacts (container images) independently of CD pipelines (manifest sync via ArgoCD), and that the GitOps manifest repo contains only rendered, auditable YAML.

```text
                    ┌──────────────────────────┐
                    │  gitops-dashboard         │  Application source code
                    │  (this repo)              │  + OpenSpec artifacts
                    │                           │  + OpenAPI specs
                    └────────────┬──────────────┘
                                 │
                          CI Pipeline
                          (build, test,
                           scan, push image)
                                 │
                    ┌────────────▼──────────────┐
                    │  gitops-dashboard-deploy   │  Kustomize manifests
                    │  (deploy repo)             │  + rendered output
                    │                           │  for ArgoCD sync
                    └────────────┬──────────────┘
                                 │
                          ArgoCD watches
                          (auto-sync or
                           manual sync)
                                 │
                    ┌────────────▼──────────────┐
                    │  aks-dev-eastus            │  Dashboard runs here
                    │  (dashboard namespace)     │
                    └───────────────────────────┘
```

### 8.2 Application Repository — `gitops-dashboard`

This is the primary development repository. It contains all source code, OpenSpec artifacts, API specifications, and CI pipeline definitions. No Kubernetes manifests live here — those are in the deploy repo.

```text
gitops-dashboard/
├── CLAUDE.md                              # Claude Code project instructions
├── docs/
│   ├── PRD-gitops-dashboard.md            # This document
│   └── PRD-v2-gitops-pipelines.md         # Pipeline templates PRD (reference)
│
├── openspec/                              # OpenSpec methodology artifacts
│   ├── config.yaml                        # OpenSpec project configuration
│   ├── specs/                             # Approved, canonical specifications
│   │   ├── argocd-connector/
│   │   │   └── spec.md                    # Approved OpenAPI spec (PROP-01)
│   │   ├── prometheus-connector/
│   │   │   └── spec.md                    # Approved OpenAPI spec (PROP-03)
│   │   └── network-connector/
│   │       └── spec.md                    # Approved OpenAPI spec (PROP-04)
│   └── changes/                           # Active and archived changes
│       ├── <active-change-name>/          # In-progress change
│       │   ├── .openspec.yaml             # Change metadata
│       │   ├── proposal.md                # What & why
│       │   ├── design.md                  # How (architecture)
│       │   ├── tasks.md                   # Implementation checklist
│       │   └── specs/                     # Delta specs for this change
│       └── archive/                       # Completed changes
│           └── YYYY-MM-DD-<name>/
│
├── specs/                                 # OpenAPI 3.1 YAML (source of truth)
│   ├── argocd-connector/
│   │   └── openapi.yaml
│   ├── prometheus-connector/
│   │   └── openapi.yaml
│   └── network-connector/
│       └── openapi.yaml
│
├── connectors/                            # Backend microservices (Python 3.14)
│   ├── argocd-connector/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── src/
│   │   │   ├── main.py                    # FastAPI app entry point
│   │   │   ├── routes/                    # Generated route stubs + business logic
│   │   │   ├── models/                    # Generated Pydantic v2 models
│   │   │   ├── services/                  # Hand-written business logic
│   │   │   └── cache.py                   # Redis client (30 min TTL)
│   │   └── tests/
│   │       ├── generated/                 # Auto-generated spec-conformance tests
│   │       └── integration/               # Hand-written integration tests
│   ├── prometheus-connector/
│   │   ├── Dockerfile
│   │   ├── pyproject.toml
│   │   ├── src/
│   │   │   ├── main.py
│   │   │   ├── routes/
│   │   │   ├── models/
│   │   │   ├── services/
│   │   │   └── cache.py                   # Redis client (30 min TTL)
│   │   └── tests/
│   └── network-connector/
│       ├── Dockerfile
│       ├── pyproject.toml
│       ├── src/
│       │   ├── main.py
│       │   ├── routes/
│       │   ├── models/
│       │   ├── services/
│       │   └── cache.py                   # Redis client (30 min TTL)
│       └── tests/
│
├── frontend/                              # React 18 + TypeScript dashboard
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/                           # Auto-generated API clients (DO NOT EDIT)
│   │   │   ├── argocd-connector/
│   │   │   ├── prometheus-connector/
│   │   │   └── network-connector/
│   │   ├── components/
│   │   │   ├── layout/                    # Shell, nav, global filters
│   │   │   ├── app-status/                # Module 1 — ArgoCD Application Status
│   │   │   ├── image-promotion/           # Module 2 — Image Promotion View
│   │   │   ├── metrics/                   # Module 3 — CPU & Memory Metrics
│   │   │   └── network-status/            # Module 4 — Namespace Network Status
│   │   ├── hooks/                         # React Query hooks (polling config)
│   │   └── lib/                           # Shared utilities
│   └── tests/
│
├── scripts/                               # Development and CI utility scripts
│   ├── generate-stubs.py                  # Generate FastAPI stubs from specs
│   ├── generate-ts-clients.sh             # Generate TS clients from specs
│   └── validate-spec-conformance.py       # Spec vs implementation validation
│
├── azure-pipelines.yml                    # CI pipeline definition
└── Makefile                               # Local dev commands (build, test, lint)
```

### 8.3 Deploy Repository — `gitops-dashboard-deploy`

A separate repository containing Kustomize base manifests and per-environment/region overlays. ArgoCD watches this repo and syncs rendered manifests to the DEV East US cluster. Following the rendered manifests pattern from PRD-v2-gitops-pipelines, CI renders all overlays and commits fully hydrated YAML — ArgoCD syncs raw manifests with no in-cluster rendering.

```text
gitops-dashboard-deploy/
├── base/                                  # Shared Kustomize base
│   ├── kustomization.yaml
│   ├── namespace.yaml                     # dashboard namespace
│   ├── redis/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── ingress.yaml                   # Internal-only ingress
│   ├── argocd-connector/
│   │   ├── deployment.yaml                # Template — env/region parameterised
│   │   ├── service.yaml
│   │   └── hpa.yaml
│   ├── prometheus-connector/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── hpa.yaml
│   ├── network-connector/
│   │   ├── deployment.yaml                # Template — cluster parameterised
│   │   ├── service.yaml
│   │   ├── hpa.yaml
│   │   ├── serviceaccount.yaml
│   │   └── clusterrole.yaml               # NetworkPolicy read-only
│   └── external-secrets/
│       ├── argocd-dev-token.yaml           # ExternalSecret → Key Vault
│       ├── argocd-stage-token.yaml
│       ├── argocd-prod-token.yaml
│       └── azure-monitor-creds.yaml
│
├── overlays/
│   └── dev-eastus/                        # Dashboard deploys to DEV East US only
│       ├── kustomization.yaml
│       └── patches/
│           ├── argocd-connector-dev.yaml   # ARGOCD_ENV=DEV, DEV server URL
│           ├── argocd-connector-stage.yaml # ARGOCD_ENV=STAGE, STAGE server URL
│           ├── argocd-connector-prod.yaml  # ARGOCD_ENV=PROD, PROD server URL
│           ├── prometheus-connector.yaml   # Azure Monitor Workspace endpoint
│           ├── network-connector-dev-e.yaml
│           ├── network-connector-dev-w.yaml
│           ├── network-connector-stage-e.yaml
│           ├── network-connector-stage-w.yaml
│           ├── network-connector-prod-e.yaml
│           └── network-connector-prod-w.yaml
│
└── rendered/
    └── dev-eastus/
        └── manifests.yaml                 # Fully rendered — ArgoCD syncs this
```

### 8.4 Repository Separation Rationale

| Concern | Application Repo (`gitops-dashboard`) | Deploy Repo (`gitops-dashboard-deploy`) |
| ------- | ------------------------------------- | --------------------------------------- |
| **Contents** | Source code, specs, tests, CI pipeline, docs | Kustomize manifests, overlays, rendered YAML |
| **CI trigger** | Code changes trigger build, test, scan, image push | Manifest changes trigger ArgoCD sync |
| **Access model** | Development team (read/write) | CI pipeline (write rendered output), ArgoCD (read), platform team (read/write) |
| **Review scope** | Code logic, spec changes, test coverage | Manifest correctness, resource limits, security policies |
| **Audit trail** | Code commits linked to PRs and specs | Manifest commits linked to source commit, pipeline run, and image SHA (per rendered manifests pattern) |
| **Rollback** | Revert code change, re-run CI | `git revert` manifest commit — ArgoCD syncs the revert |

---

## 9. Documentation Requirements

In-depth documentation is a first-class deliverable — not an afterthought. Documentation must be created and updated during each phase alongside the code it describes. Stale or missing documentation is treated as a phase gate blocker equivalent to failing tests.

### 9.1 API Documentation (Swagger)

Every connector microservice exposes interactive API documentation via Swagger UI. This is the primary interface for developers integrating with connector APIs.

| Endpoint | Format | Purpose |
| -------- | ------ | ------- |
| **`/docs`** | Swagger UI (interactive) | Explore endpoints, view schemas, execute test requests against the running service. Primary developer interface for API discovery and integration testing. |
| **`/redoc`** | ReDoc (read-only) | Clean, printable API reference documentation. Suitable for sharing with stakeholders or embedding in documentation portals. |
| **`/openapi.json`** | OpenAPI 3.1 JSON | Machine-readable spec for client generation, spec-conformance validation, and CI tooling. |

**Requirements**:

- Swagger UI MUST be enabled on all connector instances in all environments (DEV, STAGE, PROD). Since the dashboard is internal-only and non-mutating, there is no security risk from exposing interactive docs.
- All endpoints MUST include descriptions, request/response examples, and error response schemas in the OpenAPI spec. These render automatically in Swagger UI.
- Schema descriptions MUST document the meaning of each field, not just the type. For example, `health` should document the possible values (Healthy, Degraded, Unknown) and what each means.
- The `x-cache-ttl` extension field on each endpoint MUST be visible in the Swagger docs so consumers understand data freshness guarantees.

### 9.2 Documentation Artifacts

The following markdown documents are required and must be maintained throughout the project lifecycle:

#### Project-Level Documentation (Application Repo Root)

| Document | Audience | Content |
| -------- | -------- | ------- |
| **README.md** | All developers, new team members | Project overview, architecture summary, links to PRDs, tech stack, repo structure, contribution workflow, links to connector and frontend READMEs. |
| **QUICKSTART.md** | New developers joining the project | Step-by-step guide to clone the repo, install dependencies, start all services locally (connectors + frontend + Redis), and verify the dashboard loads with mock or live data. Includes prerequisites (Python 3.14, Node.js, Docker, Redis). |
| **TROUBLESHOOTING.md** | Developers and operators | Common issues and resolutions: build failures, connectivity issues to ArgoCD/Prometheus, Redis cache debugging, frontend build issues, Docker image build problems, ESO/Key Vault configuration errors. |

#### Connector-Level Documentation (Per Connector Directory)

| Document | Audience | Content |
| -------- | -------- | ------- |
| **connectors/{name}/README.md** | Developers working on that connector | Connector purpose, upstream API details, configuration (env vars), local development instructions, testing instructions, Swagger UI URL, caching behaviour, error handling patterns. |
| **connectors/{name}/QUICKSTART.md** | Developers new to that connector | Minimal steps to run the connector locally, point it at a test/dev upstream, and verify it responds on `/health` and `/docs`. |

#### Frontend Documentation

| Document | Audience | Content |
| -------- | -------- | ------- |
| **frontend/README.md** | Developers working on the frontend | Module architecture, component structure, auto-generated API client usage, React Query polling configuration, environment/region filter behaviour, build and test instructions. |
| **frontend/QUICKSTART.md** | Developers new to the frontend | Steps to install dependencies, start the dev server, connect to local or remote connectors, and view the dashboard. |

#### Operator Documentation

| Document | Audience | Content |
| -------- | -------- | ------- |
| **docs/OPERATIONS.md** | Platform operators, SREs | Deployment architecture, connector instance inventory, Redis cache policy, health check endpoints, log format and structured fields, HPA configuration, ESO/Key Vault secret mapping, monitoring and alerting guidance. |
| **docs/RUNBOOK.md** | On-call operators | Incident response procedures: connector unreachable, Redis down, ArgoCD token expired, Azure Monitor Workspace query failures, dashboard unresponsive. Step-by-step recovery for each scenario. |

#### Deploy Repo Documentation

| Document | Audience | Content |
| -------- | -------- | ------- |
| **README.md** (deploy repo) | Platform engineers, ArgoCD operators | Kustomize structure, overlay organisation, rendered manifests pattern, ArgoCD sync configuration, how to add a new connector instance, how to update image tags. |

### 9.3 Documentation Per Phase

Documentation is not a final-phase activity. Each phase must produce and update the documentation artifacts listed below before the phase gate can be considered met.

| Phase | Documentation Deliverables |
| ----- | -------------------------- |
| **Phase 0** | Project-level README.md, QUICKSTART.md (mock data mode), TROUBLESHOOTING.md (initial — build and Docker issues). Deploy repo README.md. Documentation templates established for connector and frontend READMEs. |
| **Phase 1** | argocd-connector README.md and QUICKSTART.md. Frontend README.md and QUICKSTART.md. Swagger UI verified on all 3 argocd-connector instances. TROUBLESHOOTING.md updated with ArgoCD connectivity and auth issues. |
| **Phase 2** | prometheus-connector README.md and QUICKSTART.md. Swagger UI verified on prometheus-connector. TROUBLESHOOTING.md updated with Azure Monitor Workspace query and auth issues. |
| **Phase 3** | network-connector README.md and QUICKSTART.md. Swagger UI verified on all 6 network-connector instances. TROUBLESHOOTING.md updated with K8s API and ServiceAccount issues. OPERATIONS.md and RUNBOOK.md initial versions. |
| **Phase 4** | All documentation reviewed for accuracy against running system. OPERATIONS.md and RUNBOOK.md finalised. QUICKSTART.md validated by pilot tenant (new user can follow it end-to-end without assistance). |

### 9.4 Documentation Standards

- **Format**: All documentation is Markdown, committed to the repository alongside the code it documents.
- **Currency**: Documentation MUST be updated in the same PR as the code change it describes. A PR that changes API behaviour, configuration, or operational procedures without updating the corresponding documentation is incomplete.
- **No external wikis**: All documentation lives in the repos. No Confluence, SharePoint, or other external documentation systems. The repos are the single source of truth for both code and docs.
- **Code examples**: QUICKSTARTs must include copy-pasteable commands. Avoid placeholder values that require the reader to guess; use clearly marked variables (e.g., `<your-argocd-token>`).
- **Versioning**: Documentation follows the same branching and review process as code. Changes to docs require PR review.

---

## 10. Security & Privacy

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

## 11. Non-Functional Requirements

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
| **API documentation** | Swagger UI (`/docs`), ReDoc (`/redoc`), and OpenAPI JSON (`/openapi.json`) on every connector instance |
| **Documentation** | README, QUICKSTART, and TROUBLESHOOTING maintained per component; updated each phase |
| **Observability** | Structured JSON logs (`structlog`); Prometheus `/metrics` on each connector |
| **Development standards** | See `docs/TECH-STANDARDS.md` for enforceable coding conventions, linting rules, testing strategy, and CI gate definitions |
| **Scalability** | Connectors support HPA; scale-to-zero on idle |
| **Data residency** | No PII stored; no data written to disk; Redis in-cluster only |
| **Graceful degradation** | Unreachable sources shown as "Unknown" with last refresh timestamp; remaining data unaffected |

---

## 12. Risks & Roadmap

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| **ArgoCD API rate limiting** under 850+ app queries | Low | High | Redis caching (30 min TTL) significantly reduces query frequency — each connector instance queries upstream at most twice per hour. Implement pagination. Monitor ArgoCD API response times during pilot. |
| **Azure Monitor Workspace query latency** for 6-cluster fan-out | Low | Medium | PromQL queries scoped by label (not per-cluster fan-out). Cache results at 30 min TTL. Pre-aggregate where possible. |
| **Team lacks React experience** | High | Medium | Auto-generated TS API clients from OpenAPI specs. Agent-assisted React component scaffolding. shadcn/ui component library reduces custom CSS. |
| **Network connectivity from DEV cluster** to STAGE/PROD ArgoCD instances | Low | High | Verify network routes during Phase 0. Graceful degradation shows "Unknown" status. |
| **Stale data displayed without user awareness** | Medium | Medium | Every module displays last-refresh timestamp. "Unknown" state for unreachable sources. |
| **Single point of failure** (dashboard in DEV cluster only) | Low | Low | Acceptable for Tier II application. Document in runbook. Re-evaluate post-MVP if adoption warrants higher availability. |

### Phased Rollout

Each phase is gated by approval of its OpenSpec proposals. No code generation or implementation work may begin for a given proposal until it has been reviewed and merged. All proposals undergo discipline-specific deep-thinking reviews per the review gate matrix in §6.5 — both at spec approval and at implementation merge. The completed scope of all phases constitutes the MVP.

| Phase | Scope | Deliverables | Gate Condition |
| ----- | ----- | ------------ | -------------- |
| **Phase 0** (Weeks 1–3) | No proposals. Proposal template and review process established. | Repo scaffold. External Secrets / Key Vault wiring. ArgoCD API access verified for all 3 instances. Working dashboard mockup deployable as a Docker container (React static UI with mock data representing all 3 envs and 2 regions, no live connectors). Mockup is the visual contract for subsequent work. **Docs**: Project README.md, QUICKSTART.md (mock data mode), TROUBLESHOOTING.md (initial). Deploy repo README.md. Documentation templates for connectors and frontend. | Mockup Docker image builds and runs locally. Stakeholder sign-off on env/region layout. Proposal template merged to main. README and QUICKSTART validated. |
| **Phase 1** (Weeks 4–6) | PROP-01: argocd-connector API surface (env-parameterised). PROP-02: Frontend module contract (app status + image promotion view). | Three argocd-connector instances (DEV/STAGE/PROD). React modules 1 & 2 wired to live connector data. Promotion pipeline view operational. **Docs**: argocd-connector README.md and QUICKSTART.md. Frontend README.md and QUICKSTART.md. Swagger UI verified on all 3 argocd-connector instances. TROUBLESHOOTING.md updated with ArgoCD connectivity and auth issues. | PROP-01 and PROP-02 approved. Generated tests pass. All 3 ArgoCD environments visible with correct East/West cluster routing. Swagger UI accessible on each instance. |
| **Phase 2** (Weeks 7–9) | PROP-03: prometheus-connector API surface (multi-env label filtering). | prometheus-connector wired to Azure Monitor Workspace. React module 3 (CPU/Memory) operational across all environments and regions. Redis cache layer with per-connector TTL policy. **Docs**: prometheus-connector README.md and QUICKSTART.md. Swagger UI verified. TROUBLESHOOTING.md updated with Azure Monitor Workspace query and auth issues. | PROP-03 approved. Prometheus connector returns correctly labelled metrics for all 6 clusters. Module 3 renders live data with env/region filter. Swagger UI accessible. |
| **Phase 3** (Weeks 10–12) | PROP-04: network-connector API surface (per-cluster). | Six network-connector instances (one per AKS cluster). React module 4 (Network Status) operational. All connectors deployed via ArgoCD with ESO-managed secrets. **Docs**: network-connector README.md and QUICKSTART.md. Swagger UI verified on all 6 instances. TROUBLESHOOTING.md updated with K8s API and ServiceAccount issues. OPERATIONS.md and RUNBOOK.md initial versions. | PROP-04 approved. All 6 network-connector instances pass generated integration tests. Module 4 renders live NetworkPolicy data filterable by env and region. Swagger UI accessible on all instances. |
| **Phase 4** (Weeks 13–15) | No new proposals. Spec-conformance validation run. | End-to-end integration tests across all environments and regions. Performance hardening. Spec-conformance gate. Internal pilot rollout to early-adopter tenants. **Docs**: All documentation reviewed for accuracy. OPERATIONS.md and RUNBOOK.md finalised. QUICKSTART.md validated by pilot tenant (end-to-end without assistance). | All connectors pass spec-conformance check. P95 load time < 3 s. Pilot tenant group onboarded. Documentation review complete. |

> **Post-MVP**: Additional features (RBAC refinement, alerting integration, additional data sources) will be evaluated based on pilot feedback and tracked as separate proposals.

---

## 13. Resolved Decisions

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
| **API documentation** | Swagger UI (`/docs`) enabled on all connector instances in all environments. APIs defined and documented through Swagger. |
| **Project documentation** | README, QUICKSTART, and TROUBLESHOOTING docs required per component. Updated each phase — not deferred to end. No external wikis. |
| **Project scoping model** | Dashboard uses ArgoCD AppProject as the primary scoping mechanism. Project selector persists in `localStorage`. "All Projects" provides the platform-wide view. Project → namespace resolution uses ArgoCD project `spec.destinations`. |
| **View mode granularity** | Platform View (All Projects) shows namespace-level aggregates. Project View shows workload-level detail (Deployment, StatefulSet, Job) and ApplicationSet hierarchy. |
| **Cilium flow data source** | Cilium L3/L4 drop and flow metrics sourced from Prometheus via Hubble metrics (`hubble_drop_total`, `hubble_flows_processed_total`), served by prometheus-connector. Not from the Kubernetes API or network-connector. |
| **ApplicationSet support** | Dashboard displays ApplicationSets as parent rows with generated Applications nested underneath in Project View. Platform View shows flat Application list only. |
| **Cache refresh interval** | Uniform 30-minute TTL across all connectors. The dashboard is a reporting tool — it does not require real-time or near-real-time data. The 30-minute interval avoids overwhelming upstream APIs (ArgoCD, Azure Monitor Workspace, Kubernetes API) while keeping data fresh enough for status reporting, promotion tracking, and network policy auditing. Users see a "Last updated" timestamp on every module. A manual refresh button allows on-demand cache bypass when needed. |

---

## 14. Open Questions

| # | Question | Needed For | Status |
| - | -------- | ---------- | ------ |
| 1 | What are the exact Prometheus label names used to identify environment (DEV/STAGE/PROD) and region (eastus/westus) in the Azure Monitor Workspace? | PROP-03 spec drafting | Open |
| 2 | Are the six AKS clusters accessible from the DEV cluster's network, or does the network-connector need to be deployed into each cluster separately? | PROP-04 architecture and deployment model | Open |
| 3 | Are tenant applications grouped into ArgoCD AppProjects per environment? | PROP-01 `/apps` endpoint filtering logic | Open |
| 4 | Should the East/West region selector persist across browser sessions (localStorage) or be ephemeral? | PROP-02 frontend spec | Open |
| 5 | What is the expected rotation cadence for ArgoCD service account tokens? Does ESO need a rotation trigger? | Security operations | Open |
| 6 | What is the ArgoCD API pagination behaviour for environments with hundreds of applications? | PROP-01 performance design | Open |
| 7 | What is the cardinality of ArgoCD Project → Kubernetes namespace mapping? Is it 1:1 (one project deploys to one namespace), 1:N (one project deploys to multiple namespaces), or N:1 (multiple projects deploy to the same namespace)? This determines whether the project selector can use namespace as a simple join key or needs a many-to-many resolution. | PS-03 project→namespace resolution, PROP-01/03/04 filtering logic | Open |
| 8 | Are ApplicationSets used consistently across all three environments, or do some environments use standalone Applications without an ApplicationSet parent? | AS-04 ApplicationSet hierarchy rendering | Open |
| 9 | Is Hubble relay deployed on all 6 AKS clusters and pushing metrics to the Azure Monitor Workspace? Are `hubble_drop_total` and `hubble_flows_processed_total` metrics available with `source_namespace` and `destination_namespace` labels? | NS-03/NS-04 Cilium flow data, PROP-03 prometheus-connector spec | Open |
| 10 | Should the project scope selector show projects from all three environments (union), or only projects that exist in the currently selected environment filter? | PS-01 project selector UX | Open |

---

## 15. Glossary

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
| **Swagger UI** | Interactive API documentation interface built into FastAPI. Served at `/docs` on each connector. Allows developers to explore endpoints, view schemas, and execute test requests. |
| **TTL** | Time-to-live — Redis cache expiry duration per data type. |
| **`dest.server`** | ArgoCD Application field identifying the target cluster URL; used to route applications to the correct regional AKS cluster. |
| **`status.summary.images`** | ArgoCD Application status field listing container images deployed to the workload. Authoritative source for image tag data. |
