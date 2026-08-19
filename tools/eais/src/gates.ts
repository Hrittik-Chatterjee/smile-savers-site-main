import type { ReleaseGate } from './types.js';

/**
 * Deterministic gate evaluation -- no LLM judgment involved. Given the
 * persisted release-gate state, decide whether a release/milestone claim
 * is actually supportable. This is the "AI advises, gates decide"
 * invariant made concrete: nothing here summarizes or infers, it only
 * reads statuses already written by a verification step elsewhere.
 */
export function overallStatus(gate: ReleaseGate): 'GO' | 'CONDITIONAL-GO' | 'NO-GO' | 'REMEDIATION-IN-PROGRESS' {
  const statuses = Object.values(gate.gates).map((g) => g.status);
  if (statuses.some((s) => s === 'NO-GO')) return 'NO-GO';
  if (statuses.some((s) => s === 'PENDING_VERIFICATION' || s === 'VERIFY-BLOCKED' || s === 'UNVERIFIED')) {
    return 'REMEDIATION-IN-PROGRESS';
  }
  if (statuses.some((s) => s === 'CONDITIONAL-GO')) return 'CONDITIONAL-GO';
  return 'GO';
}

export function blockingGates(gate: ReleaseGate): string[] {
  return Object.entries(gate.gates)
    .filter(([, v]) => v.status === 'NO-GO')
    .map(([k]) => k);
}
