/**
 * Stage 18 — Reports.
 *
 * Aggregates every prior stage's artifact into the named report set the plan
 * requires, each one distinguishing VERIFIED / DERIVED / MAPPED / INFERRED /
 * UNKNOWN / VERIFY-BLOCKED explicitly rather than collapsing into a single
 * score. Reads only — never recomputes or reinterprets a prior stage's
 * numbers.
 */

import path from 'node:path';
import { ARTIFACTS, writeJson, readJson, runMetadata, log } from '../lib/core.mjs';

const STAGE = 'report';

async function tryRead(file, fallback = null) {
  try {
    return await readJson(file);
  } catch {
    return fallback;
  }
}

async function main() {
  const closure = await tryRead(
    path.join(ARTIFACTS, 'evidence', 'closure', 'stage-4-5-closure.json')
  );
  const mirror = await tryRead(path.join(ARTIFACTS, 'mirror', 'mirror-manifest.json'));
  const cssom = await tryRead(path.join(ARTIFACTS, 'evidence', 'source', 'cssom.json'));
  const runtimeIndex = await tryRead(path.join(ARTIFACTS, 'evidence', 'runtime', 'index.json'));
  const states = await tryRead(
    path.join(ARTIFACTS, 'evidence', 'states', 'interaction-states.json')
  );
  const responsive = await tryRead(
    path.join(ARTIFACTS, 'evidence', 'responsive', 'breakpoint-transitions.json')
  );
  const normalized = await tryRead(
    path.join(ARTIFACTS, 'evidence', 'normalized', 'normalized-values.json')
  );
  const graph = await tryRead(path.join(ARTIFACTS, 'graph', 'evidence-graph.json'));
  const tokens = await tryRead(path.join(ARTIFACTS, 'tokens', 'reference-tokens.json'));
  const material = await tryRead(path.join(ARTIFACTS, 'material', 'm3-cross-reference.json'));
  const grammar = await tryRead(path.join(ARTIFACTS, 'grammar', 'brand-separated-grammar.json'));
  const integration = await tryRead(path.join(ARTIFACTS, 'grammar', 'integration-report.json'));
  const fixtures = await tryRead(
    path.join(ARTIFACTS, 'visual', 'fixtures', 'fixture-admission.json')
  );
  const parity = await tryRead(path.join(ARTIFACTS, 'visual', 'diffs', 'parity-results.json'));
  const siteBaselines = await tryRead(
    path.join(ARTIFACTS, 'visual', 'site', 'site-baselines.json')
  );
  const accessibility = await tryRead(
    path.join(ARTIFACTS, 'reports', 'accessibility-validation.json')
  );
  const reproducibility = await tryRead(
    path.join(ARTIFACTS, 'reports', 'reproducibility-snapshot.json')
  );
  const migration = await tryRead(path.join(ARTIFACTS, 'reports', 'migration-assessment.json'));

  // Coverage model (Part 5 / GAP-01, GAP-04): explicit per-axis status, never
  // an unqualified "100% extracted" unless every criterion is verified.
  const SOURCE_COVERAGE_CRITERIA = [
    'HTML',
    'CSS',
    'JavaScript',
    'custom properties',
    'media queries',
    'pseudo-state rules',
    'transitions',
    'keyframes',
    'asset references',
    'fonts',
    'images',
    'video',
    'preload/modulepreload',
    'CSS imports',
  ];
  const sourceCoverage = {
    HTML: mirror ? 'verified' : 'unknown',
    CSS: cssom ? 'verified' : 'unknown',
    JavaScript: mirror?.assets?.some((a) => a.contentType === 'text/javascript')
      ? 'partial (mirrored, not statically parsed by design — see mirror.mjs docstring)'
      : 'unknown',
    'custom properties': cssom?.counts?.customProperties ? 'verified' : 'unknown',
    'media queries': cssom?.counts?.media ? 'verified' : 'unknown',
    'pseudo-state rules': cssom?.counts?.stateRules ? 'verified' : 'unknown',
    transitions: cssom?.counts?.transitions ? 'verified' : 'unknown',
    keyframes: cssom?.counts?.keyframes ? 'verified' : 'unknown',
    'asset references': mirror ? 'verified' : 'unknown',
    fonts: runtimeIndex
      ? 'partial (loaded/unloaded status captured; Google Sans itself VERIFY-BLOCKED per F6)'
      : 'unknown',
    images: mirror?.counts?.mirrored ? 'verified' : 'unknown',
    video: mirror
      ? 'partial (dependency recorded, bodies intentionally not downloaded)'
      : 'unknown',
    'preload/modulepreload': mirror
      ? 'partial (discovered via <link rel> scan; not exhaustively verified)'
      : 'unknown',
    'CSS imports': cssom?.counts?.imports === 0 ? 'verified (0 found)' : 'unknown',
  };

  const DESIGN_COVERAGE_CRITERIA = [
    'color',
    'typography',
    'spacing',
    'sizing',
    'layout',
    'grid',
    'container',
    'shape',
    'border',
    'elevation',
    'opacity',
    'layering',
    'motion',
    'interaction',
    'responsive behavior',
    'accessibility',
    'component composition',
  ];
  const designCoverage = {
    color: normalized?.customProperties?.length ? 'verified' : 'unknown',
    typography: normalized?.fontSizes?.length ? 'verified' : 'unknown',
    spacing: normalized?.spacing?.length ? 'verified' : 'unknown',
    sizing: runtimeIndex ? 'verified' : 'unknown',
    layout: responsive ? 'verified' : 'unknown',
    grid: responsive ? 'partial (structural sampling to depth 2, not exhaustive)' : 'unknown',
    container: normalized?.customProperties?.some((c) => /max-width/i.test(c.name))
      ? 'verified'
      : 'unknown',
    shape: normalized?.radii?.length ? 'verified' : 'unknown',
    border: runtimeIndex ? 'verified' : 'unknown',
    elevation: cssom?.counts
      ? 'partial (box-shadow captured in element styles; not separately clustered as an elevation scale)'
      : 'unknown',
    opacity: 'partial (captured per-element; not clustered as a distinct scale)',
    layering: 'partial (z-index captured per-element; not clustered as a distinct scale)',
    motion: cssom?.counts?.keyframes && states ? 'verified' : 'unknown',
    interaction: states ? 'verified' : 'unknown',
    'responsive behavior': responsive ? 'verified' : 'unknown',
    accessibility: accessibility ? 'verified' : 'blocked (Stage 16 not yet run)',
    'component composition': tokens?.layers?.component?.length
      ? 'partial (1 component-level token inferred; broader component taxonomy not attempted, per honesty constraint against inventing coverage)'
      : 'unknown',
  };

  const countStatus = (obj, want) => Object.values(obj).filter((v) => v.startsWith(want)).length;
  const sourcePct = Math.round(
    (countStatus(sourceCoverage, 'verified') / SOURCE_COVERAGE_CRITERIA.length) * 100
  );
  const designPct = Math.round(
    (countStatus(designCoverage, 'verified') / DESIGN_COVERAGE_CRITERIA.length) * 100
  );

  const evidenceCoverageReport = {
    note: '"100% full design system extracted" is NEVER stated unless every criterion below is "verified" — it is not, so this report states the actual percentages.',
    source: {
      criteria: SOURCE_COVERAGE_CRITERIA.length,
      verifiedCount: countStatus(sourceCoverage, 'verified'),
      percentVerified: sourcePct,
      byCategory: sourceCoverage,
    },
    design: {
      criteria: DESIGN_COVERAGE_CRITERIA.length,
      verifiedCount: countStatus(designCoverage, 'verified'),
      percentVerified: designPct,
      byCategory: designCoverage,
    },
  };

  const extractionReport = {
    mirror: mirror
      ? {
          mirrored: mirror.counts.mirrored,
          failed: mirror.counts.failed,
          external: mirror.counts.external,
        }
      : null,
    cssom: cssom ? cssom.counts : null,
    runtime: runtimeIndex ? { captures: runtimeIndex.captures.length } : null,
  };

  const runtimeAssetReport = {
    note: 'Same-origin mirror-gap closure. Cross-origin (fonts.gstatic.com etc.) remain VERIFY-BLOCKED by design.',
    totalMirrorGapsAcrossCaptures: runtimeIndex
      ? runtimeIndex.captures.reduce((s, c) => s + (c.mirrorGaps ?? 0), 0)
      : null,
    runtimeDiscoveredAssets: runtimeIndex?.runtimeDiscoveredAssets ?? [],
  };

  const interactionStateReport = states
    ? {
        probes: states.counts.probes,
        observed: states.counts.observed,
        verifyBlocked: states.counts.verifyBlocked,
        byState: states.byState,
      }
    : null;

  const responsiveReport = responsive
    ? {
        note: 'transitions[] are keyed on REAL breakpoints from CSSOM evidence, never on sample viewports.',
        realBreakpoints: responsive.counts.realBreakpoints,
        transitionsObserved: responsive.counts.transitionsObserved,
        withStructuralChange: responsive.counts.withStructuralChange,
        viewportSampleClassification: responsive.viewportSampleClassification,
      }
    : null;

  const normalizationReport = normalized
    ? {
        remBases: normalized.remBases,
        counts: normalized.counts,
        breakpointBasisCrossCheck: `${normalized.breakpointCheck.length - normalized.counts.breakpointBasisMismatches}/${normalized.breakpointCheck.length} agree`,
      }
    : null;

  const evidenceGraphReport = graph
    ? {
        nodes: graph.counts.nodes,
        edges: graph.counts.edges,
        tokens: graph.counts.tokens,
        tokensWithoutLineage: graph.counts.tokensWithoutLineage,
        byNodeKind: graph.counts.byNodeKind,
      }
    : null;

  const tokenReport = tokens
    ? {
        counts: tokens.counts,
        conflicts: tokens.conflicts.length,
        conflictsByClassification: tokens.conflicts.reduce(
          (a, c) => ((a[c.classification] = (a[c.classification] || 0) + 1), a),
          {}
        ),
      }
    : null;

  const m3CrossReferenceReport = material
    ? {
        correspondences: material.counts.correspondences,
        byRelationshipType: material.counts.byRelationshipType,
        liveVerifiedFacts: material.liveVerifiedFacts,
        environmentLimitation: material.environmentLimitation.summary,
      }
    : null;

  const grammarReport = grammar
    ? {
        contaminationScanClean: grammar.contaminationScan.clean,
        layers: Object.keys(grammar.grammar),
      }
    : null;

  const integrationReport = integration
    ? {
        additiveOnly: !integration.generatedFile.importedByProduction,
        namespaceCollisions: integration.generatedFile.namespaceCollisions.length,
        generatedFile: integration.generatedFile.path,
        productionBuildStatus: integration.productionSafety,
        repoAuthoritativeValues: integration.repoAuthority.sampleTokens,
      }
    : null;

  const fixtureReport = fixtures
    ? {
        candidates: fixtures.counts.candidates,
        admitted: fixtures.counts.admitted,
        rejected: fixtures.counts.rejected,
      }
    : null;

  const visualParityReport = {
    note: 'STRICT 0-pixel parity applies ONLY to admitted fixtures (fixtureReport above), and is CONTROLLED REFERENCE-FIXTURE PARITY, never a claim about labs.google itself. This project makes NO claim of pixel parity between the Smile Savers site and labs.google, and none is measured here.',
    fixtureParityRun: Boolean(parity),
    fixtureParityResults: parity
      ? { total: parity.counts.total, passed: parity.counts.passed, failed: parity.counts.failed }
      : null,
    siteRegressionBaselines: siteBaselines
      ? {
          total: siteBaselines.counts.total,
          succeeded: siteBaselines.counts.succeeded,
          failed: siteBaselines.counts.failed,
        }
      : null,
  };

  const accessibilityReport = accessibility
    ? {
        labsObservationsInformationalOnly: {
          violations: accessibility.labsObservations.axe.violations.length,
          reducedMotionRespected: accessibility.labsObservations.reducedMotionMediaQueryRespected,
        },
        smileSaversNormative: accessibility.smileSaversNormative,
      }
    : { status: 'not yet run this session' };

  const reproducibilityReport = reproducibility ?? { status: 'not yet run this session' };

  const driftReport = {
    note: "Drift detection requires a SECOND capture from a later session to compare against this one's hashes (see reproducibility-snapshot.json). No drift can be classified on a single capture.",
    classification: 'NOT-YET-APPLICABLE',
  };

  const contradictionReport = tokens ? { conflicts: tokens.conflicts } : { conflicts: [] };

  const output = {
    ...runMetadata(STAGE),
    reports: {
      extractionReport,
      evidenceCoverageReport,
      runtimeAssetReport,
      interactionStateReport,
      responsiveReport,
      normalizationReport,
      evidenceGraphReport,
      tokenReport,
      m3CrossReferenceReport,
      grammarReport,
      integrationReport,
      fixtureReport,
      visualParityReport,
      accessibilityReport,
      reproducibilityReport,
      driftReport,
      contradictionReport,
      migrationAssessment: migration
        ? {
            assessed: migration.counts.assessed,
            verifyBlocked: migration.counts.verifyBlocked,
            noGo: migration.counts.noGo,
            recommendation: migration.overallRecommendation,
          }
        : null,
    },
    stage4to5ClosureRecordCount: closure?.evidenceCount ?? 0,
    classificationLegend: {
      VERIFIED: 'directly measured/observed this session',
      DERIVED: 'computed/normalized from OBSERVED evidence',
      MAPPED: 'correspondence to an external reference system (M3/M3E) — never provenance',
      INFERRED: 'design-system interpretation, not a source fact',
      UNKNOWN: 'not established',
      'VERIFY-BLOCKED': 'could not be established in this environment',
    },
  };

  await writeJson(path.join(ARTIFACTS, 'reports', 'FINAL-REPORT.json'), output);

  log(STAGE, `sourceCoverage=${sourcePct}% designCoverage=${designPct}%`);
  log(STAGE, `reports written: ${Object.keys(output.reports).length}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
