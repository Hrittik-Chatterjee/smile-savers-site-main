# Root Cause Graph — narrative summary

Full graph: `MASTER-ROOT-CAUSE-GRAPH.json` (8 roots, 26 downstream findings).

The headline pattern, illustrated by the strongest example:

```
ROOT-DOMAIN-001 (canonical domain not centralized)
├── canonical URL errors
├── OpenGraph image URL errors
├── structured-data @id/url errors
├── sitemap host mismatch
├── CORS allowlist mismatch
├── AI chat CORS origin-check mismatch
└── README/docs drift
```

One root cause, 7 manifestations, fixed in one commit (`cd7d6d7`) by centralizing on `src/config/site.ts` and sweeping every hardcoded literal — rather than 7 separate "fix the domain here too" tickets that would each individually look like a small, disconnected typo fix.

The same pattern holds for `ROOT-CONTACT-001` (3 manifestations), `ROOT-CLOUDFLARE-001` (6 manifestations, partially resolved), and `ROOT-CONTENT-001` (4 manifestations, 3 resolved). `ROOT-TEST-001`, `ROOT-CI-001`, `ROOT-A11Y-001`, and `ROOT-APPOINTMENT-001` are single- or double-manifestation roots — genuinely more contained problems, not under-investigated ones.
