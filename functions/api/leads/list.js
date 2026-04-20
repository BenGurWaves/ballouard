/**
 * GET /api/leads/list — Admin only. Returns all leads.
 */
import { getSupabase } from '../../_lib/supabase.js';
import { checkAdminAuth, rateLimit, secureJson, secureErr, secureOptions } from '../../_lib/security.js';

export async function onRequestOptions() { return secureOptions(); }

export async function onRequestGet(context) {


  const auth = await checkAdminAuth(context.request, context.env);
  if (auth.locked)  return secureErr('Too many failed attempts. Try again in 15 minutes.', 429);
  if (!auth.ok)     return secureErr('Unauthorized', 401);

  const sb = getSupabase(context.env);
  if (!sb) return secureErr('Service unavailable', 503);

  const url    = new URL(context.request.url);
  const sort   = url.searchParams.get('sort') || 'due_date';
  const status = url.searchParams.get('status') || '';

  let filter = 'order=due_date.asc.nullslast,created_at.desc&limit=500';
  if (sort === 'created_at') filter = 'order=created_at.desc&limit=500';
  if (sort === 'status')     filter = 'order=status.asc,created_at.desc&limit=500';
  if (status) filter += `&status=eq.${status}`;

  try {
    const rows = await getSupabase(context.env).select('velocity_leads', filter);
    for (const r of rows) {
      const anchor = r.first_submitted_at || r.submitted_at;
      if (!r.is_locked && anchor && Date.now() - new Date(anchor).getTime() > 86400000)
        r.is_locked = true;
    }
    return secureJson(rows);
  } catch (_) {
    return secureErr('Service unavailable', 503);
  }
}
