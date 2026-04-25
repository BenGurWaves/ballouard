/**
 * GET  /api/leads/:token  — fetch lead (public, token-gated)
 * PATCH /api/leads/:token — client submits/saves (respects 24h lock)
 */
import { getSupabase, jsonRes, errRes, optionsRes } from '../../_lib/supabase.js';
import { rateLimit } from '../../_lib/security.js';

export async function onRequestOptions() { return optionsRes(); }

export async function onRequestGet(context) {
  const sb = getSupabase(context.env);
  if (!sb) return errRes('Supabase not configured', 500);
  const token = context.params.token;
  if (!token) return errRes('Token required', 400);

  let rows;
  try { rows = await sb.select('velocity_leads', `token=eq.${token}&select=id,token,status,full_data,submitted_at,first_submitted_at,is_locked,quote_amount,is_paid,upgrade_permission,due_date,client_name,client_email,created_at,admin_comment,site_link,domain_choice,domain_name,email_verified,scope_sent_at,scope_accepted,scope_accepted_at,scope_text`); } catch (_) { return errRes('Service unavailable', 503); }
  if (!rows.length) return errRes('Not found', 404);

  const lead = rows[0];
  // Real-time lock check using first_submitted_at as anchor
  const anchor = lead.first_submitted_at || lead.submitted_at;
  if (!lead.is_locked && anchor) {
    if (Date.now() - new Date(anchor).getTime() > 86400000) lead.is_locked = true;
  }
  // Expire admin comment after 24h on client side
  if (lead.admin_comment && lead.admin_comment.created_at) {
    const age = Date.now() - new Date(lead.admin_comment.created_at).getTime();
    if (age > 86400000) lead.admin_comment = null;
  }
  return jsonRes(lead);
}

export async function onRequestPatch(context) {
  // Rate limit: max 10 PATCH requests per IP per minute (prevents spam submission)
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';


  const sb = getSupabase(context.env);
  if (!sb) return errRes('Supabase not configured', 500);
  const token = context.params.token;
  if (!token) return errRes('Token required', 400);

  const rows = await sb.select('velocity_leads', `token=eq.${token}&select=id,submitted_at,first_submitted_at,is_locked,status`);
  if (!rows.length) return errRes('Not found', 404);
  const lead = rows[0];

  // Lock check — use first_submitted_at as the true anchor
  const anchor = lead.first_submitted_at || lead.submitted_at;
  if (lead.is_locked) return errRes('Submission is locked', 403);
  if (anchor && Date.now() - new Date(anchor).getTime() > 86400000) {
    await sb.update('velocity_leads', `token=eq.${token}`, { is_locked: true });
    return errRes('Submission window has closed', 403);
  }
  // Block edits when in_progress or beyond
  if (['in_progress','completed'].includes(lead.status)) {
    return errRes('Project is in progress — contact client@calyvent.com to request changes', 403);
  }

  let body;
  try { body = await context.request.json(); } catch { return errRes('Invalid JSON'); }

  const allowed = ['full_data','submitted_at','due_date','client_name','client_email','upgrade_permission','domain_choice','domain_name','email_verified','personal_email','personal_phone','business_name','business_type','business_email','business_phone','business_address','terms_accepted','terms_accepted_at','scope_accepted','scope_accepted_at'];
  const patch = {};
  for (const key of allowed) { if (body[key] !== undefined) patch[key] = body[key]; }

  // Set first_submitted_at only once — never overwrite
  if (body.submitted_at && !lead.first_submitted_at) {
    patch.first_submitted_at = body.submitted_at;
  }

  if (!Object.keys(patch).length) return errRes('No valid fields to update');

  const updated = await sb.update('velocity_leads', `token=eq.${token}`, patch);
  // Auto-sync to Google Sheets on submission
  if (patch.submitted_at && context.env.SHEETS_WEBHOOK_URL && context.env.ADMIN_SECRET) {
    try {
      context.waitUntil(fetch(new URL(context.request.url).origin + '/api/leads/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': context.env.ADMIN_SECRET },
        body: JSON.stringify({ token }),
      }));
    } catch (_) {}
  }

  // Notify admin when brief is submitted
  if (patch.submitted_at && context.env.RESEND_API_KEY) {
    try {
      const nm = (patch.client_name || '').replace(/</g, '&lt;');
      const em = patch.client_email || '';
      const au = (context.env.SITE_URL || 'https://velocity.calyvent.com') + '/admin';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + context.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Velocity System <client@calyvent.com>',
          to: ['atelier@calyvent.com'],
          subject: 'Brief submitted' + (nm ? ': ' + nm : ''),
          text: 'A brief was submitted.' + (nm ? ' Client: ' + nm : '') + (em ? ' Email: ' + em : '') + ' Admin: ' + au,
        }),
      });
    } catch (_) {}
  }
  return jsonRes({ success: true, lead: Array.isArray(updated) ? updated[0] : updated });
}
