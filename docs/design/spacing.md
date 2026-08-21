# Spacing

## Method

Every literal `rem` value on a spacing property (`padding`, `margin`, `gap`,
`row-gap`, `column-gap`, and their logical variants) inside a `<style>` block was
extracted across `src/**/*.astro` and `src/styles/global.css`. Values using
`var()`, `clamp()`, `calc()`, `auto`, `%` or viewport units were excluded, since
those are already systematic.

## Result

**631 literal spacing values. 37 distinct. 542 of them (85.9%) already sit on a
coherent 2px-granular scale.**

The spacing system was in far better shape than the colour or shape systems. It
had a real, consistent scale — it had simply never been written down.

| Token | Value | px | Existing uses |
|---|---|---|---|
| `--space-1` | 0.25rem | 4 | 33 |
| `--space-2` | 0.375rem | 6 | 18 |
| `--space-3` | 0.5rem | 8 | 90 |
| `--space-4` | 0.625rem | 10 | 28 |
| `--space-5` | 0.75rem | 12 | 67 |
| `--space-6` | 0.875rem | 14 | 41 |
| `--space-7` | 1rem | 16 | 100 |
| `--space-8` | 1.125rem | 18 | 11 |
| `--space-9` | 1.25rem | 20 | 42 |
| `--space-10` | 1.5rem | 24 | 56 |
| `--space-11` | 1.75rem | 28 | 7 |
| `--space-12` | 2rem | 32 | 41 |
| `--space-13` | 2.5rem | 40 | 5 |
| `--space-14` | 3rem | 48 | 3 |

Plus three pre-existing fluid tokens, all genuinely consumed (91 uses total):

| Token | Value | Uses |
|---|---|---|
| `--spacing-section` | `clamp(4rem, 3rem + 4vw, 6rem)` | 13 |
| `--spacing-block` | `clamp(2rem, 1.5rem + 2vw, 3rem)` | 22 |
| `--spacing-element` | `clamp(1rem, 0.75rem + 1vw, 1.5rem)` | 56 |

## The 13.5% that is off-scale

85 uses across 19 values: `0.1`, `0.125`, `0.15`, `0.2`, `0.3`, `0.35`, `0.4`,
`0.45`, `0.55`, `0.6`, `0.65`, `0.7`, `0.85`, `0.9`, `1.4`, `1.625`, `2.25`,
`3.5`, `4.0`rem. Concentrated in `insurance.astro`, `offline.astro`,
`ServiceCard.astro` and `appointments.astro`.

`npm run lint:design` reports these as **warnings**, not errors.

## Why existing values were not rewritten

Rewriting 542 already-correct literals to `var(--space-N)` would change 542 lines
across the codebase for zero visual difference, with real regression risk and no
way to verify each by eye. The value of the tokens is forward-looking: new work
references them, and the lint catches drift. Fixing what is not broken is not a
design-system improvement.

## Rules

1. New spacing uses `var(--space-N)` or one of the fluid section tokens.
2. Off-scale values need a stated reason (optical alignment, a 1px border
   compensation) in a comment next to them.
3. Values ≥ 4rem are usually layout dimensions, not spacing rhythm — out of scope
   for this scale.

## Verify

```bash
npm run lint:design      # reports off-scale spacing as warnings
```
