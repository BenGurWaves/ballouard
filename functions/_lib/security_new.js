/**
 * Shared security primitives for all Velocity CF Functions.
 * Imported by every endpoint that handles auth, rate limiting, or user input.
 */

// ── Timing-safe string comparison ────────────────────────────────────────────
// Prevents timing attacks on admin secret comparison.
// Standard === leaks info: attackers measure response time to guess characters.
export async function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const enc = new TextEncoder();
  const aKey = await crypto.subtle.importKey('raw', enc.encode(a), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bKey = await crypto.subtle.importKey('raw', enc.encode(b), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const aSig  = new Uint8Array(await crypto.subtle.sign('HMAC', aKey, nonce));
  const bSig  = new Uint8Array(await crypto.subtle.sign('HMAC', bKey, nonce));
  if (aSig.length !== bSig.length) return false;
  let diff = 0;
  for (let i = 0; i < aSig.length; i++) diff |= aSig[i] ^ bSig[i];
  return diff === 0;
}

// ── Brute-force lockout (admin endpoints) ─────────────────────────────────────
// Tracks failed auth attempts per IP. Locks out for 15 minutes after 5 failures.
export async function checkAdminAuth(request, env) {
  const provided = request.headers.get('X-Admin-Secret') || '';
  if (!provided || !env.ADMIN_SECRET) return { ok: false, locked: false };

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const lockKey  = `lock:admin:${ip}`;
  const failKey  = `fails:admin:${ip}`;
