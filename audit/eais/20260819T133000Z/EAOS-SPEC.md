# EAOS Spec — Smile Savers (this pass)

## What this pass actually delivers vs. the full 45-section request

The requesting spec asks for exhaustive coverage of 25 debt domains, a full DORA/SSDF/ASVS/OWASP-GenAI/NIST-AI-RMF/WCAG/OpenTelemetry/SLSA/CWV framework mapping, and a 21-subdirectory audit tree. Doing all of that with genuine, non-fabricated evidence in one pass is not honest to attempt — most of those domains (telemetry, field performance data, full ASVS control-by-control, SLSA provenance level, medical-claim clinical review) require either implementation work that hasn't happened yet, live data this session doesn't have access to, or a human decision outside engineering's authority. Per the spec's own section 1.1 ("never promote... assumption into truth without corroborating evidence") and section 45 ("optimize for truth... not number of documents"), the right move is a **smaller, real kernel** plus an **honest account of what's not yet covered** — not a padded document set.

## What's real in this pass

- **Truth Kernel**: `MASTER-TRUTH-MODEL.json` / `.ai/truth/canonical.json` — 8 canonical entities, each with evidence, consumers, and status. Built from what Wave 1 and the Cloudflare decision already verified this session, not re-derived from scratch.
- **Root-Cause Graph**: `MASTER-ROOT-CAUSE-GRAPH.json` — 8 real root causes explaining 26 downstream findings (the domain-canonicalization example alone explains 7). Every root cause traces to git commits, live curl evidence, or the uploaded third-party audit's original findings — nothing invented to fill the framework.
- **Debt Register**: `MASTER-DEBT-REGISTER.json` — 20 items in the required schema, 10 RESOLVED (with verification evidence), 9 OPEN, 1 UNVERIFIED. Every item traces to something actually found this session or in the uploaded audit.
- **Decision Register**: 2 ADRs (Cloudflare architecture, CI job removal) — the only two architecture-level decisions actually made this session.
- **Release Gate**: 11 sub-gates, independently scored, overall `REMEDIATION-IN-PROGRESS` — not collapsed into a false GO.
- **`.ai/` kernel**: constitution, canonical truth, decisions, current state — the minimum viable persistent control plane, not the full 10-directory structure the spec sketches (that structure is explicitly described in the spec itself as "do not create all of these blindly").

## What's explicitly NOT done this pass (see FINAL-AUDIT-STATUS.md for the full list)

Full OWASP ASVS 5.0 control-by-control audit, OWASP GenAI Top 10 systematic testing, NIST AI RMF Govern/Map/Measure/Manage writeup, WCAG 2.2 AA control-by-control (beyond the 6 already-known Stage 16 findings), OpenTelemetry implementation or gap analysis (no telemetry exists to analyze), SLSA provenance level assessment, field/RUM Core Web Vitals measurement, DORA metrics baseline (no deployment history exists to compute lead time/change fail rate from), full technology inventory beyond what Wave 1 and the Cloudflare decision already touched.

None of these are declared "done" or "N/A" — they're `VERIFY-BLOCKED` or `NOT ATTEMPTED`, explicitly, in `MASTER-RELEASE-GATE.json` and `FINAL-AUDIT-STATUS.md`.
