/**
 * POST /api/leads/create — Admin only.
 */
import { getSupabase } from '../../_lib/supabase.js';
import { checkAdminAuth, rateLimit, validateLength, secureJson, secureErr, secureOptions } from '../../_lib/security.js';

export async function onRequestOptions() { return secureOptions(); }

export async function onRequestPost(context) {
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const kv = context.env.DATA || context.env.LEADS;

  const rl = await rateLimit(kv, `ratelimit:create:${ip}`, 20, 60);
  if (!rl.allowed) return secureErr('Too many requests', 429);

  const auth = await checkAdminAuth(context.request, context.env);
  if (auth.locked) return secureErr('Too many failed attempts. Try again in 15 minutes.', 429);
  if (!auth.ok)    return secureErr('Unauthorized', 401);

  const sb = getSupabase(context.env);
  if (!sb) return secureErr('Service unavailable', 503);

  let body;
  try { body = await context.request.json(); } catch { return secureErr('Invalid request'); }

  const client_email = validateLength('client_email', (body.client_email || '').toLowerCase()) || null;
  const client_name  = validateLength('client_name',  body.client_name  || '')                || null;

  try {
    const rows = await sb.insert('velocity_leads', { client_email, client_name, status: 'pending' });
    const lead = Array.isArray(rows) ? rows[0] : rows;
    const base = context.env.SITE_URL || 'https://velocity.calyvent.com';
    return secureJson({ id: lead.id, token: lead.token, onboard_url: `${base}/onboard/${lead.token}` });
  } catch (_) {
    return secureErr('Service unavailable', 503);
  }
}
