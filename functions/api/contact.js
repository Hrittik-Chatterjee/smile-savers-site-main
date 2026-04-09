/**
 * API Route: /api/contact
 * Handles contact form + appointment booking submissions for Smile Savers Dental
 *
 * Email delivery: Resend (https://resend.com) — free tier: 3,000 emails/month
 * Requires: RESEND_API_KEY env variable set in Cloudflare Pages dashboard
 *           → Settings → Variables and Secrets → Add: RESEND_API_KEY
 *
 * If RESEND_API_KEY is not set, the function still returns success and logs
 * the submission to Cloudflare's real-time logs (Workers → Logs in dashboard).
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendViaResend(apiKey, { to, from, replyTo, subject, text, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      reply_to: replyTo,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`Resend error ${res.status}:`, errText);
    return false;
  }
  return true;
}

// ── Main handler ───────────────────────────────────────────────────────────

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // Parse multipart form data
    let body;
    try {
      body = await request.formData();
    } catch {
      return json({ success: false, error: 'Invalid form data.' }, 400);
    }

    const name       = (body.get('name')       || '').trim();
    const email      = (body.get('email')       || '').trim();
    const phone      = (body.get('phone')       || '').trim();
    const service    = (body.get('service')     || '').trim();
    const message    = (body.get('message')     || '').trim();
    const newPatient = body.get('newPatient') === 'yes' ? 'Yes' : 'No';
    const urgent     = body.get('urgency')    === 'urgent' ? '⚠️ URGENT / EMERGENCY' : 'No';

    // Basic validation
    if (!name || !email || !message) {
      return json({ success: false, error: 'Name, email and message are required.' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ success: false, error: 'Please enter a valid email address.' }, 400);
    }

    // ── Build email content ───────────────────────────────────────────────
    const subject = urgent !== 'No'
      ? `⚠️ URGENT: New Contact from ${name} — Smile Savers`
      : `New Appointment Request from ${name} — Smile Savers`;

    const textBody = [
      `New form submission from smilesavers.dental`,
      ``,
      `NAME:        ${name}`,
      `EMAIL:       ${email}`,
      `PHONE:       ${phone || 'Not provided'}`,
      `SERVICE:     ${service || 'Not specified'}`,
      `NEW PATIENT: ${newPatient}`,
      `URGENT:      ${urgent}`,
      ``,
      `MESSAGE:`,
      message,
      `---`,
      `Reply directly to this email to respond to ${name}.`,
    ].join('\n');

    const safeMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#102B3F;padding:20px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">
      ${urgent !== 'No' ? '⚠️ URGENT — ' : ''}New ${service ? 'Appointment Request' : 'Contact Form Submission'}
    </h1>
    <p style="color:#3DBAA7;margin:4px 0 0;font-size:14px">smilesavers.dental</p>
  </div>
  <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 0;color:#666;width:140px">Name</td><td style="padding:8px 0;font-weight:600">${name}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#2CABDF">${email}</a></td></tr>
      <tr><td style="padding:8px 0;color:#666">Phone</td><td style="padding:8px 0">${phone || 'Not provided'}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Service</td><td style="padding:8px 0">${service || 'Not specified'}</td></tr>
      <tr><td style="padding:8px 0;color:#666">New Patient?</td><td style="padding:8px 0">${newPatient}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Urgent?</td><td style="padding:8px 0;color:${urgent !== 'No' ? '#EF4444' : '#666'};font-weight:${urgent !== 'No' ? '700' : '400'}">${urgent}</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
    <p style="color:#666;font-size:13px;margin:0 0 8px;font-weight:600">MESSAGE:</p>
    <p style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin:0;white-space:pre-wrap;font-size:14px">${safeMessage}</p>
  </div>
  <div style="background:#f0f0f0;padding:12px 24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
    <p style="margin:0;font-size:12px;color:#999">Reply to this email to contact ${name} at ${email}</p>
  </div>
</body>
</html>`;

    // ── Log submission (always — visible in CF dashboard → Logs) ─────────
    console.log('FORM_SUBMISSION', JSON.stringify({ name, email, phone, service, newPatient, urgent, ts: new Date().toISOString() }));

    // ── Send via Resend (requires RESEND_API_KEY env var) ─────────────────
    if (env.RESEND_API_KEY) {
      // Notify clinic
      await sendViaResend(env.RESEND_API_KEY, {
        from: 'Smile Savers Website <onboarding@resend.dev>',
        to: 'care@smilesavers.dental',
        replyTo: email,
        subject,
        text: textBody,
        html: htmlBody,
      });

      // Auto-reply to sender (best-effort, don't fail if it errors)
      await sendViaResend(env.RESEND_API_KEY, {
        from: 'Smile Savers Dental <onboarding@resend.dev>',
        to: email,
        subject: 'We received your message — Smile Savers Dental',
        text: `Hi ${name},\n\nThank you for reaching out to Smile Savers Dental. We've received your message and will get back to you within 24 hours.\n\nIf this is a dental emergency, please call us directly:\n(718) 956-8400\n\nOffice Hours:\nMon–Thu: 10 AM – 6 PM\nFri: Closed\nSat: 9 AM – 1 PM\n\nWarm regards,\nSmile Savers Dental\n3202 53rd Place, Woodside, NY 11377\n(718) 956-8400`,
      }).catch(() => {}); // silently fail — auto-reply is best-effort
    } else {
      // No API key configured — log warning, still return success
      console.warn('RESEND_API_KEY not set. Submission logged but email not sent. Add key in CF Pages → Settings → Variables and Secrets.');
    }

    return json({ success: true, message: 'Message sent successfully.' });

  } catch (err) {
    console.error('Contact form error:', err?.message || err);
    // Always return JSON — never let Cloudflare serve an HTML error page
    return json({ success: false, error: 'Server error. Please call us at (718) 956-8400.' }, 500);
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
