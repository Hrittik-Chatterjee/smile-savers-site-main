import { onRequestPost as chatPost, onRequestOptions as chatOptions } from '../functions/api/chat.js';
import { onRequestPost as contactPost, onRequestOptions as contactOptions } from '../functions/api/contact.js';
import { applySecurityHeaders } from '../functions/_middleware.js';

// This Worker fetch handler is a Pages-Functions-only-convention bypass:
// functions/_middleware.js's onRequest is auto-invoked by Pages routing,
// but nothing auto-invokes it here, since this file (not _middleware.js)
// is the actual live entrypoint (wrangler.jsonc's `main`). Every response
// below is explicitly passed through applySecurityHeaders so CSP/
// X-Frame-Options/etc. reach the browser on this path too -- confirmed via
// live curl before this fix that /api/* responses shipped with none of
// them (audit/cloudflare-decision/repo-vs-live.md, DEBT-0011).
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Mock Pages context object to match what the existing functions expect
    const context = {
      request,
      env,
      waitUntil: ctx.waitUntil ? ctx.waitUntil.bind(ctx) : () => {},
      next: () => {
        return env.ASSETS.fetch(request);
      }
    };

    // Route for the AI chat assistant
    if (url.pathname === '/api/chat') {
      if (request.method === 'OPTIONS') {
        return applySecurityHeaders(await chatOptions(context));
      }
      if (request.method === 'POST') {
        return applySecurityHeaders(await chatPost(context));
      }
      return applySecurityHeaders(new Response('Method Not Allowed', { status: 405 }));
    }

    // Route for the contact form submissions
    if (url.pathname === '/api/contact') {
      if (request.method === 'OPTIONS') {
        return applySecurityHeaders(await contactOptions(context));
      }
      if (request.method === 'POST') {
        return applySecurityHeaders(await contactPost(context));
      }
      return applySecurityHeaders(new Response('Method Not Allowed', { status: 405 }));
    }

    // Default fallback: serve static assets built by Astro (from the ASSETS
    // binding). These already carry a matching CSP via public/_headers,
    // which Workers Static Assets honors natively -- applying the same
    // headers again here is redundant but harmless (idempotent Headers.set)
    // and keeps a single enforced source of truth even if _headers drifts.
    return applySecurityHeaders(await env.ASSETS.fetch(request));
  }
};
