## Context

The repo scaffold is complete (Phase 0, archived). The frontend directory has React 18, TypeScript strict, Vite, React Query v5, Tailwind CSS, Recharts, MSW, vitest, and the component directory structure. What's missing is the actual UI — the dashboard modules, navigation shell, mock data, and the visual experience that stakeholders will review.

The PRD (§5.2–5.3) defines four dashboard modules across two view modes (Platform View and Project View), with global navigation controls (project scope selector, environment filter, region filter). The mock UI must demonstrate all of this with realistic data density — 850+ applications, 6-step promotion pipeline, namespace-level and workload-level metrics, network policy inventory — so stakeholders can evaluate whether the layout, density, and interaction patterns meet their needs before any backend work begins.

The team has no React experience (PRD §6.1). The mock UI is their first substantial React code. Design decisions here set patterns for every subsequent module.

## Goals / Non-Goals

**Goals:**

- Build all 4 dashboard modules with realistic mock data as specified in PRD §5.3
- Demonstrate both Platform View and Project View with correct data granularity per PRD §5.2
- Implement the global navigation shell with persistent project scope selector (PRD §5.2, PS-04)
- Show degraded state handling (PRD §4.6 / DG-01) — at least one connector "unavailable" in mock data
- Produce a Docker image that runs standalone (`docker run -p 3000:8080`) with no backend dependencies
- Establish React component patterns (error boundaries, suspense, code splitting) that future proposals extend
- Initialize shadcn/ui for consistent component styling

**Non-Goals:**

- No live connector integration — all data comes from MSW mock handlers
- No real API client generation — mock handlers return static fixtures matching the expected OpenAPI response shapes
- No authentication/SSO — the mock UI is unauthenticated
- No backend connector changes — this is a frontend-only change
- No Kubernetes deployment — runs locally via Docker or `npm run dev`
- No automated tests for visual correctness — stakeholder review is the gate (tests come in PROP-02)

## Decisions

### 1. MSW for mock data, not a mock backend server

Use MSW (Mock Service Worker) to intercept `fetch` calls in the browser and return static JSON. This runs entirely in the frontend — no need to start connector containers for the mockup.

**Alternative considered:** Running connector containers with mock mode (e.g., `MOCK_DATA=true` env var). Rejected because it requires building and running 3+ Docker containers for a UI-only mockup, adds complexity, and couples the mockup to backend code that doesn't exist yet.

**TECH-STANDARDS §2 alignment:** MSW is already in the frontend dev dependencies and has a handlers directory structure (`src/mocks/handlers/`).

### 2. Mock data as TypeScript fixtures, not JSON files

Define mock data as typed TypeScript constants (e.g., `mockApplications: ApplicationStatus[]`) co-located with MSW handlers. Types are hand-written to match the expected OpenAPI response shapes (from PRD §4.3–4.5 endpoint descriptions).

**Alternative considered:** JSON fixture files in `public/`. Rejected because TypeScript constants get type-checked — a typo in a mock response field is caught at compile time. JSON files would silently diverge from the actual API shape.

### 3. shadcn/ui initialization with project design tokens

Run `npx shadcn@latest init` to set up the component library. Configure the status color tokens (healthy/degraded/error/unknown) from `tailwind.config.ts` as CSS variables that shadcn/ui components reference.

**Alternative considered:** Building all components from raw Tailwind without shadcn/ui. Rejected — PRD §5.1 specifies shadcn/ui, and the team has no React experience. A component library reduces the number of decisions per component.

### 4. Code splitting per module via React.lazy

Each dashboard module (App Status, Image Promotion, Metrics, Network Status) is a lazily loaded route component per TECH-STANDARDS §2 (Frontend Performance — Code Splitting). The shell and navigation load immediately; module code loads on navigation.

### 5. Virtualised scrolling for the 850+ app list

The App Status and Image Promotion grids use `@tanstack/react-virtual` per TECH-STANDARDS §2 (Large List Virtualisation). Only visible rows are rendered. The mock data generates 850+ application records to validate performance at realistic scale.

### 6. Mock data generation strategy

Generate mock data programmatically from a seed configuration, not hand-written per-app. The seed defines:
- 5 ArgoCD projects (e.g., `platform-infra`, `payment-service`, `auth-service`, `notification-service`, `data-pipeline`)
- Each project has 2-4 ApplicationSets
- Each ApplicationSet generates 6 Applications (one per env×region)
- Total: ~120-180 apps from ApplicationSets + ~700 standalone apps = 850+ total
- Statuses distributed: ~80% Healthy/Synced, ~10% Degraded/OutOfSync, ~5% Unknown, ~5% Error
- One connector "unavailable" in mock to demonstrate degraded state

### 7. Single Docker image with MSW baked in

The production frontend Dockerfile already builds and serves via nginx. For the mock UI, MSW is initialized in `main.tsx` before React renders — it intercepts all API calls without any backend. The same Docker image works for both local dev and stakeholder demo.

**Alternative considered:** A separate Dockerfile for mock mode. Rejected — unnecessary complexity. MSW can be conditionally enabled via a build flag or env var, but for Phase 0 mock mode is the only mode.

## Risks / Trade-offs

**Mock data shapes may diverge from actual API responses** → When PROP-01 generates real OpenAPI specs, the mock data types will need updating. Mitigated by defining TypeScript interfaces that closely match the PRD endpoint descriptions (§4.3–4.5). The divergence is expected and acceptable for a mockup.

**850+ mock records may be slow to generate at page load** → Mitigated by generating once at MSW initialization, not per-request. The data is static for the lifecycle of the page.

**shadcn/ui initialization modifies project files** → The `init` command may overwrite tailwind.config.ts and add files. We'll run it early and verify it doesn't break existing config.

**No automated visual regression tests** → Stakeholder sign-off is the Phase 0 gate. Automated visual tests (if needed) come later. The mock UI establishes the visual baseline that future proposals are compared against.

## Open Questions

- Should the mock UI include a dark mode toggle, or is light mode sufficient for the Phase 0 stakeholder review?
- How many of the 850+ apps should have non-semver image tags (for the IP-03 warning indicator)?
- Should the Cilium flow data mock include realistic source/dest namespace pairs, or are generic placeholder pairs sufficient?
