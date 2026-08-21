---
type: SecurityFix
title: Chat API rate limiting
description: functions/api/chat.js documented KV/IP rate limiting that didn't exist in code; now implemented, fails open without the KV binding.
resource: https://github.com/LabLaunchPad/smile-savers-site-main/blob/claude/init-yi57kn/functions/api/chat.js
tags: [security, rate-limiting, chat, kv, workers-ai]
generated:
  by: process:claude-code-session-017vquuZdhBBxxo8bXTZ4QcN
  at: 2026-08-19T13:20:00Z
status: stable
sources:
  - functions/api/chat.js, wrangler.jsonc (commit cd7d6d7)
  - uploaded third-party audit SmileSaversAudit20260819T122703Z, finding SEC-003
---

# Chat API rate limiting

`functions/api/chat.js`'s header comment claimed "Max 20 requests/IP/minute via KV (if bound)" but no such code existed — only an unrelated in-memory reply cache (`REPLY_CACHE`, keyed by normalized question text, not by requester). Now: `checkRateLimit(env, ip)` reads/writes a `CHAT_CACHE` KV key `ratelimit:{ip}`, capped at 20/60s, using `CF-Connecting-IP`.

**Operationally important: this fails open, not closed.** If `CHAT_CACHE` isn't bound in `wrangler.jsonc` (it's currently commented out, pending `npx wrangler kv namespace create CHAT_CACHE`), `checkRateLimit` returns `{limited: false}` unconditionally — the endpoint keeps working, but with zero rate limiting actually enforced. Anyone deploying this needs to know the KV namespace must be created and uncommented for the protection to be real, not just present in code.

See also: [`ai-capacity`](/knowledge/architecture/cloudflare-workers-decision.md) for why the AI free-tier neuron budget (10,000/day) is the other real constraint on chat volume, separate from this IP-based rate limit.
