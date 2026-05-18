# Go Developer Review — Epic 3 JIRA Stories (EG-301 through EG-307 + EG-302a)

**Reviewer:** Senior Go Developer (Epic 3 Owner)
**Date:** 2026-05-17
**Scope:** EG-301, EG-302, EG-302a (new RBAC story), EG-303, EG-304, EG-305, EG-306, EG-307
**PM Directional Review Reference:** `docs/reviews/review-jira-pm.md`

---

## Summary of Changes

**EG-301 (3 pts):** Added Lua (`EnvoyExtensionPolicy`) as a gap-handling option in the mapping document AC. Added peer review gate before EG-302 can start. Added time-box guidance note to prevent audit from becoming a blocking excavation.

**EG-302 (5 pts):** Added `ExternalSecret` to the resource stub list (required because EG-306 depends on it — retrofitting after scaffold is complete causes rework). Specified the feature flag mechanism explicitly as environment variable `KONNECT_CLIENT_ENABLED=true/false`. Added EG-302a as a blocking prerequisite. Tightened the owner reference unit test AC to verify GVK and UID, not just non-nil field. Added Kubernetes client version compatibility AC.

**EG-302a (1 pt — new story):** Added the missing RBAC story identified by the PM as MS-04. The operator ServiceAccount requires a `ClusterRole` and `ClusterRoleBinding` covering all four resource types. Without this, EG-303 through EG-307 fail at runtime with permission-denied errors. This is a hard blocker.

**EG-303 (5 pts):** Specified that header injection uses `RequestHeaderModifier` filter type (not response header filter). Clarified that stale `HTTPRoute` deletion uses Kubernetes owner reference garbage collection, not manual deletion logic. Added error-case AC for missing backend Service. Specified that the integration test must use controller-runtime `envtest` (real API server binary), not unit mocks.

**EG-304 (5 pts):** Added security AC explicitly verifying no secret values appear in the `SecurityPolicy` spec (only `secretRef`). Added Entra ID JWKS URI format as a note. Added explicit note that `SecurityPolicy` is a proprietary Envoy Gateway resource (`gateway.envoyproxy.io/v1alpha1`) — not a standard Gateway API resource. Added negative-case integration test for no-auth-config tenant. Added error-case AC for unresolvable JWKS URI.

**EG-305 (8 pts — elevated):** This is the highest-risk story. Added bug #8707 guard AC requiring exactly one listener on all test Gateways. Added one-Gateway-per-namespace constraint AC as the required #8707 workaround. Added AC verifying Redis is NOT in `BackendTrafficPolicy` spec (sourced from `EnvoyProxy` CRD only). Added Redis fail-open integration test. Specified circuit breaker field names with test fixture values. Added idempotency AC (apply CRD twice, verify resource count = 1).

**EG-306 (3 pts):** Added `ClusterSecretStore` prerequisite check before story begins. Specified Key Vault secret path naming convention in AC. Added AC to verify and document ESO `Secret` garbage collection behavior on owner reference deletion.

**EG-307 (5 pts):** Added explicit cross-epic dependencies: EG-106, EG-201, EG-202. Added bug #8707 guard condition for the rate limiting AC. Defined garbage collection timeout as 30 seconds (hard bound, not "eventually"). Added clarifying note on "full chain" scope — PoC validates App Gateway → Envoy ILB → service, not live Imperva traffic. Added RBAC validation AC before full reconcile run.

---

## EG-301: Audit Existing Operator — Document Input CRD Schema and Current Output Model

**Type:** Story
**Persona:** Senior Developer
**Points:** 3
**Depends on:** (none — first story in epic)
**Prerequisites:** Access to existing operator codebase and current CRD definitions

**Description:**
Document the existing operator's input CRD schema — all spec fields, types, and validation rules — and its current output model, meaning what Kong declarative configuration it generates and which Kong entity types it uses per CRD instance. Produce a mapping document from each CRD field to its target Gateway API resource and field. This document is the specification against which EG-302 through EG-306 are built. An incorrect or incomplete mapping cascades errors across the entire epic.

**Acceptance Criteria:**
- [ ] CRD schema documented: all `spec` fields, required vs optional, field types, and any `+kubebuilder:validation` rules present in the Go type definition
- [ ] Current output documented: Kong entity types generated per CRD instance (services, routes, plugins, consumers, upstreams) with the mapping between CRD fields and Kong fields
- [ ] Mapping document produced at `docs/operator/crd-gateway-api-mapping.md` with each CRD field mapped to its Gateway API equivalent (`HTTPRoute` field, `SecurityPolicy` field, `BackendTrafficPolicy` field, or flagged as no direct equivalent)
- [ ] Fields with no direct Gateway API equivalent are listed with proposed handling strategy — valid options are: drop, WASM filter via `EnvoyExtensionPolicy`, Lua script via `EnvoyExtensionPolicy`, `EnvoyPatchPolicy`, or explicit documented gap
- [ ] Lua (`EnvoyExtensionPolicy`) is included as a candidate handling option alongside WASM and `EnvoyPatchPolicy` — the ADR expert review confirmed Lua was added in v1.5 and is lower-barrier than WASM for simple header transformations
- [ ] Mapping document reviewed and signed off by one other platform engineer before EG-302 begins — given that EG-302 through EG-306 all build on this mapping, an incorrect document cascades failures
- [ ] Document committed to platform repo at `docs/operator/crd-gateway-api-mapping.md`

**Notes:**
Time-box guidance: if auditing the operator codebase is expected to exceed 8 hours, flag gaps explicitly in the document and proceed. Do not block EG-302 on exhaustive documentation of edge cases. Partial coverage with clearly marked gaps is better than a sprint delay.

The peer review requirement is a hard gate — EG-302 cannot start until the mapping document has a second engineer sign-off. Record the reviewer's name and date in the document header.

---

## EG-302: Scaffold New Operator Reconciler Targeting Kubernetes API Server

**Type:** Story
**Persona:** Senior Developer
**Points:** 5
**Depends on:** EG-301
**Prerequisites:** EG-302a (RBAC story) must be completed or in-flight — the operator ServiceAccount must exist before runtime verification of EG-303 through EG-307

**Description:**
Create the new reconciler structure in the operator that writes Gateway API resources to the Kubernetes API server via controller-runtime client, replacing the current HTTP client that targets the Konnect API. The scaffold compiles and passes unit tests before any translation logic is implemented. The old Konnect client path is feature-flagged off but not deleted — it must be available for rollback during the PoC.

**Acceptance Criteria:**
- [ ] New reconciler compiles cleanly with `go build ./...`
- [ ] Old Konnect HTTP client is controlled by environment variable `KONNECT_CLIENT_ENABLED=true/false` — when `false`, the Konnect client path is skipped and the new reconciler runs; when `true`, existing behavior is preserved; default is `false` for new deployments
- [ ] Feature flag environment variable name (`KONNECT_CLIENT_ENABLED`) and behavior documented in operator `README.md`
- [ ] controller-runtime `Create` / `Update` / `Delete` calls stubbed for: `HTTPRoute`, `SecurityPolicy`, `BackendTrafficPolicy`, `ExternalSecret` — all four resource types must be present from the start to avoid scaffold rework when EG-306 begins
- [ ] Owner references set on all generated resources using `ctrl.SetControllerReference(tenantCRD, generatedResource, r.Scheme)` — required for garbage collection in EG-307
- [ ] Unit tests verify that `ownerReferences` field on generated resources contains the correct GVK (`group`, `version`, `kind`) and UID of the parent tenant CRD — not just that the field is non-nil
- [ ] Unit tests cover: reconciler triggered on CRD create, update, and delete events
- [ ] `go.mod` Kubernetes client version confirmed compatible with dev AKS cluster API server — run `kubectl version` against dev and verify the minor version is within supported skew before merging

**Notes:**
The environment variable feature flag is the recommended mechanism for operator feature flags — it is operationally simple, works cleanly in Kubernetes `Deployment` env blocks, and does not require a build tag or config file.

`ExternalSecret` must be in the stub list now. EG-306 depends on it, and adding a net-new resource type to a reconciler after translation logic has been written for the other three types requires revisiting the reconciler loop structure. Do it once in the scaffold.

EG-302a (RBAC) must be completed or at minimum in-flight before EG-303 starts. The operator ServiceAccount cannot write `HTTPRoute` or `SecurityPolicy` resources to the cluster without the `ClusterRole` defined in EG-302a. Runtime permission-denied errors at EG-303 test time will appear as cryptic controller-runtime errors, not clear RBAC messages.

---

## EG-302a: Operator RBAC — ClusterRole and ClusterRoleBinding for Operator ServiceAccount

**Type:** Story
**Persona:** Senior Developer
**Points:** 1
**Depends on:** EG-302 (operator scaffold must exist for the ServiceAccount to be referenced in the binding)
**Prerequisites:** Operator namespace and ServiceAccount name confirmed from EG-302 scaffold

**Description:**
The operator reconciler writes Gateway API resources to the cluster. Without a `ClusterRole` and `ClusterRoleBinding`, the operator ServiceAccount has no permissions to create, update, or delete `HTTPRoute`, `SecurityPolicy`, `BackendTrafficPolicy`, or `ExternalSecret` resources. EG-303 through EG-307 will fail at runtime with permission-denied errors if this story is not completed first. Create and commit the RBAC manifests to the platform repo, managed by ArgoCD alongside the operator deployment.

**Acceptance Criteria:**
- [ ] `ClusterRole` committed to platform repo granting `get`, `list`, `watch`, `create`, `update`, `patch`, `delete` on: `httproutes.gateway.networking.k8s.io`, `securitypolicies.gateway.envoyproxy.io`, `backendtrafficpolicies.gateway.envoyproxy.io`, `externalsecrets.external-secrets.io`
- [ ] `ClusterRoleBinding` committed to platform repo binding the `ClusterRole` to the operator ServiceAccount (`system:serviceaccount:<operator-namespace>:<operator-sa>`)
- [ ] Both manifests committed under `platform/operator/rbac/` in the platform repo
- [ ] Managed by ArgoCD as part of the operator ArgoCD Application (same sync wave as the operator Deployment)
- [ ] `kubectl auth can-i create httproutes --as=system:serviceaccount:<operator-namespace>:<operator-sa>` returns `yes`
- [ ] `kubectl auth can-i create securitypolicies.gateway.envoyproxy.io --as=system:serviceaccount:<operator-namespace>:<operator-sa>` returns `yes`
- [ ] `kubectl auth can-i create backendtrafficpolicies.gateway.envoyproxy.io --as=system:serviceaccount:<operator-namespace>:<operator-sa>` returns `yes`
- [ ] `kubectl auth can-i create externalsecrets.external-secrets.io --as=system:serviceaccount:<operator-namespace>:<operator-sa>` returns `yes`

**Notes:**
This story is 1 point — it is purely manifest authoring with no Go code changes. The risk if skipped is silent: the reconciler will log permission-denied errors on every reconcile loop and no Gateway API resources will be created. This appears to the developer as a reconciler bug, not an RBAC gap, and wastes debugging time.

Confirm the exact operator ServiceAccount name from the scaffold output of EG-302 before writing the binding. It is typically `<operator-name>-controller-manager` but verify against the actual `Deployment` spec.

---

## EG-303: Implement HTTPRoute Translation

**Type:** Story
**Persona:** Senior Developer
**Points:** 5
**Depends on:** EG-302, EG-302a
**Prerequisites:** EG-106 (dev tenant Gateway provisioned in cluster for integration test)

**Description:**
Implement the translation logic that converts the tenant CRD's service and route configuration into one or more `HTTPRoute` resources and writes them to the Kubernetes API server. The reconciler must be idempotent, handle stale resource cleanup via owner reference garbage collection, and set a meaningful status condition on the tenant CRD when backend Services are missing.

**Acceptance Criteria:**
- [ ] Operator generates a valid `HTTPRoute` for each service defined in the tenant CRD
- [ ] `HTTPRoute` correctly sets: `parentRefs` targeting the tenant Gateway, `hostnames`, `rules.matches` (path and method), `rules.backendRefs` (Service name and port)
- [ ] Request header injection (`x-tenant-id`) implemented using `RequestHeaderModifier` filter type — this is the correct filter for injecting request headers; do not use response header filter
- [ ] `ownerReferences` field on each `HTTPRoute` contains the correct GVK and UID of the parent tenant CRD (not just non-nil)
- [ ] Stale `HTTPRoute` resources — those present in the cluster but no longer represented in the CRD spec — are removed via Kubernetes owner reference garbage collection; the reconciler does not implement manual deletion logic
- [ ] Reconciling the same CRD twice produces no diff (idempotent)
- [ ] Error case: if the backend Kubernetes `Service` referenced in the CRD does not exist in the cluster, the reconciler sets a status condition on the tenant CRD (e.g., `BackendServiceMissing: True`) and does not crash, panic, or enter an error-rate-limited reconcile loop
- [ ] Integration test uses controller-runtime `envtest` (`sigs.k8s.io/controller-runtime/pkg/envtest`) with a real API server binary — not unit mocks — to verify the Create, Update, and Delete lifecycle of `HTTPRoute` resources
- [ ] Integration test: apply tenant CRD, verify `HTTPRoute` created in cluster with correct spec fields
- [ ] Integration test: update tenant CRD (modify a route), verify `HTTPRoute` updated in cluster

**Notes:**
`RequestHeaderModifier` is defined in `gateway.networking.k8s.io/v1` as `HTTPRequestHeaderFilter`. Confirm the filter type value is `RequestHeaderModifier` (not `ResponseHeaderModifier`) in the `HTTPRoute` rules filters slice.

Owner reference garbage collection: when `ctrl.SetControllerReference` is used and the parent CRD is deleted with default foreground deletion propagation, Kubernetes GC controller removes owned resources automatically. The reconciler does not need to list and delete stale resources — it only needs to ensure owner references are set correctly. If additional stale resource cleanup is needed (e.g., when a route is removed from the CRD but the CRD itself is not deleted), implement using a finalizer or list-and-prune pattern, but do not implement raw client `Delete` calls without the owner reference safety net.

`envtest` requires the API server binary. It is typically acquired via `setup-envtest` from `sigs.k8s.io/controller-runtime/tools/setup-envtest`. Add a `make setup-envtest` target and document in the operator README.

---

## EG-304: Implement SecurityPolicy Translation (JWT + OIDC)

**Type:** Story
**Persona:** Senior Developer
**Points:** 5
**Depends on:** EG-303, EG-306
**Prerequisites:** EG-302a (RBAC — `securitypolicies.gateway.envoyproxy.io` write permission required)

**Description:**
Implement the translation logic that converts the tenant CRD's authentication configuration into a `SecurityPolicy` resource targeting the generated `HTTPRoute`. Covers JWT validation against Azure Entra ID and OIDC client configuration with the client secret sourced via an ESO-managed `Secret` reference. `SecurityPolicy` is a proprietary Envoy Gateway resource — it is not part of the standard Gateway API. Confirm the correct API version against v1.8.0 CRDs before writing any translation code.

**Acceptance Criteria:**
- [ ] Confirm `SecurityPolicy` API version against Envoy Gateway v1.8.0 CRDs before writing translation code — expected: `gateway.envoyproxy.io/v1alpha1`; record the confirmed version in the mapping document
- [ ] Operator generates a `SecurityPolicy` per `HTTPRoute` where auth is configured in the tenant CRD
- [ ] `SecurityPolicy` correctly sets: JWT provider with `issuer`, `remoteJWKS.uri`, `audiences`; `claimToHeaders` mapping `tid` claim → `x-tenant-id` header
- [ ] OIDC client secret reference uses `secretRef` pointing to the ESO-managed `Secret` — client secret value is never inlined in the `SecurityPolicy` spec at any point
- [ ] Integration test explicitly verifies that no secret values appear anywhere in the `SecurityPolicy` spec — only the `secretRef` field (name and namespace) is present
- [ ] `ownerReferences` field on `SecurityPolicy` contains the correct GVK and UID of the parent tenant CRD
- [ ] Integration test: apply tenant CRD with auth config, verify `SecurityPolicy` created with correct Entra ID issuer and JWKS URI
- [ ] Negative-case integration test: tenant CRD with no auth configuration → no `SecurityPolicy` generated (confirmed by asserting resource does not exist after reconcile)
- [ ] Error case: if the `SecurityPolicy` references a JWKS URI that cannot be resolved or returns a non-200 at admission time, reconciler sets a status condition on the tenant CRD rather than silently failing; does not retry in a tight loop

**Notes:**
`SecurityPolicy` is `gateway.envoyproxy.io/v1alpha1` — it is NOT a standard Gateway API resource and is NOT portable to other gateway implementations. This is an explicit PoC-scoped decision per the ADR. Confirm the exact API version against the v1.8.0 CRD manifest before writing the Go struct imports.

Entra ID JWKS URI format for test fixtures: `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`. Use a real dev Entra ID tenant ID in the integration test fixture.

The secret reference security AC is critical. Run `kubectl get securitypolicy <name> -o yaml` after reconcile and grep for any string that looks like a secret value. The spec must contain only `secretRef.name` and `secretRef.namespace` under the OIDC block.

`ExternalSecret` generation (EG-306) must be complete or running in parallel for the `secretRef` in `SecurityPolicy` to resolve. EG-304 depends on EG-306 for the full integration test to pass, but translation logic can be developed independently.

---

## EG-305: Implement BackendTrafficPolicy Translation (Rate Limiting + Circuit Breaking)

**Type:** Story
**Persona:** Senior Developer
**Points:** 8
**Depends on:** EG-303
**Prerequisites:** EG-302a (RBAC — `backendtrafficpolicies.gateway.envoyproxy.io` write permission required); EG-104 (Redis deployed); EG-106 (exactly one Gateway per tenant namespace confirmed)

**Description:**
Implement the translation logic that converts the tenant CRD's traffic policy configuration — rate limits, timeouts, retries, and circuit breaking — into a `BackendTrafficPolicy` resource. This is the highest-risk story in the epic due to GitHub issue #8707 in `envoyproxy/gateway`: global rate limiting via `BackendTrafficPolicy` only applies to the first listener on a Gateway. The required workaround is one Gateway per tenant namespace (single listener). All test Gateways must be confirmed to have exactly one listener before rate limiting tests are run.

**Acceptance Criteria:**
- [ ] **Bug #8707 guard:** Before writing or running any rate limiting tests, run `kubectl get gateway -o yaml` in the dev namespace and confirm the test Gateway has exactly one listener. If it has HTTP + HTTPS listeners (or any multi-listener configuration), rate limiting will silently apply only to the first listener. Document the listener count in the test run log.
- [ ] **One-Gateway-per-namespace:** The operator generates exactly one Gateway per tenant namespace. Verify this is consistent with the Gateway provisioned by EG-106. The one-Gateway-per-namespace architecture is the required workaround for #8707 and is a hard architectural constraint for the PoC.
- [ ] Operator generates a `BackendTrafficPolicy` per `HTTPRoute` where traffic policy is configured in the tenant CRD
- [ ] `BackendTrafficPolicy` correctly sets: global rate limit rules keyed on `x-tenant-id` header value, timeout, retry policy
- [ ] Circuit breaker configured using `spec.circuitBreaker` with fields `maxConnections`, `maxPendingRequests`, `maxParallelRequests` — integration test fixture values: `maxConnections: 100`, `maxPendingRequests: 50`, `maxParallelRequests: 25`
- [ ] **Redis NOT in BackendTrafficPolicy:** Operator does not generate any Redis connection configuration in the `BackendTrafficPolicy` spec — Redis is sourced from the `EnvoyProxy` CRD configuration only. After reconcile, run `kubectl get backendtrafficpolicy <name> -o yaml` and confirm no Redis host, port, or connection fields appear in the spec.
- [ ] `ownerReferences` field on `BackendTrafficPolicy` contains the correct GVK and UID of the parent tenant CRD
- [ ] Idempotency test: apply the same tenant CRD twice (two sequential reconcile cycles); confirm `kubectl get backendtrafficpolicy` returns exactly 1 resource (not 2); confirm no spurious update events in controller logs between the two reconciles
- [ ] Integration test: apply tenant CRD with rate limit config, verify `BackendTrafficPolicy` created with correct limit rules and circuit breaker thresholds
- [ ] Redis fail-open test: bring Redis down (scale Redis `Deployment` to 0 replicas), apply rate limit config, confirm requests pass through and are not rejected with HTTP 500; rate limiting must fail open per Envoy Gateway behavior — document this behavior in the operator README under a "Known Behaviors" section

**Notes:**
This story is 8 points — elevated from the original estimate due to bug #8707 complexity, the Redis fail-open test requirement, and the one-Gateway-per-namespace architectural constraint that must be verified before any rate limiting validation is meaningful.

`BackendTrafficPolicy` exists in two places: as a Gateway API Experimental resource and as an Envoy Gateway extension under `gateway.envoyproxy.io`. Confirm which API group and version is in use for rate limiting and circuit breaking in v1.8.0 CRDs before writing Go struct imports. The Envoy Gateway extension version has additional fields not present in the standard experimental resource.

Redis fail-open is not a bug — it is documented Envoy Gateway behavior. If Redis is unavailable, the rate limiting filter passes all requests. The operator should still generate and apply `BackendTrafficPolicy` regardless of Redis availability. The fail-open test must be part of the integration test suite so the team is not surprised when Redis goes down in dev.

Bug #8707 reference: `github.com/envoyproxy/gateway/issues/8707`. Check the issue for status in v1.8.0 before the PoC — if it has been resolved, remove the one-listener constraint from test configurations and document the resolution.

---

## EG-306: Implement ESO ExternalSecret Generation for OIDC Client Secrets

**Type:** Story
**Persona:** Senior Developer
**Points:** 3
**Depends on:** EG-304
**Prerequisites:** ESO `ClusterSecretStore` must exist in dev cluster — run `kubectl get clustersecretstore` before starting; if not present, story is blocked pending infra work

**Description:**
The operator generates an `ExternalSecret` resource for each tenant that requires OIDC, pointing to the correct Key Vault secret path. The resulting Kubernetes `Secret` created by ESO is then referenced by the `SecurityPolicy` generated in EG-304. Owner references on the `ExternalSecret` must be set correctly for garbage collection to work in EG-307.

**Acceptance Criteria:**
- [ ] **ClusterSecretStore prerequisite:** Run `kubectl get clustersecretstore` in dev cluster before starting this story. If no `ClusterSecretStore` exists, story is blocked — do not proceed; raise a blocker against the infra team.
- [ ] Operator generates an `ExternalSecret` for each OIDC tenant, referencing the existing ESO `ClusterSecretStore` by name
- [ ] `ExternalSecret` `spec.dataFrom` or `spec.data` references the Key Vault secret path using the convention: `secrets/<tenant-name>/oidc-client-secret` — confirm this matches the platform's existing Key Vault path convention before implementing
- [ ] ESO-managed `Secret` (the output of the `ExternalSecret`) is created in the same namespace as the tenant and is referenced correctly in `SecurityPolicy.spec.oidc.clientSecret.secretRef`
- [ ] `ownerReferences` set on the `ExternalSecret` using `ctrl.SetControllerReference`
- [ ] Integration test: apply tenant CRD with OIDC config, verify `ExternalSecret` created with correct `ClusterSecretStore` reference and Key Vault path
- [ ] **ESO Secret garbage collection behavior documented:** Verify whether deleting the `ExternalSecret` (via owner reference GC when the tenant CRD is deleted) also causes ESO to delete the resulting Kubernetes `Secret`. Run a manual test: delete the `ExternalSecret`, wait 30 seconds, check if the resulting `Secret` is also gone. Document the observed behavior in the operator README under "Resource Lifecycle" — if the `Secret` persists after `ExternalSecret` deletion, note that it must be cleaned up manually or via a finalizer.

**Notes:**
ESO `ExternalSecret` API version is `external-secrets.io/v1beta1` — confirm against the ESO version installed in the dev cluster before writing Go struct imports.

The Key Vault path convention `secrets/<tenant-name>/oidc-client-secret` must be confirmed with the platform team. Use whatever convention is already established for other ESO-managed secrets in the cluster.

The integration test for this story may require either a real ESO instance (with ClusterSecretStore and Key Vault access) or a mock/stub. If running against real ESO in envtest is not feasible, scope the integration test to verify `ExternalSecret` creation and spec correctness only — defer the resulting `Secret` assertion to EG-307 where the full dev cluster is used.

---

## EG-307: Operator Integration Test — Full Reconcile Against Dev Cluster

**Type:** Story
**Persona:** Senior Developer
**Points:** 5
**Depends on:** EG-303, EG-304, EG-305, EG-306, EG-302a
**Prerequisites:** EG-106 (dev tenant Gateway provisioned and ILB IP assigned); EG-201 (App Gateway backend pool targeting Envoy ILB); EG-202 (test HTTPRoute validated end-to-end); operator RBAC verified via EG-302a

**Description:**
Run the rewritten operator against the dev cluster end-to-end. Apply a realistic tenant CRD instance and verify all generated resources are correct, traffic flows through the chain, JWT validation works, rate limiting is enforced, and deleting the CRD causes all generated resources to be garbage collected within the defined timeout. This is the capstone integration test for Epic 3.

**Acceptance Criteria:**
- [ ] **RBAC validation before starting:** Run `kubectl auth can-i create httproutes --as=system:serviceaccount:<operator-namespace>:<operator-sa>` and all four resource type checks (from EG-302a). All must return `yes` before proceeding — if any return `no`, stop and resolve the RBAC gap before running the full reconcile.
- [ ] Operator deployed to dev cluster (or run locally pointing at dev kubeconfig with `KUBECONFIG` set)
- [ ] Apply one tenant CRD instance representing a realistic dev tenant (OIDC auth configured, rate limits configured, at least two routes)
- [ ] Verify generated resources exist in cluster: `HTTPRoute`, `SecurityPolicy`, `BackendTrafficPolicy`, `ExternalSecret`
- [ ] Traffic flows through the chain: App Gateway → Envoy ILB → backend service returns HTTP 200 — PoC scope is App Gateway → Envoy ILB → service; live Imperva traffic is not required for PoC sign-off; document this scope decision in the test run record
- [ ] JWT token validated: valid Entra ID JWT token accepted (HTTP 200); invalid or expired token rejected (HTTP 401)
- [ ] **Rate limiting — bug #8707 guard:** Before running the rate limit test, run `kubectl get gateway -n <tenant-namespace> -o yaml` and assert exactly one listener is present on the test Gateway. If more than one listener exists, the rate limit test result is invalid and must not be used for PoC sign-off. Record the listener count in the test log.
- [ ] Rate limiting enforced: requests above the configured limit return HTTP 429; rate limit counter resets after the configured window
- [ ] **Garbage collection with timeout:** Before deleting the tenant CRD, list all resources with `ownerReferences` pointing to the test CRD instance UID. Delete the CRD. Within 30 seconds, all owned resources (HTTPRoute, SecurityPolicy, BackendTrafficPolicy, ExternalSecret) must be gone — confirm with `kubectl get` for each type. If any resource persists beyond 30 seconds, the story fails. "Eventually consistent" without a time bound is not acceptable.
- [ ] No ERROR-level log entries in operator structured logs during the full lifecycle (apply → traffic test → delete → GC)

**Notes:**
"Full chain" scope for this PoC: the test validates App Gateway → Envoy ILB → service. Imperva is upstream of App Gateway and its traffic is not required for PoC sign-off. Document this explicitly in the test run record so the PoC sign-off in EG-501 has accurate scope context.

The 30-second GC timeout is a hard bound for the test environment. In production, GC timing may vary with cluster load, but 30 seconds is a reasonable assertion window for a dev cluster with low resource count. If GC is not completing within 30 seconds, investigate whether owner references were set correctly on all four resource types — this is the most common cause of GC failure.

Cross-epic dependencies: this story depends on EG-106 (Gateway and ILB provisioned), EG-201 (App Gateway backend pool pointing at Envoy ILB), and EG-202 (validated end-to-end traffic path). Without all three, there is no functional ingress chain to test against. Confirm all three are marked Done in the sprint board before starting this story.
