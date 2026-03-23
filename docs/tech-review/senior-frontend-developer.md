---
reviewer: Senior Front End Developer
proposal: repo-scaffolding
date: 2026-03-23
status: Review Complete
---

# Senior Front End Developer — Review: repo-scaffolding

## Summary

The repo-scaffolding proposal establishes a Phase 0 monorepo skeleton for the GitOps Dashboard. From a frontend perspective, the proposal covers the basics (React 18, TypeScript, Vite, Tailwind, Recharts, React Query v5) but has significant gaps when measured against TECH-STANDARDS.md v1.5 Section 2. The scaffold tasks define 12 frontend subtasks (5.1-5.12), which cover dependency declarations, build tooling configs, a placeholder app, and a Dockerfile. However, the standards document is highly prescriptive -- intentionally so, given the team's lack of React experience -- and the proposal omits many of the guardrails that the standards mandate be present from day one. A scaffold that ships without these guardrails will result in early code being written without the safety nets the standards were designed to provide.

The critical theme across findings: the standards define specific compiler flags, ESLint plugins, testing infrastructure, accessibility tooling, security headers, runtime configuration patterns, and React Query defaults that are absent from the scaffold tasks. These are not "nice to have later" items -- they are foundational configs that become exponentially harder to retrofit once code is written on top of a looser foundation.

## Critical Findings

### Finding FE-1: tsconfig.json missing five mandatory strict flags

- **Artifact**: tasks.md
- **Location**: Task 5.3
- **Issue**: Task 5.3 specifies `tsconfig.json` with "strict mode enabled, JSX react-jsx, and path aliases." TECH-STANDARDS.md Section 2 requires five additional compiler flags beyond `strict: true`: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `forceConsistentCasingInFileNames`, and `verbatimModuleSyntax`. The spec.md acceptance criterion only checks `compilerOptions.strict === true`.
- **Impact**: High. The team has no React experience. If these flags are not present from the first commit, all early code will be written without them. Enabling `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` retroactively on an existing codebase produces hundreds of type errors. This is the single most painful flag to add after the fact because every array access and optional property in every component must be updated. The standards explicitly call out `noUncheckedIndexedAccess` as "critical for a dashboard consuming external data."
- **Recommendation**: Amend Task 5.3 to explicitly list all seven flags. Update spec.md to assert the presence of each flag individually. The tsconfig.json should include at minimum:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "noPropertyAccessFromIndexSignature": true,
      "forceConsistentCasingInFileNames": true,
      "verbatimModuleSyntax": true
    }
  }
  ```

### Finding FE-2: ESLint config missing four of six required plugins

- **Artifact**: tasks.md
- **Location**: Task 5.6
- **Issue**: Task 5.6 specifies `.eslintrc.cjs` with "TypeScript parser, React rules, and Prettier integration." TECH-STANDARDS.md Section 2 mandates six specific ESLint plugins: `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react`, `eslint-plugin-jsx-a11y`, `eslint-plugin-security`, and `eslint-plugin-import`. The task description implies only `@typescript-eslint` and basic React rules. The `jsx-a11y`, `security`, and `import` plugins are not mentioned. These plugins must also be listed as devDependencies in Task 5.1's package.json.
- **Impact**: High. The `jsx-a11y` plugin is the primary automated accessibility enforcement mechanism (WCAG 2.1 AA compliance, Section 2 Accessibility Standards). The `security` plugin catches DOM XSS patterns and is called out as a CI security gate in Section 12.7. The `import` plugin enforces import ordering and catches circular dependencies. Without these from the start, early code will establish patterns that violate accessibility and security standards, requiring expensive rework.
- **Recommendation**: Amend Task 5.6 to explicitly enumerate all six plugins. Amend Task 5.1 to include `eslint-plugin-jsx-a11y`, `eslint-plugin-security`, and `eslint-plugin-import` as devDependencies. Also add the `eslint-plugin-react-hooks` plugin explicitly (the standards call it out separately from `eslint-plugin-react`). The ESLint config should also enforce the "no default exports" rule and "no prop spreading" rule from the standards.

### Finding FE-3: No testing infrastructure in scaffold

- **Artifact**: tasks.md
- **Location**: Task 5 (all subtasks)
- **Issue**: There is no task for setting up Vitest, React Testing Library, MSW, vitest-axe, or the test QueryClient wrapper. TECH-STANDARDS.md Section 8 (Frontend) specifies the exact testing stack: "Vitest + React Testing Library + MSW (Mock Service Worker)." It also specifies MSW mock handler directories (`frontend/src/mocks/handlers/`), a test QueryClient factory function, and axe-core integration via vitest-axe. None of these appear in any task. The directory structure (Task 5.11) creates `api/`, `components/`, `hooks/`, `lib/` but not `mocks/` or `__tests__/`.
- **Impact**: Critical. The project follows TDD (Section 8: "Tests are written before implementation code"). If the scaffold ships without testing infrastructure, the very first implementation proposal cannot follow TDD because there is no test runner configured. This is a Phase 0 blocker for Phase 1 work. The team, having no React experience, needs the testing patterns established before they write their first component.
- **Recommendation**: Add new tasks:
  - 5.13: Add Vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, msw, vitest-axe as devDependencies in package.json
  - 5.14: Create `vitest.config.ts` (or configure in vite.config.ts) with React Testing Library setup, coverage thresholds (80%), and src/api/ exclusion from coverage
  - 5.15: Create `frontend/src/mocks/handlers/` directory with .gitkeep and a `frontend/src/mocks/browser.ts` MSW setup file
  - 5.16: Create `frontend/src/test-utils.tsx` with the `createTestQueryClient()` and `renderWithQuery()` wrapper from Section 8
  - 5.17: Create `frontend/vitest.setup.ts` with React Testing Library cleanup and axe-core matchers

### Finding FE-4: No runtime configuration pattern (/config.json)

- **Artifact**: tasks.md, design.md
- **Location**: Task 5 (absent)
- **Issue**: TECH-STANDARDS.md Section 2 (Frontend Environment Configuration) mandates that the React app uses runtime configuration via `/config.json`, loaded at startup before React renders. This is a fundamental architectural decision: "The React app MUST NOT embed connector URLs at build time." The scaffold creates no config loading mechanism, no config type definition, and no config.json example file. The Dockerfile (Task 5.12) mentions nginx but does not reference serving a ConfigMap-mounted config.json.
- **Impact**: High. If the first implementation proposal builds components that import `VITE_*` environment variables for connector URLs, the entire configuration pattern must be rearchitected later. The standards are explicit: "VITE_* env vars are used only for the dev proxy config, never baked into production builds." Establishing the config.json pattern in Phase 0 prevents this wrong path.
- **Recommendation**: Add new tasks:
  - 5.18: Create `frontend/public/config.json` with the example schema from Section 2 (connector URLs for each environment)
  - 5.19: Create `frontend/src/lib/config.ts` with the Config type definition and a `loadConfig()` function that fetches `/config.json` at startup
  - 5.20: Update main.tsx to load config before calling `createRoot`, with an error screen if config fails to load

### Finding FE-5: Dockerfile missing nginx security headers and hardening

- **Artifact**: tasks.md
- **Location**: Task 5.12
- **Issue**: Task 5.12 specifies a "multi-stage build: Node for build, nginx for serve." TECH-STANDARDS.md Section 12.12 mandates specific nginx response headers (Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy) with exact values. Section 12.6 requires digest-pinned base images, non-root user (UID 1000), read-only root filesystem support, and dropped capabilities. Section 5 specifies `nginx:alpine` as the base. Section 12.3 mentions TLS requirements for nginx. None of these details are in the task description.
- **Impact**: High. A Dockerfile without security headers will pass the spec.md acceptance test ("Dockerfile produces nginx image serving built assets") but violate five security standards. If the Dockerfile is created without these headers, every subsequent security review will flag it, and retrofitting CSP headers after the fact often breaks the application because inline styles (Tailwind) and script loading must be accounted for.
- **Recommendation**: Amend Task 5.12 to include:
  - Use `nginx:alpine` with digest pinning as the final stage base image
  - Include a custom `nginx.conf` with all five security headers from Section 12.12
  - Configure non-root user (UID 1000) in the nginx container
  - Disable source maps in the Vite build step (`build.sourcemap: false`)
  - Add a health check endpoint (static file or stub location block)
  - Add a new task for creating `frontend/nginx.conf` with the full security header configuration

### Finding FE-6: No React Query QueryClient defaults configuration

- **Artifact**: tasks.md
- **Location**: Task 5.8 / 5.9
- **Issue**: TECH-STANDARDS.md Section 2 (React Query Configuration) provides exact QueryClient defaults that are mandatory: `staleTime: 30 * 60_000`, `gcTime: 60 * 60_000`, `retry: 2`, specific `retryDelay` with exponential backoff, `refetchOnWindowFocus: true`, `refetchOnReconnect: true`. It also mandates `refetchIntervalInBackground: false` on all polling queries and a query key factory in `query-keys.ts`. Tasks 5.8 and 5.9 create a "minimal React component" and "React 18 createRoot entry point" with no mention of QueryClient setup.
- **Impact**: Medium-High. If the first component proposal creates its own QueryClient with default settings (which include `staleTime: 0`, `retry: 3`), the polling and caching behavior will not match the connector TTL strategy. The query key factory pattern must be established before any data-fetching hooks are written.
- **Recommendation**: Add new tasks:
  - 5.21: Create `frontend/src/lib/query-client.ts` with the exact QueryClient configuration from Section 2
  - 5.22: Create `frontend/src/lib/query-keys.ts` with the query key factory pattern skeleton from Section 2
  - 5.23: Update App.tsx to wrap the app in `QueryClientProvider`

### Finding FE-7: No shadcn/ui initialization

- **Artifact**: tasks.md
- **Location**: Task 5 (absent)
- **Issue**: The proposal.md mentions shadcn/ui as a dependency, but there are no tasks for initializing it. shadcn/ui requires specific setup steps: running `npx shadcn-ui@latest init`, which creates a `components.json` configuration file, sets up the `cn()` utility function in `lib/utils.ts`, configures CSS variables in `globals.css`, and establishes the component installation path. It also requires `tailwind.config.js` to include the shadcn/ui theme configuration (CSS variables for colors, border-radius, etc.) and `class-variance-authority` + `clsx` + `tailwind-merge` as dependencies.
- **Impact**: Medium. Without proper shadcn/ui initialization, developers will not be able to install shadcn/ui components via the CLI (`npx shadcn-ui add button`). They may resort to copying component code manually or installing full component libraries, violating the dependency addition policy. The standards specify "Tailwind CSS + shadcn/ui for styling. No custom CSS unless shadcn/ui does not provide a suitable component."
- **Recommendation**: Add new tasks:
  - 5.24: Add `class-variance-authority`, `clsx`, `tailwind-merge` to package.json dependencies
  - 5.25: Create `frontend/components.json` with shadcn/ui configuration (style: "default", rsc: false, tsx: true, aliases matching tsconfig paths)
  - 5.26: Create `frontend/src/lib/utils.ts` with the `cn()` utility function
  - 5.27: Update `tailwind.config.js` to include shadcn/ui CSS variable theme configuration
  - 5.28: Create `frontend/src/styles/globals.css` with Tailwind directives and shadcn/ui CSS variables

### Finding FE-8: No error boundary setup (react-error-boundary)

- **Artifact**: tasks.md
- **Location**: Task 5.1 (absent from dependencies), Task 5.11 (absent from directory structure)
- **Issue**: TECH-STANDARDS.md Section 2 (Error Boundaries) mandates that "every dashboard module MUST be wrapped in an error boundary using `react-error-boundary`." The package is not listed in Task 5.1's dependencies. The directory structure (Task 5.11) does not include a location for shared error boundary components. The standards also require error boundary `onError` callbacks to forward errors to an error reporting service (Sentry or Azure App Insights).
- **Impact**: Medium. The team has no React experience and will not know to add error boundaries unless the pattern is established in the scaffold. Without error boundaries from the start, the first connector failure during development will crash the entire dashboard, which is exactly the failure mode the PRD Section 4.6 (Degraded State Behaviour) is designed to prevent.
- **Recommendation**: Add `react-error-boundary` to Task 5.1 dependencies. Add a new task to create a generic `frontend/src/components/error-boundary/module-error-fallback.tsx` skeleton that the four dashboard modules will use. This establishes the pattern before any modules are built.

### Finding FE-9: No error reporting integration placeholder

- **Artifact**: tasks.md
- **Location**: Task 5 (absent)
- **Issue**: TECH-STANDARDS.md Section 2 (Frontend Error Reporting) states: "Client-side errors MUST be captured" using "Sentry or Azure Application Insights JS SDK." Error boundary `onError` callbacks and React Query global `onError` callbacks must forward to this service. The scaffold has no placeholder for this integration.
- **Impact**: Low-Medium. While the actual integration can wait, the scaffold should at minimum establish the hook point so that error boundaries and QueryClient config reference it. Without this, the error boundary and QueryClient patterns will be set up without error forwarding, requiring rework.
- **Recommendation**: Add a placeholder `frontend/src/lib/error-reporting.ts` that exports a `reportError()` function (initially a console.error wrapper) that error boundaries and QueryClient can import from day one.

### Finding FE-10: Directory structure insufficient for module architecture

- **Artifact**: tasks.md
- **Location**: Task 5.11
- **Issue**: Task 5.11 creates four empty directories: `api/`, `components/`, `hooks/`, `lib/`. The PRD defines four dashboard modules (App Status, Image Promotion, Metrics, Network Status) plus shared layout components (shell, navigation, project selector). TECH-STANDARDS.md specifies code splitting via `React.lazy()` per module, error boundaries per module, and MSW mock handlers per connector. The flat directory structure provides no guidance on where modules, pages/routes, shared layout, mocks, styles, or types should live. For a team with no React experience, directory structure IS the architecture guide.
- **Impact**: Medium. Without a module-oriented directory structure, the team will put all components in a flat `components/` folder, making code splitting, error boundary wrapping, and independent module loading difficult to retrofit.
- **Recommendation**: Expand Task 5.11 to create:
  ```
  src/
    api/              # auto-generated clients
    components/
      layout/         # shell, nav, project selector
      shared/         # reusable UI primitives
    modules/
      app-status/     # lazy-loaded module
      image-promotion/
      metrics/
      network-status/
    hooks/
    lib/              # query-client, query-keys, config, utils, error-reporting
    mocks/
      handlers/       # MSW handlers per connector
    styles/
    types/
  ```

### Finding FE-11: Vite config missing sourcemap and build settings

- **Artifact**: tasks.md
- **Location**: Task 5.2
- **Issue**: Task 5.2 specifies `vite.config.ts` with "React plugin and proxy config for connector APIs." TECH-STANDARDS.md Section 2 mandates `build: { sourcemap: false }` in production builds (Section 12 - Source Maps). The standards also specify bundle size budgets (200KB initial, 100KB per chunk) which should be configured as build warnings. The proxy config should follow the runtime config pattern where `VITE_*` vars are used ONLY for dev proxy, not baked into production.
- **Impact**: Medium. Source maps in production expose component hierarchy and internal logic. Without explicit `sourcemap: false`, Vite defaults to no source maps in production mode, but the standard requires this to be explicitly configured as a guardrail against accidental enablement.
- **Recommendation**: Amend Task 5.2 to specify that vite.config.ts must include `build: { sourcemap: false }` explicitly and a comment referencing the bundle budget. Consider adding `rollupOptions.output.manualChunks` for vendor code splitting.

### Finding FE-12: Prettier line width mismatch risk

- **Artifact**: tasks.md
- **Location**: Task 5.7
- **Issue**: Task 5.7 specifies `.prettierrc` with "consistent formatting settings (semi, singleQuote, trailingComma)" but does not mention line width. TECH-STANDARDS.md Section 2 specifies "Line width: 100 (matches Python's 99)." Prettier defaults to 80. If the scaffold ships with Prettier's default, all early code will be formatted at 80 characters, requiring a bulk reformatting commit when the standard is enforced.
- **Impact**: Low-Medium. A formatting-only change, but it creates noise in git history and can be avoided by setting it correctly from the start.
- **Recommendation**: Amend Task 5.7 to explicitly set `printWidth: 100` in `.prettierrc`.

## Recommendations

### Recommendation FE-1: Create a "frontend foundation config" umbrella task

The 12 existing tasks (5.1-5.12) should be expanded to approximately 28 tasks covering all the gaps identified above. Group them into sub-phases:
- 5A: Build and compile config (package.json, tsconfig, vite, tailwind, postcss, prettier, eslint) -- Tasks 5.1-5.7 with amendments
- 5B: Application skeleton (index.html, main.tsx, App.tsx, config loading, QueryClient, error boundary) -- Tasks 5.8-5.10 with amendments plus new tasks
- 5C: Testing infrastructure (Vitest, RTL, MSW, vitest-axe, test utils) -- All new tasks
- 5D: Directory structure and shadcn/ui (module directories, shadcn init, globals.css) -- Task 5.11 expansion plus new tasks
- 5E: Container (Dockerfile, nginx.conf with security headers) -- Task 5.12 with amendments

### Recommendation FE-2: Add spec.md acceptance criteria for each standards requirement

The current spec.md only checks four things: package.json dependencies, tsconfig strict, pnpm dev starts, and Dockerfile produces nginx image. Add acceptance scenarios for:
- All five enhanced tsconfig flags are present
- All six ESLint plugins are configured
- Vitest runs with zero config errors
- nginx.conf contains all five security headers
- `build.sourcemap` is explicitly `false` in vite.config.ts
- `printWidth: 100` in .prettierrc
- QueryClient defaults match Section 2 values

### Recommendation FE-3: Add a "frontend onboarding" README or CONTRIBUTING section

Given the team has no React experience, include a brief `frontend/README.md` explaining:
- How to run the dev server and tests
- Where to put new components (module directories)
- The no-default-exports rule and why
- The runtime config pattern (not VITE_*)
- How to add a shadcn/ui component
- The query key factory pattern

This is not a standards requirement but would significantly reduce onboarding friction for a Python-experienced team.

### Recommendation FE-4: Add @tanstack/react-virtual to dependencies

TECH-STANDARDS.md Section 2 (Large List Virtualisation) specifies `@tanstack/react-virtual` for the 850+ application list. While the actual virtualised components come later, including the dependency in the scaffold ensures it is vetted and available when the App Status module is built.

### Recommendation FE-5: Add pre-commit hook configuration for frontend

TECH-STANDARDS.md Section 6 requires pre-commit hooks including `prettier --check` and `eslint` for frontend. The tasks.md does not include a `.pre-commit-config.yaml` or `lint-staged` configuration for frontend files. This should be included in the root config tasks (Task 1), not just the frontend tasks.

## Observations

1. **pnpm vs npm inconsistency**: design.md Decision 4 chooses pnpm, but TECH-STANDARDS.md Section 3 says "npm (or pnpm if adopted)" and the Dockerfile standard (Section 5) specifies `npm ci && npm run build`. The proposal should make a definitive choice and ensure the Dockerfile, Makefile, and CI all use the same package manager. If pnpm is chosen, all references to `npm` in the standards should be reconciled.

2. **ESLint flat config**: The task specifies `.eslintrc.cjs` (legacy config format). ESLint 9+ uses flat config (`eslint.config.mjs`) by default. Since this is a greenfield project, starting with flat config avoids a migration later. Consider whether the scaffold should use `eslint.config.mjs` instead.

3. **Tailwind CSS v4 consideration**: Tailwind CSS v4 was released in early 2025 and uses a significantly different configuration model (CSS-based config instead of JS, no separate `postcss.config.js` needed). The tasks specify `tailwind.config.js` and `postcss.config.js` which are Tailwind v3 patterns. Clarify whether the project targets Tailwind v3 or v4, as this affects Tasks 5.4 and 5.5.

4. **Ruff config location conflict**: The proposal (Task 1.2) creates `ruff.toml` at repo root, but TECH-STANDARDS.md Section 1 states "All Ruff configuration lives in `pyproject.toml` under `[tool.ruff]`. No `ruff.toml` or `.ruff.toml` files." This is a Python concern but worth flagging as a cross-cutting inconsistency.

5. **No `.env.example` file**: The scaffold should include a `frontend/.env.example` documenting the dev-only `VITE_*` variables used for Vite proxy configuration, with clear comments that these are NOT used in production. This prevents the team from using VITE_* variables for runtime configuration.

## Standards Compliance

| Standard | Status | Notes |
|---|---|---|
| TypeScript `strict: true` | Partial | Task mentions strict mode but omits 5 additional mandatory flags |
| TypeScript `noUncheckedIndexedAccess` | Missing | Not mentioned in any task |
| TypeScript `exactOptionalPropertyTypes` | Missing | Not mentioned in any task |
| TypeScript `noPropertyAccessFromIndexSignature` | Missing | Not mentioned in any task |
| TypeScript `forceConsistentCasingInFileNames` | Missing | Not mentioned in any task |
| TypeScript `verbatimModuleSyntax` | Missing | Not mentioned in any task |
| ESLint `@typescript-eslint` | Present | Implied by "TypeScript parser" in Task 5.6 |
| ESLint `eslint-plugin-react-hooks` | Unclear | "React rules" may or may not include this |
| ESLint `eslint-plugin-react` | Unclear | "React rules" may or may not include this |
| ESLint `eslint-plugin-jsx-a11y` | Missing | Not mentioned |
| ESLint `eslint-plugin-security` | Missing | Not mentioned |
| ESLint `eslint-plugin-import` | Missing | Not mentioned |
| Prettier line width 100 | Missing | Not specified; Prettier defaults to 80 |
| No default exports rule | Missing | Not configured in ESLint |
| kebab-case file naming | Missing | No ESLint rule or convention enforced |
| React Query defaults (staleTime, gcTime, retry) | Missing | No QueryClient configuration task |
| Query key factory pattern | Missing | No query-keys.ts task |
| `refetchIntervalInBackground: false` | Missing | No polling configuration task |
| Runtime config via /config.json | Missing | No config loading task |
| No VITE_* in production builds | Missing | No guardrail established |
| Error boundaries (react-error-boundary) | Missing | Package not in dependencies |
| Code splitting (React.lazy) | Missing | No module structure to support it |
| Virtualised scrolling (@tanstack/react-virtual) | Missing | Package not in dependencies |
| Bundle budget (200KB) | Missing | No build budget configuration |
| Lighthouse CI targets | Missing | No Lighthouse configuration |
| WCAG 2.1 AA (eslint-plugin-jsx-a11y) | Missing | Plugin not configured |
| axe-core testing (vitest-axe) | Missing | No testing infrastructure |
| Vitest + React Testing Library + MSW | Missing | No testing infrastructure |
| Test QueryClient wrapper | Missing | No test utility task |
| MSW mock handlers directory | Missing | Not in directory structure |
| No unsafe HTML rendering (react/no-danger) | Missing | ESLint rule not configured |
| localStorage namespace prefix | Missing | No convention established |
| Source maps disabled in prod | Missing | Not in vite.config.ts task |
| Error reporting (Sentry / App Insights) | Missing | No placeholder |
| shadcn/ui initialization | Missing | No setup tasks |
| nginx security headers (CSP, X-Frame-Options, etc.) | Missing | Not in Dockerfile task |
| nginx non-root user | Missing | Not in Dockerfile task |
| Digest-pinned base images | Missing | Not in Dockerfile task |
| Pre-commit hooks (prettier, eslint) | Missing | No frontend hooks configured |
| Dependency addition policy | N/A | Policy standard, not a config item |
