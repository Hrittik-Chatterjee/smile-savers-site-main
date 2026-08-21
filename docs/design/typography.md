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

## Scale

Fluid, via `clamp()`, from `--font-size-xs` to `--font-size-5xl`. This was
deliberately **not** replaced with a fixed modular scale: fluid sizing serves the
mobile-first requirement better, and the two approaches solve different problems.
`--font-size-5xl` is additionally re-declared inside a `min-width: 1440px` media
query — a genuine responsive override, recorded in the cascade map.

## Rules

1. Any family named in a `--font-family-*` token **must** have a matching
   `@font-face`. Enforced by `npm run lint:design` (`font-family-has-face`),
   which exists specifically because its absence caused this defect.
2. Never name a font the repo does not ship.
3. Placeholder text uses `--color-text-muted` at **full opacity** — see
   `accessibility` notes; applying opacity to it caused two AA failures.

## Verify

```bash
npm run lint:design     # fails if a named family has no @font-face
```
Plus the canvas measureText probe above, if you need to re-confirm that a font is
genuinely applied rather than silently falling back.
