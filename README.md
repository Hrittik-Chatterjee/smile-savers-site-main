<div align="center">

<img src="public/favicon.svg" width="64" alt="Smile Savers logo" />

# Smile Savers Dental

**Top-rated dental care in Woodside, Queens, NYC — Est. 1987**

[![Deploy](https://img.shields.io/github/actions/workflow/status/rahulpaul3696/smile-savers-site/deploy.yml?label=Deploy&logo=cloudflare&logoColor=white&style=flat-square)](https://github.com/rahulpaul3696/smile-savers-site/actions)
[![Pages](https://img.shields.io/badge/Cloudflare_Pages-Free-F38020?style=flat-square&logo=cloudflare)](https://smilesavers.dental)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa)](https://smilesavers.dental/manifest.json)
[![License](https://img.shields.io/badge/License-Private-red?style=flat-square)](LICENSE)

[**Live Site**](https://smilesavers.dental) · [**Book Appointment**](https://smilesavers.dental/appointments) · [**CI/CD**](https://github.com/rahulpaul3696/smile-savers-site/actions)

</div>

---

## Overview

Production website for **Smile Savers Dental**, a 35+ year dental practice in Woodside, Queens, NY. Built for maximum performance, zero infrastructure cost, and AI-native features — all deployed on Cloudflare's free tier.

| Metric | Target |
|--------|--------|
| Lighthouse Performance | ≥ 95 |
| Lighthouse SEO | ≥ 98 |
| Lighthouse Accessibility | ≥ 95 |
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3.8s |
| Infrastructure Cost | $0/month |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Astro 6](https://astro.build) — static output, 0 JS by default |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) + [DaisyUI v5](https://daisyui.com) |
| **Hosting** | [Cloudflare Pages](https://pages.cloudflare.com) — free tier |
| **AI Chat** | [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) — `llama-3-8b-instruct`, 100k req/day free |
| **Email** | [MailChannels](https://mailchannels.com) — free on Cloudflare Pages |
| **Cache** | Cloudflare KV — 1GB free |
| **PWA** | Service Worker + Web App Manifest |
| **CI/CD** | GitHub Actions → Cloudflare Pages Action |
| **Language** | TypeScript (strict mode) |
| **Content** | Astro Content Collections (Zod schemas) |

---

## Project Structure

```
smile-savers-site/
├── .github/
│   ├── workflows/
│   │   ├── deploy.yml          # CI/CD: quality → build → preview/prod → lighthouse
│   │   └── security.yml        # Weekly npm audit
│   ├── ISSUE_TEMPLATE/
│   │   └── bug.yml
│   └── PULL_REQUEST_TEMPLATE.md
│
├── functions/
│   └── api/
│       ├── chat.js             # Workers AI endpoint (Smile assistant)
│       └── contact.js          # Contact form → MailChannels
│
├── public/
│   ├── _headers                # Cloudflare security + cache headers
│   ├── _redirects              # Cloudflare URL redirects
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker (cache-first / net-first)
│   ├── fonts/                  # Self-hosted Inter + Plus Jakarta Sans
│   ├── icons/                  # PWA icons 72–512px
│   └── images/                 # Doctor photos, hero, clinic
│
├── src/
│   ├── components/
│   │   ├── common/             # PageHeader, CTASection, ChatWidget, BeforeAfter
│   │   ├── layout/             # Header, Footer, MobileBottomBar, Navigation
│   │   ├── icons/              # SVG sprite
│   │   └── ui/                 # Button
│   │
│   ├── config/
│   │   ├── site.ts             # Practice info, hours, social links
│   │   ├── navigation.ts       # Nav + footer links
│   │   └── doctors.ts          # Doctor profiles
│   │
│   ├── content/                # Astro Content Collections
│   │   ├── services/           # 9 service MD files
│   │   ├── team/               # 3 doctor MD files
│   │   ├── testimonials/       # 6 patient reviews
│   │   ├── locations/          # Programmatic SEO location pages
│   │   ├── comparisons/        # Comparison pages
│   │   └── glossary/           # Dental term pages
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro    # HTML shell: PWA, Schema.org, fonts, SW
│   │   ├── PageLayout.astro    # Header + Footer wrapper
│   │   └── LegalLayout.astro   # Privacy/Terms wrapper
│   │
│   ├── modules/                # Feature-scoped components
│   │   ├── homepage/           # Hero, Services, TrustSignals, Doctors, Testimonials, FAQ, CTA
│   │   ├── about/              # ClinicStory, TeamGrid, ValuesList
│   │   ├── appointments/       # BookingWizard (5-step, API-wired)
│   │   ├── contact/            # ContactForm, ContactInfo, LocationMap, OfficeHours
│   │   ├── services/           # ServiceCard, ServiceDetail, FAQ
│   │   └── programmatic-seo/   # Location + comparison + glossary layouts
│   │
│   ├── pages/                  # Astro file-based routing
│   │   ├── index.astro         # Homepage
│   │   ├── about.astro
│   │   ├── services/
│   │   │   ├── index.astro     # Services listing
│   │   │   └── [slug].astro    # Service detail (9 pages + before/after)
│   │   ├── appointments.astro
│   │   ├── contact.astro
│   │   ├── insurance.astro
│   │   ├── team/[slug].astro   # 3 doctor profile pages
│   │   ├── offline.astro       # PWA offline fallback
│   │   └── [service]/[neighborhood]/ # Programmatic SEO
│   │
│   └── styles/
│       └── global.css          # Tailwind @theme + brand tokens + DaisyUI overrides
│
├── astro.config.mjs            # Astro config (sharp images, HTML compression, code splitting)
├── wrangler.toml               # Cloudflare Pages + Workers + KV config
├── tsconfig.json               # TypeScript strict mode + path aliases
└── lighthouse-budget.json      # Performance budgets for CI
```

---

## Quick Start

```bash
# Clone
git clone https://github.com/rahulpaul3696/smile-savers-site.git
cd smile-savers-site

# Install
npm install

# Dev server
npm run dev
# → http://localhost:4321

# Build
npm run build

# Preview built site
npm run preview
```

---

## Environment Setup

### Required Cloudflare secrets (GitHub → Settings → Secrets)

| Secret | Where to find it |
|--------|-----------------|
| `CLOUDFLARE_API_TOKEN` | [CF Dashboard](https://dash.cloudflare.com) → My Profile → API Tokens → Create Token (Edit Cloudflare Pages) |
| `CLOUDFLARE_ACCOUNT_ID` | CF Dashboard → right sidebar (Account ID) |

### Required DNS record (email delivery)

```
TXT  @  "v=spf1 include:relay.mailchannels.net ~all"
```

### KV Namespace (AI chat caching)

1. CF Dashboard → Workers & Pages → KV → Create namespace → name: `CHAT_CACHE`
2. Copy the namespace ID → paste into `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "CHAT_CACHE"
   id      = "paste-your-id-here"
   ```

---

## CI/CD Pipeline

```
Push to main
    │
    ├── 🔍 Quality Gate
    │     type-check (astro check)
    │     format check (prettier)
    │
    ├── 🏗️ Build
    │     npm ci → astro build --no-type-check
    │     bundle size report → GitHub summary
    │
    ├── 🚀 Deploy Production
    │     Cloudflare Pages (automatic)
    │     environment: production (protected)
    │
    └── 🏠 Lighthouse Audit
          4 pages: /, /services, /appointments, /contact
          Results uploaded as artifacts

Pull Request
    │
    ├── 🔍 Quality Gate
    ├── 🏗️ Build
    └── 🔮 Deploy Preview
          Unique preview URL per PR
          Auto-comment on PR with page links
```

---

## AI Chat — "Smile"

The site includes **Smile**, an AI dental assistant powered by Cloudflare Workers AI.

| Spec | Value |
|------|-------|
| Model | `@cf/meta/llama-3-8b-instruct` |
| Free quota | 100,000 requests/day |
| Cache | In-memory LRU (200 entries, 30min TTL) |
| KV cache | Cross-request (requires KV namespace) |
| CORS | Restricted to `smilesavers.dental` |
| Input limit | 500 chars, sanitised |
| Context | Full clinic info, doctors, services, insurance, hours |

**Endpoint:** `POST /api/chat`
```json
{ "message": "What are your Saturday hours?", "history": [] }
```

---

## Brand Tokens

```css
--color-primary:       #102B3F   /* Deep Navy */
--color-secondary:     #3DBAA7   /* Mint Teal */
--color-accent:        #2CABDF   /* Bright Cyan — CTAs */
--color-surface:       #EFF6EE   /* Mint Whisper background */
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server with HMR |
| `npm run build` | Production build (includes type-check) |
| `npm run build:ci` | CI build (skips type-check, faster) |
| `npm run lint` | Type-check only |
| `npm run preview` | Serve built site locally |
| `npm run preview:cf` | Serve via Wrangler (Cloudflare local) |
| `npm run format` | Format all files with Prettier |
| `npm run clean` | Delete `.astro/` and `dist/` |

---

## Content Management

All content is managed via **Markdown files** in `src/content/`:

```bash
# Add a new service
cp src/content/services/general-dentistry.md src/content/services/new-service.md
# Edit frontmatter + body → git push → auto-deploys

# Add a testimonial
touch src/content/testimonials/patient-7.md
# Fill in schema fields → git push
```

Schemas are validated by Zod at build time — invalid content breaks the build cleanly.

---

## Performance Notes

- **Fonts**: Self-hosted (no Google Fonts) → no third-party DNS, no privacy tracking
- **Images**: Astro sharp pipeline → auto-converts to WebP on build
- **CSS**: DaisyUI purged by Tailwind → only used classes in output
- **JS**: Near-zero client JS (Astro static output) — only ChatWidget + BookingWizard
- **Service Worker**: Cache-first for assets, stale-while-revalidate for images
- **CDN**: Cloudflare global edge (300+ PoPs, free tier)

---

## Practice Info

| | |
|-|-|
| **Practice** | Smile Savers Dental |
| **Address** | 3202 53rd Place, Woodside, NY 11377 |
| **Phone** | (718) 956-8400 |
| **Email** | dentalsmilesavers@gmail.com |
| **Hours** | Mon–Thu 10AM–6PM · Sat 9AM–1PM |
| **Est.** | 1987 |
| **Doctors** | Dr. Deepak Bhagat DDS · Dr. Julie Islam DMD · Dr. Lee DDS |

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://srcreativehub.com">SR Creative Hub</a> · Deployed on Cloudflare Pages · Zero infrastructure cost</sub>
</div>
