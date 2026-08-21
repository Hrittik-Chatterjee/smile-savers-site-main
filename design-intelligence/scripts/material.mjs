/**
 * Stage 10 — Material 3 / Material 3 Expressive cross-reference.
 *
 * Material 3 is a REFERENCE system here, never Labs provenance. Every
 * correspondence below is `relationshipType: "MAPPED"` unless independently
 * proven — and none are proven, because official M3 documentation
 * (m3.material.io) is a JS-rendered SPA that Chromium cannot reach in this
 * environment (same ERR_CONNECTION_RESET blocker established for labs.google
 * in Stage 0). WebFetch confirmed this directly: the page returns only an
 * empty heading shell, no body content.
 *
 * One fact WAS independently verified live this session, via
 * raw.githubusercontent.com (a static CDN, not the blocked SPA):
 * material-components/material-web's README states verbatim "MWC is in
 * maintenance mode pending new maintainers" as of this fetch. That is the
 * only OBSERVED-SOURCE-LIVE fact in this file. Everything else about M3/M3E
 * scale names and values is common, long-published, stable public
 * specification knowledge that could NOT be freshly verified against the
 * canonical source here, and is therefore classified VERIFY-BLOCKED for
 * exact current values, with the well-known structure noted as INFERRED
 * context only — never asserted as this session's verified fact.
 */

import path from 'node:path';
import { ARTIFACTS, writeJson, readJson, canonicalHash, runMetadata, log } from '../lib/core.mjs';

const STAGE = 'material';

async function main() {
  const referenceTokens = await readJson(path.join(ARTIFACTS, 'tokens', 'reference-tokens.json'));
  const cssom = await readJson(path.join(ARTIFACTS, 'evidence', 'source', 'cssom.json'));

  const correspondences = [];

  // Material Web maintenance status — the one LIVE-verified fact in this file.
  correspondences.push({
    subject: '@material/web dependency decision (GAP-17)',
    labsEvidenceIds: [],
    m3Reference:
      'material-components/material-web (Google OSS repo, Lit-based M3 web component implementation)',
    m3eReference: null,
    relationshipType: 'OBSERVED-SOURCE',
    confidence: 'high — direct live fetch this session',
    rationale:
      'README.md fetched via raw.githubusercontent.com/material-components/material-web/main/README.md states verbatim: "MWC is in maintenance mode pending new maintainers." This directly supports the plan\'s GAP-17 rule: @material/web must not be added as a required production dependency, and is used here as reference evidence only.',
    limitations: [
      'm3.material.io itself (the canonical spec site) was NOT reachable — see limitations below.',
    ],
  });

  // Shape: Labs' own keyframes/border-radius evidence correlated to M3
  // Expressive's documented shape-morph motion concept — MAPPED, not provenance.
  const radiusTokenCount = referenceTokens.layers.semantic.radius.length;
  const shapeKeyframes = cssom.keyframes.filter((k) => /shape/i.test(k.name)).map((k) => k.name);
  correspondences.push({
    subject: 'Labs shape system (radius scale + shape-morph keyframes) vs M3/M3 Expressive shape',
    labsEvidenceIds: [
      `${radiusTokenCount} distinct radius values observed (Stage 7 normalize.mjs radii[])`,
      `keyframes: ${shapeKeyframes.join(', ')} (Stage 3 cssom.json)`,
      'runtime-discovered shape-mask asset: /assets/images/masks/Circle.svg (Stage 4/closure EV-UI-ASSET-00003)',
    ],
    m3Reference:
      'M3 documents a fixed shape scale (commonly: none/extra-small/small/medium/large/extra-large/full corner-radius steps)',
    m3eReference:
      'M3 Expressive documents an EXPANDED shape library with shape-morph MOTION as a first-class concept (a shape animating between states, not just a static corner radius)',
    relationshipType: 'MAPPED',
    confidence:
      'low-to-medium — structural resemblance only (Labs uses multiple radius steps AND has literal keyframes named "shape-morph"/"bg-shape-enter"/"svg-shape-enter"), not confirmed against the canonical M3E spec because m3.material.io was unreachable this session',
    rationale:
      'The presence of keyframes literally named "shape-morph" is suggestive of M3 Expressive\'s documented shape-morph motion pattern, and Circle.svg is evidence Labs uses shape-mask primitives. This is exactly the kind of correspondence worth recording — but it is a naming/structural echo observed in Labs\' own code, not a citation of the M3E spec, since that spec could not be fetched. Do not read this record as "Labs implements M3 Expressive shape-morph" — it records only that both systems use a similar CONCEPT, independently.',
    limitations: [
      'm3.material.io/styles/shape returned only an empty page shell via WebFetch (JS-rendered SPA, same block class as labs.google).',
      'Exact M3E shape-scale step count and names are VERIFY-BLOCKED this session; any specific number cited elsewhere is prior public knowledge, not a fresh verification.',
    ],
  });

  // Typography: Labs' font-size scale vs M3's named type scale.
  const fontSizeTokenCount = referenceTokens.layers.semantic.fontSize.length;
  correspondences.push({
    subject: 'Labs font-size scale vs M3 type scale (display/headline/title/body/label)',
    labsEvidenceIds: [
      `${fontSizeTokenCount} distinct font sizes observed (Stage 7 normalize.mjs fontSizes[])`,
    ],
    m3Reference:
      'M3 documents a named type scale (display/headline/title/body/label, each with large/medium/small variants)',
    m3eReference: 'M3 Expressive extends the type scale with additional emphasis variants',
    relationshipType: 'MAPPED',
    confidence:
      "low — role names (caption/body/heading-sm/.../display) assigned to Labs' font sizes in Stage 9 are this harness's rank-order INFERENCE (smallest-to-largest observed value mapped to smallest-to-largest role name), not read from any M3 or Labs source",
    rationale:
      'Both systems use a small ordered set of type sizes, which is a structural commonality shared by essentially all modern type systems, not evidence of shared implementation.',
    limitations: ['M3 type-scale exact px/sp values are VERIFY-BLOCKED this session.'],
  });

  // Motion: Labs' easing curves vs M3's documented motion tokens.
  const easingCurves = [
    ...new Set(
      cssom.transitions
        .map((t) => (t.value.match(/cubic-bezier\([^)]*\)/) || [])[0])
        .filter(Boolean)
    ),
  ];
  correspondences.push({
    subject: 'Labs easing curves vs M3 motion tokens (standard/emphasized/decelerate/accelerate)',
    labsEvidenceIds: [
      `${easingCurves.length} distinct cubic-bezier() curves observed (Stage 3 cssom.json transitions[])`,
    ],
    observedCurves: easingCurves,
    m3Reference:
      'M3 documents named easing tokens (e.g. standard, emphasized, emphasized-decelerate, emphasized-accelerate) as specific cubic-bezier curves',
    m3eReference:
      'M3 Expressive documents a physics-based (spring) motion system as an alternative to fixed-duration easing curves',
    relationshipType: 'MAPPED',
    confidence:
      "low — no attempt made to match Labs' specific cubic-bezier control points against M3's documented curve values, since the M3 reference values are VERIFY-BLOCKED this session",
    rationale:
      "Recording the observed curve set is honest OBSERVED-SOURCE evidence about Labs; asserting which (if any) match M3's named tokens would require the exact M3 control-point values, which could not be fetched.",
    limitations: [
      'Curve-by-curve numeric matching against M3 was not attempted — would require live m3.material.io access.',
    ],
  });

  // Responsive: Labs' real breakpoints vs M3 window size classes.
  const breakpointPx = [
    ...new Set(cssom.breakpoints.filter((b) => b.axis === 'width').map((b) => Math.round(b.px))),
  ].sort((a, b) => a - b);
  correspondences.push({
    subject:
      'Labs breakpoints vs M3 window size classes (compact/medium/expanded/large/extra-large)',
    labsEvidenceIds: [`breakpoints (px): ${breakpointPx.join(', ')} (Stage 3/6 evidence)`],
    m3Reference: 'M3 documents named window size classes at specific dp width thresholds',
    m3eReference: null,
    relationshipType: 'MAPPED',
    confidence:
      "low — M3's exact window-size-class thresholds are VERIFY-BLOCKED this session (m3.material.io/foundations/layout/.../window-size-classes returned HTTP 404 via WebFetch, and the canonical path could not be located)",
    rationale:
      "Labs' 768/1024px thresholds are common web breakpoints shared across most responsive systems, not distinctive evidence of M3 window-size-class adoption.",
    limitations: [
      'Could not locate or fetch the current M3 window-size-class documentation page this session.',
    ],
  });

  const output = {
    ...runMetadata(STAGE),
    note: 'All entries relationshipType=MAPPED except the one live-verified fact (material-web maintenance status), which is OBSERVED-SOURCE. No entry asserts Labs is built from Material 3 or Material 3 Expressive.',
    environmentLimitation: {
      summary: 'm3.material.io is unreachable for content in this environment.',
      evidence:
        'WebFetch on https://m3.material.io/styles/shape returned only an empty "Shape - Material Design 3" heading with no body content — a JS-rendered SPA shell, matching the exact failure pattern already proven for labs.google (Stage 0: Chromium ERR_CONNECTION_RESET on all external hosts). WebFetch on the window-size-classes path returned HTTP 404.',
      consequence:
        'Any specific M3/M3E numeric value (shape-scale radii, type-scale sizes, motion durations, window-size-class thresholds) stated elsewhere in this project is prior public knowledge carried by the model, NOT a value independently re-verified against the canonical source in this session, and MUST be treated as VERIFY-BLOCKED for exactness rather than cited as freshly confirmed.',
    },
    liveVerifiedFacts: [
      {
        claim: 'MWC (@material/web) is in maintenance mode pending new maintainers',
        source: 'https://raw.githubusercontent.com/material-components/material-web/main/README.md',
        method: 'curl fetch this session',
        evidenceClass: 'OBSERVED-SOURCE',
      },
    ],
    correspondences,
    counts: {
      correspondences: correspondences.length,
      byRelationshipType: correspondences.reduce(
        (acc, c) => ((acc[c.relationshipType] = (acc[c.relationshipType] || 0) + 1), acc),
        {}
      ),
    },
  };
  output.canonicalHash = canonicalHash(correspondences);

  await writeJson(path.join(ARTIFACTS, 'material', 'm3-cross-reference.json'), output);

  log(
    STAGE,
    `correspondences=${correspondences.length} byType=${JSON.stringify(output.counts.byRelationshipType)}`
  );
  log(STAGE, `liveVerifiedFacts=${output.liveVerifiedFacts.length}`);
  log(STAGE, `canonicalHash=${output.canonicalHash}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
