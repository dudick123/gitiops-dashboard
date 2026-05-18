# FEATURE EG-001: Envoy Gateway PoC — Dev Environment

**Feature ID:** EG-001
**Type:** Feature
**Summary:** Validate Envoy Gateway as Kong Konnect replacement in the dev environment, covering installation, ingress chain integration, operator translation rewrite, observability, and auth/rate limiting parity.

**Description:**
This feature delivers a working proof-of-concept of Envoy Gateway on the existing dev AKS cluster, validating the full ingress path (Imperva → Azure Application Gateway → Envoy ILB → tenant services) and a rewritten operator that translates tenant CRDs into Kubernetes Gateway API resources. Successful completion gates the decision to proceed with phased tenant migration.

**Feature Prerequisites:**
ArgoCD is assumed operational in the dev cluster. All stories operate against an existing dev AKS cluster with ArgoCD managing GitOps sync. If ArgoCD is not operational, that is a blocking prerequisite outside the scope of this feature.

**Feature Acceptance Criteria:**
- [ ] Envoy Gateway controller running in dev AKS, managed by ArgoCD
- [ ] At least one tenant service reachable end-to-end through Imperva → App Gateway → Envoy ILB
- [ ] Operator successfully translates a tenant CRD instance into HTTPRoute, SecurityPolicy, BackendTrafficPolicy, and ExternalSecret, and writes them to the cluster
- [ ] JWT validation working against Azure Entra ID for a dev tenant
- [ ] Global rate limiting enforced via Redis-backed BackendTrafficPolicy — validated against a one-Gateway-per-namespace architecture with a single-listener Gateway to avoid GitHub issue #8707 (BackendTrafficPolicy global rate limiting applies to first listener only on multi-listener Gateways)
- [ ] All Gateways in the PoC use the `platform-gateway` GatewayClass — enforced by Kyverno ClusterPolicy (EG-105); this is a prerequisite for safe parallel Kong/Envoy operation
- [ ] Lua extension capability via `EnvoyExtensionPolicy` validated — confirms whether Lua meets operator custom transformation needs or WASM investment is required
- [ ] SecurityPolicy (JWT/OIDC) is a proprietary Envoy Gateway resource (`gateway.envoyproxy.io`) — the team formally accepts this as a PoC-scoped decision and documents migration implications
- [ ] All resources managed declaratively via Kustomize and synced by ArgoCD
- [ ] Existing dev tenant on Kong unaffected throughout PoC — defined as: existing Kong LB IP continues to serve traffic, Kong routes respond with HTTP 200, no Kong configuration changes are made

**Out of Scope:**
- Production or staging tenant migration
- Full 100-tenant scale testing
- Konnect decommission
- App Gateway removal (Phase 2)

---

## Epic 1: Platform Infrastructure

*Stories covering Envoy Gateway installation, cluster-scoped resources, and GitOps wiring. Owner persona: Senior Infrastructure Engineer.*

---

### EG-100: Configure ACR Mirror for Envoy Gateway Images

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 2
**Depends on:** none

**Prerequisites:**
Platform ACR instance accessible and pushable from CI pipeline. Dev AKS node managed identity has `AcrPull` role on the platform ACR.

**Description:**
Mirror the Envoy Gateway Helm chart images from `docker.io/envoyproxy` to the platform Azure Container Registry so that dev AKS nodes can pull images without requiring internet access to Docker Hub. This is a hard prerequisite for EG-101 (CRD chart install) and EG-102 (controller install). If this mirror is already configured and confirmed working, mark the story as pre-existing and close immediately with evidence of a successful image pull from a dev AKS node.

**Acceptance Criteria:**
- [ ] `docker.io/envoyproxy/gateway-crds-helm:v1.8.0` mirrored to platform ACR
- [ ] `docker.io/envoyproxy/gateway-helm:v1.8.0` mirrored to platform ACR
- [ ] Image pull confirmed from a dev AKS node: `kubectl run eg-pull-test --image=<acr-name>.azurecr.io/envoyproxy/gateway-helm:v1.8.0 --restart=Never --command -- echo ok` exits successfully
- [ ] Mirror script or pipeline step committed to platform repo under `platform/scripts/mirror-envoy-images.sh`
- [ ] ArgoCD image pull secret (if required) updated to reference ACR, not Docker Hub

**Notes:**
If the platform already uses an ACR mirror for other OCI Helm charts, follow the same pattern. Docker Hub rate limiting is a known risk in CI-heavy environments — do not rely on unauthenticated Docker Hub access for PoC infrastructure. If this story is confirmed pre-existing (mirror already in place and pull confirmed), close it with a comment linking to the pull confirmation evidence and proceed to EG-101.

---

### EG-101: Install Envoy Gateway CRDs via ArgoCD

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 2
**Depends on:** EG-100

**Prerequisites:**
EG-100 complete and confirmed — ACR mirror for `docker.io/envoyproxy` is accessible from dev cluster. ArgoCD operational in dev cluster.

**Description:**
Install the Envoy Gateway CRD chart (`gateway-crds-helm` v1.8.0) into the dev AKS cluster as a dedicated ArgoCD Application. CRDs are managed separately from the controller to support independent upgrades. The CRD chart installs both standard Gateway API CRDs and Envoy Gateway extension CRDs.

**Acceptance Criteria:**
- [ ] ArgoCD Application `envoy-gateway-crds` synced and healthy in dev
- [ ] All Gateway API standard channel CRDs present: `gatewayclasses`, `gateways`, `httproutes`, `grpcroutes`, `referencegrants`
- [ ] All Envoy Gateway extension CRDs present: `securitypolicies`, `backendtrafficpolicies`, `clienttrafficpolicies`, `envoyproxies`, `envoypatchpolicies`, `envoyextensionpolicies`
- [ ] CRD count verification passes: `kubectl get crd | grep gateway.envoyproxy.io` returns at least 10 resources
- [ ] Application configured with `prune: false` and `Replace=true` sync option
- [ ] Sync wave set to `-2`
- [ ] Image pulled from ACR mirror (not Docker Hub directly) — confirmed in ArgoCD Application pod events or `kubectl describe`

**Notes:**
`envoypatchpolicies` and `envoyextensionpolicies` are Envoy Gateway extension CRDs — they are not part of the standard Gateway API specification. The standard Gateway API CRDs (`gatewayclasses`, `gateways`, `httproutes`, etc.) are portable; the extension CRDs are Envoy Gateway proprietary. `prune: false` is intentional — CRDs must never be auto-pruned as it would destroy all instances cluster-wide.

---

### EG-102: Deploy Envoy Gateway Controller via ArgoCD

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-101

**Prerequisites:**
EG-100 complete. EG-101 synced and healthy. ACR mirror confirmed.

**Description:**
Deploy the Envoy Gateway controller (`gateway-helm` v1.8.0) into `envoy-gateway-system` namespace via ArgoCD using the multi-source pattern — Helm chart from ACR OCI mirror, values file from the platform Git repo. The values file must configure GatewayNamespace deploy mode (`deploy.type: GatewayNamespace`), which causes proxy pods to be deployed into tenant namespaces rather than `envoy-gateway-system`. Without this configuration, EG-106 will fail.

**Acceptance Criteria:**
- [ ] ArgoCD Application `envoy-gateway-controller` synced and healthy
- [ ] `envoy-gateway` Deployment running with 1 replica in `envoy-gateway-system`
- [ ] Values file at `platform/envoy-gateway/system/helm-values.yaml` committed to platform repo
- [ ] Values file explicitly sets `deploy.type: GatewayNamespace` — this is a hard AC, not a note
- [ ] Values file specifies explicit resource requests and limits for the controller (e.g., `requests: {cpu: 100m, memory: 128Mi}`, `limits: {cpu: 500m, memory: 512Mi}`)
- [ ] Controller startup log confirms healthy init: pod logs show `"Starting manager"` and `"Watching Gateways"` strings with no ERROR-level log entries within 60 seconds of the pod reaching Ready state
- [ ] Sync wave set to `-1` (after CRDs, before GatewayClass)
- [ ] Image pulled from ACR mirror — confirmed in pod events

**Notes:**
`deploy.type: GatewayNamespace` is the architectural linchpin for the one-proxy-per-tenant-namespace model. This is distinct from the default `deploy.type: Shared`, which runs all proxies in `envoy-gateway-system`. If this value is missing or wrong, EG-106 will observe proxy pods in `envoy-gateway-system` and the story will be blocked. Treat any controller ERROR log within 60 seconds of pod Ready as a blocking issue — do not mark the story done with startup errors present.

---

### EG-103: Deploy GatewayClass and EnvoyProxy Configuration

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-102

**Prerequisites:**
Network team has confirmed and documented the AKS subnet name for the internal load balancer — this confirmation must be received before the story enters the sprint. Do not start this story without network team subnet sign-off.

**Description:**
Deploy the cluster-scoped `GatewayClass` and `EnvoyProxy` configuration resources via ArgoCD Kustomize Application. The `EnvoyProxy` resource configures proxy fleet sizing, service type (Internal LoadBalancer for dev), AKS zone spreading, and Prometheus metrics endpoint. The `GatewayClass` references the Envoy Gateway controller and must reach `Accepted: True` status before any Gateways can be created.

**Acceptance Criteria:**
- [ ] ArgoCD Application `envoy-gateway-resources` synced and healthy
- [ ] `GatewayClass` named `platform-gateway` reaches status condition `Accepted: True`
- [ ] `EnvoyProxy` resource present in `envoy-gateway-system` and references the `platform-gateway` GatewayClass
- [ ] Proxy service type set to `LoadBalancer` with annotation `service.beta.kubernetes.io/azure-load-balancer-internal: "true"`
- [ ] ILB subnet annotation (`service.beta.kubernetes.io/azure-load-balancer-ipv4-subnet`) references the network-team-confirmed subnet name
- [ ] `EnvoyProxy` resource configures zone spreading via `provider.kubernetes.envoyDeployment.pod.topologySpreadConstraints` targeting AKS availability zones
- [ ] Prometheus metrics endpoint is exposed and responding: `kubectl exec` from within the cluster can reach `http://<proxy-pod-ip>:9902/stats/prometheus` and receive a non-empty response
- [ ] Resources committed to `platform/envoy-gateway/system/` in platform repo
- [ ] Sync wave set to `0` (after controller)

**Notes:**
The ILB subnet annotation must match the subnet used by Kong's existing LB service in dev. Mismatched subnets will result in IP allocation failures. Zone spreading configuration requires `topologyKey: topology.kubernetes.io/zone` with `maxSkew: 1` and `whenUnsatisfiable: DoNotSchedule` for production parity — use `whenUnsatisfiable: ScheduleAnyway` for dev if zone capacity is limited. The Prometheus metrics port for proxy pods is 9902 in Envoy Gateway v1.8.0 (distinct from the admin port 19001 used by the controller).

---

### EG-104: Deploy Redis for Global Rate Limiting

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 2
**Depends on:** EG-102

**Prerequisites:**
None beyond EG-102.

**Description:**
Deploy a Redis instance in `envoy-gateway-system` for use as the global rate limit backend. For the PoC, a single-replica in-cluster Redis without persistence is acceptable. The Envoy Gateway controller values must reference this Redis endpoint for rate limiting decisions.

**Acceptance Criteria:**
- [ ] Redis `Deployment` and `Service` running in `envoy-gateway-system`
- [ ] Redis deployed without persistence: no `PersistentVolumeClaim` created; `persistentVolumeClaim` field absent or explicitly set to `none` in Kustomize config
- [ ] Controller `helm-values.yaml` references `redis://redis.envoy-gateway-system.svc.cluster.local:6379` for rate limit backend
- [ ] Redis connectivity confirmed with specific command: `kubectl exec -n envoy-gateway-system <redis-pod> -- redis-cli -h redis.envoy-gateway-system.svc.cluster.local PING` returns `PONG`
- [ ] Controller-to-Redis connectivity confirmed: Envoy Gateway controller logs show successful Redis connection (no Redis connection error entries at startup)
- [ ] Resources managed via Kustomize under `platform/envoy-gateway/system/redis/`

**Notes:**
**Redis fail-open behavior:** If the in-cluster Redis becomes unavailable during the PoC, rate limiting fails open — all requests pass regardless of configured limits. This is intentional Envoy Gateway behavior and is not a bug. The team should expect this behavior during Redis pod restarts or OOMKills. Do not file a bug report if rate limits stop being enforced during a Redis disruption event; check Redis pod health first. Production deployment will use Azure Cache for Redis with high availability, eliminating this risk.

---

### EG-105: Add Kyverno Policy to Enforce GatewayClass Usage

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-103

**Prerequisites:**
Kyverno controller is running and healthy in the dev cluster — confirm with `kubectl get pods -n kyverno` before starting. If Kyverno is not present, this story is blocked and requires a separate infra prerequisite story.

**Description:**
Deploy a Kyverno `ClusterPolicy` in Enforce mode that enforces all `Gateway` resources in the cluster reference the `platform-gateway` GatewayClass and cannot be created in system namespaces. The policy prevents operator teams from creating Gateways that bypass platform controls or land in restricted namespaces.

**Acceptance Criteria:**
- [ ] `ClusterPolicy` named `enforce-gateway-class` deployed and in `Ready` state
- [ ] Policy is in **Enforce mode** (not Audit) — confirmed by `kubectl get clusterpolicy enforce-gateway-class -o jsonpath='{.spec.validationFailureAction}'` returning `Enforce`
- [ ] Creating a `Gateway` with an incorrect `gatewayClassName` is blocked with rejection error message: `"Gateway must use gatewayClassName: platform-gateway"`
- [ ] Creating a `Gateway` in `envoy-gateway-system`, `kube-system`, or `argocd` namespaces is blocked with rejection error message: `"Gateway creation is not permitted in system namespaces"`
- [ ] Policy committed to `platform/kyverno/enforce-gateway-class.yaml` in platform repo
- [ ] Kong non-regression confirmed: after policy deployment, `kubectl get pods -n kong` shows all Kong pods in Running state, and Kong routes continue to serve HTTP 200 responses — the policy must not affect Kong resources

**Notes:**
The Kyverno policy must use `spec.validationFailureAction: Enforce` (not `Audit`). Starting in Audit mode and forgetting to switch to Enforce is a common mistake that leaves the platform unprotected. The specific rejection messages listed in the AC are important — the operator team (Epic 3) needs to know the exact error format when their reconciler creates `Gateway` resources during development (EG-302/EG-303). Document the expected rejection messages in the policy's `message` field so the operator team sees them in controller logs.

---

### EG-106: Deploy Dev Tenant Gateway Resource and Validate ILB Provisioning

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 5
**Depends on:** EG-103, EG-104

**Prerequisites:**
Subnet CIDR for the AKS ILB subnet documented in the story or linked reference. Network team confirmation received (from EG-103 prerequisite). EG-105 deployed so GatewayClass enforcement is active.

**Description:**
Deploy a `Gateway` resource for a single dev tenant namespace and validate that GatewayNamespace mode is working correctly: Envoy Gateway must provision an Envoy proxy `Deployment` and an Azure Internal Load Balancer `Service` in the tenant namespace, not in `envoy-gateway-system`. Confirming the ILB receives a private VNet IP from the correct subnet completes the infrastructure chain needed for Epic 2.

**Acceptance Criteria:**
- [ ] `Gateway` resource created in dev tenant namespace referencing `platform-gateway` GatewayClass
- [ ] Envoy proxy `Deployment` running in tenant namespace (not in `envoy-gateway-system`) within 2 minutes of Gateway creation
- [ ] Proxy Deployment name matches pattern `envoy-<gateway-name>-<namespace>` — confirm exact name with `kubectl get deploy -n <tenant-namespace>`
- [ ] Proxy `Service` of type `LoadBalancer` created in tenant namespace
- [ ] `EXTERNAL-IP` on the proxy Service is a private VNet IP (not `<pending>`) within the expected AKS ILB subnet CIDR (CIDR documented as story prerequisite)
- [ ] Subnet CIDR match confirmed: `EXTERNAL-IP` falls within the documented subnet range
- [ ] Kong non-regression confirmed: Kong LB service `EXTERNAL-IP` is unchanged from before Gateway creation, and Kong routes continue to return HTTP 200
- [ ] **Failure-mode blocking condition:** If proxy pods appear in `envoy-gateway-system` namespace instead of the tenant namespace, this story is immediately blocked — return to EG-102 and verify `deploy.type: GatewayNamespace` is set in the controller values file. Do not proceed until proxy pods land in the tenant namespace.

**Notes:**
This story is the first validation that GatewayNamespace mode is functioning correctly in this AKS environment. This mode has not been previously validated here — allocate buffer for unexpected behavior. The 5-point estimate reflects this elevated risk. For the PoC, 1 replica on the proxy Deployment is acceptable — production sizing will add replicas and a PodDisruptionBudget.

---

## Epic 2: Ingress Chain Integration

*Stories covering App Gateway backend pool reconfiguration and end-to-end traffic validation. Owner persona: Senior Infrastructure Engineer.*

---

### EG-201: Configure App Gateway Backend Pool to Target Envoy ILB

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-106

**Prerequisites:**
Confirm that `GET /healthz/ready` on port 19001 responds with HTTP 200 from within the AKS VNet before configuring the App Gateway health probe — perform this verification as a spike step before the story enters the sprint. Do not configure the probe targeting an endpoint that has not been confirmed reachable.

**Description:**
Reconfigure the Azure Application Gateway dev backend pool to add the Envoy ILB private IP as a backend target alongside the existing Kong LB IP. Both backends should be present initially to allow parallel testing before Kong cutover. The configuration change must be committed to the platform repo as an executable script — not documentation alone.

**Acceptance Criteria:**
- [ ] Envoy ILB IP added as a backend target in App Gateway dev backend pool
- [ ] App Gateway health probe configured for `GET /healthz/ready` on port 19001
- [ ] Health probe verification: `/healthz/ready` confirmed to respond with HTTP 200 from within the AKS VNet before probe is configured in App Gateway
- [ ] Envoy backend shows **Healthy** status in App Gateway backend health view — not `Unknown` or `Unhealthy`
- [ ] Kong backend remains active and in Healthy status (no disruption to existing Kong traffic path)
- [ ] Configuration change expressed as an **Azure CLI script or Bicep delta committed to the platform repo** at `platform/scripts/appgw-add-envoy-backend.sh` (or equivalent Bicep file) — documentation alone is not acceptable

**Notes:**
The health probe path `/healthz/ready` on port 19001 is the Envoy admin/management port. Confirm this endpoint is accessible from the App Gateway subnet — NSG rules may need to allow traffic from the App Gateway subnet to AKS node IPs on port 19001. Adding the Envoy backend alongside Kong (not replacing it) is intentional — this enables side-by-side traffic testing in EG-202 before Kong routes are cut over. Do not remove the Kong backend during this story.

---

### EG-202: Deploy a Test HTTPRoute and Validate End-to-End Traffic Through App Gateway

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-201

**Prerequisites:**
None beyond EG-201.

**Description:**
Deploy an `HTTPRoute` routing traffic from the dev tenant hostname to a test echo backend. Validate that a request originating through the full chain — Imperva → App Gateway → Envoy ILB → echo service — is handled correctly. Note that `ClientTrafficPolicy` (EG-203) has not yet been applied at this stage; the client IP visible in Envoy access logs will be the App Gateway IP, not the original client IP. This is expected pre-EG-203 behavior and should be documented, not treated as a defect.

**Acceptance Criteria:**
- [ ] `HTTPRoute` deployed in dev tenant namespace routing dev tenant hostname to echo backend
- [ ] `curl -H "Host: <dev-tenant-hostname>" https://<appgw-ip>/` through the full chain returns HTTP 200 from echo backend
- [ ] Request header propagation confirmed: `X-Forwarded-For` header is present in echo response and contains the test client's IP or Imperva IP (not empty); `X-Request-ID` header is present and non-empty in the echo response
- [ ] **Pre-EG-203 client IP behavior documented:** At this stage, Envoy access logs will show the App Gateway IP as the client IP, not the original client IP. This is expected because `ClientTrafficPolicy` (which configures trusted hops) has not yet been applied. Document this observed behavior in the story completion notes.
- [ ] Unhappy path confirmed: a `curl` request to an undefined path (e.g., `/undefined-path-404-test`) returns HTTP 404 from the echo backend, not HTTP 502 from App Gateway — confirms Envoy is routing to the backend rather than returning its own error
- [ ] No ERROR-level entries in Envoy Gateway controller logs during test traffic

**Notes:**
The client IP AC sequencing is intentional. At EG-202, `ClientTrafficPolicy` is not yet deployed, so Envoy cannot strip the App Gateway IP from XFF and identify the original client. The correct client IP AC belongs in EG-203. Recording the pre-EG-203 behavior here creates a useful baseline for the XFF validation in EG-203. The unhappy path test (404 from echo, not 502 from App Gateway) is important for confirming that the App Gateway is correctly passing traffic to Envoy and Envoy is routing it to the backend — a 502 at this stage would indicate App Gateway is not reaching the Envoy ILB.

---

### EG-203: Validate and Configure X-Forwarded-For Trust Chain

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 2
**Depends on:** EG-202

**Prerequisites:**
None beyond EG-202.

**Description:**
Configure `ClientTrafficPolicy` with `numTrustedHops: 2` (Imperva + App Gateway) to ensure Envoy correctly identifies the real client IP from the XFF header chain. Validate that forged XFF headers are not trusted. Commit an XFF trust chain runbook documenting the configuration for use during tenant migration.

**Acceptance Criteria:**
- [ ] `ClientTrafficPolicy` deployed in dev tenant namespace targeting the dev tenant Gateway specifically — **not** the `GatewayClass` (a GatewayClass-scoped policy would affect all Gateways cluster-wide)
- [ ] Policy targeting scope confirmed: `kubectl get clienttrafficpolicy -n <tenant-namespace>` shows the policy with `targetRef.kind: Gateway` (not `GatewayClass`)
- [ ] After policy deployment, Envoy access logs show the real client IP (or Imperva IP) as the client IP, not the App Gateway IP — confirming `numTrustedHops: 2` is working
- [ ] Forged header rejection confirmed: `curl -H "X-Forwarded-For: 1.2.3.4" <dev-tenant-hostname>` result shows Envoy access log records the App Gateway IP as the client IP, **not** `1.2.3.4` — the forged header is discarded
- [ ] XFF trust chain runbook committed to `docs/runbooks/xff-trust-chain.md` covering: `numTrustedHops` value, rationale (Imperva + App Gateway = 2 hops), and the Phase 2 note that this drops to 1 when App Gateway is removed

**Notes:**
`numTrustedHops` must match the number of trusted proxies in the chain. Imperva + App Gateway = 2. Targeting the GatewayClass (instead of a specific Gateway) would apply the policy to all Gateways in the cluster, including any future Gateways that may have a different proxy chain. Always scope `ClientTrafficPolicy` to a specific Gateway. Phase 2 note: when App Gateway is removed from the chain, `numTrustedHops` drops from 2 to 1 (Imperva only). This runbook should be referenced in the Phase 2 migration plan.

---

### EG-210: Validate Lua Extension via EnvoyExtensionPolicy

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-202

**Prerequisites:**
None beyond EG-202. Envoy Gateway v1.8.0 must be installed (EG-102 complete).

**Description:**
Envoy Gateway v1.5 added Lua scripting support via `EnvoyExtensionPolicy`. This is a lower-barrier alternative to WASM for simple request/response transformations. The PoC should validate whether Lua meets the operator's custom transformation needs, which could avoid a WASM development investment. Deploy a simple `EnvoyExtensionPolicy` with a Lua script that adds a response header and confirm it executes correctly on a live request through the ingress chain.

**Acceptance Criteria:**
- [ ] `EnvoyExtensionPolicy` deployed in dev tenant namespace with a Lua script that adds response header `x-lua-test: envoy-gateway-lua-ok`
- [ ] Live request through the ingress chain (`curl -i <dev-tenant-hostname>`) returns the response header `x-lua-test: envoy-gateway-lua-ok` — confirming Lua filter executed in the request pipeline
- [ ] Lua filter does not break the existing HTTPRoute — echo backend still returns HTTP 200 and all headers from EG-202 remain intact
- [ ] `EnvoyExtensionPolicy` correctly scoped to the dev tenant HTTPRoute (not the entire Gateway)
- [ ] Lua capability scope and limitations documented at `docs/operator/lua-extension-capability.md` covering: what transformations are possible, API surface available in Lua scripts, per-request access to headers/body, known limitations vs WASM

**Notes:**
This story informs the Epic 3 operator design decision: if Lua meets the transformation requirements (simple header injection, request ID stamping, basic routing decisions), the operator does not need to generate WASM filter configuration. If Lua is insufficient, WASM becomes a required investment and that scope must be added to Epic 3. The capability document committed as part of this story is the input to EG-502's WASM vs Lua assessment. `EnvoyExtensionPolicy` is an Envoy Gateway extension CRD installed by EG-101. The Lua runtime executes in the Envoy proxy data plane — performance overhead for simple header operations is negligible.

---

## Epic 3: Operator Translation Rewrite

*Stories covering the rewrite of the custom operator from Konnect API targeting to Kubernetes API server resource generation. Owner persona: Senior Developer.*

---

### EG-301: Audit Existing Operator — Document Input CRD Schema and Current Output Model

**Type:** Story
**Persona:** Senior Developer
**Points:** 3
**Depends on:** none

**Prerequisites:**
Access to existing operator codebase and current CRD definitions.

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

### EG-302: Scaffold New Operator Reconciler Targeting Kubernetes API Server

**Type:** Story
**Persona:** Senior Developer
**Points:** 5
**Depends on:** EG-301

**Prerequisites:**
EG-302a (RBAC story) must be completed or in-flight — the operator ServiceAccount must exist before runtime verification of EG-303 through EG-307.

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

EG-302a (RBAC) must be completed or at minimum in-flight before EG-303 starts. The operator ServiceAccount cannot write `HTTPRoute` or `SecurityPolicy` resources to the cluster without the `ClusterRole` defined in EG-302a.

---

### EG-302a: Operator RBAC — ClusterRole and ClusterRoleBinding for Operator ServiceAccount

**Type:** Story
**Persona:** Senior Developer
**Points:** 1
**Depends on:** EG-302

**Prerequisites:**
Operator namespace and ServiceAccount name confirmed from EG-302 scaffold.

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

### EG-303: Implement HTTPRoute Translation

**Type:** Story
**Persona:** Senior Developer
**Points:** 5
**Depends on:** EG-302, EG-302a

**Prerequisites:**
EG-106 (dev tenant Gateway provisioned in cluster for integration test).

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

### EG-304: Implement SecurityPolicy Translation (JWT + OIDC)

**Type:** Story
**Persona:** Senior Developer
**Points:** 5
**Depends on:** EG-303

**Prerequisites:**
EG-302a (RBAC — `securitypolicies.gateway.envoyproxy.io` write permission required).

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

### EG-305: Implement BackendTrafficPolicy Translation (Rate Limiting + Circuit Breaking)

**Type:** Story
**Persona:** Senior Developer
**Points:** 8
**Depends on:** EG-303

**Prerequisites:**
EG-302a (RBAC — `backendtrafficpolicies.gateway.envoyproxy.io` write permission required); EG-104 (Redis deployed); EG-106 (exactly one Gateway per tenant namespace confirmed).

**Description:**
Implement the translation logic that converts the tenant CRD's traffic policy configuration — rate limits, timeouts, retries, and circuit breaking — into a `BackendTrafficPolicy` resource. This is the highest-risk story in the epic due to GitHub issue #8707 in `envoyproxy/gateway`: global rate limiting via `BackendTrafficPolicy` only applies to the first listener on a Gateway. The required workaround is one Gateway per tenant namespace (single listener). All test Gateways must be confirmed to have exactly one listener before rate limiting tests are run.

**Acceptance Criteria:**
- [ ] **Bug #8707 guard:** Before writing or running any rate limiting tests, run `kubectl get gateway -o yaml` in the dev namespace and confirm the test Gateway has exactly one listener. If it has HTTP + HTTPS listeners (or any multi-listener configuration), rate limiting will silently apply only to the first listener. Document the listener count in the test run log.
- [ ] **One-Gateway-per-namespace:** The operator generates exactly one Gateway per tenant namespace. Verify this is consistent with the Gateway provisioned by EG-106. The one-Gateway-per-namespace architecture is the required workaround for GitHub issue #8707 and is a hard architectural constraint for the PoC.
- [ ] Operator generates a `BackendTrafficPolicy` per `HTTPRoute` where traffic policy is configured in the tenant CRD
- [ ] `BackendTrafficPolicy` correctly sets: global rate limit rules keyed on `x-tenant-id` header value, timeout, retry policy
- [ ] Circuit breaker configured using `spec.circuitBreaker` with fields `maxConnections`, `maxPendingRequests`, `maxParallelRequests` — integration test fixture values: `maxConnections: 100`, `maxPendingRequests: 50`, `maxParallelRequests: 25`
- [ ] **Redis NOT in BackendTrafficPolicy:** Operator does not generate any Redis connection configuration in the `BackendTrafficPolicy` spec — Redis is sourced from the `EnvoyProxy` CRD configuration only. After reconcile, run `kubectl get backendtrafficpolicy <name> -o yaml` and confirm no Redis host, port, or connection fields appear in the spec.
- [ ] `ownerReferences` field on `BackendTrafficPolicy` contains the correct GVK and UID of the parent tenant CRD
- [ ] Idempotency test: apply the same tenant CRD twice (two sequential reconcile cycles); confirm `kubectl get backendtrafficpolicy` returns exactly 1 resource (not 2); confirm no spurious update events in controller logs between the two reconciles
- [ ] Integration test: apply tenant CRD with rate limit config, verify `BackendTrafficPolicy` created with correct limit rules and circuit breaker thresholds
- [ ] Redis fail-open test: bring Redis down (scale Redis `Deployment` to 0 replicas), apply rate limit config, confirm requests pass through and are not rejected with HTTP 500; rate limiting must fail open per Envoy Gateway behavior — document this behavior in the operator README under a "Known Behaviors" section

**Notes:**
This story is 8 points — elevated due to GitHub issue #8707 complexity, the Redis fail-open test requirement, and the one-Gateway-per-namespace architectural constraint that must be verified before any rate limiting validation is meaningful.

`BackendTrafficPolicy` exists in two places: as a Gateway API Experimental resource and as an Envoy Gateway extension under `gateway.envoyproxy.io`. Confirm which API group and version is in use for rate limiting and circuit breaking in v1.8.0 CRDs before writing Go struct imports. The Envoy Gateway extension version has additional fields not present in the standard experimental resource.

Redis fail-open is not a bug — it is documented Envoy Gateway behavior. If Redis is unavailable, the rate limiting filter passes all requests. The operator should still generate and apply `BackendTrafficPolicy` regardless of Redis availability. The fail-open test must be part of the integration test suite so the team is not surprised when Redis goes down in dev.

GitHub issue #8707 reference: `github.com/envoyproxy/gateway/issues/8707`. Check the issue for status in v1.8.0 before the PoC — if it has been resolved, remove the one-listener constraint from test configurations and document the resolution.

---

### EG-306: Implement ESO ExternalSecret Generation for OIDC Client Secrets

**Type:** Story
**Persona:** Senior Developer
**Points:** 3
**Depends on:** EG-304

**Prerequisites:**
ESO `ClusterSecretStore` must exist in dev cluster — run `kubectl get clustersecretstore` before starting; if not present, story is blocked pending infra work.

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

### EG-307: Operator Integration Test — Full Reconcile Against Dev Cluster

**Type:** Story
**Persona:** Senior Developer
**Points:** 5
**Depends on:** EG-303, EG-304, EG-305, EG-306, EG-302a, EG-106, EG-201, EG-202

**Prerequisites:**
EG-106 (dev tenant Gateway provisioned and ILB IP assigned); EG-201 (App Gateway backend pool targeting Envoy ILB); EG-202 (test HTTPRoute validated end-to-end); operator RBAC verified via EG-302a. All four must be marked Done in the sprint board before starting this story.

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
- [ ] **Garbage collection with timeout:** Before deleting the tenant CRD, list all resources with `ownerReferences` pointing to the test CRD instance UID. Delete the CRD. Within 30 seconds, all owned resources (HTTPRoute, SecurityPolicy, BackendTrafficPolicy, ExternalSecret) must be gone — confirm with `kubectl get` for each type. If any resource persists beyond 30 seconds, the story fails.
- [ ] No ERROR-level log entries in operator structured logs during the full lifecycle (apply → traffic test → delete → GC)

**Notes:**
"Full chain" scope for this PoC: the test validates App Gateway → Envoy ILB → service. Imperva is upstream of App Gateway and its traffic is not required for PoC sign-off. Document this explicitly in the test run record so the PoC sign-off in EG-501 has accurate scope context.

The 30-second GC timeout is a hard bound for the test environment. If GC is not completing within 30 seconds, investigate whether owner references were set correctly on all four resource types — this is the most common cause of GC failure.

---

## Epic 4: Observability

*Stories covering metrics, logging, and dashboard integration with Azure Monitor Workspace and Datadog. Owner persona: Senior Infrastructure Engineer.*

---

### EG-401: Validate Envoy Gateway Metrics in Azure Monitor Workspace

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-102

**Prerequisites:**
`ama-metrics` DaemonSet running in dev cluster. Azure Monitor Workspace connected to dev cluster.

**Description:**
Confirm that Envoy Gateway controller and proxy pod metrics are scraped by `ama-metrics` and visible in Azure Monitor Workspace. Validate the key metrics needed for platform observability including the rate limit counter, which requires triggering an actual rate limit event to confirm the metric is emitted.

**Acceptance Criteria:**
- [ ] `ama-metrics` scrapes Envoy Gateway **controller** metrics on port `19001` — confirm with `kubectl logs -n kube-system <ama-metrics-pod>` showing no scrape errors for the controller endpoint
- [ ] `ama-metrics` scrapes per-tenant **proxy pod** Prometheus metrics on port `9902` — this is the Envoy proxy pod Prometheus metrics port in v1.8.0 (distinct from the admin port 19001 used by the controller)
- [ ] Scrape configuration approach: **pod annotations** (not ServiceMonitor) — annotation-based scrape config committed to `platform/envoy-gateway/system/envoyproxy.yaml` under `provider.kubernetes.envoyDeployment.pod.annotations`
- [ ] Key metrics confirmed visible in Azure Monitor Workspace: `envoy_http_downstream_rq_total`, `envoy_http_downstream_rq_time`, `envoy_cluster_upstream_rq_total`, `envoy_ratelimit_over_limit`
- [ ] Rate-limit trigger test performed: send requests exceeding the configured rate limit; confirm `envoy_ratelimit_over_limit` metric increments and is visible in AMW — this metric will not appear unless rate limiting is triggered
- [ ] Metrics confirmed tagged with namespace label matching the dev tenant namespace — filter by namespace label in AMW to confirm scoping works
- [ ] No scrape errors in `ama-metrics` logs for Envoy endpoints

**Notes:**
Port clarification: the Envoy Gateway **controller** exposes its own metrics on port 19001 (the controller management port). Envoy **proxy pods** (the data plane, running in tenant namespaces) expose Prometheus metrics on port 9902. These are two distinct scrape targets requiring two distinct scrape configurations. Verify port 9902 is correct for v1.8.0 proxy pods by checking the `EnvoyProxy` CRD status or the proxy pod port list. Pod annotations are used via the `EnvoyProxy` CRD to inject scrape annotations onto proxy pods — this is the standard approach for dynamically-created proxy pods that cannot have a static ServiceMonitor.

---

### EG-402: Create Grafana Dashboard for Envoy Gateway PoC Validation

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 2
**Depends on:** EG-401

**Prerequisites:**
Azure Managed Grafana dev workspace accessible. AMW data source configured in Grafana.

**Description:**
Create a Grafana dashboard in Azure Managed Grafana covering the metrics needed to validate the PoC. This is a PoC validation dashboard — not a production dashboard. The dashboard must show live data from actual test traffic, not just be structurally correct.

**Acceptance Criteria:**
- [ ] Dashboard panels: request rate, error rate (4xx/5xx), p99 latency, rate limit hits (`envoy_ratelimit_over_limit`), active connections
- [ ] Dashboard scoped to dev tenant namespace via label filter using the `namespace` label key (confirm label name emitted by Envoy Gateway metrics against AMW metric explorer before hardcoding)
- [ ] Dashboard committed to platform repo at **`platform/grafana/dashboards/envoy-gateway-poc.json`**
- [ ] Dashboard JSON includes a stable `uid` field (e.g., `"uid": "envoy-gateway-poc"`) to prevent duplicate dashboard creation on re-import
- [ ] Dashboard visible in Azure Managed Grafana dev workspace and provisioned via the platform repo JSON (not manually created in the UI)
- [ ] Live-data AC: at least one panel shows **non-zero data** from a test request through the ingress chain — confirm by sending a test request and observing the request rate panel increment

**Notes:**
The stable `uid` field in the dashboard JSON prevents Grafana from creating a duplicate dashboard every time the JSON is re-provisioned. Without a stable `uid`, re-provisioning creates a new dashboard with a new UID each time. The namespace label key used for scoping must match the actual label emitted by Envoy Gateway proxy pod metrics — verify this against the AMW metric explorer before building panel queries. Common values are `namespace` or `kubernetes_namespace`.

---

### EG-403: Configure Datadog Tracing Integration via EnvoyProxy CRD

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 5
**Depends on:** EG-103

**Prerequisites:**
Datadog Agent DaemonSet confirmed running in dev cluster with APM enabled. Confirm Datadog Agent namespace and service name with `kubectl get svc -n datadog-agent`.

**Description:**
Configure Envoy Gateway to emit distributed traces to the Datadog Agent DaemonSet by adding a `telemetry.tracing` block to the `EnvoyProxy` CRD. Datadog is a native supported tracer in Envoy — no custom code required. Traces must be enriched with tenant context via the `x-tenant-id` request header mapped to the `platform.tenant` span tag.

**Acceptance Criteria:**
- [ ] `EnvoyProxy` CRD updated with `telemetry.tracing` block targeting Datadog Agent service at `http://datadog-agent.datadog-agent.svc.cluster.local:8126`
- [ ] Datadog Agent endpoint reachability confirmed before applying config: `kubectl exec -n <tenant-namespace> <proxy-pod> -- curl -s http://datadog-agent.datadog-agent.svc.cluster.local:8126` succeeds without connection refused
- [ ] Sampling rate set to `10` (10%, head-based sampling configured in `EnvoyProxy` CRD `samplingRate` field — not tail-based)
- [ ] Custom trace tags configured: `k8s.pod.name` (from `ENVOY_POD_NAME` env var), `k8s.namespace.name` (from `ENVOY_POD_NAMESPACE` env var), `platform.tenant` (from `x-tenant-id` request header)
- [ ] Traces visible in Datadog APM for the dev tenant service after sending test traffic through the ingress chain
- [ ] Distributed trace context headers (`x-datadog-trace-id`, `x-datadog-parent-id`, `x-datadog-sampling-priority`) are propagated to upstream services and visible in the echo backend response headers
- [ ] Config committed to `platform/envoy-gateway/system/envoyproxy.yaml`

**Configuration reference:**
```yaml
telemetry:
  tracing:
    samplingRate: 10
    provider:
      type: Datadog
      backendRefs:
        - name: datadog-agent
          namespace: datadog-agent
          port: 8126
    customTags:
      "k8s.pod.name":
        type: Environment
        environment:
          name: ENVOY_POD_NAME
      "k8s.namespace.name":
        type: Environment
        environment:
          name: ENVOY_POD_NAMESPACE
      "platform.tenant":
        type: RequestHeader
        requestHeader:
          name: x-tenant-id
```

**Notes:**
Confirm the Datadog Agent service name and namespace in the dev cluster before hardcoding — the service name `datadog-agent` and namespace `datadog-agent` are defaults but may differ in this environment. The `platform.tenant` custom tag sourced from the `x-tenant-id` request header enables per-tenant trace filtering in Datadog APM. At 10% sampling, not all requests will produce traces — send at least 20+ test requests to confirm traces appear in APM.

---

### EG-404: Configure Datadog Metrics Collection via Agent Autodiscovery

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-403

**Prerequisites:**
EG-403 complete. Datadog Agent confirmed running with metrics collection enabled.

**Description:**
Configure Datadog Agent autodiscovery annotations on Envoy proxy pods so the Agent scrapes Envoy's Prometheus metrics endpoint and surfaces them in Datadog Metrics Explorer. Annotations are applied via the `EnvoyProxy` CRD pod annotations field — proxy pods are managed by Envoy Gateway and cannot be directly annotated. Datadog has a native Envoy integration with a built-in dashboard.

**Acceptance Criteria:**
- [ ] Autodiscovery annotations added to proxy pod template via `EnvoyProxy` CRD `provider.kubernetes.envoyDeployment.pod.annotations` field
- [ ] Proxy pod Prometheus metrics endpoint targeted at port `9902` (not 19001 — 9902 is the Envoy proxy pod Prometheus metrics port)
- [ ] Datadog Agent scraping confirmed: `kubectl exec -n datadog-agent <datadog-agent-pod> -- agent status` output shows the Envoy check running without errors for the dev tenant proxy pod
- [ ] Core Envoy metrics visible in Datadog Metrics Explorer: `envoy.http.downstream_rq_total`, `envoy.http.downstream_rq_time`, `envoy.cluster.upstream_rq_total`, `envoy.ratelimit.over_limit`
- [ ] Out-of-the-box Envoy integration dashboard visible and populated in Datadog account (Integrations → Envoy)
- [ ] Metrics tagged with `kube_namespace` and `pod_name` by the Datadog Agent automatically
- [ ] Config committed to `platform/envoy-gateway/system/envoyproxy.yaml`

**Configuration reference:**
```yaml
provider:
  kubernetes:
    envoyDeployment:
      pod:
        annotations:
          ad.datadoghq.com/envoy.checks: |
            {
              "envoy": {
                "instances": [{
                  "openmetrics_endpoint": "http://%%host%%:9902/stats/prometheus"
                }]
              }
            }
          ad.datadoghq.com/envoy.logs: |
            [{
              "source": "envoy",
              "service": "envoy-gateway",
              "log_processing_rules": [{
                "type": "multi_line",
                "name": "log_start_with_date",
                "pattern": "\\[\\d{4}-\\d{2}-\\d{2}"
              }]
            }]
```

**Notes:**
The `%%host%%` template is resolved by the Datadog Agent at runtime to the pod IP — this is standard Datadog autodiscovery syntax, not a typo. The metrics endpoint port is `9902` (Envoy proxy pod Prometheus port) — the original story draft used `19001` which is the admin/controller port and would be incorrect. Verify port 9902 is correct for the v1.8.0 proxy pods before applying. The `ad.datadoghq.com/envoy.logs` annotation configures log collection alongside metrics — both are set here to avoid a separate update pass.

---

### EG-405: Configure Datadog Access Log Collection and Validate Log Pipeline

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-404

**Prerequisites:**
EG-404 complete. Datadog log management enabled in the Datadog account.

**Description:**
Validate that Envoy proxy access logs flowing to stdout are collected by the Datadog Agent, parsed by Datadog's native Envoy log processing pipeline, and surfaced as structured log events in Datadog Log Management. The `x-tenant-id` header must be included in the access log format via the `EnvoyProxy` CRD to enable per-tenant log filtering.

**Acceptance Criteria:**
- [ ] Envoy access logs visible in Datadog Log Management with `source:envoy` tag
- [ ] Datadog log pipeline correctly parses structured fields: HTTP method, path, status code, response time, upstream host, `x-request-id`, `x-forwarded-for`
- [ ] `EnvoyProxy` CRD access log format updated to include `%REQ(X-TENANT-ID)%` — this is required for per-tenant filtering; confirm the format string is committed to `platform/envoy-gateway/system/envoyproxy.yaml`
- [ ] `x-tenant-id` header visible as a structured field in Datadog log events after the format update
- [ ] Per-tenant log filtering confirmed working in Datadog Log Explorer: query `source:envoy @http.headers.x-tenant-id:tenant-a` returns access log entries for test traffic sent with that tenant ID
- [ ] No log collection errors in Datadog Agent pod logs for the Envoy log source
- [ ] Security team confirmation obtained that full request header logging (including `x-tenant-id`) is acceptable from a data governance perspective for the dev environment — document confirmation received in story completion notes before enabling in non-dev environments

**Notes:**
The `x-tenant-id` header must be added to the `EnvoyProxy` CRD access log format configuration — it cannot be injected by the Datadog Agent. The access log format is configured under `telemetry.accessLog` in the `EnvoyProxy` CRD. The existing format likely already includes `%REQ(X-REQUEST-ID)%` and `%REQ(X-FORWARDED-FOR)%`; add `%REQ(X-TENANT-ID)%` alongside them. The data governance confirmation is required before this logging pattern is used outside dev — capturing it now in the story notes creates a clear record for the EG-502 retrospective.

---

### EG-406: Validate Per-Tenant Observability Breakdown in Datadog

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-403, EG-404, EG-405

**Prerequisites:**
EG-403, EG-404, and EG-405 all complete. Test traffic sent through the ingress chain with `x-tenant-id` header set to a known value (e.g., `tenant-a`).

**Description:**
Validate that all three Datadog integration surfaces — traces, metrics, and logs — can be filtered and correlated per tenant using the `platform.tenant` span tag, namespace-based metric filtering, and `x-tenant-id` log field. Produce a validation document as evidence for PoC sign-off and to serve as the cross-signal observability guide for tenant migration.

**Acceptance Criteria:**
- [ ] **Traces:** Datadog APM traces filterable by `platform.tenant:tenant-a` tag — confirm at least one complete trace visible with this filter
- [ ] **Metrics:** Datadog Metrics Explorer shows Envoy request metrics filterable by `kube_namespace:tenant-a` — confirm `envoy.http.downstream_rq_total` non-zero for the dev tenant namespace
- [ ] **Logs:** Datadog Log Explorer access logs filterable by `@http.headers.x-tenant-id:tenant-a` — confirm structured log entries visible with this filter
- [ ] **Cross-signal correlation:** Trace-to-log correlation working — given an `x-request-id` from a trace, the corresponding access log entry is findable in Datadog Log Management using that ID
- [ ] All three filters demonstrated against the same test request (same `x-tenant-id` value, same time window) to confirm end-to-end signal completeness
- [ ] Validation document committed to `docs/observability/datadog-envoy-integration.md` covering: what is captured per signal (traces/metrics/logs), how to filter per tenant for each signal, any gaps identified vs the current Kong/Datadog integration, and any gaps that are acceptable for the PoC vs those that need resolution before wave migration

**Notes:**
This story is the observability-parity equivalent of EG-501 (functional parity checklist). If there are gaps vs the current Kong Datadog integration, document them in the validation document rather than blocking PoC sign-off — gaps that can be resolved post-PoC should be noted as backlog items, not PoC blockers. The validation document is referenced by EG-502 go/no-go criteria. Cross-signal correlation via `x-request-id` is the primary diagnostic workflow — confirm the request ID appears consistently in traces (as a span tag), access logs (as a parsed field), and upstream service logs (propagated as a header by the HTTPRoute filter in EG-303).

---

## Epic 5: PoC Validation and Sign-off

*Stories covering structured validation, documentation, and the go/no-go decision. Owner persona: Platform Engineering Lead.*

---

### EG-501: PoC Validation — Functional Parity Checklist

**Type:** Story
**Persona:** Platform Engineering Lead
**Points:** 5
**Depends on:** EG-203, EG-307, EG-406

**Prerequisites:**
All Epic 1, 2, 3, and 4 stories complete. Test environment prepared with dev tenant, echo backend, and test credentials.

**Description:**
Execute a structured validation checklist comparing Envoy Gateway behavior against the current Kong behavior for the dev tenant. Document pass/fail results for each item as evidence for the go/no-go decision. The checklist includes functional parity items, GitHub issue #8707 validation, Lua extension capability confirmation, and SecurityPolicy proprietary resource acknowledgment.

**Acceptance Criteria:**
Checklist — document pass/fail with evidence for each item:

- [ ] **HTTP routing** — path-based routing works correctly: known paths return 200, unknown paths return 404 from backend (not 502 from App Gateway)
- [ ] **HTTPS termination** — TLS handled at Envoy listener: HTTPS request succeeds, HTTP request redirected or rejected per configured policy
- [ ] **JWT validation** — valid Entra ID JWT token passes (200), invalid/expired token returns 401, missing token returns 401
- [ ] **OIDC flow** — browser-based OIDC redirect to Entra ID completes and returns to application with authenticated session
- [ ] **Rate limiting** — requests within limit return 200; requests above configured limit return 429; counter resets after time window expires
- [ ] **X-Forwarded-For** — real client IP correctly identified through Imperva + App Gateway chain (`numTrustedHops: 2` configured in EG-203)
- [ ] **Circuit breaking** — upstream service failure (simulated by scaling echo to 0 replicas) triggers circuit open; recovery on scale-up
- [ ] **Header manipulation** — `x-tenant-id` header injected on all requests by HTTPRoute filter and visible in upstream service logs
- [ ] **CRD delete → resource cleanup** — deleting tenant CRD results in all generated resources (HTTPRoute, SecurityPolicy, BackendTrafficPolicy, ExternalSecret) removed within 30 seconds via owner reference garbage collection
- [ ] **App Gateway backend health** — Envoy backend shows Healthy in App Gateway backend health view throughout test period
- [ ] **Datadog traces** — APM traces visible and filterable by `platform.tenant:tenant-a` tag
- [ ] **Datadog metrics** — Envoy metrics visible in Datadog Metrics Explorer, filterable by namespace
- [ ] **Datadog logs** — access logs parsed and filterable by `x-tenant-id` field in Datadog Log Management
- [ ] **GitHub issue #8707 validation** — confirm rate limiting is tested against a single-listener Gateway configuration; document whether GitHub issue #8707 is resolved in v1.8.0 or whether the one-Gateway-per-namespace workaround is required; record result as a named finding in the validation document
- [ ] **Lua extension validation** — confirm `EnvoyExtensionPolicy` with a Lua script executes on a live request (EG-210 result); document Lua capability as viable or insufficient for operator transformation needs
- [ ] **SecurityPolicy proprietary resource acknowledgment** — team formally records that `SecurityPolicy` (`gateway.envoyproxy.io/v1alpha1`) is a proprietary Envoy Gateway resource not portable to standard Gateway API; team documents this as an accepted PoC constraint with understood migration implications

**Notes:**
Each checklist item must have a documented result: Pass, Fail, or Conditional Pass with conditions stated. A Conditional Pass is acceptable for PoC sign-off if conditions are minor and resolvable in the wave migration phase. Any Fail must be documented with: what failed, why, whether it is a blocker for migration, and proposed resolution. The checklist output feeds directly into EG-502. The GitHub issue #8707 finding is particularly important — if the bug is still present in v1.8.0, the one-Gateway-per-namespace architecture is a required constraint for all 100 tenants in wave migration, which has scaling and operational implications that must be quantified in EG-502.

---

### EG-502: PoC Retrospective and Go/No-Go Recommendation

**Type:** Story
**Persona:** Platform Engineering Lead
**Points:** 3
**Depends on:** EG-501

**Prerequisites:**
EG-501 complete with all checklist items documented. All three engineers (Senior Infrastructure Engineer, Senior Developer, Platform Engineering Lead) available for retrospective session.

**Description:**
Facilitate a PoC retrospective with the full team. Capture what worked, what gaps were found, effort accuracy vs estimates, and produce a written go/no-go recommendation for proceeding to phased tenant migration. The recommendation must address the specific architectural risks identified during the PoC — particularly the one-Gateway-per-namespace scaling question, SecurityPolicy non-portability, WASM vs Lua capability, and operator rebuild effort accuracy.

**Acceptance Criteria:**
- [ ] Retrospective session completed with all three engineers present
- [ ] Any capability gaps found during PoC documented with proposed resolution and estimated effort to resolve before wave migration
- [ ] Operator rewrite effort actuals vs original estimates recorded per story (use story point actuals from the sprint board)
- [ ] Written go/no-go recommendation produced covering one of: **Proceed**, **Proceed with conditions**, or **Do not proceed**

**Go/no-go recommendation must explicitly address all of the following criteria:**

- [ ] **One-Gateway-per-namespace viability at 100-tenant scale:** With 100 tenants, the platform will run 100 Gateway resources and 100 proxy Deployments. Document: observed resource overhead per proxy pod (CPU/memory), projected cluster resource consumption at 100 tenants, whether AKS node pool sizing is adequate, and whether horizontal scaling of the Envoy Gateway controller itself becomes a concern.
- [ ] **GitHub issue #8707 resolution status:** Was the bug resolved in v1.8.0, or is the one-Gateway-per-namespace workaround still required? If the workaround is required, confirm that the operator architecture (one Gateway per tenant namespace) is validated to work at PoC scale and document the path to 100-tenant validation.
- [ ] **SecurityPolicy non-portability risk acceptance:** The team formally accepts or rejects the risk that `SecurityPolicy` (JWT/OIDC configuration) is a proprietary Envoy Gateway resource with no standard Gateway API equivalent. If accepted: document the migration path if Envoy Gateway is replaced in the future. If rejected: identify what standard-API alternative meets the auth requirements.
- [ ] **WASM vs Lua capability assessment:** Based on EG-210 results, document whether Lua (`EnvoyExtensionPolicy`) meets the operator's custom transformation needs. If Lua is sufficient, no WASM investment is required. If Lua is insufficient, document which specific capabilities require WASM and estimate the WASM development effort.
- [ ] **Operator rebuild effort actuals:** Actual sprint points spent vs estimated for Epic 3 stories. Percentage delta. Identified sources of estimation error. Revised estimate for completing the remaining operator features needed for wave migration (RBAC, additional field mappings, ESO integration at scale).
- [ ] If proceeding (Proceed or Proceed with conditions), an updated migration plan is produced incorporating PoC learnings — at minimum covering: revised wave size recommendation, one-Gateway-per-namespace operational implications, updated operator delivery timeline, and any prerequisite work items identified during the PoC
- [ ] Document committed to platform repo at `docs/decisions/poc-outcome.md`

**Notes:**
The go/no-go document is the primary deliverable for stakeholder sign-off before committing to wave migration engineering effort. The 100-tenant scaling question is the highest-stakes decision — the one-proxy-per-namespace model means the platform will be operating significantly more proxy Deployments than the current Kong model. This is a known architectural trade-off of Envoy Gateway's isolation model; the question is whether the operational overhead is acceptable. The `docs/observability/datadog-envoy-integration.md` document from EG-406 should be referenced as an appendix to the go/no-go recommendation to provide observability evidence.

---

## Summary

### Stories by Epic

| Epic | Stories | Persona | Points |
|---|---|---|---|
| Epic 1: Platform Infrastructure | EG-100, EG-101, EG-102, EG-103, EG-104, EG-105, EG-106 | Senior Infrastructure Engineer | 20 |
| Epic 2: Ingress Chain Integration | EG-201, EG-202, EG-203, EG-210 | Senior Infrastructure Engineer | 11 |
| Epic 3: Operator Translation Rewrite | EG-301, EG-302, EG-302a, EG-303, EG-304, EG-305, EG-306, EG-307 | Senior Developer | 35 |
| Epic 4: Observability | EG-401, EG-402, EG-403, EG-404, EG-405, EG-406 | Senior Infrastructure Engineer | 19 |
| Epic 5: PoC Validation | EG-501, EG-502 | Platform Engineering Lead | 8 |
| **Total** | **25 stories** | | **93 points** |

---

### Blocking Dependency Chain

```
EG-100 → EG-101 → EG-102 → EG-103 → EG-106 → EG-201 → EG-202 → EG-203
EG-102 → EG-104 → EG-106
EG-103 → EG-105
EG-103 → EG-403 → EG-404 → EG-405 → EG-406
EG-202 → EG-210
EG-102 → EG-401 → EG-402
EG-301 → EG-302 → EG-302a → EG-303 → EG-304 → EG-306
EG-303 → EG-305
EG-304, EG-305, EG-306, EG-302a, EG-106, EG-201, EG-202 → EG-307
EG-307 + EG-203 + EG-406 → EG-501 → EG-502
```

### Critical Path

Epic 3 is the critical path at 35 points. EG-305 (8 points) is the highest-risk single story — GitHub issue #8707 and the one-Gateway-per-namespace architectural constraint must be understood before the sprint begins. EG-307 has the most cross-epic dependencies and cannot start until Epic 2 ingress chain stories are Done.

### Key Architectural Constraints (carry forward to all planning discussions)

1. **One Gateway per tenant namespace** — required workaround for GitHub issue #8707 (BackendTrafficPolicy global rate limiting only applies to first listener on a multi-listener Gateway). All test configurations must use single-listener Gateways.
2. **SecurityPolicy is proprietary** — `gateway.envoyproxy.io/v1alpha1` is not a standard Gateway API resource. Non-portable. Team acceptance documented in EG-501 and EG-502.
3. **Redis fail-open** — if in-cluster Redis is unavailable, rate limiting fails open (all requests pass). This is correct Envoy Gateway behavior. Do not treat as a bug.
4. **GatewayNamespace mode** — `deploy.type: GatewayNamespace` in controller values is the architectural linchpin. If wrong, EG-106 fails and the PoC is blocked.
