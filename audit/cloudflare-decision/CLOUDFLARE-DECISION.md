# Cloudflare Decision — Smile Savers

> **Updated with additional live-verified evidence.** The decision direction is unchanged, but one claim below was wrong and is corrected: Cloudflare's official Pages→Workers migration path *does* require compiling `functions/` via `wrangler pages functions build` — Smile Savers instead uses a working hand-rolled bypass (`src/entrypoint.js`), not "no compilation needed" in general. A new finding (no `_routes.json` exists in this repo) strengthens the Economics/Architecture-fit case for Workers independently. See `migration-risk.json`, `counterevidence.md`, and `CLOUDFLARE-DECISION.json` for the full detail; this file's narrative sections below are updated to match.

## Decision

**WORKERS — CONDITIONAL GO**

Conditional because: (1) the security-header gap (`_middleware.js` never invoked by `entrypoint.js`) must be fixed as part of formalizing this choice, not left as-is; (2) the Growth/future-capability category's evidence wasn't independently re-verified to Class A this pass (see `decision.md` Limitations).

## Confidence

**80%**

## Evidence

- Class A: 5 (Workers pricing, Workers AI pricing, Workers platform limits, Pages Functions routing/`_routes.json`, Pages→Workers migration guide — all re-fetched live)
- Class B: 4 (`wrangler.jsonc`, `src/entrypoint.js`, `.github/workflows/deploy.yml`, and a repo-wide search confirming no `_routes.json` exists)
- Class C: 4 (live homepage headers, live `/api/contact` OPTIONS, live `/api/chat` POST, live `robots.txt`)
- Class D: 1 (this session's own PR-comment history)
- Unresolved: the Growth/future-capability category (Durable Objects/Cron/observability breadth) still rests on the user-supplied research packet's paraphrase rather than an independently re-fetched exact quote — see `CLOUDFLARE-DECISION.json`'s `unresolvedItems`.

## Quantified result

- Workers Free request capacity: 100,000/day (static assets don't count against this at all, under Workers — CF-A1; under Pages **only if** `_routes.json` correctly excludes them, which this repo's Pages config does not have — CF-A9, REPO-B4).
- Peak-day safety margin: effectively unbounded for this site's realistic API-call volume (dozens–hundreds/day vs. 100,000/day quota) — see `COST-MODEL.json`'s `peakDayStressCase`.
- AI free-neuron capacity: 10,000 neurons/day.
- Typical (1200-in/150-out) AI requests/day before exhausting free tier: **~983** (DERIVED, matches the correction supplied this pass — see `ai-stress-test.json`; the first-pass figure of ~1,172 used a lighter 800/150 profile and is superseded).
- Heavy (1500-in/200-out) AI requests/day before exhausting free tier: **~760** (supersedes the first pass's ~839, same reason).
- Estimated paid overage: negligible even at high volume — $0.06/month at 1,000 typical requests/day, ~$40/month even at a 10,000/day heavy-profile scenario far beyond this practice's plausible traffic (full table in `ai-stress-test.json`).
- Migration effort/risk: **low-medium** (revised from "low" — see `migration-risk.json`). The security-header fix and CI-job retirement are still small, well-scoped changes, but the first pass understated how much of the current working state is a hand-rolled bypass of Cloudflare's own recommended compile step, which is real (if currently manageable) technical debt at this API surface's size.

## Counterevidence

Full detail in `counterevidence.md`. Summary: three of four stress-test counterarguments do not survive (staying on Pages, hitting the Workers Free request limit, AI free tier being too small all fail for this site at realistic scale — and the `_routes.json` finding this pass makes the "mostly static" argument actually favor Workers). The "Workers is unnecessary complexity" counterargument **partially survives**: the first pass understated that Smile Savers' working setup is a hand-rolled bypass of Cloudflare's own recommended `wrangler pages functions build` compile step, which is real (if currently small) technical debt.

## Required changes before implementation

Minimum set only:

1. **Fix the security-header gap.** `src/entrypoint.js`'s `fetch` handler must apply the same CSP/X-Frame-Options/Referrer-Policy/Permissions-Policy/X-XSS-Protection headers that `functions/_middleware.js` defines, to every response (static and API) — currently applied to neither, live (confirmed `repo-vs-live.md`). Smallest correct fix: export the `securityHeaders` object and a small `applySecurityHeaders(response)` helper from `functions/_middleware.js` (or a new shared module), import it into `entrypoint.js`, and call it on the response before returning, for both the API-route branches and the `env.ASSETS.fetch(request)` fallback.
2. **Retire the `pages-action` CI job** in `.github/workflows/deploy.yml` (currently failing on every run due to a missing secret, and deploying to an architecture that isn't what's actually serving production) — replace with a `wrangler deploy` step, or confirm the existing Cloudflare Workers Git-integration (already deploying successfully per this session's PR-comment evidence) is sufficient on its own and the GitHub Actions deploy job can simply be removed.
3. **Reconcile `wrangler.jsonc`'s two `SITE_URL` values** — production now correctly says `dentalsmilesavers.com` (Wave 1), but `env.preview.vars.SITE_URL` still says `smile-savers-site-main.pages.dev`, a Pages-specific preview domain. If Workers Git-integration previews use a different domain pattern (e.g. `*.workers.dev`, as seen in this session's own PR comment), update this to match reality.
4. **Do not touch `functions/api/chat.js` / `functions/api/contact.js` routing.** They already work correctly under both the Pages Functions convention and `entrypoint.js`'s manual routing — no change needed there as part of this decision.

## What should NOT be changed

- `functions/api/chat.js` / `functions/api/contact.js` themselves (already architecture-agnostic, already working).
- The `CHAT_CACHE` KV rate-limiting added in Wave 1 — works identically under either architecture.
- Anything about the AI binding, Resend integration, or service worker — all confirmed architecture-agnostic in `repo-runtime-map.md`.

## Explicitly not done this pass

No `wrangler.jsonc`, `entrypoint.js`, `.github/workflows/deploy.yml`, or any other production/deployment file was modified as part of this decision-research phase, per the user's explicit instruction ("Do not modify production code at the beginning... Produce a decision packet and implementation contract, not start coding blindly"). Items 1–3 above are the implementation contract for a **separate, future, user-authorized pass** — not executed here.
