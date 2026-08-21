/**
 * palette.mjs — derives the Smile Savers colour system from the real brand asset.
 *
 * Method (luminance-first, perceptually uniform):
 *   1. Read the canonical brand colours out of public/logoold.svg — the original
 *      Illustrator export, which is the only brand asset that is a genuine vector
 *      master rather than an auto-trace. Nothing here is hand-picked.
 *   2. Convert the brand cyan to OKLCH. OKLCH is perceptually uniform: two colours
 *      with the same L look equally light regardless of hue, which HSL does NOT give
 *      you. That property is what makes a tonal ramp predictable.
 *   3. Walk L down a fixed set of steps holding HUE constant, reducing chroma only as
 *      far as needed to stay inside the sRGB gamut.
 *   4. Contrast-test every step against white and against brand navy, and assign
 *      roles from the measurement — never from taste.
 *
 * Run: node design-intelligence/scripts/palette.mjs
 * Emits: design-intelligence/reports/palette-derivation.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/* ── colour space plumbing ─────────────────────────────────────────── */

const srgbToLinear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (c) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};
const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

function rgbToOklab([r, g, b]) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** True sRGB-gamut test: round-trip through unclamped linear light. */
function inGamut([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

const relLuminance = ([r, g, b]) =>
  0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);

/** WCAG 2.x contrast ratio. */
export function contrast(hexA, hexB) {
  const a = relLuminance(hexToRgb(hexA));
  const b = relLuminance(hexToRgb(hexB));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/* ── step 1: read the real brand asset ─────────────────────────────── */

function extractBrandColours() {
  const svg = readFileSync(resolve(REPO_ROOT, 'public/logoold.svg'), 'utf8');
  const hits = [...svg.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase());
  const counts = new Map();
  for (const h of hits) counts.set(h, (counts.get(h) ?? 0) + 1);
  // Drop pure white/black — they are not brand hues.
  const brand = [...counts.keys()].filter((h) => !['#ffffff', '#000000'].includes(h));
  const withChroma = brand.map((h) => {
    const [, a, b] = rgbToOklab(hexToRgb(h));
    return { hex: h, chroma: Math.hypot(a, b), lightness: rgbToOklab(hexToRgb(h))[0] };
  });
  // The brand mark is the most chromatic colour; the support is the next, darker one.
  withChroma.sort((x, y) => y.chroma - x.chroma);
  const primary = withChroma[0];
  const support = withChroma.filter((c) => c.hex !== primary.hex).sort((x, y) => x.lightness - y.lightness)[0];
  return { primary, support, all: withChroma };
}

/* ── step 2-3: build the ramp ──────────────────────────────────────── */

const STEPS = [
  { step: 50, L: 0.97 }, { step: 100, L: 0.93 }, { step: 200, L: 0.86 },
  { step: 300, L: 0.78 }, { step: 400, L: 0.7 }, { step: 500, L: 0.62 },
  { step: 600, L: 0.55 }, { step: 700, L: 0.48 }, { step: 800, L: 0.41 },
  { step: 900, L: 0.34 },
];

function buildRamp(seedHex) {
  const [, a, b] = rgbToOklab(hexToRgb(seedHex));
  const chroma = Math.hypot(a, b);
  const hue = Math.atan2(b, a);
  return STEPS.map(({ step, L }) => {
    // Reduce chroma only as far as the gamut demands — preserves brand vividness.
    let c = chroma;
    while (c > 0 && !inGamut([L, c * Math.cos(hue), c * Math.sin(hue)])) c -= 0.002;
    const hex = rgbToHex(oklabToRgb([L, c * Math.cos(hue), c * Math.sin(hue)]));
    return { step, hex, oklch: { L: +L.toFixed(3), C: +c.toFixed(4), H: +((hue * 180) / Math.PI).toFixed(1) } };
  });
}

/* ── step 4: assign roles from measurement ─────────────────────────── */

const AA_NORMAL = 4.5;
/**
 * Headroom target for the primary CTA specifically.
 * AA is 4.5:1, but a CTA sitting at 4.5x barely clears and any later nudge (a hover
 * tint, an overlay, a theme tweak) silently breaks it — which is exactly the failure
 * this project already had to fix once. Primary actions must clear 5.0:1 so there is
 * real margin. Non-CTA roles are held to the plain AA threshold.
 */
const CTA_TARGET = 5.0;
const WHITE = '#FFFFFF';
const NAVY = '#102B3F'; // existing brand navy, retained as text/structure colour

function main() {
  const { primary, support, all } = extractBrandColours();
  const ramp = buildRamp(primary.hex).map((s) => {
    const vsWhite = contrast(s.hex, WHITE);
    const vsNavy = contrast(s.hex, NAVY);
    return {
      ...s,
      contrast: { vsWhite, vsNavy },
      carriesWhiteText: vsWhite >= AA_NORMAL,
      carriesNavyText: vsNavy >= AA_NORMAL,
    };
  });

  // The load-bearing selections, chosen by measurement.
  const ctaStep = ramp.find((s) => s.contrast.vsWhite >= CTA_TARGET);
  const ctaHover = ramp.filter((s) => s.contrast.vsWhite >= CTA_TARGET)[1] ?? ctaStep;
  const ctaRejected = ramp.filter((s) => s.carriesWhiteText && s.contrast.vsWhite < CTA_TARGET);
  const surfaceStep = [...ramp].reverse().find((s) => s.carriesNavyText && s.step <= 400);
  const deadZone = ramp.filter((s) => !s.carriesWhiteText && !s.carriesNavyText);

  const out = {
    generatedAt: new Date().toISOString(),
    method:
      'Luminance-first OKLCH ramp derived from the canonical brand asset. Hue held constant; ' +
      'chroma reduced only as far as the sRGB gamut requires. Roles assigned from measured WCAG ' +
      'contrast, not from preference.',
    source: {
      file: 'public/logoold.svg',
      why: 'The original Illustrator vector export — the only brand asset that is a true vector master. ' +
        'public/logo.svg is a 568KB auto-trace of it and public/logosq.svg embeds a raster.',
      brandColours: all.map((c) => ({ hex: c.hex, chroma: +c.chroma.toFixed(4) })),
      primary: primary.hex,
      support: support?.hex ?? null,
      goldPresent: all.some((c) => {
        const [r, g, b] = hexToRgb(c.hex);
        return r > 180 && g > 130 && b < 120;
      }),
    },
    ramp,
    selections: {
      ctaBackground: {
        ...ctaStep,
        rationale: `Lightest ramp step clearing the ${CTA_TARGET}:1 CTA headroom target with white text.`,
      },
      ctaHover: { ...ctaHover, rationale: 'Next step down — darker on hover, still AA with white text.' },
      ctaRejectedForThinMargin: {
        steps: ctaRejected.map((s) => ({ step: s.step, hex: s.hex, vsWhite: s.contrast.vsWhite })),
        rationale:
          `Technically pass AA (>=${AA_NORMAL}) but sit below the ${CTA_TARGET}:1 headroom target, so they ` +
          'are not used for the primary action. Documented rather than silently skipped.',
      },
      brandSurface: {
        ...surfaceStep,
        rationale:
          'Brightest, most brand-recognisable step that safely carries NAVY text. This is the key ' +
          'finding: the logo cyan is a surface colour, not a white-text button colour.',
      },
      deadZone: {
        steps: deadZone.map((s) => s.step),
        rationale: 'Mid-ramp steps fail BOTH white and navy text at AA. Never use for text-bearing surfaces.',
      },
      textOnBrandSurface: NAVY,
    },
  };

  const dest = resolve(REPO_ROOT, 'design-intelligence/reports/palette-derivation.json');
  writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
  console.log(`brand primary : ${primary.hex}  (most chromatic colour in the vector master)`);
  console.log(`brand support : ${support?.hex}`);
  console.log(`gold present  : ${out.source.goldPresent}`);
  console.log(`\nramp:`);
  for (const s of ramp) {
    const role = s.carriesWhiteText ? 'white-text OK' : s.carriesNavyText ? 'navy-text OK' : '— fails both —';
    console.log(`  ${String(s.step).padStart(3)}  ${s.hex}  white ${String(s.contrast.vsWhite).padStart(5)}  navy ${String(s.contrast.vsNavy).padStart(5)}  ${role}`);
  }
  console.log(`\nCTA bg ${out.selections.ctaBackground.hex} · hover ${out.selections.ctaHover.hex} · brand surface ${out.selections.brandSurface.hex}`);
  console.log(`wrote ${dest}`);
}

// Only run the derivation when invoked directly — this module also exports `contrast`
// for tokens.mjs, and importing it must not rewrite the report as a side effect.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
