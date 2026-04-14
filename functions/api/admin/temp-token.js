/**
 * POST /api/admin/temp-token
 * Exchange the permanent ADMIN_SECRET for a 5-minute single-use view token.
 * Used by the admin panel to open client briefs without putting the permanent
 * secret in a URL query param (which would appear in logs and browser history).
 */
import { checkAdminAuth, rateLimit, secureJson, secureErr, secureOptions } from '../../../_lib/security.js';

export async function onRequestOptions() { return secureOptions(); }

export async function onRequestPost(context) {
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const kv = context.env.DATA || context.env.LEADS;

  // Rate limit: 20 temp tokens per IP per minute
  const rl = await rateLimit(kv, `ratelimit:tmptoken:${ip}`, 20, 60);
  if (!rl.allowed) return secureErr('Too many requests', 429);

  const auth = await checkAdminAuth(context.request, context.env);
  if (auth.locked) return secureErr('Too many failed attempts. Try again in 15 minutes.', 429);
  if (!auth.ok)    return secureErr('Unauthorized', 401);

  // Generate a cryptographically random 32-byte token
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');

  // Store in KV — expires in 5 minutes, single-use flag
  if (kv) {
    await kv.put(`view_token:${token}`, '1', { expirationTtl: 300 });
  }

  return secureJson({ token, expires_in: 300 });
}
