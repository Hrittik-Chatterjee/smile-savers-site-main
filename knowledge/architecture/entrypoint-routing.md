---
type: Component
title: src/entrypoint.js routing
description: How the live Worker fetch handler routes requests, and its one known gap (missing security headers).
resource: https://github.com/LabLaunchPad/smile-savers-site-main/blob/claude/init-yi57kn/src/entrypoint.js
tags: [cloudflare, workers, routing, entrypoint]
generated:
  by: process:claude-code-session-017vquuZdhBBxxo8bXTZ4QcN
  at: 2026-08-19T13:20:00Z
status: stable
sources:
  - src/entrypoint.js (read in full)
  - live curl checks against https://dentalsmilesavers.com/api/contact and /api/chat
---

# `src/entrypoint.js` routing

A Worker `fetch` handler with three branches:

1. `url.pathname === '/api/chat'` → imports and calls `functions/api/chat.js`'s `onRequestPost`/`onRequestOptions` directly, with a hand-shimmed context object (`{ request, env, waitUntil, next }`) matching the shape Pages Functions would normally provide.
2. `url.pathname === '/api/contact'` → same pattern, calling `functions/api/contact.js`.
3. Everything else → `env.ASSETS.fetch(request)` (Workers Static Assets, serving `dist/`).

## Known gap (as of 2026-08-19, unfixed)

None of the three branches apply the security headers / CSP defined in `functions/_middleware.js` — that file is a Pages-Functions-only convention (auto-invoked by Pages routing) and is simply never imported here. Confirmed live: `curl -D- https://dentalsmilesavers.com/api/contact` (OPTIONS) returns zero `Content-Security-Policy`/`X-Frame-Options`/etc. headers. See [`cloudflare-workers-decision.md`](/knowledge/architecture/cloudflare-workers-decision.md) for the fix.

## What already works correctly here

- `functions/api/chat.js` and `functions/api/contact.js` are plain ES modules with no Pages-specific magic beyond their exported function names — they run identically whether invoked via this hand-rolled router or via the Pages Functions auto-wiring convention. No architecture-specific fork exists in that code.
- Static asset serving (`env.ASSETS.fetch`) naturally picks up `public/_headers` and `public/_redirects` — this is documented Cloudflare Workers Static Assets behavior, not a coincidence.
