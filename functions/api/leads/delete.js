/**
 * DELETE /api/leads/delete — Admin only. Hard delete a lead.
 */
import { getSupabase } from '../../_lib/supabase.js';
import { checkAdminAuth, rateLimit, secureJson, secureErr, secureOptions } from '../../_lib/security.js';

export async function onRequestOptions() { return secureOptions(); }

export async function onRequestDelete(context) {


  const auth = await checkAdminAuth(context.request, context.env);
  if (auth.locked) return secureErr('Too many failed attempts. Try again in 15 minutes.', 429);
  if (!auth.ok)    return secureErr('Unauthorized', 401);

  const sb = getSupabase(context.env);
  if (!sb) return secureErr('Service unavailable', 503);

  let body;
  try { body = await context.request.json(); } catch { return secureErr('Invalid request'); }

  const token = (body.token || '').trim();
  if (!token) return secureErr('token required');

  const rows = await sb.select('velocity_leads', `token=eq.${token}&select=id`).catch(() => []);
  if (!rows.length) return secureErr('Not found', 404);

  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_SERVICE_KEY;
  try {
    const r = await fetch(`${url}/rest/v1/velocity_leads?token=eq.${token}`, {
      method: 'DELETE',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
    });
    if (!r.ok) return secureErr('Delete failed', 500);
    return secureJson({ success: true });
  } catch (_) {
    return secureErr('Service unavailable', 503);
  }
}
