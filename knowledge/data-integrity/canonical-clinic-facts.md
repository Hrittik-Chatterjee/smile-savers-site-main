---
type: CanonicalFact
title: Canonical clinic facts
description: The single source of truth for domain, coordinates, hours, and team size — and what previously contradicted it.
resource: https://github.com/LabLaunchPad/smile-savers-site-main/blob/claude/init-yi57kn/src/config/site.ts
tags: [data-integrity, canonical, site-config]
generated:
  by: process:claude-code-session-017vquuZdhBBxxo8bXTZ4QcN
  at: 2026-08-19T13:20:00Z
status: stable
sources:
  - src/config/site.ts, src/layouts/BaseLayout.astro, src/modules/contact/components/LocationMap.astro, functions/api/chat.js, functions/api/contact.js, src/modules/homepage/components/Hero.astro (commit cd7d6d7)
  - uploaded third-party audit SmileSaversAudit20260819T122703Z, findings DATA-001/DATA-002/CONTENT-002
  - user AskUserQuestion answer confirming dentalsmilesavers.com as canonical domain (2026-08-19)
---

# Canonical clinic facts

`src/config/site.ts` is the single source of truth. Treat any other file that hardcodes one of these values as a bug waiting to drift again.

| Fact | Canonical value | Source | Previously contradicted by |
|---|---|---|---|
| Domain | `https://dentalsmilesavers.com` | `siteConfig.url` | `smilesavers.dental` (wrangler.jsonc, BaseLayout structured data, CORS allowlists, README) — user-confirmed the correction, not assumed |
| Coordinates | `40.7457, -73.9025` | `siteConfig.address.{latitude,longitude}` | `site.ts` itself previously had a third, uncorroborated pair (`40.7549, -73.9059`) while `BaseLayout.astro` and `LocationMap.astro` (OSM-geocoded) already agreed with each other — the two-source consensus won |
| Friday hours | 9:00 AM – 5:00 PM | `siteConfig.hours` / `functions/api/chat.js`'s hardcoded string (both agree) | `functions/api/contact.js`'s auto-reply text said 9 AM–1 PM — the one-source outlier was fixed to match |
| Dentist count | Derived from `src/content/team/` (currently 4 entries) | `Hero.astro` now computes `(await getCollection("team")).length` instead of a hardcoded number | Hero copy previously hardcoded "three specialist dentists" against a 4-entry collection |

## Pattern worth repeating elsewhere

The dentist-count fix is the template for preventing this class of bug generally: **derive from the actual data source at build time, don't hardcode a number that has to be manually kept in sync.** Any other place in the codebase that states a count, list, or fact also present in a content collection or `site.ts` should be checked for the same hardcoding risk.
