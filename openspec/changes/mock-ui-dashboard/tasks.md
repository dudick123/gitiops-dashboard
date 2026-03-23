## 1. shadcn/ui Initialization and Design Tokens

- [ ] 1.1 Initialize shadcn/ui in the frontend directory (`npx shadcn@latest init`). Verify it doesn't break existing tailwind.config.ts or postcss.config.js. Configure CSS variables for status colors (healthy, degraded, error, unknown).
- [ ] 1.2 Install shadcn/ui components needed for the dashboard: Button, Card, Badge, Table, Select, Input, Tabs, Separator, ScrollArea, Tooltip, Collapsible, Skeleton
- [ ] 1.3 Create `frontend/src/lib/utils.ts` with the `cn()` class merge utility required by shadcn/ui

## 2. Mock Data Generation

- [ ] 2.1 Create `frontend/src/mocks/data/types.ts` — TypeScript interfaces matching expected connector API response shapes (ApplicationStatus, ApplicationSet, Project, CpuMetrics, MemoryMetrics, NamespaceQuota, OomEvent, NetworkPolicy, CiliumDrop, DeniedConnection). Types should closely match PRD §4.3–4.5 endpoint descriptions.
- [ ] 2.2 Create `frontend/src/mocks/data/seed.ts` — Seed configuration defining 5 ArgoCD projects, each with 2-4 ApplicationSets. Each ApplicationSet generates 6 Applications (3 envs × 2 regions). Total: ~150 apps from ApplicationSets + ~700 standalone apps = 850+ total.
- [ ] 2.3 Create `frontend/src/mocks/data/generate-apps.ts` — Function to generate 850+ Application records from the seed. Distribute statuses: ~80% Healthy/Synced, ~10% Degraded/OutOfSync, ~5% Unknown, ~5% Error. Assign realistic image tags (semver for most, non-semver for ~5% per PRD IP-03).
- [ ] 2.4 Create `frontend/src/mocks/data/generate-metrics.ts` — Function to generate namespace-level and workload-level CPU/memory metrics with 10-point sparkline history, request/limit ratios, quota utilisation percentages, and OOM events.
- [ ] 2.5 Create `frontend/src/mocks/data/generate-network.ts` — Function to generate NetworkPolicy objects per namespace, open egress flags, Cilium drop counts, and denied connection records.
- [ ] 2.6 Create `frontend/src/mocks/data/index.ts` — Barrel export that generates all mock data once at import time.

## 3. MSW Handlers

- [ ] 3.1 Update `frontend/src/mocks/handlers/argocd.ts` — Handlers for GET /projects, /projects/{project}, /apps, /apps/{name}, /apps/{name}/images, /appsets, /appsets/{name}, /healthz. Support ?project= query parameter for filtering.
- [ ] 3.2 Create `frontend/src/mocks/handlers/prometheus.ts` — Handlers for GET /metrics/cpu, /metrics/memory, /metrics/namespace-quota, /metrics/request-limit, /metrics/ooms, /metrics/cilium/drops, /metrics/cilium/flows, /healthz. Support ?namespace= query parameter for workload-level granularity.
- [ ] 3.3 Create `frontend/src/mocks/handlers/network.ts` — Handlers for GET /network/policies, /network/namespaces/{ns}/status, /healthz. Support ?namespace= filter.
- [ ] 3.4 Update `frontend/src/mocks/handlers/index.ts` — Export all handlers. Include one handler that returns 503 for STAGE-West argocd-connector to demonstrate degraded state (PRD DG-01).
- [ ] 3.5 Create `frontend/src/mocks/browser.ts` — MSW browser worker setup. Initialize worker before React renders in main.tsx. Conditional on development/mock mode.

## 4. Dashboard Shell and Navigation

- [ ] 4.1 Create `frontend/src/components/layout/dashboard-layout.tsx` — Main layout with header, navigation tabs (App Status, Image Promotion, Metrics, Network Status), and content area. Uses shadcn/ui Tabs component.
- [ ] 4.2 Create `frontend/src/components/layout/project-selector.tsx` — Project scope dropdown using shadcn/ui Select. "All Projects" default. Persist selection to localStorage with `gitops-dashboard:projectScope` key. Load from localStorage on mount.
- [ ] 4.3 Create `frontend/src/components/layout/environment-filter.tsx` — Environment filter (DEV/STAGE/PROD toggle). Region filter (East/West/Both toggle). Persist to localStorage.
- [ ] 4.4 Create `frontend/src/components/layout/data-freshness.tsx` — "Last updated" timestamp component per PRD §5.4. Shows "Unknown" with last refresh time when connector is unavailable.
- [ ] 4.5 Update `frontend/src/App.tsx` — Wire dashboard layout with React.lazy module loading, Suspense with skeleton fallback, and error boundaries per module (TECH-STANDARDS §2).
- [ ] 4.6 Create `frontend/src/hooks/use-project-scope.ts` — Custom hook managing project selection state, localStorage persistence, and namespace resolution (returns project's namespace(s) for downstream queries).

## 5. Module 1 — App Status

- [ ] 5.1 Create `frontend/src/components/app-status/app-status-module.tsx` — Module wrapper with error boundary, data fetching via React Query, Platform View vs Project View switching based on project scope.
- [ ] 5.2 Create `frontend/src/components/app-status/app-status-grid.tsx` — Data grid with columns: App Name, DEV-East, DEV-West, STAGE-East, STAGE-West, PROD-East, PROD-West. Each cell shows health/sync badge with colour + text (TECH-STANDARDS §2 Accessibility — not colour alone).
- [ ] 5.3 Create `frontend/src/components/app-status/status-badge.tsx` — Reusable badge component: Healthy (green + checkmark), Degraded (amber + warning), Error (red + cross), Unknown (grey + question mark). Uses shadcn/ui Badge.
- [ ] 5.4 Create `frontend/src/components/app-status/appset-group.tsx` — Collapsible ApplicationSet parent row with aggregate health summary (e.g., "5/6 Healthy") and nested child Application rows. Uses shadcn/ui Collapsible.
- [ ] 5.5 Create `frontend/src/components/app-status/app-search.tsx` — Text search input filtering applications by name in real time. Uses shadcn/ui Input.
- [ ] 5.6 Integrate `@tanstack/react-virtual` for virtualised scrolling of the 850+ app list in Platform View.
- [ ] 5.7 Create `frontend/src/hooks/use-app-status.ts` — React Query hook calling argocd mock endpoints. Uses query key factory from query-keys.ts. refetchInterval: 1,800,000ms.

## 6. Module 2 — Image Promotion

- [ ] 6.1 Create `frontend/src/components/image-promotion/image-promotion-module.tsx` — Module wrapper with error boundary and data fetching.
- [ ] 6.2 Create `frontend/src/components/image-promotion/promotion-grid.tsx` — Grid showing app name + image tag at each of 6 pipeline steps. Amber highlight on tag mismatches between adjacent steps (PRD IP-02). Warning icon on non-semver tags (PRD IP-03).
- [ ] 6.3 Create `frontend/src/components/image-promotion/tag-cell.tsx` — Individual cell component: displays tag, highlights if mismatched, shows warning if non-semver.
- [ ] 6.4 Create `frontend/src/hooks/use-image-promotion.ts` — React Query hook for image data.

## 7. Module 3 — Metrics

- [ ] 7.1 Create `frontend/src/components/metrics/metrics-module.tsx` — Module wrapper with error boundary. Platform View shows namespace-level, Project View shows workload-level.
- [ ] 7.2 Create `frontend/src/components/metrics/cpu-memory-table.tsx` — Table showing CPU/memory usage per namespace (Platform) or per workload (Project). Includes sparkline column.
- [ ] 7.3 Create `frontend/src/components/metrics/sparkline-chart.tsx` — Recharts-based sparkline component. 10 data points. Includes `aria-label` with trend summary for accessibility (TECH-STANDARDS §2).
- [ ] 7.4 Create `frontend/src/components/metrics/quota-bar.tsx` — Quota utilisation bar (current usage / limit). Uses shadcn/ui progress-style component.
- [ ] 7.5 Create `frontend/src/components/metrics/oom-event-list.tsx` — OOM event table: pod name, container name, memory at kill, limit, timestamp. Project View scoped.
- [ ] 7.6 Create `frontend/src/hooks/use-metrics.ts` — React Query hooks for CPU, memory, quota, OOM endpoints.

## 8. Module 4 — Network Status

- [ ] 8.1 Create `frontend/src/components/network-status/network-module.tsx` — Module wrapper with error boundary. Platform View shows all namespaces, Project View shows project namespace only.
- [ ] 8.2 Create `frontend/src/components/network-status/policy-list.tsx` — Table of NetworkPolicy objects per namespace. Open egress warning badge on namespaces without egress restriction (PRD NS-02).
- [ ] 8.3 Create `frontend/src/components/network-status/cilium-summary.tsx` — Cilium L3/L4 drop counts: ingress drops, egress drops, TCP resets. Aggregated by source/dest namespace pair.
- [ ] 8.4 Create `frontend/src/components/network-status/denied-connections-table.tsx` — Denied connections: direction, source namespace, destination namespace, protocol, port, drop count, reset count, policy verdict (PRD NS-04).
- [ ] 8.5 Create `frontend/src/hooks/use-network-status.ts` — React Query hooks for network policy and Cilium endpoints.

## 9. Docker Verification

- [ ] 9.1 Verify `docker build -t gitops-dashboard/frontend:mock .` builds successfully from the frontend directory with MSW baked in.
- [ ] 9.2 Verify `docker run -p 3000:8080 gitops-dashboard/frontend:mock` serves the complete dashboard with all 4 modules rendering mock data.
- [ ] 9.3 Verify all 4 modules are accessible via tab navigation in the running container.
- [ ] 9.4 Verify degraded state is visible — STAGE-West ArgoCD data shows "Unknown" with timestamp.
- [ ] 9.5 Verify project scope selector persists across page reload (localStorage).
