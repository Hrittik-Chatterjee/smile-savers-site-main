# Smile Savers - Task Tracker

> Last Updated: February 4, 2026 (Session 1)
> Reference: task 4 feb.md (CSS & Architecture Audit)

---

## High Priority Tasks 🔴

### Task 1: Extract Shared Page Header Styles
- **Status:** [ ] Not Started
- **Description:** Create a reusable `PageHeader.astro` component to eliminate ~280 lines of duplicated CSS
- **Affected Files:**
  - `src/pages/about.astro`
  - `src/pages/contact.astro`
  - `src/pages/appointments.astro`
  - `src/pages/services/index.astro`
- **Action:** Extract duplicated breadcrumb and page header styles (~70 lines each) into a shared component
- **Location for new component:** `src/components/PageHeader.astro`

### Task 2: Standardize Import Paths to @/ Alias
- **Status:** [ ] Not Started
- **Description:** Update all relative imports to use the `@/` path alias for consistency
- **Files to Update:**
  - [ ] `src/pages/index.astro` - change `../layouts/PageLayout.astro` to `@/layouts/PageLayout.astro`
  - [ ] `src/pages/contact.astro` - change `../layouts/PageLayout.astro` to `@/layouts/PageLayout.astro`
  - [ ] `src/pages/appointments.astro` - change `../layouts/PageLayout.astro` to `@/layouts/PageLayout.astro`

---

## Medium Priority Tasks 🟡

### Task 3: Replace Custom Grids with Utility Classes
- **Status:** [ ] Not Started
- **Description:** Use existing `grid-auto` utility class instead of custom CSS grids
- **Files to Update:**
  - [ ] `src/pages/compare/index.astro` - replace `.comparisons-grid` custom CSS with `grid-auto` utility
  - [ ] `src/pages/appointments.astro` - replace help-container `auto-fit, minmax(280px, 1fr)` with `grid-auto`
- **Target Pattern:**
  ```html
  <section class="grid-auto" style="--grid-min: var(--grid-min-lg);">
  ```

### Task 4: Replace Hardcoded Gap Values with Design Tokens
- **Status:** [ ] Not Started
- **Description:** Use `--grid-gap-*` CSS variables instead of hardcoded values
- **Files to Update:**
  - [ ] `src/pages/contact.astro` - `.bento-grid { gap: 1rem; }` → `gap: var(--grid-gap-md);`
  - [ ] `src/pages/appointments.astro` - check for hardcoded gap values

---

## Low Priority Tasks 🟢

### Task 5: Consider Container Query Migration
- **Status:** [ ] Not Started
- **Description:** Migrate service cards to use `@container` queries for portable sizing
- **Note:** This is a Tailwind v4 best practice enhancement, not a bug fix
- **Components to Consider:**
  - Service cards
  - Other reusable card components

---

## Completed Tasks ✅

### About Page Responsiveness Fix (Feb 4, 2026)
- [x] **ClinicStory.astro** - Fixed mobile responsiveness
  - Changed from max-width breakpoint to mobile-first min-width approach
  - Stats section: converted from flex to responsive grid (3 columns on all sizes)
  - Added responsive gap scaling with design tokens
  - Stats text/numbers scale properly on mobile
- [x] **ValuesList.astro** - Migrated to grid-auto utility
  - Added `grid-auto` utility class with `--grid-min: var(--grid-min-md)`
  - Removed custom grid CSS, now uses global design tokens for gaps

---

## Quick Reference - Current Scores

| Aspect | Score | Target |
|--------|-------|--------|
| Overall Architecture | 9/10 | Maintain |
| CSS/Tailwind v4 Compliance | 9/10 | Maintain |
| Grid System Consistency | 7/10 | → 9/10 |
| Responsive Design | 8/10 | Maintain |
| Accessibility | 8/10 | Maintain |
| Code Consistency | 6/10 | → 9/10 |

---

## Notes for Future Sessions

- Global CSS is at `src/styles/global.css` with 180+ design tokens
- Grid utilities available: `.grid-content`, `.grid-auto`, `.grid-3`
- Gap tokens: `--grid-gap-xs` through `--grid-gap-xl`
- Path alias `@/` maps to `src/`
- Using Tailwind v4 with CSS-first configuration via `@theme` directive
