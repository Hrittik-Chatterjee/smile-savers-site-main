/**
 * design-lint.mjs — systemic design-system gates.
 *
 * Rationale: the defects this project has actually hit were all the same shape —
 * a value hardcoded in a component that silently went stale when the system
 * changed underneath it (ten rgba() glows frozen at the old accent; three card
 * radii for one visual role; icon chips failing non-text contrast). Reviewing
 * for those by eye does not scale. These are grep-shaped rules that do.
 *
 * Each rule reports violations but is individually severity-tagged, because not
 * all of them can be driven to zero today without churning working code.
 *
 * Run:  node design-intelligence/scripts/design-lint.mjs
 *       node design-intelligence/scripts/design-lint.mjs --strict   (fail on WARN too)
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const rel = (p) => relative(REPO_ROOT, p);

const files = globSync('src/**/*.astro', { cwd: REPO_ROOT }).map((f) => resolve(REPO_ROOT, f));
const globalCss = resolve(REPO_ROOT, 'src/styles/global.css');

/** Strip comments so documenting a bad value doesn't trip the rule against it. */
function stripComments(s) {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // CSS + JS block comments
    .replace(/<!--[\s\S]*?-->/g, ' ')     // HTML comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // JS line comments (not URLs)
}

/** Extract only <style> content from .astro; whole file for .css. Comments removed. */
function styleBlocks(path) {
  const src = readFileSync(path, 'utf8');
  if (!path.endsWith('.astro')) return [stripComments(src)];
  return [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => stripComments(m[1]));
}

/** Line number of an offset within a file. */
function lineAt(path, needle) {
  const src = readFileSync(path, 'utf8');
  const i = src.indexOf(needle);
  return i < 0 ? 0 : src.slice(0, i).split('\n').length;
}

const results = [];
const record = (rule, severity, file, line, detail) =>
  results.push({ rule, severity, file: rel(file), line, detail });

/* ── Rule 1: no hardcoded brand hex in components ───────────────────
   The accent moved twice this session. Any component holding a literal
   brand hex silently keeps the old one. */
const BRAND_HEXES = {
  '#2CABDF': 'old accent (pre-AA fix)',
  '#1D6F91': 'superseded accent',
  '#185E7B': 'superseded accent-dark',
  '#1A95C9': 'old accent-dark',
  '#016785': 'current accent — use var(--color-accent)',
  '#02526A': 'current accent-dark — use var(--color-accent-dark)',
  '#02AEDD': 'brand surface — use var(--color-brand-surface)',
};
for (const f of files) {
  const src = stripComments(readFileSync(f, 'utf8'));
  for (const [hex, why] of Object.entries(BRAND_HEXES)) {
    if (new RegExp(hex, 'i').test(src)) {
      record('no-hardcoded-brand-hex', 'ERROR', f, lineAt(f, hex), `${hex} — ${why}`);
    }
  }
}

/* ── Rule 2: no literal rgba() of a brand colour ─────────────────────
   Composable channels exist (--color-accent-rgb) precisely so glows
   track the token. */
for (const f of files) {
  for (const block of styleBlocks(f)) {
    for (const m of block.matchAll(/rgba\(\s*44\s*,\s*171\s*,\s*223/g)) {
      record('no-stale-accent-rgba', 'ERROR', f, lineAt(f, m[0]), `${m[0]}...) is the OLD accent`);
    }
  }
}

/* ── Rule 3: spacing must sit on the measured scale ──────────────────
   WARN, not ERROR: 85.9% of existing values already comply, and the
   remaining 13.5% predate the scale being named. New code should
   comply; existing code is not worth churning. */
const SCALE = new Set([0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.75, 2, 2.5, 3]);
const SPACING_PROPS = /\b(padding|margin|gap|row-gap|column-gap)(?:-(?:block|inline|top|right|bottom|left))?\s*:\s*([^;{}]+)/g;
for (const f of files) {
  for (const block of styleBlocks(f)) {
    for (const m of block.matchAll(SPACING_PROPS)) {
      const val = m[2];
      if (/var\(|clamp\(|calc\(|auto|%|px|vh|vw/.test(val)) continue;
      for (const num of val.matchAll(/(\d*\.?\d+)rem/g)) {
        const v = parseFloat(num[1]);
        if (v === 0 || v >= 4) continue; // 0 and large layout offsets are out of scope
        if (!SCALE.has(v)) {
          record('spacing-off-scale', 'WARN', f, lineAt(f, m[0].slice(0, 40)), `${v}rem in "${m[1]}" is off the measured scale`);
        }
      }
    }
  }
}

/* ── Rule 4: card radius must use the shape token ────────────────────*/
for (const f of files) {
  for (const block of styleBlocks(f)) {
    for (const m of block.matchAll(/border-radius\s*:\s*(1\.(?:125|25|375))rem/g)) {
      record('card-radius-token', 'WARN', f, lineAt(f, m[0]), `${m[1]}rem — use var(--radius-card) for card surfaces`);
    }
  }
}

/* ── Rule 5: @font-face must exist for every self-hosted family ──────
   This is the exact defect that made the site render in system fonts
   for its entire life. Never again silently. */
const gcss = readFileSync(globalCss, 'utf8');
const faces = [...gcss.matchAll(/@font-face\s*{[^}]*font-family:\s*["']([^"']+)["']/g)].map((m) => m[1]);
for (const m of gcss.matchAll(/--font-family-(sans|heading):\s*["']([^"']+)["']/g)) {
  if (!faces.includes(m[2])) {
    record('font-family-has-face', 'ERROR', globalCss, lineAt(globalCss, m[0]),
      `--font-family-${m[1]} names "${m[2]}" but no @font-face declares it — it will silently fall back`);
  }
}

/* ── report ─────────────────────────────────────────────────────────*/
const errors = results.filter((r) => r.severity === 'ERROR');
const warns = results.filter((r) => r.severity === 'WARN');
const byRule = {};
for (const r of results) (byRule[r.rule] ??= []).push(r);

for (const [rule, rs] of Object.entries(byRule)) {
  const sev = rs[0].severity;
  console.log(`\n${sev === 'ERROR' ? 'ERROR' : 'warn '}  ${rule}  (${rs.length})`);
  for (const r of rs.slice(0, 12)) console.log(`        ${r.file}:${r.line}  ${r.detail}`);
  if (rs.length > 12) console.log(`        ... and ${rs.length - 12} more`);
}

console.log(`\n${errors.length} error(s), ${warns.length} warning(s)`);
if (errors.length) { console.error('design-lint FAILED'); process.exit(1); }
if (warns.length && process.argv.includes('--strict')) { console.error('design-lint FAILED (--strict)'); process.exit(1); }
console.log('design-lint passed');
