# Scrum Master Review — Final Consistency and Sequencing Review

**Reviewer:** Senior Scrum Master
**Date:** 2026-05-17
**Scope:** All 25 stories across 5 epics (EG-100 through EG-502)
**Input files reviewed:**
- `docs/reviews/review-jira-pm.md`
- `docs/reviews/review-jira-platform-engineer.md`
- `docs/reviews/review-jira-go-developer.md`
- `docs/JIRA.md` (original, 22 stories)

---

## Consistency Issues Found

### 1. Point Scale

All stories use Fibonacci scale (1, 2, 3, 5, 8, 13). No T-shirt sizing or day-based estimates found.

**Issue:** The original JIRA.md has no point estimates on any story. All point estimates are introduced in the Platform Engineer and Go Developer review files.

**Resolution applied:** All point estimates from the review files are incorporated into the final JIRA.md.

**Point summary by story:**

| Story | Points |
|---|---|
| EG-100 | 2 |
| EG-101 | 2 |
| EG-102 | 3 |
| EG-103 | 3 |
| EG-104 | 2 |
| EG-105 | 3 |
| EG-106 | 5 |
| EG-201 | 3 |
| EG-202 | 3 |
| EG-203 | 2 |
| EG-210 | 3 |
| EG-301 | 3 |
| EG-302 | 5 |
| EG-302a | 1 |
| EG-303 | 5 |
| EG-304 | 5 |
| EG-305 | 8 |
| EG-306 | 3 |
| EG-307 | 5 |
| EG-401 | 3 |
| EG-402 | 2 |
| EG-403 | 5 |
| EG-404 | 3 |
| EG-405 | 3 |
| EG-406 | 3 |
| EG-501 | 5 |
| EG-502 | 3 |

**Total: 93 story points across 25 stories**

---

### 2. AC Format

All ACs in the reviewed stories use checkbox format (`- [ ] criterion`). Consistent across all three review outputs.

**Issue found:** The original JIRA.md does not use checkbox format — ACs are written as plain bullet points without `[ ]`. All ACs have been rewritten to checkbox format in the final JIRA.md.

**Vague ACs corrected or not carried forward from original:**
- EG-102: "Controller logs show no errors on startup" — replaced with specific log string verification
- EG-105: "Policy does not block existing Kong or other platform resources" — replaced with testable Kong pod + route check
- EG-201: "Configuration change is scripted or documented for repeatability" — replaced with "Azure CLI script or Bicep delta committed to platform repo"
- EG-202: "Envoy access logs show correct client IP (not App Gateway IP)" — corrected; this AC was architecturally incorrect at EG-202 stage (ClientTrafficPolicy not yet deployed); replaced with pre-EG-203 behavior documentation AC
- EG-307: "No errors in operator logs" — tightened to ERROR-level structured log entries

---

### 3. Dependency Chain Correctness

The required dependency chain per the task specification:

```
EG-100 → EG-101 → EG-102 → EG-103 → EG-106 → EG-201 → EG-202 → EG-203
EG-102 → EG-104 → EG-106
EG-103 → EG-105
EG-103 → EG-403 → EG-404 → EG-405 → EG-406
EG-202 → EG-210 (new Lua story)
EG-301 → EG-302 → EG-302a (RBAC)
EG-302a → EG-303 → EG-304 → EG-306
EG-303 → EG-305
EG-304, EG-305, EG-306 → EG-307
EG-307 + EG-203 + EG-406 → EG-501 → EG-502
EG-102 → EG-401 → EG-402
```

**Issue 1 — EG-304 circular dependency in Go Developer review:**
The Go Developer review file lists EG-304 as depending on `EG-303, EG-306`. This is a circular reference: EG-306 depends on EG-304, so EG-304 cannot also depend on EG-306. The correct dependency for EG-304 is EG-303 only. The note in EG-304 correctly states that "translation logic can be developed independently" from EG-306. EG-306's dependency on EG-304 stands.

**Resolution applied:** EG-304 depends on: EG-303 (only). EG-306 depends on: EG-304 (unchanged).

**Issue 2 — EG-302a positioning:**
The Go Developer review correctly establishes EG-302a as depending on EG-302 and being a prerequisite for EG-303. The dependency chain is: EG-302 → EG-302a → EG-303. This is consistent with the required chain: `EG-301 → EG-302 → EG-302a (RBAC)` and `EG-302a → EG-303`.

**Resolution applied:** EG-302a depends on EG-302. EG-303 depends on EG-302 and EG-302a.

**Issue 3 — EG-307 cross-epic dependencies:**
The original JIRA.md lists EG-307 as depending only on Epic 3 stories. The PM review and Go Developer review both correctly identify that EG-307 also depends on EG-106, EG-201, and EG-202 (the ingress chain must be complete before operator integration testing is possible).

**Resolution applied:** EG-307 depends on: EG-303, EG-304, EG-305, EG-306, EG-302a, EG-106, EG-201, EG-202.

**Issue 4 — EG-105 dependency on EG-103 confirmed:**
Required chain shows `EG-103 → EG-105`. Confirmed correct — EG-105 enforces GatewayClass which is created in EG-103.

**Issue 5 — EG-106 dependency on EG-103 and EG-104 confirmed:**
Required chain shows both `EG-103 → EG-106` and `EG-104 → EG-106`. EG-106 needs the GatewayClass (EG-103) and Redis (EG-104) before a Gateway can be provisioned. Confirmed correct.

**Full dependency chain as verified — no further issues found.**

---

### 4. Story ID Ordering and Epic Grouping

**Issue found:** EG-210 (new Lua story) must be positioned within Epic 2 (Ingress Chain Integration), after EG-203. The Platform Engineer review file groups it correctly as an Epic 2 story. In the final JIRA.md, EG-210 is placed after EG-203 under Epic 2, maintaining sequential logical flow.

**Note on ID gap:** There is a gap between EG-203 and EG-210. This is intentional — the ID EG-210 was assigned by the PM review (as either "EG-203a or EG-210") and the Platform Engineer chose EG-210. The gap (EG-204 through EG-209) is acceptable for a JIRA context where IDs are assigned non-sequentially. No renaming applied.

**EG-302a positioning:** Placed between EG-302 and EG-303 in Epic 3 ordering. ID is logical (302a = sub-story of 302). Accepted as-is.

---

### 5. Persona Consistency

| Epic | Expected Persona | Verified |
|---|---|---|
| Epic 1 (EG-100 to EG-106) | Senior Infrastructure Engineer | Confirmed |
| Epic 2 (EG-201 to EG-210) | Senior Infrastructure Engineer | Confirmed |
| Epic 3 (EG-301 to EG-307) | Senior Developer | Confirmed |
| Epic 4 (EG-401 to EG-406) | Senior Infrastructure Engineer | Confirmed |
| Epic 5 (EG-501 to EG-502) | Platform Engineering Lead | Confirmed |

No persona inconsistencies found.

---

### 6. Cross-Story Terminology

Checked all stories in the review files against required terminology:

| Term | Status |
|---|---|
| "Envoy Gateway" | Consistent — no instances of "envoy gateway" or "EG" abbreviation used as a term |
| "BackendTrafficPolicy" | Consistent — no "Backend Traffic Policy" or "BTP" found |
| "SecurityPolicy" | Consistent — no "Security Policy" found |
| "HTTPRoute" | Consistent — no "HttpRoute" or "HTTP Route" found |
| "GatewayClass" | Consistent — no "Gateway Class" found |
| "EnvoyProxy" | Consistent — no "Envoy Proxy CRD" found |
| "GitHub issue #8707" | **Issue found** — Go Developer review references the issue as `github.com/envoyproxy/gateway/issues/8707` in EG-305 Notes. All AC references correctly use "GitHub issue #8707". The URL-format reference in Notes is acceptable as supplementary; the canonical term is used in all ACs. No correction needed. |
| "EnvoyExtensionPolicy" | Consistent |
| "ClientTrafficPolicy" | Consistent |

No critical terminology inconsistencies requiring story revision.

---

### 7. Missing Story Check

| Story | Present in Review Files | Included in Final JIRA |
|---|---|---|
| EG-100 (ACR mirror) | Platform Engineer review | Yes |
| EG-210 (Lua extension validation) | Platform Engineer review | Yes |
| EG-302a (Operator RBAC) | Go Developer review | Yes |
| All 22 original stories | Original JIRA.md | Yes |

**Total story count: 25. Confirmed.**

---

### 8. Feature-Level AC Updates (from PM direction)

The following updates to the Feature EG-001 acceptance criteria were applied:

1. **Rate limiting AC updated:** Added explicit one-Gateway-per-namespace constraint and reference to GitHub issue #8707 workaround.
2. **SecurityPolicy non-portability noted:** Added explicit statement that SecurityPolicy is a proprietary Envoy Gateway resource and team accepts this as a PoC-scoped decision.
3. **GatewayClass governance added:** Added AC that all Gateways in PoC use `platform-gateway` GatewayClass (enforced by EG-105 Kyverno policy).
4. **Lua extension validation added:** Added AC to validate Lua extension capability via `EnvoyExtensionPolicy`.
5. **"Existing dev tenant on Kong unaffected" tightened:** Added specific definition — existing Kong LB IP continues to serve traffic, Kong routes respond with HTTP 200, no Kong config changes made.
6. **ArgoCD dependency noted:** Added explicit statement that ArgoCD is assumed operational in dev cluster as a feature-level prerequisite.

---

## Corrections Applied vs. Issues Flagged

### Corrections Applied (minor — applied directly)

| Issue | Correction Applied |
|---|---|
| EG-304 circular dependency (depends on EG-306) | Corrected: EG-304 depends on EG-303 only |
| EG-404 config reference used port 19001 (wrong — should be 9902 for proxy pod metrics) | Corrected: port 9902 in configuration reference YAML |
| EG-307 missing cross-epic dependencies | Added: EG-106, EG-201, EG-202 as explicit dependencies |
| Feature-level ACs did not reflect PM direction | Updated feature-level ACs per all 5 PM directions |
| Original ACs not in checkbox format | All ACs converted to `- [ ]` format |
| Original stories missing point estimates | All point estimates added from review files |
| EG-302a positioning in dependency chain | Explicitly placed: EG-302 → EG-302a → EG-303 |

### Issues Not Requiring Revision (acceptable as-is)

- ID gap between EG-203 and EG-210: acceptable; JIRA IDs are non-sequential by design
- EG-302a ID: "302a" sub-ID is acceptable for JIRA; no rename applied
- GitHub issue URL format in EG-305 Notes: acceptable; canonical "GitHub issue #8707" used in all ACs

### No stories sent back to sub-agents

All corrections were minor and applied directly. No substantive content gaps requiring sub-agent revision were found — the Platform Engineer and Go Developer reviews were comprehensive and accurate.

---

## Sprint Planning Summary

### Points by Epic

| Epic | Stories | Story Points |
|---|---|---|
| Epic 1: Platform Infrastructure | EG-100, EG-101, EG-102, EG-103, EG-104, EG-105, EG-106 | 20 |
| Epic 2: Ingress Chain Integration | EG-201, EG-202, EG-203, EG-210 | 11 |
| Epic 3: Operator Translation Rewrite | EG-301, EG-302, EG-302a, EG-303, EG-304, EG-305, EG-306, EG-307 | 35 |
| Epic 4: Observability | EG-401, EG-402, EG-403, EG-404, EG-405, EG-406 | 19 |
| Epic 5: PoC Validation | EG-501, EG-502 | 8 |
| **Total** | **25 stories** | **93 points** |

### Parallelization Opportunities

**Epic 1:**
- EG-104 (Redis) can run in parallel with EG-103 (GatewayClass/EnvoyProxy) — both depend only on EG-102.
- EG-105 (Kyverno policy) can be worked by a second engineer while EG-104 is in progress — EG-105 depends on EG-103 only.

**Epic 2:**
- EG-210 (Lua validation) can run in parallel with EG-203 (XFF trust chain) — both depend on EG-202. No sequencing dependency between EG-203 and EG-210.

**Epic 3:**
- EG-304 (SecurityPolicy) and EG-305 (BackendTrafficPolicy) can run in parallel after EG-303 — both depend on EG-303 but not on each other.
- EG-302a (RBAC) can be worked immediately after EG-302 scaffolds the operator ServiceAccount, running in parallel with early EG-303 work (translation logic can be written before RBAC is applied to the cluster).

**Epic 4:**
- EG-401 (Azure Monitor) can start as soon as EG-102 is complete — it does not depend on EG-106 or Epic 2.
- EG-403 (Datadog tracing) can start as soon as EG-103 is complete — it does not depend on Epic 2 validation being complete.
- EG-403, EG-404, EG-405 chain is sequential, but this chain can run in parallel with Epic 3 work.

**Epic 5:**
- EG-501 and EG-502 are terminal stories with no parallelization opportunity within Epic 5.

### Suggested Sprint Allocation

Assuming a team velocity of approximately 30–35 points per sprint (Senior Infrastructure Engineer + Senior Go Developer + Platform Engineering Lead):

| Sprint | Stories | Points |
|---|---|---|
| Sprint 1 | EG-100, EG-101, EG-102, EG-103, EG-104, EG-105 | 15 |
| Sprint 2 | EG-106, EG-201, EG-202, EG-203, EG-210, EG-301, EG-401 | 24 |
| Sprint 3 | EG-302, EG-302a, EG-303, EG-402, EG-403 | 18 |
| Sprint 4 | EG-304, EG-305, EG-404, EG-405 | 19 |
| Sprint 5 | EG-306, EG-307, EG-406, EG-501, EG-502 | 19 |

**Note:** Sprint allocation is indicative. Epic 3 (35 pts) is the critical path. EG-305 (8 pts) is the highest-risk single story — it should be started at the beginning of its sprint with clear acceptance of the bug #8707 architectural constraint before the sprint begins. Adjust sprint boundaries based on actual team velocity and AKS environment readiness.
