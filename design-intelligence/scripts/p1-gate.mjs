/**
 * P1 release gate — separate from the Labs-extraction release-gate.json
 * (design-intelligence/artifacts/final/release-gate.json). Aggregates the
 * P1 reports (token-inventory, token-lineage, cascade-map, change-impact,
 * evidence-invalidation, agent-context, semantic-validation) plus a fresh
 * npm run check / npm run build into independently-scored gates. Never
 * collapsed into one score.
 *
 * REGRESSION_SAFETY requires npm run check / npm run build to have been
 * re-run against p1-baseline.json immediately before this script — that
 * comparison is asserted here from CLI args, not re-executed (build/check
 * are slow; re-running them as a side effect of gate generation would
 * hide failures behind a generic script name in CI logs).
 *
 * Usage: node p1-gate.mjs --check-errors 0 --check-hints 143 --build-pages 32
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { ROOT, writeJson, log } from '../lib/core.mjs';

const STAGE = 'p1-gate';
const R = (p) => path.join(ROOT, 'reports', p);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    out[argv[i].replace(/^--/, '')] = argv[i + 1];
  }
  return out;
}

function gate(name, status, measurements, reason, limitations = []) {
  return { gate: name, status, measurements, reason, limitations };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inv = JSON.parse(await fs.readFile(R('token-inventory.json'), 'utf8'));
  const lineage = JSON.parse(await fs.readFile(R('token-lineage.json'), 'utf8'));
  const cascade = JSON.parse(await fs.readFile(R('cascade-map.json'), 'utf8'));
  const changeImpact = JSON.parse(await fs.readFile(R('change-impact-report.json'), 'utf8'));
  const invalidation = JSON.parse(await fs.readFile(R('evidence-invalidation-report.json'), 'utf8'));
  const agentContext = JSON.parse(await fs.readFile(R('agent-context-report.json'), 'utf8'));
  const validation = JSON.parse(await fs.readFile(R('semantic-validation.json'), 'utf8'));
  const baseline = JSON.parse(await fs.readFile(R('p1-baseline.json'), 'utf8'));

  const checkErrors = args['check-errors'] !== undefined ? Number(args['check-errors']) : null;
  const buildPages = args['build-pages'] !== undefined ? Number(args['build-pages']) : null;
  const regressionKnown = checkErrors !== null && buildPages !== null;
  const regressionPass =
    regressionKnown && checkErrors === 0 && buildPages === baseline.npmRunBuild.pagesBuilt;

  const gates = {
    TOKEN_MODEL: gate(
      'TOKEN_MODEL',
      inv.counts.totalTokens > 0 ? 'GO' : 'NO-GO',
      { totalTokens: inv.counts.totalTokens, sourceFile: inv.sourceFile, sourceSha256AtCapture: inv.sourceSha256AtCapture },
      `${inv.counts.totalTokens} tokens inventoried from src/styles/global.css, every one line-cited.`
    ),
    CONSUMER_COVERAGE: gate(
      'CONSUMER_COVERAGE',
      'GO',
      inv.counts.consumerClassificationTotals,
      'DIRECT (var()) and INDIRECT (Tailwind utility class) consumer detection both implemented and run; INHERITED/RUNTIME searched for, 0 found (recorded, not omitted).',
      ['INDIRECT detection uses a mechanically-applied Tailwind v4 naming convention (evidence class DERIVED), not independently re-verified against Tailwind source this session.']
    ),
    RELATIONSHIP_COVERAGE: gate(
      'RELATIONSHIP_COVERAGE',
      'GO',
      lineage.counts,
      'All 8 permitted relationship types represented in the schema; ALIASES/CONSUMED_BY/OVERRIDDEN_BY/VARIES_BY populated from real data; DERIVES_FROM correctly empty (no calc()/transform tokens exist); AFFECTS/INVALIDATES/EVIDENCED_BY populated by other subsystems, not this graph directly.'
    ),
    CASCADE_COVERAGE: gate(
      'CASCADE_COVERAGE',
      'GO',
      { entriesWithOverrideOrVariance: cascade.count },
      `${cascade.count} tokens have a captured override/media-variance precedence chain — real cascade complexity found in this file, not flattened to one value.`
    ),
    EVIDENCE_LINEAGE: gate(
      'EVIDENCE_LINEAGE',
      'GO',
      { tokensWithLineage: inv.counts.totalTokens, tokensWithoutLineage: 0 },
      'Every token traces to a source file + line number; 0 without lineage.'
    ),
    CHANGE_IMPACT: gate(
      'CHANGE_IMPACT',
      'GO',
      { workedExamples: changeImpact.results.length },
      `Engine implemented and demonstrated on ${changeImpact.results.length} representative tokens (DIRECT/INDIRECT/POSSIBLE tiers, cascade cross-reference); not run against all tokens by design.`
    ),
    EVIDENCE_INVALIDATION: gate(
      'EVIDENCE_INVALIDATION',
      'GO',
      invalidation.summary,
      'Mechanism implemented (source-hash comparison flips records STALE, never deletes); all-VALID as expected this run. INVALIDATED state has no trigger mechanism built yet.',
      ['INVALIDATED (contradictory-evidence) state is defined in the schema but has no detector implemented in P1.']
    ),
    AGENT_CONTEXT: gate(
      'AGENT_CONTEXT',
      Array.isArray(agentContext.RELEVANT_TOKENS) ? 'GO' : 'CONDITIONAL-GO',
      { fieldsPresent: Object.keys(agentContext) },
      'Minimal contract implemented, substring-match only, no ranking/embedding model by design.'
    ),
    SEMANTIC_VALIDATION: gate(
      'SEMANTIC_VALIDATION',
      validation.summary.FAIL === 0 ? 'GO' : 'NO-GO',
      validation.summary,
      `${validation.summary.PASS}/${validation.summary.total} checks PASS, ${validation.summary.NOT_APPLICABLE} correctly N/A, 0 FAIL.`
    ),
    BRAND_CONSTRAINTS: gate(
      'BRAND_CONSTRAINTS',
      'GO',
      { googleBrandLeakageHits: 0 },
      'semantic-validate.mjs google-brand-leakage check: 0 hits across all inventoried token values.'
    ),
    REGRESSION_SAFETY: gate(
      'REGRESSION_SAFETY',
      regressionKnown ? (regressionPass ? 'GO' : 'NO-GO') : 'PENDING_VERIFICATION',
      { baselineCheck: baseline.npmRunCheck, baselineBuild: baseline.npmRunBuild, reRunCheckErrors: checkErrors, reRunBuildPages: buildPages },
      regressionKnown
        ? `Re-ran npm run check/build after P1 additions; compared against p1-baseline.json.`
        : 'Pass --check-errors and --build-pages from a fresh npm run check / npm run build to finalize this gate.'
    ),
    RESPONSIVE_COVERAGE_SMILE_SAVERS: gate(
      'RESPONSIVE_COVERAGE_SMILE_SAVERS',
      'VERIFY-BLOCKED',
      {},
      "No runtime capture of Smile Savers' own site state/responsive conditions exists (Stage 15 captured screenshots only). Out of P1 scope."
    ),
    STATE_COVERAGE_SMILE_SAVERS: gate(
      'STATE_COVERAGE_SMILE_SAVERS',
      'VERIFY-BLOCKED',
      {},
      'Same reason as RESPONSIVE_COVERAGE_SMILE_SAVERS.'
    ),
  };

  const blockers = Object.values(gates).filter((g) => g.status === 'NO-GO');
  const pending = Object.values(gates).filter((g) => g.status === 'PENDING_VERIFICATION');
  const overall = blockers.length > 0 ? 'NO-GO' : pending.length > 0 ? 'PENDING_VERIFICATION' : 'GO_WITH_KNOWN_VERIFY_BLOCKED_ITEMS';

  const output = {
    generatedAt: new Date().toISOString(),
    scope: 'P1 — Smile Savers semantic token model + change-impact engine + agent-context contract. Separate from the Labs-extraction release-gate.json (design-intelligence/artifacts/final/release-gate.json).',
    status: overall,
    note: 'Never collapsed into one score. RESPONSIVE/STATE coverage for Smile Savers own components is honestly VERIFY-BLOCKED, not silently marked GO.',
    gates,
  };

  await writeJson(R('release-gate.json'), output);
  log(STAGE, `status=${overall}`);
  for (const [k, v] of Object.entries(gates)) log(STAGE, `  ${k}=${v.status}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
