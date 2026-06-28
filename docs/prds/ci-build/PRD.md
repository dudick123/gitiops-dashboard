# PRD: CI Container Build Pipeline — v2 Architecture

**Document ID:** PRD-2026-CI-BUILD-001
**Document Status:** Draft
**Version:** 0.3.0
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
14. [Appendix A: Image Tagging Strategy Reference](#14-appendix-a-image-tagging-strategy-reference)
15. [Appendix B: Runtime Support Reference](#15-appendix-b-runtime-support-reference)

---

## 1. Overview

This document defines requirements for a **v2 CI container build pipeline** for the AKS-based multi-tenant platform. The v2 architecture establishes a single, opinionated, best-practice standard for all container image builds across the platform, consumed by tenant application teams via a shared ADO pipeline template.

The pipeline triggers on PR merge to main in ADO source repositories. It builds container images from Dockerfiles, generates SBOMs using Syft, signs images and attestations using Cosign, and publishes to a shared Azure Container Registry. The pipeline establishes image provenance as a first-class output alongside the image itself.

The pipeline supports six primary runtimes used across the platform — Angular, React, Spring Boot (Gradle), Python, and Go — through a composable template architecture. A single base template owns all invariant platform steps (lint, build, sign, publish). Runtime-specific pre-build behaviour is dispatched to dedicated step templates, keeping the base template stable as new runtimes are added.

Vulnerability and security scanning (Trivy, Nexus, Fortify) is performed by a dedicated security scan pipeline that operates as a separate loop against images already published to ACR. That pipeline is out of scope here and is governed by its own PRD. This pipeline hands off a signed, published image to that downstream security loop via the shared ACR.

This PRD is a companion to PRD-2026-CI-RENDER-001 (manifest rendering pipeline). Together they define the CI pipelines that feed the platform GitOps delivery chain: this pipeline produces the image, the rendering pipeline consumes the image reference and produces the manifests that ArgoCD applies.

> **Scope boundary:** This PRD covers container image build, sign, and publish only. Security scanning (Trivy, Nexus, Fortify) is governed by the security scan pipeline PRD. Manifest generation, ArgoCD Application management, tenant onboarding, and runtime Kubernetes policy enforcement are governed by their respective PRDs.

---

## 2. Problem Statement

Tenant teams currently build container images using individually crafted ADO pipelines with no shared template, no enforced standards, and inconsistent security controls. Specific gaps:

**No platform build standard.** Each tenant team owns a bespoke pipeline. Build tool versions, layer caching strategies, base image sources, and output tag conventions differ across teams. There is no canonical reference for how a compliant build pipeline should be structured on this platform. This is compounded by the diversity of runtimes in use — Angular, React, Spring Boot, Python, and Go — each with different pre-build toolchain requirements and caching considerations.

**No runtime composability model.** There is no standardised approach to supporting multiple languages and runtimes under a single pipeline template. Teams building Spring Boot applications manage Gradle toolchains differently from those building Go binaries or React static assets. Without a composable template model, adding a new runtime requires a new bespoke pipeline rather than a runtime-specific extension to a shared base.

**No image signing or provenance.** No images produced on the platform are currently signed. There is no attestation of build provenance, no SBOM associated with any image, and no mechanism for ArgoCD or Kyverno to enforce that only platform-built, signed images are admitted to the cluster.

**No SBOM generation.** Software Bill of Materials generation is absent. As regulatory and customer requirements around software supply chain transparency increase, the absence of SBOMs is a compliance gap.

**Tag inconsistency.** Image tags are team-defined and range from `latest` (which is explicitly prohibited but not enforced) to ad-hoc semver strings with no relationship to Git commit SHA. There is no reliable way to trace a running image back to its source commit.

**ACR governance gap.** Images are pushed directly to the shared ACR without a consistent naming convention, retention policy enforcement, or a well-defined handoff point to the downstream security scan pipeline.

> **Note on security scanning:** Vulnerability and security scanning (Trivy, Nexus, Fortify) runs in a separate pipeline loop against images already in ACR. The gaps in scanning consistency and gate enforcement are real but are addressed in the security scan pipeline PRD, not here. This pipeline's responsibility is to ensure a well-formed, signed, SBOM-attested image reaches ACR as a clean handoff to that downstream process.

---

## 3. Goals and Non-Goals

### Goals

- **G-1:** Establish a canonical v2 container build pipeline template consumed by all tenant teams via a shared ADO YAML template.
- **G-2:** Build container images from Dockerfiles on PR merge to main in ADO source repositories.
- **G-3:** Support the six primary platform runtimes (Angular, React, Spring Boot/Gradle, Python, Go) through a composable base-plus-runtime-step-template architecture that allows new runtimes to be added without modifying the base template.
- **G-4:** Generate a Software Bill of Materials (SBOM) using Syft for every image built by the pipeline.
- **G-5:** Sign every published image and its SBOM attestation using Cosign, establishing cryptographic build provenance as a platform standard.
- **G-6:** Enforce a consistent image tagging convention that includes Git commit SHA, enabling reliable traceability from running container to source code.
- **G-7:** Publish images to the shared ACR using a consistent repository naming convention scoped by tenant, providing a clean handoff point to the downstream security scan pipeline.
- **G-8:** Surface build provenance metadata to the ADO pull request and run summary for reviewer visibility.
- **G-9:** Provide a dryRun mode that executes all build steps without pushing to ACR or signing.

### Non-Goals

- **NG-1:** This pipeline does not build base images. Base image curation and hardening is a platform engineering responsibility governed separately.
- **NG-2:** This pipeline does not update Kustomize overlays or config repo image references. Image reference promotion is a separate step, either manual or via a future Kargo integration.
- **NG-3:** This pipeline does not perform runtime admission enforcement. Kyverno policies governing which images are admitted to the cluster are governed by PRD-2026-KYVERNO-POLICY-001.
- **NG-4:** This pipeline does not manage ACR access control or retention policies. ACR governance is a platform engineering operation.
- **NG-5:** This pipeline does not support Cloud Native Buildpacks or multi-stage build strategies beyond standard Dockerfile. CNB evaluation is deferred.
- **NG-6:** This pipeline does not perform vulnerability scanning, SCA, SAST, or DAST. Trivy, Nexus, and Fortify scanning runs in a dedicated security scan pipeline that operates as a separate loop against published ACR images. Scan gate enforcement and remediation workflows are governed by the security scan pipeline PRD.

---

## 4. Users and Stakeholders

| Role | Interest |
|---|---|
| **Tenant Teams** | Primary consumers of the pipeline template. Build and publish application container images. Receive build provenance and signing confirmation as pipeline feedback. |
| **Platform Engineering** | Authors and maintainers of the shared pipeline template, Cosign key infrastructure, and ACR naming conventions. |
| **Platform Lead** | Accountable for v2 build pipeline adoption, supply chain security posture, and SBOM compliance requirements. |
| **Security / Compliance** | Interested in SBOM generation, Cosign signing, and image provenance as inputs to the downstream security scan pipeline. The build pipeline's signed image and SBOM are the handoff artifacts that the security scan pipeline operates against. |
| **Security Scan Pipeline** | Downstream consumer of images published to ACR by this pipeline. Runs Trivy, Nexus, and Fortify scans against the published image digest. |
| **Akuity / ArgoCD + Kyverno** | Downstream consumers of signed images. Kyverno admission policies will eventually enforce that only Cosign-verified, platform-built images are admitted. |

---

## 5. Success Metrics

| ID | Metric | Target |
|---|---|---|
| SM-1 | All tenant container builds use the v2 shared pipeline template. | 100% of tenant image builds migrated from bespoke pipelines. |
| SM-2 | Every image pushed to ACR has a corresponding Cosign signature and SBOM attestation. | 100% of images published post-rollout. |
| SM-3 | Every image tag includes the Git commit SHA. | 100% of published images traceable to source commit. |
| SM-4 | The `latest` tag is never pushed to ACR by the pipeline. | Zero `latest` tag pushes from pipeline-managed builds. |
| SM-5 | Build provenance summary is surfaced in the ADO PR or run summary for every build. | 100% of builds produce a provenance summary visible to the PR author. |
| SM-6 | SBOM artifacts are published to ACR as OCI attestations alongside every image. | 100% of published images have an attached SBOM. |
| SM-7 | Every published image is consumed by the downstream security scan pipeline within the defined SLA. | Security scan pipeline triggered within 15 minutes of image push to ACR. |
| SM-8 | dryRun mode validated by at least three tenant teams before mandatory rollout. | Confirmed before rollout gate. |
| SM-9 | Mean time from PR merge to image available in ACR. | < 15 minutes for standard Dockerfile builds. |

---

## 6. Architecture

### 6.1 Pattern

The pipeline follows a **build → sign → publish** pattern. No image is published without a Cosign signature and SBOM attestation. Once published to ACR, the image digest is handed off to the downstream security scan pipeline (Trivy, Nexus, Fortify) which operates as a separate loop. The pipeline is expressed as a shared ADO YAML template referenced by tenant repositories.

```
ADO Source Repo (tenant)             Azure Container Registry (shared)
+-----------------------------+       +--------------------------------+
| Source Code                 |  CI   | <tenant>/<app>:<sha>           |
| Dockerfile                  | ────► | <tenant>/<app>:<sha>.sig       |
| PR merge to main            | build |   (Cosign signature)           |
|                             | sign  | <tenant>/<app>:<sha>.att       |
|                             | push  |   (SBOM attestation)           |
+-----------------------------+       | <tenant>/<app>:<branch>-<sha>  |
                                      |   (human-readable alias tag)   |
                                      +----------------+---------------+
                                                       |
                                          ┌────────────┴────────────┐
                                          │                         │
                                          ▼                         ▼
                                 Security Scan Pipeline     Kustomize image ref
                                 (Trivy, Nexus, Fortify)    updated in config
                                 — separate pipeline loop    repo (manual or
                                 governed by its own PRD     future Kargo step)
                                                                     │
                                                                     ▼
                                                           ArgoCD renders + applies
```

### 6.2 Shared Pipeline Template Model

The v2 build pipeline is implemented as a **composable ADO YAML template set** stored in the platform templates repository. The architecture separates invariant platform steps from runtime-specific pre-build behaviour:

```
platform-templates/
  container-build-v2.yml          ← tenant entry point (base template)
  steps/
    setup.yml                     ← tool resolution, parameter validation
    dockerfile-lint.yml           ← Hadolint
    docker-build.yml              ← BuildKit build + OCI label injection
    sbom-sign-publish.yml         ← Syft, Cosign, ACR push, notify
    runtime/
      angular.yml                 ← npm ci + ng build (pre-build on agent)
      react.yml                   ← npm ci + framework build (pre-build on agent)
      springboot.yml              ← Gradle wrapper + bootJar + test report
      python.yml                  ← (pass-through; build is in Dockerfile)
      go.yml                      ← (pass-through; build is in Dockerfile)
```

The base template (`container-build-v2.yml`) owns all invariant security controls and dispatches to the appropriate runtime step template based on the `runtimeType` parameter. Adding a new runtime requires adding a file under `steps/runtime/` and a dispatch entry in the base template — it does not require modifying any existing step template.

Tenant pipeline entry point:

```yaml
# tenant app repo: azure-pipelines.yml
trigger:
  branches:
    include:
      - main

extends:
  template: templates/container-build-v2.yml@platform-templates
  parameters:
    tenantName: payments
    appName: payment-processor
    runtimeType: springboot        # angular | react | springboot | python | go
    dockerfilePath: ./Dockerfile
    buildContext: .
```

All platform controls (Cosign keys, ACR endpoint, tag convention) are defined inside the base template and not overridable by tenant parameters. The `runtimeType` parameter is the only mechanism by which tenant builds vary their pre-build behaviour.

### 6.3 Image Naming and Tagging Convention

Images are published to the shared ACR using a platform-defined naming convention. Tenant teams do not control ACR repository names or tag formats.

**Repository name:** `<tenant-name>/<app-name>`

**Tags published per build:**

| Tag | Format | Purpose |
|---|---|---|
| Primary (immutable) | `<git-sha>` (full 40-char SHA) | Canonical reference; used by Kustomize image field and Kyverno verification. |
| Alias (human-readable) | `<branch>-<short-sha>` (e.g. `main-abc1234`) | Convenience reference for human navigation; not used in manifests. |
| Semver (conditional) | `v<major>.<minor>.<patch>` | Published only when the triggering commit is tagged with a semver Git tag. Never `latest`. |

The `latest` tag MUST NOT be pushed by any pipeline-managed build. This is enforced as a pipeline-level assertion, not a convention.

### 6.4 Image Provenance Model

Every published image has three associated OCI artifacts in ACR:

- **Image** — the built container image, tagged per 6.3.
- **Cosign signature** — a detached signature of the image digest, stored as `<image>:<sha>.sig`. Produced by `cosign sign`.
- **SBOM attestation** — a CycloneDX or SPDX SBOM generated by Syft, attached as an OCI attestation via `cosign attest`. Stored as `<image>:<sha>.att`.

Cosign signing uses a platform-managed key stored in Azure Key Vault. The pipeline retrieves the private key at sign time via the ADO Key Vault task. Tenant teams have no access to the signing key.

### 6.5 Security Scan Pipeline Handoff

Vulnerability and security scanning (Trivy, Nexus, Fortify) is not performed by this pipeline. It runs in a dedicated security scan pipeline that triggers independently against images already published to ACR. This pipeline's responsibility is to ensure a well-formed, signed, SBOM-attested image reaches ACR with sufficient metadata for the security scan pipeline to operate correctly.

The handoff contract between this pipeline and the security scan pipeline is:

| Artifact | Location | Purpose |
|---|---|---|
| Image | `<acr>/<tenant>/<app>:<sha>` | The build artifact to be scanned. |
| Image digest | ADO pipeline output variable | Unambiguous reference for the security scan pipeline to target the exact built image. |
| Cosign signature | `<acr>/<tenant>/<app>:<sha>.sig` | Allows the security scan pipeline to verify the image originated from the platform build pipeline before scanning. |
| SBOM attestation | `<acr>/<tenant>/<app>:<sha>.att` | CycloneDX SBOM available to the security scan pipeline and audit consumers without re-generating from the image. |

The security scan pipeline is responsible for defining severity thresholds, gate behaviour, exemption processes, and remediation workflows for Trivy, Nexus, and Fortify findings. Those concerns are explicitly out of scope for this PRD.

### 6.6 Cosign Key Infrastructure

Cosign signing uses **key-based signing** (not keyless/OIDC) to maintain compatibility with the current platform environment and avoid dependency on a Fulcio/Rekor public transparency log. The private key is stored in Azure Key Vault under platform engineering control.

Verification at admission time (Kyverno ImageVerification policy) uses the corresponding public key, distributed as a platform-managed ConfigMap or Kyverno ClusterPolicy resource.

Keyless signing via OIDC workload identity is recorded as a future migration path in Open Questions.

### 6.7 Runtime Build Patterns

The six supported runtimes fall into two build patterns that drive the content of each runtime step template.

**Pattern A — In-Dockerfile build (self-contained)**

The entire build toolchain runs inside a multi-stage Dockerfile. The runtime step template on the pipeline agent is a pass-through — no pre-build steps run outside the container. The pipeline agent only needs Docker; no language runtime is required on the agent itself.

| Runtime | Pattern | Notes |
|---|---|---|
| Go | A — In-Dockerfile | Multi-stage: `golang:1.x` build stage → `distroless/static` or `scratch` final stage. Produces a single static binary. Minimal final image. |
| Python | A — In-Dockerfile | Multi-stage: `python:3.x-slim` build stage for dependency install → slim final stage. `pip install` layer is cached naturally by Docker layer caching. |

**Pattern B — Pre-build on agent, copy artifact into image**

A build step runs on the pipeline agent before `docker build`. The Dockerfile receives a pre-built artifact (a JAR, or a compiled static asset directory) rather than source code. This pattern enables more sophisticated caching (Gradle build cache, npm cache) and produces faster builds at the cost of requiring the relevant toolchain on the pipeline agent.

| Runtime | Pattern | Pre-build Step | Artifact passed to Docker | Notes |
|---|---|---|---|---|
| Spring Boot / Gradle | B — Pre-build | `gradle bootJar` | `build/libs/*.jar` | Gradle wrapper handles JDK version. Gradle build cache backed by platform cache endpoint. Test reports published before Docker build. |
| Angular | B — Pre-build | `npm ci && ng build` | `dist/<app>/` | Output directory copied into nginx serving image. Node version managed via `.nvmrc` or `engines` field. |
| React | B — Pre-build | `npm ci && <framework build>` | `dist/` or `build/` | Supports Vite, CRA, Next.js static export. Framework detected from `package.json`. |

**Pattern selection guidance**

Pattern A is simpler and preferred where build times are acceptable and no agent-side caching is needed. Pattern B is preferred when Gradle build cache or npm caching provides a meaningful time reduction and the toolchain is stable across tenant teams. Platform engineering maintains the agent image that includes Node, JDK, and other Pattern B toolchains.

The `runtimeType` parameter in the tenant pipeline entry point is the sole mechanism for selecting the pattern. Tenants do not configure the pattern directly.

---

## 7. Pipeline Stages

| Stage | Name | Condition | Key Jobs |
|---|---|---|---|
| 1 | Setup | Always | `ResolveTools`, `ValidateParameters`, `ValidateRuntimeType` |
| 2 | Build | Stage 1 succeeded | `RuntimePreBuild` (Pattern B runtimes only), `DockerfileLint`, `BuildImage` |
| 3 | Sign & Attest | Stage 2 succeeded; `dryRun=false` | `GenerateSBOM`, `SignImage`, `AttachSBOM` |
| 4 | Publish | Stage 3 succeeded; `dryRun=false` | `PushImage`, `PushTags`, `PublishProvenance` |
| 5 | Notify | Always (post-pipeline) | `PublishBuildSummary`, `NotifySecurityScanPipeline` |

The build (Stage 2) produces a local image held on the pipeline agent. For Pattern B runtimes (Angular, React, Spring Boot), `RuntimePreBuild` executes first and produces the artifact the Dockerfile expects. For Pattern A runtimes (Go, Python), `RuntimePreBuild` is a no-op pass-through. The image is not pushed to ACR until Stage 4. The security scan pipeline is triggered from Stage 5 after the image is confirmed present in ACR.

---

## 8. Functional Requirements

### 8.1 Tool Resolution

**FR-1.1:** The pipeline MUST resolve all tool versions from the platform-managed ADO variable group (`platform-tool-versions`). Hard-coded tool versions in pipeline template YAML are not permitted.

**FR-1.2:** The pipeline MUST cache resolved tool binaries as a named pipeline artifact consumed by all downstream jobs.

**FR-1.3:** The following tools MUST be pinned and resolved: Docker (BuildKit), Syft, Cosign, Hadolint.

**FR-1.4:** The pipeline template MUST be stored in the platform templates repository and referenced via `extends:` by tenant repositories. Tenant repositories MUST NOT copy or inline the template.

### 8.2 Parameters and Tenant Interface

**FR-2.1:** The pipeline template MUST expose the following tenant-supplied parameters and no others: `tenantName`, `appName`, `runtimeType`, `dockerfilePath`, `buildContext`, `dryRun`.

**FR-2.2:** All platform controls (Cosign key reference, ACR endpoint, tag convention) MUST be platform-defined within the base template and MUST NOT be overridable by tenant parameters.

**FR-2.3:** The pipeline MUST validate that `tenantName` and `appName` conform to the platform naming convention (lowercase alphanumeric and hyphens only, no slashes) before any build step executes. Violation MUST fail Stage 1.

**FR-2.4:** The pipeline MUST validate that the Dockerfile exists at the supplied `dockerfilePath` relative to the build context. A missing Dockerfile MUST fail Stage 1.

**FR-2.5:** The `runtimeType` parameter MUST be validated against the platform-defined allowlist of supported values: `angular`, `react`, `springboot`, `python`, `go`. An unsupported value MUST fail Stage 1 with a message identifying the invalid runtime and listing valid options.

**FR-2.6:** The pipeline MUST validate that the runtime step template corresponding to `runtimeType` exists in the platform templates repository at `steps/runtime/<runtimeType>.yml`. A missing step template MUST fail Stage 1. This prevents a valid `runtimeType` from silently skipping pre-build steps due to a missing file.

### 8.3 Runtime Pre-Build

**FR-3.1:** For `runtimeType` values that follow Pattern B (Angular, React, Spring Boot), the pipeline MUST execute the runtime step template (`steps/runtime/<runtimeType>.yml`) as the first job in Stage 2, before Dockerfile lint and `docker build`.

**FR-3.2:** For `runtimeType` values that follow Pattern A (Go, Python), the runtime step template MUST be a validated pass-through. No pre-build steps execute on the agent. The Dockerfile is responsible for the full build toolchain.

**FR-3.3:** The Spring Boot / Gradle runtime step template MUST: invoke the Gradle wrapper (`./gradlew`), execute the `bootJar` task, publish test reports as ADO test results before proceeding to `docker build`, and configure the Gradle build cache to use the platform-managed cache endpoint defined in the `platform-tool-versions` variable group.

**FR-3.4:** The Angular and React runtime step templates MUST: run `npm ci` using the Node version specified in the repository's `.nvmrc` or `engines.node` field in `package.json`, execute the framework build command, and produce a compiled static asset directory that the Dockerfile `COPY` instruction references. The Node version MUST be validated against a platform-defined allowlist before installation.

**FR-3.5:** Pre-build artifacts produced by Pattern B step templates (JAR files, static asset directories) MUST NOT be committed to the source repository or published as pipeline artifacts. They exist only on the agent for the duration of the `docker build` step and are discarded thereafter.

**FR-3.6:** A runtime step template MUST NOT modify the Dockerfile, the build context, or any file outside the pre-build output directory. Template scope is strictly limited to producing the artifact the Dockerfile expects.

### 8.4 Build

**FR-4.1:** The pipeline MUST build the container image using Docker BuildKit. Legacy `docker build` without BuildKit MUST NOT be used.

**FR-4.2:** The pipeline MUST lint the Dockerfile using Hadolint before the build step. Hadolint findings at ERROR level MUST fail the build. WARNING level findings MUST be reported in the run summary but MUST NOT block.

**FR-4.3:** The pipeline MUST pass the full Git commit SHA as a build argument (`--build-arg GIT_COMMIT_SHA=<sha>`) and as an image label (`org.opencontainers.image.revision=<sha>`). The pipeline MUST also apply the following OCI labels to every built image: `org.opencontainers.image.source`, `org.opencontainers.image.created`, `org.opencontainers.image.revision`, `org.opencontainers.image.title`.

**FR-4.4:** The pipeline MUST NOT build images as root on the pipeline agent where avoidable. BuildKit rootless mode or a rootless agent configuration MUST be used.

**FR-4.5:** The pipeline MUST use layer caching backed by ACR cache storage (`--cache-from`, `--cache-to` with ACR as the cache registry) to minimise redundant layer rebuilds across pipeline runs.

**FR-4.6:** The built image MUST be held locally on the pipeline agent after the build step. The image MUST NOT be pushed to ACR until Stage 4. Any step that pushes the image before Stage 4 completes is a pipeline error.

**FR-4.7:** The pipeline MUST record the full image digest (`sha256:...`) produced by the build step and carry it through all downstream stages. All downstream references (sign, push) MUST use the digest, not a tag, to ensure they operate on the exact built image.

### 8.5 Security Scan Pipeline Handoff

**FR-5.1:** Upon successful image push to ACR (FR-7.1), the pipeline MUST publish the full image digest reference (`<acr-host>/<tenant>/<app>@sha256:<digest>`) as a named ADO pipeline output variable. This is the canonical input the security scan pipeline uses to target the exact built image.

**FR-5.2:** The pipeline MUST trigger the downstream security scan pipeline upon successful completion of Stage 4 (Publish). The trigger mechanism (ADO pipeline trigger, webhook, or event-based) is determined by the security scan pipeline architecture and is out of scope for this PRD. This pipeline's responsibility is to emit the image reference in a form the security scan pipeline can consume.

**FR-5.3:** The pipeline MUST NOT gate publish on security scan results. Security scan gate enforcement — including Trivy, Nexus, and Fortify findings — is the exclusive responsibility of the security scan pipeline. This pipeline publishes first; the security scan pipeline decides disposition.

**FR-5.4:** The build summary posted to the ADO PR (FR-9.1) MUST include a note that security scanning (Trivy, Nexus, Fortify) runs in a separate pipeline and that results will be available there. A direct link to the triggered security scan pipeline run MUST be included where the trigger mechanism supports it.

### 8.6 SBOM Generation

**FR-6.1:** The pipeline MUST generate a Software Bill of Materials (SBOM) for every successfully built image using Syft.

**FR-6.2:** The SBOM MUST be generated in CycloneDX JSON format. SPDX format generation is optional but recommended as a secondary output.

**FR-6.3:** The SBOM MUST be generated from the locally held image (not from source code alone) to capture all runtime dependencies including those introduced by the base image.

**FR-6.4:** The SBOM file MUST be published as a named pipeline artifact retained for audit purposes, independent of its attachment as an OCI attestation.

### 8.7 Image Signing and Attestation

**FR-7.1:** The pipeline MUST sign every image using Cosign before pushing to ACR. Signing MUST use the platform-managed private key retrieved from Azure Key Vault at runtime via the ADO Key Vault task.

**FR-7.2:** Cosign signing MUST operate on the image digest (`sha256:...`), not a tag. This ensures the signature is bound to the exact image content and cannot be transferred to a different image by retagging.

**FR-7.3:** The pipeline MUST attach the Syft-generated SBOM as an OCI attestation using `cosign attest`. The attestation MUST be stored in the same ACR repository as the image.

**FR-7.4:** The Cosign signing key MUST be retrieved from Azure Key Vault using the ADO Key Vault task at the start of Stage 3. The key MUST NOT be stored in pipeline variables, ADO variable groups, or any location accessible to tenant teams.

**FR-7.5:** The pipeline MUST verify the Cosign signature immediately after signing, before proceeding to Stage 4. A failed verification MUST block the push.

**FR-7.6:** The Cosign public key used for signature verification MUST be published as a platform-managed resource (Kyverno ClusterPolicy or ConfigMap) and versioned separately from the signing key. Key rotation is a platform engineering operation.

### 8.8 Publish

**FR-8.1:** The pipeline MUST push the image to the shared ACR only after all of the following have completed successfully: SBOM generated, Cosign signature produced and verified.

**FR-8.2:** The image MUST be pushed to ACR using the repository name `<tenantName>/<appName>` and tagged per the convention defined in section 6.3.

**FR-8.3:** The pipeline MUST push the primary immutable tag (full Git SHA) and the alias tag (`<branch>-<short-sha>`) in the same push operation. Semver tags MUST be pushed only when the triggering commit carries a semver Git tag.

**FR-8.4:** The pipeline MUST assert that the `latest` tag is not being pushed. If the tag convention logic produces a `latest` tag for any reason, the pipeline MUST fail before pushing.

**FR-8.5:** After push, the pipeline MUST verify that the image digest returned by ACR matches the digest produced at build time (FR-4.7). A digest mismatch MUST fail the pipeline and trigger an alert.

**FR-8.6:** The pipeline MUST publish an image provenance summary as a pipeline artifact and as a PR comment. The summary MUST include: image digest, ACR repository path, tags pushed, SBOM artifact location, Cosign signature status, and a reference to the triggered security scan pipeline run.

**FR-8.7:** The pipeline MUST output the full image reference (`<acr-host>/<tenant>/<app>@sha256:<digest>`) as a named ADO pipeline output variable. This variable is the canonical handoff point to downstream processes (manual Kustomize image update or future Kargo promotion step).

### 8.9 Dry Run Mode

**FR-9.1:** When `dryRun=true`, the pipeline MUST execute Stages 1 and 2 in full (tool resolution, runtime pre-build, Dockerfile lint, build) and MUST skip Stages 3 and 4 (sign and publish).

**FR-9.2:** In dryRun mode, the pipeline MUST publish a build summary to the run summary. The PR comment MUST indicate clearly that this was a dry run, no image was pushed to ACR, and therefore the security scan pipeline was not triggered.

**FR-9.3:** dryRun mode MUST NOT push any artifact to ACR, including the image, signature, and SBOM attestation.

### 8.10 Notify

**FR-10.1:** The pipeline MUST post a build summary comment to the ADO PR that triggered the build. The comment MUST include: build status, `runtimeType`, image digest, SBOM status, signing status, ACR image reference, and a note that Trivy/Nexus/Fortify security scanning runs in a separate pipeline with a link to that pipeline where available.

**FR-10.2:** On pipeline failure, the failure stage and reason MUST be included in the PR comment. Runtime pre-build failures MUST identify the failing step template and the command that failed.

**FR-10.3:** The pipeline MUST publish an ADO build tag on the pipeline run corresponding to the image digest, enabling correlation between pipeline runs and ACR images from the ADO UI.

---

## 9. Non-Functional Requirements

**NFR-1 — Repeatability:** Building from the same Git commit SHA MUST produce a functionally equivalent image. Layer caching and BuildKit determinism settings must be configured to minimise non-determinism from timestamp injection or package resolution order.

**NFR-2 — Performance:** Total pipeline duration from trigger to image available in ACR MUST be under 15 minutes for a standard single-stage Dockerfile build with a warm layer cache. Cold cache builds MUST complete within 25 minutes.

**NFR-3 — Template Immutability:** Tenant repositories reference the shared pipeline template by version tag or commit SHA. Tenant teams MUST NOT be able to modify security controls by changing the template reference to an unreviewed version.

**NFR-4 — Least Privilege:** The pipeline agent's ACR credentials MUST be scoped to push access for `<tenantName>/*` only. No pipeline agent credential MUST have registry-wide push or admin access. The Cosign private key MUST be accessible to the pipeline agent at sign time only via Key Vault task, not persisted on the agent.

**NFR-5 — Audit Trail:** Every published image MUST be traceable to: source ADO repository, commit SHA, pipeline run ID, SBOM artifact, and Cosign signature. Trivy, Nexus, and Fortify scan reports are produced by the security scan pipeline and retained there. The traceability chain from this pipeline MUST be reconstructible from ACR metadata and pipeline artifact retention alone.

**NFR-6 — No Direct ACR Push:** Tenant teams MUST NOT have direct ACR push credentials outside the pipeline. All images reaching ACR MUST pass through the shared build pipeline template and its security gates.

**NFR-8 — Secret Hygiene:** Build arguments (`--build-arg`) MUST NOT be used to inject secrets into the image at build time. Secrets required at runtime are delivered via ESO + Azure Key Vault. The pipeline MUST lint for `ARG` / `ENV` patterns in the Dockerfile that suggest secret injection (enforced by Hadolint at ERROR level).

---

## 10. Constraints and Assumptions

**C-1:** The pipeline runs on ADO self-hosted or Microsoft-hosted agents with Docker (BuildKit) available and outbound access to ACR and Azure Key Vault.

**C-2:** The shared ACR is a single registry used by all environments. Image promotion across environments is achieved by updating the image reference in the Kustomize config repo, not by copying images between registries.

**C-3:** Tenant repositories conform to the standard ADO project and repository naming convention. Non-conforming repositories require a platform exemption before they can use the shared build template.

**C-4:** Cosign key-based signing is the initial implementation. Keyless signing via OIDC workload identity (Azure Workload Identity + Fulcio) is a future migration path and is not in scope for v1 of this pipeline.

**C-5:** Multi-architecture image builds (linux/amd64 + linux/arm64) are out of scope for v1. All images are built for linux/amd64 only.

**C-6:** Base image selection is the responsibility of each tenant team. The platform provides a curated set of approved base images. Enforcement of base image compliance is the responsibility of the downstream security scan pipeline and Kyverno admission policy — not this pipeline.

**C-7:** This pipeline does not gate on security scan results. The security scan pipeline (Trivy, Nexus, Fortify) is the enforcement gate for vulnerability findings. This pipeline's job is complete when a signed, SBOM-attested image is available in ACR and the security scan pipeline has been triggered.

**C-8:** The `--build-arg` mechanism MUST NOT be used to inject secrets into the image at build time. Secrets required at runtime are delivered via ESO + Azure Key Vault. Hadolint enforces this at ERROR level.

**C-9:** Pattern B runtimes (Angular, React, Spring Boot) require the relevant toolchain (Node.js LTS, JDK) to be present on the pipeline agent. Platform engineering is responsible for maintaining a platform agent image that includes all supported toolchains at their platform-approved versions. Tenant teams MUST NOT install toolchain versions on the agent as part of their build steps.

**C-10:** The composable template architecture (base template + runtime step templates) is the only supported extensibility mechanism for adding new runtime support. Tenant teams MUST NOT fork the base template or create parallel build templates. New runtime support requires a platform engineering change to add a runtime step template and update the `runtimeType` allowlist.

---

## 11. Dependencies

| ID | Dependency | Type | Status | Notes |
|---|---|---|---|---|
| D-1 | Shared ACR provisioned | Hard | Required | Single ACR instance used by all tenant builds. Repository naming convention and push permissions must be configured before tenant onboarding. |
| D-2 | Cosign key pair in Azure Key Vault | Hard | Required | Platform-managed Cosign private key must be provisioned in AKV and the public key distributed before FR-7.1 can execute. Key rotation process must be documented. |
| D-3 | ADO platform templates repository | Hard | Required | The shared pipeline template repository must be provisioned, access-controlled, and `container-build-v2.yml` plus all six runtime step templates authored before any tenant can reference it. |
| D-4 | `platform-tool-versions` variable group | Hard | Required | Must include pinned versions for Docker/BuildKit, Syft, Cosign, Hadolint, and Gradle build cache endpoint before pipeline can execute. |
| D-5 | Security scan pipeline | Hard | Required | The downstream security scan pipeline (Trivy, Nexus, Fortify) must be operational and configured to trigger on new ACR image pushes before SM-7 can be met. The handoff contract (section 6.5) must be agreed with the security scan pipeline team. |
| D-6 | Kyverno ImageVerification policy | Soft | Planned | PRD-2026-KYVERNO-POLICY-001. Kyverno admission policy enforcing Cosign signature verification at deploy time is the cluster-side enforcement complement to this pipeline. Without it, signing is best-effort only. |
| D-7 | ADO service connection to ACR | Hard | Required | Per-tenant scoped service connection (`<tenantName>/*` push scope) must be provisioned in ADO before tenant onboarding to the build pipeline. |
| D-8 | ADO PR comment API access | Soft | Required | Pipeline service principal must have ADO REST API access to post PR comments for build summaries (FR-10.1). |
| D-9 | Approved base image list | Soft | Planned | Platform-curated list of approved base images required before base image enforcement can be added to a future pipeline version or the security scan pipeline. |
| D-10 | Platform agent image | Hard | Required | Self-hosted ADO agent image maintained by platform engineering that includes Docker (BuildKit), Node.js LTS, JDK, and other Pattern B toolchains at platform-approved versions. Required before Pattern B runtimes (Angular, React, Spring Boot) can execute pre-build steps (C-9). |

---

## 12. Open Questions

| ID | Question | Owner | Status |
|---|---|---|---|
| OQ-1 | Should the pipeline also trigger on Git tag push (semver) in addition to PR merge to main, or is the semver tag applied to a commit already on main sufficient? | Platform Lead | Open |
| OQ-2 | What is the trigger mechanism for the downstream security scan pipeline — ADO pipeline completion trigger, ACR event webhook, or polling? This affects FR-5.2 and SM-7. | Platform Engineering / Security | Open |
| OQ-3 | Should ACR layer cache storage be scoped per tenant repository or shared across all tenant builds? Shared cache risks cross-tenant cache poisoning; per-tenant cache increases storage cost. | Platform Engineering | Open |
| OQ-4 | What is the retention policy for images in ACR? How long are untagged images (dangling layers) retained, and when are alias tags cleaned up? | Platform Lead | Open |
| OQ-5 | Should the pipeline enforce that tenant Dockerfiles use only approved base images (Hadolint hard block) in v1, or defer entirely to the security scan pipeline and Kyverno at admission time? | Platform Lead / Security | Open |
| OQ-6 | Is keyless Cosign signing (Azure Workload Identity + Fulcio) on the near-term roadmap? If so, the key infrastructure decisions in section 6.6 and D-2 should be treated as interim. | Platform Engineering | Open |
| OQ-7 | Should the pipeline output variable carrying the image reference (FR-8.7) be automatically consumed by a downstream pipeline step that updates the Kustomize config repo image field, or is that update always a manual step (or future Kargo responsibility)? | Platform Lead | Open |
| OQ-8 | What ADO notification channels receive alerts on build pipeline failures that block a tenant team's release? | Platform Lead | Open |
| OQ-9 | Should multi-architecture builds (linux/amd64 + linux/arm64) be in scope for a v1.1 follow-on given the NKP POC work and potential ARM node pool adoption? | Platform Engineering | Open |
| OQ-10 | How are tenant teams onboarded to the shared build pipeline? Is there a self-service onboarding flow, or does platform engineering provision the ADO service connection and pipeline entry point manually per tenant? | Platform Lead | Open |
| OQ-11 | What is the agreed SLA between this pipeline and the security scan pipeline? If the security scan pipeline fails or is unavailable, can images already published to ACR be deployed, or is there a deployment hold until scan results are confirmed? | Platform Lead / Security | Open |
| OQ-12 | For Angular and React builds, should Pattern B (pre-build on agent) be the default, or should the platform recommend Pattern A (full multi-stage Dockerfile) and leave the choice to tenant teams? Pattern A is simpler and more portable; Pattern B is faster with agent-side npm caching. | Platform Engineering | Open |
| OQ-13 | What is the Node.js version governance model for Angular and React builds? Should the platform pin a single LTS version in the agent image, or support multiple via `.nvmrc`-based version switching? Multiple versions add agent image complexity; a single version may break older tenant apps. | Platform Engineering | Open |

---

## 13. Revision History

| Version | Date | Author | Summary |
|---|---|---|---|
| 0.1.0 | 2026-06-27 | Platform Engineering | Initial draft. Covers Dockerfile build with BuildKit, Trivy vulnerability scanning, Syft SBOM generation, Cosign signing and attestation, shared ACR publish, shared ADO template model, and dryRun mode. Companion to PRD-2026-CI-RENDER-001. |
| 0.2.0 | 2026-06-27 | Platform Engineering | Removed security scanning (Trivy, Nexus, Fortify) from pipeline scope. Security scanning runs in a dedicated separate pipeline loop against published ACR images. Pipeline pattern updated from build→scan→sign→publish to build→sign→publish. Added section 6.5 (Security Scan Pipeline Handoff) defining the ACR handoff contract. Section 8.4 replaced with handoff requirements. Updated goals, non-goals, success metrics, constraints, dependencies, and open questions to remove scan references. Added OQ-11 (scan pipeline SLA and deployment hold policy). |
| 0.3.0 | 2026-06-27 | Platform Engineering | Added runtime composability architecture. Introduced `runtimeType` parameter (`angular`, `react`, `springboot`, `python`, `go`). Added section 6.7 (Runtime Build Patterns) defining Pattern A (in-Dockerfile) and Pattern B (pre-build on agent). Added section 8.3 (Runtime Pre-Build, FR-3.1–FR-3.6). Renumbered all subsequent FR sections (8.4–8.10) accordingly. Updated pipeline stages table to include `RuntimePreBuild` job. Added C-9 (Pattern B toolchain on agent image), C-10 (composable template as sole extensibility mechanism), D-10 (platform agent image dependency), FR-2.5 (runtimeType allowlist validation), FR-2.6 (step template existence check), OQ-12 (Angular/React pattern selection), OQ-13 (Node.js version governance). Added Appendix B (Runtime Support Reference). |

---

## 14. Appendix A: Image Tagging Strategy Reference

This appendix defines the tagging strategy rationale and documents what each tag format is and is not appropriate for.

### 14.1 Why `latest` Is Prohibited

The `latest` tag is mutable. Any push of a new image with `latest` silently replaces the previous reference. In a GitOps system where ArgoCD watches a specific image reference, a `latest` tag means the declared state in Git does not uniquely identify what is running — two identical manifest commits may produce different running containers depending on when ArgoCD last synced. `latest` is therefore incompatible with the platform's GitOps model and is prohibited at the pipeline level.

### 14.2 Primary Tag — Full Git SHA

The full 40-character Git commit SHA is the canonical image tag. Properties:

- **Immutable by convention.** A SHA tag should never be reused for a different image. The pipeline's digest verification step (FR-7.5) enforces this.
- **Traceable.** Any running container can be traced to its exact source commit, Dockerfile, and pipeline run.
- **Machine-friendly.** Used in Kustomize `images:` fields and Kyverno ImageVerification policies.
- **Not human-readable at a glance.** The alias tag exists to complement this.

Usage: `<acr-host>/<tenant>/<app>:<40-char-sha>`

### 14.3 Alias Tag — Branch + Short SHA

The alias tag (`main-abc1234`) provides a human-readable reference that is:

- **Mutable by design.** Multiple builds from the same branch will have different short SHAs, so the alias changes on each build.
- **Not used in manifests.** Kustomize and ArgoCD MUST reference the primary SHA tag or digest, not the alias.
- **Useful for humans.** Enables developers to find recent builds for a branch in the ACR portal without decoding SHAs.

Usage: navigation, debugging, manual pull for local testing. Never in Kustomize `images:` fields.

### 14.4 Semver Tag — Release Tagging

When a commit on main is tagged with a semver Git tag (e.g. `v1.2.3`), the pipeline additionally pushes a semver image tag. Properties:

- **Human-meaningful release marker.** Useful for communicating "this image is release v1.2.3".
- **Mutable risk.** A semver tag can technically be force-pushed to a different commit. Teams MUST treat semver image tags as informational and use the SHA tag or digest for manifest references.
- **Conditional.** Only pushed when a semver Git tag is present. Not all builds produce a semver tag.

### 14.5 Digest Reference — The Gold Standard

For the highest immutability guarantee, manifests should reference images by digest rather than tag:

```yaml
# Kustomize images field — digest reference
images:
  - name: payment-processor
    newName: <acr-host>/payments/payment-processor
    digest: sha256:abc123...
```

Digest references cannot be spoofed by retagging and are the correct form for production manifest references. The pipeline output variable (FR-7.7) provides the full digest reference as the handoff to the manifest update step.

### 14.6 Tag Summary Table

| Tag Format | Example | Mutable | Used in Manifests | Purpose |
|---|---|---|---|---|
| Full SHA | `abc123...def456` (40 chars) | No | Yes (preferred) | Canonical, traceable reference |
| Branch + short SHA | `main-abc1234` | Yes | No | Human navigation |
| Semver | `v1.2.3` | Technically yes | Informational only | Release marking |
| Digest | `sha256:abc123...` | No | Yes (gold standard) | Maximum immutability |
| `latest` | `latest` | Yes | **Prohibited** | Not permitted by this pipeline |

---

## 15. Appendix B: Runtime Support Reference

This appendix provides a per-runtime reference for the six supported build targets, covering build pattern, step template responsibilities, base image guidance, and caching considerations.

### 15.1 Runtime Summary Table

| Runtime | runtimeType | Build Pattern | Pre-build on Agent | Final Image Size | Primary Caching |
|---|---|---|---|---|---|
| Angular | `angular` | B — Pre-build | `npm ci` + `ng build` | Small (nginx + static assets) | npm cache on agent |
| React | `react` | B — Pre-build | `npm ci` + framework build | Small (nginx + static assets) | npm cache on agent |
| Spring Boot / Gradle | `springboot` | B — Pre-build | `gradle bootJar` | Medium (JRE + JAR) | Gradle build cache |
| Python | `python` | A — In-Dockerfile | None | Medium (python slim) | Docker layer cache |
| Go | `go` | A — In-Dockerfile | None | Minimal (distroless/scratch) | Docker layer cache |

### 15.2 Angular (`runtimeType: angular`)

**Pattern:** B — Pre-build on agent

**Step template responsibilities (`steps/runtime/angular.yml`):**
- Resolve Node.js version from `.nvmrc` or `engines.node` in `package.json`; validate against platform Node LTS allowlist
- Run `npm ci` with agent-local npm cache
- Run `ng build --configuration production` (or equivalent)
- Assert that the `dist/<app>/` output directory exists before exiting
- Fail the step if the build produces zero output files

**Dockerfile expectations:**
- Multi-stage: first stage receives the pre-built `dist/` directory via `COPY`
- Final stage: nginx or equivalent static file server
- The Dockerfile MUST NOT run `npm install` or `ng build` — those steps ran on the agent

**Recommended base image:** `nginx:alpine` (final stage)

**Caching:** npm cache directory persisted on the agent between runs via ADO pipeline cache task. Cache key: hash of `package-lock.json`.

### 15.3 React (`runtimeType: react`)

**Pattern:** B — Pre-build on agent

**Step template responsibilities (`steps/runtime/react.yml`):**
- Resolve Node.js version from `.nvmrc` or `engines.node` in `package.json`; validate against platform Node LTS allowlist
- Run `npm ci` with agent-local npm cache
- Detect build framework from `package.json` scripts (`vite build`, `react-scripts build`, `next build --export`) and execute the appropriate command
- Assert that the compiled output directory (`dist/`, `build/`, or `out/`) exists before exiting

**Dockerfile expectations:**
- Multi-stage: first stage receives the pre-built output directory via `COPY`
- Final stage: nginx or equivalent static file server
- The Dockerfile MUST NOT run `npm install` or any framework build command

**Recommended base image:** `nginx:alpine` (final stage)

**Caching:** npm cache directory persisted on the agent between runs. Cache key: hash of `package-lock.json`. Next.js `.next/cache` directory also cached if detected.

**Note on Next.js SSR:** Next.js applications with server-side rendering are not static exports and cannot be served by nginx. SSR Next.js apps require a Node.js runtime in the final image. The React step template detects this case (absence of `--export` or `output: export` in `next.config.js`) and emits a warning. The Dockerfile must account for the SSR runtime. This is a known variation within the `react` runtimeType.

### 15.4 Spring Boot / Gradle (`runtimeType: springboot`)

**Pattern:** B — Pre-build on agent

**Step template responsibilities (`steps/runtime/springboot.yml`):**
- Validate that `./gradlew` exists in the build context; fail if absent (non-Gradle Spring Boot projects are out of scope for this runtimeType)
- Resolve JDK version from `java.toolchains` in `build.gradle` or `build.gradle.kts`; validate against platform JDK allowlist
- Configure Gradle to use the platform-managed Gradle build cache endpoint from `platform-tool-versions`
- Run `./gradlew bootJar --no-daemon`
- Publish test results from `build/test-results/` as ADO test results before proceeding
- Assert that a JAR file exists under `build/libs/` before exiting

**Dockerfile expectations:**
- Single-stage or multi-stage; receives the pre-built JAR via `COPY build/libs/*.jar app.jar`
- Final stage: JRE only (not full JDK)
- The Dockerfile MUST NOT run Gradle tasks

**Recommended base image:** `eclipse-temurin:<version>-jre-alpine` (final stage). JRE variant, not JDK.

**Caching:** Gradle build cache backed by the platform cache endpoint (remote cache). Local Gradle wrapper cache also persisted on the agent. Cache key: hash of `build.gradle` / `build.gradle.kts` + `gradle/wrapper/gradle-wrapper.properties`.

**Test results:** Gradle test results are published to ADO before `docker build` executes. A test failure MUST fail the pipeline at the pre-build step, not silently allow the image to build with a broken test suite.

### 15.5 Python (`runtimeType: python`)

**Pattern:** A — In-Dockerfile (self-contained)

**Step template responsibilities (`steps/runtime/python.yml`):**
- Pass-through; no pre-build steps execute on the agent
- Validates that a `requirements.txt`, `pyproject.toml`, or `poetry.lock` exists in the build context (warns if absent; does not block)

**Dockerfile expectations:**
- Multi-stage recommended: `python:<version>-slim` build stage for `pip install` → slim final stage
- `requirements.txt` or equivalent copied and installed inside the Dockerfile
- Non-root user in final stage enforced by Hadolint

**Recommended base image:** `python:3.x-slim` (build stage), `python:3.x-slim` or `gcr.io/distroless/python3` (final stage)

**Caching:** Docker layer cache on ACR. The `COPY requirements.txt` + `RUN pip install` layer caches naturally when dependencies are unchanged. No agent-side caching required.

### 15.6 Go (`runtimeType: go`)

**Pattern:** A — In-Dockerfile (self-contained)

**Step template responsibilities (`steps/runtime/go.yml`):**
- Pass-through; no pre-build steps execute on the agent
- Validates that a `go.mod` file exists in the build context; fails Stage 1 if absent

**Dockerfile expectations:**
- Multi-stage: `golang:<version>-alpine` or `golang:<version>` build stage → `distroless/static` or `scratch` final stage
- `CGO_ENABLED=0 GOOS=linux` set as `ENV` in the build stage for static binary compilation
- Single binary copied to final stage; no shell, package manager, or OS required in final image

**Recommended base image:** `golang:1.x-alpine` (build stage), `gcr.io/distroless/static-debian12` or `scratch` (final stage)

**Caching:** Docker layer cache on ACR. The `COPY go.mod go.sum` + `RUN go mod download` layer caches naturally when the module graph is unchanged. Go module download layer should be separated from source copy layer in the Dockerfile for maximum cache reuse.

**Final image size note:** Go produces the smallest final images of any supported runtime. `scratch`-based images have zero OS attack surface and are the recommended final stage for Go services with no CGO dependencies.

### 15.7 Adding a New Runtime

When a new runtime is required that is not in the current allowlist, the process is:

1. Platform engineering authors a new step template at `steps/runtime/<newRuntime>.yml` following the pattern of the nearest existing template.
2. The base template (`container-build-v2.yml`) is updated to add a dispatch `${{ if }}` branch for the new `runtimeType` value.
3. The `runtimeType` allowlist in FR-2.5 is updated.
4. The new runtime is added to section 6.7, Appendix B, and the `platform-tool-versions` variable group (if new toolchain versions are required on the agent image).
5. The platform agent image (D-10) is updated to include the new toolchain if Pattern B is used.
6. A PRD revision is issued documenting the addition.

Tenant teams MUST NOT add new runtimes by submitting step template files directly. All new runtime support goes through platform engineering review.
