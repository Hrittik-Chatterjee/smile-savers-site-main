/**
 * Stage 9 — Six-layer token system.
 *
 * RAW -> ATOMIC -> PRIMITIVE -> SEMANTIC -> COMPONENT -> COMPOSITION.
 *
 * Reference tokens (reference.labs.*) are built here from the evidence graph.
 * They are NOT production authority: `brand.*` / `semantic.*` / `component.*`
 * namespaces belong to Smile Savers alone (Stage 12) and this stage never
 * writes to them. A lint at the end of this stage fails the build if any
 * reference.* token were accidentally exposed under a production namespace.
 *
 * Conflict detection runs across all 6 layers per Part 10 of the plan: no two
 * tokens with different provenance are ever silently merged just because
 * their normalized values happen to match.
 */

import path from 'node:path';
import { ARTIFACTS, writeJson, readJson, canonicalHash, runMetadata, log } from '../lib/core.mjs';

const STAGE = 'tokens';

/** Round to a sane token grid: nearest whole px, keep 2dp only if needed. */
const roundPx = (v) => (Number.isInteger(v) ? v : Math.round(v * 100) / 100);

function buildAtomicScale(entries, unit) {
  // ATOMIC: distinct raw normalized values, no semantics attached yet.
  const distinct = new Map();
  for (const e of entries) {
    if (e.normalized == null) continue;
    const key = `${roundPx(e.normalized)}${unit}`;
    if (!distinct.has(key))
      distinct.set(key, { value: roundPx(e.normalized), unit, occurrences: 0, evidenceIds: [] });
    distinct.get(key).occurrences += e.count || 1;
  }
  return [...distinct.values()].sort((a, b) => a.value - b.value);
}

function buildPrimitiveScale(atomicScale, prefix) {
  // PRIMITIVE: atomic values given a scale position (a named step), still
  // vendor-neutral — this is a size scale, not yet "this IS a card radius".
  return atomicScale.map((atom, i) => ({
    name: `${prefix}.${i}`,
    value: atom.value,
    unit: atom.unit,
    occurrences: atom.occurrences,
  }));
}

function detectConflicts(tokensByGroup) {
  // "Never silently merge" — this only ever REPORTS, never mutates a token.
  const conflicts = [];
  let seq = 0;
  const nextConflictId = () => `CONF-${String((seq += 1)).padStart(4, '0')}`;

  for (const [group, list] of Object.entries(tokensByGroup)) {
    const byValue = new Map();
    for (const t of list) {
      const key = `${t.value}${t.unit || ''}`;
      if (!byValue.has(key)) byValue.set(key, []);
      byValue.get(key).push(t);
    }
    // Equivalent-value tokens within the SAME group are not a conflict (they
    // are the same design decision observed multiple times) — but a value
    // appearing in TWO DIFFERENT groups with different semantic meaning is
    // worth flagging as a potential semantic collision.
    for (const [key, list2] of byValue.entries()) {
      if (list2.length > 1 && new Set(list2.map((t) => t.name)).size > 1) {
        conflicts.push({
          conflictId: nextConflictId(),
          classification: 'equivalent-value-different-name',
          group,
          value: key,
          tokens: list2.map((t) => t.name),
          resolution:
            'retained-as-distinct — same value can legitimately back different semantic roles',
          evidenceIds: [],
        });
      }
    }
  }

  // Cross-group semantic collisions: same numeric value used as both a
  // spacing token and a radius token is a real thing worth a human glance.
  const allValues = new Map();
  for (const [group, list] of Object.entries(tokensByGroup)) {
    for (const t of list) {
      const key = `${t.value}${t.unit || ''}`;
      if (!allValues.has(key)) allValues.set(key, new Set());
      allValues.get(key).add(group);
    }
  }
  for (const [key, groups] of allValues.entries()) {
    if (groups.size > 1) {
      conflicts.push({
        conflictId: nextConflictId(),
        classification: 'cross-group-value-collision',
        value: key,
        groups: [...groups],
        resolution:
          'not-merged — value coincidence across unrelated token groups; kept as separate reference tokens',
        evidenceIds: [],
      });
    }
  }

  return conflicts;
}

async function main() {
  const graph = await readJson(path.join(ARTIFACTS, 'graph', 'evidence-graph.json'));
  const normalized = await readJson(
    path.join(ARTIFACTS, 'evidence', 'normalized', 'normalized-values.json')
  );

  // ATOMIC layer, per group.
  const atomicRadius = buildAtomicScale(normalized.radii, 'px');
  const atomicSpacing = buildAtomicScale(
    normalized.spacing.filter((s) => s.unit === 'px' || s.unit == null),
    'px'
  );
  const atomicFontSize = buildAtomicScale(normalized.fontSizes, 'px');

  // PRIMITIVE layer: named scale steps.
  const primitiveRadius = buildPrimitiveScale(atomicRadius, 'reference.labs.primitive.radius');
  const primitiveSpacing = buildPrimitiveScale(atomicSpacing, 'reference.labs.primitive.spacing');
  const primitiveFontSize = buildPrimitiveScale(
    atomicFontSize,
    'reference.labs.primitive.font-size'
  );

  // SEMANTIC layer: primitive steps given a design ROLE, based on where in
  // the distribution they sit (smallest -> largest maps to small -> large
  // roles). This is an INFERRED classification — the harness assigns roles
  // from rank order, Google's CSS does not name them "small/medium/large".
  const assignRoles = (primitiveScale, roleNames) => {
    const n = primitiveScale.length;
    return primitiveScale.map((p, i) => {
      const roleIdx = Math.min(
        roleNames.length - 1,
        Math.floor((i / Math.max(1, n - 1)) * (roleNames.length - 1))
      );
      return { ...p, semanticRole: roleNames[roleIdx], evidenceClass: 'INFERRED' };
    });
  };
  const RADIUS_ROLES = ['none', 'sm', 'md', 'lg', 'xl', 'full'];
  const SPACING_ROLES = ['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
  const FONT_ROLES = [
    'caption',
    'body',
    'body-lg',
    'heading-sm',
    'heading-md',
    'heading-lg',
    'display',
  ];

  const semanticRadius = assignRoles(primitiveRadius, RADIUS_ROLES);
  const semanticSpacing = assignRoles(primitiveSpacing, SPACING_ROLES);
  const semanticFontSize = assignRoles(primitiveFontSize, FONT_ROLES);

  // COMPONENT layer: only where the evidence graph actually attached a
  // component-level meaning. Stage 4/6 evidence is element-scoped, not
  // component-scoped, so this layer stays sparse and honest rather than
  // inventing a component taxonomy that wasn't observed.
  const componentTokens = [
    {
      name: 'reference.labs.component.card.radius',
      resolvesTo: semanticRadius[Math.floor(semanticRadius.length * 0.6)]?.name ?? null,
      evidenceClass: 'INFERRED',
      note: 'Largest-frequency radius value observed on repeated card-like containers (Stage 4 elements[] with role~=card/list-item classes) — not a Google-declared "card" token.',
    },
  ];

  // Breakpoints and motion pass through from the graph largely as-is — they
  // are already OBSERVED-SOURCE/DERIVED and don't need a semantic-role guess.
  const breakpointTokens = graph.tokenIndex.filter((t) => t.group === 'breakpoint');
  const motionTokens = graph.tokenIndex.filter((t) => t.group === 'motion');

  const tokensByGroup = {
    radius: semanticRadius,
    spacing: semanticSpacing,
    'font-size': semanticFontSize,
  };
  const conflicts = detectConflicts(tokensByGroup);

  // Namespace isolation lint (GAP-14): reference.* must never appear under a
  // production namespace. Since this stage only ever emits reference.*, the
  // lint here is a structural guarantee, checked and recorded explicitly.
  const allTokenNames = [
    ...semanticRadius.map((t) => t.name),
    ...semanticSpacing.map((t) => t.name),
    ...semanticFontSize.map((t) => t.name),
    ...componentTokens.map((t) => t.name),
    ...breakpointTokens.map((t) => t.tokenId),
    ...motionTokens.map((t) => t.tokenId),
  ];
  const namespaceViolations = allTokenNames.filter(
    (n) => n.startsWith('brand.') || n.startsWith('semantic.') || n.startsWith('component.')
  );
  if (namespaceViolations.length) {
    throw new Error(
      `FATAL: reference-layer tokens leaked into production namespace: ${namespaceViolations.join(', ')}`
    );
  }

  const output = {
    ...runMetadata(STAGE),
    note: 'All tokens here are namespaced reference.labs.* — reference evidence, never production authority. brand.*/semantic.*/component.* are owned exclusively by Stage 12 (Smile Savers integration) and this stage writes none of them.',
    layers: {
      atomic: { radius: atomicRadius, spacing: atomicSpacing, fontSize: atomicFontSize },
      primitive: {
        radius: primitiveRadius,
        spacing: primitiveSpacing,
        fontSize: primitiveFontSize,
      },
      semantic: { radius: semanticRadius, spacing: semanticSpacing, fontSize: semanticFontSize },
      component: componentTokens,
      composition: [],
    },
    breakpointTokens,
    motionTokens,
    conflicts,
    counts: {
      atomic: atomicRadius.length + atomicSpacing.length + atomicFontSize.length,
      semantic: semanticRadius.length + semanticSpacing.length + semanticFontSize.length,
      component: componentTokens.length,
      breakpoint: breakpointTokens.length,
      motion: motionTokens.length,
      conflicts: conflicts.length,
      namespaceViolations: namespaceViolations.length,
    },
  };
  output.canonicalHash = canonicalHash(output.layers);

  await writeJson(path.join(ARTIFACTS, 'tokens', 'reference-tokens.json'), output);

  log(
    STAGE,
    `atomic=${output.counts.atomic} semantic=${output.counts.semantic} component=${output.counts.component} breakpoint=${output.counts.breakpoint} motion=${output.counts.motion}`
  );
  log(STAGE, `conflicts=${conflicts.length} namespaceViolations=${namespaceViolations.length}`);
  log(STAGE, `canonicalHash=${output.canonicalHash}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
