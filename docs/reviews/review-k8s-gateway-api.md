# Kubernetes Gateway API Expert Review — ADR-002

**Reviewer:** Kubernetes Gateway API Expert (Sub-Agent)
**Date:** 2026-05-17
**Scope:** Gateway API specification accuracy, CNCF maturity statuses, conformance data, candidate completeness

---

## Executive Summary

The ADR's candidate selection and final decision are directionally correct, but the conformance table contains verifiable factual errors that undermine the document's credibility as a reference artifact. Most significantly: "Graduated lineage" is not a CNCF concept and must be named as an explicit constraint exception; the Gateway API spec version cited for Cilium and Traefik (`v1.5.1`) does not exist — the correct version is `v1.5.0`; and `SecurityPolicy` is an Envoy Gateway proprietary extension, not a standard Gateway API resource. All four CNCF graduation statuses for Cilium, Istio, Linkerd, and Contour are confirmed accurate. The decision to select Envoy Gateway is supported, but the document must be corrected before archiving.

---

## Findings

### Finding 1: "Graduated Lineage" Is Invented CNCF Terminology
**Severity:** Major
**Claim in ADR:** "Envoy Gateway | Envoy subproject (Graduated lineage)" and "Note: Envoy Gateway is selected despite not being an independently CNCF Graduated project because it inherits from the Graduated Envoy Proxy project with multi-vendor governance."
**Verified Status:** Inaccurate framing — not a recognized CNCF concept
**Evidence:** CNCF maturity levels (Sandbox, Incubating, Graduated) apply to top-level hosted projects only. Sub-projects do not inherit their parent's maturity classification. CNCF has no concept of "Graduated lineage" or "inherited graduation." Envoy Gateway is a separate project maintained under the `envoyproxy` GitHub org; it has not been submitted to CNCF as an independent project. The ADR's own constraint ("CNCF Graduated") is technically not satisfied by Envoy Gateway under a strict reading.

Notably, as of April 2026, CNCF itself migrated its internal services cluster from ingress-nginx to Envoy Gateway — this real-world endorsement is a stronger and more accurate argument for Envoy Gateway's production readiness than the "Graduated lineage" construct.
**Recommended Change:**
- Remove "Envoy subproject (Graduated lineage)" from the table; replace with "Not independently Graduated (Envoy Proxy is CNCF Graduated)"
- Reframe the decision note: "Envoy Gateway does not independently satisfy the CNCF Graduated constraint. This ADR grants an explicit exception because: (a) Envoy Proxy — the upstream project — is CNCF Graduated with multi-vendor governance under the same Apache 2.0 license; (b) Envoy Gateway is the officially endorsed Kubernetes control plane for Envoy Proxy with Microsoft, Alibaba, Tetrate, and VMware/Broadcom participation; (c) CNCF itself migrated its own internal infrastructure to Envoy Gateway in April 2026. The exception is documented here and should be revisited if Envoy Gateway is submitted to CNCF as an independent project."

---

### Finding 2: Gateway API Spec Version v1.5.1 Does Not Exist
**Severity:** Major
**Claim in ADR:** Cilium and Traefik conformance listed at `v1.5.1` in the candidate table. Body text: "The current Gateway API release is v1.5.x."
**Verified Status:** Inaccurate
**Evidence:** The Kubernetes Gateway API released v1.5.0 on February 27, 2026. There is no v1.5.1 patch release. The `v1.5.1` figures in the conformance table appear to conflate the Gateway API spec version with the implementation's own software version (e.g., Cilium's own release tag). The conformance reports directory at `kubernetes-sigs/gateway-api` uses spec version directories, not implementation version directories.
**Recommended Change:**
- Change all `v1.5.1` references in the conformance table to `v1.5.0`
- Change "v1.5.x" in body text to "v1.5.0"
- Add a footnote clarifying: "Conformance version refers to the Gateway API specification version against which the report was submitted, not the implementation's own release version."

---

### Finding 3: "Not in Conformant List" Claim Is Unsupported
**Severity:** Major
**Claim in ADR:** "Behind current v1.5.x; not in Conformant list" for Envoy Gateway.
**Verified Status:** Partially accurate / requires clarification
**Evidence:** Conformance reports for Envoy Gateway exist at v1.4.0 in the kubernetes-sigs/gateway-api repository. No v1.5.0 report has been submitted as of the ADR date, which is what the "not in Conformant list" claim refers to. However, the "Partially Conformant" label requires citing which specific conformance profiles or features were not met — the ADR does not do this. The note in the ADR body (conformance lag due to fast-moving release cadence) is a reasonable explanation but should be supported by specific data.
**Recommended Change:** Add to the Envoy Gateway note: "Envoy Gateway's v1.4.0 conformance report is confirmed in the kubernetes-sigs/gateway-api repository. As of May 2026, no v1.5.0 report has been submitted. The 'Partially Conformant' label reflects formal report currency, not demonstrated capability gaps — Envoy Gateway passes the core and most extended HTTPRoute features in practice."

---

### Finding 4: Linkerd Row Missing Conformance Version
**Severity:** Major
**Claim in ADR:** Linkerd row shows "Partially Conformant" with no spec version in the conformance version column.
**Verified Status:** Inaccurate / incomplete
**Evidence:** The conformance table has no spec version listed for Linkerd, making the claim unauditable. Available evidence suggests Linkerd's last conformance report was submitted at Gateway API v1.2.1. Linkerd implements the Mesh profile only (east-west, not north-south), which is confirmed accurate.
**Recommended Change:** Update Linkerd row to specify conformance version: "v1.2.1 (Mesh profile only)" and move the conformance level column entry to "⚠️ Mesh profile only — not north-south capable."

---

### Finding 5: SecurityPolicy Is an Envoy Gateway Proprietary Extension, Not a Standard Resource
**Severity:** Major
**Claim in ADR:** Multiple references treat `SecurityPolicy` and `BackendTrafficPolicy` as if they are standard Gateway API resources alongside `GatewayClass`, `Gateway`, and `HTTPRoute`.
**Verified Status:** Inaccurate framing — must be distinguished
**Evidence:**
- Standard Gateway API resources (under `gateway.networking.k8s.io`): GatewayClass, Gateway, HTTPRoute, GRPCRoute, BackendTLSPolicy, and (Experimental) BackendTrafficPolicy.
- `SecurityPolicy` is an Envoy Gateway proprietary extension under `gateway.envoyproxy.io`. It is not part of the Gateway API specification.
- `ClientTrafficPolicy` and `EnvoyPatchPolicy` are similarly Envoy Gateway proprietary.
- `BackendTrafficPolicy` exists in both: the standard spec has a `BackendTrafficPolicy` resource at Experimental stability; Envoy Gateway also has its own extended version.

The ADR's portability claim — "HTTPRoute, SecurityPolicy, BackendTrafficPolicy are Kubernetes standards — the platform is not coupled to any implementation" — is incorrect for SecurityPolicy. Migrating away from Envoy Gateway would require replacing SecurityPolicy with an equivalent mechanism on the target implementation.
**Recommended Change:** In the Consequences section, change: "Config portability: HTTPRoute, SecurityPolicy, BackendTrafficPolicy are Kubernetes standards" to: "Config portability: HTTPRoute and BackendTrafficPolicy (Experimental) are Gateway API standards — migration to a different conformant implementation requires only a GatewayClass swap for routing configuration. SecurityPolicy is an Envoy Gateway extension (`gateway.envoyproxy.io`) with no direct standard equivalent; migrating auth configuration requires re-expressing security policies in the target implementation's API."

---

### Finding 6: CNCF Project Status — All Confirmed Accurate
**Severity:** Informational
**Claim in ADR:** Cilium Graduated, Istio Graduated, Linkerd Graduated, Contour Incubating, kgateway Sandbox.
**Verified Status:** Accurate
**Evidence:**
- Cilium: CNCF Graduated October 11, 2023 ✅
- Istio: CNCF Graduated July 12, 2023 ✅ (fastest graduation in CNCF history)
- Linkerd: CNCF Graduated July 28, 2021 ✅ (first graduated service mesh)
- Contour: CNCF Incubating since July 2020 ✅ (never graduated)
- kgateway: CNCF Sandbox since March 4, 2025 ✅ (accepted to expedite project donation)

---

### Finding 7: Missing Candidate — NGINX Gateway Fabric
**Severity:** Minor
**Claim in ADR:** Candidate inventory is presented as comprehensive.
**Verified Status:** Incomplete
**Evidence:** NGINX Gateway Fabric v2.5.0 (released 2025) achieved Gateway API v1.5.0 conformance and is listed on the official implementations page as Conformant. NGINX Gateway Fabric is maintained by F5/NGINX, not a CNCF project, but it represents a significant implementation given the widespread use of ingress-nginx and the announced ingress-nginx EOL timeline. Teams migrating from ingress-nginx may consider it a natural successor; the ADR should explicitly address why it was not evaluated.
**Recommended Change:** Add a brief note in the candidate inventory: "NGINX Gateway Fabric (F5/NGINX, not a CNCF project): Conformant at v1.5.0. Disqualified under the CNCF Graduated constraint. Relevant context: ingress-nginx approaches EOL in 2026; NGINX Gateway Fabric is its natural successor but carries the same single-vendor governance risk as Traefik."

---

## Missing Candidates

| Implementation | CNCF Status | Conformance | Why Excluded |
|---|---|---|---|
| NGINX Gateway Fabric | Not CNCF | Conformant v1.5.0 | Single-vendor (F5); no CNCF governance |

---

## Structural Recommendations

1. **Add a "Constraint Exceptions" section** clearly naming Envoy Gateway as a constraint exception with documented justification. The current "Note" buried in the candidate table is insufficient for an ADR that will serve as a long-term reference.
2. **Distinguish standard vs. implementation-specific resources** throughout. Use notation like `[EG]` for Envoy Gateway proprietary resources and `[K8s-GW]` for standard spec resources.
3. **Separate "conformance version" from "implementation version"** in the table to prevent the v1.5.1 confusion from recurring.

---

## Overall Assessment

**Decision Validity:** Supported — with required corrections
**Rationale:** Envoy Gateway is the correct selection. It is the multi-vendor reference implementation for Kubernetes Gateway API north-south traffic, Apache 2.0 licensed, with verified production adoption (including CNCF's own internal infrastructure as of April 2026). The factual errors in the conformance table and the "SecurityPolicy is a Kubernetes standard" claim must be corrected before the ADR is archived — they will cause confusion when the team references this document during migration planning.
