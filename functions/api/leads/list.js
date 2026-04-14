/**
 * GET /api/leads/list — Admin only. All leads sorted by urgency.
 */
import { getSupabase, isAdmin, jsonRes, errRes, optionsRes } from '../../_lib/supabase.js';

export async function onRequestOptions() { return optionsRes(); }

export async function onRequestGet(context) {
  if (!isAdmin(context.request, context.env)) return errRes('Unauthorized', 401);
  const sb = getSupabase(context.env);
  if (!sb) return errRes('Supabase not configured', 500);

  const url    = new URL(context.request.url);
  const sort   = url.searchParams.get('sort') || 'due_date';
  const status = url.searchParams.get('status') || '';

  let filter = 'order=due_date.asc.nullslast,created_at.desc&limit=500';
  if (sort === 'created_at') filter = 'order=created_at.desc&limit=500';
  if (sort === 'status')     filter = 'order=status.asc,created_at.desc&limit=500';
  if (status) filter += `&status=eq.${status}`;

  const rows = await sb.select('velocity_leads', filter);
  for (const r of rows) {
    const anchor = r.first_submitted_at || r.submitted_at;
    if (!r.is_locked && anchor && Date.now() - new Date(anchor).getTime() > 86400000)
      r.is_locked = true;
  }
  return jsonRes(rows);
}
