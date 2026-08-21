# Visual UI Token Plan — labs.google-informed component grammar → Smile Savers execution

Date: 2026-08-21. Scope: full component-token planning grounded in the already-completed 20-stage
Labs extraction (`design-intelligence/`), executed against real production components on
`claude/init-yi57kn`. Governing rule, unchanged from the original extraction plan: borrow
**relationships and structural patterns** (shape scale ratios, spacing rhythm, motion/interaction
patterns) — never Google's colors, fonts, imagery, or copy. The brand-contamination scan
(`design-intelligence/scripts/grammar.mjs`) still gates this: zero Google hex values, zero
`Google Sans`, zero Labs assets entered `src/` in this pass.

## 1. What "learning from labs.google" actually gave us

Labs' own visual system was extracted as *ratios*, not literal pixel values
(`design-intelligence/artifacts/grammar/brand-separated-grammar.json`, evidence class `DERIVED`):

| Grammar dimension | Labs pattern (ratio-only) | What it tells us |
|---|---|---|
| `radiusScale` | 9 discrete tiers, ratios `1 → 4.1 → 6.5 → 10.7 → 11.5 → 12.5 → 25 → 250 → 2497.5` (relative to smallest non-zero radius) | Labs uses a **small number of discrete shape tiers**, not a continuous spread — small elements share one radius, large "hero" surfaces jump to a distinctly larger tier before pill/circle shapes |
| `spacingRhythm` | 12 step ratios from 1× to 5× a base unit, heavily clustered at 1/1.5/2.5/3/4× | A rhythm built from a handful of repeated multiples, not ad hoc values |
| `typographyHierarchy` | Consecutive step ratios mostly 1.02–1.2×, with larger 1.4–1.7× jumps at a few points | A modular type scale with occasional deliberate larger jumps (display sizes), not linear growth |
| `interactionStatePatterns` | `focusVisibleAppliedSystematically: true` (28/28 resolved rules showed a measurable focus delta) | Every interactive element gets a visible focus treatment, no exceptions |
| `motionRelationships` | `motionAffectsInitialVisibility: true` | Entrance animations can hide content when motion is suppressed — a correctness trap Labs itself has (see design-intelligence Stage 4 finding E-11), not a pattern to copy |

M3/M3E correspondences (`design-intelligence/artifacts/material/m3-cross-reference.json`) are all
classified `MAPPED`, never provenance — `m3.material.io` was unreachable this session, so any
specific M3 numeric value is prior general knowledge, not freshly re-verified, and is treated
accordingly below (recommendations, not asserted facts).

## 2. Where Smile Savers already matches or diverges

Real measurement against the live `src/` codebase, not assumption:

| Dimension | Smile Savers today | Verdict |
|---|---|---|
| Focus-visible coverage | A universal `:focus-visible { outline: 2px solid var(--color-primary) }` reset already exists (`src/styles/global.css:470`), with 9 components layering a contextual override on top (CTA elements ring in accent, primary-colored elements ring in primary) | **Already matches** Labs' "systematic focus visibility" pattern — the earlier design-system audit's "9/70 components have focus-visible" framing undercounted this: those 9 are the *overrides*, not the only elements with any focus indication. Corrected here rather than repeated. |
| Motion / entrance-hides-content trap | No JS-driven entrance animations gate content visibility in this codebase (near-zero client JS by design) | **Not applicable** — the trap Labs has doesn't exist here to inherit |
| Shape scale | `--radius-sm/md/lg/xl/2xl` = 0.25/0.5/0.75/1/1.5rem, a clean small→large token progression | **Good bones**, but 12+ component files bypassed it with hardcoded near-duplicate values |
| Shape scale, real defect found | The dominant "card" pattern (`background:#fff; border:1.5px solid var(--color-border); border-radius: …`) had drifted to **three different radii for the same visual role**: `1.125rem`, `1.25rem`, `1.375rem`, spread across `TeamGrid`, `TestimonialsSlider`, `ServicesPreview`, `DoctorsList`, `ValuesList`, `TrustSignals`, `ServiceCard`, `HomeCTA`, `LocationMap` | **Fixed this pass** (§3) — exactly the kind of scale drift Labs' discrete-tier pattern argues against |
| Elevation | `--shadow-sm/md/lg/xl` already forms a coherent, increasing blur/spread progression (`rgba(31,41,55,…)`, Material-elevation-like) | **Already coherent** — no change made; inventing a replacement would be churn without evidence of a real defect |
| Motion easing | `--ease-out-expo/quart/quint`, `--ease-in-out`, `--duration-instant→entrance` already form a deliberate, named scale | **Already coherent** — left untouched for the same reason |

## 3. Executed this pass (real production changes, on `claude/init-yi57kn`)

1. **New component-layer token**: `--radius-card: 1.25rem` (`src/styles/global.css`), the most
   common of the three drifted values. Six-layer token architecture placement: `component` layer
   (per the existing `token-inventory.json` domain model), not `reference` — it encodes a Smile
   Savers UI decision, not a Labs value.
2. **Consolidated 9 components** onto the new token, replacing their hardcoded `1.125rem`/`1.25rem`
   radius with `var(--radius-card)`: `TeamGrid.astro`, `TestimonialsSlider.astro`,
   `ServicesPreview.astro`, `DoctorsList.astro`, `ValuesList.astro`, `TrustSignals.astro`,
   `ServiceCard.astro`, `HomeCTA.astro`, `LocationMap.astro`.
   - Deliberately **not** touched: `ChatWidget.astro`'s `1.375rem` speech-bubble radii (a distinct
     asymmetric-corner chat-bubble shape, not the generic card role) and `Hero.astro`'s
     `stats-ribbon` (an asymmetric top-rounded ribbon, different shape role even though its value
     happens to already match).
3. Verified with a real rendered screenshot (Playwright + the pre-installed Chromium, homepage at
   1440×1200, full page) — layout intact, card corners visually consistent, no regression. Not a
   full 6-viewport/pixel-diff regression run (that harness exists at Stage 15 but wasn't re-invoked
   for this single-token change; a visual eyeball check was proportionate to the size of the change).
4. `npm run check` (0 errors, unchanged), `npm run build` (32 pages, unchanged),
   `npm test` (15/15, unchanged).

## 4. Recommended, not executed this pass (needs a decision or larger effort)

These are real, evidence-backed opportunities from the same grammar extraction, sized larger than
a single-turn token consolidation — listed honestly as open, not silently done:

| Recommendation | Evidence basis | Why not done now |
|---|---|---|
| Add one intermediate shape tier between `--radius-xl` (1rem) and `--radius-2xl` (1.5rem) as a *named reference token* (not just the one-off `--radius-card` component alias) | Labs' 9-tier shape scale has more granularity in this range than Smile Savers' 6 tiers | `--radius-card` already solves the one real defect found; adding a speculative reference tier with no second consumer would be the "orphan token" problem (finding #4) repeating itself |
| Audit and possibly consolidate spacing values the same way `border-radius` was (Labs' `spacingRhythm` clusters at 1/1.5/2.5/3/4× — worth checking Smile Savers' padding/gap values for the same kind of drift) | Same extraction, `spacingRhythm` | Not measured this pass — would need the same drift-detection grep across all `padding`/`gap` declarations, a separate, larger pass |
| Typography scale audit against the modular-scale pattern (mostly 1.02–1.2× steps, occasional 1.4–1.7× jump) | `typographyHierarchy` | Smile Savers' `--font-size-*` already uses `clamp()` fluid sizing, a different (and arguably more modern) mechanism than a fixed modular scale — reconciling the two needs a design decision, not a mechanical fix |
| Full 6-viewport visual regression re-run (Stage 15 harness) to formally re-prove pixel-level non-regression beyond the single screenshot taken here | Existing `design-intelligence/scripts/regression.mjs` | Out of proportion for a single CSS-variable consolidation touching corner radius only; appropriate before a larger visual pass |

## 5. Rules and guidelines going forward (the actual "design system rules" deliverable)

1. **Shape**: any new card-like surface (`white/light background + border + rounded corners`)
   uses `var(--radius-card)`. Any other rounded shape uses the base `--radius-sm/md/lg/xl/2xl/full`
   scale. No new literal `border-radius: N.NNNrem` values in component files — this is now a real,
   grep-able lint rule (`grep -rn "border-radius:\s*[0-9]" src --include="*.astro" | grep -v "var(--"`)
   the same way the domain-canonicalization and brand-contamination checks already are.
2. **Color**: `--color-accent`/`--color-accent-dark` (and the `--color-interactive-*` aliases added
   in the prior pass) are the only sanctioned CTA colors; never introduce a new brand hue without
   re-running the WCAG contrast check that caught the original accent failure.
3. **Motion/Elevation**: the existing `--duration-*`/`--ease-*`/`--shadow-*` scales are already
   coherent — new components should consume them, not invent new easing curves or shadow values.
4. **Brand separation stays absolute**: nothing in `design-intelligence/artifacts/` (Labs' literal
   colors, fonts, copy, imagery) may enter `src/`. Only structural *ratios/patterns*, re-expressed
   in Smile Savers' own values, are portable — exactly what happened with `--radius-card` above
   (a Smile Savers value, informed by a Labs pattern, containing zero Labs data).

## Verification

```
npm run check   # 0 errors, unchanged
npm run build   # 32 pages, unchanged
npm test        # 15/15, unchanged
```
Screenshot evidence: homepage render checked visually post-change (Playwright + Chromium,
1440×1200, full page) — no layout regression observed.
