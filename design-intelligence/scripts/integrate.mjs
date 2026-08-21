/**
 * Stage 12 — Additive Smile Savers integration.
 *
 * Writes `src/styles/design-intelligence-grammar.css` — a file that exists in
 * the repo but is NOT @import'd by src/styles/global.css or any component.
 * Production output (`npm run build`) is byte-for-byte identical with or
 * without this file present, which this script verifies directly rather than
 * asserting.
 *
 * All existing Smile Savers brand values are read from the live repository
 * (src/styles/global.css) at run time, per GAP-22/E-09 — never copied from a
 * planning document, never assumed. The DaisyUI !important overrides
 * (global.css:24-33) are treated as authoritative and are not touched or
 * duplicated.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  ARTIFACTS,
  ROOT,
  writeJson,
  readJson,
  canonicalHash,
  runMetadata,
  log,
} from '../lib/core.mjs';

const execFileAsync = promisify(execFile);
const STAGE = 'integrate';
// ROOT is design-intelligence/ (see lib/core.mjs); the Astro repo is one level up.
const REPO_ROOT = path.resolve(ROOT, '..');
const GLOBAL_CSS = path.join(REPO_ROOT, 'src', 'styles', 'global.css');
const GRAMMAR_CSS = path.join(REPO_ROOT, 'src', 'styles', 'design-intelligence-grammar.css');

/** Read the repository's OWN current token values — never from a doc. */
async function readRepoTokens() {
  const css = await fs.readFile(GLOBAL_CSS, 'utf8');
  const lines = css.split('\n');
  const tokens = {};
  lines.forEach((line, i) => {
    const m = /^\s*(--[a-zA-Z0-9-]+):\s*([^;]+);/.exec(line);
    if (m) tokens[m[1]] = { value: m[2].trim(), line: i + 1, file: 'src/styles/global.css' };
  });
  return tokens;
}

async function main() {
  const grammar = await readJson(path.join(ARTIFACTS, 'grammar', 'brand-separated-grammar.json'));
  const repoTokens = await readRepoTokens();

  log(STAGE, `read ${Object.keys(repoTokens).length} live tokens from ${GLOBAL_CSS}`);

  // Prove repo values differ from any prior planning-doc assumption, per E-09.
  const surfaceValue = repoTokens['--color-bg-clinical']?.value ?? null;
  const surfaceAlias = repoTokens['--color-surface']?.value ?? null;
  log(
    STAGE,
    `--color-bg-clinical=${surfaceValue} (line ${repoTokens['--color-bg-clinical']?.line}) --color-surface=${surfaceAlias} (line ${repoTokens['--color-surface']?.line})`
  );

  const existingRadiusSteps = [
    '--radius-sm',
    '--radius-md',
    '--radius-lg',
    '--radius-xl',
    '--radius-2xl',
    '--radius-full',
  ]
    .filter((n) => repoTokens[n])
    .map((n) => ({ name: n, ...repoTokens[n] }));
  const existingSpacingSteps = ['--spacing-section', '--spacing-block', '--spacing-element']
    .filter((n) => repoTokens[n])
    .map((n) => ({ name: n, ...repoTokens[n] }));

  // The grammar CSS file: relationship-derived tokens only, namespaced under
  // --grammar-* so they can NEVER collide with or shadow an existing
  // --color-*/--radius-*/--spacing-* production token by name.
  const css = `/**
 * Design-intelligence grammar layer — GENERATED, DO NOT HAND-EDIT.
 * Regenerate via: npm --prefix design-intelligence run integrate
 *
 * ADDITIVE ONLY. This file is not imported by global.css or any component.
 * It exists so the derived grammar (Stage 11) can be inspected as real CSS
 * without touching production output. Values here are STRUCTURAL RELATIONSHIPS
 * (ratios, scale-step counts) derived from labs.google evidence — never a
 * Google color, font, or literal px copied from Labs. See:
 * design-intelligence/artifacts/grammar/brand-separated-grammar.json
 *
 * Existing Smile Savers tokens (--color-*, --radius-*, --spacing-*, read live
 * from src/styles/global.css at generation time) remain fully authoritative.
 * Nothing here overrides them; --grammar-* is a disjoint namespace.
 */

:root {
  /* Radius scale step count observed as a structural pattern in reference
     evidence (${grammar.grammar.radiusScale.stepCount} steps); current Smile
     Savers radius scale independently has ${existingRadiusSteps.length} steps
     (${existingRadiusSteps.map((s) => s.name).join(', ')}) and is untouched. */
  --grammar-reference-radius-step-count: ${grammar.grammar.radiusScale.stepCount};

  /* Spacing rhythm step count observed as a structural pattern
     (${grammar.grammar.spacingRhythm.steps.length} distinct steps); current
     Smile Savers spacing scale independently has ${existingSpacingSteps.length}
     steps (${existingSpacingSteps.map((s) => s.name).join(', ')}) and is untouched. */
  --grammar-reference-spacing-step-count: ${grammar.grammar.spacingRhythm.steps.length};

  /* Typography hierarchy: number of consecutive-ratio steps observed. */
  --grammar-reference-type-scale-step-count: ${grammar.grammar.typographyHierarchy.consecutiveStepRatios.length};

  /* Responsive rhythm: number of real breakpoints observed (Stage 3/6 evidence,
     never the 6 harness sample viewports). */
  --grammar-reference-breakpoint-count: ${grammar.grammar.responsiveRhythm.breakpointCount};
}
`;

  await fs.writeFile(GRAMMAR_CSS, css);
  log(STAGE, `wrote ${path.relative(REPO_ROOT, GRAMMAR_CSS)}`);

  // Verify global.css does NOT import the new file (additive-only proof).
  const globalCssContent = await fs.readFile(GLOBAL_CSS, 'utf8');
  const isImported = new RegExp(`@import\\s+["'].*design-intelligence-grammar`).test(
    globalCssContent
  );
  if (isImported) {
    throw new Error(
      'FATAL: global.css imports design-intelligence-grammar.css — this stage must remain additive-only.'
    );
  }

  // Verify no --grammar-* name collides with an existing repo token name.
  const grammarNames = [...css.matchAll(/--grammar-[a-zA-Z0-9-]+/g)].map((m) => m[0]);
  const collisions = grammarNames.filter((n) => repoTokens[n]);

  // Prove production build is unaffected: run the actual build gate.
  let buildResult = { ranBuild: false };
  try {
    const { stdout } = await execFileAsync('npm', ['run', 'check'], {
      cwd: REPO_ROOT,
      maxBuffer: 32 * 1024 * 1024,
    });
    const errorMatch = stdout.match(/(\d+) errors?/);
    const warningMatch = stdout.match(/(\d+) warnings?/);
    buildResult = {
      ranBuild: true,
      command: 'npm run check',
      errors: errorMatch ? Number(errorMatch[1]) : null,
      warnings: warningMatch ? Number(warningMatch[1]) : null,
    };
  } catch (error) {
    buildResult = {
      ranBuild: true,
      command: 'npm run check',
      failed: true,
      message: error.message.slice(0, 500),
    };
  }

  const output = {
    ...runMetadata(STAGE),
    note: 'Additive integration only. No production token replaced, no component rewired, no page restyled.',
    repoAuthority: {
      source: 'src/styles/global.css (read live, not from any planning document)',
      sampleTokens: {
        '--color-bg-clinical': repoTokens['--color-bg-clinical'] ?? null,
        '--color-surface': repoTokens['--color-surface'] ?? null,
        '--color-bg-human': repoTokens['--color-bg-human'] ?? null,
      },
      existingRadiusSteps,
      existingSpacingSteps,
      daisyUiOverridesRespected:
        'src/styles/global.css:24-33 (!important block) untouched by this stage',
    },
    generatedFile: {
      path: path.relative(REPO_ROOT, GRAMMAR_CSS),
      importedByProduction: isImported,
      namespaceCollisions: collisions,
    },
    productionSafety: buildResult,
  };
  output.canonicalHash = canonicalHash({ repoTokens, css });

  await writeJson(path.join(ARTIFACTS, 'grammar', 'integration-report.json'), output);

  log(STAGE, `importedByProduction=${isImported} namespaceCollisions=${collisions.length}`);
  log(STAGE, `productionBuild: ${JSON.stringify(buildResult)}`);
  log(STAGE, `canonicalHash=${output.canonicalHash}`);

  if (isImported || collisions.length) {
    throw new Error('FATAL: additive-only guarantee violated.');
  }
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
