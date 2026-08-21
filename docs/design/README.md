# Smile Savers design system

Measured from the running site and its real brand assets, not designed on paper.
Every colour value here is derived by script from evidence; none were chosen by eye.

## Read in this order

| Doc | What it covers |
|---|---|
| [`decisions.md`](./decisions.md) | The eight decision records, including where a decision contradicts an instruction and why |
| [`colour.md`](./colour.md) | How the palette was derived from the logo in OKLCH, the full ramp, and the surface-vs-CTA rule |
| [`typography.md`](./typography.md) | The `@font-face` defect that meant the site never rendered in its own fonts, and the current setup |
| [`spacing.md`](./spacing.md) | The measured spacing scale, and why 542 existing values were deliberately left alone |
| [`component-state-matrix.md`](./component-state-matrix.md) | Per-component state coverage, measured from source, with real gaps named |
| [`visual-ui-principles.md`](./visual-ui-principles.md) | labs.google extraction graded FACT / INFERENCE / RECOMMENDATION |

## The generators

Design values are produced by script so they can be re-derived and verified,
rather than living as hexes someone typed once.

```bash
node design-intelligence/scripts/palette.mjs           # brand ramp from public/logoold.svg
node design-intelligence/scripts/category-palette.mjs  # 8 accessible category ink/tint pairs
node design-intelligence/scripts/brand-tokens.mjs      # four-tier tokens -> tokens.json + tokens.css
```

## The gates

```bash
npm run tokens:check    # JSON/CSS drift + every claimed contrast pair
npm run lint:design     # hardcoded brand hex, stale rgba, spacing scale, radius, @font-face
npm run check           # astro type + content schema
npm test                # API behaviour regression suite
```

Both design gates run blocking in CI. Each rule exists because that exact class of
defect already shipped to production, and each was verified by deliberately
breaking it and confirming a non-zero exit — a gate never observed failing is not
a gate.

## What this system does not claim

- It is **not** "WCAG compliant". Specific, measured contrast pairs pass; that is
  a narrower claim. Automated checks cannot establish full conformance.
- The 9-viewport responsive pass covers `/` and `/appointments/`, not all 32 routes.
- Component states have real, named gaps — see the state matrix.
- No performance claim is made beyond measured asset payload deltas. There is no
  field/RUM data.
