#!/usr/bin/env node
/**
 * Hook-invoked event recorder.
 *
 * Claude Code calls this script via a configured hook, passing a JSON payload
 * on stdin. This script does NOT assume a specific schema for that payload —
 * the exact fields Claude Code sends for a given hook event were not
 * independently reconfirmed against current documentation this session (see
 * CAPABILITY-MATRIX.json), so the raw payload is stored verbatim under
 * `rawPayload` rather than picked apart into fields that might not exist.
 *
 * This script must NEVER fail the hook: a non-zero exit or thrown error here
 * could block or disrupt the actual Claude Code session. Every code path
 * below is wrapped so recording failures degrade to silent no-ops, never to
 * a blocked tool call.
 *
 * Events are appended to a session-scoped JSONL ledger, hash-chained so that
 * a gap or edit in the file (not just single-byte corruption) is detectable:
 * each event's `previousEventHash` must equal the SHA-256 of the prior line's
 * canonical JSON, computed the same way lib/core.mjs computes canonical
 * hashes elsewhere in this project (volatile keys excluded).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const LEDGER_DIR = path.join(
  process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  'design-intelligence',
  'execution-intelligence',
  'ledger'
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    // Hard timeout — if stdin never closes, don't hang the hook.
    setTimeout(() => resolve(data), 2000);
  });
}

async function main() {
  const hookEventName = process.argv[2] || 'UNKNOWN_HOOK_EVENT';
  const raw = await readStdin();

  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { unparsedRaw: raw.slice(0, 2000) };
  }

  const sessionId = payload.session_id || payload.sessionId || 'unknown-session';
  const ledgerFile = path.join(LEDGER_DIR, `${sessionId}.jsonl`);

  fs.mkdirSync(LEDGER_DIR, { recursive: true });

  let previousEventHash = null;
  if (fs.existsSync(ledgerFile)) {
    const lines = fs.readFileSync(ledgerFile, 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length) {
      try {
        const lastEvent = JSON.parse(lines[lines.length - 1]);
        previousEventHash = lastEvent.eventHash || null;
      } catch {
        previousEventHash = 'CHAIN_BROKEN_UNPARSEABLE_PRIOR_LINE';
      }
    }
  }

  // payloadHash covers ONLY the raw bytes received on stdin — independent of
  // how this script structures the event around it. Adopted from an external
  // reference pack's record-hook.mjs: a useful property that script lacked
  // elsewhere (hash-chaining), so it's worth taking on its own merits rather
  // than dismissed because the rest of that script was weaker.
  const payloadHash = sha256(raw);

  const event = {
    eventId: crypto.randomUUID(),
    schemaVersion: '1.1.0',
    sessionId,
    hookEventName,
    timestamp: new Date().toISOString(),
    previousEventHash,
    payloadHash,
    rawPayload: payload,
    note: 'rawPayload schema is NOT independently verified against current Claude Code documentation this session — stored verbatim, not parsed into typed fields.',
  };
  event.eventHash = sha256(JSON.stringify(canonicalize(event)));

  fs.appendFileSync(ledgerFile, `${JSON.stringify(event)}\n`);
}

main()
  .catch(() => {
    // Recording must never block or fail the actual hook — see docstring.
  })
  .finally(() => process.exit(0));
