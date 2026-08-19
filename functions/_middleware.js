/**
 * Cloudflare Pages Middleware
 * Handles CORS, security headers, and request preprocessing
 */

// CORS: exact-origin allowlist instead of '*' (audit SEC-004), shared with
// the individual API routes via _lib/cors.js so the policy can't drift.
import { corsHeadersFor } from './_lib/cors.js';

// Security headers.
// CSP reconciled from two previously-drifted policies (this file vs.
// public/_headers — audit SEC-005): this file's CSP is the one that
// actually reaches the browser, since middleware runs on every request and
// overwrites whatever public/_headers set. Built from real usage only —
// no Google Fonts (this project self-hosts fonts per CLAUDE.md), no
// mailchannels/pexels/cloudflareinsights (grep found zero references to
// any of them in src/ or functions/). 'unsafe-inline' is kept for both
// script-src and style-src because is:inline scripts (Header.astro,
// BaseLayout.astro) and inline style="" attributes are real and load-bearing
// in this codebase — removing them without a nonce/hash strategy would
// break the site. 'unsafe-eval' is removed: no eval()/new Function() usage
// exists anywhere in src/ or functions/ (grep-verified).
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://maps.openstreetmap.org https://tile.openstreetmap.org; connect-src 'self'; frame-src https://www.openstreetmap.org; upgrade-insecure-requests",
};

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeadersFor(origin),
    });
  }

  // Continue to the next middleware or route handler
  const response = await next();

  // Add security headers to all responses
  const newHeaders = new Headers(response.headers);
  Object.entries(securityHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  // Add CORS headers to API routes
  if (url.pathname.startsWith('/api/')) {
    Object.entries(corsHeadersFor(origin)).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });
  }

  // Add cache headers for static assets
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
    newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // Add cache headers for HTML pages
  if (url.pathname.endsWith('.html') || url.pathname === '/') {
    newHeaders.set('Cache-Control', 'public, max-age=0, must-revalidate');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
