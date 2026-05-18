# Envoy Gateway Expert Review — ADR-002

**Reviewer:** Envoy Gateway Expert (Sub-Agent)
**Date:** 2026-05-17
**Scope:** Envoy Gateway technical claims, conformance posture, production readiness, TEG commercial offering, HA patterns

---

## Executive Summary

The ADR selects Envoy Gateway correctly, but contains two critical factual errors and one active production bug finding that must be addressed before the document is archived. The v1.0 release date is wrong by two years ("early 2026" — actual: March 13, 2024), and the extension model description is outdated (Lua support was added in v1.5). More significantly, an active unresolved GitHub issue (filed April 2026) reveals that `BackendTrafficPolicy` global rate limiting only applies to the first listener on a Gateway — a material defect for the 100-tenant rate limiting design described in the ADR. TEG claims, AKS compatibility, and the core capability assessment are accurate. Decision is supported, with required revisions.

---

## Findings

### Finding 1: v1.0 Release Date Is Wrong by Two Years
**Severity:** Critical
**Claim in ADR:** "Envoy Gateway reached its 1.0 production-ready release in early 2026, with over 90 contributors."
**Verified Status:** Inaccurate
**Evidence:** Envoy Gateway v1.0 GA was released on **March 13, 2024**, as documented in the official CNCF blog post "A Year of Envoy Gateway GA: Building, Growing, and Innovating Together" (June 2025). As of May 2026, the latest release is **v1.8.0** (released May 13, 2026). The project has been production-ready for over two years at time of ADR writing, which is actually a stronger argument for stability than stated.
**Recommended Change:** Replace "reached its 1.0 production-ready release in early 2026" with "reached its 1.0 production-ready release in March 2024. As of May 2026, the project is at v1.8.0 with a stable 6-month minor release cadence."

---

### Finding 2: Active Rate Limiting Bug Affecting Multi-Tenant Design
**Severity:** Critical Omission
**Claim in ADR:** "Rate limiting is global and Redis-backed, supporting per-JWT-claim tenant scoping."
**Verified Status:** Accurate in intent, but an active production bug limits this capability
**Evidence:** GitHub issue #8707 (filed April 9, 2026, unresolved as of May 2026) documents that `BackendTrafficPolicy` global rate limiting only applies to the **first listener configured on a Gateway resource**. Additional listeners on the same Gateway do not have rate limiting applied. This is a material defect for the 100-tenant architecture described in the ADR, which uses per-namespace GatewayClasses with rate limiting scoped per HTTPRoute.
**Recommended Change:** Add a "Known Limitations" note under the Multi-tenant pattern section: "**Known issue (tracked):** GitHub issue #8707 (filed April 2026, unresolved) documents that BackendTrafficPolicy global rate limiting applies only to the first listener on a Gateway. Validate this is resolved before relying on per-listener rate limiting in production. Workaround: deploy one Gateway resource per tenant namespace rather than using multi-listener Gateways."

---

### Finding 3: Conformance Status — Accurate but Incomplete
**Severity:** Major
**Claim in ADR:** "Partially Conformant" at v1.4.0; v1.5.x conformance lag explained by fast-moving release cadence.
**Verified Status:** Accurate as of ADR date, but should note current state
**Evidence:** The v1.4.0 conformance report is confirmed in `kubernetes-sigs/gateway-api`. Gateway API v1.5.0 was released February 27, 2026. No v1.5.0 Envoy Gateway conformance report existed as of the ADR date (May 2026). This should be tracked as a follow-up action item.
**Recommended Change:** Add tracking action: "Action item: Monitor Envoy Gateway v1.5.0 conformance report submission. If not submitted within two Gateway API release cycles (i.e., before Gateway API v1.7), revisit this ADR."

---

### Finding 4: Extension Model Description Is Outdated
**Severity:** Minor
**Claim in ADR:** "Custom logic requires WASM filters (Go or Rust) or ext_proc external processors."
**Verified Status:** Outdated
**Evidence:** Envoy Gateway v1.5 introduced Lua scripting support via `EnvoyExtensionPolicy`. Lua is a significantly lower barrier than WASM (Go or Rust), reducing the "steeper than Lua plugin development" concern cited as a consequence. The WASM description remains accurate for complex custom logic, but Lua is now an intermediate option.
**Recommended Change:** Replace "Custom logic requires WASM filters (Go or Rust) or ext_proc external processors. Steeper than Lua plugin development" with: "Custom logic can be expressed via Lua scripts (added in v1.5 via EnvoyExtensionPolicy), WASM filters (Go or Rust), or ext_proc external processors. Lua provides a lower entry barrier for simple transformations; WASM is required for stateful or complex processing."

---

### Finding 5: Governance — Microsoft and Red Hat Attribution Unverified
**Severity:** Major
**Claim in ADR:** "Multi-vendor (Tetrate, Alibaba, Microsoft, Red Hat and others contribute)."
**Verified Status:** Partially Inaccurate
**Evidence:** Review of the Envoy Gateway GOVERNANCE.md and steering committee records does not confirm Microsoft or Red Hat as named steering committee members or primary contributors. The verified major contributors are: **Tetrate, Alibaba, VMware/Broadcom, Ambassador Labs, and Fidelity Investments**. Microsoft and Red Hat have employees who have contributed PRs, but are not governance participants at the level the ADR implies.
**Recommended Change:** Replace "Tetrate, Alibaba, Microsoft, Red Hat and others" with "Tetrate, Alibaba, VMware/Broadcom, Ambassador Labs, and Fidelity Investments, among others."

---

### Finding 6: TEG Claims — Accurate with One Nuance
**Severity:** Minor
**Claim in ADR:** "TEG is 100% upstream Envoy Gateway with no proprietary forks or API divergence — adopting TEG does not introduce lock-in; migrating away from TEG to vanilla Envoy Gateway requires only a change in image source, not a config rewrite."
**Verified Status:** Mostly accurate — one nuance
**Evidence:** TEG 1.7.0 → Envoy Gateway 1.7.1 mapping, FIPS verification, Coraza WAF integration, and September 1, 2026 upgrade deadline are all confirmed accurate. However: TEG's Coraza WAF integration uses a TEG-specific `ExtendedSecurityPolicy` CRD that is not present in upstream Envoy Gateway. If the team adopts Coraza WAF via TEG, migrating away from TEG requires replacing `ExtendedSecurityPolicy` resources — a mild config lock-in the "no API divergence" claim understates.
**Recommended Change:** Add: "Note: TEG's optional Coraza WAF feature uses an `ExtendedSecurityPolicy` CRD not present in upstream Envoy Gateway. Teams adopting this TEG-specific feature should account for re-expressing WAF config if migrating back to the open-source upstream."

---

### Finding 7: Origin Story — VMware Omission
**Severity:** Informational
**Claim in ADR:** "born from the consolidation of efforts by Tetrate, Ambassador and others"
**Verified Status:** Incomplete
**Evidence:** VMware (via its Contour project team) was an equally significant founding contributor to Envoy Gateway, alongside Tetrate and Ambassador Labs. The project was explicitly created to prevent the fragmentation caused by multiple competing Envoy-based controllers including Contour, Emissary-Ingress (Ambassador), and Tetrate's own implementation.
**Recommended Change:** Change to: "born from the consolidation of efforts by Tetrate, Ambassador Labs, VMware (Contour), and others."

---

## Omissions

The following Envoy Gateway characteristics are not mentioned in the ADR and are material for a 100-tenant production decision:

| Omission | Significance |
|---|---|
| **Redis fail-open behavior** | If the Redis instance is unavailable, global rate limiting fails open (requests pass without rate limiting). This is a security consideration for multi-tenant platforms. |
| **Control plane HA** | Envoy Gateway controller supports multiple replicas with leader election. The ADR should specify minimum replica count for production. |
| **Data plane HA per Gateway** | Each Gateway resource provisions its own Envoy proxy pods. HA requires configuring `EnvoyProxy` with `replicas: 2+`. The ADR does not address this. |
| **6-month EOL cadence** | Envoy Gateway releases follow a 6-month minor release cycle with a defined EOL window. Teams must track upgrades. The TEG upgrade deadline (September 1, 2026 for 1.6.x users) illustrates this. |
| **CVE-2025-24030** | A known CVE in versions prior to v1.7.0 affecting JWT validation. Relevant context for the security posture discussion. |

---

## HA and Production Readiness Assessment

The ADR adequately addresses the AKS compatibility question but is underspecified on production readiness for 100 tenants:

1. **Control plane:** Envoy Gateway controller must be deployed with `replicas: 2+` and a `PodDisruptionBudget`. Not mentioned.
2. **Data plane:** Each `Gateway` resource creates an `EnvoyProxy` deployment. For 100 tenants, this means 100 EnvoyProxy deployments minimum. At HA settings (`replicas: 2`), that is 200 Envoy proxy pods. The ADR's "controller pod plus Envoy proxy pods provisioned per Gateway resource" description is accurate but understates the operational surface.
3. **Redis HA:** The ADR notes Redis as an operational dependency but does not specify whether Redis must be HA for rate limiting to function reliably. Redis failure causes rate limiting to fail open.
4. **Rate limiting bug (Finding 2):** The active GitHub issue #8707 is the most significant production readiness concern.

---

## Overall Assessment

**Decision Validity:** Supported — with required revisions
**Rationale:** Envoy Gateway is the correct platform choice. It is the reference north-south gateway for Kubernetes, with the strongest feature-to-requirement match for this platform's OIDC, JWT rate limiting, and mTLS requirements. The two critical corrections (v1.0 date, rate limiting bug disclosure) and the governance attribution correction must be made before archiving. The Lua extension model update removes one of the stated consequences (WASM development requirement is now less severe). The decision stands; the supporting evidence needs correction.
