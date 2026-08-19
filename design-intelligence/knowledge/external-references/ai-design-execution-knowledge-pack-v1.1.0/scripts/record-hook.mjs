#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks);
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    payload = { rawText: raw.toString('utf8') };
  }
  const event = {
    schemaVersion: '1.1.0',
    eventId: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    eventType: payload.hook_event_name || 'UNKNOWN',
    sessionId: payload.session_id || 'UNKNOWN',
    payloadHash: hash,
    payload,
  };
  const dir = process.env.DESIGN_INTELLIGENCE_EVENT_DIR || 'design-intelligence/execution/events';
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, 'events.jsonl'), JSON.stringify(event) + '\n');
});
