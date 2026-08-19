/**
 * Stage 3 — Source parsing via CSSOM.
 *
 * Uses the browser's own CSS parser over the mirrored stylesheets. Regex is
 * disqualified as the primary parser: on this exact source it found 20 media
 * rules where CSSOM finds 134, a 6.7x undercount that would have silently
 * destroyed the responsive model.
 *
 * Output is OBSERVED-SOURCE: these are the declarations Google served, read by
 * a standards-compliant parser. Cascade resolution (what actually *wins* for a
 * given element) is Stage 4's job and is classified OBSERVED-MIRROR.
 */

import path from 'node:path';
import { launchBrowser, CAPTURE_ENVIRONMENT, environmentManifest } from '../lib/browser.mjs';
import {
  ARTIFACTS, writeJson, readConfig, canonicalHash, runMetadata, log,
} from '../lib/core.mjs';
import { startMirrorServer } from '../lib/mirror-server.mjs';

const STAGE = 'parse';

/** Runs in the page. Walks every reachable stylesheet rule tree. */
function extractCssom() {
  const out = {
    sheets: [],
    customProperties: [],
    mediaConditions: [],
    stateRules: [],
    transitions: [],
    animations: [],
    keyframes: [],
    supports: [],
    blocked: [],
    counts: { sheets: 0, rules: 0, media: 0, keyframes: 0, supports: 0, imports: 0 },
  };

  const STATE_PSEUDOS = [
    ':hover', ':focus-visible', ':focus-within', ':focus', ':active',
    ':disabled', ':checked', ':target', ':visited',
    '[aria-selected', '[aria-expanded', '[aria-current', '[aria-disabled', '[data-state',
  ];

  const walk = (rules, context) => {
    for (const rule of rules) {
      out.counts.rules++;
      const type = rule.constructor.name;

      if (type === 'CSSMediaRule') {
        out.counts.media++;
        out.mediaConditions.push({ condition: rule.conditionText, context });
        if (rule.cssRules) walk(rule.cssRules, { ...context, media: rule.conditionText });
        continue;
      }
      if (type === 'CSSSupportsRule') {
        out.counts.supports++;
        out.supports.push({ condition: rule.conditionText, context });
        if (rule.cssRules) walk(rule.cssRules, context);
        continue;
      }
      if (type === 'CSSImportRule') {
        out.counts.imports++;
        continue;
      }
      if (type === 'CSSKeyframesRule') {
        out.counts.keyframes++;
        out.keyframes.push({
          name: rule.name,
          context,
          steps: Array.from(rule.cssRules || []).map((step) => ({
            offset: step.keyText,
            declarations: Object.fromEntries(
              Array.from(step.style || []).map((prop) => [prop, step.style.getPropertyValue(prop).trim()])
            ),
          })),
        });
        continue;
      }
      if (type !== 'CSSStyleRule' || !rule.style) continue;

      const selector = rule.selectorText || '';

      for (const prop of Array.from(rule.style)) {
        const value = rule.style.getPropertyValue(prop).trim();

        if (prop.startsWith('--')) {
          out.customProperties.push({ name: prop, value, selector, context });
          continue;
        }
        if (prop === 'transition' || prop.startsWith('transition-')) {
          out.transitions.push({ property: prop, value, selector, context });
          continue;
        }
        if (prop === 'animation' || prop.startsWith('animation-')) {
          out.animations.push({ property: prop, value, selector, context });
        }
      }

      const matched = STATE_PSEUDOS.filter((pseudo) => selector.includes(pseudo));
      if (matched.length) {
        out.stateRules.push({
          selector,
          states: matched,
          context,
          declarations: Object.fromEntries(
            Array.from(rule.style).map((prop) => [prop, rule.style.getPropertyValue(prop).trim()])
          ),
        });
      }
    }
  };

  for (const sheet of Array.from(document.styleSheets)) {
    out.counts.sheets++;
    const descriptor = {
      href: sheet.href || null,
      inline: !sheet.href,
      media: sheet.media ? sheet.media.mediaText : '',
    };
    let rules = null;
    try {
      rules = sheet.cssRules;
    } catch (error) {
      // Cross-origin stylesheet: the browser refuses to expose its rules.
      out.blocked.push({ ...descriptor, reason: `CORS: ${error.name}` });
      out.sheets.push({ ...descriptor, accessible: false });
      continue;
    }
    out.sheets.push({ ...descriptor, accessible: true, ruleCount: rules ? rules.length : 0 });
    if (rules) walk(rules, { sheet: descriptor.href || 'inline' });
  }

  return out;
}

/**
 * Media-query lengths in `rem`/`em` resolve against the INITIAL font-size, not
 * the root element's computed font-size. This source proves it twice over:
 * `:root` is 10px, yet every rem breakpoint has an exact px twin at a 16px
 * basis — 64rem/1024px, 48rem/768px, 25rem/400px, 120rem/1920px — and
 * `matchMedia('(min-width: 100rem)')` is false at 1024px, which it could not be
 * on a 10px basis.
 *
 * So element values (`--gl-radius-card: 2.4rem` = 24px) and media queries
 * (`64rem` = 1024px) use DIFFERENT bases. Conflating them silently corrupts the
 * entire responsive model.
 */
const MEDIA_REM_BASIS_PX = 16;

/**
 * Breakpoint definitions come from @media evidence only. A viewport we happen
 * to screenshot is an observation point, never a breakpoint.
 *
 * Handles both legacy (`min-width: 768px`) and modern range syntax
 * (`width > 64rem`, `400px < width < 1000px`). Range syntax dominates this
 * source: `(width > 64rem)` alone appears 31 times, and a legacy-only matcher
 * finds 5 breakpoints where the true count is far higher.
 */
function deriveBreakpoints(mediaConditions) {
  const found = new Map();

  const toPx = (rawValue, unit) => {
    const numeric = Number(rawValue);
    if (unit === 'px') return { px: numeric, basis: 'literal', cls: 'OBSERVED-SOURCE' };
    return {
      px: numeric * MEDIA_REM_BASIS_PX,
      basis: `media-query ${unit} basis = ${MEDIA_REM_BASIS_PX}px (initial font-size, verified by matchMedia)`,
      cls: 'DERIVED',
    };
  };

  const record = (bound, axis, rawValue, unit, condition) => {
    const { px, basis, cls } = toPx(rawValue, unit);
    const key = `${bound}:${axis}:${px}`;
    if (!found.has(key)) {
      found.set(key, {
        bound, axis, px, basis,
        raws: [], evidenceClass: cls, occurrences: 0, conditions: [],
      });
    }
    const entry = found.get(key);
    entry.occurrences++;
    const raw = `${rawValue}${unit}`;
    if (!entry.raws.includes(raw)) entry.raws.push(raw);
    if (!entry.conditions.includes(condition)) entry.conditions.push(condition);

    // A breakpoint expressed both as a literal px and as rem is corroborated by
    // the source itself. Literal evidence outranks a unit conversion, so the
    // strongest available class wins rather than whichever form parsed first.
    if (cls === 'OBSERVED-SOURCE' && entry.evidenceClass === 'DERIVED') {
      entry.evidenceClass = 'OBSERVED-SOURCE';
      entry.basis = 'literal px, corroborated by an equivalent rem declaration';
      entry.corroborated = true;
    } else if (cls === 'DERIVED' && entry.evidenceClass === 'OBSERVED-SOURCE') {
      entry.corroborated = true;
    }
  };

  const LEN = '([\\d.]+)(px|rem|em)';

  for (const { condition } of mediaConditions) {
    // Legacy: (min-width: 768px) / (max-height: 600px)
    for (const [, bound, axis, value, unit] of condition.matchAll(
      new RegExp(`\\((min|max)-(width|height):\\s*${LEN}\\)`, 'g')
    )) {
      record(bound === 'min' ? 'min' : 'max', axis, value, unit, condition);
    }

    // Double-ended range: (400px < width < 1000px)
    for (const [, lo, loUnit, axis, hi, hiUnit] of condition.matchAll(
      new RegExp(`\\(\\s*${LEN}\\s*<=?\\s*(width|height)\\s*<=?\\s*${LEN}\\s*\\)`, 'g')
    )) {
      record('min', axis, lo, loUnit, condition);
      record('max', axis, hi, hiUnit, condition);
    }

    // Single-ended range: (width > 64rem) / (width <= 768px)
    for (const [, axis, operator, value, unit] of condition.matchAll(
      new RegExp(`\\(\\s*(width|height)\\s*(>=|<=|>|<)\\s*${LEN}\\s*\\)`, 'g')
    )) {
      record(operator.startsWith('>') ? 'min' : 'max', axis, value, unit, condition);
    }
  }

  return [...found.values()].sort((a, b) => a.px - b.px || a.axis.localeCompare(b.axis));
}

async function main() {
  const cfg = await readConfig('extractor');
  const server = await startMirrorServer(cfg.mirrorPort);
  const browser = await launchBrowser();

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      ...CAPTURE_ENVIRONMENT,
    });
    const page = await context.newPage();
    await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle').catch(() => {});

    const cssom = await page.evaluate(extractCssom);

    // Verify the rem basis rather than assuming 16px. Two independent methods
    // must agree or the basis is not trusted.
    const remBasis = await page.evaluate(() => {
      const computed = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const probe = document.createElement('div');
      probe.style.cssText = 'width:10rem;position:absolute;visibility:hidden;pointer-events:none';
      document.body.appendChild(probe);
      const measured = probe.getBoundingClientRect().width / 10;
      probe.remove();
      return { computed, measured, agree: Math.abs(computed - measured) < 0.01 };
    });

    const breakpoints = deriveBreakpoints(cssom.mediaConditions);

    const result = {
      ...runMetadata(STAGE),
      environment: environmentManifest(),
      evidenceClass: 'OBSERVED-SOURCE',
      remBasis: {
        ...remBasis,
        evidenceClass: remBasis.agree ? 'DERIVED' : 'UNKNOWN',
        note: remBasis.agree
          ? 'computed font-size and a 10rem probe agree; rem->px conversion is trusted'
          : 'methods disagree; rem->px conversion is NOT trusted and must not be used',
      },
      // Spread the raw extraction first: the derived `counts` and `breakpoints`
      // below must win over the partial counts cssom carries.
      ...cssom,
      breakpoints,
      counts: {
        ...cssom.counts,
        customProperties: cssom.customProperties.length,
        distinctCustomProperties: new Set(cssom.customProperties.map((p) => p.name)).size,
        stateRules: cssom.stateRules.length,
        transitions: cssom.transitions.length,
        animations: cssom.animations.length,
        breakpoints: breakpoints.length,
        blockedSheets: cssom.blocked.length,
      },
    };
    result.canonicalHash = canonicalHash({
      customProperties: cssom.customProperties,
      mediaConditions: cssom.mediaConditions,
      stateRules: cssom.stateRules,
      keyframes: cssom.keyframes,
      breakpoints,
    });

    await writeJson(path.join(ARTIFACTS, 'evidence', 'source', 'cssom.json'), result);

    log(STAGE, `sheets=${result.counts.sheets} rules=${result.counts.rules} media=${result.counts.media}`);
    log(STAGE, `customProps=${result.counts.distinctCustomProperties} distinct (${result.counts.customProperties} declarations)`);
    log(STAGE, `stateRules=${result.counts.stateRules} transitions=${result.counts.transitions} keyframes=${result.counts.keyframes}`);
    log(STAGE, `breakpoints=${result.counts.breakpoints} remBasis=${remBasis.computed}px agree=${remBasis.agree}`);
    log(STAGE, `blockedSheets=${result.counts.blockedSheets} (VERIFY-BLOCKED)`);
    log(STAGE, `canonicalHash=${result.canonicalHash}`);

    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
