# Platform Engineer Review — Improved JIRA Stories
# Epics 1, 2, 4, and EG-501/EG-502

**Author:** Senior Platform Engineer
**Date:** 2026-05-17
**Scope:** EG-100, EG-101, EG-102, EG-103, EG-104, EG-105, EG-106 (Epic 1); EG-201, EG-202, EG-203, EG-210 (Epic 2); EG-401, EG-402, EG-403, EG-404, EG-405, EG-406 (Epic 4); EG-501, EG-502 (Epic 5)
**Based on PM review:** `docs/reviews/review-jira-pm.md`

---

## Summary of Changes

### New Stories Added

- **EG-100** (2 pts): ACR mirror configuration story added as a hard prerequisite to EG-101 and EG-102. The PM identified this as missing — both of those stories referenced ACR mirror readiness in Notes but had no story to deliver it.
- **EG-210** (3 pts): Lua extension validation via `EnvoyExtensionPolicy` added to Epic 2. The PM identified this as a PoC capability gap — validating Lua now informs whether WASM investment is needed for custom transformations.

### Epic 1 Changes

- **EG-101**: ACR mirror (EG-100) promoted to hard prerequisite dependency. Added `kubectl get crd | grep gateway.envoyproxy.io` CRD count verification AC. Clarified that `envoypatchpolicies` is an Envoy Gateway extension CRD, not a standard Gateway API CRD.
- **EG-102**: `deploy.type: GatewayNamespace` moved from Notes to a hard AC — this is the single most architecturally important configuration line in the epic; if wrong, EG-106 fails. Added explicit resource requests/limits AC. Tightened startup log AC to specify "Starting manager" and "Watching Gateways" strings with no ERROR-level entries within 60 seconds.
- **EG-103**: Added zone-spreading AC (`topologySpreadConstraints`). Added Prometheus metrics endpoint AC (port 9902 on proxy pods). Added network team subnet sign-off as a hard prerequisite before story starts.
- **EG-104**: Replaced informal Redis validation with specific CLI command (`redis-cli -h redis.envoy-gateway-system.svc.cluster.local PING` returns `PONG`). Added controller-Redis connectivity confirmation AC. Added explicit note on Redis fail-open behavior. Added `persistentVolumeClaim: none` as explicit AC.
- **EG-105**: Added Kyverno running in dev cluster as a hard prerequisite. Made Kong non-regression AC testable (Kong pods running, routes returning 200). Set Enforce mode explicitly. Specified exact rejection error message format.
- **EG-106**: Added Deployment name pattern AC (`envoy-<gateway-name>-<namespace>`). Added subnet CIDR documentation requirement as prerequisite. Made Kong non-regression testable (EXTERNAL-IP unchanged, routes return 200). Added failure-mode blocking condition directing return to EG-102 if proxy pods land in wrong namespace.

### Epic 2 Changes

- **EG-201**: Changed "scripted or documented" to "Azure CLI script or Bicep delta committed to platform repo." Moved health probe path (`GET /healthz/ready` on port 19001) from Notes to AC. Added probe verification prerequisite. Added AC requiring Envoy backend shows healthy (not Unknown or Unhealthy) in App Gateway.
- **EG-202**: Fixed XFF/client IP AC sequencing — `ClientTrafficPolicy` (EG-203) has not been applied at this stage; AC updated to document pre-ClientTrafficPolicy expected behavior rather than asserting correct client IP. Added unhappy path AC (undefined path returns 404 from echo, not 502 from App Gateway). Tightened header propagation AC (X-Forwarded-For contains test client/Imperva IP; X-Request-ID is present and non-empty).
- **EG-203**: Added forged-header rejection specificity ("Envoy access logs show App Gateway IP as client IP, not 1.2.3.4"). Specified XFF runbook committed path (`docs/runbooks/xff-trust-chain.md`). Added ClientTrafficPolicy targeting scope AC (policy targets dev tenant Gateway only, not GatewayClass).

### Epic 4 Changes

- **EG-401**: Clarified metrics ports — controller metrics on 19001, per-tenant proxy pod Prometheus metrics on 9902. Removed "or" ambiguity from scrape config method — pod annotations chosen as the approach. Added rate-limit trigger test for `envoy_ratelimit_over_limit`. Added namespace-label AC.
- **EG-402**: Specified JSON committed path (`platform/grafana/dashboards/envoy-gateway-poc.json`). Added live-data AC (at least one panel shows non-zero data). Specified stable `uid` field requirement. Specified namespace label key for scoping.
- **EG-403**: Completed full story body with EnvoyProxy CRD YAML config reference, 10% head-based sampling, custom tags including `platform.tenant` from `x-tenant-id` header, Datadog Agent endpoint confirmation.
- **EG-404**: Completed full story body with autodiscovery annotations YAML, metrics endpoint on proxy pod port 9902, standard Datadog Envoy integration.
- **EG-405**: Completed full story body. `x-tenant-id` as structured log field via access log format in EnvoyProxy CRD. Per-tenant filtering in Datadog Log Explorer.
- **EG-406**: Completed full story body. All three signals (traces, metrics, logs) filterable by tenant. Validation document at `docs/observability/datadog-envoy-integration.md`.

### Epic 5 Changes

- **EG-501**: Completed 16-item checklist (original 13 + GitHub issue #8707 validation item + Lua extension validation item + SecurityPolicy proprietary resource acknowledgment item).
- **EG-502**: Completed go/no-go criteria including: one-Gateway-per-namespace viability at 100-tenant scale, SecurityPolicy non-portability risk acceptance, WASM vs Lua assessment, operator rebuild effort actuals vs estimates, updated migration plan if proceeding.

---

## EG-100: Configure ACR Mirror for Envoy Gateway Images

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 2
**Depends on:** Nothing
**Blocks:** EG-101, EG-102
**Prerequisites:** Platform ACR instance accessible and pushable from CI pipeline. Dev AKS node managed identity has `AcrPull` role on the platform ACR.

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

## EG-101: Install Envoy Gateway CRDs via ArgoCD

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 2
**Depends on:** EG-100
**Prerequisites:** EG-100 complete and confirmed — ACR mirror for `docker.io/envoyproxy` is accessible from dev cluster. ArgoCD operational in dev cluster.

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
`envoypatchpolicies` and `envoyextensionpolicies` are Envoy Gateway extension CRDs — they are not part of the standard Gateway API specification. The standard Gateway API CRDs (`gatewayclasses`, `gateways`, `httproutes`, etc.) are portable; the extension CRDs are Envoy Gateway proprietary. CRDs chart source: `oci://<acr-name>.azurecr.io/envoyproxy/gateway-crds-helm`. `prune: false` is intentional — CRDs must never be auto-pruned as it would destroy all instances cluster-wide.

---

## EG-102: Deploy Envoy Gateway controller via ArgoCD

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-101
**Prerequisites:** EG-100 complete. EG-101 synced and healthy. ACR mirror confirmed.

**Description:**
Deploy the Envoy Gateway controller (`gateway-helm` v1.8.0) into `envoy-gateway-system` namespace via ArgoCD using the multi-source pattern — Helm chart from ACR OCI mirror, values file from the platform Git repo. The values file must configure GatewayNamespace deploy mode (`deploy.type: GatewayNamespace`), which is the critical configuration that causes proxy pods to be deployed into tenant namespaces rather than `envoy-gateway-system`. Without this, EG-106 will fail.

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

## EG-103: Deploy GatewayClass and EnvoyProxy configuration

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-102
**Prerequisites:** Network team has confirmed and documented the AKS subnet name for the internal load balancer — this confirmation must be received before the story enters the sprint. Do not start this story without network team subnet sign-off.

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

## EG-104: Deploy Redis for global rate limiting

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 2
**Depends on:** EG-102
**Prerequisites:** None beyond EG-102.

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

## EG-105: Add Kyverno policy to enforce GatewayClass usage

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-103
**Prerequisites:** Kyverno controller is running and healthy in the dev cluster — confirm with `kubectl get pods -n kyverno` before starting. If Kyverno is not present, this story is blocked and requires a separate infra prerequisite story.

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
The Kyverno policy must use `spec.validationFailureAction: Enforce` (not `Audit`). Starting in Audit mode and forgetting to switch to Enforce is a common mistake that leaves the platform unprotected. The specific rejection messages listed in the AC are important — the operator team (Epic 3) needs to know the exact error format when their reconciler creates `Gateway` resources during development (EG-302/303). Document the expected rejection messages in the policy's `message` field so the operator team sees them in controller logs.

---

## EG-106: Deploy dev tenant Gateway resource and validate ILB provisioning

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 5
**Depends on:** EG-103, EG-104
**Prerequisites:** Subnet CIDR for the AKS ILB subnet documented in the story or linked reference. Network team confirmation received (from EG-103 prerequisite). EG-105 deployed so GatewayClass enforcement is active.

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
This story is the first validation that GatewayNamespace mode is functioning correctly in this AKS environment. This mode has not been previously validated here — allocate buffer for unexpected behavior. The failure mode is explicit: if the proxy pods land in `envoy-gateway-system`, GatewayNamespace mode is not active in the controller, and EG-102 must be revisited before proceeding. The 5-point estimate reflects this elevated risk. For the PoC, 1 replica on the proxy Deployment is acceptable — production sizing will add replicas and a PodDisruptionBudget.

---

## EG-201: Configure App Gateway backend pool to target Envoy ILB

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-106
**Prerequisites:** Confirm that `GET /healthz/ready` on port 19001 responds with HTTP 200 from within the AKS VNet before configuring the App Gateway health probe — perform this verification as a spike step before the story enters the sprint. Do not configure the probe targeting an endpoint that has not been confirmed reachable.

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

## EG-202: Deploy a test HTTPRoute and validate end-to-end traffic through App Gateway

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-201
**Prerequisites:** None beyond EG-201.

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

## EG-203: Validate and configure X-Forwarded-For trust chain

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 2
**Depends on:** EG-202
**Prerequisites:** None beyond EG-202.

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

## EG-210: Validate Lua Extension via EnvoyExtensionPolicy

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-202
**Prerequisites:** None beyond EG-202. Envoy Gateway v1.8.0 must be installed (EG-102 complete).

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

## EG-401: Validate Envoy Gateway metrics in Azure Monitor Workspace

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-102
**Prerequisites:** `ama-metrics` DaemonSet running in dev cluster. Azure Monitor Workspace connected to dev cluster.

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
Port clarification: the Envoy Gateway **controller** exposes its own metrics on port 19001 (the controller management port). Envoy **proxy pods** (the data plane, running in tenant namespaces) expose Prometheus metrics on port 9902. These are two distinct scrape targets requiring two distinct scrape configurations. Verify port 9902 is correct for v1.8.0 proxy pods by checking the `EnvoyProxy` CRD status or the proxy pod port list. The "ServiceMonitor or pod annotation" ambiguity from the original story is resolved: use pod annotations via the `EnvoyProxy` CRD to inject scrape annotations onto proxy pods — this is the standard approach for dynamically-created proxy pods that cannot have a static ServiceMonitor.

---

## EG-402: Create Grafana dashboard for Envoy Gateway PoC validation

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 2
**Depends on:** EG-401
**Prerequisites:** Azure Managed Grafana dev workspace accessible. AMW data source configured in Grafana.

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

## EG-403: Configure Datadog tracing integration via EnvoyProxy CRD

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 5
**Depends on:** EG-103
**Prerequisites:** Datadog Agent DaemonSet confirmed running in dev cluster with APM enabled. Confirm Datadog Agent namespace and service name with `kubectl get svc -n datadog-agent`.

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
Confirm the Datadog Agent service name and namespace in the dev cluster before hardcoding — the service name `datadog-agent` and namespace `datadog-agent` are defaults but may differ in this environment. The `platform.tenant` custom tag sourced from the `x-tenant-id` request header enables per-tenant trace filtering in Datadog APM — this is the primary observability signal for tenant-level traffic analysis. At 10% sampling, not all requests will produce traces — send at least 20+ test requests to confirm traces appear in APM. The 5-point estimate reflects the non-trivial EnvoyProxy CRD configuration and Datadog Agent reachability validation required.

---

## EG-404: Configure Datadog metrics collection via Agent autodiscovery

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-403
**Prerequisites:** EG-403 complete. Datadog Agent confirmed running with metrics collection enabled.

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
The `%%host%%` template is resolved by the Datadog Agent at runtime to the pod IP — this is standard Datadog autodiscovery syntax, not a typo. The metrics endpoint port is `9902` (Envoy proxy pod Prometheus port) — the original story draft used `19001` which is the admin/controller port. Verify port 9902 is correct for the v1.8.0 proxy pods before applying. The `ad.datadoghq.com/envoy.logs` annotation configures log collection alongside metrics — both are set here to avoid a separate update pass.

---

## EG-405: Configure Datadog access log collection and validate log pipeline

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-404
**Prerequisites:** EG-404 complete. Datadog log management enabled in the Datadog account.

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
The `x-tenant-id` header must be added to the `EnvoyProxy` CRD access log format configuration — it cannot be injected by the Datadog Agent. The access log format is configured under `telemetry.accessLog` in the `EnvoyProxy` CRD. The existing format likely already includes `%REQ(X-REQUEST-ID)%` and `%REQ(X-FORWARDED-FOR)%` from EG-403 setup; add `%REQ(X-TENANT-ID)%` alongside them. The data governance confirmation is required before this logging pattern is used outside dev — capturing it now in the story notes creates a clear record for the EG-502 retrospective.

---

## EG-406: Validate per-tenant observability breakdown in Datadog

**Type:** Story
**Persona:** Senior Infrastructure Engineer
**Points:** 3
**Depends on:** EG-403, EG-404, EG-405
**Prerequisites:** EG-403, EG-404, and EG-405 all complete. Test traffic sent through the ingress chain with `x-tenant-id` header set to a known value (e.g., `tenant-a`).

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

## EG-501: PoC Validation — Functional Parity Checklist

**Type:** Story
**Persona:** Platform Engineering Lead
**Points:** 5
**Depends on:** EG-203, EG-307, EG-406 (all PoC implementation stories complete)
**Prerequisites:** All Epic 1, 2, 3, and 4 stories complete. Test environment prepared with dev tenant, echo backend, and test credentials.

**Description:**
Execute a structured validation checklist comparing Envoy Gateway behavior against the current Kong behavior for the dev tenant. Document pass/fail results for each item as evidence for the go/no-go decision. The checklist includes functional parity items, bug #8707 validation, Lua extension capability confirmation, and SecurityPolicy proprietary resource acknowledgment.

**Acceptance Criteria:**
Checklist — document pass/fail with evidence for each item:

- [ ] **HTTP routing** — path-based routing works correctly: known paths return 200, unknown paths return 404 from backend (not 502 from App Gateway)
- [ ] **HTTPS termination** — TLS handled at Envoy listener: HTTPS request succeeds, HTTP request redirected or rejected per configured policy
- [ ] **JWT validation** — valid Entra ID JWT token passes (200), invalid/expired token returns 401, missing token returns 401
- [ ] **OIDC flow** — browser-based OIDC redirect to Entra ID completes and returns to application with authenticated session
- [ ] **Rate limiting** — requests within limit return 200; requests above configured limit return 429; counter resets after time window expires
- [ ] **X-Forwarded-For** — real client IP correctly identified through Imperva + App Gateway chain (numTrustedHops: 2 configured in EG-203)
- [ ] **Circuit breaking** — upstream service failure (simulated by scaling echo to 0 replicas) triggers circuit open; recovery on scale-up
- [ ] **Header manipulation** — `x-tenant-id` header injected on all requests by HTTPRoute filter and visible in upstream service logs
- [ ] **CRD delete → resource cleanup** — deleting tenant CRD results in all generated resources (HTTPRoute, SecurityPolicy, BackendTrafficPolicy, ExternalSecret) removed within 30 seconds via owner reference garbage collection
- [ ] **App Gateway backend health** — Envoy backend shows Healthy in App Gateway backend health view throughout test period
- [ ] **Datadog traces** — APM traces visible and filterable by `platform.tenant:tenant-a` tag
- [ ] **Datadog metrics** — Envoy metrics visible in Datadog Metrics Explorer, filterable by namespace
- [ ] **Datadog logs** — access logs parsed and filterable by `x-tenant-id` field in Datadog Log Management
- [ ] **GitHub issue #8707 validation** — confirm rate limiting is tested against a single-listener Gateway configuration; document whether bug #8707 is resolved in v1.8.0 or whether the one-Gateway-per-namespace workaround is required; record result as a named finding in the validation document
- [ ] **Lua extension validation** — confirm `EnvoyExtensionPolicy` with a Lua script executes on a live request (EG-210 result); document Lua capability as viable or insufficient for operator transformation needs
- [ ] **SecurityPolicy proprietary resource acknowledgment** — team formally records that `SecurityPolicy` (`gateway.envoyproxy.io/v1alpha1`) is a proprietary Envoy Gateway resource not portable to standard Gateway API; team documents this as an accepted PoC constraint with understood migration implications

**Notes:**
Each checklist item must have a documented result: Pass, Fail, or Conditional Pass with conditions stated. A Conditional Pass is acceptable for PoC sign-off if conditions are minor and resolvable in the wave migration phase. Any Fail must be documented with: what failed, why, whether it is a blocker for migration, and proposed resolution. The checklist output feeds directly into EG-502. The #8707 finding is particularly important — if the bug is still present in v1.8.0, the one-Gateway-per-namespace architecture is a required constraint for all 100 tenants in wave migration, which has scaling and operational implications that must be quantified in EG-502.

---

## EG-502: PoC Retrospective and Go/No-Go Recommendation

**Type:** Story
**Persona:** Platform Engineering Lead
**Points:** 3
**Depends on:** EG-501
**Prerequisites:** EG-501 complete with all checklist items documented. All three engineers (Senior Infrastructure Engineer, Senior Developer, Platform Engineering Lead) available for retrospective session.

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

- [ ] If proceeding (Proceed or Proceed with conditions), an updated migration plan is produced incorporating PoC learnings — at minimum, covering: revised wave size recommendation, one-Gateway-per-namespace operational implications, updated operator delivery timeline, and any prerequisite work items identified during the PoC
- [ ] Document committed to platform repo at `docs/decisions/poc-outcome.md`

**Notes:**
The go/no-go document is the primary deliverable for stakeholder sign-off before committing to wave migration engineering effort. The 100-tenant scaling question is the highest-stakes decision — the one-proxy-per-namespace model means the platform will be operating significantly more proxy Deployments than the current Kong model. This is a known architectural trade-off of Envoy Gateway's isolation model; the question is whether the operational overhead is acceptable. The `docs/observability/datadog-envoy-integration.md` document from EG-406 should be referenced as an appendix to the go/no-go recommendation to provide observability evidence.
