# Cloudflare Decision — Smile Savers

## Decision

**WORKERS — CONDITIONAL GO**

Conditional because: (1) the security-header gap (`_middleware.js` never invoked by `entrypoint.js`) must be fixed as part of formalizing this choice, not left as-is; (2) the Growth/future-capability category's evidence wasn't independently re-verified to Class A this pass (see `decision.md` Limitations).

## Confidence

**80%**

## Evidence

- Class A: 2 (Workers pricing, Workers AI pricing — both re-fetched live this session)
- Class B: 3 (`wrangler.jsonc`, `src/entrypoint.js`, `.github/workflows/deploy.yml` — all read in full)
- Class C: 4 (live homepage headers, live `/api/contact` OPTIONS, live `/api/chat` POST, live `robots.txt`)
- Class D: 1 (this session's own PR-comment history)
- Unresolved/not independently re-verified: the user-supplied research packet's Pages Functions `_routes.json` routing caveat and the exact Pages→Workers migration-guidance wording — used as background context (Class D within `decision.md`'s Growth category) but not re-fetched to Class A this pass.

## Quantified result

- Workers Free request capacity: 100,000/day (static assets don't count against this at all, under either architecture — CF-A1).
- Peak-day safety margin: effectively unbounded for this site's realistic API-call volume (dozens–hundreds/day vs. 100,000/day quota) — no scenario modeled this pass gets within an order of magnitude of the limit.
- AI free-neuron capacity: 10,000 neurons/day.
- Typical AI requests/day before exhausting free tier: ~1,172 (DERIVED from the real `functions/api/chat.js` system prompt — see `ai-capacity-model.json`).
- Heavy AI requests/day before exhausting free tier: ~839.
- Estimated paid overage scenarios: none modeled as *likely* for this site's realistic traffic; if it ever occurred, overage is $0.011/1,000 neurons (CF-A2) — negligible even at 2-3x the heavy scenario's volume.
- Migration effort/risk: **low** — the "migration" is fixing one gap (wire `_middleware.js`'s header logic into `entrypoint.js`) and deleting one now-redundant CI job, not building a new architecture from scratch. The hard part (functions/ → Worker routing) is already done and already live.

## Counterevidence

All four stress-test counterarguments in `decision.md` were tested; none survived for this specific site at its realistic scale. The one open question that could still reverse this (see Limitations) is whether the observed live-production behavior (Workers path serving traffic, Pages path failing) reflects a deliberate, already-made architectural choice that simply hasn't been documented/cleaned up yet — in which case this decision is really just **making the existing, undocumented reality official** rather than choosing between two live options.

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
