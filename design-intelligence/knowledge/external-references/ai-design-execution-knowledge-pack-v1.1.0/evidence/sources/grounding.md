# Current Grounding Evidence

Retrieved 2026-08-19.

## Claude Code Hooks

Anthropic documents lifecycle hooks, common fields including `session_id`, `transcript_path`, `cwd`, and permission mode, plus SessionStart, SubagentStop, Stop, SessionEnd and other events. SessionEnd receives a transcript path and reason; hooks are appropriate for deterministic event capture. Source: https://code.claude.com/docs/en/hooks

## Claude Code Sessions

Anthropic documents that Claude Code stores sessions locally and supports resume/branch workflows; session data is part of the local session model. Source: https://code.claude.com/docs/en/sessions

## Playwright Trace

Playwright tracing captures browser operations and network activity; snapshots can capture DOM snapshots and network activity. Playwright recommends Playwright Test configuration for fuller traces including assertions. Source: https://playwright.dev/docs/api/class-tracing

## WCAG 2.2

WCAG 2.2 is a W3C Recommendation dated 2024-12-12. It explicitly describes conformance as requiring testable criteria and recognizes a combination of automated testing and human evaluation. New AA criteria include Focus Not Obscured and Target Size Minimum. Source: https://www.w3.org/TR/WCAG22/

## Material 3 / M3 Expressive

Google's current Android documentation states that M3 Expressive is an expansion of Material 3 with research-backed updates to theming, components, motion, typography and more. M3 theming includes color scheme, typography and shapes; current API documentation also exposes a MotionScheme. Sources:

- https://developer.android.com/develop/ui/compose/designsystems/material3
- https://developer.android.com/reference/kotlin/androidx/compose/material3/MaterialTheme

Important truth boundary: this proves what Google documents about M3/M3E. It does NOT prove Google Labs is implemented from M3/M3E. Labs ↔ M3/M3E remains MAPPED/INFERRED unless direct Labs evidence proves provenance.

## SLSA 1.2

SLSA 1.2 is an approved specification. Its provenance model is designed to track artifacts back through the moving parts that produced them, including where, when and how they were produced. Sources:

- https://slsa.dev/spec/v1.2/
- https://slsa.dev/spec/v1.2/provenance
