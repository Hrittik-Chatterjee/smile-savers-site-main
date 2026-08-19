# Design Intelligence Harness

Evidence-first extraction of the `labs.google` design system, normalised into a
brand-separated grammar that the Smile Savers design system can draw on **without
adopting Google's brand identity**.

This directory is fully isolated from the production Astro build:

- written in `.mjs` — no TypeScript toolchain, so it cannot affect `astro check`
- excluded from the root `tsconfig.json`
- its own `package.json`; the root lockfile is untouched
- nothing here is imported by `src/`

`npm run check` and `npm run build` produce byte-identical results with and
without this directory present. That is a gate, not an aspiration.

## Environment constraints (verified, not assumed)

Two limits shape the entire architecture. Both were proven in-environment:

1. **Chromium cannot reach any external host.** `ERR_CONNECTION_RESET` with the
   proxy, without the proxy, and with the sandbox disabled — while `curl`
   succeeds. So live browser-runtime capture of `labs.google` is impossible
   here. Evidence is instead gathered by mirroring the source over `curl` and
   rendering that mirror on localhost.
2. **`fonts.gstatic.com` is unreachable**, so Google Sans never loads. 86
   font requests are recorded as `VERIFY-BLOCKED`. Any measurement that depends
   on real font metrics is therefore unobtainable and is classified as such —
   never estimated.

## Evidence classes

Exactly seven are permitted; `lib/core.mjs` rejects anything else.

| Class | Meaning |
|---|---|
| `OBSERVED-SOURCE` | Parsed from bytes Google actually served |
| `OBSERVED-MIRROR` | Computed style from rendering the mirror locally |
| `DERIVED` | Normalised or clustered from observed evidence |
| `MAPPED` | Correspondence to Material 3 / M3 Expressive — never provenance |
| `INFERRED` | Design-system interpretation |
| `UNKNOWN` | Not established |
| `VERIFY-BLOCKED` | Cannot be established in this environment |

`OBSERVED-MIRROR` is never relabelled `OBSERVED`. Mirror rendering is not live
runtime, and the distinction is load-bearing.

## What is NOT claimed

- **Not** pixel parity with `labs.google`. Strict 0-pixel parity applies only to
  admitted reference fixtures rendered under controlled conditions.
- **Not** Google Labs typography fidelity. Fixtures may match the mirror exactly
  because both fall back to the same stack — that is *controlled reference-fixture
  parity*, and the reports say so in those words.
- **Not** that Labs is built from Material 3. M3 links are `MAPPED` correspondence
  unless independently proven.

## Commands

Run from the repository root:

```bash
npm --prefix design-intelligence run mirror   # Stage 2: dependency-graph source mirror
```

Stage scripts are added in order; `package.json` is the authoritative list.

## Legal boundary

Mirrored bytes are gitignored. Google Sans is proprietary and is never
downloaded, embedded, or referenced by Smile Savers. Google imagery, video, copy,
and logos never cross into `src/`. What crosses the boundary is *structural
design intelligence* — spacing rhythm, container logic, shape scales, motion
timing — expressed through Smile Savers' own tokens.
