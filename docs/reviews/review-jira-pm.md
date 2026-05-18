# Product Manager Review — EG-001 JIRA Stories

**Reviewer:** Product Manager
**Date:** 2026-05-17
**Scope:** Feature EG-001 and all child epics/stories (22 stories total)
**ADR Reference:** ADR-002 (Envoy Gateway v1.8.0 adoption, confirmed findings from `docs/reviews/review-envoy-gateway.md`)

---

## Feature-Level Assessment

### Feature Description

The feature description is accurate and well-scoped. The ingress chain (Imperva → Azure Application Gateway → Envoy ILB → tenant services) is correctly stated. The core purpose — to validate Envoy Gateway as a Kong Konnect replacement before committing to a phased migration — is clearly articulated.

### Feature Acceptance Criteria — Issues Found

1. **Rate limiting AC is architecturally ambiguous.** The AC reads: "Global rate limiting enforced via Redis-backed BackendTrafficPolicy." This does not account for GitHub issue #8707, which documents that `BackendTrafficPolicy` global rate limiting only applies to the first listener on a Gateway. The PoC architecture must use one Gateway per tenant namespace (not multi-listener Gateways) to avoid this bug. The feature AC must explicitly state the one-Gateway-per-namespace constraint and require that rate limiting is validated to work on that architecture — not a multi-listener configuration.

2. **SecurityPolicy portability is not called out.** `SecurityPolicy` is an Envoy Gateway proprietary extension (`gateway.envoyproxy.io`), not a standard Gateway API resource. The feature AC should note that SecurityPolicy-dependent functionality is non-portable and confirm that the team accepts this as a PoC-scoped decision.

3. **GatewayClass governance is missing from feature AC.** The feature AC does not mention enforcement that all Gateways use the `platform-gateway` GatewayClass. EG-105 (Kyverno policy) addresses this at story level, but it should be reflected at feature level since it is a prerequisite for safe parallel Kong/Envoy operation.

4. **Lua extension validation is absent.** The ADR's expert review (Finding 4) notes that Lua scripting via `EnvoyExtensionPolicy` was added in v1.5 and is a lower-barrier alternative to WASM. There is no story or feature-level AC that validates Lua extension capability. This is a PoC gap — if the team needs custom transformations and Lua meets that bar, confirming it during the PoC avoids a later WASM investment.

5. **"Existing dev tenant on Kong unaffected" is correct scope but untestable as written.** Add specificity: define what "unaffected" means — existing Kong LB IP continues to serve traffic, Kong routes respond with HTTP 200, no Kong config changes are made.

### Out of Scope

The out-of-scope section is correct and appropriately bounded. No issues.

### Missing Feature-Level Dependency

The feature has no explicit dependency statement on the ArgoCD platform being operational in dev. Stories assume ArgoCD is present and functional. This is a reasonable assumption for a PoC, but should be stated explicitly.

---

## Story Assessments

### EG-101 — Install Envoy Gateway CRDs via ArgoCD

**Quality:** Good
**Issues:**
- AC lists the correct CRD categories (standard channel + Envoy Gateway extensions), but does not include `envoypatchpolicies` explicitly in the standard-channel list. It appears in the extension list. Clarify that `envoypatchpolicies` is an Envoy Gateway extension CRD (not a Gateway API standard CRD) — the current grouping could confuse the implementer.
- The note says "Confirm ACR mirror or Docker Hub reachability before starting." This is a dependency prerequisite, not a note — if ACR mirror is not configured, this story cannot start. Add a clear prerequisite: "ACR mirror for `docker.io/envoyproxy` must be configured and accessible from dev cluster before starting this story."
- No definition of done for verification — there is no AC stating how to confirm all expected CRDs are present (e.g., `kubectl get crd | grep gateway.envoyproxy.io` returns N resources).

**Recommendation:** Improve. Add ACR prerequisite statement and add a concrete CRD count verification AC.

---

### EG-102 — Deploy Envoy Gateway controller via ArgoCD

**Quality:** Good
**Issues:**
- "Controller logs show no errors on startup" is too vague. Specify which log output confirms healthy startup (e.g., controller logs show "Starting manager" and "Watching Gateways" with no ERROR-level entries within 60 seconds of pod Ready).
- `deploy.type: GatewayNamespace` is mentioned in notes but not in AC. This is architecturally critical — it must be an AC item, not a note. If GatewayNamespace mode is not configured here, EG-106 will fail (proxy pods will land in the wrong namespace). Move to AC: "Values file configures `deploy.type: GatewayNamespace`."
- Dev sizing (1 replica, reduced resources) is mentioned in notes but resource limits/requests should be committed values — add an AC that the values file specifies explicit resource requests and limits.

**Recommendation:** Improve. Promote GatewayNamespace mode to AC. Tighten startup log AC.

---

### EG-103 — Deploy GatewayClass and EnvoyProxy configuration

**Quality:** Good
**Issues:**
- `GatewayClass named platform-gateway has status Accepted: True` — good, testable AC.
- Missing: AC for zone spreading configuration. The story description says "AKS zone spreading" is configured, but there is no AC verifying it. Add: "EnvoyProxy resource configures zone spreading via `topologySpreadConstraints` or equivalent mechanism."
- Missing: AC for Prometheus metrics endpoint. Story description mentions it, but no AC verifies the metrics port is exposed and responding.
- The subnet annotation note ("must match Kong's existing LB service subnet") is a dependency on network team confirmation. Add an explicit prerequisite: "Subnet name confirmed with network team before story starts."

**Recommendation:** Improve. Add zone spreading AC, metrics endpoint AC, and network team prerequisite.

---

### EG-104 — Deploy Redis for global rate limiting

**Quality:** Good
**Issues:**
- "Redis reachable from within the cluster (validated via kubectl exec)" — this AC is too informal for a story deliverable. Specify what the validation command looks like and what constitutes pass: `redis-cli -h redis.envoy-gateway-system.svc.cluster.local PING` returns `PONG`.
- No AC verifying that the controller actually uses Redis for rate limiting decisions (i.e., that the wire between controller and Redis is live, not just that Redis is reachable). This is validated later in EG-307, but a basic controller log confirmation of Redis connection here would make EG-104 self-contained.
- The story says "No persistence required for PoC" — this is correct, but the AC should explicitly state `persistentVolumeClaim` is not used, to avoid ambiguity about what "no persistence" means in a Kustomize context.

**Recommendation:** Improve. Tighten the validation AC and add a controller-Redis connectivity confirmation.

---

### EG-105 — Add Kyverno policy to enforce GatewayClass usage

**Quality:** Good
**Issues:**
- "Policy does not block existing Kong or other platform resources" — this is a critical regression-prevention AC, but it is untestable as written. Specify: after policy deployment, `kubectl get pod -n kong` shows Kong pods still running and Kong routes continue to serve HTTP 200.
- The story depends on EG-103 but has no explicit dependency on Kyverno itself being installed and operational in the cluster. Add a prerequisite: "Kyverno controller is running in the dev cluster."
- No AC for policy audit mode vs. enforce mode. The story says `enforce-gateway-class` is "active" — clarify that it is in Enforce mode (not Audit), and specify what error message a rejected Gateway receives (so the operator team knows what to expect during EG-302/303).

**Recommendation:** Improve. Make Kong non-regression AC testable. Add Kyverno prerequisite. Specify Enforce vs Audit mode.

---

### EG-106 — Deploy dev tenant Gateway resource and validate ILB provisioning

**Quality:** Good
**Issues:**
- "Envoy proxy Deployment (1 replica) running in tenant namespace within 2 minutes of Gateway creation" — the 2-minute SLO is good. Make it testable: specify the Deployment name pattern (e.g., `envoy-<gateway-name>-<namespace>`) so the engineer knows what to look for.
- "ILB IP is in the expected AKS subnet" — requires subnet CIDR to be documented. Add: "Expected subnet CIDR documented in story or linked reference before starting."
- "Existing Kong LB service in dev unaffected" — same issue as EG-105. Needs a testable definition: Kong LB service EXTERNAL-IP unchanged, Kong routes return HTTP 200.
- This story is the first true validation of GatewayNamespace mode. The Notes section calls this out correctly. Add an explicit failure-mode AC: "If proxy pods appear in `envoy-gateway-system` namespace instead of the tenant namespace, the story is blocked and EG-102 must be revisited."

**Recommendation:** Improve. Add Deployment name pattern, subnet CIDR reference, testable Kong non-regression, and failure-mode blocking condition.

---

### EG-201 — Configure App Gateway backend pool to target Envoy ILB

**Quality:** Needs improvement
**Issues:**
- "Configuration change is scripted or documented for repeatability" — "documented" is too weak for a platform engineering story. This should be a script committed to the platform repo, not just documentation. Change to: "Configuration change expressed as an Azure CLI script or Bicep delta committed to the platform repo."
- "App Gateway health probe configured for Envoy proxy health endpoint" — the health probe path (`/healthz/ready` on port 19001) is in the Notes, but it belongs in the AC since it is a specific, verifiable value. Move to AC: "Health probe configured for `GET /healthz/ready` on port 19001."
- No AC for what happens if the health probe fails — the story should require that the engineer confirms the probe path works before marking done. Add: "Envoy backend health probe returns healthy status in App Gateway backend health view (not 'Unknown' or 'Unhealthy')."
- The note says "Confirm probe path before applying" — this is another prerequisite masquerading as a note. Make it explicit: "Verify `/healthz/ready` responds on port 19001 from within the AKS VNet before configuring the probe."

**Recommendation:** Improve. Elevate probe path to AC. Require scripted/committed config. Add probe verification prerequisite.

---

### EG-202 — Deploy a test HTTPRoute and validate end-to-end traffic through App Gateway

**Quality:** Good
**Issues:**
- "curl through the full chain returns HTTP 200 from echo backend" — good, testable. Add the specific curl command or at minimum specify that the request must use the dev tenant hostname (not an IP), to confirm hostname routing is working.
- "Request headers (X-Forwarded-For, X-Request-ID) are correctly propagated" — "correctly propagated" needs a definition. Specify: X-Forwarded-For contains the test client's IP (or Imperva IP if test is from within the VNet), and X-Request-ID is present and non-empty in the echo response.
- "Envoy access logs show the request with correct client IP (not App Gateway IP)" — this AC conflicts with the fact that App Gateway is in the chain and the XFF configuration (EG-203) has not yet been applied at this point. At EG-202 stage, the client IP visible in Envoy access logs may be the App Gateway IP, since ClientTrafficPolicy has not been deployed yet. Reorder: either move this AC to EG-203, or qualify it with "expected pre-XFF-configuration behavior documented."
- No AC for what happens on HTTP 4xx/5xx — the story should confirm the unhappy path too: a request to an undefined path returns the expected response (e.g., 404 from echo, not a 502 from App Gateway).

**Recommendation:** Improve. Fix the XFF AC sequencing conflict with EG-203. Tighten header propagation AC.

---

### EG-203 — Validate and configure X-Forwarded-For trust chain

**Quality:** Good
**Issues:**
- "curl -H 'X-Forwarded-For: 1.2.3.4' with a forged header does not cause Envoy to trust the spoofed IP" — this is a good security AC. Specify what "not trust" means concretely: Envoy access logs show the App Gateway IP (or real upstream) as client IP, not `1.2.3.4`.
- "XFF behaviour documented for use in tenant migration runbook" — documentation as an AC is acceptable here since it is referenced downstream. Specify the location: `docs/runbooks/xff-trust-chain.md` or similar committed path.
- The note about `numTrustedHops: 1` in Phase 2 (after App Gateway removal) is good operational foresight. Add it as a story note with a reference to a future story or backlog item so it is not lost.
- No AC for `ClientTrafficPolicy` targeting specificity — confirm that the policy targets the dev tenant Gateway only, not the GatewayClass (which would affect all Gateways cluster-wide).

**Recommendation:** Improve. Tighten the spoofed-header AC definition. Specify runbook location. Add targeting scope AC.

---

### EG-301 — Audit existing operator — document input CRD schema and current output model

**Quality:** Good
**Issues:**
- "Fields with no direct equivalent are listed with proposed handling (drop, WASM filter, EnvoyPatchPolicy, or explicit gap)" — Lua via `EnvoyExtensionPolicy` should be added to this list. The ADR expert review (Finding 4) confirmed Lua is now available in v1.5 and is a lower-barrier option than WASM. The mapping document should include Lua as a candidate handling option.
- "Document committed to platform repo as `docs/operator/crd-gateway-api-mapping.md`" — good, specific path. No issues.
- No AC for the document being reviewed by a second engineer before EG-302 starts. Given that EG-302–EG-306 all depend on this mapping, an incorrect or incomplete mapping document will cascade. Add: "Mapping document reviewed and signed off by one other platform engineer before EG-302 begins."
- The story has no time-box guidance. Auditing an existing operator can expand indefinitely. Recommend adding a scope constraint: "If the operator codebase exceeds X hours to audit, flag gaps explicitly and proceed with known fields. Do not block EG-302 on exhaustive documentation."

**Recommendation:** Improve. Add Lua to the gap-handling options list. Add peer review requirement before EG-302 starts.

---

### EG-302 — Scaffold new operator reconciler targeting Kubernetes API server

**Quality:** Good
**Issues:**
- "Old Konnect HTTP client call is feature-flagged off (not deleted — needed for rollback during PoC)" — this is correct. However, the AC should specify the flag name and mechanism (environment variable, build tag, or config field) so there is no ambiguity about what "feature-flagged" means in implementation.
- "controller-runtime Create/Update/Delete calls stubbed for HTTPRoute, SecurityPolicy, BackendTrafficPolicy" — this is the correct set, but `ExternalSecret` is missing. EG-306 requires the operator to generate ExternalSecrets. The stub should include ExternalSecret from the start to avoid a scaffold rework.
- "Owner references set on all generated resources" — the AC correctly mandates owner references. This is important for EG-307's garbage collection test. No issues here beyond ensuring unit tests actually verify the UID/GVK on the owner reference, not just that the field is non-nil.
- "Feature flag documented in operator README" — good.
- No AC for the reconciler compiling against the correct Kubernetes client version (compatible with the dev AKS cluster's API server version). Add: "Reconciler imports specify Kubernetes client version compatible with dev cluster API server (confirm with `kubectl version`)."

**Recommendation:** Improve. Add ExternalSecret to the stub list. Specify feature flag mechanism. Add k8s client version compatibility AC.

---

### EG-303 — Implement HTTPRoute translation

**Quality:** Good
**Issues:**
- "Request header injection (x-tenant-id) added as an HTTPRoute filter" — good. Confirm this is a `RequestHeaderModifier` filter, not a response header filter, so the downstream agent implements the correct filter type.
- "Stale HTTPRoute resources are deleted on reconcile" — this is a critical correctness requirement. The AC should specify the mechanism: owner reference garbage collection via the Kubernetes controller, not manual deletion logic. This distinction matters for correctness under race conditions.
- "Integration test: apply tenant CRD, verify HTTPRoute created with correct spec" — the test should use a real `envtest` (controller-runtime's envtest) or a stub API server, not just unit mocks, to verify Create/Update/Delete lifecycle. Specify the test type.
- No AC for the case where a tenant CRD references a Kubernetes Service that does not exist — the reconciler should handle this gracefully (status condition, not crash).

**Recommendation:** Improve. Specify RequestHeaderModifier filter type. Clarify garbage collection mechanism (owner refs, not manual). Add error-case AC for missing backend Service.

---

### EG-304 — Implement SecurityPolicy translation (JWT + OIDC)

**Quality:** Good
**Issues:**
- "OIDC client secret reference points to an ESO-managed Secret (not inlined)" — correct. This AC is important for security. Add: "Integration test confirms no secret values appear in SecurityPolicy spec (only `secretRef` field present)."
- "SecurityPolicy correctly sets: JWT provider (issuer, JWKS URI, audiences), claimToHeaders mapping `tid` → `x-tenant-id`" — the Entra ID JWKS URI should be specified as a test fixture value so the integration test is unambiguous. Add a note: "Use Entra ID JWKS URI format: `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`."
- `SecurityPolicy` is a proprietary Envoy Gateway resource (`gateway.envoyproxy.io`). The story should note this explicitly so the developer does not attempt to use a standard Gateway API resource that does not exist.
- No AC for what happens when `SecurityPolicy` references a non-existent JWKS URI — the reconciler should set a status condition rather than silently failing.
- "No auth config in CRD → no SecurityPolicy generated" — correct. Add corresponding integration test for this negative case.

**Recommendation:** Improve. Add security AC (no inlined secrets in spec). Add negative test case for no-auth config. Note SecurityPolicy is proprietary.

---

### EG-305 — Implement BackendTrafficPolicy translation (rate limiting + circuit breaking)

**Quality:** Needs improvement — critical gap on rate limiting bug

**Issues:**
- **Critical:** The story makes no mention of GitHub issue #8707. `BackendTrafficPolicy` global rate limiting only applies to the first listener on a Gateway. The entire story is built around per-HTTPRoute rate limiting, but the ADR expert review confirmed that the one-Gateway-per-namespace architecture is the required workaround for #8707. The story must explicitly state: (a) the one-Gateway-per-namespace architecture is assumed, (b) each tenant namespace has exactly one Gateway, (c) rate limiting is validated to work in this configuration, and (d) the engineer must verify at test time that bug #8707 is not triggered (i.e., confirm there is only one listener on the test Gateway).
- "Rate limit rules reference Redis backend (configured in EnvoyProxy — no per-resource Redis config needed)" — this is architecturally correct, but the AC should verify it: "Operator does not generate any Redis connection config in BackendTrafficPolicy spec; Redis is sourced from EnvoyProxy-level configuration only."
- "BackendTrafficPolicy correctly sets: global rate limit rules (per x-tenant-id header), timeout, retry policy, circuit breaker thresholds" — "circuit breaker thresholds" needs specific field names. In BackendTrafficPolicy, this is `spec.circuitBreaker`. Specify the fields expected: `maxConnections`, `maxPendingRequests`, `maxParallelRequests` with test fixture values.
- "Reconcile is idempotent" — good. Integration test must verify this by applying the same CRD twice and confirming no duplicate resources or spurious updates.
- No AC for the case where rate limiting is configured in the CRD but Redis is unavailable — per the ADR, rate limiting fails open. The operator should not block on Redis availability. Add: "If Redis is unavailable, BackendTrafficPolicy is still generated and applied; rate limiting fails open per Envoy Gateway behavior."

**Recommendation:** Needs improvement. This is the highest-risk story in the epic. Must explicitly address bug #8707, one-Gateway-per-namespace constraint, and Redis fail-open behavior.

---

### EG-306 — Implement ESO ExternalSecret generation for OIDC client secrets

**Quality:** Good
**Issues:**
- "ExternalSecret uses the existing ESO ClusterSecretStore already configured in the platform" — good. Add: "Story is blocked if no ClusterSecretStore exists in the dev cluster. Verify with `kubectl get clustersecretstore` before starting."
- "Owner reference set on ExternalSecret" — correct. Note that owner reference garbage collection may not delete the resulting Secret (ESO-managed), only the ExternalSecret. Add: "Verify that on CRD deletion, the ExternalSecret is garbage collected and the resulting ESO Secret is also removed (or document if it persists by ESO design)."
- "Integration test: apply tenant CRD with OIDC config, verify ExternalSecret and resulting Secret created" — the test needs a mock or stub ESO to verify end-to-end. Specify whether the integration test runs against a real ESO instance or uses a stub. Running against real ESO requires the ClusterSecretStore and Key Vault to be reachable from the test environment.
- No AC for the Key Vault secret path naming convention. The story says "pointing to correct Key Vault path" — specify the path format: `secrets/<tenant-name>/oidc-client-secret` or similar.

**Recommendation:** Improve. Add ClusterSecretStore prerequisite check. Clarify ESO-managed Secret garbage collection behavior. Specify Key Vault path format.

---

### EG-307 — Operator integration test — full reconcile against dev cluster

**Quality:** Good
**Issues:**
- This story is a full end-to-end validation and is correctly positioned as the integration capstone for Epic 3. However, it depends on EG-303, EG-304, EG-305, and EG-306 all being complete — and also implicitly depends on EG-106 (Gateway provisioned), EG-201 (App Gateway backend pool), and EG-202 (HTTPRoute validated). These cross-epic dependencies are not listed. Add explicit dependency on: EG-106, EG-201, EG-202.
- "Traffic flows through full chain: Imperva → App Gateway → Envoy ILB → service" — this is not achievable purely from a dev cluster context without the App Gateway and network configuration from Epic 2 being complete. The story scope must clarify: does "full chain" require live Imperva traffic, or is the validation scoped to App Gateway → Envoy ILB → service?
- "Delete tenant CRD — all generated resources garbage collected via owner references" — this is a critical AC. Add a verification step: list all resources with `ownerReferences` pointing to the test CRD instance before deletion, then confirm all are gone after deletion. Specify the timeout (e.g., within 30 seconds).
- "Rate limiting enforced — exceeding limit returns HTTP 429" — this validates EG-305. Given the #8707 bug, explicitly note: "Confirm only one listener exists on the test Gateway before running this test."
- "No errors in operator logs during full lifecycle" — define "errors" as ERROR-level log entries in the operator's structured log output.

**Recommendation:** Improve. Add cross-epic dependencies (EG-106, EG-201, EG-202). Clarify "full chain" scope. Add specific garbage collection verification with timeout. Add bug #8707 guard condition for rate limit test.

---

### EG-401 — Validate Envoy Gateway metrics in Azure Monitor Workspace

**Quality:** Good
**Issues:**
- "ama-metrics scrapes Envoy Gateway controller metrics endpoint (19001/metrics)" — this is the Envoy admin port, but note that 19001 is the Envoy Gateway controller metrics port. The per-tenant proxy pod metrics port may differ (default is 9902 for Prometheus metrics on Envoy proxies). Clarify which port for controller vs. per-tenant proxy pod metrics.
- "ServiceMonitor or pod annotation scrape config committed to platform repo" — "or" leaves the implementation choice open. Make a decision: if ama-metrics uses pod annotations, specify the annotation keys. If it uses ServiceMonitor, specify that. Ambiguity here will cause rework.
- The metric `envoy_ratelimit_over_limit` is listed as a key metric to validate. This metric will only appear if rate limiting has been triggered. Add: "Trigger a rate limit test (exceeding configured limit) to confirm `envoy_ratelimit_over_limit` metric is emitted and visible in AMW."
- No AC for confirming the metrics are attributed to the correct tenant namespace (label filtering works). Add: "Confirm metrics include namespace label matching the dev tenant namespace."

**Recommendation:** Improve. Clarify controller vs proxy metrics ports. Remove the "or" ambiguity on scrape config method. Add rate limit trigger AC for `envoy_ratelimit_over_limit`.

---

### EG-402 — Create Grafana dashboard for Envoy Gateway PoC validation

**Quality:** Good
**Issues:**
- "Dashboard scoped to dev tenant namespace via label filter" — good. Specify the label key: `namespace` label or `envoy_gateway_namespace` — confirm which label Envoy Gateway emits.
- "Dashboard committed to platform repo as a JSON provisioning file" — specify the file path: `platform/grafana/dashboards/envoy-gateway-poc.json`.
- No AC for the dashboard being functional — "visible in Azure Managed Grafana dev workspace" is not the same as "panels show data." Add: "At least one panel on the dashboard shows non-zero data from a live request (confirmed via a test request through the ingress chain)."
- No AC for dashboard version/UID to prevent duplication if re-imported. Specify that the JSON includes a stable `uid` field.

**Recommendation:** Improve. Add a "panels show live data" AC. Specify committed file path. Clarify namespace label key.

---

### EG-403 — Configure Datadog tracing integration via EnvoyProxy CRD

**Quality:** Cannot fully assess — story body is truncated in the provided JIRA document ("[Full story with YAML config reference]")
**Issues:**
- Story body is truncated. The review cannot assess AC completeness.
- Based on ADR context: Datadog APM tracing via EnvoyProxy telemetry config should specify the Datadog Agent endpoint and service name. Confirm that x-tenant-id is added as a span tag (not just a log field).
- Sampling at 10% is mentioned — confirm this is head-based sampling configured in the EnvoyProxy CRD, not tail-based.

**Recommendation:** Provide full story body. Cannot mark as complete or acceptable with truncated content.

---

### EG-404 — Configure Datadog metrics collection via Agent autodiscovery

**Quality:** Cannot fully assess — story body is truncated
**Issues:**
- Story body is truncated. The review cannot assess AC completeness.
- Ensure autodiscovery annotations are added to the EnvoyProxy pod template, not just to a static ConfigMap, since EnvoyProxy pods are managed by Envoy Gateway and not directly editable.

**Recommendation:** Provide full story body.

---

### EG-405 — Configure Datadog access log collection and validate log pipeline

**Quality:** Cannot fully assess — story body is truncated
**Issues:**
- Story body is truncated.
- x-tenant-id as a structured log field is mentioned — confirm that the access log format is configured in ClientTrafficPolicy or EnvoyProxy CRD (not just at the Datadog agent level).

**Recommendation:** Provide full story body.

---

### EG-406 — Validate per-tenant observability breakdown in Datadog

**Quality:** Cannot fully assess — story body is truncated
**Issues:**
- Story body is truncated.
- Cross-signal correlation (traces, metrics, logs all filterable by tenant) is the stated goal. Add an explicit AC for each signal type: traces filterable by `x-tenant-id` tag, metrics filterable by namespace label, logs filterable by `x-tenant-id` field.

**Recommendation:** Provide full story body.

---

### EG-501 — PoC validation — functional parity checklist

**Quality:** Cannot fully assess — story body is truncated
**Issues:**
- Story body is truncated (reference to 13-item checklist).
- **Critical:** The checklist must include an explicit item for GitHub issue #8707: "Confirm rate limiting is validated on a single-listener Gateway configuration. Document whether bug #8707 is resolved or still present in v1.8.0."
- The checklist should include a Lua extension validation item: "Confirm Lua extension via `EnvoyExtensionPolicy` works in v1.8.0 for at least one simple transformation (e.g., add response header)."
- Must include a SecurityPolicy proprietary extension acknowledgment: "Team accepts that SecurityPolicy is a proprietary Envoy Gateway resource and documents this as a PoC constraint."

**Recommendation:** Provide full story body. Add bug #8707 checklist item and Lua extension validation item.

---

### EG-502 — PoC retrospective and go/no-go recommendation

**Quality:** Cannot fully assess — story body is truncated
**Issues:**
- Story body is truncated.
- The go/no-go recommendation must explicitly address: (a) whether #8707 was resolved or the workaround (one-Gateway-per-namespace) is validated as viable at 100-tenant scale, (b) SecurityPolicy non-portability risk acceptance, (c) WASM vs Lua capability assessment.

**Recommendation:** Provide full story body.

---

## Missing Stories

### MS-01: Lua Extension Capability Validation (Missing — should be added)

There is no story validating Lua extension capability via `EnvoyExtensionPolicy`. The ADR expert review (Finding 4 in `docs/reviews/review-envoy-gateway.md`) confirmed that Lua was added in Envoy Gateway v1.5. Since the PoC is the right time to validate extension capabilities, and since Lua is significantly lower-barrier than WASM for the team's use cases (simple header transformations, request ID injection), a story should be added:

**Proposed:** EG-203a or EG-210 — "Validate Lua extension via EnvoyExtensionPolicy"
- Deploy a simple EnvoyExtensionPolicy with a Lua script that adds a response header
- Confirm Lua filter executes correctly on a live request
- Document Lua capability scope and limitations for future operator use
- Depends on: EG-202

### MS-02: ACR Mirror Configuration for Envoy Gateway Images (Missing or assumed)

EG-101 and EG-102 both reference ACR mirror as a prerequisite ("Confirm ACR mirror or Docker Hub reachability before starting"), but there is no story for configuring the ACR mirror for `docker.io/envoyproxy` images. If this is not already done, it blocks EG-101. Either confirm this is pre-existing platform infrastructure or add a story.

**Proposed:** EG-100 — "Configure ACR mirror for Envoy Gateway images"
- Mirror `docker.io/envoyproxy/gateway-helm` and `docker.io/envoyproxy/gateway-crds-helm` to ACR
- Confirm image pull works from dev AKS nodes
- Depends on: nothing; blocks EG-101, EG-102

### MS-03: EnvoyProxy HA Configuration for Production Path (Informational gap — not PoC-blocking)

The ADR expert review (`docs/reviews/review-envoy-gateway.md`, HA section) notes that production HA requires `EnvoyProxy` with `replicas: 2+` and a `PodDisruptionBudget`. For the PoC this is intentionally deferred, but there is no story or backlog item capturing this as a future requirement. Add a backlog story or note in EG-502 to ensure it is not forgotten before the wave migration phase.

### MS-04: RBAC for Operator ServiceAccount (Missing from Epic 3)

Epic 3 scaffolds a new operator reconciler (EG-302) that writes Gateway API resources to the cluster. There is no story for the RBAC ClusterRole/ClusterRoleBinding that grants the operator ServiceAccount permission to create/update/delete HTTPRoute, SecurityPolicy, BackendTrafficPolicy, and ExternalSecret resources. Without this, EG-303–EG-306 will produce permission-denied errors at test time.

**Proposed:** Add to EG-302 or as EG-302a — "Define operator RBAC"
- ClusterRole with verbs: get, list, watch, create, update, patch, delete on: httproutes, securitypolicies, backendtrafficpolicies, externalsecrets
- ClusterRoleBinding for operator ServiceAccount
- Committed to platform repo
- Managed by ArgoCD alongside operator deployment

---

## Key Risk Flags

### Risk 1: GitHub Issue #8707 — Rate Limiting Bug (Critical)

EG-305 does not mention this bug. If the PoC team uses a multi-listener Gateway configuration (e.g., HTTP and HTTPS listeners on the same Gateway resource), rate limiting will silently apply only to the first listener. This is undetectable without explicit testing. The one-Gateway-per-namespace architecture is the required workaround. This risk affects EG-305, EG-307, and EG-501.

**Required action:** Add AC to EG-305 and EG-307 explicitly requiring one listener per Gateway in all test configurations. Add checklist item to EG-501.

### Risk 2: SecurityPolicy Non-Portability

`SecurityPolicy` is a proprietary Envoy Gateway resource. If the team later needs to migrate off Envoy Gateway, the operator's SecurityPolicy translation logic cannot be ported to standard Gateway API resources. The JIRA does not acknowledge this at any level. The team should make an explicit risk-acceptance decision and record it in EG-501 or EG-502.

### Risk 3: Truncated Stories in Epics 4 and 5

EG-403 through EG-406 and EG-501 through EG-502 are truncated with placeholder text. These stories cannot be assigned, estimated, or executed as written. They must be completed before Epic 4 work begins. This is a sprint planning blocker — if Epic 4 starts before stories are complete, the team will be executing against undefined acceptance criteria.

### Risk 4: Missing Operator RBAC Story (MS-04)

The operator cannot write to the cluster without a ServiceAccount and ClusterRole. This is a silent dependency that will cause EG-303–EG-307 to fail at runtime. It should be resolved in or alongside EG-302.

### Risk 5: Redis Fail-Open Behavior Not Acknowledged

If the in-cluster Redis (EG-104) goes down during the PoC, rate limiting fails open — all requests pass regardless of limit. This is the correct Envoy Gateway behavior (per ADR expert review, Omissions section), but it is not documented in any story. The team may observe unexpected behavior during testing and spend time debugging a non-bug. EG-104 should note this behavior explicitly.

---

## Directional Guidance

### TO: Senior Platform Engineer Agent

You own Epics 1, 2, and 4. The following direction applies.

**Point estimate guidance:** Use story points with a Fibonacci scale (1, 2, 3, 5, 8, 13). Complexity and risk are the primary drivers, not time. A "1" is a trivial config change; a "13" is a multi-day investigation with architectural uncertainty.

**Epic 1 — Platform Infrastructure**

EG-101 (2 points): Minor improvements needed. Add ACR mirror prerequisite as a hard dependency, not a note. Add CRD count verification AC. If ACR mirror is not confirmed ready, this story cannot be estimated — surface that dependency first.

EG-102 (3 points): Promote `deploy.type: GatewayNamespace` from Notes to AC. This is the single most architecturally important configuration in the entire epic — if it is wrong, EG-106 fails and the PoC is blocked. Treat it as a go/no-go item during sprint review.

EG-103 (3 points): Add zone-spreading AC and Prometheus metrics endpoint AC. Confirm subnet name with network team before story enters sprint. Do not start this story without network team sign-off on the subnet annotation.

EG-104 (2 points): Tighten the Redis validation AC to a specific CLI command. Add a note on Redis fail-open behavior so the team is not surprised when rate limiting stops during a Redis restart.

EG-105 (3 points): Verify Kyverno is running in dev cluster before this story starts — add as a prerequisite. Switch the Kong non-regression AC from a vague statement to a specific observable (Kong pods running, routes returning 200). Set Enforce mode (not Audit) and specify the rejection error message.

EG-106 (5 points): This story has the highest PoC risk in Epic 1. GatewayNamespace mode has never been validated in your AKS environment. Allocate buffer. Add the failure-mode detection AC (proxy pods in wrong namespace = block). Confirm subnet CIDR before story starts.

**Epic 2 — Ingress Chain Integration**

EG-201 (3 points): The configuration-as-script requirement is non-negotiable — infrastructure configuration that cannot be reproduced from code is a liability. Commit an Azure CLI script or Bicep delta to the platform repo. Confirm the `/healthz/ready` probe path responds on port 19001 before configuring the App Gateway probe (do this in a spike, not as a sprint story risk).

EG-202 (3 points): Fix the XFF/client IP AC sequencing issue before implementation. The AC "Envoy access logs show correct client IP" is premature at EG-202 stage because ClientTrafficPolicy (EG-203) has not been applied yet. Move the client IP AC to EG-203 or explicitly document expected pre-ClientTrafficPolicy behavior.

EG-203 (2 points): Add a specificity AC on spoofed header rejection — "access log shows App Gateway IP, not 1.2.3.4." Commit the XFF runbook to a specific path in the platform repo.

**Epic 4 — Observability**

The Datadog stories (EG-403, EG-404, EG-405, EG-406) are currently truncated and cannot be accepted into a sprint. Complete the story bodies before Epic 4 planning.

EG-401 (3 points): Clarify the controller metrics port (19001) vs proxy pod metrics port (confirm: 9902 for Prometheus metrics on Envoy proxy pods — verify against v1.8.0 documentation). Resolve the "ServiceMonitor or pod annotation" ambiguity — pick one approach and commit to it. Add a rate-limit trigger test for `envoy_ratelimit_over_limit`.

EG-402 (2 points): Specify the JSON file committed path. Add live-data AC (at least one panel shows non-zero data). Specify a stable dashboard UID in the JSON to prevent re-import duplication.

EG-403, EG-404, EG-405, EG-406: Provide full story bodies before sprint planning. These are currently unestimable and unacceptable as written. Expected sizing once complete: EG-403 (5 points — EnvoyProxy CRD tracing config is non-trivial), EG-404 (3 points), EG-405 (3 points), EG-406 (3 points).

EG-501, EG-502: Provide full story bodies. EG-501 must include a checklist item for GitHub issue #8707 validation and a Lua extension validation item. EG-502 must address one-Gateway-per-namespace viability at 100-tenant scale as a go/no-go criteria.

---

### TO: Go Developer Agent

You own Epic 3 (EG-301 through EG-307). The following direction applies.

**Point estimate guidance:** Use story points with a Fibonacci scale (1, 2, 3, 5, 8, 13). Complexity and risk are the primary drivers.

**EG-301 (3 points):** Add Lua (`EnvoyExtensionPolicy`) as a valid gap-handling option in the mapping document, alongside WASM, EnvoyPatchPolicy, and drop. The ADR expert review confirmed Lua is available in v1.8.0. Do not produce this document in isolation — get one other platform engineer to review it before EG-302 starts. An incorrect mapping cascades through EG-303–EG-306.

**EG-302 (5 points):** Three things must be resolved before implementation:
1. Add ExternalSecret to the resource stub list — EG-306 depends on it and retrofitting will require rework.
2. Specify the feature flag mechanism (environment variable recommended: `KONNECT_CLIENT_ENABLED=true/false`). Document in README.
3. Add an RBAC story (MS-04 above) either as a sub-task of EG-302 or as a blocking prerequisite. The operator ServiceAccount needs ClusterRole permissions for httproutes, securitypolicies, backendtrafficpolicies, and externalsecrets. Without this, every subsequent story will fail at runtime.
4. Confirm the Kubernetes client version in go.mod is compatible with the dev AKS cluster's API server. Run `kubectl version` against dev and pin accordingly.

**EG-303 (5 points):** Two clarifications before implementation:
1. The header injection filter type is `RequestHeaderModifier` — specify this in the AC so there is no ambiguity.
2. Stale HTTPRoute deletion must use owner reference garbage collection, not manual deletion logic. Owner references are already mandated — ensure the unit test verifies that the `ownerReferences` field contains the correct GVK and UID of the parent CRD, not just that the field is non-nil.
3. Add a negative case AC: if the backend Kubernetes Service does not exist, the reconciler sets a status condition on the tenant CRD rather than crashing.

**EG-304 (5 points):** Critical security note: the integration test must explicitly verify that no secret values appear in the generated SecurityPolicy spec — only a `secretRef` pointing to the ESO-managed Secret. Do not inline OIDC client secrets at any point. `SecurityPolicy` is a proprietary Envoy Gateway resource (`gateway.envoyproxy.io/v1alpha1`) — confirm the correct API version against v1.8.0 CRDs before writing translation code. Add a negative-case test for tenants with no auth config in the CRD.

**EG-305 (8 points — elevated due to bug #8707 risk):** This is the highest-risk story in the epic. Before writing any translation code:
1. Confirm the dev test Gateway has exactly one listener. If it has more than one (e.g., HTTP + HTTPS), rate limiting will only apply to the first — this is bug #8707. Structure all PoC test Gateways with one listener per Gateway resource.
2. The one-Gateway-per-namespace architecture is the required workaround for #8707. The operator must generate exactly one Gateway per tenant namespace. Verify this assumption is consistent with EG-106's Gateway deployment.
3. Verify that Redis is not configured in BackendTrafficPolicy spec — it is sourced from EnvoyProxy CRD configuration only. Your translation code must not add Redis connection config to BackendTrafficPolicy.
4. Add a Redis fail-open test: bring Redis down during a rate limit test and confirm requests pass (not 500). Document this behavior in the operator README.
5. Circuit breaker thresholds: use `spec.circuitBreaker` with `maxConnections`, `maxPendingRequests`, `maxParallelRequests`. Define test fixture values in the integration test.

**EG-306 (3 points):** Before starting: run `kubectl get clustersecretstore` in dev to confirm ESO ClusterSecretStore exists. If it does not, this story is blocked and needs an infra prerequisite. Specify the Key Vault path format for OIDC client secrets (align with whatever convention the platform team uses for ESO). Verify whether ESO-managed Secrets are garbage collected when their parent ExternalSecret is deleted — document the behavior either way.

**EG-307 (5 points):** Add explicit dependencies on EG-106, EG-201, and EG-202 — without those, there is no Gateway, no App Gateway backend, and no validated ingress chain to test against. For the rate limit AC ("exceeding limit returns HTTP 429"), add a guard condition in the test: assert exactly one listener on the test Gateway before running the rate limit scenario (guards against #8707 silently negating the test). Define garbage collection timeout: resources should be gone within 30 seconds of CRD deletion. If they are not, the test fails — do not accept "eventually" without a bound.
