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
  const kv = env.DATA || env.LEADS;

  if (kv) {
    // Check if locked
    const locked = await kv.get(lockKey).catch(() => null);
    if (locked) return { ok: false, locked: true, retryAfter: 900 };
  }

  const match = await timingSafeEqual(provided, env.ADMIN_SECRET);

  if (kv) {
    if (!match) {
      // Increment failure counter
      try {
        const fails = parseInt(await kv.get(failKey).catch(() => '0') || '0', 10) + 1;
        if (fails >= 5) {
          await kv.put(lockKey, '1', { expirationTtl: 900 });  // lock 15 min
          await kv.delete(failKey);
          return { ok: false, locked: true, retryAfter: 900 };
        }
        await kv.put(failKey, String(fails), { expirationTtl: 300 }); // reset after 5 min
      } catch (_) {}
      return { ok: false, locked: false };
    } else {
      // Success — clear failure counter
      try { await kv.delete(failKey); } catch (_) {}
    }
  }

  return { ok: match, locked: false };
}

// ── Generic rate limiter ──────────────────────────────────────────────────────
// Returns { allowed: boolean }
// maxRequests per windowSeconds per key (usually IP-based)
export async function rateLimit(kv, key, maxRequests, windowSeconds) {
  if (!kv) return { allowed: true };
  try {
    const data = await kv.get(key, { type: 'json' }).catch(() => null);
    const now  = Date.now();
    const cutoff = now - (windowSeconds * 1000);
    const recent = ((data && data.ts) || []).filter(t => t > cutoff);
    if (recent.length >= maxRequests) return { allowed: false };
    recent.push(now);
    await kv.put(key, JSON.stringify({ ts: recent }), { expirationTtl: windowSeconds });
    return { allowed: true };
  } catch (_) {
    return { allowed: true }; // fail open — don't block on KV errors
  }
}

// ── Input validation ──────────────────────────────────────────────────────────
// Trims and enforces max lengths on all user-supplied string fields.
// Returns sanitized object or throws a descriptive error string.
const INPUT_LIMITS = {
  // Lead fields
  client_email:  254,
  client_name:   120,
  due_date:       10,
  domain_name:   253,
  domain_choice:  30,
  site_link:    2000,
  admin_comment: 1000,
  admin_comment_link: 2000,
  // full_data subfields (validated recursively where needed)
  full_name:     120,
  company_name:  120,
  email:         254,
  phone:          30,
  context:      5000,
  target_customer: 3000,
  color_background: 100,
  color_secondary:  100,
  color_accent:     100,
  colors_extra:    500,
  fonts:           500,
  mottos:         1000,
  copyright:       200,
  assets_links:   2000,
  existing_url:   2000,
  additional_notes: 3000,
};

export function validateLength(key, value) {
  if (typeof value !== 'string') return value;
  const limit = INPUT_LIMITS[key];
  if (limit && value.length > limit) throw `${key} exceeds maximum length of ${limit} characters`;
  return value.trim();
}

// ── URL validation ─────────────────────────────────────────────────────────────
// Ensures URLs are actually https:// — blocks javascript:, data:, etc.
export function safeUrl(url) {
  if (!url) return null;
  const s = url.trim();
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : 'https://' + s;
  try {
    const u = new URL(withProto);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return withProto;
  } catch (_) {
    return null;
  }
}

// ── Complete security headers ─────────────────────────────────────────────────
export function secureHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
    ...extra,
  };
}

export function secureJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: secureHeaders() });
}

export function secureErr(message, status = 400) {
  // Never expose internal details — only safe messages reach clients
  const safe = status >= 500 ? 'An internal error occurred.' : message;
  return secureJson({ error: safe }, status);
}

export function secureOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
      'Access-Control-Max-Age': '86400',
    },
  });
}
