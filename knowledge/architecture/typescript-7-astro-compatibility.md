---
type: EvidenceAtom
title: TypeScript 7 and Astro type-checking are currently incompatible
description: TypeScript 7.0's native compiler has no stable programmatic API yet, which Astro's own type-checker requires — direct implication for any TS7 adoption in this repo.
resource: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
tags: [typescript, astro, compatibility, evidence-atom, eaos]
generated:
  by: process:claude-code-session-017vquuZdhBBxxo8bXTZ4QcN
  at: 2026-08-19T14:10:00Z
status: stable
stale_after: 2027-02-19
sources:
  - Announcing TypeScript 7.0 (devblogs.microsoft.com/typescript/announcing-typescript-7-0/, live-fetched 2026-08-19)
  - WebSearch cross-corroboration (InfoQ, The Register, techtimes.com — all independently reporting the same Astro/Vue/Svelte/MDX caveat)
---

# TypeScript 7 and Astro — compatibility evidence atom

**Claim**: TypeScript 7.0 shipped stable 2026-07-08 (8-12x build speedups, native Go-ported compiler), but Microsoft's own announcement states, in a dedicated "TypeScript and Embedded Languages" section: *"Workflows that use Vue, MDX, Astro, Svelte, and others will likely not yet be able to leverage TypeScript 7"* — because TS7 has no stable programmatic/compiler API yet, which tools like Volar (which Astro's own type-checker is built on) require. Microsoft's official recommendation for Astro projects: **stay on TypeScript 6.0 entirely** until TS7.1 ships a new API (no date committed).

**Repository implication**: `npm run check` (this repo's primary correctness gate — `astro check` under the hood) depends on exactly the tooling this caveat describes. **Do not bump the root `package.json`'s `typescript` dependency to 7.x** — it would very plausibly break `astro check`/`npm run build`'s type-checking step. This is not a claim to weigh; it's the affected vendor's own current guidance, corroborated independently by 3+ tech-press sources reporting the same detail.

**Decision rule**: Any TypeScript 7 usage in this repository must be in a package that is NOT part of the root Astro build/tsconfig graph — i.e. an isolated tool with its own `package.json`/`tsconfig.json`, the same pattern `design-intelligence/` already uses (excluded from the root `tsconfig.json`'s `include`, specifically to avoid gating `npm run build` — see `CLAUDE.md`). A new EAOS tool built in TS7 must follow the same isolation pattern, or it must stay on TypeScript 6 if it needs to share tooling with the Astro codebase.

**Confidence**: 1.0 (primary vendor source, directly on-point, independently corroborated, no counterevidence found).
