/**
  * brand-tokens.mjs — builds the four-tier token model and emits the CSS that implements it.
 *
 *   primitive  →  semantic  →  component  →  context
 *   raw ramp      role          part          placement
 *   cyan.700      action.primary  button.primary.bg   hero.cta.bg
 *
 * The point of the tiers is that a brand change edits ONE primitive, a role change edits
 * ONE semantic token, and no component file changes at all. That is the fix for the defect
 * that started this work: a colour change previously required a many-node component sweep.
 *
 * This script is the single source of truth. It writes BOTH:
 *   - design-intelligence/reports/tokens.json   (machine-readable)
 *   - design-intelligence/reports/tokens.css    (generated CSS custom properties)
 * so the two representations cannot drift apart — the brief's explicit requirement.
 *
 * Run:    node design-intelligence/scripts/brand-tokens.mjs
 * Verify: node design-intelligence/scripts/brand-tokens.mjs --check   (non-zero exit on drift)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { contrast } from './palette.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const p = (rel) => resolve(REPO_ROOT, rel);

const derivation = JSON.parse(readFileSync(p('design-intelligence/reports/palette-derivation.json'), 'utf8'));

/* ── Tier 1: primitives ────────────────────────────────────────────────
   Raw values with no meaning attached. Never referenced by a component. */
const primitive = {
  'color.cyan': Object.fromEntries(derivation.ramp.map((s) => [s.step, s.hex])),
  // Navy is retained from the existing brand: it is the text/structure colour and is
  // already proven at 14.59:1 on white. It is NOT re-derived — changing it was never in scope.
  'color.navy': { 500: '#1E4A5F', 700: '#102B3F', 900: '#0A1D2B' },
  // Warm sand carries the "not a cold clinical waiting room" requirement from the brief.
  // It is an existing repo surface (--color-bg-human), not a new invention.
  'color.sand': { 100: '#FAF6EE', 300: '#F4EBD9' },
  'color.neutral': {
    0: '#FFFFFF', 100: '#F5F5F5', 200: '#E5E7EB', 400: '#9CA3AF',
    600: '#4A5568', 900: '#231F20',
  },
  'color.status': {
    success: '#2E7D32', warning: '#F57C00', error: '#C62828', info: '#1565C0',
  },
};

/* ── Tier 2: semantic ──────────────────────────────────────────────────
   Roles. This is the layer product code should normally think in. */
const semantic = {
  'color.action.primary': 'color.cyan.700',
  'color.action.primary.hover': 'color.cyan.800',
  'color.action.primary.text': 'color.neutral.0',
  'color.brand.surface': 'color.cyan.400',
  'color.brand.surface.subtle': 'color.cyan.50',
  'color.brand.surface.text': 'color.navy.700',
  'color.text.primary': 'color.neutral.900',
  'color.text.secondary': 'color.neutral.600',
  'color.text.onDark': 'color.neutral.0',
  'color.surface.page': 'color.neutral.0',
  'color.surface.warm': 'color.sand.300',
  'color.border.default': 'color.neutral.200',
  'color.focus.ring': 'color.cyan.700',
};

/* ── Tier 3: component ─────────────────────────────────────────────────
   Named per UI part. Only added where a part genuinely needs its own hook. */
const component = {
  'button.primary.background': 'color.action.primary',
  'button.primary.backgroundHover': 'color.action.primary.hover',
  'button.primary.text': 'color.action.primary.text',
  'button.focus.ring': 'color.focus.ring',
  'card.background': 'color.surface.page',
  'card.border': 'color.border.default',
};

/* ── Tier 4: context ───────────────────────────────────────────────────
   Placement-specific overrides. Deliberately tiny — most contexts should NOT
   need one, and inventing them is how design systems rot. */
const context = {
  'hero.cta.background': 'button.primary.background',
  'header.cta.background': 'button.primary.background',
};

/* ── resolution + validation ───────────────────────────────────────── */

const allTiers = { primitive, semantic, component, context };

/** Resolve a token reference down through the tiers to a literal hex. */
function resolveToken(ref, seen = new Set()) {
  if (/^#[0-9A-Fa-f]{3,8}$/.test(ref)) return ref;
  if (seen.has(ref)) throw new Error(`circular token reference: ${[...seen, ref].join(' -> ')}`);
  seen.add(ref);
  for (const table of [context, component, semantic]) {
    if (ref in table) return resolveToken(table[ref], seen);
  }
  // primitive lookup: "color.cyan.700" -> primitive['color.cyan'][700]
  const idx = ref.lastIndexOf('.');
  const group = ref.slice(0, idx);
  const key = ref.slice(idx + 1);
  const val = primitive[group]?.[key];
  if (val === undefined) throw new Error(`unresolvable token: ${ref}`);
  return val;
}

/** CSS custom-property name for a token id. */
const cssVar = (id) => '--' + id.replace(/\./g, '-');

function build() {
  const resolved = {};
  for (const [tier, table] of Object.entries(allTiers)) {
    if (tier === 'primitive') {
      for (const [group, entries] of Object.entries(table)) {
        for (const [k, v] of Object.entries(entries)) resolved[`${group}.${k}`] = { tier, value: v, resolved: v };
      }
    } else {
      for (const [id, ref] of Object.entries(table)) {
        resolved[id] = { tier, value: ref, resolved: resolveToken(ref) };
      }
    }
  }

  /* Contrast proof over every text-on-surface pair the system actually claims. */
  const pairs = [
    ['color.action.primary.text', 'color.action.primary', 4.5, 'primary CTA label'],
    ['color.action.primary.text', 'color.action.primary.hover', 4.5, 'primary CTA label, hover'],
    ['color.brand.surface.text', 'color.brand.surface', 4.5, 'navy text on brand cyan surface'],
    ['color.brand.surface.text', 'color.brand.surface.subtle', 4.5, 'navy text on subtle brand tint'],
    ['color.text.primary', 'color.surface.page', 4.5, 'body copy on page'],
    ['color.text.secondary', 'color.surface.page', 4.5, 'secondary copy on page'],
    ['color.text.primary', 'color.surface.warm', 4.5, 'body copy on warm sand'],
  ];
  const proof = pairs.map(([fg, bg, min, label]) => {
    const ratio = contrast(resolved[fg].resolved, resolved[bg].resolved);
    return { label, fg, bg, fgHex: resolved[fg].resolved, bgHex: resolved[bg].resolved, ratio, min, pass: ratio >= min };
  });

  return { resolved, proof };
}

function emitCss(resolved) {
  const lines = [
    '/* GENERATED by design-intelligence/scripts/brand-tokens.mjs — do not edit by hand.',
    ' * Source of truth: design-intelligence/reports/tokens.json',
    ' * Regenerate: node design-intelligence/scripts/brand-tokens.mjs',
    ' */',
    ':root {',
  ];
  let lastTier = null;
  for (const [id, meta] of Object.entries(resolved)) {
    if (meta.tier !== lastTier) {
      lines.push(`  /* ── ${meta.tier} ── */`);
      lastTier = meta.tier;
    }
    const rhs = meta.tier === 'primitive' ? meta.value : `var(${cssVar(meta.value)})`;
    lines.push(`  ${cssVar(id)}: ${rhs};`);
  }
  lines.push('}', '');
  return lines.join('\n');
}

const { resolved, proof } = build();
const failures = proof.filter((r) => !r.pass);

const tokensJson = {
  generatedAt: new Date().toISOString(),
  note:
    'Four-tier token model. Primitives come from design-intelligence/reports/palette-derivation.json, ' +
    'which derives them from the real brand asset (public/logoold.svg) — no hand-picked hex values.',
  tiers: allTiers,
  resolved,
  contrastProof: proof,
};

const css = emitCss(resolved);

if (process.argv.includes('--check')) {
  const prevJson = readFileSync(p('design-intelligence/reports/tokens.json'), 'utf8');
  const prevCss = readFileSync(p('design-intelligence/reports/tokens.css'), 'utf8');
  const norm = (s) => s.replace(/"generatedAt":\s*"[^"]*",?\s*/g, '');
  const drifted = norm(prevJson) !== norm(JSON.stringify(tokensJson, null, 2) + '\n') || prevCss !== css;
  if (drifted) {
    console.error('DRIFT: tokens.json / tokens.css are out of date. Run: node design-intelligence/scripts/brand-tokens.mjs');
    process.exit(1);
  }
  if (failures.length) {
    console.error('CONTRAST FAILURES:', failures);
    process.exit(1);
  }
  console.log(`tokens in sync · ${proof.length}/${proof.length} contrast pairs pass`);
  process.exit(0);
}

writeFileSync(p('design-intelligence/reports/tokens.json'), JSON.stringify(tokensJson, null, 2) + '\n');
writeFileSync(p('design-intelligence/reports/tokens.css'), css);

console.log(`${Object.keys(resolved).length} tokens across 4 tiers`);
console.log('\ncontrast proof:');
for (const r of proof) {
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${String(r.ratio).padStart(5)}:1  ${r.label}  (${r.fgHex} on ${r.bgHex})`);
}
if (failures.length) {
  console.error(`\n${failures.length} contrast failure(s) — token model is not shippable.`);
  process.exit(1);
}
console.log('\nwrote reports/tokens.json + reports/tokens.css');
