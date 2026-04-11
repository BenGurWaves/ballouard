/**
 * GET /preview/:id
 * Serves generated preview HTML from KV with proper security headers.
 */

const PREVIEW_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' cdn.jsdelivr.net fonts.googleapis.com",
  "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
  "font-src 'self' fonts.gstatic.com",
  "img-src 'self' data: blob: https://images.unsplash.com",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

export async function onRequestGet(context) {
  const kv = context.env.DATA || context.env.LEADS;
  const projectId = context.params.id;

  if (!kv || !projectId) {
    return new Response('Not found', { status: 404 });
  }

  const html = await kv.get(`preview:${projectId}`);
  if (!html) {
    return new Response('Preview not found', { status: 404 });
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Content-Security-Policy': PREVIEW_CSP,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    },
  });
}
