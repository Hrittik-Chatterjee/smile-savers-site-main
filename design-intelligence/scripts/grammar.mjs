/**
 * Stage 11 — Brand-separated grammar.
 *
 * Extracts RELATIONSHIPS from the reference token layers (ratios, rhythm,
 * scale-step counts, corroboration patterns) — never Google's actual color
 * values, font names, imagery, or copy. This is the one stage where a
 * contamination scan is not optional: it runs at the end and FAILS THE BUILD
 * if any forbidden Google-identifying string appears anywhere in the emitted
 * grammar output.
 *
 * Per GAP-18, this is the boundary: reference.labs.* tokens (Stage 9) may
 * carry real Google values (a real hex color, a real px radius) because they
 * are reference evidence about Labs. Grammar tokens (this stage) may never
 * carry those same raw values — only the relationship between them.
 */

import path from 'node:path';
import { ARTIFACTS, writeJson, readJson, canonicalHash, runMetadata, log } from '../lib/core.mjs';

const STAGE = 'grammar';

/** Strings that must never appear in grammar output. Checked recursively. */
const FORBIDDEN_PATTERNS = [
  /google\s*sans/i,
  /\blabs\.google\b/i,
  /googletagmanager/i,
  /gstatic/i,
  // Specific Google Labs hex colors observed in Stage 3/7 evidence — these
  // are Labs' actual brand values and must never appear as a grammar value.
  /#DDD3C7|#F3EFEA|#EFF5FF|#FFF8FE|#FEF7E0/i,
];

function scanForContamination(value, path_ = '$') {
  const hits = [];
  if (typeof value === 'string') {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(value)) hits.push({ path: path_, pattern: pattern.toString(), value });
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...scanForContamination(v, `${path_}[${i}]`)));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value))
      hits.push(...scanForContamination(v, `${path_}.${k}`));
  }
  return hits;
}

function ratio(a, b) {
  return b === 0 ? null : Math.round((a / b) * 1000) / 1000;
}

async function main() {
  const referenceTokens = await readJson(path.join(ARTIFACTS, 'tokens', 'reference-tokens.json'));
  const normalized = await readJson(
    path.join(ARTIFACTS, 'evidence', 'normalized', 'normalized-values.json')
  );

  // Spacing rhythm: is there a consistent base unit? Look at the GCD-like
  // pattern across the smallest distinct spacing values, expressed as a ratio
  // to the smallest value — never as the raw px number itself in a way that
  // implies "copy this exact scale", only the RELATIONSHIP between steps.
  const spacingValues = referenceTokens.layers.atomic.spacing
    .map((s) => s.value)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const smallestSpacing = spacingValues[0] ?? null;
  const spacingRhythm = smallestSpacing
    ? spacingValues.slice(0, 12).map((v) => ({
        stepRatio: ratio(v, smallestSpacing),
        occurrences:
          referenceTokens.layers.atomic.spacing.find((s) => s.value === v)?.occurrences ?? null,
      }))
    : [];

  // Radius scale relationships: ratio of each step to the smallest non-zero step.
  const radiusValues = referenceTokens.layers.atomic.radius
    .map((r) => r.value)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  const smallestRadius = radiusValues[0] ?? null;
  const radiusScaleRatios = smallestRadius ? radiusValues.map((v) => ratio(v, smallestRadius)) : [];

  // Typography hierarchy ratios: consecutive step ratios (modular-scale-like).
  const fontSizes = referenceTokens.layers.atomic.fontSize
    .map((f) => f.value)
    .sort((a, b) => a - b);
  const typeScaleRatios = fontSizes.slice(1).map((v, i) => ratio(v, fontSizes[i]));

  // Breakpoint rhythm: ratio between consecutive real breakpoints.
  const breakpointPx = referenceTokens.breakpointTokens
    .map((b) => b.tokenId.match(/-(\d+)$/)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort((a, b) => a - b);
  const breakpointRatios = breakpointPx.slice(1).map((v, i) => ratio(v, breakpointPx[i]));

  // Composition pattern: container-logic relationship (does content width
  // scale with viewport, or clamp at a max?) — derived from the presence of
  // a corroborated max-width-class custom property, described structurally.
  const hasContentMaxWidth = Object.keys(
    Object.fromEntries((normalized.customProperties || []).map((c) => [c.name, c.raw]))
  ).some((name) => /max-width/i.test(name));

  const grammar = {
    spacingRhythm: {
      description:
        "Ratio of each observed spacing step to the smallest observed non-zero spacing step, ordered smallest-first. A relationship (e.g. 1 / 2 / 3 / 4x the base unit), not a copy of Labs' literal px scale.",
      baseUnitRatio: 1,
      steps: spacingRhythm,
      evidenceClass: 'DERIVED',
    },
    radiusScale: {
      description: 'Ratio of each observed radius step to the smallest non-zero radius step.',
      stepRatios: radiusScaleRatios,
      stepCount: radiusScaleRatios.length,
      evidenceClass: 'DERIVED',
    },
    typographyHierarchy: {
      description:
        'Consecutive step ratios across the observed font-size scale (a modular-scale-style relationship), not the literal sizes.',
      consecutiveStepRatios: typeScaleRatios,
      evidenceClass: 'DERIVED',
    },
    responsiveRhythm: {
      description:
        'Ratio between consecutive real breakpoints (Stage 3/6 evidence), describing HOW breakpoints space out, not their literal px values.',
      consecutiveRatios: breakpointRatios,
      breakpointCount: breakpointPx.length,
      evidenceClass: 'DERIVED',
    },
    compositionPatterns: {
      description: 'Structural layout patterns observed, described without literal values.',
      usesContentMaxWidthConstraint: hasContentMaxWidth,
      evidenceClass: 'INFERRED',
    },
    interactionStatePatterns: {
      description:
        'Structural pattern: does every interactive element carry a distinct visible focus-visible treatment? (see closure EV-UI-STATE-00001: 28/28 resolved rules showed a measurable delta)',
      focusVisibleAppliedSystematically: true,
      evidenceClass: 'DERIVED',
    },
    motionRelationships: {
      description:
        'Structural pattern: motion state (suppressed vs not) changes which elements are considered "visible" at all, not merely how they transition (see closure EV-UI-MOTION-00002).',
      motionAffectsInitialVisibility: true,
      evidenceClass: 'DERIVED',
    },
  };

  // FORBIDDEN: raw Labs values must never appear in grammar. Scan before write.
  const contamination = scanForContamination(grammar);

  const output = {
    ...runMetadata(STAGE),
    note: 'Extracts RELATIONSHIPS (ratios, rhythm, structural patterns) only. Contains zero Google colors, zero Google Sans references, zero Labs imagery/copy — enforced by the contamination scan below, which fails the stage if violated.',
    grammar,
    contaminationScan: {
      forbiddenPatternCount: FORBIDDEN_PATTERNS.length,
      hits: contamination,
      clean: contamination.length === 0,
    },
  };
  output.canonicalHash = canonicalHash(grammar);

  if (contamination.length) {
    throw new Error(
      `FATAL: brand contamination detected in grammar output — ${contamination.length} hit(s): ${JSON.stringify(contamination)}`
    );
  }

  await writeJson(path.join(ARTIFACTS, 'grammar', 'brand-separated-grammar.json'), output);

  log(STAGE, `contaminationScan.clean=${output.contaminationScan.clean}`);
  log(
    STAGE,
    `spacingSteps=${spacingRhythm.length} radiusSteps=${radiusScaleRatios.length} typeSteps=${typeScaleRatios.length} breakpointSteps=${breakpointRatios.length}`
  );
  log(STAGE, `canonicalHash=${output.canonicalHash}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
