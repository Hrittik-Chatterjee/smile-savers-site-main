# Design decision records

Each record states what was decided, the evidence, and what was rejected. Where a
decision contradicts an instruction given to this project, that conflict is stated
explicitly rather than resolved silently.

---

## DDR-001 — Cyan-led palette, not gold-led

**Status:** Accepted (open to reversal by the brand owner)

**Conflict.** A design brief specified *"golden/yellow should be the primary
distinctive brand colour."* A later instruction said to *"take decisions from
Smile Savers branding assets like logo etc."* These two point in different
directions, so the assets were treated as authoritative.

**Evidence (FACT).** Colours extracted directly from `public/logoold.svg`, the
original Illustrator vector master, by grep — two colours only:

| Hex | Role |
|---|---|
| `#11BCEE` | bright cyan, wordmark |
| `#0A83BB` | deep cyan-blue, "DENTAL" |

There is **no gold or yellow in any Smile Savers brand asset.** Separately,
`--color-gold: #D4A574` already existed in `global.css` with zero consumers, and
gold cannot carry white text (2.23:1).

**Decision.** Cyan-led, derived from the logo. The brief's underlying goal —
"don't look like a cold clinical waiting room" — is met with the warm sand
surface (`#F4EBD9`, 13.76:1 with body copy) that already existed in the repo,
rather than by inventing a brand colour the business does not own.

**If overruled:** this is the single decision that most contradicts a written
instruction. Everything else follows from measurement. A brand owner saying "gold
is real, it just isn't in the logo files" would reverse this.

---

## DDR-002 — Bright brand cyan is a surface, not a button

**Status:** Accepted

**Evidence (FACT).** The logo cyan `#11BCEE` measures 2.22:1 against white text
and 6.57:1 against brand navy. An OKLCH ramp holding its hue shows steps 500–600
fail *both* white and navy text — a dead zone.

**Decision.** Split the roles. Brand identity lives in surfaces: cyan 300–400
with navy text. CTAs use cyan 700 with white text. Never white text on cyan ≤500;
never navy text on cyan ≥600.

**Rejected.** Using the logo cyan directly for CTAs, which is what the original
`--color-accent: #2CABDF` did and why it failed at 2.63:1.

---

## DDR-003 — Primary actions must clear 5.0:1, not 4.5:1

**Status:** Accepted

**Rationale.** AA is 4.5:1, but a CTA sitting at exactly 4.5 has no margin: any
later hover tint, overlay or theme tweak silently breaks it. That is precisely how
this site's original contrast defect happened. Encoded as `CTA_TARGET` in
`palette.mjs`; ramp step 600 (`#077DA0`, 4.72:1) is documented as *rejected for
thin margin* rather than silently skipped.

The same principle later applied to category colours, where an initial solution
landed on exactly 4.50 and was tightened to a 4.6 target.

---

## DDR-004 — Category colours derived, not hand-picked

**Status:** Accepted

**Evidence (FACT).** Eight category colours are each used in two roles at once —
as a fill with white text, and as text on their own light tint. All eight failed
both roles (worst: gold at 1.71:1).

**Decision.** Derive an ink/tint pair per category in
`category-palette.mjs` by holding hue and walking OKLCH lightness until both roles
clear 4.6:1. Hue preserved so categories stay distinguishable.

**Method note.** Solving the two constraints *sequentially* (find the lightest
value passing white-on-ink, then check tint) produced values failing the second
role at ~4.0. They must be solved together.

---

## DDR-005 — Optimise the logo, do not re-trace or re-draw it

**Status:** Accepted

**Evidence (FACT).** `public/logo.svg` was 567KB, 1077 auto-traced paths, 849
distinct fills for a two-colour logo, and had no `viewBox`. The site's entire
CSS+JS is 296KB.

**Decision.** SVGO at precision 1 with `viewBox` restored → 133KB, verified
pixel-identical apart from anti-aliasing edge pixels.

**Rejected.** Quantising the 849 fills to two brand colours and dropping the 530
pale paths would have reached 95KB, but visual comparison showed thickened
letterforms and partly-filled counters in 'a'/'e'. Rejected for the sake of 38KB.

**Not done.** A true vector rebuild would reach <10KB but the master uses live
text in a licensed demo font that cannot be outlined here. Needs the real font or
a designer-supplied master.

---

## DDR-006 — Name the spacing scale, do not rewrite to it

**Status:** Accepted

**Evidence (FACT).** 631 literal rem spacing values measured across `src/`. 542
(85.9%) already sit on a coherent 2px-granular scale that had never been named.

**Decision.** Add `--spacing-scale-1..14` documenting the measured scale, and lint new
work against it. Do **not** rewrite the 542 already-correct values — they render
correctly today, so churning them is regression risk with no visual gain. The 85
off-scale uses are warnings, not errors.

---

## DDR-007 — Ship real variable fonts, accept +80KB

**Status:** Accepted

**Evidence (FACT).** No `@font-face` existed anywhere. Proven by canvas
`measureText`: both brand families measured byte-identical to a font name
guaranteed not to exist, and `document.fonts.size` was 0. Worse,
`plus-jakarta-sans-variable.woff2` was Google's 404 HTML page renamed, and
`inter-variable.woff2` was a static single-weight subset.

**Decision.** Ship genuine variable fonts (SIL OFL 1.1), subset to the Latin
ranges in use, with proper `@font-face` and `font-display: swap`. 23KB → 103KB.

**Rationale for the increase.** The previous 23KB bought nothing — neither font
was ever applied. The site now renders in its intended typeface with real weight
axes instead of synthesised bold, against 1,430KB removed in the asset pass.

---

## DDR-008 — Gate the classes of defect that actually shipped

**Status:** Accepted

Every rule in `design-lint.mjs` exists because that exact defect reached
production: stale hardcoded brand hex, stale `rgba()` glows, off-scale spacing,
untokenised card radii, and font families with no `@font-face`. Gates that have
never been observed failing are not gates, so each was verified by deliberately
breaking it and confirming a non-zero exit.

---

## DDR-009 — Unify the spacing-token prefix before it had consumers

**Status:** Accepted

**Evidence (FACT).** The spacing scale added in DDR-006 was named
`--space-1..14`, a different stem from the pre-existing
`--spacing-section/-block/-element`. Two prefixes for one token domain — caught
by re-auditing this session's own work while writing the naming-conventions
document, not by an external report.

**Decision.** Renamed to `--spacing-scale-1..14` before it acquired any
component consumers (verified zero `var(--space-*)` references existed in
`src/` at the time). Both the numeric scale and the semantic fluid tokens now
share the `--spacing-` stem, distinguished by suffix pattern (`scale-N` vs a
named role).

**Rationale for recording this as a decision, not silently fixing it.** The
document that found the drift is the same kind of audit this whole session has
been doing to the rest of the codebase. Applying it to itself, and recording the
result the same way, is the point.

---

## DDR-010 — DaisyUI was silently overriding all four status colours, not just brand colours

**Status:** Accepted

**Evidence (FACT).** `global.css` already carried a documented `!important`
brand-lock block for `--color-primary/-secondary/-accent`, with a comment
explaining DaisyUI's light theme overrides them with its own `oklch()` values.
That block never covered `--color-success/-warning/-error/-info`. Found via axe
on `/compare/implants-vs-dentures/`: a checkmark rendering at 1.95:1 instead of
the token's declared value. Direct measurement of computed styles confirmed all
four status tokens resolved to DaisyUI's oklch colours
(`oklch(76% .177 163.223)` ≈ `#00D390` for success, etc.) — the `@theme`
declarations were dead on arrival for any component using them, across all 10
real consumers site-wide.

**Compounding defect.** The original `@theme` values themselves
(`#4CAF50`/`#FFC107`/`#E53935`/`#2196F3`) also failed AA as text on white
(2.78/1.63/4.23/3.12:1) — fixing only the override would not have been enough.

**Decision.** Derived AA-clearing replacements by the same OKLCH method as the
brand and category palettes (`#1B8727`/`#956F06`/`#DD2F2E`/`#0278C9`, all ≥4.6:1
on white), and added all four to the `!important` brand-lock block alongside the
brand colours.

---

## DDR-011 — Six copy-pasted "content-type" badges, three different broken colour pairs

**Status:** Accepted

**Evidence (FACT).** The programmatic-SEO route family (`/compare/`, `/for/`,
`/learn/`, plus their layouts) each carry a near-identical `.content-type` or
`*-badge` rule, evidently copy-pasted and then hand-varied per section. All
measured contrast failures, three distinct broken pairs:

| Pairing | Contrast | Where |
|---|---|---|
| `--color-accent` bg + `#5D4037` text | 1.46:1 | compare (index + layout) |
| `--color-primary-light` bg + `--color-primary-dark` text | 1.79–1.80:1 | for, location hero badge, nearby-locations hover, persona badge |
| `--color-secondary-light` bg + `--color-secondary` text | 1.62–1.63:1 | learn (index + layout) |

**Decision.** Standardised all of them on the one pairing already proven
repeatedly this session: `--color-brand-surface-subtle` background with
`--color-primary-dark` text (15.79:1). One attempted fix used
`--color-secondary-dark` on a specific secondary tint and only reached 4.35:1 —
recorded as a near-miss rather than silently re-fixed without comment: a token
that passes against one tint is not guaranteed to pass against a different one
in the same family, so each pairing needs its own check rather than a rule of
thumb.

**Why six copies, not one shared component.** Out of scope for this pass —
consolidating them into one `Badge` component would be a real improvement but is
a structural change beyond a colour-contrast fix, and is noted as a candidate
for the "component discovery" work this session's naming-conventions document
already flagged as unstarted.

---

## DDR-013 — Button.astro gets a reusable loading state, not a per-consumer one

**Status:** Accepted

**Evidence (FACT).** `component-state-matrix.md` correctly flagged that the
canonical `Button.astro` had no loading state, only a static `disabled` prop.
`ContactForm.astro` had already solved this problem for itself by hand-rolling
an inline spinner via direct `innerHTML` swaps in its own submit handler —
correct, but not reusable, and duplicated logic any future form would have to
reinvent.

**Decision.** Added a `loading` prop to `Button.astro` plus an always-present
(CSS-hidden) spinner SVG, keyed off `[aria-busy="true"]` rather than the prop
directly. This means both (a) a page that renders the button already loading,
and (b) a consumer's own inline script that toggles `aria-busy`/`disabled` at
runtime — the exact pattern `ContactForm.astro` already uses — get the correct
spinner and non-dimmed busy styling without duplicating markup.

**Verified non-regression.** All 3 existing `<Button>` call sites render plain
text children (no nested icons relying on the old direct-child DOM structure),
confirmed by grep before wrapping slot content in `.btn-label`. Rendered check
confirmed the spinner is `display:none` by default (existing buttons
unaffected) and `display:block` when `aria-busy="true"` is set, whether via the
prop or via a script mutating the live DOM.
