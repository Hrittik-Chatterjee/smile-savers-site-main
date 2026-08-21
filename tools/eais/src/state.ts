import fs from 'node:fs/promises';
import path from 'node:path';
import { AI_DIR, AUDIT_EAIS_DIR } from './paths.js';
import type { StateFile, TruthModel, DecisionRegister, DebtRegister, ReleaseGate } from './types.js';

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

/** Most recent audit/eais/<run-id>/ directory, by lexicographic (ISO-timestamp) order. */
export async function latestRunDir(): Promise<string> {
  const entries = await fs.readdir(AUDIT_EAIS_DIR, { withFileTypes: true });
  const runs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  if (runs.length === 0) throw new Error(`No run directories found under ${AUDIT_EAIS_DIR}`);
  return path.join(AUDIT_EAIS_DIR, runs[runs.length - 1]!);
}

export async function loadState(): Promise<StateFile> {
  return readJson<StateFile>(path.join(AI_DIR, 'state', 'current.json'));
}

export async function loadTruth(): Promise<TruthModel> {
  return readJson<TruthModel>(path.join(AI_DIR, 'truth', 'canonical.json'));
}

export async function loadDecisions(): Promise<DecisionRegister> {
  return readJson<DecisionRegister>(path.join(AI_DIR, 'decisions', 'ADR-REGISTER.json'));
}

export async function loadReleaseGate(): Promise<ReleaseGate> {
  return readJson<ReleaseGate>(path.join(AI_DIR, 'gates', 'release.json'));
}

export async function loadDebtRegister(): Promise<DebtRegister> {
  const run = await latestRunDir();
  return readJson<DebtRegister>(path.join(run, 'MASTER-DEBT-REGISTER.json'));
}

export async function saveState(state: StateFile): Promise<void> {
  const p = path.join(AI_DIR, 'state', 'current.json');
  await fs.writeFile(p, JSON.stringify(state, null, 2) + '\n', 'utf8');
}
