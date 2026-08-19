/**
 * Backfills the content-addressed cache from the existing mirror.
 *
 * The Stage 2 mirror already recorded a verified SHA-256 per asset in
 * mirror-manifest.json. This migrates those already-fetched, already-hashed
 * bytes into cache/objects/sha256/<hash> rather than re-fetching them — safer
 * (no new network calls against a live, changing site) and faster.
 *
 * This does NOT replace mirror.mjs's existing files/ layout, which
 * mirror-server.mjs still serves from for Stages 3-16. It is an additive
 * projection of the same bytes into the content-addressed model.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { ARTIFACTS, ensureDir, readJson, writeJson, sha256, log } from '../lib/core.mjs';
import { OBJECTS_DIR, METADATA_DIR, INDEXES_DIR, verifyObject } from '../lib/cache.mjs';

const STAGE = 'cache-migrate';
const URL_INDEX_FILE = path.join(INDEXES_DIR, 'url-to-hash.json');

async function main() {
  const manifest = await readJson(path.join(ARTIFACTS, 'mirror', 'mirror-manifest.json'));
  await ensureDir(OBJECTS_DIR);
  await ensureDir(METADATA_DIR);
  await ensureDir(INDEXES_DIR);

  let urlIndex = {};
  try {
    urlIndex = await readJson(URL_INDEX_FILE);
  } catch {
    // first run
  }

  let migrated = 0;
  let skippedNoBody = 0;
  let alreadyPresent = 0;
  let hashMismatch = 0;

  for (const asset of manifest.assets) {
    if (!asset.localPath || !asset.sha256) {
      skippedNoBody += 1; // e.g. media/skipped entries with no downloaded body
      continue;
    }

    const localFile = path.join(ARTIFACTS, asset.localPath);
    if (!fsSync.existsSync(localFile)) {
      skippedNoBody += 1;
      continue;
    }

    const bytes = await fs.readFile(localFile);
    const recomputedHash = sha256(bytes);
    if (recomputedHash !== asset.sha256) {
      // The manifest's recorded hash disagrees with what's on disk now —
      // record this as a real finding, not a silent overwrite.
      hashMismatch += 1;
      log(STAGE, `HASH MISMATCH ${asset.url}: manifest=${asset.sha256} actual=${recomputedHash}`);
      continue;
    }

    const objectFile = path.join(OBJECTS_DIR, recomputedHash.slice(0, 2), recomputedHash);
    if (fsSync.existsSync(objectFile)) {
      alreadyPresent += 1;
    } else {
      await ensureDir(path.dirname(objectFile));
      await fs.writeFile(objectFile, bytes);
      migrated += 1;
    }

    const metadataFile = path.join(METADATA_DIR, `${recomputedHash}.json`);
    if (!fsSync.existsSync(metadataFile)) {
      await writeJson(metadataFile, {
        sha256: recomputedHash,
        size: bytes.length,
        mimeType: asset.contentType,
        retrievedAt: asset.retrievedAt,
        sourceURL: asset.url,
        finalURL: asset.url,
        httpStatus: asset.status,
        retrievalMethod: 'curl',
        tool: 'mirror.mjs',
        toolVersion: null,
        migratedFrom: 'mirror-manifest.json',
        migratedAt: new Date().toISOString(),
      });
    }

    const known = urlIndex[asset.url] || [];
    if (!known.includes(recomputedHash)) urlIndex[asset.url] = [...known, recomputedHash];
  }

  await writeJson(URL_INDEX_FILE, urlIndex);

  // Verify every migrated object round-trips correctly.
  let verifyOk = 0;
  let verifyFail = 0;
  for (const hashes of Object.values(urlIndex)) {
    for (const hash of hashes) {
      const v = await verifyObject(hash);
      if (v.exists && v.valid) verifyOk += 1;
      else verifyFail += 1;
    }
  }

  log(
    STAGE,
    `migrated=${migrated} alreadyPresent=${alreadyPresent} skippedNoBody=${skippedNoBody} hashMismatch=${hashMismatch}`
  );
  log(STAGE, `post-migration verify: ok=${verifyOk} fail=${verifyFail}`);
  log(STAGE, `distinct URLs indexed: ${Object.keys(urlIndex).length}`);

  if (verifyFail > 0 || hashMismatch > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
