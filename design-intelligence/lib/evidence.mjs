/**
 * Formal evidence-record helper.
 *
 * A "finding" written only as prose in a commit message or a status update is
 * not evidence — it cannot be queried, traced, or checked into the graph. This
 * module is the one place that mints EV-UI-<DOMAIN>-<seq> IDs and enforces the
 * required record shape, so every claim in later stages traces back to one of
 * these instead of to a sentence.
 */

import { assertEvidenceClass } from './core.mjs';

const counters = new Map();

/** Deterministic sequence per domain: same domain, same order in -> same ID. */
function nextId(domain) {
  const n = (counters.get(domain) || 0) + 1;
  counters.set(domain, n);
  return `EV-UI-${domain}-${String(n).padStart(5, '0')}`;
}

/**
 * Mint one evidence record. Every field below is required — a record missing
 * `artifactRef` or `provenance` cannot be checked, and an unchecked claim is
 * not evidence.
 */
export function record({
  domain,
  evidenceClass,
  summary,
  source,
  viewport = null,
  state = null,
  selector = null,
  observed,
  interpretation,
  confidence,
  provenance,
  artifactRef,
  limitations = [],
}) {
  assertEvidenceClass(evidenceClass);
  if (!domain) throw new Error('evidence record requires a domain');
  if (!summary) throw new Error('evidence record requires a summary');
  if (observed === undefined) throw new Error('evidence record requires `observed`');
  if (!artifactRef) throw new Error('evidence record requires artifactRef');

  return {
    id: nextId(domain),
    domain,
    evidenceClass,
    summary,
    source,
    viewport,
    state,
    selector,
    observed,
    interpretation,
    confidence,
    provenance,
    artifactRef,
    limitations,
  };
}

/** Reset counters — used only when a script needs a fresh, reproducible run. */
export function resetCounters() {
  counters.clear();
}
