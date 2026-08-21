/**
 * Minimal agent-context contract (P1).
 *
 * Deliberately small: substring-matches a task string against token
 * names/domains and assembles one JSON packet from data already computed
 * by token-inventory.mjs / token-lineage.mjs / change-impact.mjs /
 * constraints.json. No ranking model, no embedding search, no "context
 * compiler" — that was explicitly declined earlier this session as
 * disproportionate (see design-intelligence/knowledge/policies/context-routing.json).
 *
 * Usage: node agent-context.mjs "<task text mentioning a token or domain>"
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { ROOT, writeJson, log } from '../lib/core.mjs';
import { impactForToken } from './lib-change-impact.mjs';

const STAGE = 'agent-context';

async function loadAll() {
  const inv = JSON.parse(await fs.readFile(path.join(ROOT, 'reports', 'token-inventory.json'), 'utf8'));
  const lineage = JSON.parse(await fs.readFile(path.join(ROOT, 'reports', 'token-lineage.json'), 'utf8'));
  const constraints = JSON.parse(
    await fs.readFile(path.join(ROOT, 'knowledge', 'policies', 'constraints.json'), 'utf8')
  );
  return { inv, lineage, constraints };
}

function findRelevantTokens(task, inv) {
  const lower = task.toLowerCase();
  const byName = inv.tokens.filter((t) => lower.includes(t.name.toLowerCase().replace(/^--/, '')));
  if (byName.length > 0) return byName;
  const domains = [...new Set(inv.tokens.map((t) => t.domain))];
  const matchedDomain = domains.find((d) => lower.includes(d));
  return matchedDomain ? inv.tokens.filter((t) => t.domain === matchedDomain) : [];
}

function relevantRelationships(tokenNames, lineage) {
  const out = {};
  for (const type of Object.keys(lineage.edges)) {
    out[type] = lineage.edges[type].filter(
      (e) => tokenNames.includes(e.source) || tokenNames.includes(e.target)
    );
  }
  return out;
}

async function buildPacket(task) {
  const { inv, lineage, constraints } = await loadAll();
  const relevantTokens = findRelevantTokens(task, inv);
  const tokenNames = relevantTokens.map((t) => t.name);

  const relevantImplementation = [
    ...new Set(relevantTokens.flatMap((t) => t.consumers.map((c) => c.file))),
  ];

  const changeImpact = relevantTokens.slice(0, 5).map((t) => impactForToken(t.name, inv, lineage));

  return {
    TASK: task,
    DESIGN_RULES: constraints.constraints.map((c) => c.statement),
    RELEVANT_TOKENS:
      relevantTokens.length > 0
        ? relevantTokens.map((t) => ({
            name: t.name,
            domain: t.domain,
            canonicalValue: t.canonicalValue,
            consumerCount: t.consumerCount,
            orphan: t.orphan,
          }))
        : { status: 'UNKNOWN', reason: 'No token name or domain keyword in task text matched token-inventory.json.' },
    RELEVANT_IMPLEMENTATION: relevantImplementation,
    RELEVANT_RELATIONSHIPS: relevantTokens.length > 0 ? relevantRelationships(tokenNames, lineage) : {},
    CONSTRAINTS: constraints.constraints.map((c) => c.id),
    CHANGE_IMPACT: changeImpact,
    EVIDENCE: {
      tokenInventorySourceSha256: inv.sourceSha256AtCapture,
      evidenceCapturedAt: inv.tokens[0]?.evidenceCapturedAt ?? null,
    },
    VALIDATION: ['npm run check', 'npm run build'],
  };
}

async function main() {
  const task = process.argv.slice(2).join(' ') || '--color-primary';
  const packet = await buildPacket(task);
  await writeJson(path.join(ROOT, 'reports', 'agent-context-report.json'), packet);
  const tokenCount = Array.isArray(packet.RELEVANT_TOKENS) ? packet.RELEVANT_TOKENS.length : 0;
  log(STAGE, `task="${task}" relevantTokens=${tokenCount} relevantFiles=${packet.RELEVANT_IMPLEMENTATION.length}`);
}

main().catch((error) => {
  process.stderr.write(`[${STAGE}] FAILED: ${error.stack}\n`);
  process.exit(1);
});
