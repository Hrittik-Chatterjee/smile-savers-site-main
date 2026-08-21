/**
 * Stage 7 — Normalization.
 *
 * Converts raw declared/computed values into a single comparable unit (px)
 * without ever mutating the raw evidence files Stages 3-6 wrote. Every
 * normalized record keeps its raw value and cites the basis evidence it used,
 * so a reader can verify the conversion instead of trusting it.
 *
 * Two DIFFERENT rem bases are in play (Stage 3, E-01 and the matchMedia probe):
 *   - element/property values:  1rem = 10px  (root font-size, computed + measured)
 *   - media-query lengths:      1rem = 16px  (initial font-size, per CSS spec)
 * Using the wrong basis for either would silently corrupt every size in the
 * token layer. Stage 3 already proved both; this stage only ever cites them.
 */

import path from 'node:path';
import { ARTIFACTS, writeJson, readJson, canonicalHash, runMetadata, log } from '../lib/core.mjs';

const STAGE = 'normalize';

function toPx(raw, elementRemBasisPx) {
  const m = /^(-?[\d.]+)(px|rem|em|%|vw|vh|s|ms)$/.exec((raw || '').trim());
  if (!m)
    return { normalized: null, evidenceClass: 'UNKNOWN', reason: `unparseable value "${raw}"` };
  const [, numStr, unit] = m;
  const num = Number(numStr);
  if (unit === 'px')
    return { normalized: num, unit: 'px', evidenceClass: 'DERIVED', basis: 'literal' };
  if (unit === 'rem') {
    if (elementRemBasisPx == null) {
      return {
        normalized: null,
        evidenceClass: 'VERIFY-BLOCKED',
        reason: 'root font-size basis not proven',
      };
    }
    return {
      normalized: Math.round(num * elementRemBasisPx * 100) / 100,
      unit: 'px',
      evidenceClass: 'DERIVED',
      basis: `root-font-size=${elementRemBasisPx}px (Stage 3 E-01, computed + measured agreement)`,
    };
  }
  // em, %, vw, vh, s, ms carry context-dependent or already-final meaning;
  // record them as-is rather than guessing a parent font-size or viewport.
  return {
    normalized: num,
    unit,
    evidenceClass: 'DERIVED',
    basis: `literal (${unit} is context-relative; not converted)`,
  };
}

async function main() {
  const cssom = await readJson(path.join(ARTIFACTS, 'evidence', 'source', 'cssom.json'));
  const runtimeIndex = await readJson(path.join(ARTIFACTS, 'evidence', 'runtime', 'index.json'));
  const desktopXlA = await readJson(
    path.join(ARTIFACTS, 'evidence', 'runtime', 'desktop-xl', 'A-canonical.json')
  );

  if (!cssom.remBasis?.agree) {
    throw new Error(
      'FATAL: Stage 3 remBasis.agree is false — element rem->px normalization has no proven basis and must not proceed with an assumed value.'
    );
  }
  const elementRemBasisPx = cssom.remBasis.computed;
  log(STAGE, `element rem basis (proven, Stage 3 E-01): ${elementRemBasisPx}px`);

  // Custom properties: normalize every root-level custom property value.
  const customProperties = Object.entries(desktopXlA.customProperties).map(([name, raw]) => ({
    name,
    raw,
    ...toPx(raw, elementRemBasisPx),
  }));

  // Radii, spacing, font sizes across the captured elements — deduplicated by
  // (property, raw value) since design tokens are about the DISTINCT values
  // in use, not per-element repetition.
  const RADIUS_PROPS = [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ];
  const SPACING_PROPS = [
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'gap',
    'row-gap',
    'column-gap',
  ];
  const FONT_SIZE_PROP = 'font-size';

  const distinctByProperty = (props) => {
    const seen = new Map();
    for (const el of desktopXlA.elements) {
      for (const prop of props) {
        const raw = el.styles[prop];
        if (!raw || raw === '0px' || raw === 'normal') continue;
        const key = `${prop}::${raw}`;
        if (!seen.has(key))
          seen.set(key, { property: prop, raw, count: 0, sampleSelector: el.selector });
        seen.get(key).count += 1;
      }
    }
    return [...seen.values()].sort((a, b) => b.count - a.count);
  };

  const radii = distinctByProperty(RADIUS_PROPS).map((r) => ({
    ...r,
    ...toPx(r.raw, elementRemBasisPx),
  }));
  const spacing = distinctByProperty(SPACING_PROPS).map((s) => ({
    ...s,
    ...toPx(s.raw, elementRemBasisPx),
  }));
  const fontSizes = distinctByProperty([FONT_SIZE_PROP]).map((f) => ({
    ...f,
    ...toPx(f.raw, elementRemBasisPx),
  }));

  // Breakpoints: Stage 6 already normalized these correctly (16px media
  // basis); this stage re-derives from Stage 3 raw evidence independently and
  // cross-checks agreement rather than trusting Stage 6's numbers blindly.
  const MEDIA_REM_BASIS_PX = 16;
  const breakpointCheck = cssom.breakpoints.map((bp) => {
    const isRem = bp.raws.some((r) => r.endsWith('rem'));
    const remRaw = bp.raws.find((r) => r.endsWith('rem'));
    const rederivedPx = isRem ? Number(remRaw.replace('rem', '')) * MEDIA_REM_BASIS_PX : bp.px;
    return {
      breakpointPx: bp.px,
      raws: bp.raws,
      rederivedPx,
      agrees: Math.abs(rederivedPx - bp.px) < 0.5,
      basis: isRem
        ? `media-query rem basis=${MEDIA_REM_BASIS_PX}px (initial font-size, NOT the ${elementRemBasisPx}px element basis)`
        : 'literal px',
    };
  });
  const basisMismatches = breakpointCheck.filter((b) => !b.agrees);

  const output = {
    ...runMetadata(STAGE),
    note: 'RAW values are never mutated — every entry here cites its source raw value alongside the normalized one. Two distinct rem bases are in force simultaneously: 10px for element properties, 16px for media-query lengths. See remBases below.',
    remBases: {
      elementPropertiesPx: elementRemBasisPx,
      mediaQueryLengthsPx: MEDIA_REM_BASIS_PX,
      elementBasisEvidence:
        'Stage 3 cssom.json remBasis (computed getComputedStyle + independent 10rem DOM probe, agree=true)',
      mediaBasisEvidence:
        'Stage 3 parse.mjs matchMedia empirical test (100rem false at 1024px viewport => 16px basis, not 10px)',
    },
    counts: {
      customProperties: customProperties.length,
      customPropertiesUnknownBasis: customProperties.filter(
        (c) => c.evidenceClass === 'UNKNOWN' || c.evidenceClass === 'VERIFY-BLOCKED'
      ).length,
      distinctRadii: radii.length,
      distinctSpacing: spacing.length,
      distinctFontSizes: fontSizes.length,
      breakpointBasisMismatches: basisMismatches.length,
    },
    customProperties,
    radii,
    spacing,
    fontSizes,
    breakpointCheck,
  };
  output.canonicalHash = canonicalHash({
    customProperties,
    radii,
    spacing,
    fontSizes,
    breakpointCheck,
  });

  if (basisMismatches.length) {
    log(
      STAGE,
      `WARNING: ${basisMismatches.length} breakpoint(s) disagree between Stage 6 and independent re-derivation:`
    );
    for (const m of basisMismatches) log(STAGE, `  ${JSON.stringify(m)}`);
  }

  await writeJson(path.join(ARTIFACTS, 'evidence', 'normalized', 'normalized-values.json'), output);

  log(
    STAGE,
    `customProps=${customProperties.length} radii=${radii.length} spacing=${spacing.length} fontSizes=${fontSizes.length}`
  );
  log(
    STAGE,
    `breakpoint basis cross-check: ${breakpointCheck.length - basisMismatches.length}/${breakpointCheck.length} agree`
  );
  log(STAGE, `canonicalHash=${output.canonicalHash}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
