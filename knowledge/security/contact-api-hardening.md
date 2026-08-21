---
type: SecurityFix
title: Contact API hardening
description: functions/api/contact.js previously reported success without delivery, logged raw PII, and only escaped one of five interpolated form fields.
resource: https://github.com/LabLaunchPad/smile-savers-site-main/blob/claude/init-yi57kn/functions/api/contact.js
tags: [security, api, contact-form, pii]
generated:
  by: process:claude-code-session-017vquuZdhBBxxo8bXTZ4QcN
  at: 2026-08-19T13:20:00Z
status: stable
sources:
  - functions/api/contact.js (before/after, this session's Wave 1 commit cd7d6d7)
  - uploaded third-party audit SmileSaversAudit20260819T122703Z, findings API-001/SEC-001/SEC-002
verified:
  - by: process:claude-code-session-017vquuZdhBBxxo8bXTZ4QcN
    at: 2026-08-19T13:00:00Z
---

# Contact API hardening

Three real, independently-verified defects fixed in commit `cd7d6d7`:

1. **Silent delivery failure (API-001).** `sendViaResend()`'s return value was never checked, and when `RESEND_API_KEY` was unset the handler still returned `{success: true}`. Now: missing key → `503` with a real error and a correlation ID; a failed clinic-notification send → `502`, same pattern. The frontend (`ContactForm.astro`) already parsed `data.success`/`data.error` correctly, so no frontend change was needed.
2. **PII in logs (SEC-001).** `console.log('FORM_SUBMISSION', {name, email, phone, service, urgency})` → replaced with a correlation ID + non-sensitive metadata only (`hasPhone`, `service`, `newPatient`, `urgent`, timestamp).
3. **Partial HTML escaping (SEC-002).** Only `message` was escaped before interpolation into the notification email's HTML body; `name`/`email`/`phone`/`service` were not. All five now go through one `escapeHtml()` helper.

## Non-obvious detail worth preserving

The auto-reply-to-sender email is intentionally fire-and-forget (`.catch(() => {})`) — its failure must never affect the response, since the clinic notification (not the auto-reply) is what determines whether the submission was actually received. Don't "fix" this by awaiting/checking it; that would couple two independently-failing operations that should stay decoupled.
