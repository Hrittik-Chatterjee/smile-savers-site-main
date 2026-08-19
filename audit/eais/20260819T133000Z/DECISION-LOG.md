# Decision Log — narrative summary

Full register: `MASTER-DECISION-REGISTER.json` (2 ADRs this session).

- **ADR-0001**: Cloudflare Workers over Pages, 80% confidence, evidence-gated (full detail: `audit/cloudflare-decision/`).
- **ADR-0002**: Removed the broken `cloudflare/pages-action` CI jobs; relying on Cloudflare's own automatic Git-integration deploy instead of adding a redundant `wrangler deploy` step.

No other architecture-level decisions were made this session. Product decisions (appointment-flow framing, medical-content review policy) are explicitly NOT decided here — they're flagged `VERIFY-BLOCKED` in the debt register as needing a human with product/clinical authority, not an engineering ADR.
