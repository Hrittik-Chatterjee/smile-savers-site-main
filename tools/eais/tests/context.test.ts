import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileContext } from '../src/context.js';

test('AC2: identical task + identical repo state produces identical output', async () => {
  const a = await compileContext({ task: 'fix the cloudflare workers entrypoint routing' });
  const b = await compileContext({ task: 'fix the cloudflare workers entrypoint routing' });
  assert.deepEqual(a, b);
});

test('AC3: context compiler selects a strict subset and reports measurable reduction', async () => {
  const result = await compileContext({ task: 'investigate the domain canonicalization issue' });
  assert.equal(result.taskClass, 'DOMAIN_TRUTH');
  assert.ok(result.requiredTruth.includes('clinic.domain'), 'should select the clinic.domain truth entity');
  assert.ok(
    result.tokenEstimate.compiledContextBytes < result.tokenEstimate.fullRepoBaselineBytes,
    'compiled context must be smaller than the full corpus'
  );
  assert.ok(result.tokenEstimate.reductionPct > 0, 'reduction percentage must be positive for a scoped task');
});

test('an unrecognized task still returns a valid (empty) compiled context, not an error', async () => {
  const result = await compileContext({ task: 'xyzzy plugh completely unrelated nonsense words' });
  assert.equal(result.taskClass, 'UNKNOWN');
  assert.deepEqual(result.requiredTruth, []);
});

test('a Cloudflare-related task selects the runtime architecture decision', async () => {
  const result = await compileContext({ task: 'should we migrate to cloudflare workers or pages' });
  assert.equal(result.taskClass, 'RUNTIME_MIGRATION');
  assert.ok(result.requiredDecisions.includes('ADR-0001'));
});
