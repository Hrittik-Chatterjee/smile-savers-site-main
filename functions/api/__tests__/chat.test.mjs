/**
 * TDD-after-the-fact regression tests for the chat rate limiter added in
 * Wave 1 (commit cd7d6d7, DEBT-0007 — audit SEC-003: the header comment
 * claimed KV/IP rate limiting existed, but no such code did before this
 * fix). Also covers the AI-binding-missing fallback (audit's "AI failure
 * != website failure" invariant).
 *
 * Run: node --test functions/api/__tests__/
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../chat.js';

function buildRequest(body, ip = '203.0.113.7') {
  return new Request('https://dentalsmilesavers.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

/** In-memory fake matching the KV subset chat.js actually uses (get/put with expirationTtl). */
function fakeKv() {
  const store = new Map();
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

test('allows requests under the rate limit', async () => {
  const env = { CHAT_CACHE: fakeKv() };
  const request = buildRequest({ message: 'What are your hours?' });
  const response = await onRequestPost({ request, env });
  assert.notEqual(response.status, 429);
});

test('blocks the 21st request from the same IP within the window', async () => {
  const env = { CHAT_CACHE: fakeKv() };
  let lastResponse;
  for (let i = 0; i < 21; i++) {
    const request = buildRequest({ message: `question number ${i}` });
    lastResponse = await onRequestPost({ request, env });
  }
  assert.equal(lastResponse.status, 429);
  const body = await lastResponse.json();
  assert.match(body.reply, /wait|call/i);
});

test('does not rate-limit a different IP after one IP is exhausted', async () => {
  const env = { CHAT_CACHE: fakeKv() };
  for (let i = 0; i < 21; i++) {
    await onRequestPost({ request: buildRequest({ message: 'q' }, '203.0.113.7'), env });
  }
  const response = await onRequestPost({ request: buildRequest({ message: 'q' }, '198.51.100.9'), env });
  assert.notEqual(response.status, 429, 'rate limit must be scoped per-IP, not global');
});

test('fails open (does not block) when CHAT_CACHE is not bound', async () => {
  const env = {}; // no CHAT_CACHE — matches production today, until the KV namespace is provisioned
  let lastResponse;
  for (let i = 0; i < 25; i++) {
    lastResponse = await onRequestPost({ request: buildRequest({ message: 'q' }), env });
  }
  assert.notEqual(lastResponse.status, 429, 'documented fail-open behavior: unbound CHAT_CACHE must not block requests');
});

test('AI binding missing returns a graceful fallback, not an error (AI failure != website failure)', async () => {
  const env = { CHAT_CACHE: fakeKv() }; // no AI binding
  const request = buildRequest({ message: 'Do you take my insurance?' });
  const response = await onRequestPost({ request, env });
  const body = await response.json();

  assert.equal(response.status, 200, 'a missing AI binding must not surface as an HTTP error to the user');
  assert.match(body.reply, /call|(718)/i, 'fallback reply must direct the patient to a working channel');
});

test('rejects an empty message', async () => {
  const env = { CHAT_CACHE: fakeKv() };
  const request = buildRequest({ message: '' });
  const response = await onRequestPost({ request, env });
  assert.equal(response.status, 400);
});
