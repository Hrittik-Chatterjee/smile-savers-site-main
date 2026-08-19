/**
 * Shared primitives for the design-intelligence harness.
 *
 * Design notes:
 * - Network I/O goes through `curl`, not node:fetch. curl is the only client
 *   proven to traverse this environment's agent proxy + CA bundle; node's
 *   global fetch does not read HTTPS_PROXY.
 * - Hashes are split into CANONICAL (deterministic, gated) and METADATA
 *   (timestamps/env, exempt). The reproducibility gate compares canonical only.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

export const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const ARTIFACTS = path.join(ROOT, 'artifacts');

/** The only evidence classes permitted anywhere in this system. */
export const EVIDENCE_CLASSES = Object.freeze([
  'OBSERVED-SOURCE',
  'OBSERVED-MIRROR',
  'DERIVED',
  'MAPPED',
  'INFERRED',
  'UNKNOWN',
  'VERIFY-BLOCKED',
]);

export function assertEvidenceClass(cls) {
  if (!EVIDENCE_CLASSES.includes(cls)) {
    throw new Error(
      `Illegal evidence class "${cls}". Permitted: ${EVIDENCE_CLASSES.join(', ')}`
    );
  }
  return cls;
}

export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/**
 * Canonical hash: stable across runs. Keys are sorted and volatile fields are
 * stripped, so re-running the pipeline yields an identical digest.
 */
const VOLATILE_KEYS = new Set([
  'retrievedAt', 'timestamp', 'capturedAt', 'executionId', 'durationMs',
  'userAgent', 'ua', 'environment', 'generatedAt', 'elapsedMs',
]);

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (VOLATILE_KEYS.has(key)) continue;
      out[key] = canonicalize(value[key]);
    }
    return out;
  }
  return value;
}

export const canonicalHash = (value) => sha256(JSON.stringify(canonicalize(value)));

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

export async function readConfig(name) {
  return readJson(path.join(ROOT, 'config', `${name}.json`));
}

/**
 * Fetch a URL via curl. Returns the body as a Buffer plus response metadata.
 * Never throws on HTTP errors — the caller records the status as evidence.
 */
export async function fetchAsset(url, { timeoutSeconds = 45 } = {}) {
  const marker = '\n===CURL-META===\n';
  const args = [
    '-sS', '--compressed', '--location',
    '--max-time', String(timeoutSeconds),
    '--write-out', `${marker}%{http_code}\t%{content_type}\t%{size_download}\t%{url_effective}`,
    '--output', '-',
    url,
  ];
  try {
    const { stdout } = await execFileAsync('curl', args, {
      encoding: 'buffer',
      maxBuffer: 128 * 1024 * 1024,
    });
    const buf = Buffer.from(stdout);
    const idx = buf.lastIndexOf(Buffer.from(marker));
    if (idx === -1) {
      return { ok: false, status: 0, body: buf, error: 'curl metadata marker missing' };
    }
    const body = buf.subarray(0, idx);
    const [status, contentType, size, effectiveUrl] = buf
      .subarray(idx + Buffer.byteLength(marker))
      .toString('utf8')
      .split('\t');
    return {
      ok: Number(status) >= 200 && Number(status) < 400,
      status: Number(status),
      contentType: (contentType || '').split(';')[0].trim(),
      size: Number(size),
      effectiveUrl,
      body,
    };
  } catch (error) {
    return { ok: false, status: 0, body: Buffer.alloc(0), error: error.message };
  }
}

/** Metadata block — deliberately excluded from canonical hashing. */
export function runMetadata(stage) {
  return {
    stage,
    generatedAt: new Date().toISOString(),
    executionId: crypto.randomUUID(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };
}

export function log(stage, message) {
  process.stdout.write(`[${stage}] ${message}\n`);
}
