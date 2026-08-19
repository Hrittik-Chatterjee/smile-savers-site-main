# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Production marketing site for Smile Savers Dental (Woodside, Queens, NYC), built with Astro 6 (static output) + Tailwind CSS v4 + DaisyUI v5, deployed to Cloudflare Pages with Cloudflare Workers AI, Workers KV, and MailChannels for backend needs. Near-zero client JS by design.

## Commands

```bash
npm run dev          # Local dev server (http://localhost:4321)
npm run build         # astro check + astro build (type-checked production build)
npm run build:ci      # astro build --no-type-check (faster, used in CI)
npm run check         # astro check only (type/content-schema errors)
npm run lint           # alias for `npm run check`
npm run format         # prettier --write . (astro + tailwind plugins configured)
npm run preview       # serve the built dist/ locally
npm run preview:cf    # serve dist/ via `wrangler pages dev` (Cloudflare Pages Functions included)
npm run clean         # rm -rf .astro dist
```

There is no unit test runner configured — `astro check` (type-checking + Zod content schema validation) is the primary correctness gate. Content collection errors (bad frontmatter) fail the build, so after adding/editing any Markdown in `src/content/`, run `npm run check` to catch schema violations before pushing.

`.npmrc` sets `legacy-peer-deps=true` — use `npm install`, not another package manager.

## Architecture

### Rendering model
Astro static output (`output: 'static'` in `astro.config.mjs`). Pages render to static HTML at build time; the only server-side runtime is Cloudflare Pages Functions in `functions/` (not part of the Astro build).

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
- `functions/api/` — Cloudflare Pages Functions (not Astro): `chat.js` (Workers AI chat endpoint, `@cf/meta/llama-3-8b-instruct`, in-memory + KV caching), `contact.js` (MailChannels email)
- `functions/_middleware.js` — applies CORS, CSP/security headers, and cache-control headers to all Pages responses

### Path aliases (tsconfig.json)
`@/*` → `src/*`, `@components/*`, `@lib/*`, `@config/*`, `@types/*`, `@modules/*`.

### Cloudflare deployment specifics
- Config lives in `wrangler.jsonc` (not `wrangler.toml` despite what README says). Cloudflare Pages only supports `preview`/`production` named environments.
- Workers AI binding (`AI`) and an optional `CHAT_CACHE` KV namespace (commented out by default — must be created via `wrangler kv namespace create` and uncommented to enable cross-request chat caching).
- `functions/` is deployed as Cloudflare Pages Functions alongside the static `dist/` output; it is separate from Astro's own routing/build and won't be exercised by `npm run dev` — use `npm run preview:cf` to test it locally.

### Brand tokens
```css
--color-primary:   #102B3F   /* Deep Navy */
--color-secondary: #3DBAA7   /* Mint Teal */
--color-accent:    #2CABDF   /* Bright Cyan — CTAs */
--color-surface:   #EFF6EE   /* Mint Whisper background */
```

## Conventions

- Prettier is the formatting authority (`.prettierrc`): semi, single quotes, 100 print width, with `prettier-plugin-astro` and `prettier-plugin-tailwindcss` (class sorting) — run `npm run format` before committing.
- No Google Fonts / third-party font hosting — fonts are self-hosted in `public/fonts/`; keep new fonts self-hosted to preserve the no-third-party-DNS performance posture.
- Images go through Astro's sharp pipeline (`astro.config.mjs` `image.service`) — prefer Astro `<Image>`/content-collection `image()` helpers over raw `<img src>` for anything in `src/`.
