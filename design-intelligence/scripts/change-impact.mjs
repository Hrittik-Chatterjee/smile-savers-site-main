/**
 * Change-impact engine (P1).
 *
 * Given a token name, walks token-inventory.json / token-lineage.json —
 * already-computed, real data — to answer "what breaks if this changes."
 * No new evidence is collected here; this is pure graph traversal over
 * evidence gathered by token-inventory.mjs.
 *
 * Usage: node change-impact.mjs <--token-name> [<--token-name> ...]
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { ROOT, writeJson, log } from '../lib/core.mjs';
import { impactForToken as impactFor } from './lib-change-impact.mjs';

const STAGE = 'change-impact';

async function loadData() {
  const inv = JSON.parse(await fs.readFile(path.join(ROOT, 'reports', 'token-inventory.json'), 'utf8'));
  const lineage = JSON.parse(await fs.readFile(path.join(ROOT, 'reports', 'token-lineage.json'), 'utf8'));
  return { inv, lineage };
}

async function main() {
  const args = process.argv.slice(2);
  const tokenNames = args.length > 0 ? args : ['--color-primary', '--color-accent'];
  const { inv, lineage } = await loadData();

  const results = tokenNames.map((name) => impactFor(name, inv, lineage));

  const output = {
    generatedAt: new Date().toISOString(),
    note:
      args.length > 0
        ? 'Ad-hoc change-impact query.'
        : 'No token specified on CLI — computed worked examples for --color-primary and --color-accent (both real, high-consumer-count tokens) to demonstrate the engine, rather than running all 136 tokens (which would be a mechanical rerun producing no new information beyond what token-inventory.json already contains).',
    results,
  };

  await writeJson(path.join(ROOT, 'reports', 'change-impact-report.json'), output);
  for (const r of results) {
    if (r.status === 'COMPUTED') {
      log(STAGE, `${r.token}: DIRECT=${r.DIRECT.count} INDIRECT=${r.INDIRECT.count} POSSIBLE=${r.POSSIBLE.count}`);
    } else {
      log(STAGE, `${r.token}: ${r.status} — ${r.reason}`);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
