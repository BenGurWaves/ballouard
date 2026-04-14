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
                subject: 'Payment confirmed',
                html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#0D0C09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D0C09;min-height:100vh">
<tr><td align="center" style="padding:48px 20px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px">
<tr><td style="padding:0 0 40px">
  <span style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:400;color:#DEC8B5;letter-spacing:-.02em">Velocity<span style="color:#C49C7B">.</span></span>
  <span style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#565250;margin-left:10px">by Calyvent</span>
</td></tr>
<tr><td style="border-top:1px solid rgba(222,200,181,.08);padding-top:36px">
  <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;color:#DEC8B5;letter-spacing:-.035em;margin:0 0 22px;line-height:1.12">Confirmed,<br>${name}.</h1>
  <p style="font-size:13px;color:#8a8680;line-height:1.95;margin:0 0 18px">Your payment of <strong style="color:#DEC8B5;font-weight:400">${amount}</strong> has been received. Your project is booked and you are in queue.</p>
  <p style="font-size:13px;color:#8a8680;line-height:1.95;margin:0 0 18px">We will be in touch within 24 hours to align on next steps. Your project dashboard is live below.</p>
  <table cellpadding="0" cellspacing="0" style="margin:0 0 32px"><tr><td style="background:#DEC8B5"><a href="https://velocity.calyvent.com/dashboard/${token}" style="display:block;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#0D0C09;text-decoration:none;padding:13px 30px;font-weight:500">View Dashboard &rarr;</a></td></tr></table>
  <p style="font-size:12px;color:#565250;line-height:1.75;margin:0">Questions? Reply to this email or write to <a href="mailto:client@calyvent.com" style="color:#C49C7B;text-decoration:none">client@calyvent.com</a></p>
</td></tr>
<tr><td style="border-top:1px solid rgba(222,200,181,.06);padding-top:24px;margin-top:40px">
  <p style="font-size:11px;color:#3a3835;letter-spacing:.05em;margin:0;line-height:1.8">Velocity by Calyvent &mdash; velocity.calyvent.com</p>
  <p style="font-size:11px;color:#3a3835;letter-spacing:.04em;margin:8px 0 0;line-height:1.8">&copy; 2026 Calyvent. All rights reserved.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`,
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
