/**
 * DELETE /api/leads/delete — Admin only. Hard delete a lead.
 * Body: { token }
 */
import { getSupabase, isAdmin, jsonRes, errRes, optionsRes } from '../../_lib/supabase.js';

export async function onRequestOptions() { return optionsRes(); }

export async function onRequestDelete(context) {
  if (!isAdmin(context.request, context.env)) return errRes('Unauthorized', 401);
  const sb = getSupabase(context.env);
  if (!sb) return errRes('Supabase not configured', 500);

  let body;
  try { body = await context.request.json(); } catch { return errRes('Invalid JSON'); }
  const { token } = body;
  if (!token) return errRes('token required');

  const rows = await sb.select('velocity_leads', `token=eq.${token}&select=id`);
  if (!rows.length) return errRes('Not found', 404);

  // Use service role to delete — direct REST DELETE
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_SERVICE_KEY;
  const r = await fetch(`${url}/rest/v1/velocity_leads?token=eq.${token}`, {
    method: 'DELETE',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) return errRes('Delete failed', 500);
  return jsonRes({ success: true });
}
