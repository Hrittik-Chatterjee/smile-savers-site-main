/**
 * Stage 4 — Runtime mirror capture.
 *
 * Renders the mirrored source on localhost and records what the cascade
 * actually resolves to. Stage 3 recorded what Google *declared*; this stage
 * records what *wins*. Output is OBSERVED-MIRROR and is never relabelled as
 * live-runtime OBSERVED — Chromium cannot reach labs.google in this
 * environment, so no capture here is live.
 *
 * Motion ordering is load-bearing: Mode A runs with
 * prefers-reduced-motion: no-preference and extracts motion BEFORE any
 * stability override, because zeroing animation/transition durations for
 * screenshot determinism destroys exactly the evidence motion analysis needs.
 * Mode B then re-renders under `reduce` to verify accessibility behaviour.
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

const STAGE = 'capture';

/** Properties whose computed values carry design meaning. */
const CAPTURED_PROPERTIES = [
  'display',
  'position',
  'visibility',
  'opacity',
  'z-index',
  'overflow',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'gap',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-auto-flow',
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'justify-content',
  'align-items',
  'align-content',
  'order',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-stretch',
  'line-height',
  'letter-spacing',
  'text-transform',
  'text-align',
  'white-space',
  'font-variation-settings',
  'color',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-style',
  'border-top-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'box-shadow',
  'filter',
  'backdrop-filter',
  'transform',
  'transform-origin',
  'object-fit',
  'object-position',
  'aspect-ratio',
  'transition-property',
  'transition-duration',
  'transition-delay',
  'transition-timing-function',
  'animation-name',
  'animation-duration',
  'animation-delay',
  'animation-iteration-count',
  'animation-direction',
  'animation-fill-mode',
  'animation-timing-function',
];

/**
 * Runs in the page. Returns computed styles, geometry, typography, motion,
 * pseudo-elements and shadow-DOM presence for every visible element.
 */
function captureRuntime(properties) {
  const stableSelector = (el) => {
    const parts = [];
    let node = el;
    for (let depth = 0; node && depth < 8; depth += 1, node = node.parentElement) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part += `#${node.id}`;
        parts.unshift(part);
        break;
      }
      const classes = Array.from(node.classList).slice(0, 3);
      if (classes.length) part += `.${classes.join('.')}`;
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
    }
    return parts.join(' > ');
  };

  const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      Number(style.opacity) !== 0
    );
  };

  const all = Array.from(document.querySelectorAll('body *'));
  const visible = all.filter(isVisible);

  const elements = visible.map((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    const styles = {};
    for (const property of properties) styles[property] = style.getPropertyValue(property);

    // Pseudo-elements are frequently where decorative shape/motion lives.
    const pseudo = {};
    for (const which of ['::before', '::after']) {
      const ps = getComputedStyle(el, which);
      const content = ps.getPropertyValue('content');
      if (content && content !== 'none' && content !== 'normal') {
        pseudo[which] = {
          content,
          width: ps.width,
          height: ps.height,
          backgroundColor: ps.backgroundColor,
          borderTopLeftRadius: ps.borderTopLeftRadius,
          transform: ps.transform,
          animationName: ps.animationName,
          transitionDuration: ps.transitionDuration,
        };
      }
    }

    const isTextLeaf = el.childElementCount === 0 && (el.textContent || '').trim().length > 0;

    return {
      tag: el.tagName.toLowerCase(),
      selector: stableSelector(el),
      id: el.id || null,
      classes: Array.from(el.classList).slice(0, 12),
      role: el.getAttribute('role'),
      ariaLabel: el.getAttribute('aria-label'),
      href: el.getAttribute('href'),
      geometry: {
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
      },
      styles,
      pseudo: Object.keys(pseudo).length ? pseudo : undefined,
      hasShadowRoot: Boolean(el.shadowRoot),
      text: isTextLeaf ? el.textContent.trim().slice(0, 200) : null,
    };
  });

  // Root custom properties, resolved.
  const rootStyle = getComputedStyle(document.documentElement);
  const customProperties = {};
  for (let i = 0; i < rootStyle.length; i += 1) {
    const property = rootStyle[i];
    if (property.startsWith('--')) {
      customProperties[property] = rootStyle.getPropertyValue(property).trim();
    }
  }

  // Typography: separate what was REQUESTED from what actually RESOLVED.
  const typography = visible
    .filter((el) => el.childElementCount === 0 && (el.textContent || '').trim().length > 0)
    .slice(0, 300)
    .map((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const lineHeight = parseFloat(style.lineHeight);
      return {
        selector: stableSelector(el),
        requestedFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textTransform: style.textTransform,
        boundingBox: {
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        },
        approximateLines:
          Number.isFinite(lineHeight) && lineHeight > 0
            ? Math.round(rect.height / lineHeight)
            : null,
        characters: el.textContent.trim().length,
      };
    });

  const fontFaces = Array.from(document.fonts).map((face) => ({
    family: face.family,
    style: face.style,
    weight: face.weight,
    status: face.status,
  }));

  const shadowHosts = all.filter((el) => el.shadowRoot).map(stableSelector);

  return {
    url: location.href,
    title: document.title,
    viewport: {
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
      scrollHeight: document.documentElement.scrollHeight,
    },
    counts: {
      total: all.length,
      visible: visible.length,
      withPseudo: elements.filter((e) => e.pseudo).length,
      shadowHosts: shadowHosts.length,
      textLeaves: typography.length,
    },
    customProperties,
    elements,
    typography,
    fontFaces: {
      declared: fontFaces.length,
      loaded: fontFaces.filter((f) => f.status === 'loaded').length,
      unloaded: fontFaces.filter((f) => f.status !== 'loaded').length,
      sample: fontFaces.slice(0, 20),
    },
    shadowHosts,
  };
}

/** Motion evidence, captured before any stability override exists. */
function captureMotion() {
  const moving = [];
  for (const el of Array.from(document.querySelectorAll('body *'))) {
    const style = getComputedStyle(el);
    const durations = style.transitionDuration || '';
    const animation = style.animationName || 'none';
    const hasTransition = durations && !/^(0s)(,\s*0s)*$/.test(durations.trim());
    const hasAnimation = animation !== 'none' && animation !== '';
    if (!hasTransition && !hasAnimation) continue;

    moving.push({
      tag: el.tagName.toLowerCase(),
      classes: Array.from(el.classList).slice(0, 4),
      transition: {
        property: style.transitionProperty,
        duration: style.transitionDuration,
        delay: style.transitionDelay,
        timingFunction: style.transitionTimingFunction,
      },
      animation: {
        name: style.animationName,
        duration: style.animationDuration,
        delay: style.animationDelay,
        iterationCount: style.animationIterationCount,
        direction: style.animationDirection,
        fillMode: style.animationFillMode,
        timingFunction: style.animationTimingFunction,
      },
      transform: style.transform,
    });
  }
  return moving;
}

/**
 * Classify a failed request. A same-origin 404 is NOT automatically a mirror
 * gap: Stage 2 intentionally skips heavy media bodies, so those failures are
 * expected. Only an unexplained same-origin failure is a real gap, and
 * conflating the two would inflate the coverage model with phantom defects.
 */
function classifyFailure(failure, origin, skippedPaths) {
  if (!failure.url.includes('127.0.0.1')) {
    return { ...failure, classification: 'cross-origin', evidenceClass: 'VERIFY-BLOCKED' };
  }
  const { pathname } = new URL(failure.url);
  if (skippedPaths.has(pathname)) {
    return {
      ...failure,
      classification: 'intentionally-skipped-media',
      evidenceClass: 'OBSERVED-SOURCE',
      note: 'declared dependency; body deliberately not mirrored',
    };
  }
  return { ...failure, classification: 'mirror-gap', evidenceClass: 'UNKNOWN' };
}

async function captureViewport(browser, server, viewport, mode, skippedPaths) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    ...CAPTURE_ENVIRONMENT,
    deviceScaleFactor: viewport.deviceScaleFactor,
    reducedMotion: mode.reducedMotion,
  });
  const page = await context.newPage();

  // Runtime integrity: what the mirror could not supply. This independently
  // cross-validates Stage 2's crawl, which cannot see runtime-loaded assets.
  const failedRequests = [];
  const consoleErrors = [];
  page.on('requestfailed', (request) =>
    failedRequests.push({ url: request.url(), reason: request.failure()?.errorText || 'unknown' })
  );
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedRequests.push({ url: response.url(), reason: `HTTP ${response.status()}` });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 300));
  });

  await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});

  // Motion FIRST — before any stability override could zero it out.
  const motion = await page.evaluate(captureMotion);
  const runtime = await page.evaluate(captureRuntime, CAPTURED_PROPERTIES);

  await context.close();

  return {
    viewport: viewport.name,
    mode: mode.name,
    reducedMotion: mode.reducedMotion,
    evidenceClass: 'OBSERVED-MIRROR',
    motion: { count: motion.length, elements: motion },
    ...runtime,
    runtimeIntegrity: (() => {
      const classified = failedRequests.map((failure) =>
        classifyFailure(failure, server.url, skippedPaths)
      );
      const by = (kind) => classified.filter((c) => c.classification === kind);
      const gaps = by('mirror-gap');
      return {
        total: classified.length,
        crossOrigin: by('cross-origin').length,
        intentionallySkipped: by('intentionally-skipped-media').length,
        mirrorGaps: gaps.length,
        consoleErrors: consoleErrors.length,
        gapSample: gaps.slice(0, 15),
        consoleSample: consoleErrors.slice(0, 10),
        note:
          'cross-origin = unreachable in this environment (VERIFY-BLOCKED). ' +
          'intentionally-skipped-media = declared dependency whose body Stage 2 chose not to mirror; expected, not a defect. ' +
          'mirror-gap = an unexplained same-origin failure and the only category that indicates real missing coverage.',
      };
    })(),
  };
}

async function main() {
  const cfg = await readConfig('extractor');
  const viewports = await readConfig('viewports');
  const server = await startMirrorServer(cfg.mirrorPort);
  const browser = await launchBrowser();

  // Assets Stage 2 recorded as declared dependencies but deliberately did not
  // download. Their 404s at capture time are expected, not mirror gaps.
  const manifest = await readJson(path.join(ARTIFACTS, 'mirror', 'mirror-manifest.json'));
  const skippedPaths = new Set(
    manifest.assets
      .filter((asset) => asset.bodyMirrored === false)
      .map((asset) => new URL(asset.url).pathname)
  );
  log(STAGE, `intentionally-skipped media paths: ${skippedPaths.size}`);

  try {
    const summaries = [];
    for (const viewport of viewports) {
      for (const mode of cfg.motionModes) {
        const capture = await captureViewport(browser, server, viewport, mode, skippedPaths);
        capture.canonicalHash = canonicalHash({
          elements: capture.elements,
          customProperties: capture.customProperties,
          typography: capture.typography,
          motion: capture.motion,
        });

        const file = path.join(
          ARTIFACTS,
          'evidence',
          'runtime',
          viewport.name,
          `${mode.name}.json`
        );
        await writeJson(file, {
          ...runMetadata(STAGE),
          environment: environmentManifest(),
          ...capture,
        });

        summaries.push({
          viewport: viewport.name,
          mode: mode.name,
          visible: capture.counts.visible,
          total: capture.counts.total,
          withPseudo: capture.counts.withPseudo,
          shadowHosts: capture.counts.shadowHosts,
          customProperties: Object.keys(capture.customProperties).length,
          motionElements: capture.motion.count,
          fontsLoaded: capture.fontFaces.loaded,
          fontsUnloaded: capture.fontFaces.unloaded,
          scrollHeight: capture.viewport.scrollHeight,
          failedTotal: capture.runtimeIntegrity.total,
          mirrorGaps: capture.runtimeIntegrity.mirrorGaps,
          canonicalHash: capture.canonicalHash,
        });

        log(
          STAGE,
          `${viewport.name.padEnd(16)} ${mode.name.padEnd(12)} visible=${String(capture.counts.visible).padStart(4)} ` +
            `motion=${String(capture.motion.count).padStart(3)} vars=${String(Object.keys(capture.customProperties).length).padStart(3)} ` +
            `pseudo=${String(capture.counts.withPseudo).padStart(3)} ` +
            `xorigin=${capture.runtimeIntegrity.crossOrigin} skipped=${capture.runtimeIntegrity.intentionallySkipped} gaps=${capture.runtimeIntegrity.mirrorGaps}`
        );
      }
    }

    // Close the discovery loop. Stage 2 cannot see assets a JS bundle requests
    // at runtime, so any same-origin gap found here is fed back as a mirror
    // seed. Re-running `mirror` then `capture` should drive gaps to zero.
    const gapUrls = new Set();
    for (const viewport of viewports) {
      for (const mode of cfg.motionModes) {
        const file = path.join(
          ARTIFACTS,
          'evidence',
          'runtime',
          viewport.name,
          `${mode.name}.json`
        );
        const data = await readJson(file);
        for (const gap of data.runtimeIntegrity.gapSample) {
          gapUrls.add(new URL(gap.url).pathname);
        }
      }
    }
    await writeJson(path.join(ARTIFACTS, 'evidence', 'runtime', 'discovered-assets.json'), {
      ...runMetadata(STAGE),
      note:
        'Same-origin assets requested at runtime that the static crawl missed. ' +
        '`mirror` seeds its queue from this file, so re-running mirror then capture closes the gap.',
      origin: cfg.origin,
      paths: [...gapUrls].sort(),
    });

    const index = {
      ...runMetadata(STAGE),
      environment: environmentManifest(),
      evidenceClass: 'OBSERVED-MIRROR',
      captures: summaries,
      runtimeDiscoveredAssets: [...gapUrls].sort(),
    };
    index.canonicalHash = canonicalHash(summaries);
    await writeJson(path.join(ARTIFACTS, 'evidence', 'runtime', 'index.json'), index);
    if (gapUrls.size) {
      log(STAGE, `runtime-discovered assets missing from mirror: ${[...gapUrls].join(', ')}`);
      log(STAGE, 're-run `mirror` then `capture` to close these gaps');
    }

    log(STAGE, `captures=${summaries.length} canonicalHash=${index.canonicalHash}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
