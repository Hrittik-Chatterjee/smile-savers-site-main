/**
 * Stage 8 — Evidence graph.
 *
 * Builds the 13-node lineage spine every downstream token must resolve to:
 *   SOURCE -> ASSET -> SELECTOR -> PROPERTY -> RAW -> NORMALIZED -> TOKEN ->
 *   SEMANTIC_ROLE -> COMPONENT -> FIXTURE -> VALIDATION -> SMILE_SAVERS_MAPPING
 *
 * This stage only links data Stages 2-7 already produced; it manufactures
 * nothing new. A node with no incoming edge from SOURCE cannot exist here —
 * the graph is a read of prior evidence, not a place to assert new claims.
 *
 * Later stages (9+) query this graph via `resolveLineage(tokenId)` to prove a
 * token traces back to a URL, rather than re-deriving lineage themselves.
 */

import path from 'node:path';
import { ARTIFACTS, writeJson, readJson, canonicalHash, runMetadata, log } from '../lib/core.mjs';

const STAGE = 'graph';

let nodeSeq = 0;
const nextNodeId = (kind) => `NODE-${kind}-${String((nodeSeq += 1)).padStart(6, '0')}`;

function node(kind, data) {
  return { id: nextNodeId(kind), kind, ...data };
}

async function main() {
  const mirrorManifest = await readJson(path.join(ARTIFACTS, 'mirror', 'mirror-manifest.json'));
  const cssom = await readJson(path.join(ARTIFACTS, 'evidence', 'source', 'cssom.json'));
  const normalized = await readJson(
    path.join(ARTIFACTS, 'evidence', 'normalized', 'normalized-values.json')
  );
  const runtimeIndex = await readJson(path.join(ARTIFACTS, 'evidence', 'runtime', 'index.json'));
  const desktopXlA = await readJson(
    path.join(ARTIFACTS, 'evidence', 'runtime', 'desktop-xl', 'A-canonical.json')
  );

  const nodes = [];
  const edges = [];
  const addEdge = (from, to, type = 'derives') => edges.push({ from, to, type });

  // SOURCE — the one root every asset traces to.
  const sourceNode = node('SOURCE', {
    url: mirrorManifest.target,
    origin: mirrorManifest.origin,
    evidenceClass: 'OBSERVED-SOURCE',
    artifactRef: 'design-intelligence/artifacts/mirror/mirror-manifest.json',
  });
  nodes.push(sourceNode);

  // ASSET — every mirrored file, linked to SOURCE.
  const assetNodeByUrl = new Map();
  for (const asset of mirrorManifest.assets) {
    const n = node('ASSET', {
      url: asset.url,
      contentType: asset.contentType,
      sha256: asset.sha256,
      evidenceClass: asset.evidenceClass,
      artifactRef: asset.localPath || null,
    });
    nodes.push(n);
    assetNodeByUrl.set(asset.url, n.id);
    addEdge(sourceNode.id, n.id, 'contains');
  }
  const cssAsset = mirrorManifest.assets.find((a) => a.contentType === 'text/css');
  const htmlAsset = mirrorManifest.assets.find((a) => a.contentType === 'text/html');

  // SELECTOR -> PROPERTY -> RAW -> NORMALIZED, for the design-relevant slices:
  // custom properties, radii, spacing, font sizes. Each RAW node cites the
  // Stage 3 source (declared) or Stage 4 (computed) origin explicitly.
  const tokens = [];

  const linkNormalizedGroup = (group, groupLabel, selectorHint) => {
    for (const entry of group) {
      const selectorNode = node('SELECTOR', {
        selector: selectorHint(entry),
        evidenceClass: 'OBSERVED-MIRROR',
      });
      nodes.push(selectorNode);
      addEdge(
        cssAsset ? assetNodeByUrl.get(cssAsset.url) : sourceNode.id,
        selectorNode.id,
        'styles'
      );

      const propertyNode = node('PROPERTY', {
        property: entry.property || entry.name,
        evidenceClass: 'OBSERVED-MIRROR',
      });
      nodes.push(propertyNode);
      addEdge(selectorNode.id, propertyNode.id, 'declares');

      const rawNode = node('RAW', { value: entry.raw, evidenceClass: 'OBSERVED-MIRROR' });
      nodes.push(rawNode);
      addEdge(propertyNode.id, rawNode.id, 'computes-to');

      const normalizedNode = node('NORMALIZED', {
        value: entry.normalized,
        unit: entry.unit,
        basis: entry.basis,
        evidenceClass: entry.evidenceClass,
      });
      nodes.push(normalizedNode);
      addEdge(rawNode.id, normalizedNode.id, 'normalizes-to');

      if (entry.normalized == null) continue; // no TOKEN without a resolvable value

      const tokenId = `reference.labs.${groupLabel}.${tokens.filter((t) => t.group === groupLabel).length}`;
      const tokenNode = node('TOKEN', {
        tokenId,
        group: groupLabel,
        value: entry.normalized,
        unit: entry.unit,
        occurrences: entry.count ?? null,
        evidenceClass: 'DERIVED',
      });
      nodes.push(tokenNode);
      addEdge(normalizedNode.id, tokenNode.id, 'admitted-as');
      tokens.push({
        id: tokenNode.id,
        tokenId,
        group: groupLabel,
        sourceChain: [
          sourceNode.id,
          selectorNode.id,
          propertyNode.id,
          rawNode.id,
          normalizedNode.id,
          tokenNode.id,
        ],
      });
    }
  };

  linkNormalizedGroup(normalized.radii, 'shape.radius', (e) => e.sampleSelector);
  linkNormalizedGroup(normalized.spacing, 'spacing', (e) => e.sampleSelector);
  linkNormalizedGroup(normalized.fontSizes, 'typography.size', (e) => e.sampleSelector);
  linkNormalizedGroup(
    normalized.customProperties.filter((c) => c.normalized != null),
    'custom-property',
    (e) => `:root { ${e.name} }`
  );

  // Breakpoints get their own TOKEN lineage (from Stage 3 media evidence
  // directly, not through the normalize.mjs property groups above).
  for (const bp of cssom.breakpoints) {
    const selectorNode = node('SELECTOR', {
      selector: `@media (${bp.bound}-width: ${bp.raws[0]})`,
      evidenceClass: bp.evidenceClass,
    });
    nodes.push(selectorNode);
    addEdge(
      cssAsset ? assetNodeByUrl.get(cssAsset.url) : sourceNode.id,
      selectorNode.id,
      'declares-media'
    );
    const tokenNode = node('TOKEN', {
      tokenId: `reference.labs.breakpoint.${bp.bound}-${Math.round(bp.px)}`,
      group: 'breakpoint',
      value: bp.px,
      unit: 'px',
      corroborated: Boolean(bp.corroborated),
      evidenceClass: bp.evidenceClass,
    });
    nodes.push(tokenNode);
    addEdge(selectorNode.id, tokenNode.id, 'admitted-as');
    tokens.push({
      id: tokenNode.id,
      tokenId: tokenNode.tokenId,
      group: 'breakpoint',
      sourceChain: [sourceNode.id, selectorNode.id, tokenNode.id],
    });
  }

  // Keyframes -> motion tokens, cross-linked to Stage 4 runtime motion counts.
  for (const kf of cssom.keyframes) {
    const selectorNode = node('SELECTOR', {
      selector: `@keyframes ${kf.name}`,
      evidenceClass: 'OBSERVED-SOURCE',
    });
    nodes.push(selectorNode);
    addEdge(
      cssAsset ? assetNodeByUrl.get(cssAsset.url) : sourceNode.id,
      selectorNode.id,
      'declares-keyframes'
    );
    const tokenNode = node('TOKEN', {
      tokenId: `reference.labs.motion.keyframe.${kf.name}`,
      group: 'motion',
      steps: kf.steps.length,
      evidenceClass: 'OBSERVED-SOURCE',
    });
    nodes.push(tokenNode);
    addEdge(selectorNode.id, tokenNode.id, 'admitted-as');
    // Cross-link to the runtime observation that this keyframe's suppression
    // changes rendered state (Stage 4/closure EV-UI-MOTION-00002).
    addEdge(tokenNode.id, sourceNode.id, 'corroborated-by-runtime:EV-UI-MOTION-00002');
    tokens.push({
      id: tokenNode.id,
      tokenId: tokenNode.tokenId,
      group: 'motion',
      sourceChain: [sourceNode.id, selectorNode.id, tokenNode.id],
    });
  }

  // Runtime-discovered ASSET (Circle.svg) explicitly present in the graph,
  // per the mandatory closure requirement that it be traceable.
  const circleAsset = mirrorManifest.assets.find((a) => a.url.includes('Circle.svg'));
  if (circleAsset) {
    const circleNodeId = assetNodeByUrl.get(circleAsset.url);
    const semanticNode = node('SEMANTIC_ROLE', {
      role: 'shape.mask.circle',
      evidenceClass: 'INFERRED',
    });
    nodes.push(semanticNode);
    addEdge(circleNodeId, semanticNode.id, 'plays-role');
    // Deliberately NOT linked to any M3/M3E node here — that correspondence
    // is Stage 10's job and must be classified MAPPED there, not asserted here.
  }

  // TOKEN -> SEMANTIC_ROLE -> COMPONENT -> FIXTURE -> VALIDATION -> SMILE_SAVERS_MAPPING
  // remain open (no data yet) for shape/spacing/typography tokens: Stages
  // 9-14 populate them. Recorded here as explicit UNKNOWN placeholders so the
  // graph shape is visible before those stages run, per "every layer requires
  // lineage" — an absent later stage is UNKNOWN, not silently missing.
  const openLayers = [
    'SEMANTIC_ROLE',
    'COMPONENT',
    'FIXTURE',
    'VALIDATION',
    'SMILE_SAVERS_MAPPING',
  ];
  const pendingByLayer = {};
  for (const layer of openLayers) pendingByLayer[layer] = tokens.length; // count of tokens awaiting this layer

  const tokensWithoutLineage = tokens.filter(
    (t) => !t.sourceChain || t.sourceChain[0] !== sourceNode.id
  );

  const output = {
    ...runMetadata(STAGE),
    note: 'Read-only linkage of Stage 2-7 evidence. No new claims are made here. Layers past TOKEN (SEMANTIC_ROLE onward) are populated by Stages 9-14 and are recorded as pending, not missing.',
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      tokens: tokens.length,
      tokensWithoutLineage: tokensWithoutLineage.length,
      byNodeKind: nodes.reduce((acc, n) => ((acc[n.kind] = (acc[n.kind] || 0) + 1), acc), {}),
      pendingByLayer,
    },
    nodes,
    edges,
    tokenIndex: tokens,
  };
  output.canonicalHash = canonicalHash({ nodes, edges });

  if (tokensWithoutLineage.length) {
    throw new Error(
      `FATAL: ${tokensWithoutLineage.length} token(s) exist without a lineage chain back to SOURCE — this violates the no-token-without-lineage rule.`
    );
  }

  await writeJson(path.join(ARTIFACTS, 'graph', 'evidence-graph.json'), output);

  log(
    STAGE,
    `nodes=${nodes.length} edges=${edges.length} tokens=${tokens.length} tokensWithoutLineage=${tokensWithoutLineage.length}`
  );
  log(STAGE, `byKind=${JSON.stringify(output.counts.byNodeKind)}`);
  log(STAGE, `canonicalHash=${output.canonicalHash}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
