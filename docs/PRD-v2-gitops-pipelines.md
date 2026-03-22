# Product Requirements Document: GitOps Pipelines v2

## Azure DevOps Pipelines for Enterprise GitOps Platform with ArgoCD

| Field          | Value                                      |
| -------------- | ------------------------------------------ |
| **Version**    | 2.0                                        |
| **Status**     | Draft                                      |
| **Date**       | 2026-03-13                                 |
| **Owner**      | Platform Engineering Team                  |
| **Engineers**  | 2 platform engineers (dedicated)           |

---

## 1. Executive Summary

### Problem Statement

The existing v1 Azure DevOps pipeline templates are functional but aging — they lack flexibility, modern security practices, and the abstractions needed to support a growing portfolio of enterprise applications across a multi-region Kubernetes platform. Onboarding new application stacks requires significant template modification, and security scanning coverage is inconsistent across container and manifest workflows. Approximately 15 application teams currently consume v1 templates, and new teams onboarding to the platform inherit technical debt from day one.

### Proposed Solution

Deliver v2 pipeline templates — primarily as **job and step templates** — that provide parameter-driven, composable Azure DevOps YAML pipelines covering three domains: **container creation**, **Kubernetes manifest generation**, and **security operations**. v2 templates coexist alongside the current v1 stage templates in the same repository, enabling incremental adoption. Pipelines integrate with an ArgoCD-based GitOps deployment model spanning two Azure regions (East US, West US 3) across three environments (dev, staging, prod).

### Success Criteria

| Metric | Target | Measurement |
| ------ | ------ | ----------- |
| **Onboarding speed** | New application integrated within 1 business day | Time from repo creation to first successful pipeline run |
| **Language coverage** | Angular, React, Java (Spring Boot/Gradle), Python supported out of the box | Template parameter matrix |
| **Security scan coverage** | 100% of container images and manifests scanned before merge to main | Pipeline telemetry |
| **Pipeline execution time** | Container build + scan completes in < 10 minutes (p95) | ADO pipeline analytics |
| **Manifest consistency** | All deployed manifests fully rendered in CI — zero in-cluster hydration | ArgoCD Application config audit |
| **Adoption** | 3+ new tenants onboarded on v2 within first quarter; 50% of existing teams adopted within 6 months | Template reference tracking |
| **v2 template reliability** | < 1% pipeline failure rate due to template defects (excludes app build failures) | Pipeline failure classification |
| **Image tag integrity** | 100% of deployed images have SHA-verified tags in rendered manifests | Manifest audit script |

---

## 2. User Experience & Functionality

### User Personas

| Persona | Description |
| ------- | ----------- |
| **Application Developer** | Builds features in Angular, React, Java, or Python. Consumes pipeline templates; does not author them. |
| **Platform Engineer** | Authors and maintains pipeline templates. Proficient in PowerShell and Python. |
| **Security Engineer** | Defines scanning policies, reviews vulnerability reports, and sets gate thresholds. |
| **Release / DevOps Lead** | Oversees promotion flow from dev through prod across regions. |

### User Stories

#### Container Creation

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| CC-01 | As an **application developer**, I want to trigger a container build on branch push so that I get fast feedback on build correctness. | Pipeline triggers on push to feature/* branches. Build runs lint, compile/transpile, unit tests, then docker build. Build status reported back to the branch as a check. |
| CC-02 | As an **application developer**, I want a single parameterized template that builds my app regardless of language so that I don't maintain my own YAML. | Consumer repo provides parameters (language, build tool, Dockerfile path or buildpack builder, registry). Template selects the correct build strategy based on parameters. No pipeline YAML changes required in the consuming repo for upgrades. |
| CC-03 | As a **platform engineer**, I want to evaluate and support Cloud Native Buildpacks alongside Dockerfile builds so that teams can choose the best fit. | Template supports a `buildStrategy` parameter: `dockerfile` (default) or `buildpack`. Buildpack strategy uses `pack` CLI with configurable builder image. Both strategies produce OCI-compliant images pushed to the configured registry. |
| CC-04 | As a **platform engineer**, I want docker push to be registry-agnostic and credential-driven so that we can target ACR or any OCI registry. | Registry URL, repository, and credential references are parameters. Tagging strategy supports semver, git SHA, and branch-based tags. |
| CC-05 | As an **application developer**, I want my PR build to produce a container image tagged with the PR number so that I can test in a dev environment. | PR trigger builds and pushes image with tag `pr-<number>`. Main/trunk merge triggers a release-tagged image build. |

#### Kubernetes Manifest Creation

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| KM-01 | As a **platform engineer**, I want all manifests rendered via Kustomize so that we have a single, auditable templating tool across local dev and CI. | `kustomize build` is the sole rendering mechanism. Helm charts, if consumed, are pulled as remote bases and rendered through Kustomize overlays — no `helm template` in the pipeline. |
| KM-02 | As an **application developer**, I want to validate manifests on branch push so that I catch errors before PR review. | Pipeline runs YAML linting (e.g., `yamllint`) and schema validation (`kubeconform`) on push. Validation targets the specific Kubernetes API versions of the target clusters. |
| KM-03 | As a **platform engineer**, I want Kustomize overlays organized per environment and region so that ArgoCD can sync the correct rendered output. | Directory structure supports `overlays/{env}-{region}` (e.g., `overlays/dev-eastus`, `overlays/prod-westus3`). CI renders all 6 overlay targets and commits hydrated manifests to the GitOps repo. |
| KM-04 | As an **application developer**, I want to render manifests locally with the same tooling as CI so that what I test locally matches what gets deployed. | A documented local workflow (Makefile or Taskfile target) runs the same `kustomize build` + validation steps as the pipeline. Kustomize version is pinned and consistent between local and CI. |
| KM-05 | As a **release lead**, I want the rendered manifest pattern to ensure no runtime hydration in-cluster so that ArgoCD syncs exactly what was reviewed in the PR. | ArgoCD Applications are configured with `source.kustomize` disabled (raw manifests). The GitOps repo contains fully rendered YAML — no kustomization.yaml files in the deploy target directories. |

#### Image Tag Verification

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| IT-01 | As an **application developer**, I want to specify my image tag as a pipeline parameter so that I control what version is deployed. | Pipeline accepts `imageTag` as a required parameter. Tag value is user-provided (semver, build number, or custom string). |
| IT-02 | As a **platform engineer**, I want the pipeline to validate the user-provided tag exists in the registry before rendering manifests so that we never deploy a nonexistent image. | Pipeline queries the container registry to confirm the tag resolves to a valid image. Pipeline fails with a clear error if the tag does not exist. |
| IT-03 | As a **platform engineer**, I want the rendered manifest to contain the image digest (SHA) rather than just the tag so that deployments are immutable. | After tag validation, the pipeline resolves the tag to its SHA256 digest. Kustomize overlay is updated with `image@sha256:...` notation. Rendered manifest contains the pinned digest. |

#### Security Operations

| ID | Story | Acceptance Criteria |
| -- | ----- | ------------------- |
| SO-01 | As a **security engineer**, I want every container image scanned for CVEs before it is pushed to the registry so that vulnerable images never reach staging. | Trivy (or equivalent OSS scanner) runs against the built image. Scan results are published as a pipeline artifact and PR comment summary. Configurable severity threshold (e.g., CRITICAL, HIGH) gates the build. |
| SO-02 | As a **security engineer**, I want an SBOM generated for every container image so that we have a software inventory for compliance. | SBOM generated in CycloneDX or SPDX format. SBOM is attached to the image as an OCI artifact or published as a pipeline artifact. |
| SO-03 | As a **security engineer**, I want Kubernetes manifests scanned for misconfigurations so that policy violations are caught before deployment. | Trivy (or equivalent, e.g., Checkov, kubesec) runs config scanning on rendered manifests. Policies cover CIS Kubernetes benchmarks, pod security standards, and resource limits. |
| SO-04 | As a **platform engineer**, I want secret detection to run on every PR so that credentials are never committed to the repo. | A secret detection tool (e.g., Gitleaks, Trivy secret scanning) runs as a PR check. Pipeline fails on detected secrets. |
| SO-05 | As a **security engineer**, I want security scan results aggregated in a dashboard so that I can track vulnerability trends across all applications. | Scan results are exported in a standard format (SARIF, JSON). Results can be ingested by Azure DevOps Security tab or an external tool (e.g., DefectDojo). |

### Non-Goals

- **Runtime security** (in-cluster admission controllers, runtime threat detection) — out of scope for CI/CD pipelines.
- **ArgoCD installation or configuration** — ArgoCD is assumed to be deployed and operational.
- **Application code quality** (unit test frameworks, code coverage tooling) — owned by application teams; pipelines provide hook points (pre-build and post-build step injection) but not the tooling.
- **Infrastructure provisioning** (Terraform, Bicep for AKS clusters) — separate pipeline domain.
- **Classic (UI-based) Azure DevOps pipelines** — all templates are YAML-only.
- **Unified multi-region deployment** — regional deployments are independent units of work in v2. A single pipeline deploying to both regions is a future enhancement.

---

## 3. Technical Specifications

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Azure DevOps                                 │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │  App Repo     │    │  App Repo     │    │  Pipeline Templates   │  │
│  │  (source +    │    │  (source +    │    │  Repo (shared)        │  │
│  │   pipeline    │    │   pipeline    │    │                       │  │
│  │   ref)        │    │   ref)        │    │  - v1 stages (maint.) │  │
│  └──────┬───────┘    └──────┬───────┘    │  - v2 jobs/steps      │  │
│         │                   │            │  - scripts/            │  │
│         ▼                   ▼            │  - variables/          │  │
│  ┌──────────────────────────────────┐    └───────────────────────┘  │
│  │         CI Pipeline Run          │               ▲               │
│  │                                  │               │               │
│  │  1. Lint & Build (language-      │    template    │               │
│  │     specific)                    │◄──references───┘               │
│  │  2. Container Build              │                               │
│  │     (Dockerfile / Buildpack)     │                               │
│  │  3. Security Scan (image)        │                               │
│  │  4. Container Push (registry)    │                               │
│  │  5. Image Tag Verify + SHA       │                               │
│  │     Resolution                   │                               │
│  │  6. Manifest Render (Kustomize   │                               │
│  │     with SHA-pinned image)       │                               │
│  │  7. Manifest Validate            │                               │
│  │     (kubeconform + yamllint)     │                               │
│  │  8. Manifest Security Scan       │                               │
│  │  9. Commit to GitOps Repo        │                               │
│  └──────────────┬───────────────────┘                               │
│                 │                                                    │
└─────────────────┼────────────────────────────────────────────────────┘
                  │ git push (rendered manifests)
                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     GitOps Manifest Repo                            │
│                                                                     │
│  apps/                                                              │
│  └── <app-name>/                                                    │
│      └── rendered/                                                  │
│          ├── dev-eastus/          (fully rendered, SHA-pinned)       │
│          ├── dev-westus3/         (fully rendered, SHA-pinned)       │
│          ├── staging-eastus/      (fully rendered, SHA-pinned)       │
│          ├── staging-westus3/     (fully rendered, SHA-pinned)       │
│          ├── prod-eastus/         (fully rendered, SHA-pinned)       │
│          └── prod-westus3/        (fully rendered, SHA-pinned)       │
│                                                                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│  ArgoCD watches       │  │  ADO Release Pipeline         │
│  (dev/staging sync    │  │  (prod sync via argocd CLI)   │
│   per team policy)    │  │                                │
└──────────┬───────────┘  └──────────────┬─────────────────┘
           │                             │
           ▼                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              ArgoCD Control Plane (single instance)                  │
│                                                                     │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │   East US Cluster    │    │   West US 3 Cluster  │                │
│  │                     │    │                     │                 │
│  │  ┌─────┐ ┌───────┐ │    │  ┌─────┐ ┌───────┐ │                 │
│  │  │ dev │ │staging│ │    │  │ dev │ │staging│ │                 │
│  │  └─────┘ └───────┘ │    │  └─────┘ └───────┘ │                 │
│  │  ┌──────┐           │    │  ┌──────┐           │                 │
│  │  │ prod │           │    │  │ prod │           │                 │
│  │  └──────┘           │    │  └──────┘           │                 │
│  └─────────────────────┘    └─────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Pipeline Template Structure

v2 templates are **job and step templates** that coexist with v1 stage templates in the same repository. v1 stage templates for path-to-production workflows remain maintained.

```
pipeline-templates/
├── stages/                              # v1 STAGE TEMPLATES (maintained)
│   ├── path-to-production.yml           # v1 — existing teams depend on this
│   ├── container-build.yml              # v1 — existing stage orchestration
│   └── ...
├── jobs/                                # v2 JOB TEMPLATES (new)
│   ├── docker-build.yml                 # Dockerfile-based build
│   ├── buildpack-build.yml              # Cloud Native Buildpack build
│   ├── docker-push.yml                  # Registry push
│   ├── image-tag-verify.yml             # Tag validation + SHA resolution
│   ├── kustomize-render.yml             # Per-overlay rendering
│   ├── manifest-validate.yml            # kubeconform + yamllint
│   ├── trivy-image-scan.yml             # Container image CVE scan
│   ├── trivy-config-scan.yml            # Manifest misconfiguration scan
│   ├── sbom-generate.yml                # SBOM generation
│   ├── secret-detect.yml                # Secret detection
│   └── argocd-sync.yml                  # Prod deployment via argocd CLI
├── steps/                               # v2 STEP TEMPLATES (new)
│   ├── install-tools.yml                # Tool installation (pinned versions: kustomize, kubeconform, trivy, crane, gitleaks)
│   ├── resolve-image-sha.yml            # Resolve tag → digest
│   ├── kustomize-set-image.yml          # Update overlay with SHA-pinned image
│   └── git-commit-manifests.yml         # Commit rendered manifests to GitOps repo
├── variables/
│   ├── global.yml                       # Shared variables
│   └── registry.yml                     # Registry configurations
└── scripts/
    ├── pwsh/                            # PowerShell scripts
    │   ├── Set-ImageTag.ps1
    │   ├── Resolve-ImageDigest.ps1      # Query registry for SHA
    │   ├── Invoke-RegistryLogin.ps1
    │   ├── Invoke-ArgoCdSync.ps1        # Prod deployment script
    │   └── Merge-KustomizeOverlays.ps1
    └── python/
        ├── render_manifests.py
        ├── parse_scan_results.py
        └── validate_overlay_structure.py
```

### 3.3 Container Creation — Technical Details

#### Supported Build Strategies

| Strategy | Mechanism | When to Use |
| -------- | --------- | ----------- |
| **Dockerfile** | `docker build` + `docker push` | Teams with existing, well-maintained Dockerfiles; custom build steps needed. |
| **Buildpack** | `pack build` (Cloud Native Buildpacks) | Standardized builds; eliminates Dockerfile maintenance; enforced base image policies. |

#### Cloud Native Buildpacks Evaluation

Buildpacks should be offered as an **opt-in alternative** to Dockerfile builds based on the following analysis:

| Consideration | Dockerfile | Cloud Native Buildpacks |
| ------------- | ---------- | ----------------------- |
| **Flexibility** | Full control over build steps | Convention-driven; less customizable |
| **Maintenance** | Teams own Dockerfile updates | Builder images managed centrally by platform team |
| **Base image control** | Manual `FROM` image management | Builder/run images enforce base image standards automatically |
| **Reproducibility** | Depends on pinning practices | Deterministic by design; layer reuse built-in |
| **Language support** | Any language | Excellent for Java/Spring Boot, Python, Node.js (Angular/React) |
| **Build speed** | Layer caching via Docker | Intelligent layer caching; faster rebuilds for dependency-only changes |
| **Security patching** | Rebuild required for base image updates | `pack rebase` updates base image without full rebuild |

**Recommendation**: Default to **Dockerfile** for maximum flexibility. Offer **Buildpacks** as a first-class alternative, particularly well-suited for Java (Spring Boot/Gradle) and Python applications where the convention-over-configuration model eliminates significant Dockerfile complexity. The platform team should maintain a curated set of builder images.

#### Language-Specific Build Parameters

| Language / Framework | Build Tool | Lint Step | Build Command Example | Buildpack Compatible |
| -------------------- | ---------- | --------- | --------------------- | -------------------- |
| **Angular** | npm / yarn | `ng lint` / ESLint | `ng build --configuration=production` | Yes (Node.js BP) |
| **React** | npm / yarn | ESLint | `npm run build` | Yes (Node.js BP) |
| **Java / Spring Boot** | Gradle | Checkstyle / SpotBugs | `./gradlew bootJar` | Yes (Java BP) |
| **Java / Spring Boot** | Maven | Checkstyle / SpotBugs | `mvn package -DskipTests` | Yes (Java BP) |
| **Python** | pip / poetry | Ruff | `python -m build` or `poetry build` | Yes (Python BP) |

#### Image Artifact Passing Between Stages

ADO stages may run on different agents, so a locally built Docker image is not available in subsequent stages. The v2 templates solve this by **pushing a pre-release image tag during the build stage**, then re-tagging after security gates pass:

```
Build Stage                     Security Stage                 Publish Stage
───────────                     ──────────────                 ─────────────
docker build                    trivy scan against             docker tag
docker push with                  build-<BuildId> tag            build-<BuildId> → <releaseTag>
  tag: build-<BuildId>         (image already in registry)    docker push <releaseTag>
  (pre-release tag)                                           (only on main merge)
```

- **Pre-release tag**: The build job always pushes to the registry with a `build-$(Build.BuildId)` tag. This ensures the image is available for scanning in a subsequent stage on a different agent.
- **Release tag**: The publish job re-tags the scanned image with the release tag (semver, git SHA, or custom) only after security gates pass and only on main merge.
- **PR builds**: PR builds push with `pr-$(System.PullRequest.PullRequestNumber)` tag instead. The image is scanned, and results are posted as a PR comment. PR images are **not** re-tagged as release images. A registry retention policy should clean up `build-*` and `pr-*` tags after a configurable period (default: 7 days).

This model ensures: (a) security scanning always operates on the actual built artifact, (b) no release-tagged image exists in the registry until all gates pass, and (c) stages can run on different agents without `docker save`/`docker load` overhead.

#### Consumer Template Interface

A consuming application repo references the shared templates with minimal configuration. v2 consumers compose job templates within their own stage definitions, giving teams control over their pipeline structure:

```yaml
# azure-pipelines.yml (v2 consumer — composing job templates)
trigger:
  branches:
    include:
      - main
      - feature/*

pr:
  branches:
    include:
      - main

resources:
  repositories:
    - repository: templates
      type: git
      name: platform/pipeline-templates
      ref: refs/tags/v2.0.0   # Pinned version

variables:
  imageTag: '$(Build.BuildId)'  # Default; overridden for release builds

stages:
  - stage: Build
    jobs:
      - template: jobs/docker-build.yml@templates
        parameters:
          appName: 'my-service'
          language: 'java'
          buildTool: 'gradle'
          buildStrategy: 'dockerfile'
          dockerfilePath: './Dockerfile'
          registryServiceConnection: 'acr-prod'
          registryUrl: 'myregistry.azurecr.io'
          imageRepository: 'apps/my-service'
          # Pushes build-$(Build.BuildId) pre-release tag to registry

  - stage: Security
    dependsOn: Build
    jobs:
      - template: jobs/trivy-image-scan.yml@templates
        parameters:
          imageRef: 'myregistry.azurecr.io/apps/my-service:build-$(Build.BuildId)'
          severityThreshold: 'HIGH'
          generateSbom: true
      - template: jobs/secret-detect.yml@templates

  - stage: Publish
    dependsOn: Security
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - template: jobs/docker-push.yml@templates
        parameters:
          registryServiceConnection: 'acr-prod'
          registryUrl: 'myregistry.azurecr.io'
          imageRepository: 'apps/my-service'
          sourceTag: 'build-$(Build.BuildId)'  # Re-tag from pre-release
          imageTag: '$(imageTag)'              # User-provided release tag

  - stage: RenderManifests
    dependsOn: Publish
    jobs:
      - template: jobs/image-tag-verify.yml@templates
        parameters:
          registryUrl: 'myregistry.azurecr.io'
          imageRepository: 'apps/my-service'
          imageTag: '$(imageTag)'          # Validated + SHA resolved
      - template: jobs/kustomize-render.yml@templates
        parameters:
          overlays: 'dev-eastus'           # Per-region, per-environment
          gitopsRepo: 'platform/gitops-manifests'
          appName: 'my-service'
```

### 3.4 Image Tag Flow — Verify and Ratify with SHA

The image tag flow is a critical handoff between container creation and manifest rendering. The pipeline ensures immutability by resolving user-provided tags to content-addressable digests.

```
User provides          Pipeline validates        Manifest uses
imageTag: "1.4.2"  ──► Registry lookup:       ──► image: myregistry.azurecr.io/
                       "1.4.2" exists? ✓           apps/my-service@sha256:a1b2c3...
                       Resolve to SHA:
                       sha256:a1b2c3...
```

#### Tag Verification Step

```powershell
# scripts/pwsh/Resolve-ImageDigest.ps1
param(
    [Parameter(Mandatory)]
    [string]$RegistryUrl,

    [Parameter(Mandatory)]
    [string]$ImageRepository,

    [Parameter(Mandatory)]
    [string]$ImageTag
)

$imageRef = "$RegistryUrl/$ImageRepository`:$ImageTag"

# Verify tag exists and resolve to digest
# Using crane for reliable cross-platform registry API queries
# (docker manifest inspect requires experimental CLI features on some Docker versions)
$digest = crane digest $imageRef 2>$null

if (-not $digest) {
    Write-Error "Image tag '$ImageTag' not found in $RegistryUrl/$ImageRepository"
    exit 1
}

Write-Host "Verified: $imageRef"
Write-Host "Resolved digest: $digest"

# Set pipeline variables for downstream steps
Write-Host "##vso[task.setvariable variable=imageDigest;isOutput=true]$digest"
Write-Host "##vso[task.setvariable variable=imageShaRef;isOutput=true]$RegistryUrl/$ImageRepository@$digest"
```

#### Kustomize Image Update

After SHA resolution, the pipeline updates the Kustomize overlay before rendering:

```bash
# In the kustomize-render job
cd overlays/$OVERLAY
kustomize edit set image \
  "$REGISTRY/$REPO=$REGISTRY/$REPO@$IMAGE_DIGEST"
kustomize build . > ../../rendered/$OVERLAY/manifests.yaml
```

This ensures the rendered manifest contains:

```yaml
# rendered output — immutable reference
containers:
  - name: my-service
    image: myregistry.azurecr.io/apps/my-service@sha256:a1b2c3d4e5f6...
```

### 3.5 Kubernetes Manifest Rendering — Technical Details

#### Rendered Manifest Pattern

The core principle: **what is committed to the GitOps repo is exactly what runs in the cluster**. No in-cluster Kustomize or Helm operations.

```
CI Pipeline (render time)                    ArgoCD (deploy time)
─────────────────────────                    ────────────────────
kustomize build overlays/dev-eastus/    ──►  Sync raw YAML to dev-eastus cluster
kustomize build overlays/prod-westus3/  ──►  Sync raw YAML to prod-westus3 cluster
```

#### Kustomize Overlay Structure

```
app-manifests/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── hpa.yaml
├── components/                        # Reusable Kustomize components
│   ├── monitoring/
│   │   ├── kustomization.yaml
│   │   └── servicemonitor.yaml
│   └── network-policies/
│       ├── kustomization.yaml
│       └── networkpolicy.yaml
└── overlays/
    ├── dev-eastus/
    │   ├── kustomization.yaml         # patches, image tags, replicas
    │   └── patches/
    ├── dev-westus3/
    │   ├── kustomization.yaml
    │   └── patches/
    ├── staging-eastus/
    ├── staging-westus3/
    ├── prod-eastus/
    └── prod-westus3/
```

#### Manifest CI Pipeline Sequence

```
Branch Push (feature/*)                  PR Merge to Main
───────────────────────                  ─────────────────
1. yamllint (all YAML files)             1. yamllint
2. kustomize build (all overlays)        2. kustomize build (all overlays)
3. kubeconform (against target           3. kubeconform
   K8s API version schemas)             4. Trivy config scan
4. Trivy config scan                     5. Commit rendered manifests
5. Report results as PR check               to GitOps repo
                                         6. ArgoCD detects change → sync
                                            (per team sync policy)
```

#### Rendered Manifest Commit Workflow

Committing rendered manifests from CI to the GitOps repo is the critical handoff point. This workflow must handle concurrency, traceability, and consistency.

**Concurrency control**: Each application writes to its own directory (`apps/<app-name>/rendered/<env>-<region>/`). Since applications do not share directories, concurrent pipelines for different applications do not conflict. For the same application, Azure DevOps pipeline concurrency settings (`lockBehavior: sequential`) ensure only one manifest commit runs at a time per app. This serialization applies at the **app level**, not per overlay — if a pipeline renders multiple overlays for the same app, they are serialized against other pipeline runs for that same app. Different apps may render concurrently without conflict.

**Same-app overlay concurrency**: A single pipeline run may render multiple overlays (e.g., `dev-eastus` and `dev-westus3`). These are written to separate subdirectories and committed in a single push (see below). Two separate pipeline runs for the same app (e.g., one rendering dev overlays and another rendering staging overlays) are serialized by `lockBehavior: sequential` to prevent interleaved commits. This avoids confusing commit history where concurrent pushes from the same app interleave or require rebase.

**Commit granularity**: Each pipeline run produces a single commit per target overlay. If a pipeline renders `dev-eastus` only, one commit is made. If rendering all 6 overlays, 6 commits are batched into a single push.

**Branch strategy**: Direct push to `main` in the GitOps repo. Rendered manifests are machine-generated output — PR review occurs on the *source* (Kustomize overlays), not the rendered output.

**Traceability**: Every commit to the GitOps repo includes structured metadata linking back to the source:

```
feat(my-service): render dev-eastus manifests

Source commit: abc1234
Source repo: platform/my-service
Pipeline run: https://dev.azure.com/org/project/_build/results?buildId=12345
Image: myregistry.azurecr.io/apps/my-service@sha256:a1b2c3...
Rendered by: pipeline-templates@v2.0.0
```

**Conflict handling**: If a `git push` fails due to a concurrent update (different app, overlapping push window), the pipeline retries with `git pull --rebase` up to 3 times before failing.

#### Local Development Parity

```makefile
# Makefile (in app manifest repo)
KUSTOMIZE_VERSION := 5.4.3
KUBECONFORM_VERSION := 0.6.7

.PHONY: render validate lint

lint:
	yamllint -c .yamllint.yaml .

render:
	@for overlay in overlays/*/; do \
		echo "Rendering $$overlay..."; \
		kustomize build $$overlay > /dev/null; \
	done

validate: render
	@for overlay in overlays/*/; do \
		echo "Validating $$overlay..."; \
		kustomize build $$overlay | kubeconform \
			-kubernetes-version 1.29.0 \
			-schema-location default \
			-strict; \
	done

all: lint render validate
```

### 3.6 Security Operations — Technical Details

#### Security Scan Matrix

| Scan Type | Tool | Target | When | Gate Behavior |
| --------- | ---- | ------ | ---- | ------------- |
| Container image CVE | Trivy | Built OCI image | Every build | Fail on severity >= threshold param |
| Container image SBOM | Trivy / Syft | Built OCI image | Every build | Advisory (artifact only) |
| Manifest misconfiguration | Trivy (config) | Rendered YAML | Every build | Fail on CRITICAL; warn on HIGH |
| Secret detection | Gitleaks | Repo diff | Every PR | Fail on any finding |
| YAML lint | yamllint | All YAML | Every push | Fail on errors |
| Schema validation | kubeconform | Rendered manifests | Every push | Fail on invalid resources |

#### Scan Result Output

All scanners output results in standardized formats:

- **SARIF** for Azure DevOps Security tab integration
- **JSON** for custom dashboards and trend analysis
- **PR comment summaries** via PowerShell scripts that parse results and post to Azure DevOps PR API

#### Pipeline Script Examples

```powershell
# scripts/pwsh/Invoke-TrivyScan.ps1
param(
    [Parameter(Mandatory)]
    [string]$ImageRef,

    [ValidateSet('CRITICAL','HIGH','MEDIUM','LOW')]
    [string]$SeverityThreshold = 'HIGH',

    [switch]$GenerateSBOM,

    [string]$OutputDir  # Pass from pipeline YAML: $(Build.ArtifactStagingDirectory)/security
)

if (-not $OutputDir) {
    Write-Error "OutputDir parameter is required. Pass $(Build.ArtifactStagingDirectory)/security from pipeline YAML."
    exit 1
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Image vulnerability scan
trivy image `
    --severity $SeverityThreshold `
    --format sarif `
    --output "$OutputDir/trivy-image.sarif" `
    $ImageRef

trivy image `
    --severity $SeverityThreshold `
    --format json `
    --output "$OutputDir/trivy-image.json" `
    $ImageRef

$exitCode = $LASTEXITCODE

# SBOM generation
if ($GenerateSBOM) {
    trivy image `
        --format cyclonedx `
        --output "$OutputDir/sbom.cdx.json" `
        $ImageRef
}

# Publish results
Write-Host "##vso[artifact.upload artifactname=SecurityReports]$OutputDir"
Write-Host "##vso[task.uploadsummary]$OutputDir/trivy-image.sarif"

exit $exitCode
```

```python
# scripts/python/render_manifests.py
"""Render Kustomize overlays and commit to GitOps repo."""
import subprocess
import sys
from pathlib import Path

OVERLAYS = [
    "dev-eastus", "dev-westus3",
    "staging-eastus", "staging-westus3",
    "prod-eastus", "prod-westus3",
]

def render_overlay(base_path: Path, overlay: str, output_path: Path) -> bool:
    overlay_dir = base_path / "overlays" / overlay
    if not overlay_dir.exists():
        print(f"SKIP: {overlay_dir} does not exist")
        return True

    output_dir = output_path / overlay
    output_dir.mkdir(parents=True, exist_ok=True)

    result = subprocess.run(
        ["kustomize", "build", str(overlay_dir)],
        capture_output=True, text=True,
    )

    if result.returncode != 0:
        print(f"FAIL: {overlay}\n{result.stderr}", file=sys.stderr)
        return False

    (output_dir / "manifests.yaml").write_text(result.stdout)
    print(f"OK: {overlay} -> {output_dir / 'manifests.yaml'}")
    return True

def main():
    base_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    results = [render_overlay(base_path, o, output_path) for o in OVERLAYS]
    sys.exit(0 if all(results) else 1)

if __name__ == "__main__":
    main()
```

### 3.7 Environment Promotion & Deployment Strategy

#### Promotion Model

The promotion model follows a **merge-to-main + ArgoCD sync policy** pattern. Teams control their own sync behavior for non-production environments, while production deployments are explicitly triggered through Azure DevOps release pipelines.

```
feature/* branch                    main branch
────────────────                    ───────────
  │                                     │
  │  PR created                         │
  │  ├─ CI: build, scan, validate       │
  │  ├─ PR review + approval            │
  │  └─ PR merge ──────────────────────►│
  │                                     │
  │                           ┌─────────┴─────────┐
  │                           ▼                   ▼
  │                    dev-eastus            dev-westus3
  │                    (ArgoCD auto-sync     (ArgoCD auto-sync
  │                     per team policy)      per team policy)
  │                           │                   │
  │                           ▼                   ▼
  │                    staging-eastus        staging-westus3
  │                    (ArgoCD sync          (ArgoCD sync
  │                     per team policy)      per team policy)
  │                           │                   │
  │                    ┌──────┴──────┐     ┌──────┴──────┐
  │                    ▼             ▼     ▼             ▼
  │              prod-eastus    ADO Release Pipeline
  │              (argocd app    (argocd CLI sync)
  │               sync via      ─ explicit trigger
  │               pipeline)     ─ per region
  │                             ─ independent runs
```

#### Environment Sync Policies

| Environment | Sync Mechanism | Trigger | Ownership |
| ----------- | -------------- | ------- | --------- |
| **dev** | ArgoCD automated sync | Manifest commit to GitOps repo | Team-configured sync policy |
| **staging** | ArgoCD automated sync | Manifest commit to GitOps repo | Team-configured sync policy |
| **prod** | ADO release pipeline via `argocd app sync` CLI | Manual trigger or scheduled release | Platform-provided pipeline template; team-executed |

#### Production Deployment Pipeline

Production deployments are **not** triggered by ArgoCD auto-sync. Instead, an Azure DevOps release pipeline invokes the ArgoCD CLI to perform an explicit `app sync` for a specific application and region.

**ArgoCD Authentication**: The prod sync pipeline authenticates to ArgoCD using an **ArgoCD auth token** stored in **Azure Key Vault** and retrieved at runtime via the `AzureKeyVault@2` task. The auth token is scoped to the specific ArgoCD AppProject for the application being deployed, following least-privilege principles. The authentication flow:

1. `AzureKeyVault@2` task retrieves the ArgoCD auth token from Key Vault using the pipeline's Azure service connection.
2. The token is set as a secret pipeline variable (`ARGOCD_AUTH_TOKEN`).
3. `argocd` CLI uses the token via the `--auth-token` flag (or `ARGOCD_AUTH_TOKEN` environment variable).
4. No interactive `argocd login` is required — the CLI operates in headless/non-interactive mode.

Token rotation is managed through Key Vault policies. If Azure AD/OIDC integration with ArgoCD is available, this can be replaced with workload identity federation in a future phase.

```yaml
# Example: prod deployment job template (v2)
# jobs/argocd-sync.yml
parameters:
  - name: appName
    type: string
  - name: environment
    type: string
    values: ['prod']
  - name: region
    type: string
    values: ['eastus', 'westus3']
  - name: argocdServer
    type: string
  - name: serviceConnection
    type: string

jobs:
  - job: SyncToProduction
    displayName: 'Sync ${{ parameters.appName }} to ${{ parameters.environment }}-${{ parameters.region }}'
    steps:
      - task: AzureCLI@2
        displayName: 'ArgoCD App Sync'
        inputs:
          azureSubscription: '${{ parameters.serviceConnection }}'
          scriptType: 'pscore'
          scriptPath: 'scripts/pwsh/Invoke-ArgoCdSync.ps1'
          arguments: >
            -AppName "${{ parameters.appName }}-${{ parameters.environment }}-${{ parameters.region }}"
            -ArgoServer "${{ parameters.argocdServer }}"
            -WaitForHealthy
            -TimeoutSeconds 300
```

```powershell
# scripts/pwsh/Invoke-ArgoCdSync.ps1
param(
    [Parameter(Mandatory)]
    [string]$AppName,

    [Parameter(Mandatory)]
    [string]$ArgoServer,

    [switch]$WaitForHealthy,

    [int]$TimeoutSeconds = 300
)

# Authentication via ARGOCD_AUTH_TOKEN environment variable
# Token is retrieved from Azure Key Vault by the pipeline and set as a secret variable
if (-not $env:ARGOCD_AUTH_TOKEN) {
    Write-Error "ARGOCD_AUTH_TOKEN environment variable is not set. Ensure the AzureKeyVault task has run."
    exit 1
}

Write-Host "Syncing ArgoCD application: $AppName"
Write-Host "ArgoCD server: $ArgoServer"

$syncArgs = @("app", "sync", $AppName, "--server", $ArgoServer, "--auth-token", $env:ARGOCD_AUTH_TOKEN)

if ($WaitForHealthy) {
    $syncArgs += "--timeout"
    $syncArgs += $TimeoutSeconds
}

argocd @syncArgs

if ($LASTEXITCODE -ne 0) {
    Write-Error "ArgoCD sync failed for $AppName"
    exit 1
}

Write-Host "Sync completed successfully for $AppName"

# Verify health status
argocd app get $AppName --server $ArgoServer --auth-token $env:ARGOCD_AUTH_TOKEN -o json |
    ConvertFrom-Json |
    Select-Object -ExpandProperty status |
    Select-Object health, sync |
    Format-List
```

#### Regional Deployment Independence

Each region is an independent unit of work. Deploying to East US does not require deploying to West US 3, and vice versa. This allows:

- Canary-style regional rollouts (deploy East US first, validate, then West US 3)
- Region-specific hotfixes without cross-region impact
- Independent rollback per region

**Future enhancement**: A unified multi-region deployment pipeline that orchestrates sequential or parallel deployment across both regions with configurable soak time between regions.

#### Rollback Strategy

Rollbacks are performed through **git operations**, not ArgoCD rollback features. This preserves the GitOps principle that git is the single source of truth.

```
Rollback procedure:
1. Identify the last known good commit in the GitOps manifest repo
2. git revert the bad manifest commit(s)
3. Push the revert to the GitOps repo main branch
4. For dev/staging: ArgoCD auto-sync picks up the revert
5. For prod: Re-run the ADO release pipeline (argocd app sync)
```

This approach ensures:

- Full audit trail of what was deployed and when it was rolled back
- No divergence between git state and cluster state
- Consistent rollback procedure across all environments

#### Break-Glass Procedure (ArgoCD Unavailable)

If the ArgoCD control plane is unavailable (misconfiguration, failed upgrade, etcd corruption), the platform team can deploy directly from the GitOps manifest repo using `kubectl`. Because all manifests are fully rendered (no in-cluster hydration), this is safe and deterministic:

```
Break-glass deployment procedure:
1. Clone the GitOps manifest repo
2. Identify the target overlay directory:
   apps/<app-name>/rendered/<env>-<region>/manifests.yaml
3. Authenticate to the target cluster via az aks get-credentials
4. Apply the rendered manifests:
   kubectl apply -f apps/<app-name>/rendered/<env>-<region>/manifests.yaml
5. Verify deployment health:
   kubectl rollout status deployment/<app-name> -n <namespace>
6. Document the break-glass deployment in the incident channel
7. Once ArgoCD is restored, verify ArgoCD shows the application as "Synced"
   (git state and cluster state should match)
```

**Important**: Break-glass deployments bypass ArgoCD's sync tracking. After ArgoCD recovery, run `argocd app diff <app>` to confirm no drift exists. If ArgoCD shows "OutOfSync" despite matching manifests, a manual `argocd app sync` (with `--force`) may be needed to re-establish tracking.

This procedure should be documented in the platform team's operational runbook and tested quarterly.

---

### 3.8 ArgoCD Integration

#### Deployment Topology

| Component | Detail |
| --------- | ------ |
| **Control Plane** | Single ArgoCD instance (location TBD — hub cluster or one of the workload clusters) |
| **Target Clusters** | 2 — Azure East US, Azure West US 3 |
| **Environments** | 3 per cluster — dev, staging, prod |
| **Total Sync Targets** | 6 |
| **Prod Sync Method** | ADO pipeline via `argocd app sync` CLI (not ArgoCD auto-sync) |

#### ApplicationSet Strategy

ArgoCD ApplicationSets manage the matrix of apps x environments x regions. Note the `syncPolicy` varies by environment — prod does **not** use automated sync:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: my-service
  namespace: argocd
spec:
  goTemplate: true
  goTemplateOptions: ["missingkey=error"]
  generators:
    - matrix:
        generators:
          - list:
              elements:
                - environment: dev
                  autoSync: "true"
                - environment: staging
                  autoSync: "true"
                - environment: prod
                  autoSync: "false"
          - list:
              elements:
                - region: eastus
                  cluster: https://eastus-cluster-api.example.com
                - region: westus3
                  cluster: https://westus3-cluster-api.example.com
  template:
    metadata:
      name: 'my-service-{{ .environment }}-{{ .region }}'
    spec:
      project: my-service
      source:
        repoURL: https://dev.azure.com/org/project/_git/gitops-manifests
        targetRevision: main
        path: 'apps/my-service/rendered/{{ .environment }}-{{ .region }}'
      destination:
        server: '{{ .cluster }}'
        namespace: 'my-service-{{ .environment }}'
      # syncPolicy is conditional on autoSync parameter:
      # dev/staging get automated sync + self-heal; prod requires manual sync via ADO pipeline
      syncPolicy:
        {{- if eq .autoSync "true" }}
        automated:
          prune: true
          selfHeal: true
        {{- end }}
        syncOptions:
          - CreateNamespace=true
          - ServerSideApply=true
```

### 3.9 CI Pipeline Trigger Model

| Event | Pipeline Behavior |
| ----- | ----------------- |
| **Push to feature/* branch** | Lint, Build, Unit Test, Container Build (push with `build-<BuildId>` pre-release tag), Image Scan (against pre-release tag), Manifest Render, Manifest Validate, Report |
| **PR created / updated** | Full pipeline (above) + re-tag image as `pr-<PR number>` + Secret Detection + PR comment with scan summary. Image is scanned and results posted to PR; image is **not** promoted to a release tag. |
| **PR merged to main** | Full pipeline + re-tag pre-release image as release tag (semver/custom) + Image Tag Verify (SHA resolution) + Commit rendered manifests to GitOps repo. Only at this stage does a release-tagged image exist in the registry. |
| **Prod release (manual)** | ADO release pipeline: `argocd app sync` for specified app + region |

**Registry cleanup**: Pre-release (`build-*`) and PR (`pr-*`) image tags should be cleaned up by a registry retention policy. Recommended retention: 7 days for `build-*` tags, 30 days for `pr-*` tags. ACR supports tag-based retention policies natively.

### 3.10 Integration Points

| System | Integration Method | Purpose |
| ------ | ------------------ | ------- |
| **Azure Container Registry** | Service Connection + `docker push` / `pack` CLI | Container image storage |
| **GitOps Manifest Repo** | Git push via service account PAT or SSH key | Rendered manifest delivery to ArgoCD |
| **ArgoCD (dev/staging)** | Watches GitOps repo (no direct API calls from CI) | Non-prod cluster deployment |
| **ArgoCD (prod)** | `argocd` CLI invoked from ADO release pipeline | Prod cluster deployment |
| **Azure DevOps PR API** | REST API via PowerShell | Post scan summaries as PR comments |
| **SARIF Upload** | `##vso[artifact.upload]` logging commands | Security tab integration |

### 3.11 Security & Privacy

- Container registry credentials are stored as Azure DevOps **Service Connections** — never in pipeline YAML.
- GitOps repo access uses a scoped PAT or managed identity with write access limited to the manifest repo.
- ArgoCD auth tokens for prod sync pipelines are stored in **Azure Key Vault** and retrieved at runtime via `AzureKeyVault@2` task. Tokens are scoped per AppProject and rotated via Key Vault policies — never hardcoded in scripts or pipeline YAML.
- Secret detection (Gitleaks) prevents accidental credential commits.
- SBOM generation provides software supply chain transparency.
- All pipeline scripts are version-controlled and reviewed via PR — no inline scripts in templates.

### 3.12 Notifications & Observability

Pipeline failures and security scan results must be visible to the right teams at the right time. Observability is also critical for the platform team to detect when template updates cause regressions across consumers.

#### Notifications

| Event | Channel | Mechanism | Phase |
| ----- | ------- | --------- | ----- |
| **Pipeline failure** | Team-configured channel (Slack, Teams, email) | ADO service hooks or subscription notifications per pipeline | Phase 3 |
| **Security scan findings** | PR comment + team channel | PowerShell script posting to ADO PR API + webhook to team channel | Phase 3 |
| **Template breaking change detected** | Platform team channel | ADO pipeline monitors that run consumer integration tests on template repo PRs | Phase 3 |

#### Pipeline Telemetry & Metrics

The platform team should track the following metrics to monitor v2 template health and adoption:

| Metric | Source | Purpose |
| ------ | ------ | ------- |
| **Pipeline execution duration** (p50, p95, p99) by template and language | ADO Analytics REST API | Detect performance regressions; validate p95 < 10 min target |
| **Pipeline failure rate** by template (excluding app build failures) | ADO Analytics REST API | Track v2 template reliability against < 1% target |
| **Template adoption** (v1 vs v2 references) | Template repo reference tracking (ADO resource audit) | Measure migration progress toward 50% adoption target |
| **Security scan findings over time** (by severity, by team) | SARIF/JSON scan artifacts | Trend analysis for security posture |
| **Image tag verification failures** | Pipeline logs / custom telemetry | Detect teams deploying nonexistent images |

Telemetry dashboards and alerting are scoped to Phase 3 (v2.2). In Phase 1, pipeline execution data is available through ADO's built-in analytics.

---

## 4. v1 to v2 Migration Strategy

### Current State

- **~15 application teams** currently consume v1 pipeline stage templates, use ArgoCD, and deploy to Kubernetes.
- v1 templates are functional but monolithic — tightly coupled stage templates that are difficult to extend or customize.

### Coexistence Model

v1 and v2 templates coexist in the **same repository**, in the same directory structure. The key distinction:

| Aspect | v1 | v2 |
| ------ | -- | -- |
| **Template layer** | Stage templates (full pipeline orchestration) | Job and step templates (composable building blocks) |
| **Consumer control** | Consumer `extends` a stage template — limited customization | Consumer defines their own stages, composes v2 job/step templates |
| **Maintenance** | Maintained for existing consumers; bug fixes only | Actively developed; new features land here |
| **Location** | `stages/*.yml` | `jobs/*.yml`, `steps/*.yml` |

### Adoption Plan

| Audience | Strategy |
| -------- | -------- |
| **New tenants** | Onboard directly onto v2 templates. Platform team provides onboarding documentation and reference pipeline YAML. |
| **Existing tenants (v1)** | Encouraged to adopt v2 templates incrementally. Teams can start by replacing individual jobs/steps within their existing pipelines before fully migrating off v1 stage templates. |

### Migration Path for Existing Teams

```
Phase A: Adopt v2 steps within v1 stages
──────────────────────────────────────────
  - Replace inline security scan steps with v2 step templates
  - Replace inline Kustomize render steps with v2 step templates
  - No change to overall pipeline structure

Phase B: Replace v1 stages with v2 jobs
────────────────────────────────────────
  - Rewrite pipeline YAML to define stages locally
  - Compose v2 job templates within custom stages
  - Retire v1 stage template references

Phase C: Full v2
─────────────────
  - Pipeline follows v2 patterns end-to-end
  - Team benefits from all v2 features (SHA-pinned images,
    improved security scanning, etc.)
```

### v1 Template Maintenance Policy

- v1 stage templates (`stages/path-to-production.yml` and related files) will continue to receive **security patches and critical bug fixes**.
- **No new features** will be added to v1 templates.
- v1 templates will not be removed until all 15 teams have migrated or a deprecation date is set (not before v2.2 release).

---

## 5. Risks & Roadmap

### Phased Rollout

| Phase | Scope | Target | Timeline |
| ----- | ----- | ------ | -------- |
| **Phase 1 (MVP)** | Core v2 job/step templates for Dockerfile container builds (Java, Python). Trivy image scan job. Image tag verification + SHA resolution step. Kustomize render job for single overlay. Manifest validation (kubeconform + yamllint). GitOps repo commit step with traceability metadata. ArgoCD prod sync job template. Docker BuildKit layer caching for build performance (required to meet 10-min p95 target for Java/Gradle builds). Pre-release image tag model (build-tag → scan → release-tag). | v2.0 | Weeks 1-10 (target: 2026-05-22) |
| **Phase 2** | Angular/React build support. Cloud Native Buildpacks as opt-in. SBOM generation. Manifest security scanning (Trivy config). Secret detection (Gitleaks). Multi-overlay rendering (all 6 targets). Local dev parity tooling (Makefile/Taskfile) for Kustomize render and validation. | v2.1 | Weeks 11-16 |
| **Phase 3** | PR comment scan summaries. SARIF dashboard integration. Pipeline failure notifications (per-team channels). Pipeline telemetry and execution metrics. Onboarding documentation and reference pipelines. First 3 new tenant onboardings. | v2.2 | Weeks 17-22 |
| **Phase 4** | Buildpack builder image curation. Dependency caching (npm, Gradle, pip) and Trivy DB caching. Parallel stage optimization. v1 deprecation timeline announcement. | v2.3 | Weeks 23-28 |

### Phase 1 (MVP) Detailed Breakdown — 2 Engineers, 10 Weeks

| Week | Engineer 1 | Engineer 2 |
| ---- | ---------- | ---------- |
| 1-2 | `steps/install-tools.yml`, `steps/resolve-image-sha.yml` | `jobs/docker-build.yml` (Java, Python) with BuildKit layer caching and pre-release tag push |
| 3-4 | `jobs/image-tag-verify.yml`, `steps/kustomize-set-image.yml` | `jobs/docker-push.yml` (re-tag from pre-release), `jobs/trivy-image-scan.yml` |
| 5-6 | `jobs/kustomize-render.yml` (single overlay) | `jobs/manifest-validate.yml` (kubeconform + yamllint) |
| 7-8 | `steps/git-commit-manifests.yml` (traceability, retry logic) | `jobs/argocd-sync.yml` + `scripts/pwsh/Invoke-ArgoCdSync.ps1` (with Key Vault auth) |
| 9-10 | Integration testing: end-to-end with reference app | Integration testing: end-to-end with reference app |

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| **Kustomize version drift** between local and CI | Medium | High | Pin Kustomize version in pipeline and local tooling; validate in CI. |
| **Buildpack builder image maintenance** becomes a burden | Medium | Medium | Start with Paketo official builders; only create custom builders when required. (Phase 2) |
| **Rendered manifest repo grows large** over time | Medium | Medium | Implement Git history pruning strategy; consider shallow clones in ArgoCD. |
| **Trivy scan false positives** block builds unnecessarily | High | Medium | Maintain a `.trivyignore` file per repo with documented justifications; review quarterly. |
| **Pipeline template breaking changes** affect all consumers | Medium | High | Semantic versioning on template repo; consumers pin to tags; deprecation notices for major changes. |
| **Single ArgoCD control plane** is a single point of failure | Medium | High | ArgoCD HA deployment; evaluate multi-control-plane architecture for future phases. Break-glass procedure documented below for ArgoCD outages. |
| **GitOps repo commit concurrency** causes push failures | Medium | Medium | Per-app directory isolation eliminates most conflicts. Retry with rebase (3 attempts) handles edge cases. ADO pipeline `lockBehavior: sequential` for same-app pipelines. |
| **v1/v2 coexistence complexity** increases maintenance burden | Medium | Medium | Clear ownership boundaries: v1 receives security patches only. v2 is the sole investment target. Deprecation timeline set at v2.2. |
| **2-engineer team capacity** limits parallelism | Medium | High | Phase 1 scoped to core templates only. Angular/React and Buildpacks deferred to Phase 2. MVP prioritizes end-to-end flow over breadth. |
| **Image tag verification** adds pipeline latency | Low | Low | Registry API calls are fast (< 2s). Cached registry auth tokens avoid repeated login overhead. |

---

## 6. Research: Industry Trends, Patterns & Best Practices

This section documents the industry research underpinning the v2 architecture. Each subsection covers a domain relevant to the PRD, summarizes the current state of the art, and cites authoritative sources.

### 6.1 GitOps Adoption & Maturity

GitOps has moved from an emerging practice to an industry default for Kubernetes-based delivery. The 2025 CNCF Annual Cloud Native Survey reports that **77% of respondents have adopted GitOps** to some degree, with a separate CNCF GitOps microsurvey showing 91% of respondents "already onboard" [1][2]. Argo CD — the CD tool selected for this platform — runs in nearly **60% of Kubernetes clusters** for application delivery, with 97% of Argo CD survey respondents using it in production (up from 93% in 2023) [3]. Platform engineers now represent 37% of Argo CD users, reflecting its central role in Internal Developer Platforms.

Among CI/CD platforms, the CNCF survey reports GitHub Actions at 51%, Argo at 45%, Jenkins at 44%, GitLab at 34%, and **Azure Pipelines at 24%** [1]. Azure Pipelines remains a strong choice in enterprise environments with existing Microsoft ecosystem investments.

The fastest software delivery was ranked the #1 reason for GitOps adoption (71%), followed by improved configuration management (66%) and deployment consistency (66%) [2]. Traefik Labs' analysis of the 2026 CNCF survey describes GitOps as "non-negotiable," noting that "any infrastructure that requires manual configuration or UI-driven workflows is building for a shrinking market segment" [4].

**How this informs the PRD**: The adoption data validates a GitOps-first platform architecture. Azure Pipelines + ArgoCD is a proven combination at enterprise scale. The maturity correlation (GitOps adoption = operational maturity) positions v2's architecture as aligned with where the industry is heading, not just where it is today.

> **References**
>
> [1] CNCF, "Kubernetes Established as the De Facto Operating System for AI as Production Use Hits 82% in 2025 — CNCF Annual Cloud Native Survey," Jan 2026. https://www.cncf.io/announcements/2026/01/20/kubernetes-established-as-the-de-facto-operating-system-for-ai-as-production-use-hits-82-in-2025-cncf-annual-cloud-native-survey/
>
> [2] Codefresh, "New CNCF Survey Highlights GitOps Adoption Trends: 91% of Respondents Are Already Onboard," 2025. https://codefresh.io/blog/new-cncf-survey-highlights-gitops-adoption-trends-91-of-respondents-are-already-onboard/
>
> [3] CNCF, "CNCF End User Survey Finds Argo CD as Majority-Adopted GitOps Solution for Kubernetes," Jul 2025. https://www.cncf.io/announcements/2025/07/24/cncf-end-user-survey-finds-argo-cd-as-majority-adopted-gitops-solution-for-kubernetes/
>
> [4] Traefik Labs, "The Infrastructure Reality Behind AI Hype — Lessons from the 2026 CNCF Survey," 2026. https://traefik.io/blog/the-infrastructure-reality-behind-ai-hype

### 6.2 The Rendered Manifests Pattern

The rendered manifests pattern eliminates runtime abstraction between what is stored in Git and what is deployed to Kubernetes. Helm and Kustomize are used only during a CI rendering step; the output is fully hydrated YAML committed to Git. Akuity — the company founded by the Argo CD creators — published a widely cited blog post establishing this as the recommended production practice, noting: "Upgrading a Helm chart version or modifying a single value can result in large and unexpected changes to the rendered manifests. A reviewer may not realize the scope of those changes, leading to potentially dangerous deployments" [5].

Argo CD has built native support via the **Source Hydrator** feature (disabled by default), which watches two revisions in the same repo: a "dry source" (un-rendered) and a "hydrated source" (rendered manifests used for sync) [6]. The pattern has been described as "the new standard for GitOps" by multiple authors, with DevOps Directive publishing a detailed implementation guide in January 2026 [7].

Key benefits include: full YAML diff visibility in PRs, no need for cluster-side rendering credentials, easier rollback (revert a Git commit of plain YAML), improved audit trail, and elimination of Helm/Kustomize version drift between CI and CD environments.

**How this informs the PRD**: The PRD's core architectural decision to pre-render all manifests in CI and commit fully hydrated YAML to the GitOps repo is directly validated by this pattern. The enterprise compliance requirements for auditability and deterministic deployments make this the only viable approach for production GitOps at scale.

> **References**
>
> [5] Akuity, "The Rendered Manifests Pattern," 2024. https://akuity.io/blog/the-rendered-manifests-pattern
>
> [6] Argo CD, "Source Hydrator Documentation." https://argo-cd.readthedocs.io/en/latest/user-guide/source-hydrator/
>
> [7] DevOps Directive, "The Rendered Manifests Pattern," Jan 2026. https://devopsdirective.com/posts/2026/01/rendered-manifests-pattern/
>
> [8] Argo CD, "Manifest Hydrator Proposal." https://github.com/argoproj/argo-cd/blob/master/docs/proposals/manifest-hydrator.md
>
> [9] Medium, "Rendered Manifests Pattern — The New Standard for GitOps?" https://medium.com/@PlanB./rendered-manifests-pattern-the-new-standard-for-gitops-c0b9b020f3b6

### 6.3 Software Supply Chain Security

Software supply chain security has shifted from aspirational to regulatory. Three frameworks form the foundation:

**SLSA (Supply-chain Levels for Software Artifacts)** defines four levels of increasing rigor for verifiable build provenance — proving where and how software was built. SLSA 1.0 provides a graduated adoption path from basic provenance (Level 1) to hermetic, reproducible builds (Level 4) [10].

**Executive Order 14028** (May 2021, US) requires organizations selling to the federal government to implement secure development practices and maintain SBOM visibility. This has driven widespread SBOM standardization across both public and private sector [11]. The **EU Cyber Resilience Act**, taking effect in 2027, makes SBOM requirements mandatory for products sold in the EU, extending regulatory pressure globally [11].

**NIST SSDF v1.2** (SP 800-218 Rev. 1, draft released December 2025) provides the canonical framework for secure software development practices, including third-party component management and SBOM-based provenance tracking [12][13].

For SBOM formats, **CycloneDX** is better suited for security-focused use cases (natively supports VEX, hashing, dependency trees), while **SPDX** is preferred for legal and licensing compliance. Both are complementary to SLSA [14]. Datadog's State of DevSecOps 2025 report found that only 18% of critical CVSS vulnerabilities are truly critical after runtime context is applied, supporting the need for smart scanning and severity-based gating rather than blanket blocking [15].

**How this informs the PRD**: The PRD's inclusion of SBOM generation (CycloneDX format), Trivy scanning with configurable severity thresholds, and image digest pinning directly addresses EO 14028, upcoming EU CRA requirements, and NIST SSDF guidelines. Future phases should evaluate SLSA provenance attestation and cosign image signing to complete the supply chain trust model.

> **References**
>
> [10] SLSA, "SLSA + SBOM: Accelerating SBOM Success," 2022. https://slsa.dev/blog/2022/05/slsa-sbom
>
> [11] Dev.to, "Supply Chain Security in 2025: Why SBOM and SLSA Matter More Than Ever." https://dev.to/alexroor4/supply-chain-security-in-2025-why-sbom-and-slsa-matter-more-than-ever-2eh
>
> [12] NIST, "SSDF v1.2 Draft (SP 800-218 Rev.1)," Dec 2025. https://csrc.nist.gov/pubs/sp/800/218/r1/ipd
>
> [13] NIST, "Secure Software Development Framework (SSDF) Project." https://csrc.nist.gov/projects/ssdf
>
> [14] Harness, "SPDX vs CycloneDX — Which SBOM Format Should You Choose?" https://developer.harness.io/docs/software-supply-chain-assurance/how-to-guides/spdx-vs-cyclonedx/
>
> [15] Datadog, "State of DevSecOps 2025." https://www.datadoghq.com/state-of-devsecops/

### 6.4 Container Image Security Scanning

Trivy has emerged as the dominant open-source container scanner, adopted by an estimated **65% of Fortune 500 DevOps teams** as of 2025 [16]. It scans container images, filesystems, Git repos, and Kubernetes clusters for vulnerabilities, misconfigurations, secrets, and license issues — all from a single binary. Performance benchmarks show Trivy scanning gigabyte-sized images in **under 30 seconds**, making it viable for CI pipeline integration without becoming a bottleneck [17].

Trivy integrates natively with CNCF ecosystem projects including Harbor (registry-side scanning) and Copa (automated patching). It generates SBOMs in both CycloneDX and SPDX formats, enabling a single tool to cover both vulnerability scanning and SBOM generation requirements [18]. Integration with OPA (Open Policy Agent) enables artifact security enforcement, where scan results drive admission decisions at the cluster level [19].

The shift-left scanning model — embedding security scanning in CI rather than relying on runtime detection — is now the industry consensus. OWASP and the CNCF both recommend scanning at build time as the primary defense, with runtime scanning as a complementary layer [17]. OX Security's 2026 container security tools report lists Trivy as a top-tier scanner alongside Snyk Container, Anchore/Grype, and Sysdig [20].

**How this informs the PRD**: Trivy as the chosen scanner is well-supported by adoption data and ecosystem integration. Its ability to produce SBOMs alongside vulnerability scans reduces toolchain complexity — one tool covers SO-01 (CVE scanning), SO-02 (SBOM generation), SO-03 (manifest misconfiguration scanning), and partially SO-04 (secret detection). The sub-30-second scan time validates the 10-minute p95 pipeline target even with security gates included.

> **References**
>
> [16] Johal.in, "Container Security Scanning: Trivy for Docker Images in CI/CD 2025." https://johal.in/container-security-scanning-trivy-for-docker-images-in-ci-cd-2025/
>
> [17] Better Stack, "Trivy Explained: Container Image Scanning." https://betterstack.com/community/guides/scaling-docker/trivy-container/
>
> [18] CNCF, "Trivy Open Source Scanner for Container Images — Just Download and Run." https://www.cncf.io/online-programs/trivy-open-source-scanner-for-container-images-just-download-and-run/
>
> [19] CNCF Blog, "Enforcing Artifact Security with Trivy and OPA," May 2025. https://www.cncf.io/blog/2025/05/01/enforcing-artifact-security-with-trivy-and-opa/
>
> [20] OX Security, "Top 10 Container Security Tools 2026." https://www.ox.security/blog/container-security-tools-2026/

### 6.5 Cloud Native Buildpacks

Cloud Native Buildpacks (CNB) is a **CNCF incubating project**, originated jointly by Pivotal and Heroku in 2018 [21]. Community buildpack providers include Google, Heroku, and the **Paketo** project, which supports Java/Spring Boot, Node.js, Go, Python, .NET, Ruby, and more [22].

The key advantages over Dockerfiles center on three capabilities:

- **Reproducibility**: Buildpack outputs are deterministic — if input does not change, the output layer hash does not change. Dockerfiles rebuild and re-hash all subsequent layers when any preceding layer changes [23].
- **Rebase**: Base OS layers can be replaced without rebuilding application layers via `pack rebase`, enabling rapid security patching across thousands of images without rebuilding application code [24].
- **Centralized governance**: Container build best practices are concentrated in the platform team's buildpack definitions rather than scattered across hundreds of individual Dockerfiles maintained by application developers [25].

Google Cloud's Cloud Run and App Engine use buildpacks natively. Spring Boot has built-in support via the `spring-boot:build-image` Gradle/Maven task, which uses Paketo builders by default [24]. The reproducibility guarantee strengthens the supply chain security story — deterministic builds produce verifiable provenance.

**How this informs the PRD**: Buildpacks as an opt-in alternative (Phase 2) lets the platform team offer a "paved road" for teams willing to trade Dockerfile flexibility for centralized maintenance and faster security patching. The Spring Boot native integration makes it particularly compelling for the Java teams that represent a significant portion of the tenant base.

> **References**
>
> [21] CNCF, "Cloud Native Buildpacks Project." https://www.cncf.io/projects/buildpacks/
>
> [22] Cloud Native Buildpacks, "Official Documentation." https://buildpacks.io/
>
> [23] Cloud Native Buildpacks, "Reproducibility." https://buildpacks.io/docs/features/reproducibility/
>
> [24] Medium, "Dockerfiles vs Cloud-native Buildpacks." https://medium.com/@michael.vittrup.larsen/dockerfiles-vs-cloud-native-buildpacks-8acf8149dea1
>
> [25] DZone, "Why You Should Use Buildpacks Over Docker." https://dzone.com/articles/why-you-should-use-buildpacks-over-docker

### 6.6 Platform Engineering

Gartner predicts that by 2026, **80% of large software engineering organizations** will establish platform engineering teams as internal providers of reusable services, components, and tools for application delivery — up from 45% in 2022 [26]. Platform engineering was named among Gartner's Top Strategic Technology Trends for both 2025 and 2026, with dedicated publications including "Strategic Trends in Platform Engineering, 2025" and "Hype Cycle for Platform Engineering, 2025" [26][27].

The **Team Topologies** framework (Skelton & Pais) identifies four fundamental team types, with the **platform team** providing self-service capabilities that reduce cognitive load on stream-aligned (application) teams [28]. This model is now the de facto organizational pattern for platform engineering. The platform team owns the "golden path" — standardized, opinionated tooling that makes doing the right thing the easiest thing — while stream-aligned teams consume it with minimal configuration.

**Backstage** (Spotify, CNCF incubating) has emerged as the leading open-source framework for Internal Developer Portals. A reference architecture pairing Backstage with AKS, Crossplane, and Argo CD demonstrates the pattern in an Azure context directly relevant to this PRD [29]. However, a 2025 industry analysis notes a shift: "more enterprises will realize they need to start with the back end (APIs and orchestration) and then add a front end later" — validating the PRD's focus on pipeline templates and deployment automation before portal integration [30].

**How this informs the PRD**: This PRD is fundamentally a platform engineering initiative. Providing reusable pipeline templates, standardized build processes, and a consistent deployment model embodies the Team Topologies platform team pattern. The v2 templates are the "golden path" — consuming teams get security scanning, SBOM generation, and GitOps deployment by default, without needing to understand the underlying machinery.

> **References**
>
> [26] Gartner, "Strategic Trends in Platform Engineering, 2025." https://www.gartner.com/en/documents/6809534
>
> [27] Gartner, "Hype Cycle for Platform Engineering, 2025." https://www.gartner.com/en/documents/6586902
>
> [28] Medium, "Internal Developer Platforms, Team Topologies, and the Journey Beyond One-Size-Fits-All Solutions." https://medium.com/@ZaradarTR/internal-developer-platforms-team-topologies-and-the-journey-beyond-one-size-fits-all-solutions-7fa18de1394a
>
> [29] Medium, "Building an Internal Developer Portal with Backstage, AKS, Crossplane, and Argo CD." https://medium.com/@nonickedgr/building-an-internal-developer-portal-with-backstage-aks-crossplane-and-argo-cd-689d728fb0fc
>
> [30] Platform Engineering, "3 Platform Engineering Predictions for 2025." https://platformengineering.org/blog/platform-engineering-predictions-for-2025

### 6.7 Kustomize vs Helm: Adoption & Patterns

Helm leads Kubernetes configuration management at approximately **75% adoption** per CNCF 2025 survey data, but most mature teams use Helm alongside Kustomize in a hybrid approach [31]. The fundamental difference: Helm renders from Go templates, while Kustomize patches existing manifests via overlays. Kustomize output is always valid Kubernetes YAML with no intermediate representation [32].

The industry consensus hybrid pattern uses **Kustomize as the top-level orchestrator**, with Helm charts included via `helmCharts:` entries in kustomization.yaml. `kustomize build` produces the final YAML for each environment, incorporating Helm charts as one of multiple inputs [33]. For the rendered manifests pattern specifically, Kustomize is often preferred because "every Kustomize output is valid Kubernetes YAML" — there is no hidden state or template rendering ambiguity [34].

A 2026 analysis from a team managing 100+ clusters recommends: use Helm for third-party applications (community charts); use Kustomize for in-house applications where full YAML diff visibility matters [31]. Both ArgoCD and Flux support Helm and Kustomize natively, so the choice does not constrain the CD tool.

**How this informs the PRD**: The PRD's choice of Kustomize with base/overlay structure for environment-specific configuration follows the industry consensus hybrid pattern. Pre-rendering via `kustomize build` in CI and committing the output aligns perfectly with the rendered manifests pattern. Third-party Helm charts can still be consumed as remote bases within Kustomize overlays (KM-01).

> **References**
>
> [31] Tasrie IT, "Helm vs Kustomize: We Manage 100+ Clusters," 2026. https://tasrieit.com/blog/helm-vs-kustomize-kubernetes-comparison-2026
>
> [32] IBM, "Kustomize vs Helm — What's the Difference?" https://www.ibm.com/think/insights/kustomize-vs-helm
>
> [33] Spacelift, "Kustomize vs Helm — How to Use & Comparison." https://spacelift.io/blog/kustomize-vs-helm
>
> [34] Justin Polidori, "Helm vs Kustomize in 2025: Patterns, Pros, Cons," Aug 2025. https://justinpolidori.com/posts/20250815_helm_kustomize/

### 6.8 Image Digest Pinning & Immutable Deployments

A container image tag is mutable — it can point to different digests over time. A digest is the SHA256 hash of the image manifest content and is **immutable**. Deploying by digest (`image@sha256:...`) guarantees the exact image version runs in the cluster, eliminating an entire class of supply chain attacks where a tag is overwritten with a compromised image [35].

**Cosign** (part of the Sigstore project) provides keyless container image signing with transparency logs. The signed payload includes the image digest, binding the signature to a specific immutable artifact. Cosign uploads signatures as OCI artifacts alongside the image in the registry [35][36]. On the enforcement side, **Kyverno** and **Sigstore Policy Controller** act as Kubernetes admission controllers that refuse to run any container image without a valid signature — providing cloud-agnostic policy enforcement [37][38].

Google's **Binary Authorization** implements this pattern on GKE, acting as an admission controller that verifies attestations before allowing container execution [36]. The **OCI distribution specification** treats everything as first-class artifacts — Helm charts, SBOMs, signatures, WASM modules, policy bundles — all receiving digests, immutability, and access control [39].

**How this informs the PRD**: The pipeline's tag-to-digest resolution (Section 3.4) is validated by industry best practice. The rendered manifest contains `image@sha256:...` notation, ensuring immutable deployments. Future phases should evaluate cosign signing and admission controller enforcement (Kyverno or Sigstore Policy Controller) to complete the chain of trust from build through deployment.

> **References**
>
> [35] Cosign, "GitHub Repository (Sigstore)." https://github.com/sigstore/cosign
>
> [36] OneUptime, "Implementing Container Image Signing with Cosign and Binary Authorization," Feb 2026. https://oneuptime.com/blog/post/2026-02-17-how-to-implement-container-image-signing-with-cosign-and-binary-authorization-for-gke-deployments/view
>
> [37] think-ahead.tech, "Securing Container Supply Chain with Sigstore, Cosign, and Policy Enforcement." https://think-ahead.tech/en/container-signing
>
> [38] Seif Rajhi, "Sign and Verify Container Images with Cosign and Kyverno." https://seifrajhi.github.io/blog/sign-container-images-docker-cosign-kyverno/
>
> [39] OneUptime, "OCI Artifacts Explained: Beyond Container Images," Dec 2025. https://oneuptime.com/blog/post/2025-12-08-oci-artifacts-explained/view

### 6.9 Pipeline-as-Code & Template-Driven CI/CD

Azure DevOps YAML pipelines support two template mechanisms: **includes templates** (insert reusable content) and **extends templates** (control and constrain what a pipeline is allowed to do) [40]. The `extends` pattern is particularly important for platform teams: it defines a mandatory pipeline structure (e.g., security scanning is always required) while allowing application teams to customize specific parameters. This enables governance at scale without blocking developer velocity.

The industry best practice architecture uses a **dedicated `pipeline-templates` repository** referenced from application repos, with templates organized into stages, jobs, steps, and variables directories [41][42]. Versioning via Git tags with consumer-side pinning to specific versions prevents breaking changes from propagating automatically. Template expressions enable dynamic, parameterized pipelines that conditionally include steps, jobs, or stages based on parameter values [43].

A November 2025 article describes this exact pattern — "Building a Modern Development Platform: Azure DevOps Pipeline Templates" — documenting the organizational and technical patterns for shared template repositories serving multiple teams [41].

**How this informs the PRD**: The v2 template structure (jobs/, steps/, variables/) follows the established Azure DevOps best practice. Consumer repos pin to template tags (`ref: refs/tags/v2.0.0`), giving the platform team the ability to release new versions without forcing upgrades. The `extends` pattern should be evaluated for Phase 3 to enforce mandatory security steps that teams cannot bypass.

> **References**
>
> [40] Microsoft, "YAML Templates for Reusable and Secure Pipelines." https://learn.microsoft.com/en-us/azure/devops/pipelines/process/templates?view=azure-devops
>
> [41] Brian Sheridan, "Building a Modern Development Platform: Azure DevOps Pipeline Templates," Nov 2025. https://brianpsheridan.com/platform/azure-devops/cicd/pipelines/automation/templates/2025/11/10/tools-azure-devops-pipelines.html
>
> [42] OneUptime, "Azure Pipelines Templates: Share Reusable Logic Across Projects," Feb 2026. https://oneuptime.com/blog/post/2026-02-16-how-to-use-azure-pipelines-templates-to-share-reusable-pipeline-logic-across-projects/view
>
> [43] Microsoft, "Template Expressions." https://learn.microsoft.com/en-us/azure/devops/pipelines/process/template-expressions?view=azure-devops

### 6.10 Multi-Region Kubernetes Deployment Patterns

**ArgoCD ApplicationSets** are the primary mechanism for multi-cluster and multi-region deployment. Unlike standard Applications (one repo to one cluster), ApplicationSets use generators and templating to produce multiple Applications targeting different clusters automatically [44]. The **matrix generator** creates the Cartesian product of multiple dimensions — environment (dev, staging, prod) x region (eastus, westus3) — generating the full set of Application resources from a single definition [45].

The **Clusters generator** deploys to clusters based on labels (e.g., `region=us-east`, `env=production`). Adding a new cluster or region requires only updating the ApplicationSet configuration; Applications are auto-generated [44]. **RollingSync** limits the percentage of instances affected simultaneously during rollouts, enabling progressive multi-region deployments (e.g., deploy East US first, validate, then West US 3) [46].

Organizations report significant efficiency gains: **83% reduction in deployment times** (30+ minutes down to 5 minutes) for multi-cluster deployments using ApplicationSets [45]. AWS EKS has native Argo CD integration supporting ApplicationSets with cross-account and cross-region deployments [47]. Google's GKE Fleets integrate with Argo CD for fleet management at scale [48]. For very large fleets (hundreds of clusters), a **pull-based model** where clusters pull their config (rather than a central controller pushing) is an emerging pattern [49].

**How this informs the PRD**: The PRD's ApplicationSet strategy (Section 3.8) with matrix generators for environment x region is the industry-standard approach. The rendered manifests pattern integrates cleanly — each generated Application points at the pre-rendered manifest path for its environment and region. Regional deployment independence (Section 3.7) enables the canary-style rollout pattern that RollingSync formalizes.

> **References**
>
> [44] Argo CD, "ApplicationSet Controller Documentation." https://argo-cd.readthedocs.io/en/stable/operator-manual/applicationset/
>
> [45] Codefresh, "ArgoCD ApplicationSet: Multi-Cluster Deployment Made Easy." https://codefresh.io/learn/argo-cd/argocd-applicationset-multi-cluster-deployment-made-easy-with-code-examples/
>
> [46] DigitalOcean, "Manage Multi-Cluster Deployments with ArgoCD." https://www.digitalocean.com/community/tutorials/application-deployments-multi-cluster-kubernetes
>
> [47] AWS, "Streamlining GitOps with Amazon EKS Capability for Argo CD." https://aws.amazon.com/blogs/containers/deep-dive-streamlining-gitops-with-amazon-eks-capability-for-argo-cd/
>
> [48] Google Cloud, "Build Multi-Cluster Infrastructure with GKE Fleets and Argo CD." https://cloud.google.com/blog/products/containers-kubernetes/empower-your-teams-with-self-service-kubernetes-using-gke-fleets-and-argo-cd
>
> [49] ITNEXT, "Managing Applications across Fleets of Kubernetes Clusters." https://itnext.io/managing-applications-across-fleets-of-kubernetes-clusters-b71b96764e41

### 6.11 Research Summary

The following table maps each major PRD design decision to the industry data and patterns that validate it:

| PRD Design Decision | Industry Validation | Key Metric / Source |
| ------------------- | ------------------- | ------------------- |
| GitOps-first with Azure DevOps + ArgoCD | Azure Pipelines used by 24% of CNCF respondents; ArgoCD in ~60% of K8s clusters | CNCF 2025 Survey [1], CNCF End User Survey [3] |
| Rendered manifests (no in-cluster hydration) | Endorsed by Akuity/ArgoCD creators; native Source Hydrator in ArgoCD | Akuity [5], ArgoCD docs [6] |
| Kustomize for environment configuration | 75% Helm adoption, but hybrid Kustomize+Helm is the mature pattern; Kustomize outputs pure K8s YAML | CNCF Survey, Tasrie IT [31] |
| Trivy for scanning + SBOM generation | ~65% Fortune 500 adoption; sub-30s scans; produces CycloneDX/SPDX | [16][17][18] |
| Image digest pinning (`@sha256:...`) | OCI spec standard; required for Binary Authorization and policy enforcement | Cosign [35], OCI Artifacts [39] |
| Cloud Native Buildpacks (Phase 2) | CNCF incubating; reproducible builds; base image rebase without rebuild | CNCF [21], Buildpacks.io [23] |
| Reusable pipeline templates | Azure DevOps `extends` pattern enforces security + enables flexibility | Microsoft docs [40][43] |
| ApplicationSets for multi-region | Native ArgoCD feature; matrix generators; 83% deployment time reduction | ArgoCD docs [44], Codefresh [45] |
| Platform team model | Gartner: 80% of large orgs will have platform engineering teams by 2026 | Gartner [26][27] |
| SBOM + supply chain compliance | EO 14028, EU CRA (2027), NIST SSDF v1.2 — regulatory requirements are converging | SLSA [10], NIST [12][13] |

---

## 7. Artifact Requests

To finalize this PRD and ensure v2 templates build on existing platform knowledge rather than reinventing from scratch, the following artifacts are requested from the platform team. Each request identifies what is needed, why it matters, and which PRD sections it informs.

### v1 Pipeline Templates

| Artifact | Why It's Needed | Informs |
| -------- | --------------- | ------- |
| **`stages/path-to-production.yml`** (full file) | Understand the current stage orchestration, parameter surface, and sequencing so v2 job templates can be composed to replicate (and improve on) the same end-to-end flow. Identifies which v1 behaviors must be preserved during coexistence. | Section 3.2 (template structure), Section 4 (migration strategy) |
| **Any v1 container build templates** (Dockerfile-based) | See how Docker build/push is currently parameterized — which parameters consumers already pass, what defaults exist, and what gaps drove complaints. Avoids breaking existing consumer expectations. | Section 3.3 (container creation), CC-02 acceptance criteria |
| **Any v1 Kustomize or manifest rendering templates** | Understand current rendering approach, overlay structure assumptions, and how manifests are committed to the GitOps repo today. Critical for designing the v2 commit workflow and traceability model. | Section 3.5 (manifest rendering), Section 3.5 (commit workflow) |
| **v1 parameter definitions or variable files** | Catalog the existing parameter contract between consumers and templates. v2 should maintain backward-compatible naming where possible to ease migration. | Section 3.3 (consumer interface), Section 4 (migration path) |
| **A representative consumer `azure-pipelines.yml`** from an application repo | See how real teams reference v1 templates today — trigger configuration, parameter overrides, custom stages or jobs added around the template. Informs the v2 consumer interface design. | Section 3.3 (consumer template interface), Section 4 (migration Phase A/B) |

### ArgoCD Configuration

| Artifact | Why It's Needed | Informs |
| -------- | --------------- | ------- |
| **Sample ArgoCD Application or ApplicationSet manifest** | Validate assumptions about how ArgoCD Applications are configured today — sync policies, project scoping, source paths. Ensures v2 rendered manifest output lands in the right directory structure. | Section 3.8 (ArgoCD integration), KM-03/KM-05 acceptance criteria |
| **ArgoCD AppProject definitions** | Understand RBAC boundaries per team. The ApplicationSet example currently uses `project: my-service` — need to confirm naming conventions and permissions model. | Section 3.8 (ApplicationSet strategy) |
| **Current GitOps manifest repo directory structure** | Confirm the actual repo layout (apps/overlays/rendered paths). The PRD proposes `apps/<app-name>/rendered/<env>-<region>/` — need to validate this against reality or document the migration from the current structure. | Section 3.1 (architecture), Section 3.5 (Kustomize overlay structure) |

### Security & Scanning

| Artifact | Why It's Needed | Informs |
| -------- | --------------- | ------- |
| **Current Trivy configuration or scan scripts** | Understand existing severity thresholds, ignore files, and output formats. Avoid regressing on scan coverage or changing gate behavior unexpectedly for existing teams. | Section 3.6 (security operations), SO-01 acceptance criteria |
| **Any existing `.trivyignore` files or policy exceptions** | Carry forward legitimate exceptions into v2 templates. Identifies known false positive patterns. | Section 5 (Trivy false positive risk) |
| **Current secret detection tooling and configuration** (if any) | Determine if teams already use Gitleaks or an alternative, and whether existing configurations should be preserved or standardized. | SO-04 acceptance criteria |

### Platform Operations

| Artifact | Why It's Needed | Informs |
| -------- | --------------- | ------- |
| **Existing PowerShell or Python utility scripts** used in v1 pipelines | Identify reusable logic (registry login, tagging, manifest manipulation) that can be refactored into v2 scripts rather than rewritten. Leverages existing team expertise. | Section 3.2 (scripts/ directory), all script examples |
| **Container registry configuration** (ACR names, service connection names, any multi-registry setup) | Parameterize v2 templates correctly against real infrastructure. Determines if single-registry or multi-registry support is needed for MVP. | Section 3.3 (CC-04), Section 3.10 (integration points) |
| **ADO agent pool configuration** | Understand available agent capabilities (Docker version, installed tools, OS). Determines whether `steps/install-tools.yml` needs to install everything from scratch or can rely on pre-installed tooling. | Section 3.2 (install-tools step), Phase 1 timeline |
| **Current prod deployment process documentation or runbooks** | Understand the existing prod release workflow — approval gates, ArgoCD CLI usage patterns, notification channels. Ensures the `argocd-sync.yml` job template matches actual operational procedures. | Section 3.7 (prod deployment pipeline) |
| **List of all 15 tenant teams and their tech stacks** | Prioritize which languages and patterns to support first. If 10 of 15 teams use Java/Gradle, that validates the Phase 1 scope. If 5 teams use Angular, Phase 2 sequencing may need adjustment. | Section 5 (phased rollout), Phase 1 scope validation |

### Priority

Artifacts are grouped by urgency relative to the Phase 1 timeline:

**Needed before development starts (Week 0)**:
- v1 `stages/path-to-production.yml` and container build templates
- Representative consumer `azure-pipelines.yml`
- Current GitOps manifest repo directory structure
- ADO agent pool configuration
- Tenant team list with tech stacks

**Needed by Week 3**:
- v1 parameter definitions and variable files
- ArgoCD Application/ApplicationSet samples
- Existing PowerShell/Python utility scripts
- Container registry configuration

**Needed by Week 6**:
- Trivy configuration and `.trivyignore` files
- Prod deployment runbooks
- ArgoCD AppProject definitions
- Secret detection tooling configuration
