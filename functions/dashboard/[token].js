/**
 * GET /dashboard/:token
 * Serves the dashboard SPA shell without any URL redirect.
 */
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  url.pathname = '/_dashboard.html';
  const res = await fetch(url.toString());
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, max-age=0, must-revalidate',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' fonts.googleapis.com; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none';",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
