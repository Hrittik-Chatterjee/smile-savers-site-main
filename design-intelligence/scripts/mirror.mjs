/**
 * Stage 2 — Dependency-graph source mirror.
 *
 * Starts from the target HTML and recursively discovers required resources.
 * Hashed filenames (e.g. styles-3NEYF3LM.css) are NEVER hardcoded: Google
 * rebuilds them on every deploy, which would silently rot a fixed mirror.
 *
 * Discovery uses attribute/url() pattern matching over HTML and CSS text. This
 * is the narrowly-scoped preprocessing exception to the "no regex" rule: it
 * only locates candidate URLs, never interprets CSS semantics. Stage 4
 * independently cross-validates the result by recording every request the real
 * browser issues and flagging anything the mirror is missing.
 *
 * Cross-origin resources are recorded but not mirrored: they are evidence that
 * a dependency exists, classified VERIFY-BLOCKED.
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import {
  ARTIFACTS, ensureDir, writeJson, readConfig, fetchAsset,
  sha256, canonicalHash, runMetadata, log,
} from '../lib/core.mjs';

const STAGE = 'mirror';

const TEXTUAL = new Set(['text/html', 'text/css', 'application/javascript', 'text/javascript']);

/**
 * Heavy media is recorded as a declared dependency but its body is not
 * downloaded: a single gallery video exceeds 10MB and contributes nothing to
 * design-token evidence.
 */
const SKIP_BODY_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogv', '.mp3', '.wav', '.m4a']);

/** Resolve a possibly-relative URL; return null if unusable. */
function resolve(ref, base) {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('#')) return null;
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('mailto:')) return null;
  try {
    return new URL(trimmed, base).href.split('#')[0];
  } catch {
    return null;
  }
}

/** Expand a srcset attribute into its candidate URLs. */
function fromSrcset(value, base) {
  return value
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .map((ref) => resolve(ref, base))
    .filter(Boolean);
}

/**
 * Discover SUB-RESOURCES only — never navigation.
 *
 * `<a href>` is deliberately excluded: following it walks the whole site (the
 * /fx Next.js app, multi-megabyte gallery videos) instead of mirroring the
 * dependencies of the page under study.
 */
const SUBRESOURCE_TAGS = /<(link|script|img|source|video|audio|iframe|embed|track|object)\b([^>]*)>/gi;

function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match ? match[1] : null;
}

function discoverInHtml(html, base) {
  const found = new Set();
  for (const [, tag, attrs] of html.matchAll(SUBRESOURCE_TAGS)) {
    const lower = tag.toLowerCase();

    // <link> only matters for resources that affect rendering.
    if (lower === 'link') {
      const rel = (attrValue(attrs, 'rel') || '').toLowerCase();
      const isResource = /\b(stylesheet|preload|modulepreload|prefetch|icon|manifest)\b/.test(rel);
      if (!isResource) continue;
    }

    for (const name of ['href', 'src', 'data']) {
      const url = resolve(attrValue(attrs, name), base);
      if (url) found.add(url);
    }
    const srcset = attrValue(attrs, 'srcset');
    if (srcset) for (const url of fromSrcset(srcset, base)) found.add(url);
  }
  return [...found];
}

function discoverInCss(css, base) {
  const found = new Set();
  const urlRef = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  for (const [, ref] of css.matchAll(urlRef)) {
    const url = resolve(ref, base);
    if (url) found.add(url);
  }
  const importRef = /@import\s+(?:url\()?\s*["']([^"']+)["']/gi;
  for (const [, ref] of css.matchAll(importRef)) {
    const url = resolve(ref, base);
    if (url) found.add(url);
  }
  return [...found];
}

/** Map a same-origin URL onto a local mirror path. */
function localPathFor(url, origin, mirrorDir) {
  const { pathname } = new URL(url);
  const relative = pathname === '/' || pathname === '' ? '/index.html' : pathname;
  const unsafe = path.join(mirrorDir, relative);
  const resolved = path.resolve(unsafe);
  // Guard against path traversal from a hostile path segment.
  if (!resolved.startsWith(path.resolve(mirrorDir) + path.sep)) {
    throw new Error(`Refusing to write outside mirror root: ${url}`);
  }
  // Extensionless URLs (e.g. /fx/tools/flow) collide with sibling paths that
  // need the same name as a directory (/fx/tools/flow/faq). Store those as
  // <path>/index.html so both can coexist.
  return path.extname(resolved) ? resolved : path.join(resolved, 'index.html');
}

async function main() {
  const cfg = await readConfig('extractor');
  const mirrorDir = path.join(ARTIFACTS, 'mirror', 'files');
  await ensureDir(mirrorDir);

  const queue = [{ url: cfg.targetUrl, parent: null, depth: 0 }];
  const seen = new Set();
  const records = [];
  const external = [];

  while (queue.length && records.length < cfg.maxAssets) {
    const { url, parent, depth } = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);

    const sameOrigin = url.startsWith(`${cfg.origin}/`) || url === cfg.targetUrl;
    if (!sameOrigin) {
      external.push({
        url,
        parent,
        mirrored: false,
        evidenceClass: 'VERIFY-BLOCKED',
        reason: 'cross-origin resource; not mirrored and not reachable by the browser in this environment',
      });
      continue;
    }

    if (SKIP_BODY_EXTENSIONS.has(path.extname(new URL(url).pathname).toLowerCase())) {
      records.push({
        url,
        parent,
        depth,
        status: null,
        contentType: 'media/skipped',
        size: null,
        sha256: null,
        retrievedAt: new Date().toISOString(),
        evidenceClass: 'OBSERVED-SOURCE',
        bodyMirrored: false,
        reason: 'heavy media: dependency recorded, body intentionally not downloaded',
      });
      log(STAGE, `SKIP-BODY  ${url}`);
      continue;
    }

    const response = await fetchAsset(url, { timeoutSeconds: cfg.fetchTimeoutSeconds });
    const record = {
      url,
      parent,
      depth,
      status: response.status,
      contentType: response.contentType || null,
      size: response.body.length,
      sha256: response.body.length ? sha256(response.body) : null,
      retrievedAt: new Date().toISOString(),
      evidenceClass: response.ok ? 'OBSERVED-SOURCE' : 'VERIFY-BLOCKED',
    };
    if (!response.ok) record.error = response.error || `HTTP ${response.status}`;
    records.push(record);
    log(STAGE, `${response.status} ${record.size.toString().padStart(8)}B  ${url}`);

    if (!response.ok) continue;

    const file = localPathFor(url, cfg.origin, mirrorDir);
    await ensureDir(path.dirname(file));
    await fs.writeFile(file, response.body);
    record.localPath = path.relative(ARTIFACTS, file);

    if (depth >= cfg.maxCrawlDepth) continue;
    if (!TEXTUAL.has(record.contentType)) continue;

    const text = response.body.toString('utf8');

    // JavaScript is deliberately NOT scanned. A minified bundle contains
    // expressions like `url(t,document.baseURI)` that a static url() matcher
    // happily mistakes for asset references, yielding dozens of bogus requests
    // that resolve to the SPA fallback. Assets a bundle loads at runtime are
    // captured authoritatively in Stage 4 by recording real browser requests.
    let children = [];
    if (record.contentType === 'text/css') {
      children = discoverInCss(text, url);
    } else if (record.contentType === 'text/html') {
      children = discoverInHtml(text, url).concat(discoverInCss(text, url));
    }

    for (const child of children) {
      if (!seen.has(child)) queue.push({ url: child, parent: url, depth: depth + 1 });
    }
  }

  const manifest = {
    ...runMetadata(STAGE),
    target: cfg.targetUrl,
    origin: cfg.origin,
    counts: {
      mirrored: records.filter((r) => r.evidenceClass === 'OBSERVED-SOURCE').length,
      failed: records.filter((r) => r.evidenceClass === 'VERIFY-BLOCKED').length,
      external: external.length,
    },
    assets: records,
    externalDependencies: external,
  };
  manifest.canonicalHash = canonicalHash({ assets: records, external });

  await writeJson(path.join(ARTIFACTS, 'mirror', 'mirror-manifest.json'), manifest);

  log(STAGE, `mirrored=${manifest.counts.mirrored} failed=${manifest.counts.failed} external=${manifest.counts.external}`);
  log(STAGE, `canonicalHash=${manifest.canonicalHash}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
