/**
 * API Route: /api/contact
 * Handles contact form submissions for Smile Savers Dental
 *
 * Delivery method: MailChannels (free on Cloudflare Pages — no key needed)
 * Fallback: logs to console if MailChannels unavailable
 *
 * Deploy note: MailChannels SPF record required on smilesavers.dental:
 *   TXT @ "v=spf1 include:relay.mailchannels.net ~all"
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // ── CORS headers ──────────────────────────────────────────
  const corsHeaders = {
    "Access-Control-Allow-Origin": "https://smilesavers.dental",
    "Content-Type": "application/json",
  };

  try {
    const body = await request.formData();

    const name       = (body.get("name")       || "").trim();
    const email      = (body.get("email")       || "").trim();
    const phone      = (body.get("phone")       || "").trim();
    const service    = (body.get("service")     || "").trim();
    const message    = (body.get("message")     || "").trim();
    const newPatient = body.get("newPatient") === "yes" ? "Yes" : "No";
    const urgent     = body.get("urgency")    === "urgent" ? "⚠️ URGENT / EMERGENCY" : "No";

    // Basic validation
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Name, email and message are required." }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Please enter a valid email address." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Build email content ────────────────────────────────
    const subject = urgent !== "No"
      ? `⚠️ URGENT: New Contact from ${name} — Smile Savers`
      : `New Contact Form Submission from ${name} — Smile Savers`;

    const textBody = [
      `New contact form submission from smilesavers.dental`,
      ``,
      `NAME:        ${name}`,
      `EMAIL:       ${email}`,
      `PHONE:       ${phone || "Not provided"}`,
      `SERVICE:     ${service || "Not specified"}`,
      `NEW PATIENT: ${newPatient}`,
      `URGENT:      ${urgent}`,
      ``,
      `MESSAGE:`,
      message,
      ``,
      `---`,
      `Reply directly to this email to respond to ${name}.`,
    ].join("\n");

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#102B3F;padding:20px;border-radius:8px 8px 0 0">
    <h1 style="color:#fff;margin:0;font-size:20px">
      ${urgent !== "No" ? "⚠️ URGENT — " : ""}New Contact Form Submission
    </h1>
    <p style="color:#3DBAA7;margin:4px 0 0;font-size:14px">smilesavers.dental</p>
  </div>
  <div style="background:#f9f9f9;padding:24px;border:1px solid #e0e0e0;border-top:none">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 0;color:#666;width:140px">Name</td><td style="padding:8px 0;font-weight:600">${name}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#2CABDF">${email}</a></td></tr>
      <tr><td style="padding:8px 0;color:#666">Phone</td><td style="padding:8px 0">${phone || "Not provided"}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Service</td><td style="padding:8px 0">${service || "Not specified"}</td></tr>
      <tr><td style="padding:8px 0;color:#666">New Patient?</td><td style="padding:8px 0">${newPatient}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Urgent?</td><td style="padding:8px 0;color:${urgent !== "No" ? "#EF4444" : "#666"};font-weight:${urgent !== "No" ? "700" : "400"}">${urgent}</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:16px 0">
    <p style="color:#666;font-size:13px;margin:0 0 8px;font-weight:600">MESSAGE:</p>
    <p style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:12px;margin:0;white-space:pre-wrap;font-size:14px">${message.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</p>
  </div>
  <div style="background:#f0f0f0;padding:12px 24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px">
    <p style="margin:0;font-size:12px;color:#999">Reply directly to this email to contact ${name} at ${email}</p>
  </div>
</body>
</html>`;

    // ── Send via MailChannels ──────────────────────────────
    const mcPayload = {
      personalizations: [{
        to: [{ email: "care@smilesavers.dental", name: "Smile Savers Dental" }],
        reply_to: { email, name },
      }],
      from: {
        email: "noreply@smilesavers.dental",
        name: "Smile Savers Website",
      },
      subject,
      content: [
        { type: "text/plain", value: textBody },
        { type: "text/html",  value: htmlBody },
      ],
    };

    const mcResponse = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mcPayload),
    });

    if (!mcResponse.ok && mcResponse.status !== 202) {
      const errText = await mcResponse.text();
      console.error("MailChannels error:", mcResponse.status, errText);
      // Still return success to user — log failure internally
      // In production, add a fallback (e.g., store in KV, send to Slack webhook)
    }

    // ── Auto-reply to sender ───────────────────────────────
    await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email, name }] }],
        from: { email: "care@smilesavers.dental", name: "Smile Savers Dental" },
        subject: "We received your message — Smile Savers Dental",
        content: [{
          type: "text/plain",
          value: `Hi ${name},\n\nThank you for reaching out to Smile Savers Dental. We've received your message and will get back to you within 24 hours.\n\nIf this is a dental emergency, please call us directly:\n(718) 956-8400\n\nOffice Hours:\nMon–Thu: 10 AM – 6 PM\nFri: Closed\nSat: 9 AM – 1 PM\n\nWarm regards,\nSmile Savers Dental\n3202 53rd Place, Woodside, NY 11377\n(718) 956-8400`,
        }],
      }),
    }).catch(() => {}); // silently fail — auto-reply is best-effort

    return new Response(
      JSON.stringify({ success: true, message: "Message sent successfully." }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error("Contact form error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Server error. Please call us at (718) 956-8400." }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "https://smilesavers.dental",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
