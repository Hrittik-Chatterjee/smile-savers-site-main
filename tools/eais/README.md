# @smile-savers/eais

Lightweight Engineering AI Operating System (EAIS/EAOS) control-plane CLI for this repository. TypeScript 7.0.2 (current latest stable on npm as of 2026-08-19), Node ≥24 preferred (empirically also runs on Node 22.22.2 in this session's sandbox — the native `tsc` binary doesn't require Node 24 to execute, only the `engines` field expresses a preference).

## Why this is a separate package, not part of the root project

TypeScript 7's native compiler has no stable programmatic API yet, and Astro's own type-checker (`astro check`, which `npm run check`/`npm run build` depend on) requires exactly that API. Microsoft's own TS7 announcement names Astro explicitly as not yet compatible. See `knowledge/architecture/typescript-7-astro-compatibility.md` for the full evidence. This package is therefore isolated with its own `package.json`/`tsconfig.json`, excluded from the root `tsconfig.json` (same pattern as `design-intelligence/`), so it can use TS7 without risking the Astro build.

## What it does

Reads this repo's already-persisted governance state — `.ai/truth/canonical.json`, `.ai/decisions/ADR-REGISTER.json`, `.ai/gates/release.json`, and the latest `audit/eais/<run-id>/MASTER-DEBT-REGISTER.json` — and exposes it through a small deterministic CLI:

```bash
npm run eais state       # current milestone, blockers, next action
npm run eais truth       # canonical business facts
npm run eais decisions   # accepted ADRs
npm run eais gate        # deterministic overall release-gate status
npm run eais debt        # open debt items
npm run eais context "<task description>"   # deterministic context compiler
```

It does not decide anything itself — it reads state that other work (this session's audits, fixes, and verification) already wrote. "AI advises, gates decide": nothing in this tool's output is inferred or generated; every field traces to a JSON file already checked into the repo.

## Context compiler

`eais context "<task>"` is the one genuinely non-trivial piece: given a task description, it deterministically selects only the truth entities / decisions / debt items / files whose text overlaps the task, and reports a measured token-reduction percentage against the full corpus. Two identical calls against identical repo state always produce identical output (proven in `tests/context.test.ts`) — there is no LLM call, ranking model, or randomness anywhere in it.

## Commands

```bash
npm install
npm run build   # tsc -p tsconfig.json
npm test        # build + node --test dist/tests/*.test.js
npm run eais <command>
```

## What's deliberately not built

No orchestrator loop, no multi-agent framework, no daemon, no database. This is a CLI that runs, reads/writes files, and exits — scale-to-zero by construction. Larger pieces (full SDLC state-machine transitions, agent registry, checkpoint automation) described in the uploaded EAIS knowledge pack's spec are not implemented here; this is the minimum viable slice proven against real repo data, not a speculative framework built ahead of a demonstrated need.
