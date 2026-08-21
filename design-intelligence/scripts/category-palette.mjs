/**
 * category-palette.mjs — derive accessible category/accent colours.
 *
 * PROBLEM (measured, not assumed)
 * The site uses eight "category" colours (service cards, trust signals, values,
 * team badges, doctor cards). Each is used in TWO roles simultaneously:
 *   1. as a solid background with white text/icons on it
 *   2. as a text colour on its own light tint
 * All eight failed BOTH roles at WCAG AA. Worst case #FBBC05 at 1.71:1.
 *
 * METHOD
 * Same as the brand palette: convert each hue to OKLCH, hold hue and (as far as
 * gamut allows) chroma, then walk lightness DOWN until the colour clears the
 * required ratio in both roles. Hue is preserved so the categories stay visually
 * distinguishable from one another — the point is accessible, not monochrome.
 *
 * The light tint for each is derived the same way at high lightness, so tint and
 * ink are guaranteed to be a matched, tested pair rather than two hand-picked hexes.
 *
 * Run: node design-intelligence/scripts/category-palette.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { contrast } from './palette.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const srgbToLinear = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const linearToSrgb = (c) => { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
const hexToRgb = (h) => { const s = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)); };
const rgbToHex = (a) => '#' + a.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

function rgbToOklab([r, g, b]) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
          linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
          linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
function inGamut([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
    .every((v) => v >= -1e-4 && v <= 1 + 1e-4);
}

/** Render a colour at a given lightness, preserving hue, clipping chroma to gamut. */
function atLightness(seedHex, L) {
  const [, a, b] = rgbToOklab(hexToRgb(seedHex));
  const chroma = Math.hypot(a, b), hue = Math.atan2(b, a);
  let c = chroma;
  while (c > 0 && !inGamut([L, c * Math.cos(hue), c * Math.sin(hue)])) c -= 0.002;
  return rgbToHex(oklabToRgb([L, c * Math.cos(hue), c * Math.sin(hue)]));
}

const WHITE = '#FFFFFF';
/**
 * AA is 4.5:1, but a value that lands exactly on 4.50 has no margin — a later tint
 * tweak silently breaks it. Same headroom principle as CTA_TARGET in palette.mjs.
 */
const AA = 4.6;

/** The eight in-use category colours, with the semantic name each carries. */
const CATEGORIES = {
  cyan:   { seed: '#2CABDF', role: 'brand / implants / general' },
  teal:   { seed: '#3DBAA7', role: 'secondary / preventive' },
  green:  { seed: '#10B981', role: 'success / emergency-specialist' },
  amber:  { seed: '#F59E0B', role: 'cosmetic' },
  red:    { seed: '#EF4444', role: 'emergency' },
  purple: { seed: '#8B5CF6', role: 'patient-centred' },
  blue:   { seed: '#3B82F6', role: 'restorative' },
  gold:   { seed: '#FBBC05', role: 'ratings / stars' },
};

const out = { generatedAt: new Date().toISOString(), method: 'OKLCH lightness search at constant hue; roles assigned by measured WCAG contrast.', categories: {} };

console.log('name    seed      ink       white-on-ink  tint      ink-on-tint  (both need >=4.5)');
for (const [name, { seed, role }] of Object.entries(CATEGORIES)) {
  // Matched light tint first — the ink has to work against it, so it is a constraint.
  const tint = atLightness(seed, 0.96);
  // Walk lightness down until the colour clears AA in BOTH roles simultaneously:
  // white text ON it, and it as text ON its own tint. Satisfying only the first
  // (the lighter solution) leaves the second failing at ~4.0.
  let ink = null;
  for (let L = 0.70; L >= 0.15; L -= 0.005) {
    const hex = atLightness(seed, L);
    if (contrast(hex, WHITE) >= AA && contrast(hex, tint) >= AA) { ink = hex; break; }
  }
  const wOnInk = contrast(ink, WHITE);
  const inkOnTint = contrast(ink, tint);
  const pass = wOnInk >= AA && inkOnTint >= AA;
  out.categories[name] = { role, seed, ink, tint, contrast: { whiteOnInk: wOnInk, inkOnTint }, pass };
  console.log(
    name.padEnd(7), seed, ' ', ink, '  ', String(wOnInk.toFixed(2)).padStart(5), '      ',
    tint, ' ', String(inkOnTint.toFixed(2)).padStart(5), '     ', pass ? 'PASS' : 'FAIL'
  );
}

const failures = Object.entries(out.categories).filter(([, v]) => !v.pass);
writeFileSync(resolve(REPO_ROOT, 'design-intelligence/reports/category-palette.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`\nwrote reports/category-palette.json`);
if (failures.length) { console.error(`${failures.length} category colour(s) could not reach AA in both roles:`, failures.map(([k]) => k)); process.exit(1); }
console.log('all categories pass both roles at AA');
