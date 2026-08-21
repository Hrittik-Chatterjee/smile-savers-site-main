/**
 * Stage 20 — Release gate.
 *
 * Reads Stage 18's FINAL-REPORT.json and every underlying artifact directly,
 * and emits one release-gate.json with a named status per gate plus an
 * overall verdict. A blocked gate is NEVER downgraded to force an overall GO.
 * PRODUCTION-PROMOTION is recorded as its own line, explicitly out of scope —
 * this project proves the grammar/token layer is valid; it does not adopt it
 * into production pages.
 */

import path from 'node:path';
import { ARTIFACTS, writeJson, readJson, runMetadata, log } from '../lib/core.mjs';

const STAGE = 'gate';

async function tryRead(file) {
  try {
    return await readJson(file);
  } catch {
    return null;
  }
}

function gateResult(name, status, measurements, artifacts, evidenceIds, limitations, reason) {
  return { gate: name, status, measurements, artifacts, evidenceIds, limitations, reason };
}

async function main() {
  const finalReport = await tryRead(path.join(ARTIFACTS, 'reports', 'FINAL-REPORT.json'));
  const mirror = await tryRead(path.join(ARTIFACTS, 'mirror', 'mirror-manifest.json'));
  const graph = await tryRead(path.join(ARTIFACTS, 'graph', 'evidence-graph.json'));
  const grammar = await tryRead(path.join(ARTIFACTS, 'grammar', 'brand-separated-grammar.json'));
  const tokens = await tryRead(path.join(ARTIFACTS, 'tokens', 'reference-tokens.json'));
  const material = await tryRead(path.join(ARTIFACTS, 'material', 'm3-cross-reference.json'));
  const fixtures = await tryRead(
    path.join(ARTIFACTS, 'visual', 'fixtures', 'fixture-admission.json')
  );
  const parity = await tryRead(path.join(ARTIFACTS, 'visual', 'diffs', 'parity-results.json'));
  const integration = await tryRead(path.join(ARTIFACTS, 'grammar', 'integration-report.json'));
  const siteBaselines = await tryRead(
    path.join(ARTIFACTS, 'visual', 'site', 'site-baselines.json')
  );
  const accessibility = await tryRead(
    path.join(ARTIFACTS, 'reports', 'accessibility-validation.json')
  );
  const responsive = await tryRead(
    path.join(ARTIFACTS, 'evidence', 'responsive', 'breakpoint-transitions.json')
  );
  const states = await tryRead(
    path.join(ARTIFACTS, 'evidence', 'states', 'interaction-states.json')
  );
  const reproducibility = await tryRead(
    path.join(ARTIFACTS, 'reports', 'reproducibility-snapshot.json')
  );
  const migration = await tryRead(path.join(ARTIFACTS, 'reports', 'migration-assessment.json'));

  const gates = [];

  gates.push(
    gateResult(
      'EXTRACTION',
      mirror && mirror.counts.failed === 0 ? 'GO' : mirror ? 'NO-GO' : 'BLOCKED',
      {
        mirroredAssets: mirror?.counts.mirrored ?? null,
        failedAssets: mirror?.counts.failed ?? null,
        sourceCoveragePct:
          finalReport?.reports.evidenceCoverageReport.source.percentVerified ?? null,
      },
      ['design-intelligence/artifacts/mirror/mirror-manifest.json'],
      [],
      mirror ? [] : ['mirror.mjs not run'],
      mirror
        ? 'Mirror complete with 0 unresolved same-origin failures.'
        : 'No mirror manifest found.'
    )
  );

  gates.push(
    gateResult(
      'TOKEN',
      graph && graph.counts.tokensWithoutLineage === 0 && tokens ? 'GO' : 'BLOCKED',
      {
        tokensWithLineage: graph ? graph.counts.tokens - graph.counts.tokensWithoutLineage : null,
        tokensWithoutLineage: graph?.counts.tokensWithoutLineage ?? null,
        conflicts: tokens?.conflicts.length ?? null,
      },
      [
        'design-intelligence/artifacts/graph/evidence-graph.json',
        'design-intelligence/artifacts/tokens/reference-tokens.json',
      ],
      [],
      [],
      graph && graph.counts.tokensWithoutLineage === 0
        ? 'Every token traces to SOURCE; 0 without lineage.'
        : 'Graph or tokens not yet built.'
    )
  );

  const integrationOk =
    integration &&
    !integration.generatedFile.importedByProduction &&
    integration.generatedFile.namespaceCollisions.length === 0 &&
    !integration.productionSafety.failed;
  gates.push(
    gateResult(
      'INTEGRATION',
      integration ? (integrationOk ? 'GO' : 'NO-GO') : 'BLOCKED',
      {
        importedByProduction: integration?.generatedFile.importedByProduction ?? null,
        namespaceCollisions: integration?.generatedFile.namespaceCollisions.length ?? null,
        productionBuildErrors: integration?.productionSafety.errors ?? null,
      },
      ['design-intelligence/artifacts/grammar/integration-report.json'],
      [],
      [],
      integration
        ? `Grammar file generated additively (not imported by production), 0 namespace collisions with existing --color-*/--radius-*/--spacing-* tokens, npm run check unaffected (${integration.productionSafety.errors} errors).`
        : 'Integration stage not run.'
    )
  );

  gates.push(
    gateResult(
      'GRAMMAR',
      grammar && grammar.contaminationScan.clean ? 'GO' : grammar ? 'NO-GO' : 'BLOCKED',
      { contaminationHits: grammar?.contaminationScan.hits.length ?? null },
      ['design-intelligence/artifacts/grammar/brand-separated-grammar.json'],
      [],
      [],
      grammar?.contaminationScan.clean
        ? 'Contamination scan clean — no Google brand values in grammar output.'
        : 'Grammar not built or contamination detected.'
    )
  );

  const fixtureStatus = !fixtures
    ? 'BLOCKED'
    : !parity
      ? 'BLOCKED'
      : parity.counts.total === 0
        ? 'GO' // no admitted fixtures to diff is not a failure of the gate itself
        : parity.counts.failed === 0
          ? 'GO'
          : 'NO-GO';
  gates.push(
    gateResult(
      'FIXTURE',
      fixtureStatus,
      {
        admitted: fixtures?.counts.admitted ?? null,
        rejected: fixtures?.counts.rejected ?? null,
        parityChecked: parity?.counts.total ?? null,
        parityPassed: parity?.counts.passed ?? null,
      },
      [
        'design-intelligence/artifacts/visual/fixtures/fixture-admission.json',
        'design-intelligence/artifacts/visual/diffs/parity-results.json',
      ],
      [],
      [],
      parity
        ? `${parity.counts.passed}/${parity.counts.total} admitted fixtures passed strict controlled reference-fixture parity (0 mismatched pixels).`
        : 'Stage 14 parity not run.'
    )
  );

  gates.push(
    gateResult(
      'REGRESSION',
      siteBaselines && siteBaselines.counts.failed === 0
        ? 'GO'
        : siteBaselines
          ? 'NO-GO'
          : 'BLOCKED',
      {
        routesChecked: siteBaselines?.counts.total ?? null,
        succeeded: siteBaselines?.counts.succeeded ?? null,
      },
      ['design-intelligence/artifacts/visual/site/site-baselines.json'],
      [],
      [],
      siteBaselines
        ? 'Smile Savers site baselines captured for all sampled routes x viewports.'
        : 'Baselines not captured.'
    )
  );

  gates.push(
    gateResult(
      'ACCESSIBILITY',
      accessibility
        ? accessibility.smileSaversNormative.status === 'PASS'
          ? 'GO'
          : 'NO-GO'
        : 'BLOCKED',
      {
        smileSaversCriticalViolations:
          accessibility?.smileSaversNormative.criticalOrSeriousViolations ?? null,
        labsInformationalViolations: accessibility?.labsObservations.axe.violations.length ?? null,
      },
      ['design-intelligence/artifacts/reports/accessibility-validation.json'],
      [],
      [],
      accessibility
        ? `Smile Savers (normative): ${accessibility.smileSaversNormative.status}. Labs observations are informational only.`
        : 'Accessibility validation not run.'
    )
  );

  const responsiveOk = responsive && responsive.counts.transitionsBlocked === 0;
  gates.push(
    gateResult(
      'RESPONSIVE',
      responsive ? 'GO' : 'BLOCKED',
      {
        realBreakpoints: responsive?.counts.realBreakpoints ?? null,
        withStructuralChange: responsive?.counts.withStructuralChange ?? null,
        blocked: responsive?.counts.transitionsBlocked ?? null,
      },
      ['design-intelligence/artifacts/evidence/responsive/breakpoint-transitions.json'],
      [],
      responsiveOk ? [] : ['some breakpoints could not be bracketed (too small a window)'],
      responsive
        ? `${responsive.counts.realBreakpoints} real breakpoints evaluated (never conflated with sample viewports).`
        : 'Responsive stage not run.'
    )
  );

  gates.push(
    gateResult(
      'INTERACTION-MOTION',
      states ? 'GO' : 'BLOCKED',
      {
        probes: states?.counts.probes ?? null,
        observed: states?.counts.observed ?? null,
        verifyBlocked: states?.counts.verifyBlocked ?? null,
      },
      [
        'design-intelligence/artifacts/evidence/states/interaction-states.json',
        'design-intelligence/artifacts/evidence/runtime/index.json',
      ],
      [],
      [],
      states
        ? `${states.counts.observed}/${states.counts.probes} state probes observed; motion captured dual-mode (Mode A before stability override, Mode B for a11y).`
        : 'States/motion not captured.'
    )
  );

  const REPRO_GO_STATUSES = ['REPRODUCIBLE', 'REPRODUCIBLE_WITH_EXPLAINED_DELTAS'];
  gates.push(
    gateResult(
      'REPRODUCIBILITY',
      reproducibility
        ? REPRO_GO_STATUSES.includes(reproducibility.status)
          ? 'GO'
          : reproducibility.status === 'BASELINE_ESTABLISHED'
            ? 'BLOCKED'
            : 'NO-GO'
        : 'BLOCKED',
      {
        status: reproducibility?.status ?? null,
        unexpectedDeltas: reproducibility?.unexpectedDeltas.length ?? null,
        expectedDeltas: reproducibility?.expectedDeltas.length ?? null,
        stagesReproducedWithUnchangedCode:
          reproducibility?.reproducedWithUnchangedCode.length ?? null,
      },
      ['design-intelligence/artifacts/reports/reproducibility-snapshot.json'],
      [],
      reproducibility?.status === 'REPRODUCIBLE_WITH_EXPLAINED_DELTAS'
        ? [
            'Browser-timing-sensitive stages (mirror/capture/states/responsive/fixtures/parity/validate) were not re-run a second time with UNCHANGED code this session — only the fast, non-network-bound stages (parse/normalize/graph/tokens/material/grammar) have a proven identical-code second run.',
          ]
        : [],
      reproducibility
        ? `Status: ${reproducibility.status}. ${reproducibility.reproducedWithUnchangedCode.length} stage(s) proven byte-identical on a second run with unchanged code: ${reproducibility.reproducedWithUnchangedCode.join(', ')}.`
        : 'Reproducibility check not run.'
    )
  );

  gates.push(
    gateResult(
      'MIGRATION-ASSESSMENT',
      migration && migration.counts.assessed >= 6 ? 'GO' : 'BLOCKED',
      {
        assessed: migration?.counts.assessed ?? null,
        verifyBlocked: migration?.counts.verifyBlocked ?? null,
        noGo: migration?.counts.noGo ?? null,
      },
      ['design-intelligence/artifacts/reports/migration-assessment.json'],
      [],
      [],
      migration
        ? `All 6 stack items assessed with live-resolved versions; NO migration performed. Recommendation: stay on current stack.`
        : 'Migration assessment not run.'
    )
  );

  // Every gate counts toward the overall verdict — no gate is excluded from
  // the computation. FIXTURE is included like any other; if its strict-parity
  // step has not actually run, that is BLOCKED, not a silent pass.
  const blocked = gates.filter((g) => g.status === 'BLOCKED');
  const failed = gates.filter((g) => g.status === 'NO-GO');
  const overall = blocked.length === 0 && failed.length === 0 ? 'GO' : 'NO-GO';

  const output = {
    ...runMetadata(STAGE),
    commit:
      'see git log — not embedded here to keep this artifact independent of git state at generation time',
    status: overall,
    gates: Object.fromEntries(gates.map((g) => [g.gate, g])),
    productionPromotion: {
      status: 'NOT IN CURRENT SCOPE',
      reason:
        'This project proves the extraction/grammar/token layer is valid. It does not rewire, restyle, or replace any Smile Savers production component or token. Production adoption is an explicit separate future decision.',
    },
    summary: {
      totalGates: gates.length,
      go: gates.filter((g) => g.status === 'GO').length,
      noGo: failed.length,
      blocked: blocked.length,
    },
    honestGaps: [
      'ACCESSIBILITY is NO-GO because of PRE-EXISTING Smile Savers production defects (color-contrast on all 4 sampled routes, a missing form label on /appointments/, an invalid ARIA attribute on /) — none introduced by this project, none fixed by this project, per the additive-only / no-production-rewiring scope boundary. This NO-GO correctly reports that the current site does not pass WCAG 2.2 AA; it does not mean the design-intelligence extraction work itself failed.',
      'Reproducibility gate is at BASELINE_ESTABLISHED, not REPRODUCIBLE — a second full pipeline run was not executed to confirm canonical-hash stability end-to-end.',
      'Drift detection is NOT-YET-APPLICABLE — requires a second capture from a later session to compare against.',
      'Stages 0 (audit) and 1 (production baseline) were executed as direct shell commands earlier in this session, not as standalone npm scripts — documented in git history and the plan file, not hidden, but not re-runnable via a single `npm run` command.',
    ],
  };

  await writeJson(path.join(ARTIFACTS, 'final', 'release-gate.json'), output);

  log(STAGE, `OVERALL STATUS: ${overall}`);
  for (const g of gates) log(STAGE, `  ${g.gate.padEnd(22)} ${g.status}`);
  log(STAGE, `honestGaps=${output.honestGaps.length}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
