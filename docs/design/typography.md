# Typography

## The defect that this audit found

**The site had never rendered in its own typography.** For its entire life it
displayed in whatever sans-serif the visitor's operating system supplied, while
downloading two font files that were never used.

Three separate faults compounded:

1. **No `@font-face` rule existed anywhere in the codebase.** `BaseLayout.astro`
   preloaded both `.woff2` files, and `--font-family-sans` / `--font-family-heading`
   named the families — but nothing ever bound those names to those files. A
   `font-family` naming a font the browser has never been told about silently
   falls through to the next entry in the stack.
2. **`plus-jakarta-sans-variable.woff2` was not a font.** It was Google's literal
   `Error 404 (Not Found)` HTML page, 1,639 bytes, saved with a `.woff2`
   extension.
3. **`inter-variable.woff2` was not variable.** A static single-weight subset
   (weight 400, family name `Inter`, 498 glyphs). The site uses weights
   400/500/600/700, so browsers synthesised fake bold.

### How it was proven

Not by reading the CSS — by measuring the rendered result. A canvas
`measureText` probe compared each named family against a font name guaranteed not
to exist:

```
bogus font name : 546.58203125px
"Inter Variable" : 546.58203125px   ← byte-identical, so not a real font
"Plus Jakarta Sans Variable" : 546.58203125px
document.fonts.size : 0
```

After the fix, `document.fonts.size` is 2, both report `loaded` with correct
weight ranges, and both measure distinctly from the control.

## Current state

| Family | File | Size | Axes | Licence |
|---|---|---|---|---|
| Inter Variable | `inter-variable.woff2` | 74.4KB | `wght 100–900`, `opsz 14–32` | SIL OFL 1.1 |
| Plus Jakarta Sans Variable | `plus-jakarta-sans-variable.woff2` | 28.4KB | `wght 200–800` | SIL OFL 1.1 |

Both subset to the Latin ranges this site uses (basic Latin, Latin-1, Latin
Extended-A, punctuation, currency, plus the arrows/stars/checks the UI renders).
Licence files sit alongside them in `public/fonts/`.

`font-display: swap` — text paints immediately in the fallback and swaps when the
font arrives. Chosen over `optional` because the brand typeface matters here, and
over `block` because invisible text is worse than a swap.

## Roles

| Role | Token | Family |
|---|---|---|
| Headings (h1–h6) | `--font-family-heading` | Plus Jakarta Sans Variable |
| Body, UI, everything else | `--font-family-sans` | Inter Variable |
| Mono | `--font-family-mono` | system stack — see below |

`--font-family-mono` previously named `"JetBrains Mono Variable"`, which is not
shipped and has **zero consumers** anywhere in `src/`. It was reduced to an honest
system stack rather than naming a font the site does not have.

## Scale (declared)

```
--font-size-xs   clamp(0.75rem,  0.7rem  + 0.25vw, 0.8125rem)
--font-size-sm   clamp(0.8125rem,0.775rem+ 0.25vw, 0.875rem)
--font-size-base clamp(0.9375rem,0.9rem  + 0.25vw, 1rem)
--font-size-lg   clamp(1.0625rem,1rem    + 0.35vw, 1.125rem)
--font-size-xl   clamp(1.1875rem,1.1rem  + 0.5vw,  1.3125rem)
--font-size-2xl  clamp(1.4375rem,1.3rem  + 0.75vw, 1.625rem)
--font-size-3xl  clamp(1.75rem,  1.5rem  + 1vw,    2rem)
--font-size-4xl  clamp(2.125rem, 1.8rem  + 1.5vw,  2.625rem)
--font-size-5xl  clamp(2.75rem,  2.2rem  + 2vw,    3.5rem)

--line-height-tight/snug/normal/relaxed/loose: 1.15 / 1.3 / 1.5 / 1.65 / 1.8
--font-weight-normal/medium/semibold/bold/extrabold: 400/500/600/700/800
```

Fluid, via `clamp()`, from `--font-size-xs` to `--font-size-5xl`. This was
deliberately **not** replaced with a fixed modular scale: fluid sizing serves the
mobile-first requirement better, and the two approaches solve different problems.
`--font-size-5xl` is additionally re-declared inside a `min-width: 1440px` media
query — a genuine responsive override, recorded in the cascade map.

## Scale drift audit (measured, same discipline as spacing's DDR-006)

Grepped every literal (non-`var()`) `font-size:`, `font-weight:`, and
`line-height:` declaration across `src/**/*.astro`:

| Property | Literal occurrences | Distinct values | Verdict |
|---|---|---|---|
| `font-size` | 109 | ~28 (0.6rem–4.5rem, near-continuous) | Real drift, **not** fixed — see below |
| `font-weight` | 143 | 5 (300, 500, 600, 700, 800) | **Fixed** — see below |
| `line-height` | 63 | ~25 (1.0–1.8, near-continuous) | Real drift, **not** fixed — see below |

**Why font-size/line-height are reported, not rewritten.** Unlike the card-radius
drift (DDR-006's shape finding — three values for ONE visual role), the
font-size/line-height spread is mostly fine-grained, page-specific tuning
(`.7rem` vs `.72rem` vs `.73rem` for genuinely different adjacent labels), not one
role rendered inconsistently. Collapsing 28 values into 9 buckets would be a real,
unrequested visual change to dozens of components for a cosmetic consistency win,
with no legibility defect driving it. This confirms the "do not replace fluid
sizing" recommendation above with an actual measurement instead of an assumption.

**Font-weight was a real, fixable gap.** `800` had 10 genuine literal uses —
extra-bold display numbers/headings across `ContactInfo`, `Hero`, `TrustSignals`,
`ClinicStory`, `ValuesList`, `ChatWidget`, `BeforeAfter`, `insurance.astro`,
`appointments.astro`, `offline.astro` — with no corresponding token, the same
shape of gap `--spacing-scale-*` closed for spacing. Added
`--font-weight-extrabold: 800` and migrated all 10 uses to it (pure value
substitution, zero visual change). The single `font-weight: 300` use
(`Hero.astro`'s `.hero-sub`) was left alone — one occurrence isn't a pattern yet.

## Rules

1. Any family named in a `--font-family-*` token **must** have a matching
   `@font-face`. Enforced by `npm run lint:design` (`font-family-has-face`),
   which exists specifically because its absence caused this defect.
2. Never name a font the repo does not ship.
3. Placeholder text uses `--color-text-muted` at **full opacity** — see
   `accessibility` notes; applying opacity to it caused two AA failures.
4. A literal `font-weight` value with real, repeated use across components and
   no matching token is a missing token, not a one-off — see the drift audit
   above. A single occurrence is not yet a pattern worth tokenising.

## Verify

```bash
npm run check && npm run build && npm test
npm run lint:design     # fails if a named family has no @font-face
grep -rn "font-weight:\s*800\|font-weight:800" src --include="*.astro"   # must be empty
```
Plus the canvas measureText probe above, if you need to re-confirm that a font is
genuinely applied rather than silently falling back.
