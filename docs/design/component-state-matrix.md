# Component state matrix

Measured from source, not designed on paper. Every cell reflects what the code
actually does today. Gaps are marked as gaps rather than quietly filled in.

**Baseline that applies to everything:** `global.css` defines a universal
`:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px }`
that every element inherits. Components listed as having "no focus rule of their
own" still receive this — they are not unfocusable. Components with their own rule
are overriding the baseline for contextual reasons.

Legend: **✓** implemented · **inherit** covered by the global baseline ·
**—** not applicable · **GAP** should exist and does not

---

## Button (`src/components/ui/Button.astro`)

The canonical button. Variants: `primary`, `secondary`, `outline`.

| State | Treatment | Contrast | Notes |
|---|---|---|---|
| default | `--color-accent` bg, white text | 6.40:1 | primary variant |
| hover | `--color-accent-dark`, `translateY(-1px)`, deeper shadow | 8.69:1 | ✓ |
| focus-visible | `2.5px solid var(--focus-ring)`, offset 3px | 6.40:1 vs white | ✓ own rule |
| active | `translateY(0)`, reduced shadow | — | ✓ |
| disabled | `opacity: var(--opacity-disabled)` (.45), `pointer-events: none` | see note | ✓ |
| loading | — | — | **GAP** — no loading state exists |
| error / success | — | — | — not a button concern here |

> **Known limitation:** disabled is opacity-based. At .45 the label drops below
> AA. WCAG 1.4.3 exempts disabled controls, so this is conformant, but it is a
> deliberate trade recorded here rather than an oversight.

## Header CTA (`src/components/layout/Header.astro` `.hdr-cta`)

| State | Treatment | Notes |
|---|---|---|
| default | `--color-interactive-primary`, white text | ✓ |
| hover | `--color-interactive-primary-hover`, lift, deeper glow | ✓ |
| focus-visible | `2.5px solid var(--focus-ring)`, offset 3px | ✓ — **added this pass**; previously had none |
| active | — | **GAP** — no pressed state |

## Navigation (`src/components/layout/Navigation.astro`)

| State | Treatment | Notes |
|---|---|---|
| default | navy text | ✓ |
| hover | `--color-primary` bg, inverted text | ✓ |
| focus-visible | `2px solid var(--color-primary)` | ✓ — deliberately uses primary, not `--focus-ring`, to match the element's own active background |
| current page | `aria-current` + active background | ✓ |

## Contact form (`src/modules/contact/components/ContactForm.astro`)

| State | Treatment | Contrast | Notes |
|---|---|---|---|
| empty | border `--color-border`, placeholder `--color-text-muted` | 7.53:1 | ✓ — **fixed this pass**: `opacity:.6` had crushed it to 2.87:1 |
| focus | `outline:none` replaced by accent border + 3px accent ring | 6.40:1 border vs white | ✓ but see note |
| invalid | `aria-invalid` + error styling | — | ✓ |
| valid | — | — | **GAP** — no positive confirmation |
| submitting | — | — | **GAP** — no disabled/spinner state on submit |
| success / failure | — | — | **GAP** — verify against the API's real fail-closed behaviour |

> **Note on focus:** this is the one place `outline: none` is used. It is
> compensated by a visible border-colour change plus a 3px ring, so it does not
> remove the focus indicator — but it uses `:focus`, not `:focus-visible`, so the
> ring also appears on mouse click. Acceptable for form fields (a common,
> defensible convention) and recorded rather than silently changed.

## Chat widget (`src/components/common/ChatWidget.astro`)

| State | Treatment | Notes |
|---|---|---|
| default / hover / active | ✓ / ✓ / ✓ | most complete state coverage in the codebase |
| focus-visible | ✓ own rule | |
| disabled | ✓ (7 references — send button while in flight) | |
| placeholder | `--color-text-muted` | ✓ — **fixed this pass**, was `opacity:.7` = 3.58:1 |
| loading | ✓ typing indicator | |

## Booking wizard (`src/modules/appointments/components/BookingWizard.astro`)

| State | Treatment | Notes |
|---|---|---|
| step radios | `aria-label` per step | ✓ — added in an earlier pass; the inputs are `opacity:0` but remain in the a11y tree, so they need names |
| hover | ✓ (7 rules) | |
| focus | `:focus` only | **GAP** — no `:focus-visible`; relies on the global baseline |
| placeholder | `--color-text-muted`, no opacity | ✓ already correct |
| disabled | ✓ | |
| error / validation | — | **GAP** |

---

## Summary of real gaps

**Correction (2026-08-21):** this table previously listed "no submitting/
success/failure states on the contact form" and "no valid/positive state on
form fields" as gaps in `ContactForm.astro`. Direct re-inspection of the file
found both already correctly implemented: a loading spinner + disabled button
during submit (`ContactForm.astro:243-246`), a `role="status" aria-live="polite"`
result region with distinct success/error text matching
`functions/api/contact.js`'s actual fail-closed contract (`{success:false,
error}` on every failure path, never a false positive), and
`:valid`/`:invalid`-pseudo-class-driven border and icon states on every field.
Those two rows were wrong and are removed below rather than left to mislead the
next reader. This is the same discipline this project has applied to its own
other documents (see `docs/design/decisions.md` DDR entries correcting earlier
audit claims) — a table that describes code should be re-checked against the
code, not trusted because it was written with good intentions.

| Gap | Where | Severity | Status |
|---|---|---|---|
| No loading state on the canonical Button | `Button.astro` | medium — forms can double-submit | Fixed — DDR-013 |
| No inline validation states in the booking wizard (used `alert()`) | `BookingWizard.astro` | medium | Fixed — DDR-014 |
| No pressed/active state on header CTA | `Header.astro` | low | Fixed — DDR-015 |

All three were confirmed real and are now fixed; see `docs/design/decisions.md`
for the specific evidence and verification for each.
