/**
 * POST /api/stripe/checkout — Creates Stripe Checkout Session from lead quote.
 */
import { getSupabase, jsonRes, errRes, optionsRes } from '../../_lib/supabase.js';
import { rateLimit } from '../../_lib/security.js';

export async function onRequestOptions() { return optionsRes(); }

export async function onRequestPost(context) {


  const sb = getSupabase(context.env);
  if (!sb) return errRes('Service unavailable', 503);
  const stripeKey = context.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return errRes('Service unavailable', 503);

  let body;
  try { body = await context.request.json(); } catch { return errRes('Invalid JSON'); }
  const { token } = body;
  if (!token) return errRes('token required');

  const rows = await sb.select('velocity_leads', `token=eq.${token}&select=id,quote_amount,is_paid,client_email,status`);
  if (!rows.length) return errRes('Not found', 404);
  const lead = rows[0];

  if (lead.is_paid)                          return errRes('Already paid');
  if (!lead.quote_amount || lead.quote_amount <= 0) return errRes('No quote set yet');
  if (lead.status === 'declined')            return errRes('Project declined');

  const base = context.env.SITE_URL || 'https://velocity.calyvent.com';
  const params = new URLSearchParams({
    'payment_method_types[]': 'card',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(lead.quote_amount),
    'line_items[0][price_data][product_data][name]': 'Velocity — Website Design & Development',
    'line_items[0][price_data][product_data][description]': 'Bespoke website by Velocity, a Calyvent studio.',
    'line_items[0][quantity]': '1',
    'mode': 'payment',
    'customer_email': lead.client_email || '',
    'success_url': `${base}/dashboard/${token}?paid=1`,
    'cancel_url': `${base}/dashboard/${token}`,
    'metadata[lead_token]': token,
    'metadata[lead_id]': lead.id,
  });

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!r.ok) { const e = await r.json(); return errRes(e.error?.message || 'Stripe error', 500); }

  const session = await r.json();
  await sb.update('velocity_leads', `token=eq.${token}`, { stripe_session_id: session.id });
  return jsonRes({ url: session.url });
}
