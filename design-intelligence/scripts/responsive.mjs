/**
 * Stage 6 — Responsive extraction.
 *
 * A viewport we happen to screenshot is an OBSERVATION POINT, never a
 * breakpoint. The 6 config viewports (1440/1280/1024/768/430/390) are sampling
 * choices made by this harness; the 9 breakpoints in Stage 3's cssom.json
 * (400/768/1024/1366/1920/2000px) are what Google's CSS actually declares.
 * This stage never conflates the two: it walks across the REAL breakpoints,
 * rendering the page at (breakpoint-1px) and (breakpoint+1px) to observe the
 * actual before/after transition, regardless of which of the 6 sample
 * viewports that threshold happens to fall near.
 */

import path from 'node:path';
import {
  ARTIFACTS,
  writeJson,
  readJson,
  readConfig,
  canonicalHash,
  runMetadata,
  log,
} from '../lib/core.mjs';
import { launchBrowser, CAPTURE_ENVIRONMENT, environmentManifest } from '../lib/browser.mjs';
import { startMirrorServer } from '../lib/mirror-server.mjs';

const STAGE = 'responsive';

/** Structural signals worth diffing across a breakpoint transition. */
async function snapshotStructure(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav, [role="navigation"], header');

    // Labs is an Angular SPA: <body> only ever contains <script>/<noscript>/
    // <app-root>, so document.body's direct children are never real content —
    // diffing them against a naive `main || body` fallback silently measures
    // nothing (confirmed: 0/8 breakpoints showed any change against that
    // fallback). Real content lives several single-child wrapper elements
    // (<app-root>, <router-outlet>, <app-home>) below body, so descend through
    // wrappers with at most one RENDERED child (zero-size elements like an
    // empty <router-outlet> don't count) until reaching the first element with
    // two or more rendered children — that is the real content root.
    const renderedChildren = (el) =>
      Array.from(el.children).filter((c) => {
        const r = c.getBoundingClientRect();
        return r.width > 0 || r.height > 0 || c.children.length > 0;
      });
    let root = document.querySelector('app-root') || document.body;
    for (let i = 0; i < 8; i += 1) {
      const kids = renderedChildren(root);
      if (kids.length !== 1) break;
      root = kids[0];
    }
    const main = renderedChildren(root).length >= 2 ? root : document.body;

    const computedOf = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        display: s.display,
        flexDirection: s.flexDirection,
        gridTemplateColumns: s.gridTemplateColumns,
        visibility: s.visibility,
      };
    };

    // Sample content containers up to 2 levels deep, not just main's direct
    // children: a section wrapper (e.g. category-section) frequently keeps a
    // stable `display:block` across a breakpoint while a GRID INSIDE IT
    // reflows column count — sampling only depth 1 measured that wrapper and
    // silently missed the actual responsive change happening one level down.
    const collect = (el, depth, path_) => {
      if (!el || depth > 2) return [];
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const self = {
        path: path_,
        depth,
        tag: el.tagName.toLowerCase(),
        classes: Array.from(el.classList).slice(0, 3),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        display: style.display,
        gridTemplateColumns: style.gridTemplateColumns,
        flexDirection: style.flexDirection,
        fontSize: style.fontSize,
        visible: rect.width > 0 && rect.height > 0 && style.display !== 'none',
      };
      const childResults = Array.from(el.children)
        .slice(0, 12)
        .flatMap((child, i) => collect(child, depth + 1, `${path_}>${i}`));
      return [self, ...childResults];
    };
    const containerSnapshot = Array.from(main.children)
      .slice(0, 15)
      .flatMap((el, i) => collect(el, 0, `${i}`));

    return {
      navComputed: computedOf(nav),
      documentScrollWidth: document.documentElement.scrollWidth,
      documentScrollHeight: document.documentElement.scrollHeight,
      containers: containerSnapshot,
    };
  });
}

function diffStructure(before, after) {
  const changes = [];
  if (JSON.stringify(before.navComputed) !== JSON.stringify(after.navComputed)) {
    changes.push({ area: 'navigation', from: before.navComputed, to: after.navComputed });
  }

  // Key on the tree PATH ("2>0>1"), not array index — the flattened list
  // mixes multiple depths, so a plain index no longer identifies "the same
  // element" once tree shape differs between the two renders.
  const beforeByPath = new Map(before.containers.map((c) => [c.path, c]));
  const afterByPath = new Map(after.containers.map((c) => [c.path, c]));
  const allPaths = new Set([...beforeByPath.keys(), ...afterByPath.keys()]);

  for (const p of allPaths) {
    const b = beforeByPath.get(p);
    const a = afterByPath.get(p);
    if (!b || !a) {
      changes.push({
        area: `container[${p}]`,
        from: b || null,
        to: a || null,
        note: 'element present at only one width',
      });
      continue;
    }
    const fields = ['display', 'gridTemplateColumns', 'flexDirection', 'visible'];
    const changed = fields.filter((f) => b[f] !== a[f]);
    if (changed.length) {
      changes.push({
        area: `container[${p}] <${b.tag}${b.classes.length ? '.' + b.classes.join('.') : ''}>`,
        from: Object.fromEntries(changed.map((f) => [f, b[f]])),
        to: Object.fromEntries(changed.map((f) => [f, a[f]])),
      });
    }
    // Large relative width swing signals a real reflow, not sub-pixel jitter.
    if (b.width > 0 && Math.abs(a.width - b.width) / b.width > 0.15) {
      changes.push({ area: `container[${p}] width`, from: b.width, to: a.width });
    }
  }
  return changes;
}

async function main() {
  const cfg = await readConfig('extractor');
  const configViewports = await readConfig('viewports');
  const cssom = await readJson(path.join(ARTIFACTS, 'evidence', 'source', 'cssom.json'));

  // Real breakpoints, from Stage 3 evidence — not from the sample viewport
  // list. Width axis only: height breakpoints (max-height:600px) describe a
  // short-viewport landscape case, not a horizontal layout transition.
  const widthBreakpoints = cssom.breakpoints
    .filter((b) => b.axis === 'width')
    .sort((a, b) => a.px - b.px);

  log(
    STAGE,
    `real width breakpoints from Stage 3 evidence: ${widthBreakpoints.map((b) => b.px).join(', ')}`
  );
  log(
    STAGE,
    `config sample viewports (NOT breakpoints): ${configViewports.map((v) => v.width).join(', ')}`
  );

  const server = await startMirrorServer(cfg.mirrorPort);
  const browser = await launchBrowser();

  const transitions = [];
  try {
    for (const bp of widthBreakpoints) {
      const below = Math.max(320, Math.round(bp.px) - 1);
      const above = Math.round(bp.px) + 1;
      // A breakpoint cannot be verified if the viewport window it needs
      // collapses to nothing (below >= above at very small px values).
      if (below >= above) {
        transitions.push({
          breakpointPx: bp.px,
          raws: bp.raws,
          evidenceClass: 'VERIFY-BLOCKED',
          reason: 'breakpoint too small to bracket with a 1px window',
        });
        continue;
      }

      const context = await browser.newContext({
        viewport: { width: below, height: 1000 },
        ...CAPTURE_ENVIRONMENT,
      });
      const page = await context.newPage();
      await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      const beforeSnap = await snapshotStructure(page);
      await context.close();

      const context2 = await browser.newContext({
        viewport: { width: above, height: 1000 },
        ...CAPTURE_ENVIRONMENT,
      });
      const page2 = await context2.newPage();
      await page2.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page2.waitForLoadState('networkidle').catch(() => {});
      const afterSnap = await snapshotStructure(page2);
      await context2.close();

      const changes = diffStructure(beforeSnap, afterSnap);
      transitions.push({
        breakpointPx: bp.px,
        raws: bp.raws,
        bound: bp.bound,
        corroborated: Boolean(bp.corroborated),
        evidenceClass: 'OBSERVED-MIRROR',
        window: { below, above },
        structuralChangeCount: changes.length,
        changes: changes.slice(0, 20),
      });

      log(
        STAGE,
        `bp=${bp.px}px [${below}<->${above}] changes=${changes.length} corroborated=${Boolean(bp.corroborated)}`
      );
    }

    // Which config sample viewports actually straddle a real breakpoint, and
    // which don't correspond to any declared threshold at all.
    const viewportClassification = configViewports.map((v) => {
      const nearest = widthBreakpoints.reduce((best, bp) => {
        const d = Math.abs(bp.px - v.width);
        return !best || d < best.distance ? { breakpointPx: bp.px, distance: d } : best;
      }, null);
      return {
        viewport: v.name,
        width: v.width,
        nearestBreakpointPx: nearest?.breakpointPx ?? null,
        distancePx: nearest?.distance ?? null,
        isAtABreakpoint: nearest ? nearest.distance <= 2 : false,
      };
    });

    const output = {
      ...runMetadata(STAGE),
      environment: environmentManifest(),
      note: 'transitions[] are keyed on REAL breakpoints derived from CSSOM evidence (Stage 3), never on the 6 config sample viewports. viewportSampleClassification[] separately records which sample viewports happen to sit near a real breakpoint.',
      counts: {
        realBreakpoints: widthBreakpoints.length,
        transitionsObserved: transitions.filter((t) => t.evidenceClass === 'OBSERVED-MIRROR')
          .length,
        transitionsBlocked: transitions.filter((t) => t.evidenceClass === 'VERIFY-BLOCKED').length,
        withStructuralChange: transitions.filter((t) => t.structuralChangeCount > 0).length,
      },
      transitions,
      viewportSampleClassification: viewportClassification,
    };
    output.canonicalHash = canonicalHash({ transitions, viewportClassification });

    await writeJson(
      path.join(ARTIFACTS, 'evidence', 'responsive', 'breakpoint-transitions.json'),
      output
    );

    log(
      STAGE,
      `breakpoints=${widthBreakpoints.length} withChange=${output.counts.withStructuralChange}`
    );
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
