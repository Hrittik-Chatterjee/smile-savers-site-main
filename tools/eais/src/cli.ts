#!/usr/bin/env node
import { loadState, loadTruth, loadDecisions, loadReleaseGate, loadDebtRegister } from './state.js';
import { overallStatus, blockingGates } from './gates.js';
import { compileContext } from './context.js';

async function main() {
  const [, , command, ...rest] = process.argv;

  switch (command) {
    case 'state': {
      const state = await loadState();
      console.log(JSON.stringify(state, null, 2));
      break;
    }
    case 'truth': {
      const truth = await loadTruth();
      console.log(JSON.stringify(truth.entities.map((e) => ({ id: e.id, value: e.canonical_value, status: e.status })), null, 2));
      break;
    }
    case 'decisions': {
      const decisions = await loadDecisions();
      console.log(JSON.stringify(decisions.decisions.map((d) => ({ id: d.id, decision: d.decision, status: d.status, confidence: d.confidence })), null, 2));
      break;
    }
    case 'gate': {
      const gate = await loadReleaseGate();
      const status = overallStatus(gate);
      console.log(`overall: ${status}`);
      const blockers = blockingGates(gate);
      if (blockers.length > 0) console.log(`blocking: ${blockers.join(', ')}`);
      break;
    }
    case 'debt': {
      const debt = await loadDebtRegister();
      const open = debt.items.filter((d) => d.status === 'OPEN');
      console.log(`${open.length}/${debt.count} debt items OPEN`);
      for (const d of open) console.log(`  [${d.severity}] ${d.id}: ${d.title}`);
      break;
    }
    case 'context': {
      const task = rest.join(' ');
      if (!task) {
        console.error('Usage: eais context "<task description>"');
        process.exitCode = 1;
        return;
      }
      const compiled = await compileContext({ task });
      console.log(JSON.stringify(compiled, null, 2));
      break;
    }
    default: {
      console.log('Usage: eais <state|truth|decisions|gate|debt|context "<task>">');
      process.exitCode = command ? 1 : 0;
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack : err);
  process.exitCode = 1;
});
