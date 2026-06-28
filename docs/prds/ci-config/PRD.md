# PRD: CI Kustomize Rendered Manifests Pipeline — v2 Architecture

**Document ID:** PRD-2026-CI-RENDER-001
**Document Status:** Draft
**Version:** 0.5.0
**Owner:** Platform Engineering
**Last Updated:** 2026-06-27

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals and Non-Goals](#3-goals-and-non-goals)
4. [Users and Stakeholders](#4-users-and-stakeholders)
5. [Success Metrics](#5-success-metrics)
6. [Architecture](#6-architecture)
7. [Pipeline Stages](#7-pipeline-stages)
8. [Functional Requirements](#8-functional-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Constraints and Assumptions](#10-constraints-and-assumptions)
11. [Dependencies](#11-dependencies)
12. [Open Questions](#12-open-questions)
13. [Revision History](#13-revision-history)
14. [Appendix: Including In-House CRD Schemas in the Platform Schema Registry](#14-appendix-including-in-house-crd-schemas-in-the-platform-schema-registry)

---

## 1. Overview

This document defines requirements for a **v2 CI-driven Kubernetes manifest rendering pipeline** implementing the Rendered Manifests Pattern on the AKS-based multi-tenant GitOps platform. The v2 architecture supersedes the existing scattered pipeline implementation, establishing a single, opinionated, best-practice standard for all manifest generation across the platform.

The pipeline renders Kustomize source at CI time and commits fully hydrated YAML to a canonical manifests path consumed by ArgoCD/Akuity. ArgoCD operates as a pure reconciler with no rendering responsibility at sync time. A structured diff review is surfaced to the PR author before merge; a human-in-the-loop gate separates diff review from commit. Secret scanning runs against both source and rendered output to enforce that no credential values reach the config repository.

The pipeline is scoped to **one tenant and one application per run**. Each tenant+application pair has its own pipeline YAML in the config repository with the tenant name and application name hardcoded. There is no multi-tenant or multi-application batch rendering. The pipeline supports two workload classes — **system** (platform-managed; Helm is used exclusively for system workloads) and **tenant** (Kustomize-only) — across a matrix of environments and regions expressed as short-form codes. The full environment × region matrix is: `dev-eus`, `dev-wus3`, `nonprod-eus`, `nonprod-wus3`, `prod-eus`, `prod-wus3`.

Environment tiers execute **sequentially** (dev → nonprod → prod) to minimize the window during which a given environment may be out of sync in ArgoCD. Within each tier, the two regional variants render in parallel. Any regional failure within a tier fails the entire tier and blocks progression to the next tier.

> **Scope boundary:** This PRD covers the CI manifest rendering pipeline only. ArgoCD Application and ApplicationSet definitions, tenant onboarding automation, and the Kyverno policy rollout are governed by their respective PRDs. Image building, scanning, and signing are governed by the v3 ADO pipeline templates PRD.

---

## 2. Problem Statement

The platform manifest generation process has evolved organically across two years of platform maturity. The result is an inconsistent set of pipeline patterns spread across multiple repositories with no single authoritative reference implementation.

**Scattered implementation.** Manifest generation logic exists in multiple forms — some overlays rendered by ArgoCD at sync time, others by ad-hoc pipeline steps — with no consistent pattern. Onboarding a new environment or region requires manual archaeology rather than a documented procedure.

**No v2 architecture standard.** There is no canonical best-practice reference for how manifest generation should work on this platform, for either public (tenant-facing) or internal (platform engineering) documentation. The v2 pipeline is the opportunity to establish that standard.

**Visibility gap.** The desired state stored in Git is Kustomize source, not the manifests that will be applied to the cluster. Reviewers must mentally resolve overlays and Helm renders to understand what will actually change — a skill-intensive and error-prone process at scale across 100 tenants.

**Rendering inconsistency.** ArgoCD's bundled Kustomize version and Helm chart caching behavior are Akuity-managed. Mismatch between local developer renders and ArgoCD renders has caused silent divergence between expected and actual cluster state.

**Auditability gap.** There is no immutable record of exactly what manifests were applied to a cluster at a given time. Incident retrospectives require reconstructing rendered output from source commits — time-consuming and imprecise.

**Secret hygiene risk.** There is no systematic enforcement that credential values are absent from the commit stream. No scanning exists to catch secrets injected as environment variables directly in manifests or accidentally committed. The only safeguard is convention.

**Policy enforcement gap.** Kyverno admission control catches violations at apply time inside the cluster. No pre-apply policy gate in CI prevents non-compliant manifests from reaching the cluster.

---

## 3. Goals and Non-Goals

### Goals

- **G-1:** Establish a canonical v2 manifest generation pipeline serving as the platform best-practice reference for public and internal documentation.
- **G-2:** Render Kustomize source in CI and commit hydrated YAML to `manifests/<env>-<region>/` as the ArgoCD Application source path.
- **G-3:** Enforce a hard separation between system overlays (Helm-enabled; system workloads only) and tenant overlays (Kustomize-only) at the pipeline level, controlled by an explicit workloadClass parameter hardcoded in the per-workload pipeline YAML.
- **G-4:** Surface a structured, human-readable diff to the PR author pre-merge across all environment tiers, with a human-in-the-loop approval gate for nonprod and prod.
- **G-5:** Enforce pre-commit Kyverno CLI policy checks against rendered output, preventing non-compliant manifests from reaching the cluster.
- **G-6:** Enforce secret scanning on both source and rendered output to detect credential values, hardcoded secrets, and environment variables containing sensitive data before commit.
- **G-7:** Enforce a hard CI-time assertion that no raw Kind: Secret objects appear in rendered output, guaranteeing ESO + Azure Key Vault as the exclusive secret delivery path.
- **G-8:** Support the full environment × region matrix (`dev-eus`, `dev-wus3`, `nonprod-eus`, `nonprod-wus3`, `prod-eus`, `prod-wus3`), executing tiers sequentially (dev → nonprod → prod) with regional variants parallel within each tier.
- **G-9:** Provide an optional explicit ArgoCD sync stage with environment-appropriate health gates.
- **G-10:** Produce a dryRun mode that executes all validation, scanning, and diff steps without committing rendered output. Secret scanner HIGH/CRITICAL findings fail the pipeline unconditionally in dryRun mode.
- **G-11:** Provide an opt-in notification model supporting both Teams and email for pipeline stage failures, self-configured by tenants via pipeline parameters.

### Non-Goals

- **NG-1:** This pipeline does not replace ArgoCD as the reconciliation engine. ArgoCD remains the deployment controller.
- **NG-2:** This pipeline does not manage tenant onboarding or ArgoCD Application creation.
- **NG-3:** This pipeline does not manage secrets. ESO + Azure Key Vault is the exclusive secret delivery mechanism.
- **NG-4:** This pipeline does not perform image building, scanning, or signing (governed by v3 ADO pipeline templates PRD).
- **NG-5:** Multi-cluster rollout ordering and progressive delivery are out of scope. ArgoCD ApplicationSets govern cluster targeting.
- **NG-6:** This pipeline does not retroactively scan Git history for historical secret exposure. Historical scanning is a separate security initiative.
- **NG-7:** This pipeline does not batch-render multiple tenants or multiple applications in a single run. Scope is one tenant + one application per pipeline execution.
- **NG-8:** Live cluster diff (`kubectl diff`) against running cluster state is not in scope. Diff is Git-to-Git only.

---

## 4. Users and Stakeholders

| Role | Interest |
| --- | --- |
| Platform Engineering | Pipeline authors and operators; responsible for system overlay renders, pipeline maintenance, and the v2 reference architecture. Owns CRD authoring, schema generation, and registry publication. |
| Tenant Teams | Consumers of the pipeline; submit PRs that trigger tenant overlay renders for their application. Own their pipeline YAML, Gitleaks baseline file, and notification endpoint configuration. |
| Platform Lead | Approves nonprod and prod render commits and ArgoCD sync gates; accountable for v2 architecture adoption. |
| Security / Compliance | Interested in secret scanning, Kyverno policy gate, and Kind: Secret exclusion as pre-apply controls. |
| Akuity / ArgoCD | Downstream consumer of rendered output at manifests/\<env\>-\<region\>/; no longer performs rendering. |

---

## 5. Success Metrics

| ID | Metric | Target |
| --- | --- | --- |
| SM-1 | All manifest generation follows the v2 pipeline pattern. | 100% of platform and tenant Applications using the v2 pipeline. |
| SM-2 | Rendered manifest diff surfaced to PR author before merge. | 100% of pipeline runs producing a non-empty diff. |
| SM-3 | No raw Kind: Secret objects in rendered output reach the config repository. | Zero incidents post-rollout. |
| SM-4 | No credential values detected by secret scanner in source or rendered output. | Zero HIGH/CRITICAL secret scanner findings reach commit. |
| SM-5 | Kyverno CLI policy gate blocks non-compliant manifests before cluster apply. | Zero CRITICAL policy violations reach ArgoCD. |
| SM-6 | ArgoCD rendering disabled for all Applications covered by this pipeline. | 100% of in-scope Applications use manifests/\<env\>-\<region\>/ as source. |
| SM-7 | Tenant overlay renders complete without --enable-helm flag. | Zero tenant kustomization files contain helmCharts: entries. |
| SM-8 | dryRun mode validated in all environments before production rollout. | Confirmed across dev, nonprod, prod prior to cutover. |
| SM-9 | Mean time from PR merge to rendered commit available for ArgoCD sync. | < 10 minutes for tenant overlays per environment tier; < 20 minutes for full sequential tier run. |

---

## 6. Architecture

### 6.1 Pattern and Pipeline-per-Workload Model

The pipeline implements the Rendered Manifests Pattern: Kustomize rendering (and Helm, exclusively for system workloads) occurs in CI. The output is fully hydrated, normalized YAML committed to manifests/\<env\>-\<region\>/. ArgoCD watches this path and applies plain YAML with no rendering at sync time.

**Pipeline-per-workload:** Each tenant+application pair has exactly one pipeline YAML in the config repository. The tenant name, application name, workload class, and source path are hardcoded in that YAML. This is a per-workload configuration artifact, not a shared multi-tenant runner.

The pipeline is triggered by two ADO events:

- **PR validation:** Fires on every push to the PR source branch. Renders manifests and surfaces a structured diff to the PR author as a PR comment. No commit is made during PR validation.
- **Post-merge push to main:** Commits the rendered output to manifests/\<env\>-\<region\>/ and optionally triggers an ArgoCD sync.

```text
PR Validation (pre-merge)                Post-Merge (main push)
+----------------------------+           +-----------------------------------+
| Stage 1: Setup             |           | Stage 1: Setup                    |
| Stage 2: Validate Source   |           | Stage 2: Validate Source          |
|                            |  merge    | Stage 3: Render (dev tier)        |
| Stage 3: Render (dev)      | --------> | Stage 4: Validate Rendered (dev)  |
| Stage 4: Validate (dev)    |           | Stage 4.5: Diff + Gate (dev)      |
| Stage 4.5: Diff (dev) ──── PR comment | Stage 5: Commit (dev)             |
|                            |           | Stage 6: ArgoCD Sync (dev)        |
| [nonprod tier: same]       |           | [nonprod tier: same]              |
| [prod tier: same]          |           | [prod tier: same]                 |
+----------------------------+           +-----------------------------------+
```

Environment tiers (dev, nonprod, prod) execute sequentially. Within each tier, the two regional variants (eus, wus3) are rendered as parallel jobs. Any regional failure within a tier fails the entire tier and blocks progression to the next tier.

### 6.2 Repository Path Conventions

| Concern | Path Convention | Example |
| --- | --- | --- |
| Kustomize source | templates/\<env\>-\<region\>/ | templates/dev-eus/, templates/prod-wus3/ |
| System overlay source | templates/\<env\>-\<region\>/system/ | templates/dev-eus/system/ |
| Tenant overlay source | templates/\<env\>-\<region\>/tenants/\<name\>/ | templates/prod-eus/tenants/payments/ |
| ArgoCD rendered output (root) | manifests/\<env\>-\<region\>/ | manifests/dev-eus/, manifests/prod-wus3/ |
| System rendered output | manifests/\<env\>-\<region\>/system/ | manifests/prod-eus/system/ |
| System CRD rendered output | manifests/\<env\>-\<region\>/system/crds/ | manifests/prod-eus/system/crds/ |
| Tenant rendered output | manifests/\<env\>-\<region\>/tenants/\<name\>/ | manifests/prod-eus/tenants/payments/ |

ArgoCD Applications point to manifests/\<env\>-\<region\>/ as their source path. No ArgoCD Application points to a templates/ path.

### 6.3 Workload Class Separation

Workload class (system or tenant) is hardcoded in the per-workload pipeline YAML as the `workloadClass` parameter. This parameter controls whether `--enable-helm` is passed to kustomize and which source path is targeted. The pipeline asserts in Stage 1 that the source path prefix is consistent with the declared workloadClass. Helm is used exclusively for system workloads. Tenant workloads use Kustomize only.

| Class | workloadClass Value | Kustomize Flag | Helm | Source Path | Rendered Path |
| --- | --- | --- | --- | --- | --- |
| System | system | --enable-helm | Required (system only) | templates/\<env\>-\<region\>/system/ | manifests/\<env\>-\<region\>/system/ |
| Tenant | tenant | (none) | Not permitted | templates/\<env\>-\<region\>/tenants/\<name\>/ | manifests/\<env\>-\<region\>/tenants/\<name\>/ |

The pipeline asserts at lint time that no file under templates/\<env\>-\<region\>/tenants/ contains a `helmCharts:` entry. This is a hard pipeline failure.

### 6.4 Environment Variable Resolution

All environment and region-scoped variables must be resolved before rendering. No unresolved placeholders may appear in rendered output. Resolution sources:

- ADO variable groups scoped per environment
- Kustomize replacements: for intra-manifest field substitution

Sensitive values are never injected into rendered YAML. ExternalSecret objects are rendered as-is; ESO resolves them against AKV at runtime after ArgoCD applies.

### 6.5 Secret Scanning Strategy

Secret scanning operates at two independent layers in the pipeline:

**Layer 1 - Source scan (Stage 2, pre-render).** Gitleaks scans the Kustomize source files changed by the triggering commit. Fast, offline, regex and entropy-based. Catches credentials hardcoded in base resources, patches, ConfigMaps, or environment variable fields before rendering begins.

**Layer 2 - Rendered output scan (Stage 4, post-render).** Gitleaks scans the fully rendered YAML before any diff or commit step. This catches secrets introduced or surfaced during Helm chart rendering that are not visible in source. This scan is independent of the source scan and targets rendered output specifically.

Both layers use a custom Gitleaks ruleset supplementing the default rules with Kubernetes-specific patterns:

- `stringData:` field values under any resource
- Environment variable entries whose names match secret patterns (`_PASSWORD`, `_TOKEN`, `_KEY`, `_SECRET`, `_CREDENTIAL`)
- Base64-encoded values in `data:` fields under Kind: Secret (belt-and-suspenders with FR-4.3)

The structural Kind: Secret assertion (FR-4.3) is a separate, complementary check. The scanner detects credential values; the structural assertion detects the resource kind. Both must pass.

HIGH and CRITICAL findings fail the pipeline unconditionally — including in dryRun mode.

### 6.6 Diff Review Gate

A structured diff is generated between incoming rendered output and the current manifests/\<env\>-\<region\>/ path before any commit. The diff is surfaced pre-merge as a PR comment during PR validation runs. The pipeline edits its previous diff comment (identified by a pipeline-owned marker string) rather than posting a new comment, keeping one diff comment per environment tier per PR. Three outcomes:

| Outcome | Condition | Action |
| --- | --- | --- |
| No-op exit | Normalized diff is empty | Pipeline exits successfully; no commit made; comment updated to reflect no changes. |
| Auto-proceed (dev) | dev environment; both dev-eus and dev-wus3 ArgoCD apps are Synced, Healthy, with no Progressing or Degraded resources within 10 minutes | Proceed to commit without manual gate. |
| Manual gate | nonprod or prod | Publish structured diff to PR comment; ManualValidation task pauses pipeline. Approve to commit; reject or timeout for pipeline failure. |

### 6.7 ArgoCD Sync (Optional)

When `triggerArgoSync=true`, the pipeline invokes explicit ArgoCD sync after commit using the ArgoCD CLI authenticated via a scoped service account token stored in the ADO variable group. The Kyverno policy bundle is pulled as a versioned OCI artifact from ACR, pinned via the `platform-tool-versions` variable group, ensuring no mid-run policy mutation. For dev, sync proceeds automatically after the ArgoCD health gate passes. For nonprod and prod, an additional ManualValidation gate precedes sync invocation. ArgoCD self-heals on its polling interval regardless — explicit sync is a fast-path optimization, not a requirement.

---

## 7. Pipeline Stages

### 7.1 PR Validation Pipeline (pre-merge)

Triggered on every push to the PR source branch. Branch policy on main requires this pipeline to report Succeeded before merge is allowed. Branch must also be up-to-date with main before merge.

| Stage | Name | Condition | Key Jobs |
| --- | --- | --- | --- |
| 1 | Setup | Always | ResolveTools, ValidateParameters, AssertWorkloadClassPathMatch |
| 2 | Validate Source | Stage 1 succeeded | LintSource, ScanSourceSecrets, PolicyPreCheck |
| 3 | Render (dev tier) | Stage 2 succeeded | RenderManifests (parallel: dev-eus, dev-wus3) |
| 4 | Validate Rendered (dev tier) | Stage 3 succeeded | ValidateRenderedManifests, ScanRenderedSecrets (parallel: dev-eus, dev-wus3) |
| 4.5 | Diff Review (dev tier) | Stage 4 succeeded | GenerateDiff, PublishDiff (PR comment, edit-in-place) |
| 3-4.5 | [nonprod tier] | dev tier diff published | Same stages for nonprod-eus, nonprod-wus3 |
| 3-4.5 | [prod tier] | nonprod tier diff published | Same stages for prod-eus, prod-wus3 |

No commit is made during PR validation. The pipeline exits after all diffs are published.

### 7.2 Post-Merge Pipeline (push to main)

Triggered on push to main. Excludes changes to `manifests/**` to prevent render commits from re-triggering the pipeline.

| Stage | Name | Condition | Key Jobs |
| --- | --- | --- | --- |
| 1 | Setup | Always | ResolveTools, ValidateParameters, AssertWorkloadClassPathMatch |
| 2 | Validate Source | Stage 1 succeeded | LintSource, ScanSourceSecrets, PolicyPreCheck |
| 3 | Render (dev tier) | Stage 2 succeeded | RenderManifests (parallel: dev-eus, dev-wus3) |
| 4 | Validate Rendered (dev tier) | Stage 3 succeeded | ValidateRenderedManifests, ScanRenderedSecrets (parallel) |
| 4.5 | Diff + Gate (dev tier) | Stage 4 succeeded | GenerateDiff, EvaluateDiff, ArgoHealthGate (both regions, 10m timeout) |
| 5 | Commit (dev tier) | Stage 4.5 approved; dryRun=false | CommitRenderedManifests (parallel: dev-eus, dev-wus3) |
| 6 | ArgoCD Sync (dev tier) | Stage 5 succeeded; triggerArgoSync=true | SyncArgoCDApplications, HealthWait |
| 3-6 | [nonprod tier] | dev tier Stage 6 succeeded | Same stages for nonprod-eus, nonprod-wus3; ManualValidation gate at Stage 4.5 |
| 3-6 | [prod tier] | nonprod tier Stage 6 succeeded | Same stages for prod-eus, prod-wus3; ManualValidation gate at Stage 4.5 |

---

## 8. Functional Requirements

### 8.1 Tool Resolution

**FR-1.1:** The pipeline MUST resolve all tool versions from a platform-managed ADO variable group (`platform-tool-versions`). Hard-coded versions in pipeline YAML are not permitted.

**FR-1.2:** The pipeline MUST cache resolved tool binaries as a named pipeline artifact consumed by all downstream jobs. Tools MUST NOT be re-downloaded per job.

**FR-1.3:** The following tools MUST be pinned and resolved: kustomize, helm, yq (mikefarah), kubeconform, kyverno CLI, gitleaks, dyff, argocd CLI.

**FR-1.4:** helm MUST be installed only when the pipeline parameter `workloadClass=system`. Tenant runs (`workloadClass=tenant`) MUST NOT install or invoke helm.

**FR-1.5:** The pipeline MUST assert in Stage 1 that the hardcoded source path is consistent with the hardcoded `workloadClass` value. A `workloadClass=system` pipeline MUST have a source path containing `/system/`. A `workloadClass=tenant` pipeline MUST have a source path containing `/tenants/`. Any mismatch MUST fail Stage 1 immediately before any rendering or validation begins.

### 8.2 Source Validation

**FR-2.1:** The pipeline MUST run `kustomize build --dry-run` against each target overlay under `templates/<env>-<region>/` before rendering. Structural errors MUST fail the pipeline before rendering begins.

**FR-2.2:** The pipeline MUST run kubeconform schema validation against dry-run output using the platform-managed schema registry. The schema registry MUST include: (a) the AKS API version-pinned Kubernetes core schema bundle, (b) schemas for all third-party CRDs installed on the platform (ESO, Kyverno, Cilium, Envoy Gateway), and (c) JSON schemas generated from all in-house CRD definitions authored by platform engineering. In-house CRD schemas MUST be regenerated and published to the registry as part of the CRD release process. See Appendix 14 for schema generation and registration procedures.

**FR-2.3:** The pipeline MUST assert that no file under `templates/<env>-<region>/tenants/` contains a `helmCharts:` entry. Violation MUST fail the pipeline. This enforces that Helm is used exclusively for system workloads.

**FR-2.4:** The pipeline MUST run `kyverno apply` against source dry-run output in audit mode. CRITICAL severity violations MUST fail the pipeline. MEDIUM and LOW violations MUST be reported in the run summary but MUST NOT block.

**FR-2.5:** The pipeline MUST run Gitleaks against the Kustomize source files changed in the triggering commit. HIGH and CRITICAL findings MUST fail Stage 2. LOW and MEDIUM findings MUST be reported but MUST NOT block.

**FR-2.6:** The Gitleaks configuration MUST include a Kubernetes-specific custom ruleset covering: `stringData:` field values, environment variable names matching secret patterns (`_PASSWORD`, `_TOKEN`, `_KEY`, `_SECRET`, `_CREDENTIAL`), and base64-encoded values in `data:` fields under Kind: Secret.

### 8.3 Rendering

**FR-3.1:** System overlays MUST be rendered with `kustomize build --enable-helm`. Helm is used exclusively for system workloads. Tenant overlays MUST be rendered with `kustomize build` without `--enable-helm`. The hardcoded `workloadClass` value in the pipeline YAML controls this behavior.

**FR-3.2:** Kustomize source is read from `templates/<env>-<region>/`. Rendered output is written to `manifests/<env>-<region>/`. These paths MUST be the exclusive source and destination.

**FR-3.3:** Within each environment tier, the pipeline MUST render each regional variant (eus, wus3) as an independent parallel job. A render failure for one region MUST NOT block rendering of the other region within the same tier. However, any regional failure MUST cause the tier to fail overall, blocking progression to the next tier.

**FR-3.4:** The pipeline MUST split rendered output into one file per Kubernetes resource using yq. Filename convention: `<kind>-<name>.yaml` (lowercase).

**FR-3.5:** The pipeline MUST apply stable field sorting to all rendered resources to produce deterministic output across pipeline runs.

**FR-3.6:** The pipeline MUST strip rendering noise (`creationTimestamp: null`, `status: {}`) from rendered output before normalization.

**FR-3.7:** CRD resources MUST be split into `manifests/<env>-<region>/system/crds/`. CRDs MUST NOT be co-mingled with workload resources. A separate ArgoCD Application with an earlier sync-wave manages the `crds/` path. This Application is pre-existing; the pipeline writes to the path, not manages the Application.

**FR-3.8:** The pipeline MUST publish rendered output as a named pipeline artifact (`rendered-<env>-<region>`) retained for downstream stages and audit.

### 8.4 Rendered Output Validation

**FR-4.1:** The pipeline MUST run kubeconform against fully rendered output without `--ignore-missing-schemas`. Unknown resource kinds MUST fail validation. This applies to all resource types in rendered output, including instances of in-house CRDs. The platform schema registry MUST be the authoritative source for all schema definitions — no per-pipeline schema overrides are permitted. If a new in-house CRD is introduced and its schema is absent from the registry, the pipeline MUST fail until the schema is registered. See Appendix 14 for the schema registration process.

**FR-4.2:** The pipeline MUST run `kyverno apply` against the fully rendered output using the Kyverno policy bundle pulled as a versioned OCI artifact from ACR. This second pass catches policy violations introduced by Helm chart rendering not visible at source validation time.

**FR-4.3:** The pipeline MUST assert that no Kind: Secret object appears in rendered output. This is a hard failure that MUST block commit regardless of environment, dryRun mode, or approval status. ExternalSecret objects are permitted.

**FR-4.4:** The pipeline MUST assert that no unresolved variable placeholders (`$(` or `${`) appear in rendered output. Violation MUST fail the pipeline.

**FR-4.5:** The pipeline MUST run Gitleaks against the fully rendered YAML output. HIGH and CRITICAL findings MUST fail Stage 4 and MUST block commit. This gate is unconditional — it applies in dryRun mode as well as normal runs. This scan targets secrets introduced or surfaced during Helm chart rendering independently of the source scan in FR-2.5.

**FR-4.6:** Gitleaks findings from the rendered output scan MUST be published as a pipeline artifact and included in the ADO run summary with: finding severity, file path, line number, rule ID, and redacted match snippet. The full credential value MUST NOT appear in logs or summaries.

**FR-4.7:** Validation results from kubeconform, kyverno, and Gitleaks MUST be published as pipeline run attachments visible in the ADO test results and run summary tab.

### 8.5 Diff Review and Gate

**FR-5.1:** The pipeline MUST generate a normalized diff between incoming rendered output and the current `manifests/<env>-<region>/` path before any commit step executes. This diff MUST be generated and published during PR validation runs (pre-merge) as well as post-merge runs.

**FR-5.2:** The diff MUST be generated using dyff for structured, human-readable output. A fallback git diff summary (files changed, lines added/removed, resources affected) MUST also be produced.

**FR-5.3:** If the normalized diff is empty after field normalization and noise stripping, the pipeline MUST exit successfully without committing. The existing PR diff comment MUST be updated to reflect no manifest changes.

**FR-5.4:** For all environments, the structured diff MUST be published to the PR as a comment during the PR validation run. The pipeline MUST edit its existing diff comment (identified by a pipeline-owned marker string in the comment body) rather than posting a new comment on each push. One diff comment per environment tier per PR is maintained at all times. For nonprod and prod post-merge runs, the diff summary MUST also be presented in the ManualValidation task message before the commit step executes.

**FR-5.5:** The ManualValidation task message MUST include: environment-region code, resource change count, resources added/removed/modified counts, the dyff structured diff summary, and a link to the full diff artifact.

**FR-5.6:** On reviewer rejection, the pipeline MUST exit with a Failed status. A comment MUST be posted to the PR indicating the commit was declined by reviewer choice and that ArgoCD will continue operating from the existing rendered path.

**FR-5.7:** The pipeline MUST expose a boolean output variable `PROCEED_WITH_COMMIT` set by the EvaluateDiff step. Stage 5 and Stage 6 MUST use this variable as a condition gate.

**FR-5.8:** For dev environments, the pipeline auto-proceeds to commit without a manual gate when BOTH the dev-eus and dev-wus3 ArgoCD Applications are Synced, Healthy, and have no Progressing or Degraded resources. The pipeline MUST poll for this condition with a maximum timeout of 10 minutes. If the condition is not met within 10 minutes, the dev tier MUST fail.

### 8.6 Commit

**FR-6.1:** The pipeline MUST commit rendered output to `manifests/<env>-<region>/` using the ADO system access token. Write access to the `manifests/` path is enforced by pipeline convention; the system access token scope is managed at the pipeline level.

**FR-6.2:** Commit messages MUST follow the format: `[ci] render <env>-<region> @ <source-sha> (run <run-id>)`.

**FR-6.3:** The pipeline MUST tag each rendered commit with a release identifier: `rendered-<tenant>-<app>-<env>-<region>-<build-number>`. Including tenant and app name ensures global uniqueness across all per-workload pipelines operating in the same repository. This tag provides a stable rollback reference independent of branch tip. Tag-write permission MUST be explicitly granted to the ADO system access token as a pipeline prerequisite.

**FR-6.4:** The commit step MUST be skipped entirely when `dryRun=true`. The pipeline MUST exit at Stage 4.5 with a success status after diff publication. Secret scanner HIGH/CRITICAL findings remain a hard failure in dryRun mode.

**FR-6.5:** A post-commit summary MUST be published to the ADO run summary including: rendered commit SHA, rendered path (`manifests/<env>-<region>/`), diff stats, and a direct link to the rendered directory in the repository.

### 8.7 ArgoCD Sync (Optional)

**FR-7.1:** The sync stage MUST only execute when `triggerArgoSync=true`. Default behavior is ArgoCD self-heal on its configured polling interval.

**FR-7.2:** ArgoCD CLI authentication MUST use a scoped service account token retrieved from the ADO variable group at pipeline runtime as an environment variable. The token MUST be scoped to app sync, app wait, and app get only.

**FR-7.3:** System Applications MUST be synced by explicit name. Tenant Applications MUST be synced via label selector (`env=<env>,region=<region>`) to avoid enumerating tenant app names in the pipeline. These labels MUST be present on all tenant Applications as a prerequisite for this pipeline.

**FR-7.4:** The pipeline MUST poll `argocd app wait --health` for all synced Applications. A Degraded result MUST fail the pipeline stage and trigger notifications per FR-8.1.

**FR-7.5:** For nonprod and prod, an ADO ManualValidation task (agentless, server pool) MUST gate the sync step. Timeout MUST be configurable (default: 4 hours). Both timeout and rejection MUST result in pipeline failure. The rendered commit remains in place in both cases — ArgoCD will self-heal on its polling interval.

**FR-7.6:** Sync results (Synced / OutOfSync / Degraded per Application) MUST be published to the ADO run summary.

### 8.8 Notifications

**FR-8.1:** The pipeline MUST support an opt-in notification model for pipeline stage failures (render failure, secret scan HIGH/CRITICAL finding, policy CRITICAL violation, ArgoCD sync Degraded). Notifications MUST support both Microsoft Teams and email as delivery channels.

**FR-8.2:** Notification channel configuration (Teams webhook URL, email recipients) is self-service. Tenants specify their notification endpoints as optional parameters in their hardcoded per-workload pipeline YAML. Teams and email channels are independently configurable and may both be active simultaneously. If no notification parameters are set, no notifications are sent.

**FR-8.3:** Notification messages MUST include: pipeline run ID, environment-region code, stage name, failure reason, and a direct link to the ADO run.

---

## 9. Non-Functional Requirements

**NFR-1 - Idempotency:** Running the pipeline twice against the same source commit MUST produce identical rendered output and MUST NOT create duplicate commits on the rendered path.

**NFR-2 - Performance:** Total post-merge pipeline duration for a single tenant application across the full sequential tier run (dev → nonprod → prod, with regional variants parallel) MUST complete within 20 minutes under normal load, excluding ManualValidation wait time.

**NFR-3 - Isolation:** A failure in one regional variant within a tier MUST NOT cause the other regional variant to fail or be cancelled. Any regional failure fails the tier overall and blocks the next tier.

**NFR-4 - Audit Trail:** Every rendered commit MUST be traceable to its source commit SHA, pipeline run ID, tenant name, application name, and the tool versions used to produce it. Secret scanner findings MUST be retained as pipeline artifacts for 30 days per the platform artifact retention policy.

**NFR-5 - Least Privilege:** The ADO system access token write access to `manifests/` is enforced by pipeline convention. The ArgoCD service account token MUST be scoped to sync operations only. Neither credential may have cluster admin or broad repository permissions.

**NFR-6 - No Runtime Rendering:** ArgoCD MUST NOT perform Kustomize or Helm rendering for any Application covered by this pipeline. `source.kustomize` and `source.helm` fields MUST be replaced with `source.directory` pointing to `manifests/<env>-<region>/`.

**NFR-7 - Graceful Exit Semantics:** A pipeline run that exits at the diff gate (no-op: empty diff) MUST report an overall Succeeded status. Pipeline Failed status is used for: render failure, validation failure, secret scan HIGH/CRITICAL finding, commit failure, ManualValidation rejection, ManualValidation timeout, and reviewer rejection.

**NFR-8 - Secret Scan Log Hygiene:** Secret scanner findings MUST NOT log the full credential value in pipeline output, ADO run logs, or PR comments. Findings MUST include a redacted match snippet only. Pipeline logs are treated as potentially visible to tenant teams and MUST be scoped accordingly.

---

## 10. Constraints and Assumptions

**C-1:** The pipeline runs on ADO-hosted or self-hosted agents with outbound access to GitHub (tool binary downloads), ACR (schema bundles, Kyverno OCI artifact), and the ArgoCD/Akuity API endpoint. No cluster API access is required from pipeline agents.

**C-2:** Tool versions (kustomize, helm, yq, kubeconform, kyverno CLI, gitleaks, dyff, argocd CLI) are managed as a platform-owned variable group (`platform-tool-versions`). Updating a tool version is a platform engineering operation, not a per-pipeline change.

**C-3:** Kustomize source directories conform to the platform-standard path convention `templates/<env>-<region>/`. Non-conforming paths are out of scope. Region codes follow the short-form convention: eus (East US), wus3 (West US 3).

**C-4:** Helm is used exclusively for system workloads. No tenant kustomization may reference a Helm chart. This is a platform architectural constraint enforced by FR-2.3 and not subject to per-tenant exception.

**C-5:** The Kyverno CLI policy bundle used in CI is pulled as a versioned OCI artifact from ACR, pinned in `platform-tool-versions`. Policy drift between CI and cluster enforcement is a known risk addressed by a separate policy sync process (out of scope for this PRD).

**C-6:** The `manifests/` path in the config repository is pipeline-owned output. Manual edits to any path under `manifests/` are prohibited and will be overwritten on the next pipeline run.

**C-7:** ExternalSecret objects referencing Azure Key Vault appear in rendered output as plain YAML and contain no credential values. ESO resolves them at runtime after ArgoCD applies. They are explicitly permitted in rendered output.

**C-8:** The Gitleaks custom Kubernetes ruleset is maintained as a versioned file in the platform config repository and referenced by the pipeline. Ruleset updates follow the standard PR process.

**C-9:** Secret scanner findings against pre-existing content in the repository require a Gitleaks baseline suppression file to avoid blocking all pipelines on first run. The baseline is bootstrapped per-repository by the tenant team following the platform runbook during onboarding. Establishing the per-repo baseline is a prerequisite for pipeline rollout in blocking mode.

**C-10:** The pipeline is scoped to one tenant and one application per run. There is no support for batch rendering of multiple tenants or applications in a single execution.

**C-11:** All ArgoCD Applications in scope already use rendered manifests (`source.directory` pointing to `manifests/<env>-<region>/`). No migration from `source.kustomize` or `source.helm` is required.

**C-12:** All in-house CRDs are owned and published by the platform engineering team. Schema generation and registry publication are platform engineering responsibilities executed as part of the CRD release process.

**C-13:** All tenant Applications must carry the labels `env=<env>` and `region=<region>` for FR-7.3 label-selector sync to function. These labels are a prerequisite for pipeline rollout.

**C-14:** An ADO branch policy on main is required with two conditions: (a) the PR validation pipeline must report Succeeded, and (b) the PR source branch must be up-to-date with main before merge is allowed. This prevents diff staleness between PR validation and the post-merge commit.

**C-15:** Each tenant+app has exactly one pipeline YAML in the config repository. Tenant name, application name, workload class, and source path are hardcoded in that YAML. Runtime parameters do not override these values.

**C-16:** The Gitleaks baseline suppression file is bootstrapped and maintained by the tenant team following the platform-provided runbook. Platform engineering provides the runbook and tooling; the tenant team executes it.

**C-17:** Notification endpoints (Teams webhook URL, email recipients) are optional parameters in the per-workload pipeline YAML, self-configured by the tenant team. Platform engineering documents the parameter schema. If no endpoints are configured, no notifications are sent.

---

## 11. Dependencies

| ID | Dependency | Type | Status | Notes |
| --- | --- | --- | --- | --- |
| D-1 | Kyverno HA deployment | Hard | In progress | PRD-2026-KYVERNO-POLICY-001. Kyverno CLI policy bundle depends on Kyverno being deployed and policies authored. |
| D-2 | ADO v3 pipeline templates | Soft | In progress | Shared step templates (tool install, kubeconform, kyverno apply, gitleaks scan) should align with v3 template conventions. |
| D-3 | Platform schema registry | Hard | Required | AKS API version-pinned kubeconform schema bundle must be hosted and accessible from pipeline agents. Registry scope must include: Kubernetes core, third-party CRDs (ESO, Kyverno, Cilium, Envoy Gateway), and all in-house CRD schemas. In-house CRD schema generation must be integrated into the CRD release process before FR-2.2 and FR-4.1 can pass. See Appendix 14. |
| D-4 | ADO system access token (pipeline-scoped) | Hard | Required | System access token with write access enforced by pipeline convention must be configured. Tag-write permission must be explicitly granted for FR-6.3. |
| D-5 | ArgoCD service account token (ADO variable group) | Soft | Required for Stage 6 | Scoped sync-only token must be provisioned in Akuity and stored in the ADO variable group before Stage 6 can execute. |
| D-6 | ADO variable groups | Hard | Required | `platform-tool-versions`, `platform-acr`, `platform-argocd` variable groups must be provisioned before pipeline execution. |
| D-7 | Gitleaks custom Kubernetes ruleset | Hard | Required | Platform-specific ruleset covering Kubernetes secret patterns must be authored and committed to the config repository before FR-2.5 and FR-4.5 can execute. |
| D-8 | Gitleaks baseline suppression file (per-repo) | Hard | Required for rollout | Per-repository suppression baseline must be bootstrapped by the tenant team during onboarding before the pipeline can run in blocking mode. |
| D-9 | Git tag-write permission on ADO system access token | Hard | Required | Tag-write permission must be explicitly granted before FR-6.3 can execute. This is separate from branch write permission in ADO. |
| D-10 | Tenant Application env/region labels | Hard | Required for Stage 6 | All tenant ArgoCD Applications must carry `env=<env>` and `region=<region>` labels before label-selector sync (FR-7.3) can function. |
| D-11 | Kyverno policy OCI artifact in ACR | Hard | Required | Versioned Kyverno policy bundle must be packaged as an OCI artifact and published to ACR, with version pinned in `platform-tool-versions`, before FR-4.2 can execute. |
| D-12 | ADO branch policy on main | Hard | Required | Branch policy must be configured to require: (a) PR validation pipeline Succeeded, and (b) branch up-to-date with main before merge. Prerequisite for C-14. |

---

## 12. Open Questions

| ID | Question | Owner | Status |
| --- | --- | --- | --- |
| OQ-1 | Should kubectl diff against the live cluster be added as a diff signal alongside dyff? | Platform Engineering | **Resolved** — No. Git-to-Git diff only. No cluster access required from pipeline agents. (NG-8) |
| OQ-2 | For dev auto-proceed, what is the acceptable maximum resource change count threshold before a manual gate is required? | Platform Engineering | **Resolved** — No resource count threshold. Dev auto-proceeds when both dev-eus and dev-wus3 ArgoCD apps are Synced+Healthy with no Progressing or Degraded resources, within a 10-minute polling timeout. (FR-5.8) |
| OQ-3 | For prod, should the diff review happen pre-merge rather than post-merge? | Platform Lead | **Resolved** — Diff review is pre-merge for all environment tiers. PR validation pipeline renders and publishes diffs as PR comments on every push to the PR branch. Post-merge pipeline commits. |
| OQ-4 | What is the artifact retention policy for rendered pipeline artifacts and secret scanner findings? | Platform Lead / Compliance | **Resolved** — 30 days for both rendered artifacts and secret scanner findings. |
| OQ-5 | Should the Kyverno CLI policy bundle be pulled from a versioned OCI artifact in ACR or directly from the policy config repo path at pipeline run time? | Platform Engineering | **Resolved** — Versioned OCI artifact from ACR, pinned in `platform-tool-versions` variable group. (C-5, FR-4.2, D-11) |
| OQ-6 | Does the platform kubeconform schema bundle include CRD schemas for ESO, Kyverno, Cilium, and Envoy Gateway? | Senior Infra Engineer | **Resolved** — Third-party CRD schemas (ESO, Kyverno, Cilium, Envoy Gateway) and all in-house CRD schemas are required inclusions in the platform schema registry per FR-2.2 and FR-4.1. In-house CRD schema generation is integrated into the CRD release process per Appendix 14. |
| OQ-7 | What ADO notification channels should receive alerts on pipeline stage failures? | Platform Lead | **Resolved** — Opt-in model supporting both Teams and email, self-configured by tenants as optional pipeline parameters. (FR-8.1, FR-8.2, C-17) |
| OQ-8 | Should the Gitleaks baseline suppression file cover all existing repositories simultaneously, or be bootstrapped per-repository? | Platform Engineering | **Resolved** — Per-repository, bootstrapped by the tenant team during onboarding following the platform runbook. (C-9, C-16) |
| OQ-9 | What is the migration plan for existing Applications currently rendering via ArgoCD source.kustomize? | Platform Lead | **Resolved** — No migration required. All Applications already use rendered manifests (`source.directory`). (C-11) |
| OQ-10 | Who owns the process of generating and publishing in-house CRD schemas to the platform schema registry? | Platform Lead | **Resolved** — Platform engineering team owns end-to-end: CRD authoring, schema generation, and registry publication as part of the CRD release process. (C-12) |

---

## 13. Revision History

| Version | Date | Author | Summary |
| --- | --- | --- | --- |
| 0.1.0 | 2026-06-27 | Platform Engineering | Initial draft. Rendered manifests pattern, system/tenant workload split, multi-region matrix, diff review gate, optional ArgoCD sync. |
| 0.2.0 | 2026-06-27 | Platform Engineering | Reframed as v2 architecture establishing the platform best-practice standard. Updated path conventions: source at `templates/<env>-<region>/`, rendered output at `manifests/<env>-<region>/`. Helm scoped explicitly to system workloads only with hard enforcement at lint time. Added two-layer secret scanning (source and rendered output) using Gitleaks with Kubernetes-specific custom ruleset and env var pattern coverage. Added NFR-8 (secret scan log hygiene). Added D-7 (Gitleaks ruleset) and D-8 (Gitleaks baseline) as hard dependencies. |
| 0.3.0 | 2026-06-27 | Platform Engineering | Added in-house CRD schema validation requirement. FR-2.2 and FR-4.1 updated to require in-house CRD JSON schemas in the platform schema registry. OQ-6 resolved; OQ-10 added. Added Appendix 14. |
| 0.4.0 | 2026-06-27 | Platform Engineering | Resolved open questions from clarification session. Pipeline scope narrowed to one tenant+app per run. Full environment matrix corrected to 6 combinations including nonprod-wus3. Pipeline trigger clarified as both PR validation (pre-merge, diff only) and post-merge push (commit). Environment tiers execute sequentially; regions parallel within tier. Diff review moved to pre-merge for all tiers. Dev gate changed from resource count threshold to ArgoCD health check. Workload class selection via explicit pipeline parameter. ArgoCD token source corrected to ADO variable group. Tag-write permission added as D-9. dryRun secret scan behavior clarified: HIGH/CRITICAL always fail. Notification opt-in model added. OQ-1, OQ-2, OQ-3, OQ-4, OQ-7, OQ-8, OQ-9, OQ-10 resolved. Live cluster diff excluded. No migration required. |
| 0.5.0 | 2026-06-27 | Platform Engineering | Grilling session decisions incorporated. Pipeline-per-workload architecture confirmed: each tenant+app has its own pipeline YAML with names hardcoded (C-15). PR validation fires on every push to PR branch. ADO branch policy requires PR validation Succeeded and branch up-to-date before merge (C-14, D-12). Diff staleness prevented by branch-up-to-date policy. Dev health gate requires BOTH regions Synced+Healthy within 10-minute timeout (FR-5.8). PR diff comments replace in-place via pipeline-owned marker (FR-5.4). ManualValidation timeout is pipeline failure, not graceful skip (FR-7.5, NFR-7). Git tag format updated to include tenant+app name for global uniqueness (FR-6.3). CRD ArgoCD Application confirmed pre-existing. workloadClass path guard added as FR-1.5 (hard assert Stage 1). Any regional failure fails the tier and blocks next tier (FR-3.3, NFR-3). OQ-5 resolved: Kyverno policy bundle is versioned OCI artifact from ACR (C-5, FR-4.2, D-11). Notification configuration is self-service via pipeline parameters (FR-8.2, C-17). Gitleaks bootstrap is tenant team responsibility following platform runbook (C-9, C-16). |

---

## 14. Appendix: Including In-House CRD Schemas in the Platform Schema Registry

This appendix describes how to generate JSON schemas from in-house CRD definitions and register them in the platform schema registry so that kubeconform can validate instances of those types in CI.

### 14.1 Background

kubeconform validates Kubernetes resources against JSON Schema documents. For well-known API versions (`apps/v1`, `v1`, etc.) kubeconform ships bundled schemas. For CRDs — whether third-party or in-house — schemas must be supplied externally via a schema registry. Running kubeconform without `--ignore-missing-schemas` (as required by FR-2.2 and FR-4.1) means any resource whose kind is absent from the registry will fail validation. This is intentional: an unknown kind in CI means either the schema is missing or an incorrect/misspelled resource has been introduced.

### 14.2 Schema Generation from a CRD

kubeconform consumes JSON Schema in a specific file naming convention. The schema file must be named:

```text
<group>/<version>/<kind>.json
```

where `<group>` is the CRD's `spec.group`, `<version>` is the version being registered, and `<kind>` is lowercased.

**Step 1 — Extract the OpenAPI schema from the CRD**

Each CRD version contains an embedded OpenAPI v3 schema under `spec.versions[*].schema.openAPIV3Schema`. Extract it using `yq`:

```bash
yq '.spec.versions[] | select(.name == "v1alpha1") | .schema.openAPIV3Schema' \
  my-crd.yaml > /tmp/schema-raw.json
```

**Step 2 — Wrap in a kubeconform-compatible JSON Schema envelope**

kubeconform expects a schema with `$schema` and `description` fields at the root. Wrap the extracted schema:

```bash
cat > /tmp/schema-wrapped.json << EOF
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "description": "Auto-generated schema for MyResource v1alpha1",
  "type": "object",
  "properties": $(cat /tmp/schema-raw.json | yq -o json '.properties'),
  "required": $(cat /tmp/schema-raw.json | yq -o json '.required // []')
}
EOF
```

For a more robust pipeline, use `crd-schema-gen` or `openapi2jsonschema` to automate the extraction and wrapping rather than manual `yq` manipulation.

**Step 3 — Place in the registry directory structure**

The platform schema registry is a directory (or OCI artifact) following the kubeconform `--schema-location` path pattern:

```text
schemas/
  platform.example.com/
    v1alpha1/
      myresource.json
    v1beta1/
      myresource.json
  tenant.example.com/
    v1/
      tenantconfig.json
```

Commit the generated schema file to the registry repository under the correct group/version/kind path.

### 14.3 Tooling Options for Schema Generation

| Tool | Approach | Notes |
| --- | --- | --- |
| `yq` + manual envelope | Extract openAPIV3Schema and wrap manually | Lightweight; suitable for simple CRDs without complex `$ref` chains. |
| `openapi2jsonschema` | Converts OpenAPI v3 schemas to JSON Schema draft-07 | Handles `$ref` resolution; recommended for CRDs with nested type definitions. |
| `crd-schema-gen` | Dedicated CRD-to-JSON-Schema tool | Purpose-built; integrates cleanly into a CRD release pipeline step. |
| `kubectl` + conversion | `kubectl get crd <name> -o json` | Retrieves the live CRD from the cluster; useful for third-party CRDs where the source YAML is not directly available. |

### 14.4 Registering the Schema for kubeconform

The pipeline resolves the schema registry location from the `platform-tool-versions` variable group. kubeconform is invoked with the `--schema-location` flag pointing at the registry:

```bash
kubeconform \
  --schema-location default \
  --schema-location 'https://<acr-or-storage-host>/schemas/{{ .Group }}/{{ .Version }}/{{ .ResourceKind }}.json' \
  --strict \
  rendered/prod-eus/tenants/payments/
```

The `{{ .Group }}/{{ .Version }}/{{ .ResourceKind }}` template is kubeconform's built-in path interpolation. The registry URL must resolve to the same directory structure described in 14.2.

For air-gapped or ACR-hosted registries, the schema bundle is packaged as an OCI artifact and pulled at pipeline startup as part of the tool resolution step (Stage 1).

### 14.5 In-House CRD Schema Release Process

To prevent the pipeline from failing when a new in-house CRD is introduced, schema registration must be part of the CRD release process — not a follow-up task. The recommended gate:

1. CRD definition is authored and reviewed via PR in the platform config repo.
2. The CRD PR pipeline generates the JSON schema (using `crd-schema-gen` or equivalent) and validates it is well-formed.
3. The generated schema is committed to the platform schema registry repo as part of the same release.
4. The schema registry OCI artifact is rebuilt and published to ACR.
5. The `platform-tool-versions` variable group is updated to reference the new schema registry artifact version.
6. The manifest generation pipeline picks up the new schema version on its next run.

A CRD merged to the platform without a corresponding schema registry entry will cause all pipeline runs that include instances of that CRD kind to fail validation at FR-2.2 and FR-4.1 until the schema is registered. This is intentional — it enforces that schema registration is never deferred.

### 14.6 Third-Party CRD Schemas

For third-party CRDs (ESO, Kyverno, Cilium, Envoy Gateway), schemas are typically available from community-maintained schema registries:

- **datreeio/CRDs-catalog** — community-curated JSON schemas for popular CRDs, updated per operator release. Pull schemas for each pinned operator version and commit them to the platform registry.
- **yannh/kubeconform** — ships with a `--schema-location` default that resolves to `https://raw.githubusercontent.com/yannh/kubernetes-json-schema/master`. This covers Kubernetes core resources but not CRDs.

Third-party CRD schemas must be pinned to the operator version deployed on the platform and updated as part of the operator upgrade process, following the same release gate described in 14.5.
