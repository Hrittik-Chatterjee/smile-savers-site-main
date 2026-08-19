/**
 * Stage 14 — Strict fixture parity.
 *
 * Runs ONLY against fixtures Stage 13 admitted (admission: "PASS"). Rejected
 * fixtures never reach this gate, per Part 9 of the plan. For each admitted
 * fixture, re-screenshots the SAME reference region from the SAME mirror
 * render a second time and diffs it byte-for-byte against Stage 13's saved
 * reference PNG using pixelmatch.
 *
 * This measures CONTROLLED REFERENCE-FIXTURE PARITY — reproducibility of the
 * capture itself under identical, controlled conditions — never "Google Labs
 * pixel parity" and never a claim about the live labs.google site, which this
 * environment cannot reach (Stage 0, F2).
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import {
  ARTIFACTS,
  ensureDir,
  writeJson,
  readJson,
  readConfig,
  canonicalHash,
  runMetadata,
  log,
} from '../lib/core.mjs';
import {
  launchBrowser,
  CAPTURE_ENVIRONMENT,
  environmentManifest,
  installScreenshotStability,
} from '../lib/browser.mjs';
import { startMirrorServer } from '../lib/mirror-server.mjs';

const STAGE = 'parity';
const FIXTURES_DIR = path.join(path.dirname(ARTIFACTS), 'fixtures');
const DIFF_DIR = path.join(ARTIFACTS, 'visual', 'diffs');

async function main() {
  const cfg = await readConfig('extractor');
  const admission = await readJson(
    path.join(ARTIFACTS, 'visual', 'fixtures', 'fixture-admission.json')
  );
  const admitted = admission.admitted;

  if (!admitted.length) {
    log(STAGE, 'no admitted fixtures — nothing to diff');
    await writeJson(path.join(ARTIFACTS, 'visual', 'diffs', 'parity-results.json'), {
      ...runMetadata(STAGE),
      note: 'No admitted fixtures at Stage 13; strict parity gate has nothing to check.',
      results: [],
    });
    return;
  }

  await ensureDir(DIFF_DIR);
  const server = await startMirrorServer(cfg.mirrorPort);
  const browser = await launchBrowser();

  const results = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      ...CAPTURE_ENVIRONMENT,
    });
    const page = await context.newPage();
    await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await installScreenshotStability(page);

    for (const fixture of admitted) {
      const referencePngPath = path.join(FIXTURES_DIR, `${fixture.fixtureId}.reference.png`);
      if (!fsSync.existsSync(referencePngPath)) {
        results.push({
          fixtureId: fixture.fixtureId,
          status: 'ERROR',
          reason: 'reference PNG from Stage 13 not found on disk',
        });
        continue;
      }

      if (fixture.state === ':focus-visible') {
        const handle = await page.$(fixture.referenceRegion.selector);
        await handle?.focus().catch(() => {});
      }

      const actualBuffer = await page.screenshot({ clip: fixture.referenceRegion });

      if (fixture.state === ':focus-visible') {
        await page.evaluate(() => document.activeElement?.blur());
      }

      const referenceBuffer = await fs.readFile(referencePngPath);
      const refPng = PNG.sync.read(referenceBuffer);
      const actualPng = PNG.sync.read(actualBuffer);

      if (refPng.width !== actualPng.width || refPng.height !== actualPng.height) {
        results.push({
          fixtureId: fixture.fixtureId,
          status: 'FAIL',
          reason: `dimension mismatch: reference ${refPng.width}x${refPng.height} vs actual ${actualPng.width}x${actualPng.height}`,
          mismatchedPixels: null,
          differenceRatio: null,
        });
        continue;
      }

      const diffPng = new PNG({ width: refPng.width, height: refPng.height });
      const mismatchedPixels = pixelmatch(
        refPng.data,
        actualPng.data,
        diffPng.data,
        refPng.width,
        refPng.height,
        { threshold: cfg.diff.fixtureParity.threshold, includeAA: cfg.diff.fixtureParity.includeAA }
      );
      const differenceRatio = mismatchedPixels / (refPng.width * refPng.height);
      const pass =
        mismatchedPixels === cfg.diff.fixtureParity.maxDifferentPixels &&
        differenceRatio === cfg.diff.fixtureParity.maxDifferentRatio;

      const diffPath = path.join(DIFF_DIR, `${fixture.fixtureId}.diff.png`);
      await fs.writeFile(diffPath, PNG.sync.write(diffPng));

      results.push({
        fixtureId: fixture.fixtureId,
        status: pass ? 'PASS' : 'FAIL',
        claim:
          'CONTROLLED REFERENCE-FIXTURE PARITY (not Google Labs pixel parity, not a live labs.google comparison)',
        mismatchedPixels,
        differenceRatio,
        dimensions: { width: refPng.width, height: refPng.height },
        diffArtifact: path.relative(path.dirname(ARTIFACTS), diffPath),
      });
      log(
        STAGE,
        `${fixture.fixtureId.padEnd(28)} ${pass ? 'PASS' : 'FAIL'} mismatched=${mismatchedPixels} ratio=${differenceRatio}`
      );
    }

    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }

  const passed = results.filter((r) => r.status === 'PASS');
  const output = {
    ...runMetadata(STAGE),
    environment: environmentManifest(),
    note: 'Strict 0-pixel parity applies to these admitted fixtures ONLY. This is CONTROLLED REFERENCE-FIXTURE PARITY: the fixture is diffed against a second screenshot of the SAME local mirror region, proving the capture is reproducible under controlled conditions — it is NOT a claim about labs.google itself (unreachable in this environment, Stage 0 F2) and NOT a claim that the Smile Savers site matches Labs.',
    counts: {
      total: results.length,
      passed: passed.length,
      failed: results.length - passed.length,
    },
    results,
  };
  output.canonicalHash = canonicalHash(
    results.map((r) => ({
      fixtureId: r.fixtureId,
      status: r.status,
      mismatchedPixels: r.mismatchedPixels,
    }))
  );

  await writeJson(path.join(ARTIFACTS, 'visual', 'diffs', 'parity-results.json'), output);

  log(STAGE, `passed=${passed.length}/${results.length}`);
  log(STAGE, `canonicalHash=${output.canonicalHash}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
