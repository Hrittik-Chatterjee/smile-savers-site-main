# Repo runtime map — Cloudflare Pages vs Workers

Class B evidence (repository), gathered this session by reading each file directly.

## wrangler.jsonc
- `main: "src/entrypoint.js"` — Workers-style entrypoint declaration (Pages does not use `main`).
- `assets: { directory: "./dist", binding: "ASSETS" }` — Workers Static Assets configuration.
- `ai: { binding: "AI" }` — Workers AI binding.
- `kv_namespaces` for `CHAT_CACHE` — present but commented out (see Wave 1 commit `cd7d6d7`, which added real rate-limiting code that reads this binding and fails open without it).
- `vars.SITE_URL` — now `https://dentalsmilesavers.com` (fixed in Wave 1).
- `env.preview.vars.SITE_URL` — still `https://smile-savers-site-main.pages.dev`, a Pages-specific preview domain convention.

## src/entrypoint.js (full file read)
A real, working Workers `fetch` handler:
```js
export default {
  async fetch(request, env, ctx) {
    // routes /api/chat and /api/contact to the SAME functions/api/*.js
    // handlers used by Pages Functions, via a hand-built context object
    // shimming { request, env, waitUntil, next }
    // everything else -> env.ASSETS.fetch(request)
  }
}
```
**Key finding (answers spec Phase 12 directly):** `functions/api/chat.js` and `functions/api/contact.js` are plain ES modules exporting `onRequestPost`/`onRequestOptions`. `entrypoint.js` already imports them directly and calls them with a shimmed context — **no compilation step exists or is needed**; the "Pages functions/ folder compiled into a Worker script" migration Cloudflare's docs describe for the general case is **already done, by hand, via direct import**, and it already works (verified live — see `repo-vs-live.md`).

**Gap found:** `entrypoint.js` does **not** invoke `functions/_middleware.js` at all. Under Pages, `_middleware.js` is auto-applied by Pages' own routing convention; under a Worker `fetch` handler, there is no such auto-invocation — it's just a file that isn't imported. This means the CSP/CORS/security-header layer (`functions/_middleware.js`, including this session's Wave 1 CSP/CORS fixes) currently has **no effect at all** under the Workers path. Confirmed live in `repo-vs-live.md`.

## functions/ (Pages Functions convention)
- `functions/_middleware.js` — CORS + security headers (CSP, X-Frame-Options, etc.), auto-applied by Pages routing to every request. Not invoked by `entrypoint.js`.
- `functions/api/chat.js`, `functions/api/contact.js` — real route handlers, reused directly by both the Pages Functions convention (`onRequestPost`/`onRequestOptions` auto-wired by Pages) and `entrypoint.js`'s manual routing.
- `functions/_lib/cors.js` (added in Wave 1) — shared CORS allowlist, imported by all three.

## .github/workflows/deploy.yml
- Builds with `npm run build`, then deploys via `cloudflare/pages-action@v1` — this is the Pages deployment API, distinct from a Workers deploy (`wrangler deploy`). This is the job that is currently failing in CI (`Input required and not supplied: apiToken` — missing `CLOUDFLARE_API_TOKEN` repo secret), confirmed by reading its job log this session.

## public/_headers, public/_redirects
- `_headers` — security headers + CSP, reconciled with `_middleware.js` in Wave 1. Cloudflare Workers Static Assets natively supports `_headers`/`_redirects` the same way Pages does (this is documented Cloudflare behavior, not assumed) — consistent with the live evidence in `repo-vs-live.md` showing `_headers`' CSP reaching the browser on the homepage.
- `_redirects` — not inspected in depth this pass; no evidence it differs in behavior between Pages and Workers Static Assets.

## Workers AI usage
- `functions/api/chat.js:143` — `env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', ...)`. AI bindings are a Workers/Pages-Functions-shared runtime feature; both architectures can use them identically (Pages Functions also get an `AI` binding via the same `wrangler.jsonc` `ai` key).

## Resend integration
- `functions/api/contact.js` calls `https://api.resend.com/emails` via `fetch()` — a plain HTTP call, architecture-agnostic. No Cloudflare-specific binding involved.

## KV
- `CHAT_CACHE`, commented out. Architecture-agnostic (`env.CHAT_CACHE` works identically whether the binding is attached to a Pages Function or a Worker).

## Service worker
- `public/sw.js` — client-side, served as a static asset. Identical under either architecture (Workers Static Assets and Pages both just serve the file byte-for-byte).
