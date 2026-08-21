# Implementation contract — Workers (for a future, separate, user-authorized pass)

Not executed this session. This is the exact, minimal set of changes for whoever implements the decision next — written so that agent can load just this file + `decision.md` + `evidence-index.json` first, per the spec's token-efficiency rule, rather than re-reading the whole repo.

## Target architecture

Formalize what's already live: `src/entrypoint.js` as the sole Worker entrypoint, `dist/` served via Workers Static Assets, `functions/api/*.js` kept as-is and imported directly (not migrated to the official `wrangler pages functions build` compile step — see `migration-risk.json` for why that's an acceptable, evidence-checked tradeoff at this API surface's current size).

## Exact files, exact responsibilities, exact verification

| File | Responsibility | Change | Verification |
|---|---|---|---|
| `functions/_middleware.js` | Currently exports `onRequest` (Pages-only convention, never invoked by `entrypoint.js`) | Export `securityHeaders` and a small `applySecurityHeaders(response)` helper alongside the existing `onRequest` (so Pages Functions convention keeps working *if* ever used, while the logic becomes importable) | `grep -n "export" functions/_middleware.js` shows both the existing `onRequest` and the new named exports |
| `src/entrypoint.js` | Routes `/api/chat`, `/api/contact`, falls through to `env.ASSETS.fetch()` — applies no headers to any response | Import `applySecurityHeaders` from `../functions/_middleware.js` and wrap every returned `Response` (all three branches: chat, contact, static fallback) before returning | `curl -D- https://dentalsmilesavers.com/` and `curl -X OPTIONS .../api/contact` both show the full CSP/X-Frame-Options/Referrer-Policy/Permissions-Policy/X-XSS-Protection set, matching `functions/_middleware.js`'s values exactly |
| `.github/workflows/deploy.yml` | Deploys via `cloudflare/pages-action@v1`, currently failing every run (missing `CLOUDFLARE_API_TOKEN`), deploying to an architecture that isn't what's live | Replace the deploy step with `wrangler deploy` (or remove the job entirely if the existing Cloudflare Workers Git-integration, already deploying successfully per this session's PR-comment evidence, is sufficient on its own) | Next push to `main` produces a green CI run with no `pages-action` step, and `curl -D- https://dentalsmilesavers.com/` headers match what was just deployed (via `etag`/`cf-ray` changing) |
| `wrangler.jsonc` | `env.preview.vars.SITE_URL` still says `smile-savers-site-main.pages.dev` (a Pages-specific preview domain) | Update to the confirmed live Workers preview pattern: a per-commit `{8-char-hash}-smile-savers-site-main.lablaunchpad.workers.dev` URL AND a stable per-branch `{branch-slug}-smile-savers-site-main.lablaunchpad.workers.dev` URL, both observed live in this PR's own deploy-bot comments this session (e.g. `claude-init-yi57kn-smile-savers-site-main.lablaunchpad.workers.dev` for this branch). The stable per-branch URL is the more useful one for `SITE_URL` since it doesn't change on every commit. | Preview deployment's `SITE_URL`-derived links (canonical tags, structured data) resolve to the real, reachable per-branch preview URL |
| *(no change)* `functions/api/chat.js`, `functions/api/contact.js`, `functions/_lib/cors.js` | Already architecture-agnostic, already working under both conventions | None | `npm run check && npm run build` stay clean (already true as of commit `cd7d6d7`) |

## Required before implementation

1. ~~Confirm which exact preview-domain pattern the Workers Git-integration produces~~ — **confirmed live this session**: `{branch-slug}-smile-savers-site-main.lablaunchpad.workers.dev` (stable per-branch) and `{commit-hash}-smile-savers-site-main.lablaunchpad.workers.dev` (per-commit), both observed in this PR's own deploy-bot comments.
2. Confirm with whoever controls the Cloudflare account whether the `pages-action` CI job should be deleted outright or converted to `wrangler deploy` — this is a CI/CD ownership decision, not a purely technical one.

## What must NOT be changed as part of this work

- `functions/api/chat.js` / `functions/api/contact.js` route logic (Wave 1's fixes are already correct and architecture-agnostic).
- The `CHAT_CACHE` KV rate-limiting wiring from Wave 1.
- `src/entrypoint.js`'s core routing logic (chat/contact/fallback) — only add the header-wrapping, don't restructure it.
