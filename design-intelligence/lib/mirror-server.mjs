/**
 * Serves the mirrored source tree on localhost so Chromium can render it.
 *
 * Chromium cannot reach labs.google in this environment (proven: connection
 * reset with proxy, without proxy, and unsandboxed), but it renders localhost
 * perfectly. Serving the mirror is what makes runtime evidence obtainable at all.
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { ARTIFACTS } from './core.mjs';

const MIRROR_ROOT = path.join(ARTIFACTS, 'mirror', 'files');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

export async function startMirrorServer(port) {
  await fsp.access(MIRROR_ROOT).catch(() => {
    throw new Error(`Mirror not found at ${MIRROR_ROOT}. Run \`npm run mirror\` first.`);
  });

  const server = http.createServer((req, res) => {
    let pathname;
    try {
      ({ pathname } = new URL(req.url, 'http://127.0.0.1'));
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }

    const decoded = decodeURIComponent(pathname);
    let file = path.resolve(path.join(MIRROR_ROOT, decoded === '/' ? '/index.html' : decoded));

    // Never serve outside the mirror root.
    if (file !== MIRROR_ROOT && !file.startsWith(MIRROR_ROOT + path.sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      // Mirror gaps are expected (skipped media, runtime-loaded assets). Return
      // 404 so Stage 4 can record precisely what the page could not obtain.
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not mirrored');
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${port}/`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
