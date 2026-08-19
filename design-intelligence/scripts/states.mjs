/**
 * Stage 5 — Interaction state capture.
 *
 * Stage 3 found which selectors carry state styling (65 rules across :hover,
 * :focus, :focus-visible, :active, :disabled, :focus-within, [aria-selected],
 * [aria-disabled]). This stage forces those states on real elements and records
 * what actually changes.
 *
 * States are forced through CDP `CSS.forcePseudoState` rather than synthetic
 * mouse input. Real input is position-dependent and races with layout; forcing
 * is deterministic and can express states (:focus-visible, :active) that a
 * headless pointer cannot reliably produce.
 *
 * A state that cannot be reproduced is recorded VERIFY-BLOCKED. It is never
 * inferred from the declaration alone — knowing a rule exists is not the same
 * as knowing what it computes to.
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

const STAGE = 'states';

/** Pseudo-classes CDP can force directly. */
const FORCEABLE = [
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'visited',
  'target',
];

/**
 * States driven by real DOM attributes rather than forceable pseudo-classes.
 * `:disabled` in particular is not forceable through CDP — it reflects actual
 * element state — so it is applied by setting the attribute on form controls.
 */
const ATTRIBUTE_STATES = {
  ':disabled': { attribute: 'disabled', value: '' },
  ':checked': { attribute: 'checked', value: '' },
  '[aria-selected': { attribute: 'aria-selected', value: 'true' },
  '[aria-expanded': { attribute: 'aria-expanded', value: 'true' },
  '[aria-disabled': { attribute: 'aria-disabled', value: 'true' },
  '[aria-current': { attribute: 'aria-current', value: 'page' },
};

/** Properties worth diffing between states. */
const STATE_PROPERTIES = [
  'color',
  'background-color',
  'background-image',
  'opacity',
  'border-top-color',
  'border-top-width',
  'border-top-left-radius',
  'border-bottom-right-radius',
  'box-shadow',
  'outline-color',
  'outline-width',
  'outline-style',
  'outline-offset',
  'transform',
  'filter',
  'backdrop-filter',
  'text-decoration-line',
  'text-decoration-color',
  'font-weight',
  'letter-spacing',
  'transition-duration',
  'transition-timing-function',
  'transition-property',
  'visibility',
  'display',
];

/**
 * Reduce a state selector to the base selector to query.
 * `.btn:hover .icon` -> `.btn .icon` ; `a.link:focus-visible` -> `a.link`
 */
function baseSelector(selector) {
  return (
    selector
      .split(',')[0]
      // Drop whole functional-pseudo groups first. Stripping a state from
      // inside :not(:disabled) would otherwise leave an invalid empty :not().
      .replace(/:(not|is|where|has)\([^()]*\)/g, '')
      .replace(
        /::?(hover|focus-visible|focus-within|focus|active|disabled|checked|visited|target)\b/g,
        ''
      )
      .replace(/\[(aria-[a-z]+|data-state)[^\]]*\]/g, '')
      // Any empty functional pseudo left by nested stripping is invalid CSS.
      .replace(/:(not|is|where|has)\(\s*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

async function readStateProperties(page, selector, properties) {
  return page.evaluate(
    ([sel, props]) => {
      // A reduced selector can still be invalid CSS; treat that as
      // unresolvable evidence rather than crashing the stage.
      let el = null;
      try {
        el = document.querySelector(sel);
      } catch {
        return { invalidSelector: true };
      }
      if (!el) return null;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const out = {};
      for (const property of props) out[property] = style.getPropertyValue(property);
      return {
        styles: out,
        geometry: {
          x: Math.round(rect.x * 100) / 100,
          y: Math.round(rect.y * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
        },
        aria: {
          role: el.getAttribute('role'),
          ariaSelected: el.getAttribute('aria-selected'),
          ariaExpanded: el.getAttribute('aria-expanded'),
          ariaDisabled: el.getAttribute('aria-disabled'),
          ariaCurrent: el.getAttribute('aria-current'),
          tabIndex: el.tabIndex,
        },
        childCount: el.childElementCount,
        outerLength: el.outerHTML.length,
      };
    },
    [selector, properties]
  );
}

function diff(before, after) {
  const styles = {};
  for (const key of Object.keys(before.styles)) {
    if (before.styles[key] !== after.styles[key]) {
      styles[key] = { from: before.styles[key], to: after.styles[key] };
    }
  }
  const geometry = {};
  for (const key of Object.keys(before.geometry)) {
    if (before.geometry[key] !== after.geometry[key]) {
      geometry[key] = { from: before.geometry[key], to: after.geometry[key] };
    }
  }
  const aria = {};
  for (const key of Object.keys(before.aria)) {
    if (before.aria[key] !== after.aria[key]) {
      aria[key] = { from: before.aria[key], to: after.aria[key] };
    }
  }
  return {
    styles,
    geometry,
    aria,
    domChanged: before.outerLength !== after.outerLength || before.childCount !== after.childCount,
    changed:
      Object.keys(styles).length + Object.keys(geometry).length + Object.keys(aria).length > 0,
  };
}

async function main() {
  const cfg = await readConfig('extractor');
  const viewports = await readConfig('viewports');
  const cssom = await readJson(path.join(ARTIFACTS, 'evidence', 'source', 'cssom.json'));

  // Build the work list from Stage 3 evidence: only selectors Google actually
  // wrote state rules for. Probing arbitrary elements would invent coverage.
  const targets = new Map();
  for (const rule of cssom.stateRules) {
    const base = baseSelector(rule.selector);
    if (!base || base.length > 200) continue;
    if (!targets.has(base)) targets.set(base, new Set());
    for (const state of rule.states) targets.get(base).add(state);
  }
  log(STAGE, `state-styled selectors from Stage 3: ${targets.size}`);

  const server = await startMirrorServer(cfg.mirrorPort);
  const browser = await launchBrowser();

  try {
    const results = [];
    // States are captured at the two viewports that bracket the primary
    // 1024px breakpoint; state styling is rarely viewport-specific, and every
    // extra viewport multiplies force/restore cycles.
    const stateViewports = viewports.filter((v) => ['desktop-xl', 'mobile'].includes(v.name));

    for (const viewport of stateViewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        ...CAPTURE_ENVIRONMENT,
        reducedMotion: 'no-preference',
      });
      const page = await context.newPage();
      await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.waitForLoadState('networkidle').catch(() => {});

      const cdp = await context.newCDPSession(page);
      await cdp.send('DOM.enable');
      await cdp.send('CSS.enable');
      const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });

      for (const [selector, states] of targets) {
        const initial = await readStateProperties(page, selector, STATE_PROPERTIES);
        if (!initial || initial.invalidSelector) {
          results.push({
            viewport: viewport.name,
            selector,
            states: [...states],
            evidenceClass: 'VERIFY-BLOCKED',
            reason: initial?.invalidSelector
              ? 'reduced selector is not valid CSS'
              : 'selector matches no element in the mirror at this viewport',
          });
          continue;
        }

        let nodeId = null;
        try {
          ({ nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector }));
        } catch {
          nodeId = null;
        }

        for (const state of states) {
          const attributeState = ATTRIBUTE_STATES[state];

          if (attributeState) {
            const applied = await page.evaluate(
              ([sel, attr, value]) => {
                const el = document.querySelector(sel);
                if (!el) return false;
                el.setAttribute(attr, value);
                return true;
              },
              [selector, attributeState.attribute, attributeState.value]
            );
            if (!applied) continue;
            const after = await readStateProperties(page, selector, STATE_PROPERTIES);
            await page.evaluate(
              ([sel, attr]) => document.querySelector(sel)?.removeAttribute(attr),
              [selector, attributeState.attribute]
            );
            results.push({
              viewport: viewport.name,
              selector,
              state,
              method: 'attribute',
              evidenceClass: 'OBSERVED-MIRROR',
              delta: diff(initial, after),
            });
            continue;
          }

          const pseudo = state.replace(/^:/, '');
          if (!FORCEABLE.includes(pseudo) || !nodeId) {
            results.push({
              viewport: viewport.name,
              selector,
              state,
              evidenceClass: 'VERIFY-BLOCKED',
              reason: !nodeId
                ? 'CDP could not resolve the element node'
                : `pseudo-class ":${pseudo}" cannot be forced deterministically`,
            });
            continue;
          }

          try {
            await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [pseudo] });
            const after = await readStateProperties(page, selector, STATE_PROPERTIES);
            await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
            results.push({
              viewport: viewport.name,
              selector,
              state,
              method: 'cdp-force',
              evidenceClass: 'OBSERVED-MIRROR',
              delta: diff(initial, after),
            });
          } catch (error) {
            results.push({
              viewport: viewport.name,
              selector,
              state,
              evidenceClass: 'VERIFY-BLOCKED',
              reason: `force failed: ${error.message.slice(0, 120)}`,
            });
          }
        }
      }
      await context.close();
    }

    const observed = results.filter((r) => r.evidenceClass === 'OBSERVED-MIRROR');
    const changed = observed.filter((r) => r.delta?.changed);
    const blocked = results.filter((r) => r.evidenceClass === 'VERIFY-BLOCKED');

    const byState = {};
    for (const result of observed) {
      const key = result.state;
      byState[key] = byState[key] || { observed: 0, withDelta: 0 };
      byState[key].observed += 1;
      if (result.delta?.changed) byState[key].withDelta += 1;
    }

    const output = {
      ...runMetadata(STAGE),
      environment: environmentManifest(),
      counts: {
        selectors: targets.size,
        probes: results.length,
        observed: observed.length,
        withMeasuredDelta: changed.length,
        verifyBlocked: blocked.length,
      },
      byState,
      results,
    };
    output.canonicalHash = canonicalHash(results);
    await writeJson(path.join(ARTIFACTS, 'evidence', 'states', 'interaction-states.json'), output);

    log(
      STAGE,
      `probes=${results.length} observed=${observed.length} withDelta=${changed.length} blocked=${blocked.length}`
    );
    for (const [state, stats] of Object.entries(byState).sort()) {
      log(
        STAGE,
        `  ${state.padEnd(18)} observed=${String(stats.observed).padStart(3)} withDelta=${String(stats.withDelta).padStart(3)}`
      );
    }
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
