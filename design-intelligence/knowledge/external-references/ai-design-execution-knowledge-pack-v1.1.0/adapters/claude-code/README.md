# Claude Code adapter

Use project-level Claude Code hooks for deterministic lifecycle capture. The official hook payload exposes session/transcript context. Store hook events append-only and large data in content-addressed cache objects.

Suggested events:
SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, SubagentStart, SubagentStop, Stop, StopFailure, SessionEnd.

Do not assume every event is available in every Claude Code version; validate the installed version against current official documentation before enabling version-specific fields.
