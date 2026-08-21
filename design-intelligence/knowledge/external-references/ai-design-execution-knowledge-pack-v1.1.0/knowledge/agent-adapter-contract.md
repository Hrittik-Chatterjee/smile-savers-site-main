# Agent-neutral adapter contract

The knowledge graph and evidence IDs are agent-neutral. Claude Code, Codex, OpenCode, Cursor and future adapters translate only routing/context/tool conventions.

Adapters MUST preserve knowledge IDs, evidence lineage, truth status, decision status, contradiction classification, cache policy and release-gate semantics.
