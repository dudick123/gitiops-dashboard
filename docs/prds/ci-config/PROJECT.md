# CI Kustomize Rendered Manifests Pipeline — Agent Context

**PRD:** PRD-2026-CI-RENDER-001 v0.5.0 | **Platform:** Azure DevOps + AKS + ArgoCD/Akuity

## What This Is

A v2 CI pipeline that renders Kustomize (and Helm for system workloads) at CI time and commits fully hydrated YAML to `manifests/<env>-<region>/`. ArgoCD watches that path and applies plain YAML — no rendering at sync time. One pipeline YAML per tenant+app; no multi-tenant batching.

## Pipeline Model

**Two pipelines per workload:**

- **PR validation** — fires on every push to PR branch; renders + diffs; posts diff as PR comment (edit-in-place); no commit. Merge is blocked until this pipeline reports Succeeded and branch is up-to-date with main.
- **Post-merge** — fires on push to main (excludes `manifests/**`); commits rendered output; optionally triggers ArgoCD sync.

**Tier execution:** dev → nonprod → prod (sequential). Within each tier, eus and wus3 render in parallel. Any regional failure fails the tier and blocks the next tier.

## Key Facts

| Fact | Value |
| --- | --- |
| Environment matrix | `dev-eus`, `dev-wus3`, `nonprod-eus`, `nonprod-wus3`, `prod-eus`, `prod-wus3` |
| Workload classes | `system` (Helm + Kustomize) and `tenant` (Kustomize only) — set by `workloadClass` param hardcoded in pipeline YAML |
| Source path | `templates/<env>-<region>/` |
| Rendered output path | `manifests/<env>-<region>/` |
| Tenant source | `templates/<env>-<region>/tenants/<name>/` |
| System source | `templates/<env>-<region>/system/` |
| CRD output | `manifests/<env>-<region>/system/crds/` (separate pre-existing ArgoCD Application) |
| Git tag format | `rendered-<tenant>-<app>-<env>-<region>-<build-number>` |
| Artifact retention | 30 days |
| Dev tier gate | Both dev-eus + dev-wus3 ArgoCD apps Synced+Healthy, 10-minute polling timeout |
| nonprod/prod gate | ADO ManualValidation (default 4h timeout); timeout = pipeline failure |

## Hard Failures (unconditional — dryRun does not exempt)

- Gitleaks HIGH/CRITICAL finding in source or rendered output
- Kind: Secret object in rendered output
- Unresolved variable placeholders (`$(` or `${`) in rendered output
- kubeconform unknown resource kind (no `--ignore-missing-schemas`)
- Kyverno CRITICAL policy violation
- `helmCharts:` entry in any tenant kustomization file
- `workloadClass` value mismatches source path prefix

## Tools

All versions pinned via the `platform-tool-versions` ADO variable group. Binaries are cached as a named pipeline artifact in Stage 1 and reused by all downstream jobs — never re-downloaded per job.

| Tool | Purpose | Notes |
| --- | --- | --- |
| `kustomize` | Renders Kustomize overlays into plain YAML | `--enable-helm` flag used for `system` workloads only; never for `tenant` workloads |
| `helm` | Helm chart rendering (via kustomize) | Installed only when `workloadClass=system`; must not be present in tenant runs |
| `yq` (mikefarah) | Splits rendered output into one file per resource; stable field sorting | Filename convention: `<kind>-<name>.yaml` (lowercase) |
| `kubeconform` | Schema validation of rendered manifests against platform schema registry | Run with `--strict`; no `--ignore-missing-schemas`; unknown kinds are hard failures |
| `kyverno CLI` | Policy checks against source dry-run output (Stage 2) and fully rendered output (Stage 4) | Policy bundle pulled as versioned OCI artifact from ACR; CRITICAL violations fail the pipeline |
| `gitleaks` | Secret scanning at two independent layers: source files (Stage 2) and rendered YAML (Stage 4) | Uses custom Kubernetes ruleset (stringData, env var patterns, base64 data fields); HIGH/CRITICAL fail unconditionally including in dryRun |
| `dyff` | Structured human-readable diff between incoming rendered output and current `manifests/` path | Primary diff signal; supplemented by a git diff summary (files changed, lines added/removed) |
| `argocd CLI` | Optional explicit sync of ArgoCD Applications after commit (Stage 6) | Authenticated via scoped token from ADO variable group; scoped to sync/wait/get only |

## Key Conventions

- Rendered output: one file per resource, `<kind>-<name>.yaml` (lowercase), stable field sort, noise stripped (`creationTimestamp: null`, `status: {}`)
- Kyverno policy bundle: versioned OCI artifact from ACR
- ArgoCD token: ADO variable group environment variable (scoped to sync/wait/get only)
- Diff comments: edit-in-place per environment tier (one comment per tier per PR)
- Notifications: opt-in; Teams webhook + email configured as optional pipeline parameters
- Gitleaks baseline: per-repo, bootstrapped by tenant team at onboarding
- Secret values never appear in logs — redacted match snippet only

## Hard Dependencies Before Rollout

1. Kyverno HA deployed + policy bundle published as OCI artifact to ACR
2. Platform schema registry populated (Kubernetes core + ESO/Kyverno/Cilium/Envoy Gateway + in-house CRDs)
3. ADO branch policy on main: PR validation Succeeded + branch up-to-date
4. ADO system access token with tag-write permission granted
5. ArgoCD service account token in ADO variable group
6. All tenant ArgoCD Applications labeled `env=<env>` and `region=<region>`
7. Per-repo Gitleaks baseline suppression file committed

## Full Reference

`docs/prds/ci-config/PRD.md`
