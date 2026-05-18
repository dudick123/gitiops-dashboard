# Traefik Expert Review — ADR-002

**Reviewer:** Traefik Expert (Sub-Agent)
**Date:** 2026-05-17
**Scope:** All Traefik-related claims in ADR-002

---

## Executive Summary

The ADR's treatment of Traefik is largely accurate in its conclusion — the CNCF governance constraint is correctly applied and the disqualification stands — but contains three material inaccuracies that overstate Traefik's capability gap relative to Envoy Gateway. Specifically: (1) the body text cites the wrong conformance version, (2) global Redis-backed rate limiting is available in Traefik open source as of v3.4, not Hub-only as implied, and (3) the "replace one commercial dependency with another" characterization is overstated. These inaccuracies do not change the outcome but should be corrected for accuracy and fairness.

---

## Findings

### Finding 1: CNCF Status — Incomplete Context
**Severity:** Informational
**Claim in ADR:** "Traefik is not a CNCF project. It is maintained solely by Traefik Labs, a commercial company, under an MIT license. It has never been submitted to CNCF at any maturity level."
**Verified Status:** Accurate but incomplete
**Evidence:** Confirmed via CNCF membership page — Traefik Proxy has never been submitted to CNCF as a hosted project at any maturity level (Sandbox / Incubating / Graduated). However, Traefik Labs is a CNCF Silver Member. This does not change the disqualification — CNCF membership for the company is distinct from CNCF project hosting — but the omission may cause readers to underestimate Traefik's ecosystem engagement.
**Recommended Change:** Add a parenthetical: "It has never been submitted to CNCF at any maturity level (Traefik Labs is a CNCF Silver member, but corporate membership does not confer project governance protections)."

---

### Finding 2: Conformance Version Inconsistency in Body Text
**Severity:** Major
**Claim in ADR:** Body text states "full Gateway API v1.4 conformance, six-plus years of specification contribution, same-day support for new Gateway API releases." The conformance table correctly shows v1.5.1.
**Verified Status:** Inaccurate (body text is wrong)
**Evidence:** The Traefik conformance report at `kubernetes-sigs/gateway-api/conformance/reports/v1.5.1/traefik-traefik` is confirmed in the official repository. Traefik has conformance reports at v1.1.0, v1.2.1, v1.4.0, and v1.5.1. The current conformance level is v1.5.1, not v1.4. This is also the most current report of any implementation in the ADR's evaluation — including Envoy Gateway (last at v1.4.0).
**Recommended Change:** Change "full Gateway API v1.4 conformance" to "full Gateway API v1.5.1 conformance" in the body text to match the table.

---

### Finding 3: JWT/OIDC "Hub Only" Characterization — Outdated
**Severity:** Major
**Claim in ADR:** "JWT validation, OIDC, and per-route security policies at the level required for this platform's multi-tenant model are part of Traefik Hub — the commercial API management tier — not the open-source proxy."
**Verified Status:** Partially Inaccurate / Outdated
**Evidence:**
- The official `traefik-plugins` GitHub org publishes a JWT validation plugin that works with open-source Traefik v3.
- Traefik's official documentation describes OIDC integration via `forwardAuth` middleware (open source), delegating token validation to an external auth server.
- Native first-party built-in OIDC middleware (without external auth server) is a Hub/Enterprise tier feature.
- The ADR's framing ("are part of Traefik Hub... not the open-source proxy") implies the capability is entirely unavailable in open source, which is incorrect.
**Recommended Change:** Replace the absolute statement with: "Native first-party OIDC and JWT validation middleware is a Traefik Hub tier feature. The capability is achievable in open-source Traefik v3 via plugin or `forwardAuth` integration with an external identity provider, but requires additional operational surface not present in Envoy Gateway's native `SecurityPolicy`."

---

### Finding 4: Global Redis Rate Limiting — Materially Inaccurate
**Severity:** Major
**Claim in ADR:** Table shows `⚠️ Via middleware` for Global rate limiting (Redis), implying Hub or limited open-source capability.
**Verified Status:** Inaccurate — outdated as of Traefik Proxy v3.4
**Evidence:** Traefik Proxy v3.4 (released 2025) shipped distributed Redis-backed rate limiting as a built-in open-source feature, confirmed by official Traefik documentation and Linuxiac release coverage. The `⚠️ Via middleware` characterization is outdated — distributed Redis rate limiting is now in the open core, not behind a commercial tier.
**Recommended Change:**
- Update table entry from `⚠️ Via middleware` to `✅ (Redis-backed, open source since v3.4)`
- Add a note: "Distributed Redis-backed global rate limiting was added to Traefik Proxy open source in v3.4."

---

### Finding 5: Route Propagation Latency — Accurate but Unattributed
**Severity:** Minor
**Claim in ADR:** "Independent benchmarking shows Traefik can take seconds to propagate route changes under load, compared to milliseconds for Envoy Gateway."
**Verified Status:** Accurate
**Evidence:** The Rivet engineering blog (June 2025) documents 1-2 second route propagation latency in production Traefik deployments, even at 500ms polling intervals. The `gateway-api-bench` project on GitHub provides formal benchmark methodology. The claim is accurate but should cite sources.
**Recommended Change:** Add citation: "...seconds to propagate route changes under load (see: Rivet Engineering, gateway-api-bench project), compared to milliseconds for Envoy Gateway."

---

### Finding 6: MIT License
**Severity:** Informational
**Claim in ADR:** "under an MIT license"
**Verified Status:** Accurate
**Evidence:** Confirmed in GitHub repository (`traefik/traefik`). No change required.

---

### Finding 7: Specification Contribution and Same-Day Conformance
**Severity:** Informational
**Claim in ADR:** "six-plus years of specification contribution, same-day support for new Gateway API releases"
**Verified Status:** Accurate
**Evidence:** Traefik has conformance reports at v1.1.0, v1.2.1, v1.4.0, and v1.5.1 — the most complete conformance history of any implementation in this evaluation, and the only one current at v1.5.1. The "same-day" characterization of support cadence is supported by this pattern.

---

### Finding 8: "Replace One Commercial Dependency with Another" — Overstated
**Severity:** Major
**Claim in ADR:** "This would replace one commercial dependency (Kong Konnect) with another (Traefik Hub)."
**Verified Status:** Overstated
**Evidence:** Given Finding 3 (JWT/OIDC achievable in open source via plugin/forwardAuth) and Finding 4 (Redis rate limiting now open source in v3.4), the statement is only accurate if the team requires native first-party OIDC middleware without operational complexity. The capability gap between Traefik open source and SecurityPolicy-equivalent functionality is narrower than the ADR implies.
**Recommended Change:** Revise to: "Achieving native first-party SecurityPolicy-equivalent capabilities (OIDC, per-route JWT enforcement) without additional operational surface would require Traefik Hub. Open-source alternatives exist via plugin and forwardAuth patterns but add operational complexity the platform team would need to own."

---

### Finding 9: No Multi-Vendor Governance
**Severity:** Informational
**Claim in ADR:** "The project has no multi-vendor governance model, no CNCF technical oversight committee, and no requirement for committers from independent organisations."
**Verified Status:** Accurate
**Evidence:** Confirmed. Traefik's commit history and maintainer list is dominated by Traefik Labs employees. No external co-maintainers from independent organizations are listed. No change required.

---

## Open Source Capability Assessment

As of Traefik Proxy v3.4 (2025):

| Capability | Open Source Status |
|---|---|
| HTTPRoute routing | ✅ Full |
| TLS termination | ✅ Full |
| Rate limiting (local) | ✅ Full |
| Rate limiting (Redis, distributed) | ✅ Full (added v3.4) |
| JWT validation (plugin) | ✅ Via plugin (community-maintained) |
| OIDC (forwardAuth) | ✅ Via external auth server |
| OIDC (native first-party middleware) | ❌ Hub tier |
| mTLS | ✅ Full |
| Circuit breaking | ✅ Via retry/circuit breaker middleware |
| Per-route security policies (SecurityPolicy equivalent) | ⚠️ Partial — requires forwardAuth or plugin |

The ADR's evaluation of Traefik's open-source capabilities is dated. The capability gap between Traefik open source and Envoy Gateway's native `SecurityPolicy`/`BackendTrafficPolicy` is real but narrower than stated.

---

## Fairness Assessment

The ADR is fair in applying the CNCF Graduated constraint uniformly and in acknowledging Traefik's strong conformance standing. Three areas are unfair or inaccurate:

1. The Redis rate limiting claim is materially wrong as of v3.4 — this should be corrected.
2. The JWT/OIDC "Hub only" framing overstates the capability gap.
3. "Replace one commercial dependency with another" is an overstatement that, while directionally reasonable, does not reflect the current open-source capability boundary.

These inaccuracies may bias the reader's evaluation of Traefik more negatively than the evidence warrants. The ADR should correct these even though they do not change the conclusion.

---

## Decision Impact

The CNCF Graduated constraint is correctly identified and consistently applied. Traefik Labs' single-vendor control of the project — regardless of its technical quality — is a legitimate governance risk at the 3-5 year planning horizon. No finding overturns the disqualification logic.

The Redis rate limiting and JWT/OIDC inaccuracies, if corrected, would narrow the stated capability gap but would not eliminate the CNCF governance disqualification.

---

## Overall Assessment

**Traefik Disqualification:** Upheld
**Rationale:** The CNCF governance constraint is sound and correctly applied. Traefik's single-vendor governance structure represents a legitimate risk for a platform infrastructure decision at 3-5 year horizon, regardless of the MIT license protection at the code level. The three material inaccuracies (conformance version, Redis rate limiting, JWT/OIDC characterization) should be corrected in the ADR for accuracy but do not change the outcome. The route propagation latency claim should be cited.
