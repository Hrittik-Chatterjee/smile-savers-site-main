---
type: Index
title: Design System
description: Pointer into design-intelligence/'s own semantic token model and evidence graph — not duplicated here.
tags: [design-system, tokens]
generated:
  by: process:claude-code-session-017vquuZdhBBxxo8bXTZ4QcN
  at: 2026-08-19T13:20:00Z
status: stable
---

# Design System

The full evidence-first token/evidence model lives in [`design-intelligence/`](/design-intelligence/README.md) and is intentionally **not** duplicated into OKF form here — it already has its own JSON Schema-validated evidence classes (`OBSERVED-SOURCE`, `DERIVED`, `MAPPED`, `UNKNOWN`, `VERIFY-BLOCKED`, etc.) and reports, which are the authoritative source. Duplicating it into markdown here would create a second copy that can silently drift from the first.

Key entry points for an agent that needs this:

- `design-intelligence/reports/token-inventory.json` — 136 Smile Savers tokens, line-cited, DIRECT/INDIRECT consumer classification
- `design-intelligence/reports/change-impact-report.json` — what breaks if a given token changes
- `design-intelligence/audit/semantic-model-gap.md` — what's evidenced vs. explicitly declared out-of-scope (component anatomy, patterns, design intent — none of that exists in this repo's source, so none of it is fabricated here either)
