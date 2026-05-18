# Editorial Review: ADR-002

**Reviewer:** Technical Writer (editorial pass)
**Date:** 2026-05-17
**Scope:** Grammar, consistency, clarity, structure, table formatting, ADR standards, reference list

---

## 1. Changes Made and Rationale

### Grammar and mechanics

- **Line 64 / conformance note:** Added missing comma after "However" ("However, it is an accurate characterisation..."). Same fix applied to the Traefik section ("However, two capability gaps...").
- **Line 120:** Added comma after "e.g." to conform to standard usage: `(e.g., critical CVEs...)`.
- **Line 156 (Istio governance):** Added Oxford comma in list — "Google, IBM, Solo.io, and others." Softened "burned operators in the past" to "affected operators in past releases" — the original phrasing is accurate but reads as informal in an engineering decision record.
- **Conformance tracking sentence (Option 1):** Restructured a passive/ambiguous construction — "The conformance lag should be tracked and the ADR revisited..." — into active, parallel form: "The conformance lag should be tracked, and this ADR should be revisited..."

### Consistency — resource name formatting

All Kubernetes resource type names and custom resource names are now consistently formatted in backtick code style throughout the document body, callouts, migration sequencing list, and evaluation table. Prior to this pass, the same resource appeared with and without backticks depending on context:

- `SecurityPolicy`, `BackendTrafficPolicy`, `HTTPRoute`, `RequestAuthentication`, `EnvoyExtensionPolicy`, `EnvoyPatchPolicy`, `ClientTrafficPolicy` — all now code-style wherever they appear in prose
- Evaluation table rows for "Native OIDC" and "Native JWT rate limiting" updated: `SecurityPolicy [EG]` and `BackendTrafficPolicy [EG]` now use backtick formatting on the resource names

### Consistency — `BackendTrafficPolicy` parenthetical note (Option 1 capability list)

The bullet for `SecurityPolicy` used the format `*(Envoy Gateway extension: gateway.envoyproxy.io)*`. The bullet for `BackendTrafficPolicy` used a different format: `*(partly standard Gateway API Experimental, partly Envoy Gateway extension)*`. These are now parallel — both use `*(Envoy Gateway extension: gateway.envoyproxy.io; ...)*` with the additional clarification that `BackendTrafficPolicy` overlaps with the standard Gateway API Experimental resource of the same name.

### Consistency — Linkerd table row

`Linkerd` showed `Graduated` in plain text in the CNCF Status column while `Cilium` and `Istio` showed `**Graduated**` in bold. Fixed to bold for visual consistency.

### Consistency — "Note on Traefik open-source rate limiting" callout

This callout used the bold-prefix style (`**Note on...:**`) while all other important notes in the document use the blockquote callout style (`> **Note...**`). Converted to blockquote to match the pattern used by the API portability note and the rate limiting bug disclosure.

### Clarity — Option 1 opening sentence

The original opening had a redundancy: the first sentence described Envoy Gateway as "initiated as a vendor-neutral alternative to the fragmented ecosystem" and the second sentence said it "addressed fragmentation across multiple competing" ingress controllers. Both sentences stated the same motivation in different words. Merged into a single clear statement.

### Clarity — TEG double-definition

"Tetrate Enterprise Gateway for Envoy (TEG)" was defined with its full expansion on line 100, then defined again in full on line 106 ("Tetrate Enterprise Gateway for Envoy (TEG) provides..."). The second instance was shortened to "TEG provides..." since the acronym was already established.

### Clarity — "Config portability" (Consequences section)

"Config" abbreviated to "Configuration" for professional register in a formal decision record.

### Clarity — Operator rebuild description

"rebuilt, not retargeted" was slightly ambiguous out of context. Changed to "rebuilt from scratch, not retargeted" and "requires investment" to "requires upfront investment" — minor but removes ambiguity.

### Table — CNI upgrade coupling row (emoji logic inversion)

The "CNI upgrade coupling" criterion had inverted emoji semantics. All other rows use `✅` to indicate a positive/good outcome and `❌` for a negative/bad outcome. In the CNI coupling row, `❌ None` was used for Envoy Gateway (no coupling = good outcome) and `✅ Coupled` for Cilium (coupling = bad outcome) — the opposite of the document's visual convention.

Corrected to `✅ None` (no coupling = good) and `❌ Coupled` (coupling = bad), consistent with all other rows.

### References — inline comment flags

Two references were flagged with inline HTML comments (not rendered in Markdown output):

1. **CNCF project maturity criteria URL** (`/project-metrics/`) — the URL resolves to a project metrics dashboard, which may not be the most authoritative source for the graduation criteria the ADR cites. The TOC graduation criteria document or the CNCF projects page may be more appropriate. Flagged for author verification.
2. **ADR-001 internal reference** — listed with title only, no file path or URL. Flagged for author to add a relative path or link once ADR-001 is published.

---

## 2. Structural Issues Requiring Author Decision

These are not editorial corrections — they require a judgment call from the author or deciders.

### Option 1 heading — "initiated as" origin sentence

The opening of Option 1 previously contained a slightly redundant double-mention of Envoy Gateway's origin story. The editorial pass merged these into one sentence, but the author should confirm the merged phrasing accurately represents the project's history as they understand it.

### `[EG]` notation in the evaluation table

The `[EG]` table key is defined in a blockquote immediately below the table. This works but is unconventional — readers scanning the table may not notice the key below it. An alternative would be to add a column header note ("Resource type — see key below") or move the key above the table. This is a layout decision, not an editorial one.

### "Candidates meeting CNCF Graduated constraint" summary line

Line 66 states: "Candidates meeting CNCF Graduated constraint: Cilium, Istio, Linkerd." Linkerd is included here because it is CNCF Graduated, but it is immediately eliminated as out-of-scope (mesh profile only, not a north-south gateway). A reader might wonder why Linkerd appears as a "candidate" when it is not a real option for this use case. The author may want to add a parenthetical — e.g., "Cilium, Istio, Linkerd (mesh-only; east-west traffic)" — to make the exclusion clear at the summary line rather than only in the table.

### Conformance version discrepancy: Cilium at v1.5.1 vs. spec at v1.5.0

The document states the current Gateway API specification release is v1.5.0, but the Cilium conformance report is listed at v1.5.1. The conformance version note explains that the conformance version refers to the spec version against which the report was submitted, not the implementation version. If v1.5.1 is a real Gateway API spec patch release, this is accurate. If it is a data entry error in the source or if patch releases are not tracked separately by the implementations list, the author should verify.

---

## 3. References That Appear Broken or Should Be Verified

| Reference | Issue |
|---|---|
| `https://www.cncf.io/project-metrics/` | URL resolves to project metrics dashboards, not graduation criteria. Consider linking directly to the CNCF TOC graduation criteria: `https://github.com/cncf/toc/blob/main/process/graduation_criteria.md` |
| `https://gateway.envoyproxy.io/news/blogs/1.0-release/` | URL structure for Envoy Gateway blog posts may have changed — verify this resolves to the March 2024 1.0 release announcement |
| `https://docs.tetrate.io/envoy-gateway/release-announcement` | Generic path — no version anchor. Verify this resolves to the TEG 1.7.0 release announcement specifically, not a generic page |
| `https://www.cncf.io/blog/2026/04/13/ingress-nginx-to-envoy-gateway-migration-on-cncf-internal-services-cluster/` | Future-dated URL (April 2026); cannot be verified at time of this review. Author should confirm the slug is accurate when the post is published or has been published |
| `ADR-001: API Gateway Platform Selection` | No path or URL. Add relative path to the ADR-001 file in this repository |
| Conformance report GitHub URLs (multiple) | These link to `blob/main/...` paths, which will reflect the repository's HEAD at time of access, not the specific commit at time of this ADR's authoring. Consider linking to specific commit SHAs for archival accuracy, or acknowledge that the links are live references |
