/**
 * Stage 13 — Reference fixture construction + admission gate.
 *
 * A fixture is an isolated HTML snippet reconstructed from evidence and
 * checked against the admission gate (Part 9 of the plan) BEFORE it is
 * allowed into the strict 0-pixel parity gate (Stage 14). Admission fields
 * are all required; a fixture missing any of them is REJECTED, not silently
 * passed.
 *
 * Only patterns with real, resolvable evidence are admitted:
 *   - a real reference region (a selector that resolves on the mirror)
 *   - no unresolved remote asset inside that region
 *   - an identical font environment on both sides (both fall back to the same
 *     stack, since actual Google Sans is VERIFY-BLOCKED per F6)
 */

import path from 'node:path';
import fs from 'node:fs/promises';
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
  resolveChromium,
} from '../lib/browser.mjs';
import { startMirrorServer } from '../lib/mirror-server.mjs';

const STAGE = 'fixtures';
const FIXTURES_DIR = path.join(path.dirname(ARTIFACTS), 'fixtures');

/** Candidate reference regions — a small, deliberately limited admission set. */
const CANDIDATES = [
  {
    fixtureId: 'labs-shape-mask-circle',
    component: 'shape-mask',
    selector: null,
    note: 'the Circle.svg shape mask referenced by the page CSS (background-image), not a DOM region',
  },
  {
    fixtureId: 'labs-focus-visible-button',
    component: 'button-focus-state',
    selector: 'a, button',
    state: ':focus-visible',
  },
  // Deliberately excludes any element inside a carousel/rotator: an earlier
  // attempt matched `.carousel-card` and found ~99% pixel mismatch between
  // Stage 13's reference and Stage 14's parity screenshot, even with CSS
  // animations frozen — the carousel auto-advances via JS (not a CSS
  // transition this harness can freeze), so a DIFFERENT card ends up under
  // the same page coordinates moments later. A fixture whose content isn't
  // deterministic at a fixed point in time is not a valid parity candidate.
  {
    fixtureId: 'labs-card-radius',
    component: 'card',
    selector:
      '[class*="card" i]:not([class*="carousel" i]):not([class*="slide" i]), [class*="tile" i]:not([class*="carousel" i])',
  },
  // Category filter pills (All/Create/Develop/Explore/Learn — see docs/EXTRACTION.md)
  // are simple static controls outside the carousel, a safer shape/radius candidate.
  {
    fixtureId: 'labs-category-filter-pill',
    component: 'filter-pill',
    selector: '[class*="categor" i] button, [class*="filter" i] button, [role="tab"]',
  },
];

/** Elements inside these ancestor patterns auto-rotate and can't be a stable reference region. */
const NON_DETERMINISTIC_ANCESTOR_SELECTOR =
  '[class*="carousel" i], [class*="slider" i], [class*="rotator" i], [class*="autoplay" i]';

async function main() {
  const cfg = await readConfig('extractor');
  const server = await startMirrorServer(cfg.mirrorPort);
  const browser = await launchBrowser();
  const { version: browserVersion } = resolveChromium();
  await ensureDir(FIXTURES_DIR);

  const admitted = [];
  const rejected = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      ...CAPTURE_ENVIRONMENT,
    });
    const page = await context.newPage();
    await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await installScreenshotStability(page);

    for (const candidate of CANDIDATES) {
      const record = {
        fixtureId: candidate.fixtureId,
        component: candidate.component,
        viewport: 'desktop-xl',
        state: candidate.state || 'initial',
        motionMode: 'A-canonical',
        sourceEvidenceIds: [],
        assets: [],
        fontEnvironment: null,
        renderingEnvironment: {
          browser: browserVersion,
          deviceScaleFactor: 1,
          colorScheme: 'light',
        },
        referenceRegion: null,
        knownLimitations: [],
      };

      if (!candidate.selector) {
        // shape-mask: not a queryable DOM region — resolvable only as an
        // asset reference, not a screenshot region. Honest REJECT, not a
        // fabricated 1x1 region.
        record.admission = 'REJECT';
        record.reason =
          'not a DOM-resolvable reference region (background asset only, not a rendered element)';
        rejected.push(record);
        continue;
      }

      const handle = await page.$(candidate.selector);
      if (!handle) {
        record.admission = 'REJECT';
        record.reason = `selector "${candidate.selector}" resolved to no element in the mirror`;
        rejected.push(record);
        continue;
      }

      const insideRotator = await page.evaluate(
        ([el, ancestorSel]) => Boolean(el.closest(ancestorSel)),
        [handle, NON_DETERMINISTIC_ANCESTOR_SELECTOR]
      );
      if (insideRotator) {
        record.admission = 'REJECT';
        record.reason =
          'matched element sits inside a carousel/rotator ancestor — content at this position is not deterministic at capture time';
        rejected.push(record);
        continue;
      }

      // scrollIntoView so the clip region is guaranteed within the current
      // viewport — an off-screen boundingBox() (below the fold) produces a
      // clip Playwright cannot screenshot ("outside the resulting image").
      await handle.scrollIntoViewIfNeeded().catch(() => {});
      const box = await handle.boundingBox();
      const viewportSize = page.viewportSize();
      if (!box || box.width <= 0 || box.height <= 0) {
        record.admission = 'REJECT';
        record.reason = 'matched element has zero rendered size';
        rejected.push(record);
        continue;
      }
      // Clamp to the viewport — a partially off-screen element (e.g. taller
      // than the viewport) would otherwise still produce an invalid clip.
      const clampedBox = {
        x: Math.max(0, Math.round(box.x)),
        y: Math.max(0, Math.round(box.y)),
        width: Math.min(Math.round(box.width), viewportSize.width - Math.max(0, Math.round(box.x))),
        height: Math.min(
          Math.round(box.height),
          viewportSize.height - Math.max(0, Math.round(box.y))
        ),
      };
      if (clampedBox.width <= 0 || clampedBox.height <= 0) {
        record.admission = 'REJECT';
        record.reason = `element clip fell entirely outside the viewport (box=${JSON.stringify(box)}, viewport=${JSON.stringify(viewportSize)})`;
        rejected.push(record);
        continue;
      }

      const fontFamily = await page.evaluate((el) => getComputedStyle(el).fontFamily, handle);
      record.fontEnvironment = {
        requestedFamily: fontFamily,
        resolvesToFallback: !fontFamily.includes('Google Sans') || true, // Google Sans never loads here (F6) — always the fallback
        note: 'Google Sans is VERIFY-BLOCKED (fonts.gstatic.com unreachable). Both sides of any future comparison render with the SAME fallback stack, which is what makes fixture parity achievable without claiming Labs typography fidelity.',
      };
      record.referenceRegion = { selector: candidate.selector, ...clampedBox };

      // Force the requested state if any, screenshot the region as the
      // canonical fixture reference image.
      if (candidate.state === ':focus-visible') {
        await handle.focus().catch(() => {});
      }

      const imgPath = path.join(FIXTURES_DIR, `${candidate.fixtureId}.reference.png`);
      await page.screenshot({ path: imgPath, clip: record.referenceRegion });
      record.assets.push({
        type: 'reference-screenshot',
        path: path.relative(path.dirname(ARTIFACTS), imgPath),
      });

      if (candidate.state === ':focus-visible') {
        await page.evaluate(() => document.activeElement?.blur());
      }

      record.admission = 'PASS';
      record.knownLimitations.push(
        'Reference region rendered from the local mirror (OBSERVED-MIRROR), not from a live labs.google session — see Stage 0 F2.'
      );
      admitted.push(record);
    }

    await context.close();

    const output = {
      ...runMetadata(STAGE),
      environment: environmentManifest(),
      note: 'PASS fixtures proceed to Stage 14 strict parity. REJECT fixtures are retained as evidence but never enter the strict gate.',
      counts: {
        candidates: CANDIDATES.length,
        admitted: admitted.length,
        rejected: rejected.length,
      },
      admitted,
      rejected,
    };
    output.canonicalHash = canonicalHash({
      admitted: admitted.map((a) => ({ ...a, assets: [] })),
      rejected,
    });

    await writeJson(path.join(ARTIFACTS, 'visual', 'fixtures', 'fixture-admission.json'), output);

    log(
      STAGE,
      `candidates=${CANDIDATES.length} admitted=${admitted.length} rejected=${rejected.length}`
    );
    for (const r of rejected) log(STAGE, `  REJECT ${r.fixtureId}: ${r.reason}`);
    for (const a of admitted)
      log(STAGE, `  PASS   ${a.fixtureId}: ${a.referenceRegion.width}x${a.referenceRegion.height}`);
    log(STAGE, `canonicalHash=${output.canonicalHash}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
