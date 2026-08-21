# Visual UI principles — extracted, graded, and applied

Source material: the 20-stage labs.google extraction in `design-intelligence/`, specifically
`artifacts/grammar/brand-separated-grammar.json` (structural ratios only) and
`artifacts/material/m3-cross-reference.json`.

**Grading.** Every entry below is tagged so you can tell what is measured from what is opinion:

| Tag | Meaning |
|---|---|
| **FACT** | Measured in this repo or in the extraction artifacts. Re-runnable. |
| **INFERENCE** | Reasoned from a FACT, but the reasoning could be wrong. |
| **RECOMMENDATION** | Design judgement. Established practice, but a judgement. |
| **EXPERIMENT** | Worth trying; needs real evidence before being treated as settled. |

**Hard boundary, unchanged:** only *structural relationships* (ratios, rhythm, patterns) are
portable from Labs. No Google colour, font, imagery, or copy enters `src/`. Enforced by the
contamination scan in `design-intelligence/scripts/grammar.mjs`.

---

## A. Layout
**FACT** — Labs constrains content to a max width (`compositionPatterns.usesContentMaxWidthConstraint`).
Smile Savers already does this via `--container-xl`. *No change needed.*

## B. Composition
**FACT** — Labs' spacing steps cluster at 1 / 1.5 / 2.5 / 3 / 4× a base unit — a small set of
repeated multiples, not a continuous spread.
**INFERENCE** — Smile Savers' spacing has not been audited for the same clustering. Padding and gap
values across components are likely drifted the same way `border-radius` was.
*Action: deferred to a spacing audit pass. Not claimed as done.*

## C. Typography
**FACT** — Labs' type scale steps mostly 1.02–1.2×, with occasional deliberate 1.4–1.7× jumps for
display sizes.
**FACT** — Smile Savers uses fluid `clamp()` sizing, a different mechanism.
**RECOMMENDATION** — Do **not** replace fluid sizing with a fixed modular scale. Fluid sizing is
better for the mobile-first requirement; the two approaches solve different problems and swapping
would be churn. Revisit only if a real legibility defect appears.

## D. Colour
**FACT** — The brand is cyan (`#11bcee` / `#0a83bb`), derived from the vector master. No gold exists.
**FACT** — The bright brand cyan cannot carry white text (2.27:1) but carries navy comfortably (6.44:1).
**Rule:** brand cyan is a *surface*; CTAs use the dark end of the ramp. Full method in
[`colour.md`](./colour.md).

## E. Spacing
See **B**. Tokens exist (`--spacing-*`); systematic audit outstanding.

## F. Shape
**FACT** — Labs uses a small number of *discrete* shape tiers, not a continuous spread of radii.
**FACT** — Smile Savers had drifted to three near-identical card radii (1.125 / 1.25 / 1.375rem)
across 12+ components for the same visual role.
**Applied:** consolidated onto `--radius-card` (1.25rem). ChatWidget's asymmetric speech bubbles and
Hero's ribbon were deliberately excluded — different shape roles, not the generic card.

## G. Elevation
**FACT** — `--shadow-sm/md/lg/xl` already form a coherent increasing progression.
*Checked against the extraction and left untouched — replacing a working scale without a measured
defect is churn.*

## H. Borders
**FACT** — `1.5px solid var(--color-border)` is the dominant card border, used consistently.
*No defect found.*

## I. Components
**FACT** — 21 of 47 components declare a typed `interface Props`. (Corrected from an earlier
audit's "5 of 47", which used a glob that missed `src/modules/**`.)
**RECOMMENDATION** — New components should declare `interface Props`. Retrofitting all 26 is a
separate pass.

## J. Interaction
**FACT** — Labs applies a visible focus treatment to every interactive element
(`focusVisibleAppliedSystematically: true`, 28/28 rules showed a measurable delta).
**FACT** — Smile Savers has a universal `:focus-visible` reset in `global.css:470` that every
element inherits, plus 9 components layering contextual overrides.
**Correction:** an earlier audit read this as "only 9/70 components have focus-visible" — that
undercounted the inherited reset. The site already matches the Labs pattern. One real gap was found
and fixed: `.hdr-cta` had no focus treatment of its own.

## K. Motion
**FACT** — Labs' entrance keyframes leave elements in a pre-entry state when motion is suppressed:
desktop-xl visible elements drop 500 → 444 under `prefers-reduced-motion: reduce`
(`motionAffectsInitialVisibility: true`).
**INFERENCE** — This is a *bug in Labs*, not a pattern to copy. Content that only becomes visible
via animation disappears for reduced-motion users.
**FACT** — Smile Savers has near-zero client JS and no animation-gated content, so it does not have
this defect. **Rule: never introduce entrance animation that gates visibility.**

## L. Responsive behaviour
**FACT** — Labs' breakpoint ratios: 1.5 / 1.28 / 1.33 / 1.41 — roughly even spacing, 9 breakpoints.
**RECOMMENDATION** — Smile Savers should not proliferate breakpoints to match. Content-driven
breakpoints, audited at 320 / 768 / 1440 minimum. Full 9-viewport audit outstanding.

## M. Accessibility
**FACT** — WCAG 2.2 AA is the target. Real axe violations existed and are partially resolved:
the `--color-accent` contrast failure (root cause of most of them) is fixed; booking-wizard labels
and testimonial ARIA roles are fixed; the remaining set is tracked as DEBT-0017.
**Rule:** contrast is proven by computation over token pairs, never by eye. Colour is never the only
signal. Focus indicators are never removed for aesthetics.

## N. Content hierarchy
**RECOMMENDATION** — The homepage should progressively answer: what is this → can I trust them →
is it right for me → where → what next. Current order (Hero → Affiliations → Services → Trust →
Doctors → Testimonials → FAQ → CTA) broadly does this. *No reordering proposed without evidence.*

## O. Visual hierarchy
**FACT** — The hero has two CTAs (`.cta-primary`, `.cta-secondary`).
**INFERENCE** — Two CTAs is acceptable *if* they serve genuinely different intents (book vs. call).
For a dental practice, "call now" and "book online" are genuinely different user intents, so this is
not CTA competition. *Left as-is.*

## P. Information architecture
Eight content collections, four programmatic-SEO route families. **FACT:** a second, orphaned
content root exists at `content/posts/` (TinaCMS residue) that competes with the real
`src/content/`. *Flagged; removal pending confirmation.*

## Q. Conversion UX
**RECOMMENDATION** — One primary conversion (book appointment), secondary (call, directions).
CTA hierarchy must stay consistent site-wide, which the token model now enforces: every primary CTA
resolves to `button.primary.background`, so they cannot drift apart.

## R. Trust UX
**Rule, non-negotiable:** never fabricate testimonials, ratings, credentials, or insurance
relationships. **FACT** — an unsupported `AggregateRating` (5.0/200) was already removed from
structured data for exactly this reason. A visible "200+ verified reviews" string still exists in
the testimonial slider without a verifiable source — flagged for the business to confirm or remove.

## S. Performance
**FACT** — `public/logo.svg` is 568KB with no `viewBox`, rendered at 180×36, on every page above the
fold. The site's entire CSS+JS is 296KB. **The logo alone is ~2× the whole site's code payload.**
**FACT** — `public/logosq.svg` is 932KB and referenced nowhere.
*This is the single highest-impact performance defect on the site.*

## T. Design-system architecture
**Applied:** four-tier token model — `primitive → semantic → component → context` —
generated by `design-intelligence/scripts/brand-tokens.mjs` into both `tokens.json` and `tokens.css` from
one source, so the two cannot drift. `--check` gates both drift and contrast regression, and both
gates were proven to actually fail when broken.

---

## What this deliberately does not claim

- Spacing and typography have **not** been systematically audited. Listed as outstanding, not done.
- The 9-viewport responsive audit is **not** complete.
- Component state matrices (§16 of the brief) are **not** built.
- M3/M3E correspondences are `MAPPED`, never provenance — `m3.material.io` was unreachable, so no
  specific M3 numeric value here is independently re-verified.
