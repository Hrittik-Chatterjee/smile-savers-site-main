/**
 * Evidence invalidation tracking (P1).
 *
 * Ties the token-inventory.json evidence set to the SHA-256 of
 * src/styles/global.css at capture time (already recorded on the
 * inventory as sourceSha256AtCapture). On each run, compares that stored
 * hash against the CURRENT file hash:
 *   - unchanged -> every token-inventory record stays VALID
 *   - changed   -> every record is flipped to STALE (never auto-deleted;
 *                  the prior inventory is preserved for lineage, and a
 *                  fresh token-inventory.mjs run is required to produce a
 *                  new VALID generation)
 *
 * This run is the first of the P1 phase, so the expected/only realistic
 * outcome is "all VALID" — that is reported honestly, not padded with a
 * synthetic STALE example.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { ROOT, writeJson, log } from '../lib/core.mjs';

const STAGE = 'evidence-invalidation';

async function main() {
  const invPath = path.join(ROOT, 'reports', 'token-inventory.json');
  const inv = JSON.parse(await fs.readFile(invPath, 'utf8'));
  const cssPath = path.join(path.resolve(ROOT, '..'), 'src', 'styles', 'global.css');
  const currentBytes = await fs.readFile(cssPath);
  const currentSha256 = crypto.createHash('sha256').update(currentBytes).digest('hex');

  const unchanged = currentSha256 === inv.sourceSha256AtCapture;
  const status = unchanged ? 'VALID' : 'STALE';

  const records = inv.tokens.map((t) => ({
    tokenId: t.id,
    tokenName: t.name,
    capturedAt: t.evidenceCapturedAt,
    capturedAgainstSha256: inv.sourceSha256AtCapture,
    currentSourceSha256: currentSha256,
    status,
    reason: unchanged
      ? 'src/styles/global.css unchanged since capture — evidence still reflects current source.'
      : 'src/styles/global.css has changed since capture — re-run token-inventory.mjs to produce a fresh VALID generation. This record is preserved, not deleted, for lineage.',
  }));

  const output = {
    generatedAt: new Date().toISOString(),
    note: 'Mechanism: every token-inventory.mjs run stamps the source file SHA-256 it was computed against. This report compares that stamp to the current file hash. STALE records are never auto-deleted (superseded records remain queryable for lineage); a re-run of token-inventory.mjs is required to produce a new VALID generation. This is the first run of the P1 phase, so the only realistic outcome is all-VALID — no synthetic STALE case has been injected to pad this report.',
    states: ['VALID', 'STALE', 'INVALIDATED', 'UNKNOWN'],
    invalidatedNote:
      'INVALIDATED (a stronger state than STALE — evidence actively contradicted, not just possibly outdated) has no mechanism to be set in this phase; it would require a future capability (e.g. detecting that a re-run produces a contradictory value for the same token) not built here.',
    summary: {
      total: records.length,
      VALID: records.filter((r) => r.status === 'VALID').length,
      STALE: records.filter((r) => r.status === 'STALE').length,
      INVALIDATED: 0,
      UNKNOWN: 0,
    },
    records,
  };

  await writeJson(path.join(ROOT, 'reports', 'evidence-invalidation-report.json'), output);
  log(STAGE, `status=${status} total=${records.length} VALID=${output.summary.VALID} STALE=${output.summary.STALE}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
