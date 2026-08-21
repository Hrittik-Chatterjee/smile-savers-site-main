/**
 * Shared types for the EAIS control plane. Kept intentionally small --
 * these mirror the JSON shapes already persisted under .ai/ and
 * audit/eais/ by this session's earlier (non-TypeScript) work, not a
 * speculative schema invented ahead of real data.
 */

export interface StateFile {
  updatedAt: string;
  currentMilestone: string;
  completedGates: string[];
  openBlockers: Array<{ id: string; severity: string; summary: string }>;
  knownUnknowns: string[];
  stackBaseline: string;
  nextRequiredAction: string;
}

export interface TruthEntity {
  id: string;
  field: string;
  canonical_value: string;
  authority: string;
  evidence: string[];
  consumers: string[];
  conflicts: string[];
  status: 'VERIFIED' | 'CONTRADICTED' | 'UNVERIFIED' | 'UNKNOWN';
  last_verified: string | null;
  review_due: string | null;
}

export interface TruthModel {
  generatedAt: string;
  note: string;
  entities: TruthEntity[];
}

export interface Decision {
  id: string;
  decision: string;
  status: string;
  context: string;
  alternatives: string[];
  evidence: string[];
  counterevidence: string[];
  tradeoffs: string[];
  confidence: number;
  reversal_conditions: string[];
  verification_plan: string[];
}

export interface DecisionRegister {
  generatedAt: string;
  count: number;
  decisions: Decision[];
}

export interface DebtItem {
  id: string;
  root_cause_id: string;
  domain: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3' | 'INFO';
  confidence: number;
  status: string;
  title: string;
  description: string;
  evidence: string[];
  affected_files: string[];
  affected_systems: string[];
  dependents: string[];
  verification: string[];
}

export interface DebtRegister {
  generatedAt: string;
  count: number;
  items: DebtItem[];
}

export interface GateResult {
  status: string;
  reason: string;
}

export interface ReleaseGate {
  generatedAt: string;
  state: string;
  overall: string;
  note: string;
  gates: Record<string, GateResult>;
}

export interface ContextCompilerInput {
  task: string;
}

export interface ContextCompilerOutput {
  task: string;
  taskClass: string;
  requiredTruth: string[];
  requiredDecisions: string[];
  requiredDebt: string[];
  files: string[];
  tests: string[];
  tokenEstimate: {
    fullRepoBaselineBytes: number;
    compiledContextBytes: number;
    reductionPct: number;
  };
}
