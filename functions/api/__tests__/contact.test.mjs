/**
 * TDD-after-the-fact regression tests for the fail-closed contact-API
 * behavior fixed in Wave 1 (commit cd7d6d7, DEBT-0002/DEBT-0003 —
 * audit/eais/20260819T133000Z/MASTER-DEBT-REGISTER.json). Before that fix,
 * onRequestPost returned {success:true} even when no delivery mechanism
 * was configured or the delivery attempt failed. These tests exist to make
 * sure that regression can't silently return — this is the first
 * automated test coverage this repository has ever had (ROOT-TEST-001).
 *
 * Run: node --test functions/api/__tests__/
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../contact.js';

let originalFetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function buildRequest(fields = {}) {
  const form = new FormData();
  form.set('name', fields.name ?? 'Test Patient');
  form.set('email', fields.email ?? 'patient@example.com');
  form.set('phone', fields.phone ?? '');
  form.set('service', fields.service ?? '');
  form.set('message', fields.message ?? 'Test message body.');
  form.set('newPatient', fields.newPatient ?? 'no');
  form.set('urgency', fields.urgency ?? '');
  return new Request('https://dentalsmilesavers.com/api/contact', {
    method: 'POST',
    body: form,
  });
}

test('missing RESEND_API_KEY fails closed (does not report success)', async () => {
  const request = buildRequest();
  const response = await onRequestPost({ request, env: {} });
  const body = await response.json();

  assert.equal(response.status, 503, 'must not return a 2xx status when nothing can deliver the message');
  assert.equal(body.success, false, 'must not report success when delivery was never attempted');
  assert.ok(body.correlationId, 'must return a correlation ID for support to trace the submission');
  assert.match(body.error, /call/i, 'error message should direct the patient to an alternate channel');
});

test('failed Resend delivery to the clinic fails closed', async () => {
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    // First call = clinic notification (must fail); second call = best-effort
    // auto-reply, whose outcome must not affect the response either way.
    return new Response('{}', { status: callCount === 1 ? 500 : 200 });
  };

  const request = buildRequest();
  const response = await onRequestPost({ request, env: { RESEND_API_KEY: 'test-key' } });
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.success, false);
  assert.ok(body.correlationId);
});

test('successful Resend delivery reports success', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 200 });

  const request = buildRequest();
  const response = await onRequestPost({ request, env: { RESEND_API_KEY: 'test-key' } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.correlationId);
});

test('auto-reply failure does not affect the response (best-effort, decoupled)', async () => {
  let callCount = 0;
  globalThis.fetch = async () => {
    callCount += 1;
    // Clinic notification succeeds; auto-reply throws entirely.
    if (callCount === 1) return new Response('{}', { status: 200 });
    throw new Error('network error sending auto-reply');
  };

  const request = buildRequest();
  const response = await onRequestPost({ request, env: { RESEND_API_KEY: 'test-key' } });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true, 'clinic notification succeeded; auto-reply failure must not surface as an error');
});

test('rejects a submission missing required fields', async () => {
  const form = new FormData();
  form.set('name', '');
  form.set('email', '');
  form.set('message', '');
  const request = new Request('https://dentalsmilesavers.com/api/contact', { method: 'POST', body: form });

  const response = await onRequestPost({ request, env: {} });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
});
