/**
 * Shared helpers for Cloudflare Pages Functions
 */

export function getCorsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowed = ['https://velocity.calyvent.com', 'https://calyvent.com'];
  const allow = allowed.includes(origin) ? origin : allowed[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function json(data, status = 200, extraHeaders = {}, request = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request), ...extraHeaders },
  });
}

export function err(message, status = 400, request = null) {
  return json({ error: message }, status, {}, request);
}

export function corsPreflightResponse(request = null) {
  return new Response(null, {
    status: 204,
    headers: {
      ...getCorsHeaders(request),
      'Access-Control-Max-Age': '86400',
    },
  });
}

// ── ID generation ─────────────────────────────────────────

export function generateId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ── KV helper ─────────────────────────────────────────────

export function getKV(env) {
  return env.DATA || env.LEADS || null;
}

// ── HTML escaping ─────────────────────────────────────────

export function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
