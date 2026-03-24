# Claude Acceleration Recommendations — Agentic Development Velocity

| Field     | Value                          |
| --------- | ------------------------------ |
| **Date**  | 2026-03-24                     |
| **Phase** | Pre-Methodology POC            |
| **Context** | After repo-scaffolding implementation + 2 full review cycles (pre-impl + post-impl) |

---

## Problem Statement

The project has strong foundations (PRD v2.1, TECH-STANDARDS v1.5, OpenSpec workflow, 6-discipline review process) but the documentation-to-code ratio is 6:1 and the review overhead per proposal is high. Two full review cycles of the repo-scaffolding change produced 78 findings across 12 review documents, taking ~40 minutes of agent time and significant human triage time. At this pace, the 15-week timeline for 4 phases is at risk.

The goal of these recommendations is to reduce ceremony while preserving quality — shift from "review everything exhaustively" to "build correctly the first time, verify quickly."

---

## Recommendation 1: Consolidate Agent Context into a Single Document

### Problem
Agents currently read CLAUDE.md (~50 lines) + PRD (~1,100 lines) + TECH-STANDARDS (~2,000 lines) = 3,100+ lines of preamble before starting any work. Most of this is reference material only needed for specific tasks.

### Solution
Create `docs/PROJECT-GUIDE.md` (~600-800 lines) as the single context document for agents. It contains:

- **What we're building** — 1-page PRD essence
- **Architecture** — connector topology, frontend, Redis, caching strategy
- **How we build** — OpenSpec lifecycle, review process, TDD, Git workflow
- **Technical rules** — the 20% of standards that prevent 80% of issues
- **Phase plan** — current phase, active proposals, gate conditions

CLAUDE.md becomes a short pointer (~30 lines) to PROJECT-GUIDE.md. The full PRD and TECH-STANDARDS remain as reference documents — read when needed, not preloaded into every agent.

### Impact
- Agent context window usage drops by ~70%
- Faster agent startup (less reading)
- More room for actual code and implementation context
- Reference docs still available for deep dives

---

## Recommendation 2: Reduce Review Cycle from 6 Reviewers to 1-2

### Problem
6 parallel reviewers per proposal gate, 2 gates per proposal (pre-impl + post-impl) = 12 review documents and ~78 findings per change. Many findings are duplicates across reviewers (e.g., "missing uv.lock" flagged by Python, K8s, DevOps, and Security). The review process takes longer than the implementation.

### Solution
**Single primary reviewer per proposal type + optional QA pass:**

| Proposal Type | Primary Reviewer | Rationale |
|---|---|---|
| Connector (Python backend) | Senior Python Engineer | Async patterns, Pydantic, httpx, Redis, structlog — the core of every connector |
| Frontend module | Senior Frontend Developer | React architecture, TypeScript, accessibility, React Query — the core of every UI change |
| Infrastructure / deploy | Senior K8s & ArgoCD Engineer | Manifests, probes, hardening, ArgoCD config |
| Security-sensitive change | Senior Security Engineer | Credentials, TLS, CSP, container hardening |
| CI/CD pipeline | Senior DevOps Engineer | Pipeline stages, Docker builds, Makefile |

**QA reviewer as lightweight second pass** on every proposal — focused on test coverage, TDD adherence, and spec testability. Quick pass, not a full audit.

### Review Timing
- **Pre-implementation**: Primary reviewer + QA review the proposal artifacts (design, spec, tasks)
- **Post-implementation**: Same reviewer + QA verify the implemented code

### Impact
- Review time drops from ~40 minutes (6 agents) to ~10 minutes (2 agents)
- Findings drop from ~78 to ~15-20 (higher signal, less duplication)
- Human triage time drops proportionally
- Quality maintained because the primary reviewer is the highest-value one for the change type

---

## Recommendation 3: Create Individual Reviewer Skills + Smart Router

### Problem
The monolithic `deep-proposal-review` skill always launches all 6 reviewers. There's no way to invoke a single reviewer or auto-select the right one.

### Solution
Create 7 skills:

| Skill | Purpose |
|---|---|
| `/review-python` | Single Python Engineer review |
| `/review-frontend` | Single Frontend Developer review |
| `/review-k8s` | Single K8s/ArgoCD Engineer review |
| `/review-security` | Single Security Engineer review |
| `/review-devops` | Single DevOps Engineer review |
| `/review-qa` | Single QA Test Engineer review |
| `/review` | Smart router: auto-selects 1-2 reviewers based on proposal type and changed files |

The `/review` skill is the primary entry point. It examines the proposal's impact section, determines the proposal type, and launches the right reviewer(s). The individual skills can be invoked directly when the user knows which reviewer they want.

### Impact
- Composable: invoke exactly the reviews you need
- Fast: 1-2 agents instead of 6
- Smart: the router removes the need for the user to think about which reviewer to pick

---

## Recommendation 4: Collapse Review-Fix Cycle into Implementation

### Problem
Current flow: propose → review → fix → implement → review → fix → archive (7 steps). Each review-fix cycle adds a round trip.

### Solution
New flow: **propose → implement (standards-aware) → quick review → archive** (4 steps).

The key insight: if the implementation agent has the standards in context and applies them during implementation, most review findings are prevented. The review becomes a verification pass, not a correction pass.

**How to achieve this:**
- The PROJECT-GUIDE.md gives the implementation agent all the rules it needs
- `make check-all` enforces everything tools can check (lint, typecheck, test, coverage)
- The 1-2 reviewer pass catches design judgment issues that tools can't

**The agent should be autonomous during implementation** — work through all tasks without stopping for approval on each one. The human reviews the complete output at the end.

### Impact
- Proposal lifecycle goes from 7 steps to 4
- Implementation is faster because the agent doesn't stop and wait
- Review findings drop because the agent builds correctly the first time
- Human involvement concentrated at the end (review output) rather than distributed (approve each task)

---

## Recommendation 5: Automate Standards Enforcement via Tooling

### Problem
Review findings like "ruff config missing S rule set" and "mypy not configured" are things that CI should catch, not human reviewers. Every standard that a tool can check should be a CI gate, freeing reviewers for design judgment.

### Solution
Split standards into two categories:

**Tool-enforced (don't review, just run `make check-all`):**

| Standard | Tool | Command |
|---|---|---|
| Python lint (19 rule sets) | Ruff | `make lint` |
| Python types (strict) | mypy | `make typecheck` |
| Frontend lint (6 plugins) | ESLint | `make lint-frontend` |
| Frontend types | TypeScript | `make typecheck-frontend` |
| Test coverage (90% Python, 80% frontend) | pytest-cov / vitest | `make test` |
| Secret detection | detect-secrets | pre-commit hook |
| Dockerfile best practices | Hadolint | `make lint-docker` (add this) |
| YAML validity | check-yaml | pre-commit hook |

**Human-reviewed (require judgment):**

| Concern | What the Reviewer Checks |
|---|---|
| API contract correctness | Do the Pydantic models match the PRD endpoint descriptions? |
| Error handling logic | Does graceful degradation work correctly? Cache fallback? |
| Architecture decisions | Is the service layer pattern correct? State management approach? |
| Accessibility design | Are colour + text indicators used? Keyboard navigation? |
| Security design | Are credentials in SecretStr? Is scrub_secrets in the chain? |

### Impact
- Reviewers focus on the 5-10 things that require judgment, not the 50 things tools should catch
- `make check-all` becomes the quality gate — if it passes, most standards are met
- Review documents get shorter and more focused

---

## Recommendation 6: Pre-populate Implementation Prompts with Patterns

### Problem
Generic task descriptions like "Create a component" leave the agent guessing about patterns. The agent then makes choices that may not align with standards, which the reviewer catches, which requires a fix cycle.

### Solution
Write fewer tasks with more embedded context. Instead of:

> "Create `frontend/src/components/metrics/sparkline-chart.tsx`"

Write:

> "Create `frontend/src/components/metrics/sparkline-chart.tsx` — Recharts-based sparkline, 10 data points, named export, props typed as `readonly` with explicit `ReactElement` return type, include `aria-label` with trend summary for a11y. Use Recharts `LineChart` with `ResponsiveContainer`, no axes, minimal styling."

The task becomes a micro-spec that an agent can implement correctly without consulting TECH-STANDARDS.md.

### Impact
- Fewer review findings because the agent has enough context to build correctly
- Tasks are self-contained — agents don't need to cross-reference other documents
- Reduces the need for the PROJECT-GUIDE to cover every pattern — the patterns are in the tasks

---

## Recommendation 7: Order Phase 0 After Methodology POC

### Decision (confirmed by project owner)

1. **Methodology POC** (next) — argocd-connector `/healthz` + `/apps` end-to-end
2. **Phase 0 — Mock UI Dashboard** — React frontend with MSW mock data
3. **Phase 1+** — Live connectors and integration

The POC validates the workflow before the team invests in the large frontend build. If the POC reveals issues (e.g., uv workspace quirks, Docker build failures, import path problems), they're fixed before 46 frontend tasks amplify them.

---

## Recommendation 8: Agent Autonomy During Implementation

### Decision (confirmed by project owner)

The agent should implement the full proposal autonomously — work through all tasks without stopping for per-task approval. The human reviews and tests the complete output at the end.

This means:
- `/openspec-apply-change` runs all tasks in sequence
- If the agent hits a genuine blocker (ambiguous requirement, missing dependency), it pauses and asks
- Otherwise it keeps going
- At the end, the human runs `make check-all`, reviews the diff, and tests Docker
- One review pass (1-2 reviewers) after implementation, not before

### Impact
- Fastest possible implementation cycle
- Human time concentrated on final review, not mid-stream approvals
- Review documents become the quality record, not a correction mechanism

---

## Summary of Changes to Implement

| Change | Action |
|---|---|
| Consolidated project guide | Create `docs/PROJECT-GUIDE.md`, slim down CLAUDE.md |
| Streamlined review | Create `/review` smart router + 6 individual reviewer skills |
| Remove 6-reviewer ceremony | Retire `deep-proposal-review` and `deep-implementation-review` as default workflow |
| Phase ordering | Methodology POC → Mock UI → Phase 1+ (already in PRD) |
| Agent autonomy | Implementation agent runs all tasks, human reviews at end |
| Tooling enforcement | `make check-all` is the quality gate, not review documents |
