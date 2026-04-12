/**
 * POST /api/stripe/webhook
 * checkout.session.completed → mark lead paid + send client receipt
 */
import { getSupabase, jsonRes, errRes } from '../../_lib/supabase.js';

export async function onRequestPost(context) {
  const sig     = context.request.headers.get('stripe-signature');
  const secret  = context.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = await context.request.text();

  if (secret && sig) {
    const valid = await verifyStripeSignature(rawBody, sig, secret);
    if (!valid) return errRes('Invalid signature', 400);
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return errRes('Invalid JSON'); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const token = session.metadata?.lead_token;
    if (token) {
      const sb = getSupabase(context.env);
      if (sb) {
        // Fetch lead for email
        const rows = await sb.select('velocity_leads', `token=eq.${token}&select=client_email,client_name,full_data,quote_amount`).catch(()=>[]);
        const lead = rows[0] || {};
        const p1 = (lead.full_data && lead.full_data.phase1) || {};
        const email = lead.client_email || p1.email;
        const name = lead.client_name || p1.full_name || 'there';
        const amount = lead.quote_amount ? new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(lead.quote_amount/100) : '';

        await sb.update('velocity_leads', `token=eq.${token}`, {
          is_paid: true,
          stripe_payment_intent: session.payment_intent || null,
          status: 'accepted',
        });

        // Send client receipt
        if (email && context.env.RESEND_API_KEY) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${context.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'Velocity <client@calyvent.com>',
                to: [email],
                subject: 'Payment confirmed — your Velocity project is locked in.',
                html: `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:48px 28px;background:#0D0C09;color:#DEC8B5">
                  <div style="font-family:Georgia,serif;font-size:20px;margin-bottom:32px;color:#DEC8B5">Velocity<span style="color:#C49C7B">.</span></div>
                  <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;color:#DEC8B5;margin:0 0 16px">Payment received, ${name}.</h1>
                  <p style="font-size:14px;color:#8a8680;line-height:1.8;margin:0 0 16px">Your payment of <strong style="color:#DEC8B5">${amount}</strong> has been confirmed. Your project is now locked in and we'll be in touch shortly to get started.</p>
                  <p style="font-size:14px;color:#8a8680;line-height:1.8;margin:0 0 24px">Keep an eye on your dashboard for status updates.</p>
                  <div style="border-top:1px solid rgba(222,200,181,.1);padding-top:20px;margin-top:16px">
                    <p style="font-size:12px;color:#565250">Questions? Reply to this email or reach us at <a href="mailto:client@calyvent.com" style="color:#C49C7B">client@calyvent.com</a></p>
                    <p style="font-size:11px;color:#565250;margin-top:6px">&copy; 2026 Velocity by Calyvent</p>
                  </div>
                </div>`,
              }),
            });
          } catch (_) {}
        }
      }
    }
  }
  return jsonRes({ received: true });
}

async function verifyStripeSignature(payload, header, secret) {
  try {
    const parts     = header.split(',');
    const timestamp = parts.find(p => p.startsWith('t=')).split('=')[1];
    const sigHash   = parts.find(p => p.startsWith('v1=')).split('=')[1];
    const signed    = `${timestamp}.${payload}`;
    const enc       = new TextEncoder();
    const key       = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const buf       = await crypto.subtle.sign('HMAC', key, enc.encode(signed));
    const computed  = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    return computed === sigHash;
  } catch { return false; }
}
