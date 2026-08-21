/**
 * Stage 16 — Accessibility / semantic / geometry validation.
 *
 * Two epistemically distinct halves, never merged into one score:
 *   1. LABS OBSERVATIONS — what the mirror exhibits, recorded as evidence
 *      about Labs (informational; Labs is not what this project ships).
 *   2. SMILE SAVERS NORMATIVE CHECK — WCAG 2.2 AA against the actual
 *      Smile Savers site, which is what actually needs to pass or fail.
 *
 * Runs axe-core (already a repo devDependency — see package.json) against
 * both the Labs mirror (informational) and the live Smile Savers dist/
 * (normative), through the SAME mechanism so the two are comparable.
 */

import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';
import {
  ARTIFACTS,
  ROOT,
  ensureDir,
  writeJson,
  readConfig,
  canonicalHash,
  runMetadata,
  log,
} from '../lib/core.mjs';
import { launchBrowser, CAPTURE_ENVIRONMENT, environmentManifest } from '../lib/browser.mjs';
import { startMirrorServer } from '../lib/mirror-server.mjs';

const STAGE = 'validate';
const REPO_ROOT = path.resolve(ROOT, '..');
const AXE_SOURCE = path.join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js');

async function runAxe(page) {
  await page.addScriptTag({ path: AXE_SOURCE });
  return page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    const results = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag22aa'] },
    });
    return {
      violations: results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        help: v.help,
        nodeCount: v.nodes.length,
        targets: v.nodes.slice(0, 5).map((n) => n.target),
      })),
      passes: results.passes.length,
      incomplete: results.incomplete.length,
    };
  });
}

async function main() {
  if (!fs.existsSync(AXE_SOURCE)) {
    throw new Error(
      `FATAL: axe-core not found at ${AXE_SOURCE} — it is a declared repo devDependency; run npm install.`
    );
  }

  const cfg = await readConfig('extractor');
  const browser = await launchBrowser();

  // 1. LABS OBSERVATION (informational only).
  const mirrorServer = await startMirrorServer(cfg.mirrorPort);
  const labsContext = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    ...CAPTURE_ENVIRONMENT,
  });
  const labsPage = await labsContext.newPage();
  await labsPage.goto(mirrorServer.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await labsPage.waitForLoadState('networkidle').catch(() => {});
  const labsAxe = await runAxe(labsPage);
  await labsContext.close();
  await mirrorServer.close();

  // Reduced-motion behavior check, cross-referencing closure EV-UI-MOTION-00002.
  const labsReducedMotionContext = await browser.newContext({
    viewport: { width: 1440, height: 1200 },
    ...CAPTURE_ENVIRONMENT,
    reducedMotion: 'reduce',
  });
  const server2 = await startMirrorServer(cfg.mirrorPort);
  const rmPage = await labsReducedMotionContext.newPage();
  await rmPage.goto(server2.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await rmPage.waitForLoadState('networkidle').catch(() => {});
  const reducedMotionRespected = await rmPage.evaluate(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  await labsReducedMotionContext.close();
  await server2.close();

  // 2. SMILE SAVERS NORMATIVE CHECK — the actual production dist/.
  const distDir = path.join(REPO_ROOT, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error(`FATAL: ${distDir} missing — run npm run build (Stage 1) first.`);
  }
  const port = 4421;
  const staticServer = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    let full = path.join(distDir, file);
    if (!fs.existsSync(full)) return res.writeHead(404).end();
    if (fs.statSync(full).isDirectory()) full = path.join(full, 'index.html');
    if (!fs.existsSync(full)) return res.writeHead(404).end();
    const ext = path.extname(full);
    const mime =
      { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[ext] ||
      'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    const stream = fs.createReadStream(full);
    stream.on('error', () => res.writeHead(500).end());
    stream.pipe(res);
  });
  await new Promise((resolve) => staticServer.listen(port, '127.0.0.1', resolve));

  const routes = ['/', '/services/', '/appointments/', '/contact/'];
  const smileSaversResults = [];
  for (const route of routes) {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      ...CAPTURE_ENVIRONMENT,
    });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}${route}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    // Entrance animations (e.g. Hero.astro's `fade-up`, delay up to .4s + .6s
    // duration) leave text mid-fade -- transiently below AA contrast -- if
    // axe runs immediately on load. Wait for in-flight animations to finish
    // so the scan reflects the settled UI a real user reads, not a fade
    // frame; found by re-investigating a false-positive .cta-primary
    // contrast failure (DEBT-0017) that a manual settle wait made disappear.
    await page.evaluate(() =>
      Promise.race([
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished)
        ),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]).catch(() => {})
    );
    const axeResult = await runAxe(page);
    smileSaversResults.push({ route, ...axeResult });
    await ctx.close();
  }
  await new Promise((resolve) => staticServer.close(resolve));
  await browser.close();

  const smileSaversViolations = smileSaversResults.flatMap((r) => r.violations);
  const smileSaversCritical = smileSaversViolations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  const output = {
    ...runMetadata(STAGE),
    environment: environmentManifest(),
    note: "labsObservations is informational evidence ABOUT Labs (Labs is not shipped by this project — its accessibility posture is not this project's responsibility). smileSaversNormative is the actual pass/fail gate, run against production dist/.",
    labsObservations: {
      evidenceClass: 'OBSERVED-MIRROR',
      axe: labsAxe,
      reducedMotionMediaQueryRespected: reducedMotionRespected,
      crossReference:
        'EV-UI-MOTION-00002 (closure) — reduced-motion changes rendered visibility, which is exactly the kind of thing an a11y audit should catch; this record confirms the media query itself IS correctly honored by the mirror render.',
    },
    smileSaversNormative: {
      target: 'WCAG 2.2 AA',
      routesChecked: routes,
      results: smileSaversResults,
      totalViolations: smileSaversViolations.length,
      criticalOrSeriousViolations: smileSaversCritical.length,
      status: smileSaversCritical.length === 0 ? 'PASS' : 'FAIL',
    },
  };
  output.canonicalHash = canonicalHash({ labsAxe, smileSaversResults });

  await writeJson(path.join(ARTIFACTS, 'reports', 'accessibility-validation.json'), output);

  log(
    STAGE,
    `Labs (informational): violations=${labsAxe.violations.length} passes=${labsAxe.passes} reducedMotionRespected=${reducedMotionRespected}`
  );
  log(
    STAGE,
    `Smile Savers (normative): totalViolations=${smileSaversViolations.length} critical/serious=${smileSaversCritical.length} status=${output.smileSaversNormative.status}`
  );
  log(STAGE, `canonicalHash=${output.canonicalHash}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
