# Colour — how the Smile Savers palette was derived

This is the method, the evidence, and the rules. Every hex value in the system is produced by
`design-intelligence/scripts/palette.mjs` from the real brand asset. None were chosen by eye.

## 1. The brand's actual colours

The repo contains three logo files. Only one is a genuine vector master:

| File | Size | What it is |
|---|---|---|
| `public/logoold.svg` | 4KB | **The original Illustrator export.** Live `<text>`, clean paths. The real master. |
| `public/logo.svg` | 568KB | A 1078-path **auto-trace** of the above, with no `viewBox`. Currently shipped in the header. |
| `public/logosq.svg` | 932KB | Square variant with an **embedded base64 raster**. Referenced nowhere. |

Colours extracted from the vector master:

| Hex | Role in the logo |
|---|---|
| `#11bcee` | Bright cyan — the wordmark |
| `#0a83bb` | Deep cyan-blue — the "DENTAL" subtext |

**There is no gold or yellow in any Smile Savers brand asset.** This matters because the design
brief asked for gold to be the primary brand colour. The evidence does not support that, and
`--color-gold: #D4A574` had already been sitting in `global.css` with zero consumers. Gold also
cannot carry white text (2.23:1). The brief's actual underlying goal — *don't look like a cold
clinical waiting room* — is met instead by the warm sand surface (`#F4EBD9`, 13.76:1 with body
copy), which is a real existing repo surface rather than an invented brand colour.

> If gold is a genuine brand decision made outside this repo, this is the one thing to overrule —
> everything else in the system follows from the measurement.

## 2. Why OKLCH, not HSL

A tonal ramp built in HSL is unreliable: two HSL colours with the same `L` can look wildly
different in brightness depending on hue (HSL yellow at 50% lightness is far brighter than HSL blue
at 50%). OKLCH is *perceptually uniform* — equal `L` reads as equal lightness regardless of hue.
That is what makes the ramp's contrast behaviour predictable instead of something you discover by
trial and error.

Method, implemented in `palette.mjs`:

1. Convert the brand cyan `#11bcee` to OKLCH → `L=0.741 C=0.140 H=226°`.
2. Walk `L` down ten fixed steps, **holding hue constant**.
3. Reduce chroma at each step only as far as the sRGB gamut actually requires — so the ramp stays
   as vivid as the display allows rather than being desaturated defensively.
4. Measure WCAG contrast of every step against white and against brand navy.
5. Assign roles **from the measurement**.

## 3. The ramp

| Step | Hex | vs white | vs navy | Verdict |
|---|---|---|---|---|
| 50 | `#E9F8FE` | 1.09 | 13.42 | navy text |
| 100 | `#CAEFFF` | 1.21 | 12.02 | navy text |
| 200 | `#8FDEFE` | 1.49 | 9.76 | navy text |
| 300 | `#2EC9FB` | 1.93 | 7.55 | navy text |
| 400 | `#02AEDD` | 2.59 | 5.63 | navy text — **brand surface** |
| 500 | `#0694BC` | 3.52 | 4.15 | ✗ **fails both** |
| 600 | `#077DA0` | 4.72 | 3.09 | passes AA, but thin margin — not used for CTAs |
| 700 | `#016785` | 6.40 | 2.28 | white text — **primary CTA** |
| 800 | `#02526A` | 8.69 | 1.68 | white text — **CTA hover** |
| 900 | `#033E51` | 11.59 | 1.26 | white text |

## 4. The central finding

**The brand's bright cyan is a surface colour, not a white-text button colour.**

The vivid, recognisable logo cyan lives at steps 300–400. Those steps cannot carry white text — but
they carry *navy* text comfortably (5.6–7.6:1). Meanwhile the steps that can carry white text
(700+) read as a deep teal-blue that no longer looks like the logo.

So the system uses both, for different jobs:

- **Brand surfaces / fills / badges** → cyan 300–400 with **navy** text. This is where brand
  identity actually lives.
- **Primary CTAs** → cyan 700 with **white** text.
- **Steps 500–600** → never for text-bearing surfaces. 500 fails both; 600 clears AA by only
  0.22, and a CTA sitting that close to the line is exactly how this site's original contrast bug
  happened.

## 5. Rules

1. Primary actions must clear **5.0:1**, not merely AA's 4.5:1. The extra headroom exists so a
   later hover tint or overlay can't silently push it under. Enforced by `CTA_TARGET` in
   `palette.mjs`.
2. Never put white text on cyan 500 or below. Never put navy text on cyan 600 or above.
3. New colour work edits a **primitive or a semantic token**, never a component file. If you find
   yourself typing a hex value into a `.astro` file, the system has a missing token.
4. Every text-on-surface pair the system claims is contrast-proven in
   `design-intelligence/reports/tokens.json` and gated by
   `node design-intelligence/scripts/brand-tokens.mjs --check`.

## 6. Verify

```bash
node design-intelligence/scripts/palette.mjs        # re-derive from the brand asset
node design-intelligence/scripts/brand-tokens.mjs         # rebuild tokens.json + tokens.css
node design-intelligence/scripts/brand-tokens.mjs --check # fails on drift OR on any contrast regression
```

Both gates were proven non-vacuous when built: corrupting `tokens.css` makes `--check` exit 1, and
re-pointing `color.action.primary` at a ramp step that fails white text makes the contrast proof
exit 1. A gate that has never been seen to fail is not a gate.
