---
type: Decision
title: Cloudflare Pages vs Workers
description: Smile Savers should standardize on Cloudflare Workers + Workers Static Assets, not Pages + Pages Functions — production is already running this way today.
resource: https://github.com/LabLaunchPad/smile-savers-site-main/blob/claude/init-yi57kn/audit/cloudflare-decision/CLOUDFLARE-DECISION.md
tags: [cloudflare, workers, pages, architecture, decision]
generated:
  by: process:claude-code-session-017vquuZdhBBxxo8bXTZ4QcN
  at: 2026-08-19T13:25:00Z
status: stable
stale_after: 2027-02-19
sources:
  - Cloudflare Workers Pricing (developers.cloudflare.com/workers/platform/pricing/, live-fetched 2026-08-19)
  - Cloudflare Workers AI Pricing (developers.cloudflare.com/workers-ai/platform/pricing/, live-fetched 2026-08-19)
  - Cloudflare Workers Platform Limits (developers.cloudflare.com/workers/platform/limits/, live-fetched 2026-08-19)
  - Cloudflare Pages Functions Routing (developers.cloudflare.com/pages/functions/routing/, live-fetched 2026-08-19)
  - Cloudflare Migrate from Pages to Workers (developers.cloudflare.com/workers/static-assets/migrate-from-pages/, live-fetched 2026-08-19)
  - live curl checks against https://dentalsmilesavers.com (2026-08-19)
  - repo files: wrangler.jsonc, src/entrypoint.js, .github/workflows/deploy.yml
---

# Cloudflare Pages vs Workers — Decision

**Decision: WORKERS — CONDITIONAL GO, 80% confidence.** Full evidence trail: [`audit/cloudflare-decision/`](/audit/cloudflare-decision/CLOUDFLARE-DECISION.md) in the repo — this file is a distillation, not a replacement.

## The decisive finding

Live `curl` checks against `https://dentalsmilesavers.com` prove `functions/_middleware.js` (the Pages-Functions-only security-header/CORS layer) does **not** run in production today: the homepage's headers match `public/_headers` exactly, not `_middleware.js`; the `/api/contact` and `/api/chat` routes return zero security headers and a wildcard CORS origin. The only architecture consistent with this is `src/entrypoint.js`'s Worker `fetch` handler — it routes API calls directly to `functions/api/*.js` (bypassing `_middleware.js` entirely) and falls through to `env.ASSETS.fetch()` for everything else, and Workers Static Assets natively honors `_headers`. **Production is already being served by Workers, not Pages** — regardless of what `.github/workflows/deploy.yml`'s `cloudflare/pages-action` deploys (which fails on every run: missing `CLOUDFLARE_API_TOKEN`).

## Why Workers, on the merits (not just "it's already running")

- Static-asset economics are NOT equivalent between the two for this specific repo: Workers Static Assets is free/unlimited with zero configuration; Pages requires an explicit `_routes.json` exclude rule to get the same result once Functions exist — and **this repo has no `_routes.json`**, meaning a live Pages deployment as-configured would invoke a Pages Function (consuming request quota) on every static asset request, not just the two real API routes.
- Workers AI bindings, KV, and the Resend integration are architecture-agnostic — no differentiation there.
- Workers AI free tier: 10,000 neurons/day, exhausted between ~760–983 chat requests/day depending on conversation length (derived from the real system prompt in `functions/api/chat.js`) — comfortably above plausible traffic for a single Woodside, NY dental practice, and there's already an in-memory reply cache reducing real AI-call volume further. Even well past free, overage cost is trivial (~$0.06/month at 1,000 typical requests/day).
- Workers Free request ceiling: 100,000/day. No realistic traffic scenario for this site approaches it.
- **Scale-to-zero economics**: like Pages, Workers has no idle/always-on cost — you only pay (past the free tier) for requests actually served and CPU actually consumed, never for idle capacity. This matters for a low-to-moderate-traffic single-location practice site: there's no minimum "keep the server warm" cost either architecture imposes.

## One important correction (don't repeat this mistake)

An earlier pass of this decision claimed "no compilation step is needed" to run `functions/` under Workers. That's wrong as a general claim — Cloudflare's own official migration path requires compiling a Pages `functions/` folder into a single Worker script via `wrangler pages functions build`. What's true and specific to this repo: `src/entrypoint.js` is a **hand-rolled bypass** of that official step — it manually imports `functions/api/chat.js` and `functions/api/contact.js` and routes to them itself. This works only because the API surface is small and flat (2 endpoints, no nesting), and it's the confirmed root cause of the missing-security-headers gap (the hand-rolled entrypoint never imports `functions/_middleware.js`, unlike the official compiled path would).

## Required before implementing (not yet done)

1. Wire `functions/_middleware.js`'s security-header logic into `src/entrypoint.js` — currently applied to nothing, live.
2. Retire or convert the failing `pages-action` CI job.
3. Fix `wrangler.jsonc`'s stale preview `SITE_URL` (confirmed live pattern: `{branch-slug}-smile-savers-site-main.lablaunchpad.workers.dev`).

Full implementation contract: `audit/cloudflare-decision/implementation-contract.md`.
