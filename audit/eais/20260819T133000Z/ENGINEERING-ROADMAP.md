# Engineering Roadmap — Smile Savers

Phase ordering, adapted from the requesting spec's section 32 to what's actually evidenced and actionable for this repo.

## Phase 0 — Evidence Kernel (this pass)

Delivered: baseline, truth model, root-cause graph, debt register, decision register, release gate, `.ai/` kernel.

## Phase 1 — Trust Kernel (substantially complete)

- ✅ Canonical domain (DEBT-0001)
- ✅ Canonical clinic data: coordinates, hours, dentist count (DEBT-0001, and DATA-001/002/CONTENT-002 from the original audit)
- ✅ Contact API transaction correctness + PII logging + escaping (DEBT-0002/0003/0004)
- ✅ CORS/CSP reconciliation (DEBT-0005/0006)
- ✅ Chat rate limiting (DEBT-0007)
- ✅ Privacy policy accuracy (DEBT-0008)
- ✅ Unsupported structured data removed (DEBT-0009/0010)
- ✅ Runtime architecture decision made (ADR-0001)
- ✅ Broken CI deploy job removed (ADR-0002)
- ⬜ **Open**: DEBT-0011 (security headers not applied to live API responses) — specified, not implemented, needs authorization.

## Phase 2 — Reliability Kernel (not started)

- DEBT-0012: build a test suite, starting with the highest-value regression tests for what Phase 1 just fixed (contact-API fail-closed behavior, chat rate-limit enforcement, a cheap grep-based domain-canonicalization regression check).
- DEBT-0013/0014: make security/perf CI checks blocking where they should be; align Node versions across workflows.
- DEBT-0011 implementation itself (small, already specified in `audit/cloudflare-decision/implementation-contract.md`).

## Phase 3 — AI Kernel (not started)

Not urgent per this session's evidence: `audit/cloudflare-decision/ai-stress-test.json` shows real AI-cost headroom is large relative to plausible traffic. Worth doing eventually: a deterministic-vs-AI-assisted classification for chat responses (hours/address/insurance should never be AI-generated, only AI-delivered from `.ai/truth/canonical.json`), and formal AI failure-mode tests (binding missing, quota exhausted, malformed output).

## Phase 4 — Discovery Kernel (partially done)

SEO fixes done in Phase 1 (DEBT-0009/0010). Remaining: DEBT-0016 (medical-claim provenance) — needs a clinical/practice-owner decision before engineering can act.

## Phase 5 — Experience Kernel (not started)

DEBT-0017 (6 known WCAG violations from design-intelligence Stage 16), DEBT-0018 (TypeScript suppressions in accessibility-relevant files), DEBT-0015 (appointment-flow product decision), and CWV field measurement once there's a way to collect it (no RUM tooling currently exists).

## Phase 6 — Stack Hygiene (not started)

DEBT-0020 (run `npm audit` in a network-enabled environment), a real dependency compatibility pass before any version bump (per `.ai/constitution.md` invariant 5 — the stack is currently FROZEN, not because anything is known to be wrong, but because nothing has been checked).

## What determines the next actual step

Per `.ai/state/current.json`'s `nextRequiredAction`: this needs a user decision, not another audit — either authorize DEBT-0011 (small, specified, ready to implement) or pick a Phase 2+ priority.
