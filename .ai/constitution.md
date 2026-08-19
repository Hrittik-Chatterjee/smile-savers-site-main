# Repository Constitution

Machine- and human-readable invariants for this repository. Any agent (Claude Code or otherwise) working here should read this file first.

## Non-negotiable invariants

1. No canonical business fact (domain, address, coordinates, hours, team roster) is hardcoded in more than one place. Single source: `src/config/site.ts`. See `.ai/truth/canonical.json`.
2. No P0/P1 fix ships without a way to verify it (a grep, a curl check, a manual test step, or an automated test) — see `.ai/gates/`.
3. No AI (Workers AI chat) call answers a question that `.ai/truth/canonical.json` can answer deterministically. Clinic hours, address, insurance, services are DETERMINISTIC, not AI-generated.
4. No raw patient-submitted PII (name, email, phone, message content) in logs. Correlation IDs only.
5. No dependency upgrade without a compatibility check first (this repo has not had one performed this session — treat all current versions as FROZEN until a compatibility pass is run).
6. No hard/architectural problem gets a cosmetic patch. If a fix requires touching `wrangler.jsonc`, deployment architecture, or a data-model change, it needs a spec and explicit user authorization first — see `.ai/decisions/`.
7. This repository is currently mid-remediation, not release-ready. Check `.ai/gates/release.json` before claiming otherwise.

## How to use this kernel

- `.ai/truth/canonical.json` — the single source of truth for clinic facts, with evidence and consumer lists. Check here before hardcoding any business fact.
- `.ai/decisions/` — accepted architecture decisions (ADRs). Check here before re-litigating something already decided (e.g. Pages vs Workers).
- `.ai/state/current.json` — what's done, what's open, what's next. Check here before re-auditing something already covered.
- `.ai/gates/release.json` — the current release gate state, per-category, never collapsed into one score.
- Full evidence trail for everything above: `audit/eais/20260819T133000Z/` and `audit/cloudflare-decision/`.

## What this kernel deliberately does NOT contain

Per this repo's own evidence-first discipline (see `design-intelligence/audit/semantic-model-gap.md`): no fabricated component anatomy, design patterns, or "best practice" claims not backed by actual repository evidence. `UNKNOWN` and `VERIFY-BLOCKED` are valid, expected states — use them rather than guessing.
