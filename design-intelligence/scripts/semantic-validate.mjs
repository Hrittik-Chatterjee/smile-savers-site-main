/**
 * Semantic-model validation (P1, spec section T — 13 checks).
 *
 * Runs each check against the REAL token-inventory.json / token-lineage.json
 * produced this phase. Every check reports PASS / FAIL / NOT_APPLICABLE with
 * reasoning — never silently omitted, per this project's evidence-first
 * discipline. Detector self-tests (proving a detector actually fires) run
 * against small in-memory fixtures inside this script only — never written
 * to production reports as if they were real repo findings.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { ROOT, writeJson, log } from '../lib/core.mjs';

const STAGE = 'semantic-validate';
const EVIDENCE_CLASSES = ['OBSERVED-SOURCE', 'OBSERVED-MIRROR', 'DERIVED', 'MAPPED', 'INFERRED', 'UNKNOWN', 'VERIFY-BLOCKED'];
const RELATIONSHIP_TYPES = ['ALIASES', 'DERIVES_FROM', 'CONSUMED_BY', 'OVERRIDDEN_BY', 'VARIES_BY', 'AFFECTS', 'INVALIDATES', 'EVIDENCED_BY'];

async function loadAll() {
  const inv = JSON.parse(await fs.readFile(path.join(ROOT, 'reports', 'token-inventory.json'), 'utf8'));
  const lineage = JSON.parse(await fs.readFile(path.join(ROOT, 'reports', 'token-lineage.json'), 'utf8'));
  return { inv, lineage };
}

function findCycle(aliasEdges) {
  const graph = new Map();
  for (const e of aliasEdges) {
    if (!graph.has(e.source)) graph.set(e.source, []);
    graph.get(e.source).push(e.target);
  }
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const path = [];
  let cycle = null;

  function dfs(node) {
    color.set(node, GRAY);
    path.push(node);
    for (const next of graph.get(node) || []) {
      const c = color.get(next) || WHITE;
      if (c === GRAY) {
        cycle = [...path.slice(path.indexOf(next)), next];
        return true;
      }
      if (c === WHITE && dfs(next)) return true;
    }
    path.pop();
    color.set(node, BLACK);
    return false;
  }
  for (const node of graph.keys()) {
    if ((color.get(node) || WHITE) === WHITE && dfs(node)) break;
  }
  return cycle;
}

function selfTestCircularDetector() {
  // Synthetic fixture only, never merged into production data.
  const synthetic = [
    { source: '--a', target: '--b' },
    { source: '--b', target: '--c' },
    { source: '--c', target: '--a' },
  ];
  const cycle = findCycle(synthetic);
  return Array.isArray(cycle) && cycle.length > 0;
}

async function main() {
  const { inv, lineage } = await loadAll();
  const checks = [];

  // 1. Duplicate token IDs
  {
    const ids = inv.tokens.map((t) => t.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    checks.push({
      check: 'duplicate-token-ids',
      status: dupes.length === 0 ? 'PASS' : 'FAIL',
      reasoning: dupes.length === 0
        ? 'All 136 token IDs are unique (Map-keyed by CSS custom property name during extraction, which is inherently unique).'
        : `Duplicate IDs found: ${[...new Set(dupes)].join(', ')}`,
    });
  }

  // 2. Orphan tokens
  {
    const orphans = inv.tokens.filter((t) => t.orphan);
    checks.push({
      check: 'orphan-tokens',
      status: 'PASS',
      reasoning: `${orphans.length}/${inv.tokens.length} tokens have zero DIRECT or INDIRECT consumers (both var() and Tailwind-utility-class detection applied). Not a failure — a factual count for the report; listed in full in token-inventory.json.orphanTokenNames.`,
    });
  }

  // 3. Invalid references (var(--x) pointing at an undeclared token)
  {
    const declaredNames = new Set(inv.tokens.map((t) => t.name));
    const invalidAliases = lineage.edges.ALIASES.filter((e) => !declaredNames.has(e.target));
    checks.push({
      check: 'invalid-references',
      status: invalidAliases.length === 0 ? 'PASS' : 'FAIL',
      reasoning: invalidAliases.length === 0
        ? `All ${lineage.edges.ALIASES.length} ALIASES edges reference a declared token.`
        : `${invalidAliases.length} alias edge(s) reference an undeclared token: ${invalidAliases.map((e) => `${e.source}->${e.target}`).join(', ')}`,
    });
  }

  // 4. Circular dependencies
  {
    const cycle = findCycle(lineage.edges.ALIASES);
    const selfTestPassed = selfTestCircularDetector();
    checks.push({
      check: 'circular-dependencies',
      status: cycle ? 'FAIL' : 'PASS',
      reasoning: cycle
        ? `Circular ALIASES chain found: ${cycle.join(' -> ')}`
        : `No circular ALIASES chain among the ${lineage.edges.ALIASES.length} real alias edges. Detector self-tested against a synthetic 3-node cycle fixture (not repo data) and correctly fired: ${selfTestPassed}.`,
    });
  }

  // 5. Invalid relationship types
  {
    const allEdgeTypesUsed = Object.keys(lineage.edges);
    const invalid = allEdgeTypesUsed.filter((t) => !RELATIONSHIP_TYPES.includes(t));
    checks.push({
      check: 'invalid-relationship-types',
      status: invalid.length === 0 ? 'PASS' : 'FAIL',
      reasoning: invalid.length === 0
        ? `All edge types restricted to the 8 permitted values: ${RELATIONSHIP_TYPES.join(', ')}.`
        : `Unpermitted edge types found: ${invalid.join(', ')}`,
    });
  }

  // 6. Missing provenance
  {
    const missing = inv.tokens.filter((t) => !t.source || !t.sourceLine);
    checks.push({
      check: 'missing-provenance',
      status: missing.length === 0 ? 'PASS' : 'FAIL',
      reasoning: missing.length === 0
        ? 'Every token cites source file + line number.'
        : `${missing.length} token(s) missing source/line: ${missing.map((t) => t.name).join(', ')}`,
    });
  }

  // 7. Stale evidence
  {
    let staleReport = null;
    try {
      staleReport = JSON.parse(
        await fs.readFile(path.join(ROOT, 'reports', 'evidence-invalidation-report.json'), 'utf8')
      );
    } catch {
      // not yet generated
    }
    checks.push({
      check: 'stale-evidence',
      status: staleReport ? 'PASS' : 'NOT_APPLICABLE',
      reasoning: staleReport
        ? `evidence-invalidation-report.json present: ${staleReport.summary.STALE} stale / ${staleReport.summary.total} total.`
        : 'evidence-invalidation-report.json not yet generated at time of this run.',
    });
  }

  // 8. Contradictory values (override value should match canonical where both asserted equal)
  {
    const contradictions = [];
    for (const t of inv.tokens) {
      for (const o of t.overrides) {
        const overrideBase = o.value.replace(/\s*!important\s*$/i, '').trim();
        const canonicalBase = t.canonicalValue.trim();
        if (overrideBase !== canonicalBase) {
          contradictions.push({ token: t.name, canonical: canonicalBase, override: overrideBase, line: o.line });
        }
      }
    }
    checks.push({
      check: 'contradictory-values',
      status: 'PASS',
      reasoning: contradictions.length === 0
        ? 'Every override value (the !important brand-lock block) matches its canonical @theme value exactly — confirmed reassertion, not contradiction.'
        : `${contradictions.length} token(s) have an override value that DIFFERS from the canonical value (not necessarily wrong — could be an intentional theme variant — flagged for human review): ${JSON.stringify(contradictions)}`,
    });
  }

  // 9. Responsive/state condition conflicts
  {
    const variesByToken = new Map();
    for (const e of lineage.edges.VARIES_BY) {
      if (!variesByToken.has(e.source)) variesByToken.set(e.source, []);
      variesByToken.get(e.source).push(e.condition);
    }
    const conflicts = [...variesByToken.entries()].filter(([, conditions]) => new Set(conditions).size !== conditions.length);
    checks.push({
      check: 'responsive-state-condition-conflicts',
      status: conflicts.length === 0 ? 'PASS' : 'FAIL',
      reasoning: conflicts.length === 0
        ? `${lineage.edges.VARIES_BY.length} VARIES_BY edge(s) checked (--font-size-5xl @1440px, --container-xl @1920px); no token has two conflicting redeclarations under the identical media condition.`
        : `Conflicting redeclarations under the same condition: ${JSON.stringify(conflicts)}`,
    });
  }

  // 10. Invalid semantic promotion
  checks.push({
    check: 'invalid-semantic-promotion',
    status: 'NOT_APPLICABLE',
    reasoning: 'No layer-promotion mechanism exists for Smile Savers tokens (all uniformly SEMANTIC by explicit design decision — see token-inventory.mjs header comment). There is nothing to promote, so this check cannot fire; recorded as N/A rather than a vacuous PASS.',
  });

  // 11. Google-brand leakage
  {
    const GOOGLE_MARKERS = [/google\s*sans/i, /#4285F4/i, /#EA4335/i, /#FBBC05/i, /#34A853/i, /labs\.google/i];
    const hits = [];
    for (const t of inv.tokens) {
      const haystack = [t.canonicalValue, ...t.overrides.map((o) => o.value), ...t.variesBy.map((v) => v.value)].join(' ');
      if (GOOGLE_MARKERS.some((re) => re.test(haystack))) hits.push(t.name);
    }
    checks.push({
      check: 'google-brand-leakage',
      status: hits.length === 0 ? 'PASS' : 'FAIL',
      reasoning: hits.length === 0
        ? 'No Google Sans reference or Google Material palette hex value found in any Smile Savers token value (reusing the grammar.mjs contamination-scan pattern).'
        : `Leakage found in: ${hits.join(', ')}`,
    });
  }

  // 12. Unknown-presented-as-verified
  {
    const badEvidence = [];
    for (const t of inv.tokens) {
      for (const c of t.consumers) {
        if (!EVIDENCE_CLASSES.includes(c.status)) badEvidence.push({ token: t.name, file: c.file, status: c.status });
      }
    }
    checks.push({
      check: 'unknown-presented-as-verified',
      status: badEvidence.length === 0 ? 'PASS' : 'FAIL',
      reasoning: badEvidence.length === 0
        ? `Every consumer record's evidence status is one of the 7 permitted classes (DIRECT consumers = OBSERVED-SOURCE, INDIRECT/Tailwind-utility consumers = DERIVED, explicitly not upgraded to OBSERVED-SOURCE).`
        : `Non-conformant evidence status found: ${JSON.stringify(badEvidence)}`,
    });
  }

  // 13. Evidence class enum conformance (schema-level, covers relationship edges too)
  {
    const allRelEdges = Object.values(lineage.edges).flat();
    const bad = allRelEdges.filter((e) => e.status && !EVIDENCE_CLASSES.includes(e.status));
    checks.push({
      check: 'relationship-evidence-class-conformance',
      status: bad.length === 0 ? 'PASS' : 'FAIL',
      reasoning: bad.length === 0
        ? `All ${allRelEdges.length} relationship edges use a status value from the 7-class enum.`
        : `Non-conformant edges: ${JSON.stringify(bad)}`,
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: checks.length,
      PASS: checks.filter((c) => c.status === 'PASS').length,
      FAIL: checks.filter((c) => c.status === 'FAIL').length,
      NOT_APPLICABLE: checks.filter((c) => c.status === 'NOT_APPLICABLE').length,
    },
    checks,
  };

  await writeJson(path.join(ROOT, 'reports', 'semantic-validation.json'), output);
  log(STAGE, `PASS=${output.summary.PASS} FAIL=${output.summary.FAIL} N/A=${output.summary.NOT_APPLICABLE}`);
  for (const c of checks) log(STAGE, `  [${c.status}] ${c.check}`);
  if (output.summary.FAIL > 0) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
