# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Quick Start

**Read `docs/PROJECT-GUIDE.md` first.** It contains the consolidated project context, architecture, technical rules, and workflow — everything you need to start contributing.

## Project

GitOps Dashboard — read-only reporting dashboard for ArgoCD, Prometheus, and Kubernetes NetworkPolicy across 6 AKS clusters (3 environments × 2 regions).

**Status**: Methodology POC in progress. Repo scaffold complete. Mock UI proposed.

## Current Phase

**Methodology POC** — Build argocd-connector `/healthz` + `/apps` end-to-end to validate the OpenSpec lifecycle before committing to the full build. See `openspec/changes/methodology-poc/`.

## Critical Rules

- **Python package manager**: `uv` — never `pip`
- **Cache TTL**: 30 minutes uniform across all connectors
- **Quality gate**: `make check-all` must pass (lint + typecheck + test)
- **Agent autonomy**: Implement full proposals autonomously. Human reviews at the end.
- **Reviews**: Use `/review` (smart router) — auto-selects 1-2 expert reviewers. Not 6.

## Key Documents

| Document | Purpose |
|---|---|
| `docs/PROJECT-GUIDE.md` | **Primary context** — architecture, rules, workflow |
| `docs/PRD-gitops-dashboard.md` | Full product requirements (reference for deep dives) |
| `docs/TECH-STANDARDS.md` | Full technical standards (reference for specific rule lookups) |
| `docs/CLAUDE-FEEDBACK.md` | Project assessment, pros/cons, MVP likelihood |
| `docs/CLAUDE-ACCELERATION-RECOMMENDATIONS.md` | Process improvement recommendations |
| `openspec/changes/` | Active proposals |
| `openspec/changes/archive/` | Completed proposals |

## OpenSpec Workflow

```
propose → implement (standards-aware) → review (1-2 experts) → archive
```

Skills: `/openspec-propose`, `/openspec-apply-change`, `/review`, `/openspec-archive-change`
