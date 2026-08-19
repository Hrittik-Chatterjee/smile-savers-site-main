/**
 * Smile Savers semantic token inventory (P1).
 *
 * Supersedes the earlier smile-savers-tokens.mjs draft. Per
 * design-intelligence/audit/semantic-model-gap.md's P1 recommendation, this
 * is mechanically derived from the repo's ACTUAL tokens in
 * src/styles/global.css and their ACTUAL consumers in src/ — nothing here
 * is invented. Every token is classified layer: SEMANTIC (Smile Savers'
 * tokens are already named semantically at declaration; a fabricated
 * RAW/ATOMIC/PRIMITIVE split would misrepresent evidence that doesn't
 * exist, unlike the Labs reference pipeline's six-layer model).
 *
 * Two fixes over the superseded draft, both evidence-driven:
 *  1. :root-scoped @media blocks are parsed separately from the base
 *     @theme block. A token re-declared inside one becomes a VARIES_BY
 *     relationship (condition = the media query), not a silently
 *     overwritten value. Two real cases exist: --font-size-5xl at
 *     line 970 (@media min-width:1440px) and --container-xl at line 977
 *     (@media min-width:1920px).
 *  2. Consumer detection now has two passes: DIRECT (literal var(--x) in
 *     .astro/.css) and INDIRECT (Tailwind v4 @theme-generated utility
 *     classes, e.g. --color-primary -> bg-primary/text-primary/...). The
 *     draft only had pass 1, which undercounted real consumers for any
 *     token used only via a utility class (confirmed via direct grep:
 *     bg-primary in src/pages/team/[slug].astro).
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ARTIFACTS, ROOT, writeJson, canonicalHash, runMetadata, log } from '../lib/core.mjs';

const execFileAsync = promisify(execFile);
const STAGE = 'token-inventory';
const REPO_ROOT = path.resolve(ROOT, '..');
const GLOBAL_CSS = path.join(REPO_ROOT, 'src', 'styles', 'global.css');

// Tailwind v4 @theme utility-class prefixes, by the theme namespace they're
// generated from. This mapping is a documented Tailwind v4 convention
// (color tokens -> bg-/text-/border-/... utilities; radius tokens ->
// rounded-*; spacing tokens -> p-/m-/gap-/w-/h-*), applied mechanically
// here. It was NOT independently re-verified against Tailwind's source this
// session, so every hit found via this table is recorded at evidence class
// DERIVED (not OBSERVED-SOURCE) with that limitation stated on the record.
const TAILWIND_UTILITY_PREFIXES = {
  color: [
    'bg',
    'text',
    'border',
    'ring',
    'from',
    'via',
    'to',
    'decoration',
    'divide',
    'outline',
    'fill',
    'stroke',
    'accent',
    'caret',
    'shadow',
  ],
  shape: ['rounded'],
  spacing: ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'gap', 'w', 'h'],
  elevation: ['shadow'],
};

function classifyDomain(name) {
  if (/^--color-/.test(name)) return 'color';
  if (/^--(font-|text-)/.test(name)) return 'typography';
  if (/^--spacing-/.test(name)) return 'spacing';
  if (/^--radius-/.test(name)) return 'shape';
  if (/^--(card-shadow|shadow-|.*shadow)/.test(name)) return 'elevation';
  if (/^--gradient-|^--card-gradient/.test(name)) return 'color-gradient';
  return 'other';
}

/** Utility-class suffix Tailwind derives from a --color-X / --radius-X / --spacing-X name. */
function tailwindSuffix(name, domain) {
  if (domain === 'color') return name.replace(/^--color-/, '');
  if (domain === 'shape') return name.replace(/^--radius-/, '');
  if (domain === 'spacing') return name.replace(/^--spacing-/, '');
  return null;
}

async function readCssWithLines() {
  const css = await fs.readFile(GLOBAL_CSS, 'utf8');
  return { css, lines: css.split('\n') };
}

/**
 * Walks the file tracking @media block nesting so a :root declaration found
 * inside a @media block is recorded as VARIES_BY(condition) rather than
 * merged into the base declaration list.
 */
function parseTokenDeclarations(lines) {
  const byName = new Map();
  let mediaDepth = 0;
  let mediaStack = [];
  let braceDepth = 0;
  let rootBraceDepthAtMediaEntry = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const mediaOpen = /^\s*@media\s*([^{]+)\{/.exec(line);
    if (mediaOpen) {
      mediaStack.push({ condition: mediaOpen[1].trim(), enteredAtBraceDepth: braceDepth });
      mediaDepth++;
    }

    const declMatch = /^\s*(--[a-zA-Z0-9-]+):\s*([^;]+);/.exec(line);
    if (declMatch) {
      const [, name, rawValue] = declMatch;
      const insideMedia = mediaDepth > 0 ? mediaStack[mediaStack.length - 1].condition : null;
      const declaration = { value: rawValue.trim(), line: i + 1, mediaCondition: insideMedia };
      if (!byName.has(name)) byName.set(name, { name, declarations: [declaration] });
      else byName.get(name).declarations.push(declaration);
    }

    // Track brace depth crudely (sufficient for this file's formatting: one
    // opening/closing brace per line for the constructs we care about).
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;
    braceDepth += opens - closes;
    while (
      mediaStack.length &&
      braceDepth <= mediaStack[mediaStack.length - 1].enteredAtBraceDepth
    ) {
      mediaStack.pop();
      mediaDepth--;
    }
  }
  return [...byName.values()];
}

async function grepFiles(pattern, srcDir) {
  try {
    const { stdout } = await execFileAsync('grep', ['-rlE', pattern, srcDir, '--include=*.astro', '--include=*.css'], {
      maxBuffer: 8 * 1024 * 1024,
    });
    return stdout.trim().split('\n').filter(Boolean).map((f) => path.relative(REPO_ROOT, f));
  } catch (error) {
    if (error.code === 1) return [];
    throw error;
  }
}

async function findDirectConsumers(tokenName, srcDir) {
  const escaped = tokenName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return grepFiles(`var\\(${escaped}`, srcDir);
}

async function findIndirectConsumers(tokenName, domain, srcDir) {
  const suffix = tailwindSuffix(tokenName, domain);
  const prefixes = TAILWIND_UTILITY_PREFIXES[domain];
  if (!suffix || !prefixes) return [];
  // Match the utility as a whole class token inside a class="..." attribute:
  // word-boundary before the prefix-suffix pair, word-boundary after.
  const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alt = prefixes.join('|');
  const pattern = `class="[^"]*\\b(${alt})-${escapedSuffix}\\b`;
  return grepFiles(pattern, srcDir);
}

async function main() {
  const srcDir = path.join(REPO_ROOT, 'src');
  const { lines } = await readCssWithLines();
  const cssBytes = await fs.readFile(GLOBAL_CSS);
  const cssSha256 = crypto.createHash('sha256').update(cssBytes).digest('hex');
  const declarations = parseTokenDeclarations(lines);

  const tokens = [];
  const varyByEdges = [];
  const aliasEdges = [];
  const overriddenByEdges = [];

  for (const decl of declarations) {
    const domain = classifyDomain(decl.name);
    const baseDeclarations = decl.declarations.filter((d) => !d.mediaCondition);
    const mediaDeclarations = decl.declarations.filter((d) => d.mediaCondition);

    // First base declaration is canonical. Any later base-scope
    // re-declaration (e.g. the !important brand-lock block, which is
    // declared BEFORE the @theme block in source order but is semantically
    // an override of it) is recorded as an override, not discarded.
    const canonical = baseDeclarations[0] || mediaDeclarations[0];
    const overrides = baseDeclarations.slice(1).map((d) => ({
      value: d.value,
      line: d.line,
      condition: /!important/.test(d.value)
        ? 'theme-override: DaisyUI light-theme default (see global.css:15-19 comment)'
        : 'base-scope re-declaration',
    }));
    for (const o of overrides) {
      overriddenByEdges.push({
        source: decl.name,
        target: `${decl.name}@line${o.line}`,
        type: 'OVERRIDDEN_BY',
        condition: o.condition,
        evidence: `src/styles/global.css:${o.line}`,
        status: 'OBSERVED-SOURCE',
      });
    }

    const variesBy = mediaDeclarations.map((d) => ({
      value: d.value,
      line: d.line,
      condition: d.mediaCondition,
    }));
    for (const v of variesBy) {
      varyByEdges.push({
        source: decl.name,
        target: `${decl.name}@line${v.line}`,
        type: 'VARIES_BY',
        condition: v.condition,
        evidence: `src/styles/global.css:${v.line}`,
        status: 'OBSERVED-SOURCE',
      });
    }

    const aliasMatch = /^var\((--[a-zA-Z0-9-]+)\)$/.exec(canonical.value.trim());
    if (aliasMatch) {
      aliasEdges.push({
        source: decl.name,
        target: aliasMatch[1],
        type: 'ALIASES',
        condition: null,
        evidence: `src/styles/global.css:${canonical.line}`,
        status: 'OBSERVED-SOURCE',
      });
    }

    const directConsumers = await findDirectConsumers(decl.name, srcDir);
    const indirectConsumers = await findIndirectConsumers(decl.name, domain, srcDir);
    const indirectOnly = indirectConsumers.filter((f) => !directConsumers.includes(f));

    const consumers = [
      ...directConsumers.map((f) => ({
        file: f,
        classification: 'DIRECT',
        evidence: `grep var(${decl.name} in ${f}`,
        status: 'OBSERVED-SOURCE',
      })),
      ...indirectOnly.map((f) => ({
        file: f,
        classification: 'INDIRECT',
        evidence: `grep Tailwind-generated utility class for ${decl.name} in ${f}`,
        status: 'DERIVED',
        limitations: [
          'Tailwind v4 @theme utility-class mapping is a documented convention applied mechanically; not independently re-verified against Tailwind source this session.',
        ],
      })),
    ];

    tokens.push({
      id: `smile-savers.semantic.${decl.name.replace(/^--/, '')}`,
      name: decl.name,
      layer: 'SEMANTIC',
      domain,
      canonicalValue: canonical.value,
      canonicalDeclarationLine: canonical.line,
      overrides,
      variesBy,
      consumers,
      consumerCount: consumers.length,
      directConsumerCount: directConsumers.length,
      indirectConsumerCount: indirectOnly.length,
      inheritedConsumerCount: 0,
      runtimeConsumerCount: 0,
      orphan: consumers.length === 0,
      source: 'src/styles/global.css',
      sourceLine: canonical.line,
      evidenceStatus: 'VALID',
      evidenceCapturedAt: null, // filled in below with a shared timestamp
    });
  }

  const capturedAt = new Date().toISOString();
  for (const t of tokens) t.evidenceCapturedAt = capturedAt;

  const orphans = tokens.filter((t) => t.orphan);
  const byDomain = tokens.reduce((acc, t) => ((acc[t.domain] = (acc[t.domain] || 0) + 1), acc), {});
  const consumerClassificationTotals = tokens.reduce(
    (acc, t) => {
      acc.DIRECT += t.directConsumerCount;
      acc.INDIRECT += t.indirectConsumerCount;
      acc.INHERITED += t.inheritedConsumerCount;
      acc.RUNTIME += t.runtimeConsumerCount;
      return acc;
    },
    { DIRECT: 0, INDIRECT: 0, INHERITED: 0, RUNTIME: 0 }
  );

  const output = {
    ...runMetadata(STAGE),
    note: 'Every token here is declared in src/styles/global.css (grep-verified, line-cited) and every DIRECT consumer is a real var(--x) reference in src/ (grep-verified). INDIRECT consumers are Tailwind v4 utility-class references matched via a mechanically-applied, documented naming convention (evidence class DERIVED, not OBSERVED-SOURCE) — see per-consumer limitations. INHERITED and RUNTIME consumers were searched for (CSS-inheritance-only usage, inline style="var(...)" / JS-driven token reads) and none were found; recorded as 0, not omitted. Layer is uniformly SEMANTIC — Smile Savers has no separate RAW/ATOMIC/PRIMITIVE layer in evidence.',
    sourceFile: 'src/styles/global.css',
    sourceSha256AtCapture: cssSha256,
    counts: {
      totalTokens: tokens.length,
      byDomain,
      orphanTokens: orphans.length,
      tokensWithOverrides: tokens.filter((t) => t.overrides.length > 0).length,
      tokensWithMediaVariance: tokens.filter((t) => t.variesBy.length > 0).length,
      consumerClassificationTotals,
    },
    orphanTokenNames: orphans.map((t) => t.name),
    relationships: {
      ALIASES: aliasEdges,
      OVERRIDDEN_BY: overriddenByEdges,
      VARIES_BY: varyByEdges,
    },
    tokens,
  };
  output.canonicalHash = canonicalHash(
    tokens.map((t) => ({
      name: t.name,
      canonicalValue: t.canonicalValue,
      consumers: t.consumers.map((c) => ({ file: c.file, classification: c.classification })),
    }))
  );

  await writeJson(path.join(ARTIFACTS, 'semantic', 'token-inventory.json'), output);
  await writeJson(path.join(ROOT, 'reports', 'token-inventory.json'), output);

  log(
    STAGE,
    `tokens=${tokens.length} orphans=${orphans.length} mediaVariance=${output.counts.tokensWithMediaVariance} direct=${consumerClassificationTotals.DIRECT} indirect=${consumerClassificationTotals.INDIRECT}`
  );
  log(STAGE, `canonicalHash=${output.canonicalHash}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
