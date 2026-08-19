# Repo vs. live production — https://dentalsmilesavers.com

Class C evidence, gathered this session via `curl -D -` (headers only, no form/chat/appointment submissions — read-only per the spec's constraint). All fetches at `2026-08-19T13:07–13:09Z`, against commit `cd7d6d7` (pushed but not yet the live deployment — live still reflects an earlier commit).

| # | Check | Classification | Evidence |
|---|---|---|---|
| 1 | Homepage CSP/security headers | **REPO-ONLY vs. a specific repo state** — matches the **pre-Wave-1** `public/_headers` content exactly (`X-Frame-Options: SAMEORIGIN`, `Permissions-Policy: ...geolocation=(self)...`, CSP with `mailchannels`/`pexels`/`cloudflareinsights`) | `curl -D- https://dentalsmilesavers.com/` |
| 2 | Homepage CSP vs. `functions/_middleware.js` | **CONTRADICTION, resolved** — the live CSP does **not** match `_middleware.js`'s (pre- or post-Wave-1) CSP at all (no `fonts.googleapis.com`/`unsafe-eval` from the old version; no OSM/tile domains from the new one). This proves `_middleware.js` is not the source of the live homepage's headers. | Same fetch, compared line-by-line against both `_middleware.js` versions |
| 3 | `/api/contact` OPTIONS response | **CONTRADICTION with `_middleware.js`, confirms `entrypoint.js` path** — `access-control-allow-origin: *`, and **no** `Content-Security-Policy`/`X-Frame-Options`/`Referrer-Policy`/`Permissions-Policy` headers at all | `curl -X OPTIONS -H "Origin: https://dentalsmilesavers.com" https://dentalsmilesavers.com/api/contact` |
| 4 | `/api/chat` POST response | Same pattern — `access-control-allow-origin: *`, no security headers | `curl -X POST .../api/chat` |
| 5 | `robots.txt` | **REPO-ONLY (stale)** — still points `Sitemap: https://smilesavers.dental/sitemap-index.xml`, the pre-Wave-1 domain | `curl https://dentalsmilesavers.com/robots.txt` |
| 6 | `sitemap-index.xml` | **MATCH** — resolves, 200, `application/xml`, present as expected for an Astro+sitemap-integration static build | `curl -D- .../sitemap-index.xml` |

## The decisive finding

Findings #1–#4 together are the single strongest piece of evidence in this whole investigation:

- The homepage's headers come from **`_headers`, not `functions/_middleware.js`** (finding #1+#2).
- The API routes' headers come from **the individual route handlers' own CORS logic (`chat.js`/`contact.js`), not from `functions/_middleware.js`** (finding #3+#4 — if `_middleware.js` were running, its `securityHeaders` block sets CSP/X-Frame-Options/etc. on literally every response, API routes included, with no path exclusion in the code).

**Conclusion:** `functions/_middleware.js` — the Pages-Functions-specific middleware file — **is not executing in the current live deployment at all.** The only architecture in this repository that matches this exact behavior is `src/entrypoint.js`'s Worker `fetch` handler: it routes `/api/chat` and `/api/contact` directly to the route handlers (bypassing `_middleware.js` entirely, since it's simply never imported), and falls through to `env.ASSETS.fetch(request)` for everything else — and Cloudflare's Workers Static Assets feature natively honors `_headers`/`_redirects` for that static-asset path, exactly matching finding #1.

**This means: production is already being served by the Workers architecture (`entrypoint.js` + Static Assets), not by Cloudflare Pages + Pages Functions — regardless of what `.github/workflows/deploy.yml`'s `cloudflare/pages-action` deploys.** This is independently corroborated by this session's earlier observation that a Cloudflare Workers Git-integration deployment succeeded on this exact branch (a `workers.dev` preview URL appeared in a PR comment) while the `pages-action`-based CI check fails outright (missing `CLOUDFLARE_API_TOKEN`, confirmed via job log).

**Direct consequence for Wave 1:** this session's `functions/_middleware.js` CSP/CORS fixes (commit `cd7d6d7`) will have **no effect on production** once deployed, unless `entrypoint.js` is changed to actually invoke that logic. This is now a required item in the implementation contract (`CLOUDFLARE-DECISION.md`), independent of which architecture is chosen as the long-term target — even staying on the current de-facto Workers path needs this fixed.
