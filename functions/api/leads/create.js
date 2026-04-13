/**
 * POST /api/leads/create — Admin only.
 * Creates a new velocity_leads row, returns the UUID token + onboard URL.
 */
import { getSupabase, isAdmin, jsonRes, errRes, optionsRes } from '../../_lib/supabase.js';

export async function onRequestOptions() { return optionsRes(); }

export async function onRequestPost(context) {
  if (!isAdmin(context.request, context.env)) return errRes('Unauthorized', 401);
  const sb = getSupabase(context.env);
  if (!sb) return errRes('Supabase not configured', 500);

  let body;
  try { body = await context.request.json(); } catch { return errRes('Invalid JSON'); }

  const client_email = (body.client_email || '').trim().toLowerCase() || null;
  const client_name  = (body.client_name  || '').trim() || null;

  const rows = await sb.insert('velocity_leads', { client_email, client_name, status: 'pending' });
  const lead = Array.isArray(rows) ? rows[0] : rows;
  const base = context.env.SITE_URL || 'https://velocity.calyvent.com';

  return jsonRes({ id: lead.id, token: lead.token, onboard_url: `${base}/onboard/${lead.token}` });
}
