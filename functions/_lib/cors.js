/**
 * Shared CORS origin policy for all API routes and the global middleware.
 * Single source of truth so the three previously-independent CORS
 * implementations (functions/_middleware.js, functions/api/contact.js,
 * functions/api/chat.js) can't drift again (audit SEC-004: found using
 * both a wildcard and a startsWith prefix match instead of exact origin
 * equality).
 */

const CANONICAL_ORIGIN = 'https://dentalsmilesavers.com';
const DEV_ORIGIN = 'http://localhost:4321';

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (origin === CANONICAL_ORIGIN) return true;
  if (origin === DEV_ORIGIN) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:') return false;
    return hostname.endsWith('.pages.dev') || hostname.endsWith('.workers.dev');
  } catch {
    return false;
  }
}

export function corsHeadersFor(origin, methods = 'GET, POST, OPTIONS') {
  const allowed = isAllowedOrigin(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : CANONICAL_ORIGIN,
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
