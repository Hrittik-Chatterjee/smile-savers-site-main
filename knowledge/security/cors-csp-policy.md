---
type: Policy
title: CORS and CSP policy
description: Single shared exact-origin CORS allowlist and one reconciled CSP, replacing three independently-drifted implementations.
resource: https://github.com/LabLaunchPad/smile-savers-site-main/blob/claude/init-yi57kn/functions/_lib/cors.js
tags: [security, cors, csp, headers]
generated:
  by: process:claude-code-session-017vquuZdhBBxxo8bXTZ4QcN
  at: 2026-08-19T13:20:00Z
status: stable
sources:
  - functions/_lib/cors.js, functions/_middleware.js, functions/api/chat.js, functions/api/contact.js, public/_headers (commit cd7d6d7)
  - uploaded third-party audit SmileSaversAudit20260819T122703Z, findings SEC-004/SEC-005
  - grep -rn "eval(|new Function(" src/ functions/ (0 hits, confirming unsafe-eval is not load-bearing)
  - grep -rl 'style="' src --include=*.astro (9 files, confirming unsafe-inline for style-src IS load-bearing)
---

# CORS and CSP policy

## CORS — `functions/_lib/cors.js`

Before: `functions/_middleware.js` used a wildcard `Access-Control-Allow-Origin: *`; `functions/api/chat.js` used `origin.startsWith(allowedOrigin)` (matches `https://dentalsmilesavers.com.evil.example`). Now: one shared `isAllowedOrigin()`/`corsHeadersFor()` pair, imported by all three call sites. Allowlist: `https://dentalsmilesavers.com` exactly, `http://localhost:4321` exactly, and any `https://*.pages.dev` / `https://*.workers.dev` subdomain (for Cloudflare preview deployments).

**Caveat, honestly noted:** the API routes' own CORS logic (in `chat.js`/`contact.js`) is what's actually live in production today (per the entrypoint-routing gap — `functions/_middleware.js` itself doesn't run). The CORS fix therefore already applies live once deployed; the CSP fix below does not, until the entrypoint gap is fixed.

## CSP — one policy, not two

Before: `functions/_middleware.js` and `public/_headers` had two different, drifted CSPs (one allowed Google Fonts despite this project self-hosting fonts; the other referenced `mailchannels`/`pexels`/`cloudflareinsights`, none of which are used anywhere in `src/` or `functions/`, grep-confirmed). Now: one policy in both files, built from actual usage only:

```
default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://maps.openstreetmap.org https://tile.openstreetmap.org; connect-src 'self'; frame-src https://www.openstreetmap.org; upgrade-insecure-requests
```

- `unsafe-eval` removed — zero `eval()`/`new Function()` usage anywhere in the codebase (grep-verified).
- `unsafe-inline` kept for both `script-src` and `style-src` — real, load-bearing: `is:inline` scripts exist (`Header.astro`, `BaseLayout.astro`) and 9 files use inline `style="..."` attributes. Removing either without a nonce/hash strategy would break the site; not attempted this pass.
- `img-src`/`frame-src` scoped to OpenStreetMap domains only, for the `LocationMap.astro` embed — the only external image/frame dependency found in the codebase.
