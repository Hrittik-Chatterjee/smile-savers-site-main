/**
 * Content-addressed local cache.
 *
 * Identity is SHA-256(bytes), never the URL or filename. Two different URLs
 * serving the same bytes resolve to ONE object; the URL is recorded as a
 * pointer INTO the cache, not the cache key itself. This is what makes the
 * cache survive labs.google changing or disappearing: the bytes that were
 * actually used to produce today's evidence stay addressable by their hash
 * regardless of what any URL now returns.
 *
 * Layout:
 *   cache/objects/sha256/<first 2 hex chars>/<full hash>   -- raw bytes, immutable
 *   cache/metadata/<hash>.json                              -- retrieval record
 *   cache/indexes/url-to-hash.json                          -- URL -> [hashes seen over time]
 *   cache/manifests/<run-id>.json                            -- what a pipeline run actually touched
 *
 * Every read verifies the hash. A mismatch is CACHE_CORRUPTION, never silently
 * repaired — see verifyObject().
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { ROOT, ensureDir, sha256, writeJson, readJson, log } from './core.mjs';
import { fetchAsset } from './core.mjs';

const CACHE_ROOT = path.join(ROOT, 'cache');
const OBJECTS_DIR = path.join(CACHE_ROOT, 'objects', 'sha256');
const METADATA_DIR = path.join(CACHE_ROOT, 'metadata');
const INDEXES_DIR = path.join(CACHE_ROOT, 'indexes');
const MANIFESTS_DIR = path.join(CACHE_ROOT, 'manifests');
const URL_INDEX_FILE = path.join(INDEXES_DIR, 'url-to-hash.json');

/** Freshness modes. See docstrings inline for what each actually does. */
export const FRESHNESS_MODES = Object.freeze({
  ONLINE_FRESH: 'ONLINE_FRESH', // always fetch, ignore cache for the read (still writes through)
  ONLINE_REVALIDATE: 'ONLINE_REVALIDATE', // fetch; if bytes match cache, no new object written
  CACHE_PREFERRED: 'CACHE_PREFERRED', // use cache if present, else fetch
  CACHE_ONLY: 'CACHE_ONLY', // never touch network; missing = VERIFY-BLOCKED
  OFFLINE_REPRODUCTION: 'CACHE_ONLY', // alias — explicit intent, same behavior
});

function objectPath(hash) {
  return path.join(OBJECTS_DIR, hash.slice(0, 2), hash);
}

async function loadUrlIndex() {
  try {
    return await readJson(URL_INDEX_FILE);
  } catch {
    return {};
  }
}

async function saveUrlIndex(index) {
  await writeJson(URL_INDEX_FILE, index);
}

/** Recompute an object's hash from disk and compare to its filename. */
export async function verifyObject(hash) {
  const file = objectPath(hash);
  if (!fsSync.existsSync(file)) return { exists: false, valid: null };
  const bytes = await fs.readFile(file);
  const actual = sha256(bytes);
  return { exists: true, valid: actual === hash, actualHash: actual, size: bytes.length };
}

/**
 * Resolve a URL through the cache according to `mode`. Returns:
 *   { status, hash, bytes, metadata }
 * where status is one of CACHE_HIT / CACHE_MISS / CACHE_INVALID / CACHE_PINNED
 * / NETWORK_ACCESS_ATTEMPTED / VERIFY-BLOCKED.
 *
 * `bytes` is null when status is VERIFY-BLOCKED (CACHE_ONLY with nothing
 * cached) — callers MUST check status before touching bytes.
 */
export async function resolve(
  url,
  {
    mode = FRESHNESS_MODES.CACHE_PREFERRED,
    sessionId,
    stageId,
    tool,
    toolVersion,
    fetchOptions = {},
  } = {}
) {
  await ensureDir(OBJECTS_DIR);
  await ensureDir(METADATA_DIR);
  await ensureDir(INDEXES_DIR);

  const urlIndex = await loadUrlIndex();
  const knownHashes = urlIndex[url] || [];
  const lastKnownHash = knownHashes[knownHashes.length - 1] || null;

  const useCacheFirst =
    mode === FRESHNESS_MODES.CACHE_PREFERRED || mode === FRESHNESS_MODES.CACHE_ONLY;

  if (useCacheFirst && lastKnownHash) {
    const verification = await verifyObject(lastKnownHash);
    if (verification.exists && verification.valid) {
      const metadata = await readJson(path.join(METADATA_DIR, `${lastKnownHash}.json`)).catch(
        () => null
      );
      return {
        status: 'CACHE_HIT',
        hash: lastKnownHash,
        bytes: await fs.readFile(objectPath(lastKnownHash)),
        metadata,
      };
    }
    if (verification.exists && !verification.valid) {
      log(
        'cache',
        `CACHE_CORRUPTION detected for ${lastKnownHash} (url=${url}) — recomputed hash does not match filename`
      );
      if (mode === FRESHNESS_MODES.CACHE_ONLY) {
        return { status: 'CACHE_CORRUPTION', hash: lastKnownHash, bytes: null, metadata: null };
      }
      // Falls through to fetch in non-CACHE_ONLY modes — a corrupted object
      // is never silently "repaired" in place; a fresh fetch creates a NEW
      // object under its own (verified) hash instead.
    }
  }

  if (mode === FRESHNESS_MODES.CACHE_ONLY) {
    return {
      status: 'VERIFY-BLOCKED',
      hash: null,
      bytes: null,
      metadata: null,
      reason: 'no valid cached object and CACHE_ONLY forbids network access',
    };
  }

  // Fetch path.
  const response = await fetchAsset(url, fetchOptions);
  if (!response.ok) {
    return {
      status: 'NETWORK_ACCESS_ATTEMPTED',
      hash: null,
      bytes: null,
      metadata: null,
      httpStatus: response.status,
      error: response.error,
    };
  }

  const hash = sha256(response.body);
  const isNewObject = !fsSync.existsSync(objectPath(hash));

  if (isNewObject) {
    await ensureDir(path.dirname(objectPath(hash)));
    await fs.writeFile(objectPath(hash), response.body);
  }

  const metadata = {
    sha256: hash,
    size: response.body.length,
    mimeType: response.contentType || null,
    retrievedAt: new Date().toISOString(),
    sourceURL: url,
    finalURL: response.effectiveUrl || url,
    httpStatus: response.status,
    retrievalMethod: 'curl',
    tool: tool || 'cache.resolve',
    toolVersion: toolVersion || null,
    sessionId: sessionId || null,
    stageId: stageId || null,
  };
  await writeJson(path.join(METADATA_DIR, `${hash}.json`), metadata);

  if (!knownHashes.includes(hash)) {
    urlIndex[url] = [...knownHashes, hash];
    await saveUrlIndex(urlIndex);
  }

  const driftDetected = lastKnownHash && lastKnownHash !== hash;
  return {
    status: isNewObject ? 'CACHE_MISS' : 'ONLINE_REVALIDATE_MATCH',
    hash,
    bytes: response.body,
    metadata,
    sourceDrift: driftDetected ? { previousHash: lastKnownHash, newHash: hash } : null,
  };
}

/** Write a manifest of everything a pipeline run actually touched in the cache. */
export async function writeRunManifest(runId, entries) {
  await ensureDir(MANIFESTS_DIR);
  const manifest = {
    runId,
    generatedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries,
  };
  await writeJson(path.join(MANIFESTS_DIR, `${runId}.json`), manifest);
  return manifest;
}

/** Cache-wide statistics — objects, bytes, dedup ratio, largest objects. */
export async function stats() {
  await ensureDir(OBJECTS_DIR);
  const shards = await fs.readdir(OBJECTS_DIR).catch(() => []);
  let objectCount = 0;
  let totalBytes = 0;
  const sizes = [];
  for (const shard of shards) {
    const shardDir = path.join(OBJECTS_DIR, shard);
    const files = await fs.readdir(shardDir).catch(() => []);
    for (const file of files) {
      const stat = await fs.stat(path.join(shardDir, file));
      objectCount += 1;
      totalBytes += stat.size;
      sizes.push({ hash: file, size: stat.size });
    }
  }
  const urlIndex = await loadUrlIndex();
  const urlCount = Object.keys(urlIndex).length;
  // "Deduped" here means URL-level history: how many times a URL was
  // re-fetched and produced a hash already seen for THAT url (i.e. drift
  // checks that found no change). Cross-URL dedup (two different URLs
  // resolving to the same object) is tracked separately below.
  const totalUrlObservations = Object.values(urlIndex).reduce(
    (sum, hashes) => sum + hashes.length,
    0
  );
  const distinctHashesAcrossAllUrls = new Set(Object.values(urlIndex).flat()).size;
  sizes.sort((a, b) => b.size - a.size);
  return {
    objectCount,
    totalBytes,
    urlCount,
    urlRevalidationObservations: totalUrlObservations,
    urlRevalidationsWithNoChange: Math.max(0, totalUrlObservations - distinctHashesAcrossAllUrls),
    crossUrlDedupedObjects: Math.max(
      0,
      distinctHashesAcrossAllUrls > 0 ? urlCount - distinctHashesAcrossAllUrls : 0
    ),
    largestObjects: sizes.slice(0, 10),
  };
}

/**
 * Reachability-based GC: an object is reachable if referenced by at least one
 * URL-index entry OR passed in `additionalReachable` (evidence/manifest refs
 * from outside this module). Never deletes by age alone.
 */
export async function garbageCollect({ additionalReachable = new Set(), dryRun = true } = {}) {
  const urlIndex = await loadUrlIndex();
  const reachable = new Set(additionalReachable);
  for (const hashes of Object.values(urlIndex)) for (const h of hashes) reachable.add(h);

  await ensureDir(OBJECTS_DIR);
  const shards = await fs.readdir(OBJECTS_DIR).catch(() => []);
  const toDelete = [];
  for (const shard of shards) {
    const shardDir = path.join(OBJECTS_DIR, shard);
    const files = await fs.readdir(shardDir).catch(() => []);
    for (const file of files) {
      if (!reachable.has(file)) toDelete.push(path.join(shardDir, file));
    }
  }

  if (!dryRun) {
    for (const file of toDelete) await fs.unlink(file).catch(() => {});
  }

  return {
    reachableCount: reachable.size,
    deletedCount: toDelete.length,
    deleted: dryRun ? [] : toDelete,
    dryRun,
  };
}

export { CACHE_ROOT, OBJECTS_DIR, METADATA_DIR, INDEXES_DIR, MANIFESTS_DIR };
