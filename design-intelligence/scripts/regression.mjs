/**
 * Stage 15 — Smile Savers visual regression baselines.
 *
 * This is the OTHER half of GAP-20/GAP-21's fixture-vs-site split: strict
 * 0-pixel parity is reserved for admitted Labs fixtures (Stage 14). The real
 * Smile Savers production site instead gets COMMITTED baselines so that a
 * future change to this repository can be checked against "did the site
 * visually change", never against "does it match labs.google".
 *
 * Serves the ALREADY-BUILT `dist/` (produced by `npm run build`, run in Stage
 * 1) via a static file server — this stage does not rebuild the site, so a
 * baseline always reflects exactly what Stage 1 verified.
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

const STAGE = 'regression';
// ROOT is design-intelligence/ (see lib/core.mjs); the Astro repo is one level up.
const REPO_ROOT = path.resolve(ROOT, '..');
const DIST_DIR = path.join(REPO_ROOT, 'dist');
const BASELINE_DIR = path.join(ARTIFACTS, 'visual', 'site', 'baselines');
const PORT = 4420;

// A representative sample of routes, not every one of the 32 built pages:
// homepage (static), a content-collection detail page (services/[slug]),
// and a programmatic-SEO page ([service]/[neighborhood]) — one from each
// distinct rendering path in the codebase.
const ROUTES = ['/', '/services/', '/appointments/', '/contact/'];

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

function startStaticServer(root, port) {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file.endsWith('/')) file += 'index.html';
    let full = path.join(root, file);
    if (!full.startsWith(path.resolve(root))) return res.writeHead(403).end();
    if (!fs.existsSync(full)) return res.writeHead(404).end('not found');
    // A request path with no trailing slash (e.g. /services) can still
    // resolve to a directory; reading it as a stream throws EISDIR.
    if (fs.statSync(full).isDirectory()) full = path.join(full, 'index.html');
    if (!fs.existsSync(full)) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    const stream = fs.createReadStream(full);
    stream.on('error', () => res.writeHead(500).end());
    stream.pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () =>
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) })
    )
  );
}

async function main() {
  if (!fs.existsSync(DIST_DIR)) {
    throw new Error(
      `FATAL: ${DIST_DIR} does not exist. Run \`npm run build\` (Stage 1) before this stage.`
    );
  }
  const viewports = await readConfig('viewports');
  const server = await startStaticServer(DIST_DIR, PORT);
  const browser = await launchBrowser();
  await ensureDir(BASELINE_DIR);

  const baselines = [];
  try {
    for (const route of ROUTES) {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          ...CAPTURE_ENVIRONMENT,
        });
        const page = await context.newPage();
        const status = await page
          .goto(`${server.url}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
          .then((r) => r.status())
          .catch((e) => `ERROR:${e.message.slice(0, 80)}`);

        const safeRoute = route.replace(/\//g, '_') || '_root';
        const fileName = `${safeRoute}__${viewport.name}.png`;
        const filePath = path.join(BASELINE_DIR, fileName);

        let hash = null;
        if (status === 200) {
          await page.waitForTimeout(200); // let webfonts/images settle post-networkidle
          const buffer = await page.screenshot({ fullPage: true });
          fs.writeFileSync(filePath, buffer);
          hash = (await import('node:crypto')).createHash('sha256').update(buffer).digest('hex');
        }

        baselines.push({
          route,
          viewport: viewport.name,
          status,
          file: status === 200 ? path.relative(path.dirname(ARTIFACTS), filePath) : null,
          sha256: hash,
        });
        log(STAGE, `${route.padEnd(16)} ${viewport.name.padEnd(16)} status=${status}`);
        await context.close();
      }
    }

    const failed = baselines.filter((b) => b.status !== 200);
    const output = {
      ...runMetadata(STAGE),
      environment: environmentManifest(),
      note: 'Committed baselines for the LIVE Smile Savers site (from the already-built dist/), not for any labs.google comparison. A future run diffing new screenshots against these sha256 hashes is how production visual regression is detected; unexpected delta = NO-GO per Stage 15 rule.',
      routesChecked: ROUTES,
      counts: {
        total: baselines.length,
        succeeded: baselines.length - failed.length,
        failed: failed.length,
      },
      baselines,
    };
    output.canonicalHash = canonicalHash(
      baselines.map((b) => ({ route: b.route, viewport: b.viewport, sha256: b.sha256 }))
    );

    await writeJson(path.join(ARTIFACTS, 'visual', 'site', 'site-baselines.json'), output);

    log(STAGE, `succeeded=${output.counts.succeeded}/${output.counts.total}`);
    log(STAGE, `canonicalHash=${output.canonicalHash}`);

    if (failed.length) {
      log(STAGE, `WARNING: ${failed.length} route/viewport combination(s) failed to capture:`);
      for (const f of failed) log(STAGE, `  ${f.route} @ ${f.viewport}: ${f.status}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
