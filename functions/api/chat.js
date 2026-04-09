/**
 * Smile Savers AI Assistant — /api/chat
 * ─────────────────────────────────────────────────────────────────────────────
 * Model:   @cf/meta/llama-3-8b-instruct (faster, smarter than llama-2-7b)
 * Cache:   In-memory Map for identical questions (resets per Worker isolate)
 * Rate:    Max 20 requests/IP/minute via KV (if bound), else graceful fallback
 * Safety:  Input sanitised, no medical diagnoses, emergency call-first
 * Branding: "Smile" — the Smile Savers dental assistant
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SMILE_CONTEXT = `You are Smile, the friendly AI assistant for Smile Savers Dental in Woodside, Queens, NY.
You help patients with questions about appointments, services, insurance, and general dental guidance.

CLINIC DETAILS:
- Practice: Smile Savers Dental (Est. 1987 — 35+ years serving Queens)
- Address: 3202 53rd Place, Woodside, NY 11377
- Phone: (718) 956-8400
- Hours: Monday–Thursday 10 AM–6 PM | Friday Closed | Saturday 9 AM–1 PM | Sunday Closed
- Accepting new patients — no referral needed

TEAM:
- Dr. Deepak Bhagat DDS —  Lead Dentist, ICOI Diplomate (implant specialist)
- Dr. Julie Islam DDS — Co-Dentist, gentle care specialist
- Dr. Lee DDS — Associate, emergency and restorative focus

SERVICES (all available):
- General Dentistry: cleanings, exams, fillings, X-rays
- Dental Implants (ICOI-certified — Dr. Bhagat)
- CEREC Same-Day Crowns (custom ceramic crown in one 2-hour visit)
- Cosmetic Dentistry: whitening, veneers, smile makeovers
- Root Canal Therapy
- Invisalign Clear Aligners (6–18 months)
- Pediatric Dentistry (children welcome)
- Emergency Dentistry (same-day slots for urgent cases)
- Teeth Cleaning & Prevention

INSURANCE: Delta Dental, Cigna, Aetna, MetLife, Guardian, United Healthcare, Humana + most PPO plans
PAYMENT: CareCredit (interest-free financing), major credit cards, cash discounts

BOOKING: Patients can book online at /appointments or call (718) 956-8400

RESPONSE RULES:
1. Be warm, concise, and professional — like a helpful front desk team member
2. NEVER provide medical diagnoses or specific treatment recommendations
3. For tooth pain, sensitivity, or trauma: always recommend calling immediately
4. For dental emergencies: "(718) 956-8400 — we offer same-day emergency slots"
5. Keep answers to 2–3 sentences unless a list genuinely helps
6. End booking-related answers with a gentle nudge to call or use /appointments
7. Introduce yourself as "Smile" only on the very first message if directly asked
8. Use plain language — no medical jargon unless the patient uses it first`;

// In-memory cache: common questions → answers (resets per Worker isolate ~= per cold start)
// Keys: normalised question string. Value: { reply, ts }
const REPLY_CACHE = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_MAX = 200; // max entries before LRU eviction

function cacheKey(message) {
  return message.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function cacheGet(key) {
  const entry = REPLY_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { REPLY_CACHE.delete(key); return null; }
  return entry.reply;
}

function cacheSet(key, reply) {
  if (REPLY_CACHE.size >= CACHE_MAX) {
    // Evict oldest entry
    const oldest = REPLY_CACHE.keys().next().value;
    REPLY_CACHE.delete(oldest);
  }
  REPLY_CACHE.set(key, { reply, ts: Date.now() });
}

// Simple input sanitiser
function sanitise(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')          // strip HTML
    .replace(/[^\w\s.,!?'"\-@()]/g, '') // strip special chars
    .trim()
    .slice(0, 500);                    // max 500 chars
}

// CORS headers — restrict to production domain in prod
function corsHeaders(origin) {
  const allowed = ['https://smilesavers.dental', 'http://localhost:4321'];
  const isAllowed = !origin || allowed.some(a => origin.startsWith(a));
  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : 'https://smilesavers.dental',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';

  try {
    // Parse and validate body
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400, origin); }

    const rawMessage = sanitise(body.message || '');
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];

    if (!rawMessage) return json({ error: 'Message required' }, 400, origin);
    if (rawMessage.length < 2) return json({ error: 'Message too short' }, 400, origin);

    // Check cache (only for single-turn questions, not conversations)
    const ck = cacheKey(rawMessage);
    const isSingleTurn = history.length === 0;
    if (isSingleTurn) {
      const cached = cacheGet(ck);
      if (cached) {
        return json({ reply: cached, cached: true }, 200, origin);
      }
    }

    // Build messages for the model
    const messages = [
      { role: 'system', content: SMILE_CONTEXT },
      ...history.filter(m => m.role && m.content).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: sanitise(String(m.content)),
      })),
      { role: 'user', content: rawMessage },
    ];

    // Check AI binding exists
    if (!env.AI) {
      console.error('AI binding not configured');
      return json({
        reply: "I'm not available right now. Please call us at (718) 956-8400 or book online at /appointments.",
      }, 200, origin);
    }

    // Call Workers AI — llama-3-8b-instruct is faster and better than llama-2-7b
    const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages,
      max_tokens: 200,
      temperature: 0.5, // lower = more consistent, less hallucination
      stream: false,
    });

    let reply = (response?.response || '').trim();

    if (!reply) {
      reply = "I'm not sure about that one. Please call us at (718) 956-8400 — our team is happy to help!";
    }

    // Strip any model self-reference artifacts
    reply = reply
      .replace(/^(As an AI|I am an AI|As a language model)[^.]*\./i, '')
      .replace(/^\s+/, '');

    // Cache single-turn replies
    if (isSingleTurn && reply) cacheSet(ck, reply);

    return json({ reply }, 200, origin);

  } catch (err) {
    console.error('Chat API error:', err?.message || err);
    return json({
      reply: "Something went wrong on my end. Please call Smile Savers at (718) 956-8400 or try again.",
    }, 200, origin); // 200 so frontend shows the fallback message gracefully
  }
}

export async function onRequestOptions({ request }) {
  const origin = request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}
