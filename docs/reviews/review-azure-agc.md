# Azure Application Gateway for Containers Expert Review — ADR-002

**Reviewer:** Azure Application Gateway for Containers Expert (Sub-Agent)
**Date:** 2026-05-17
**Scope:** All Azure AGC claims in ADR-002

---

## Executive Summary

The ADR's disqualification of Azure Application Gateway for Containers is correct and the three-constraint failure characterization is defensible. However, the document contains one critical factual error (the last conformance report is against v1.1.0, not v1.2.1 as stated) and two material inaccuracies: the ARM lifecycle concern is overstated for ALB-Controller-managed deployments, and the feature deficit list conflates Envoy Gateway proprietary extensions with standard Gateway API features. None of these change the outcome — AGC is correctly disqualified — but they should be corrected for accuracy.

---

## Findings

### Finding 1: Last Conformance Report Version Is Wrong
**Severity:** Critical
**Claim in ADR:** "AGC is listed as Stale on the official Gateway API implementations page, with its last conformance report submitted against v1.2.1."
**Verified Status:** Inaccurate
**Evidence:** The `kubernetes-sigs/gateway-api` conformance reports directory contains AGC subdirectories only at `v1.0.0` and `v1.1.0`. The `v1.2.1` directory in the conformance reports tree contains reports for kgateway, Traefik, and Istio — but not AGC. The "v1.2.1" figure appears to conflate the ALB Controller's own software version with the Gateway API specification version it reported against. AGC's last conformance report is against **Gateway API v1.1.0** — making AGC four minor versions behind the current v1.5.0 release (not three as the ADR states).

The Stale classification is accurate. The removal risk is accurate. Only the version number is wrong.
**Recommended Change:**
- Change "v1.2.1" to "v1.1.0" everywhere in the document
- Change "three minor versions behind" to "four minor versions behind"
- Update the evaluation table: Gateway API conformance version → v1.1.0

---

### Finding 2: ARM Lifecycle Claim Is Incomplete — Managed Mode Reconciles Lifecycle
**Severity:** Major
**Claim in ADR:** "AGC requires Azure-specific Frontend and Association resources to be provisioned in ARM before a Gateway resource can be created in Kubernetes. These ARM resources have their own lifecycle, independent of Kubernetes — deletion of the Frontend resource is the responsibility of the Azure administrator and is not triggered by deletion of the Gateway resource."
**Verified Status:** Partially Accurate — applies only to BYO deployment mode
**Evidence:** AGC has two deployment modes:
1. **BYO (Bring Your Own) mode:** The ARM Frontend and Association resources are provisioned manually by an administrator. The lifecycle concern described in the ADR applies — Kubernetes Gateway deletion does not trigger ARM Frontend deletion.
2. **ALB-Controller-managed mode (the recommended path):** The ALB Controller fully manages the ARM resource lifecycle. When a Kubernetes Gateway resource is deleted, the controller reconciles the deletion of associated ARM resources. The split-lifecycle concern does not apply in this mode.

The ADR's description applies only to BYO mode and presents it as universal, which is inaccurate.

The vendor lock-in conclusion (HTTPRoutes with AGC GatewayClass references cannot be ported without changes) remains accurate regardless of deployment mode. The portability problem is real.
**Recommended Change:** Revise to: "In BYO deployment mode, AGC requires Azure-specific Frontend and Association resources to be provisioned manually in ARM with an independent lifecycle — Kubernetes Gateway deletion does not trigger ARM resource cleanup. In ALB-Controller-managed mode (the recommended path), the controller reconciles ARM resource lifecycle against Kubernetes Gateway lifecycle. In both modes, the GatewayClass references and AGC-specific annotations embedded in Gateway resources are Azure-proprietary and non-portable — migration away from AGC requires replacing these resources regardless of deployment mode."

---

### Finding 3: Feature Deficit List Conflates Envoy Proprietary Resources With Gateway API Standards
**Severity:** Major
**Claim in ADR:** "Extended features like SecurityPolicy, BackendTrafficPolicy, ClientTrafficPolicy, and EnvoyPatchPolicy are not available."
**Verified Status:** Inaccurate framing
**Evidence:**
- `SecurityPolicy`, `ClientTrafficPolicy`, and `EnvoyPatchPolicy` are **Envoy Gateway proprietary extensions** under the `gateway.envoyproxy.io` API group. They are not standard Gateway API features — no other implementation is expected to implement them.
- `BackendTrafficPolicy` exists in both the standard spec (Experimental) and as an Envoy Gateway extension; the standard version may have limited support across implementations.
- Listing these Envoy Gateway proprietary resources as AGC "deficits" is comparing AGC against Envoy Gateway's proprietary API, not against the Gateway API specification that AGC is expected to conform to.
- Additionally: AGC has its own security capabilities under an `AzureSecurityPolicy` (Azure WAF integration, preview as of late 2025). The statement that SecurityPolicy-equivalent capabilities are "not available" is misleading — the mechanism exists under a different name and Azure's WAF infrastructure.
**Recommended Change:** Replace "Extended features like SecurityPolicy, BackendTrafficPolicy, ClientTrafficPolicy, and EnvoyPatchPolicy are not available" with: "AGC does not support standard Gateway API extended features at `BackendTrafficPolicy` level. Gateway API-standard auth and rate limiting features are not available; Azure WAF integration is available via a proprietary `AzureSecurityPolicy` resource (preview), which deepens Azure lock-in rather than addressing it. The Envoy Gateway-specific policy extensions (SecurityPolicy, ClientTrafficPolicy, EnvoyPatchPolicy) are proprietary to Envoy Gateway and are not part of the Gateway API standard any implementation would be expected to support."

---

### Finding 4: HTTPRoute Portability Claim — Minor Inaccuracy
**Severity:** Minor
**Claim in ADR:** "HTTPRoute resources written against AGC today are not portable to any other Gateway API implementation without changes to the ARM dependency."
**Verified Status:** Partially Inaccurate
**Evidence:** Standard `HTTPRoute` resources (using core Gateway API fields) are largely portable between conformant implementations. The portability problem lies in the `Gateway` resource (which references the AGC `GatewayClass`) and in any AGC-specific annotations or extensions applied to routes. Standard HTTPRoutes themselves conform to the spec and are portable.
**Recommended Change:** Change to: "Gateway resources referencing the AGC GatewayClass, and any AGC-specific route annotations, are not portable to other implementations. Standard HTTPRoute resources using core Gateway API fields are largely portable."

---

### Finding 5: Stale Classification and Removal Policy — Accurate
**Severity:** Informational
**Claim in ADR:** "Under the Gateway API page review policy, implementations that remain Stale after the v1.5 review process (due mid-2026) will be removed from the implementations list entirely."
**Verified Status:** Accurate
**Evidence:** The Gateway API implementations page policy is confirmed: implementations are reviewed periodically and those that remain Stale without submitting updated conformance reports are removed. AGC's last report at v1.1.0 (three releases behind at the v1.3 review, four behind at v1.5 review) places it at removal risk. The characterization is accurate.

---

### Finding 6: "AKS-Only" Portability Claim — Accurate
**Severity:** Informational
**Claim in ADR:** "AGC is AKS-only by design."
**Verified Status:** Accurate
**Evidence:** AGC requires the Azure Load Balancer (ALB) Controller, Azure-specific ARM resources, and integration with Azure networking primitives. It cannot run outside AKS. Confirmed via Microsoft documentation.

---

### Finding 7: Operational Simplicity Argument — Valid but Underspecified
**Severity:** Minor
**Claim in ADR:** "The operational simplicity argument does not hold at this platform's scale."
**Verified Status:** Accurate conclusion, but the benefits of the managed model are understated and the scale limits are not specified.
**Evidence:** The managed data plane model has real operational benefits the ADR addresses only in a subordinate clause:
- No in-cluster proxy pods to manage, version, or resource-provision
- Azure SLA coverage for the data plane
- No proxy version management or CVE patching for the data plane
- Native Azure Monitor integration without additional exporters

However, the managed model introduces concrete scale limits relevant to the 100-tenant platform:
- Maximum 200 rules per AGC instance
- Each AGC instance requires a dedicated `/24` subnet (254 usable IPs)
- ARM API rate throttling under high configuration churn (100 tenants continuously reconciling routes)

The "does not hold at scale" conclusion is correct — but citing specific scale limits would strengthen it.
**Recommended Change:** Add to the operational simplicity paragraph: "At the 100-tenant scale of this platform, AGC introduces concrete constraints: a maximum of 200 routing rules per instance, a dedicated `/24` subnet requirement per instance, and ARM API rate throttling under high configuration churn. These limits mean multi-instance AGC deployment would be required at scale, negating the operational simplicity argument."

---

## ARM Lifecycle Model Assessment

The ADR's core ARM lifecycle concern is valid but overstated as universal. The actual vendor lock-in problem with AGC is better characterized as:

1. **GatewayClass lock-in:** Any Gateway resource referencing `azure-alb-external` or `azure-alb-internal` GatewayClass is non-portable.
2. **ARM resource dependency:** Even in managed mode, the ARM frontend exists and is Azure-specific — it simply has an automated lifecycle via the ALB Controller.
3. **No migration path for auth/rate limiting:** AGC's absence of standard rate limiting and auth mechanisms means the platform would need to continue operating Kong or adopt Azure API Management — adding dependency rather than removing it.

The ARM lifecycle framing in the ADR should be tightened to focus on the portability and feature gap arguments, which are the strongest disqualifying factors.

---

## Operational Trade-off Analysis

| Trade-off | ADR Treatment | Actual Assessment |
|---|---|---|
| Managed data plane (no in-cluster proxy) | Dismissed in one clause | Real benefit — reduces in-cluster operational surface |
| Azure Monitor native integration | Not mentioned | Real benefit for Azure-native teams |
| ARM lifecycle coupling | Overstated as universal | Applies to BYO mode; managed mode reconciles lifecycle |
| 200-rule limit | Not mentioned | Material constraint at 100-tenant scale |
| /24 subnet requirement | Not mentioned | Infrastructure constraint requiring pre-provisioning |
| ARM rate throttling | Not mentioned | Operational risk under high configuration churn |

---

## Fairness Assessment

The ADR is fair in its conclusion but uneven in its analysis. The "three constraints failed" characterization is accurate. The conformance stale/removal argument is accurate. However:

1. The ARM lifecycle concern is presented as worse than it is in managed mode.
2. Envoy Gateway proprietary resources (SecurityPolicy, ClientTrafficPolicy, EnvoyPatchPolicy) should not appear as AGC feature deficits.
3. AGC's managed data plane benefits are addressed only in passing, while its weaknesses are listed in detail.

These imbalances don't change the outcome but should be corrected for a document that will inform future platform decisions.

---

## Decision Impact

The conformance version correction (v1.1.0 not v1.2.1) actually strengthens the case against AGC — it is four versions behind, not three. The ARM lifecycle correction and the feature list correction do not weaken the disqualification; they improve accuracy.

---

## Overall Assessment

**AGC Disqualification:** Upheld
**Rationale:** AGC fails the CNCF Graduated, no vendor lock-in, and portability constraints. Its conformance is four minor versions stale with no active update trajectory. The managed data plane benefits are real but insufficient to overcome the portability, governance, and feature gaps for a multi-tenant platform planning a 3-5 year horizon without commercial dependency. The specific corrections needed (conformance version, ARM lifecycle qualification, feature list cleanup) improve accuracy but do not change the outcome.
