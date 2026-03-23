## ADDED Requirements

### Requirement: MSW handlers return realistic mock data for all 3 connector APIs

MSW handlers SHALL intercept all frontend API calls and return static TypeScript fixtures. Mock data SHALL cover all 3 environments (DEV, STAGE, PROD) and both regions (East US, West US).

#### Scenario: ArgoCD mock data includes 850+ applications
- **WHEN** the frontend calls the argocd-connector API endpoints
- **THEN** the MSW handler SHALL return at least 850 Application records distributed across 3 environments and 2 regions
- **AND** each Application SHALL include metadata.name, spec.project, spec.destination, status.health, status.sync, and status.summary.images fields

#### Scenario: Mock data includes multiple ArgoCD projects with ApplicationSets
- **WHEN** the frontend calls /projects
- **THEN** the handler SHALL return at least 5 projects (e.g., platform-infra, payment-service, auth-service, notification-service, data-pipeline)
- **AND** each project SHALL have 2-4 ApplicationSets with generated child Applications

#### Scenario: Mock data includes realistic status distribution
- **WHEN** the full set of mock applications is generated
- **THEN** approximately 80% SHALL be Healthy/Synced, 10% Degraded/OutOfSync, 5% Unknown, 5% Error

#### Scenario: Prometheus mock data covers CPU, memory, quota, and OOM metrics
- **WHEN** the frontend calls prometheus-connector endpoints (/metrics/cpu, /metrics/memory, /metrics/namespace-quota, /metrics/request-limit, /metrics/ooms)
- **THEN** handlers SHALL return namespace-level and workload-level metrics with numeric values, sparkline history (10 data points), and environment/region labels

#### Scenario: Network mock data includes NetworkPolicy and Cilium flow data
- **WHEN** the frontend calls network-connector endpoints (/network/policies, /network/namespaces/{ns}/status) and prometheus-connector Cilium endpoints (/metrics/cilium/drops, /metrics/cilium/flows)
- **THEN** handlers SHALL return NetworkPolicy objects per namespace, open egress flags, drop counts, and denied connection tables

#### Scenario: One connector is simulated as unavailable for degraded state demo
- **WHEN** the mock data is initialized
- **THEN** at least one environment-region combination SHALL return a 503 error to demonstrate degraded state handling (PRD §4.6, DG-01)
