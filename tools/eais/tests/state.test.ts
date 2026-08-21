import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadState, loadTruth, loadDecisions, loadReleaseGate, loadDebtRegister } from '../src/state.js';

test('loadState reads the real .ai/state/current.json', async () => {
  const state = await loadState();
  assert.ok(state.currentMilestone.length > 0);
  assert.ok(Array.isArray(state.openBlockers));
});

test('loadTruth reads real canonical entities', async () => {
  const truth = await loadTruth();
  assert.ok(truth.entities.length > 0);
  const domainEntity = truth.entities.find((e) => e.id === 'clinic.domain');
  assert.ok(domainEntity, 'expected the clinic.domain entity to exist');
  assert.equal(domainEntity?.canonical_value, 'https://dentalsmilesavers.com');
});

test('loadDecisions reads the real ADR register', async () => {
  const decisions = await loadDecisions();
  assert.ok(decisions.decisions.some((d) => d.id === 'ADR-0001'));
});

test('loadReleaseGate reads the real gate state', async () => {
  const gate = await loadReleaseGate();
  assert.ok(Object.keys(gate.gates).length > 0);
});

test('loadDebtRegister finds the latest run directory and reads real debt items', async () => {
  const debt = await loadDebtRegister();
  assert.ok(debt.items.length > 0);
  assert.ok(debt.items.some((d) => d.id === 'DEBT-0011' && d.status === 'RESOLVED'));
});
