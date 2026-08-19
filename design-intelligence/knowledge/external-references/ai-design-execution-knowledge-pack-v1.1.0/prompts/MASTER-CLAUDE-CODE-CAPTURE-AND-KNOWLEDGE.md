# MASTER PROMPT — Claude Code Observable Execution Intelligence + Knowledge Pack

You are operating inside a production repository. This knowledge pack is authoritative only where its status and provenance permit it.

## Mission

Build an evidence-first, reproducible, token-efficient execution-intelligence layer around the current Claude Code workflow.

Capture observable facts only:

- user prompts as received
- explicit user decisions
- lifecycle events
- commands/tools invoked
- arguments only when safe
- stdout/stderr/exit status when observable
- files read/written and hashes when observable
- git state and diffs
- tests/build/lint results
- browser traces/screenshots/DOM/network artifacts when explicitly captured
- errors, retries, recovery and state transitions
- explicit rationale stated by the user or agent

Do NOT claim to capture hidden model chain-of-thought. Do NOT reconstruct private reasoning. If a rationale was not explicitly emitted as an artifact, classify it as UNKNOWN.

## Anthropic grounding

Use Claude Code lifecycle hooks for deterministic capture. Hook inputs include session identifiers and transcript paths; SessionEnd also provides an end reason. Keep capture hooks fast and fail-safe. See the source index for the current official documentation.

## Event model

Every event gets:

- eventId
- sessionId
- turnId when available
- toolUseId when available
- parentEventId when available
- capturedAt
- eventType
- payload hash
- payload reference
- source (hook/transcript/CLI/browser/CI)
- classification

Use append-only JSONL for the event ledger. Store large payloads as content-addressed objects.

## Content-addressed local cache

Use SHA-256(content) as object identity.
Never identify content only by URL.
Never store secrets.
Use atomic temp-file + fsync/rename where practical.
Verify hash after write and after read.
Support CACHE_ONLY, CACHE_PREFERRED, ONLINE_REVALIDATE, ONLINE_FRESH, OFFLINE_REPRODUCTION and PINNED_SNAPSHOT.
Offline mode must fail closed on missing required artifacts.

## Session reconstruction

Use the Claude Code transcript path supplied by hooks when available. Treat transcripts as observable session artifacts, not hidden reasoning. Historical sessions may be incomplete; preserve missingness instead of fabricating events.

## Progressive disclosure

Before execution, load only:

1. locked policy
2. relevant decisions
3. task constraints
4. relevant knowledge
5. evidence on demand
6. fresh research only when required

Do not inject the whole ZIP into context.

## Research policy

Reuse validated research. Re-research only for freshness, contradiction, missing evidence, security/runtime sensitivity, or explicit latest/current requests.
Every external source gets URL, retrieval time, final URL, HTTP status, content hash, and source authority.

## Google Labs / Smile Savers boundary

Labs evidence may inform structural grammar. Do not transfer Google visual identity, Google Sans, Google imagery or Google copy into Smile Savers. Keep the existing Smile Savers brand and production stack.

Classify Labs evidence as OBSERVED-SOURCE, OBSERVED-MIRROR, DERIVED, MAPPED, INFERRED, UNKNOWN or VERIFY-BLOCKED. Never relabel mirror evidence as live runtime observation.

## M3 / M3 Expressive

Material 3 and M3 Expressive are cross-reference knowledge. M3 documentation establishes M3/M3E concepts; it does not establish Labs implementation provenance. Keep MAPPED separate from provenance.

## Promotion gate

A session finding becomes reusable knowledge only after:

1. schema validation
2. provenance check
3. contradiction check
4. freshness check
5. secret scan
6. reproducibility check where applicable
7. status assignment
8. promotion record

Allowed promotion statuses: VERIFIED, DERIVED, MAPPED, INFERRED. UNKNOWN and VERIFY-BLOCKED remain non-authoritative.

## Release gate

Every gate reports status, measurement, threshold, artifact, evidence IDs, command, environment and blocker.
Allowed: GO, CONDITIONAL-GO, NO-GO, VERIFY-BLOCKED, NOT-APPLICABLE.

The objective is not to manufacture GO. The objective is to make the result provable.
