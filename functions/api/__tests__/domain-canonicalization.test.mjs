/**
 * Recurrence-prevention gate for ROOT-DOMAIN-001 (audit/eais/20260819T133000Z/
 * MASTER-ROOT-CAUSE-GRAPH.json): the domain was hardcoded as smilesavers.dental
 * in 7+ files before Wave 1 (commit cd7d6d7) centralized it. This is the
 * deterministic guard that stops it recurring silently -- run over the
 * actual source tree, not a fixed file list, so a newly-added file with the
 * same mistake is caught too.
 *
 * Run: node --test functions/api/__tests__/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));

// Split so this file's own strings (which have to name the pattern being
// searched for) don't match themselves when functions/ is scanned.
const STALE_DOMAIN_PATTERN = ['smilesavers', 'dental'].join('\\.') + '|smile-savers-site\\.pages\\.dev';

function grepStaleDomain(dir) {
  try {
    const out = execFileSync(
      'grep',
      ['-rl', '-E', '--exclude-dir=__tests__', STALE_DOMAIN_PATTERN, dir],
      { cwd: REPO_ROOT, encoding: 'utf8' }
    );
    return out.trim().split('\n').filter(Boolean);
  } catch (err) {
    if (err.status === 1) return []; // grep: no matches
    throw err;
  }
}

test('no stale domain literal (smilesavers.dental) in src/', () => {
  const hits = grepStaleDomain('src');
  assert.deepEqual(hits, [], `stale domain found in: ${hits.join(', ')}`);
});

test('no stale domain literal (smilesavers.dental) in functions/', () => {
  const hits = grepStaleDomain('functions');
  assert.deepEqual(hits, [], `stale domain found in: ${hits.join(', ')}`);
});

test('no stale domain literal (smilesavers.dental) in public/', () => {
  const hits = grepStaleDomain('public');
  assert.deepEqual(hits, [], `stale domain found in: ${hits.join(', ')}`);
});

test('wrangler.jsonc uses the canonical domain', () => {
  const hits = grepStaleDomain('wrangler.jsonc');
  assert.deepEqual(hits, []);
});
