/**
 * POST /api/leads/sync-sheet
 * Pushes a lead's full data to Google Sheets via a Make (or n8n/Zapier) webhook URL.
 * Called automatically on submission and status changes.
 * Can also be called manually from admin to force a re-sync.
 *
 * Requires SHEETS_WEBHOOK_URL env var — set this to your Make webhook URL.
 */
import { getSupabase } from '../../_lib/supabase.js';
import { checkAdminAuth, rateLimit, secureJson, secureErr, secureOptions } from '../../_lib/security.js';

export async function onRequestOptions() { return secureOptions(); }

export async function onRequestPost(context) {
  const webhookUrl = context.env.SHEETS_WEBHOOK_URL;
  if (!webhookUrl) return secureErr('Sheets integration not configured', 503);

  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const kv = context.env.DATA || context.env.LEADS;

  // Rate limit: 30 syncs per IP per minute


  // Auth required — only admin or internal calls
  const auth = await checkAdminAuth(context.request, context.env);
  if (!auth.ok) return secureErr('Unauthorized', 401);

  let body;
  try { body = await context.request.json(); } catch { return secureErr('Invalid request'); }
  const { token } = body;
  if (!token) return secureErr('token required');

  const sb = getSupabase(context.env);
  if (!sb) return secureErr('Service unavailable', 503);

  const rows = await sb.select('velocity_leads', `token=eq.${token}&select=*`).catch(() => []);
  if (!rows.length) return secureErr('Not found', 404);

  const lead = rows[0];
  const p1 = (lead.full_data && lead.full_data.phase1) || {};
  const p2 = (lead.full_data && lead.full_data.phase2) || {};
  const p3 = (lead.full_data && lead.full_data.phase3) || {};
  const p4 = (lead.full_data && lead.full_data.phase4) || {};
  const p5 = (lead.full_data && lead.full_data.phase5) || {};
  const addr = lead.business_address || {};

  // Flat row structure — maps directly to Google Sheet columns
  const sheetRow = {
    // System
    id:                    lead.id,
    token:                 lead.token,
    status:                lead.status,
    submitted_at:          lead.submitted_at || '',
    created_at:            lead.created_at,
    is_paid:               lead.is_paid ? 'Yes' : 'No',
    quote_amount_usd:      lead.quote_amount ? (lead.quote_amount / 100).toFixed(2) : '',
    is_locked:             lead.is_locked ? 'Yes' : 'No',

    // Personal info
    full_name:             lead.client_name || p1.full_name || '',
    personal_email:        lead.personal_email || lead.client_email || p1.email || '',
    personal_phone:        lead.personal_phone || p1.phone || '',

    // Business info
    business_type:         lead.business_type || p1.business_type || '',
    business_name:         lead.business_name || p1.company_name || '',
    business_email:        lead.business_email || p1.business_email || '',
    business_phone:        lead.business_phone || p1.business_phone || '',

    // Address
    street:                addr.street || '',
    city:                  addr.city || '',
    state_province:        addr.state_province || '',
    postal_code:           addr.postal_code || '',
    country:               addr.country || '',

    // Project
    due_date:              lead.due_date || '',
    context:               p1.context || '',
    target_audience:       p2.target_customer || '',
    inspiration_urls:      (p2.inspiration || []).map(i => i.url).join(', '),
    anti_inspiration_urls: (p2.anti_inspiration || []).map(i => i.url).join(', '),
    color_background:      p3.color_background || '',
    color_secondary:       p3.color_secondary || '',
    color_accent:          p3.color_accent || '',
    fonts:                 p3.fonts || '',
    upgrade_permission:    lead.upgrade_permission ? 'Yes' : 'No',
    mottos:                p4.mottos || '',
    copyright:             p4.copyright || '',
    assets_links:          p4.assets_links || '',
    starting_point:        p4.starting_point || '',
    existing_url:          p4.existing_url || '',
    domain_choice:         lead.domain_choice || '',
    domain_name:           lead.domain_name || '',
    socials:               (p1.socials || []).join(', '),
    additional_notes:      p5.additional_notes || '',
    terms_accepted:        lead.terms_accepted ? 'Yes' : 'No',
    terms_accepted_at:     lead.terms_accepted_at || '',
    site_link:             lead.site_link || '',
  };

  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sheetRow),
    });

    if (r.ok) {
      // Mark as synced
      await sb.update('velocity_leads', `token=eq.${token}`, {
        sheets_synced_at: new Date().toISOString(),
      }).catch(() => {});
      return secureJson({ success: true, synced_at: new Date().toISOString() });
    } else {
      const err = await r.text().catch(() => 'unknown');
      return secureErr(`Sheets webhook failed: ${err}`, 502);
    }
  } catch (e) {
    return secureErr('Could not reach Sheets webhook', 502);
  }
}
