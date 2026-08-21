/**
 * Cache statistics, integrity verification, and reachability-based GC.
 *
 * Usage: node scripts/cache-report.mjs [stats|verify|gc|gc-dry-run]
 * Defaults to `stats` if no argument given.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { ARTIFACTS, writeJson, readJson, log } from '../lib/core.mjs';
import { stats, garbageCollect, verifyObject, INDEXES_DIR, OBJECTS_DIR } from '../lib/cache.mjs';

const STAGE = 'cache-report';
const mode = process.argv[2] || 'stats';

async function runStats() {
  const s = await stats();
  log(
    STAGE,
    `objects=${s.objectCount} totalBytes=${s.totalBytes} (${(s.totalBytes / 1024 / 1024).toFixed(2)}MB) urls=${s.urlCount} crossUrlDeduped=${s.crossUrlDedupedObjects} revalidationsNoChange=${s.urlRevalidationsWithNoChange}`
  );
  log(STAGE, `largest objects:`);
  for (const o of s.largestObjects.slice(0, 5))
    log(STAGE, `  ${o.hash.slice(0, 12)}...  ${(o.size / 1024).toFixed(1)}KB`);
  await writeJson(path.join(ARTIFACTS, 'reports', 'CACHE-REPORT.json'), {
    generatedAt: new Date().toISOString(),
    ...s,
  });
}

async function runVerify() {
  const urlIndex = await readJson(path.join(INDEXES_DIR, 'url-to-hash.json')).catch(() => ({}));
  const results = [];
  const indexedHashes = new Set();
  for (const [url, hashes] of Object.entries(urlIndex)) {
    for (const hash of hashes) {
      indexedHashes.add(hash);
      const v = await verifyObject(hash);
      results.push({ url, hash, exists: v.exists, valid: v.valid });
    }
  }

  // Also walk the raw objects directory directly. Index-only verification
  // (above) cannot see an object that exists on disk but was never recorded
  // in the URL index (e.g. a partially-completed index write, or an object
  // written by a path that bypassed resolve()) — that object would silently
  // never be checked. Directory-walk verification catches it as an orphan.
  const orphans = [];
  const shards = await fs.readdir(OBJECTS_DIR).catch(() => []);
  for (const shard of shards) {
    const shardDir = path.join(OBJECTS_DIR, shard);
    const files = await fs.readdir(shardDir).catch(() => []);
    for (const hash of files) {
      if (indexedHashes.has(hash)) continue;
      const v = await verifyObject(hash);
      orphans.push({
        hash,
        exists: v.exists,
        valid: v.valid,
        note: 'present on disk but not referenced by any URL in the index',
      });
    }
  }

  const corrupt = [...results, ...orphans].filter((r) => r.exists && !r.valid);
  const missing = results.filter((r) => !r.exists);
  log(
    STAGE,
    `verified=${results.length} orphansFound=${orphans.length} corrupt=${corrupt.length} missing=${missing.length}`
  );
  for (const c of corrupt) log(STAGE, `  CACHE_CORRUPTION: ${c.url || '(orphan)'} (${c.hash})`);
  for (const m of missing) log(STAGE, `  MISSING: ${m.url} (${m.hash})`);
  for (const o of orphans) log(STAGE, `  ORPHAN: ${o.hash} valid=${o.valid}`);
  await writeJson(path.join(ARTIFACTS, 'reports', 'CACHE-INTEGRITY.json'), {
    generatedAt: new Date().toISOString(),
    totalChecked: results.length,
    orphansFound: orphans.length,
    orphans,
    corrupt,
    missing,
    status: corrupt.length === 0 && missing.length === 0 ? 'CLEAN' : 'ISSUES_FOUND',
  });
  if (corrupt.length || missing.length) process.exitCode = 1;
}

async function runGc(dryRun) {
  // Reachability includes everything the URL index points to (garbageCollect
  // does this internally) plus nothing else yet — evidence/manifest
  // cross-references from other stages are a future extension, noted as a
  // known gap rather than silently assumed complete.
  const result = await garbageCollect({ dryRun });
  log(
    STAGE,
    `reachable=${result.reachableCount} ${dryRun ? 'wouldDelete' : 'deleted'}=${result.deletedCount}`
  );
  await writeJson(path.join(ARTIFACTS, 'reports', 'CACHE-GC.json'), {
    generatedAt: new Date().toISOString(),
    ...result,
  });
}

async function main() {
  if (mode === 'stats') await runStats();
  else if (mode === 'verify') await runVerify();
  else if (mode === 'gc') await runGc(false);
  else if (mode === 'gc-dry-run') await runGc(true);
  else throw new Error(`Unknown mode "${mode}". Use: stats | verify | gc | gc-dry-run`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
