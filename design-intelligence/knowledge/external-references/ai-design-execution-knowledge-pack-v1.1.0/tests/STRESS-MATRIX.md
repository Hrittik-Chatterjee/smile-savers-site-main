# Adversarial Stress Matrix

## Capture

- duplicate hook delivery → idempotency handling
- out-of-order events → causal links must not be guessed
- malformed JSON → preserved as invalid/raw event
- session resume/compact/clear → explicit lifecycle classification
- subagent event → separate agent/session linkage
- interrupted command → exit state retained as UNKNOWN if unavailable
- missing transcript → VERIFY-BLOCKED, never reconstructed

## Cache

- corrupt object → hash mismatch / NO-GO
- interrupted write → object absent or invalid, never partially trusted
- URL changes bytes → new hash/object + revalidation
- duplicate URLs same bytes → one content object, multiple locators
- offline missing dependency → fail closed
- secret-like payload → reject/redact before persistence

## Evidence

- missing source → VERIFY-BLOCKED
- unsupported status escalation → reject
- contradiction → classify responsive/state/theme/variant/extraction-error or unresolved contradiction
- stale volatile source → revalidate
- mapped M3/M3E claim presented as provenance → reject

## Design extraction

- runtime-discovered asset
- dynamic carousel
- font mismatch
- reduced-motion difference
- responsive breakpoint transition
- invalid selector reduction
- JS-generated DOM
- animation ordering contamination

## Token system

- orphan token
- circular alias
- duplicate semantic role
- conflicting values
- raw Labs color leaking into Smile Savers grammar
- Google Sans reference leaking into production token layer

## Release

- baseline drift
- pre-existing defect attribution error
- CI failure caused by external credential/environment
- accidental production source mutation
- stack migration detected outside locked scope

Every case requires expected classification, actual classification, artifact, command, environment, and final gate.
