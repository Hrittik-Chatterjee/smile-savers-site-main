---
type: Index
title: Smile Savers Knowledge Bundle
description: Evidence-backed operational and architectural knowledge for the Smile Savers Dental site, in Open Knowledge Format (OKF) v0.2.
tags: [smile-savers, okf-bundle-root]
generated:
  by: process:claude-code-session-017vquuZdhBBxxo8bXTZ4QcN
  at: 2026-08-19T13:20:00Z
status: stable
---

# Smile Savers Knowledge Bundle

An [Open Knowledge Format](https://okf.md/spec/) (OKF) bundle — a directory of markdown files with YAML frontmatter, cross-linked into a graph readable by both humans and AI agents. OKF v0.1 was published by Google Cloud on 2026-06-12; v0.2 (used here, for its `generated`/`status`/`stale_after`/`sources` trust-signal fields) followed 2026-07-25. Verified against the live spec (`okf.md/spec/`) and Google Cloud's own announcement post this session, not assumed from training data.

Every concept file below cites `sources` back to the exact repo file, live production check, or Cloudflare documentation page it's derived from — nothing here is asserted without an evidence trail.

## Sections

- [architecture/](/knowledge/architecture/index.md) — Cloudflare Pages vs Workers decision, current runtime shape, scale-to-zero economics
- [security/](/knowledge/security/index.md) — contact/chat API hardening, CORS/CSP policy, rate limiting
- [data-integrity/](/knowledge/data-integrity/index.md) — canonical clinic facts (address, hours, coordinates, team) and where they're consumed
- [design-system/](/knowledge/design-system/index.md) — pointer into `design-intelligence/`'s own token/evidence model (not duplicated here)

## Non-goals

This bundle does not duplicate `design-intelligence/`'s Google Labs extraction evidence graph, the uploaded third-party audit's full 21-finding report, or PR history — those remain in their own locations (`design-intelligence/`, `audit/`) as the authoritative source; this bundle only distills what's durably true and likely to be needed by a future agent or human working on this repo.
