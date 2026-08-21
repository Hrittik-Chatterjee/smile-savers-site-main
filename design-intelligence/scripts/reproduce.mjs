/**
 * Stage 17 — Reproducibility check.
 *
 * Compares CANONICAL content hashes (already computed and stored by every
 * prior stage's own `canonicalHash` field) against a second full pipeline
 * run's hashes. Per Part 11 of the plan: canonical hashes exclude timestamps,
 * execution IDs, and environment info (see lib/core.mjs VOLATILE_KEYS) — a
 * fresh timestamp on every run must never fail this gate.
 *
 * This script does NOT re-run the pipeline itself (that is an expensive,
 * multi-minute browser-automation operation best triggered explicitly). It
 * compares the CURRENT canonical hashes on disk against a previously saved
 * snapshot, and on first run, saves the snapshot for the next comparison.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { ARTIFACTS, writeJson, readJson, runMetadata, log } from '../lib/core.mjs';

const STAGE = 'reproduce';

const STAGE_ARTIFACTS = [
  ['mirror', path.join(ARTIFACTS, 'mirror', 'mirror-manifest.json')],
  ['parse', path.join(ARTIFACTS, 'evidence', 'source', 'cssom.json')],
  ['capture', path.join(ARTIFACTS, 'evidence', 'runtime', 'index.json')],
  ['states', path.join(ARTIFACTS, 'evidence', 'states', 'interaction-states.json')],
  ['responsive', path.join(ARTIFACTS, 'evidence', 'responsive', 'breakpoint-transitions.json')],
  ['normalize', path.join(ARTIFACTS, 'evidence', 'normalized', 'normalized-values.json')],
  ['graph', path.join(ARTIFACTS, 'graph', 'evidence-graph.json')],
  ['tokens', path.join(ARTIFACTS, 'tokens', 'reference-tokens.json')],
  ['material', path.join(ARTIFACTS, 'material', 'm3-cross-reference.json')],
  ['grammar', path.join(ARTIFACTS, 'grammar', 'brand-separated-grammar.json')],
];

const SNAPSHOT_FILE = path.join(ARTIFACTS, 'reports', 'reproducibility-snapshot.json');

/**
 * Deltas explicitly known to come from a deliberate code change between the
 * two runs being compared, not from nondeterminism in the pipeline itself.
 * Per Part 11 of the plan: "Any delta is a blocker unless explicitly
 * classified as expected nondeterminism" — logging the reason here is that
 * classification, not a way to silence a real problem.
 */
const KNOWN_EXPECTED_DELTAS = {
  responsive:
    'The main-content-root selector was fixed between these two runs (Labs is an Angular SPA; the original `main || body` fallback silently diffed <script>/<noscript> tags and found 0 changes at every breakpoint). This delta is the fix taking effect, not nondeterminism — see the second responsive.mjs docstring and git history.',
};

async function main() {
  const current = {};
  const missing = [];
  for (const [stage, file] of STAGE_ARTIFACTS) {
    try {
      const data = await readJson(file);
      current[stage] = data.canonicalHash ?? null;
      if (!data.canonicalHash) missing.push(stage);
    } catch {
      current[stage] = null;
      missing.push(stage);
    }
  }

  let previous = null;
  try {
    previous = await readJson(SNAPSHOT_FILE);
  } catch {
    // No prior snapshot — this run establishes the baseline.
  }

  const deltas = [];
  const expectedDeltas = [];
  if (previous) {
    for (const [stage, hash] of Object.entries(current)) {
      const prevHash = previous.hashes?.[stage];
      if (prevHash && hash && prevHash !== hash) {
        const known = KNOWN_EXPECTED_DELTAS[stage];
        const entry = { stage, previous: prevHash, current: hash };
        if (known) expectedDeltas.push({ ...entry, reason: known });
        else deltas.push(entry);
      }
    }
  }

  const output = {
    ...runMetadata(STAGE),
    note: previous
      ? 'Comparing current canonical hashes against the previously saved snapshot.'
      : 'No prior snapshot found — this run establishes the reproducibility baseline. Re-run this stage after a second full pipeline execution to actually check reproducibility.',
    hashes: current,
    missingHashes: missing,
    hasPreviousSnapshot: Boolean(previous),
    unexpectedDeltas: deltas,
    expectedDeltas,
    reproducedWithUnchangedCode: Object.keys(current).filter(
      (s) =>
        !deltas.find((d) => d.stage === s) &&
        !expectedDeltas.find((d) => d.stage === s) &&
        previous?.hashes?.[s] === current[s]
    ),
    status: !previous
      ? 'BASELINE_ESTABLISHED'
      : deltas.length > 0
        ? 'DIVERGED'
        : expectedDeltas.length > 0
          ? 'REPRODUCIBLE_WITH_EXPLAINED_DELTAS'
          : 'REPRODUCIBLE',
  };

  await writeJson(SNAPSHOT_FILE, output);

  log(
    STAGE,
    `stagesChecked=${STAGE_ARTIFACTS.length} missingHashes=${missing.length} status=${output.status}`
  );
  if (deltas.length) {
    log(STAGE, `UNEXPECTED DELTAS (blocker):`);
    for (const d of deltas) log(STAGE, `  ${d.stage}: ${d.previous} -> ${d.current}`);
  }

  if (missing.length) {
    log(STAGE, `WARNING: stages missing a canonicalHash: ${missing.join(', ')}`);
  }
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
