import { loadTruth, loadDecisions, loadDebtRegister } from './state.js';
import type { ContextCompilerInput, ContextCompilerOutput, TruthEntity, Decision, DebtItem } from './types.js';

/**
 * Deterministic context compiler (AC3). Given a task description, selects
 * only the truth entities / decisions / debt items / files whose text
 * overlaps the task -- no LLM call, no ranking model, just substring
 * matching against small, already-persisted corpora. Two identical
 * inputs against identical repo state always produce identical output
 * (AC2): there is no randomness or model call anywhere in this function.
 *
 * This is deliberately simple. A smarter retrieval method (embeddings,
 * fuzzy matching) would improve recall but break AC2's determinism
 * requirement and add a dependency this "minimal dependency footprint"
 * tool doesn't need yet -- see knowledge/ for the project's general
 * preference against adding infrastructure ahead of a measured need.
 */
// Deliberately small: this exists only because dogfooding this exact
// module (running `eais context "investigate the domain canonicalization
// issue without changing anything"`) surfaced a real false-positive --
// "without" is common enough to appear in both an arbitrary task
// description and an unrelated debt item's title (DEBT-0002's "...success
// without successful delivery"), pulling in irrelevant context. Extend
// this list only when a similar dogfooding failure demonstrates the need,
// not preemptively.
const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'without', 'from', 'that', 'this', 'issue', 'anything']);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function overlaps(taskTokens: Set<string>, haystack: string): boolean {
  const haystackTokens = tokenize(haystack);
  return haystackTokens.some((t) => taskTokens.has(t));
}

const TASK_CLASS_KEYWORDS: Record<string, string[]> = {
  RUNTIME_MIGRATION: ['cloudflare', 'workers', 'pages', 'wrangler', 'deploy', 'entrypoint'],
  CONTACT_API: ['contact', 'resend', 'email', 'form'],
  CHAT_API: ['chat', 'ai', 'workers-ai', 'rate', 'limit'],
  DOMAIN_TRUTH: ['domain', 'canonical', 'coordinates', 'hours', 'address'],
  TESTING: ['test', 'coverage', 'tdd', 'regression'],
  ACCESSIBILITY: ['accessibility', 'a11y', 'wcag'],
};

function classifyTask(task: string): string {
  const tokens = new Set(tokenize(task));
  for (const [cls, keywords] of Object.entries(TASK_CLASS_KEYWORDS)) {
    if (keywords.some((k) => tokens.has(k))) return cls;
  }
  return 'UNKNOWN';
}

export async function compileContext(input: ContextCompilerInput): Promise<ContextCompilerOutput> {
  const taskTokens = new Set(tokenize(input.task));
  const [truth, decisions, debt] = await Promise.all([loadTruth(), loadDecisions(), loadDebtRegister()]);

  const relevantTruth: TruthEntity[] = truth.entities.filter(
    (e) => overlaps(taskTokens, e.id) || overlaps(taskTokens, e.field)
  );
  const relevantDecisions: Decision[] = decisions.decisions.filter((d) => overlaps(taskTokens, d.decision));
  const relevantDebt: DebtItem[] = debt.items.filter(
    (d) => overlaps(taskTokens, d.title) || overlaps(taskTokens, d.domain)
  );

  const files = new Set<string>();
  for (const d of relevantDebt) for (const f of d.affected_files) files.add(f);

  const tests = relevantDebt
    .flatMap((d) => d.verification)
    .filter((v) => typeof v === 'string');

  // Token-efficiency measurement (section 11 / AC3): baseline = the full
  // truth+decisions+debt corpus a naive "just load everything" approach
  // would send; compiled = only what this function actually selected.
  const fullCorpusBytes =
    Buffer.byteLength(JSON.stringify(truth)) +
    Buffer.byteLength(JSON.stringify(decisions)) +
    Buffer.byteLength(JSON.stringify(debt));
  const compiledBytes =
    Buffer.byteLength(JSON.stringify(relevantTruth)) +
    Buffer.byteLength(JSON.stringify(relevantDecisions)) +
    Buffer.byteLength(JSON.stringify(relevantDebt));
  const reductionPct = fullCorpusBytes === 0 ? 0 : Math.round((1 - compiledBytes / fullCorpusBytes) * 1000) / 10;

  return {
    task: input.task,
    taskClass: classifyTask(input.task),
    requiredTruth: relevantTruth.map((e) => e.id),
    requiredDecisions: relevantDecisions.map((d) => d.id),
    requiredDebt: relevantDebt.map((d) => d.id),
    files: [...files].sort(),
    tests: [...new Set(tests)],
    tokenEstimate: {
      fullRepoBaselineBytes: fullCorpusBytes,
      compiledContextBytes: compiledBytes,
      reductionPct,
    },
  };
}
