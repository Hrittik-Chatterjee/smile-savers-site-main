# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Production marketing site for Smile Savers Dental (Woodside, Queens, NYC), built with Astro 6 (static output) + Tailwind CSS v4 + DaisyUI v5, deployed to **Cloudflare Workers + Workers Static Assets** (not Cloudflare Pages — see "Cloudflare deployment specifics" below) with Cloudflare Workers AI, Workers KV, and Resend for backend needs. Near-zero client JS by design.

## Commands

```bash
npm run dev          # Local dev server (http://localhost:4321)
npm run build         # astro check + astro build (type-checked production build)
npm run build:ci      # astro build --no-type-check (faster, used in CI)
npm run check         # astro check only (type/content-schema errors)
npm run lint           # alias for `npm run check`
npm run format         # prettier --write . (astro + tailwind plugins configured)
npm run preview       # serve the built dist/ locally
npm run preview:cf    # `wrangler dev` — serves dist/ via src/entrypoint.js's Worker routing (fixed from `wrangler pages dev`, which was Pages-only tooling inconsistent with this project's actual architecture). Requires a real CLOUDFLARE_API_TOKEN (the AI binding runs in "remote" mode by default) — not runnable in a credential-less sandbox; verified only that the command starts and reports the correct binding set, not a full local request/response cycle.
npm run clean         # rm -rf .astro dist
```

There is no unit test runner configured — `astro check` (type-checking + Zod content schema validation) is the primary correctness gate. Content collection errors (bad frontmatter) fail the build, so after adding/editing any Markdown in `src/content/`, run `npm run check` to catch schema violations before pushing.

`.npmrc` sets `legacy-peer-deps=true` — use `npm install`, not another package manager.

## Architecture

### Rendering model
Astro static output (`output: 'static'` in `astro.config.mjs`). Pages render to static HTML at build time; the only server-side runtime is `src/entrypoint.js`, a Cloudflare Worker `fetch` handler that routes `/api/*` to plain-JS handlers in `functions/api/` and falls through to Workers Static Assets for everything else (not part of the Astro build).

### Content collections drive most pages (`src/content.config.ts`)
Eight typed collections, each with a Zod schema, loaded from `src/content/<name>/*.md`:
- `services`, `team`, `testimonials`, `legal` — standard content
- `locations`, `glossary`, `comparisons`, `personas` — **programmatic SEO** collections that generate large numbers of pages from Markdown data

Route ↔ collection mapping:
| Route | Collection | Purpose |
|---|---|---|
| `src/pages/services/[slug].astro` | `services` | 9 service detail pages |
| `src/pages/team/[slug].astro` | `team` | Doctor profile pages |
| `src/pages/[service]/[neighborhood]/index.astro` | `locations` | "`[service]` in `[neighborhood]`" local SEO pages |
| `src/pages/learn/[term].astro` | `glossary` | "What is `[term]`" educational pages |
| `src/pages/compare/[slug].astro` | `comparisons` | "X vs Y" comparison pages |
| `src/pages/for/[slug].astro` | `personas` | "`[service]` for `[audience]`" pages |

When adding content, copy an existing Markdown file in the target collection directory and fill in frontmatter matching the Zod schema in `src/content.config.ts` — invalid frontmatter breaks the build (by design).

### Directory layout
- `src/pages/` — Astro file-based routing (see table above)
- `src/layouts/` — `BaseLayout.astro` (HTML shell: PWA manifest, Schema.org JSON-LD, self-hosted fonts, service worker registration) → `PageLayout.astro` (adds Header/Footer) → page-specific layouts wrap this (e.g. `LegalLayout.astro`)
- `src/modules/` — feature-scoped component groups matching page sections (`homepage/`, `about/`, `appointments/`, `contact/`, `services/`, `programmatic-seo/`); prefer colocating new page-specific components here over `src/components/`
- `src/components/common|layout|icons|ui|accessibility/` — shared, cross-page components
- `src/config/` — static site data as TS modules: `site.ts` (practice info/hours/social), `navigation.ts` (nav/footer links), `doctors.ts` (doctor profiles referenced outside content collections)
- `src/styles/global.css` — Tailwind v4 `@theme` tokens (brand colors), DaisyUI overrides
- `functions/api/` — plain-JS route handlers (`onRequestPost`/`onRequestOptions` exports, the Pages Functions naming convention, but invoked here by `src/entrypoint.js`'s own routing, not Pages): `chat.js` (Workers AI chat endpoint, `@cf/meta/llama-3.1-8b-instruct-fast`, in-memory reply cache + KV rate limiting), `contact.js` (Resend email)
- `functions/_middleware.js` — defines CORS/CSP/security headers and cache-control logic; exports `applySecurityHeaders()`, which `src/entrypoint.js` calls explicitly on every response (its own `onRequest` export is Pages-Functions-only and not the live code path — see "Cloudflare deployment specifics")

### Path aliases (tsconfig.json)
`@/*` → `src/*`, `@components/*`, `@lib/*`, `@config/*`, `@types/*`, `@modules/*`.

### Cloudflare deployment specifics
- **Deployment architecture is Cloudflare Workers + Workers Static Assets, not Cloudflare Pages** — decided and evidence-verified in `audit/cloudflare-decision/` (live production `curl` checks proved Pages' `_middleware.js` convention was never actually executing; Workers Static Assets natively serving `public/_headers`/`public/_redirects` was). CI no longer has a deploy step (`cloudflare/pages-action` was removed — see `.github/workflows/deploy.yml`'s header comment); Cloudflare's own Git integration deploys automatically on push.
- Config lives in `wrangler.jsonc` (not `wrangler.toml` despite what README says). `main: "src/entrypoint.js"` is the actual Worker entrypoint; `assets.directory: "./dist"` is the static output Workers Static Assets serves.
- Workers AI binding (`AI`) and an optional `CHAT_CACHE` KV namespace (commented out by default — must be created via `wrangler kv namespace create` and uncommented to enable both cross-request chat caching and the real per-IP rate limiter in `functions/api/chat.js`, which fails open without it).
- `functions/api/*.js` files use the `onRequestPost`/`onRequestOptions` naming convention (so they'd also work unmodified under real Pages Functions), but the code path that actually runs them in this project is `src/entrypoint.js`'s manual import + routing — it is not exercised by `npm run dev`; use `npm run preview:cf` to test it locally. `functions/_middleware.js`'s own `onRequest` export is dead code on this architecture (Pages-only auto-invocation convention) — its header logic is reused via the exported `applySecurityHeaders()` helper instead, called explicitly from `entrypoint.js`.

### Brand tokens
```css
--color-primary:   #102B3F   /* Deep Navy */
--color-secondary: #3DBAA7   /* Mint Teal */
--color-accent:    #1D6F91   /* Darkened Cyan — CTAs (darkened from #2CABDF for WCAG AA; 5.62:1 vs white, was 2.63:1) */
--color-surface:   #EFF6EE   /* Mint Whisper background */
```

## Conventions

- Prettier is the formatting authority (`.prettierrc`): semi, single quotes, 100 print width, with `prettier-plugin-astro` and `prettier-plugin-tailwindcss` (class sorting) — run `npm run format` before committing.
- No Google Fonts / third-party font hosting — fonts are self-hosted in `public/fonts/`; keep new fonts self-hosted to preserve the no-third-party-DNS performance posture.
- Images go through Astro's sharp pipeline (`astro.config.mjs` `image.service`) — prefer Astro `<Image>`/content-collection `image()` helpers over raw `<img src>` for anything in `src/`.
