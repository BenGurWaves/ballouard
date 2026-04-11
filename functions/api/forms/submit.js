/**
 * POST /api/forms/submit
 * Receives contact form submissions from generated websites.
 * Stores in KV and optionally forwards via email (Resend).
 *
 * Body: { site_id, name, email, phone?, message }
 * Headers: X-Site-Id (alternative to body.site_id)
 */
import { json, err, getKV, generateId } from '../../_lib/helpers.js';

// HTML-escape user input before injecting into email templates
function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// CORS — allow any origin so client preview sites on their own domains can POST
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Site-Id',
  };
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function jsonErr(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// OPTIONS preflight — required for cross-origin form submissions
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// Rate-limit: max 5 submissions per IP per 10 minutes
async function checkRateLimit(kv, ip) {
  const key = `ratelimit:form:${ip}`;
  const data = await kv.get(key, { type: 'json' }).catch(() => null);
  const now = Date.now();
  const recent = ((data && data.timestamps) || []).filter(t => now - t < 600_000);
  if (recent.length >= 5) return { allowed: false, timestamps: recent };
  return { allowed: true, timestamps: recent };
}

export async function onRequestPost(context) {
  const kv = getKV(context.env);
  if (!kv) return jsonErr('Storage not configured', 500);

  let body;
  try { body = await context.request.json(); } catch { return jsonErr('Invalid JSON'); }

  const siteId  = (body.site_id || context.request.headers.get('X-Site-Id') || '').trim();
  const name    = (body.name    || '').trim();
  const email   = (body.email   || '').trim().toLowerCase();
  const phone   = (body.phone   || '').trim();
  const message = (body.message || '').trim();

  if (!name)                                                    return jsonErr('Name is required');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))    return jsonErr('Valid email is required');
  if (!message)                                                 return jsonErr('Message is required');
  if (message.length > 5000)                                   return jsonErr('Message too long (max 5000 characters)');

  // Honeypot — hidden field "website" added by generated forms to catch bots
  if (body.website) return jsonOk({ success: true });

  // Rate limiting
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateCheck = await checkRateLimit(kv, ip);
  if (!rateCheck.allowed) return jsonErr('Too many submissions. Please try again later.', 429);

  // Update rate limit counter
  const timestamps = [...rateCheck.timestamps, Date.now()];
  await kv.put(`ratelimit:form:${ip}`, JSON.stringify({ timestamps }), { expirationTtl: 600 });

  // Build submission record
  const submissionId = generateId();
  const submission = {
    id: submissionId,
    site_id: siteId || 'unknown',
    name, email,
    phone: phone || null,
    message,
    ip,
    submitted_at: new Date().toISOString(),
  };

  await kv.put(`form:${submissionId}`, JSON.stringify(submission), { expirationTtl: 86400 * 180 });

  // Append to site submissions list (keep last 200)
  const listKey = siteId ? `form_submissions:${siteId}` : 'form_submissions:unlinked';
  try {
    const list = (await kv.get(listKey, { type: 'json' })) || [];
    list.unshift({ id: submissionId, name, email, submitted_at: submission.submitted_at });
    if (list.length > 200) list.length = 200;
    await kv.put(listKey, JSON.stringify(list), { expirationTtl: 86400 * 365 });
  } catch (_) {}

  // Global submissions feed
  try {
    const global = (await kv.get('admin:form_submissions', { type: 'json' })) || [];
    global.unshift({ id: submissionId, site_id: siteId || 'unknown', name, email, submitted_at: submission.submitted_at });
    if (global.length > 500) global.length = 500;
    await kv.put('admin:form_submissions', JSON.stringify(global), { expirationTtl: 86400 * 365 });
  } catch (_) {}

  // Email notification
  if (siteId && context.env.RESEND_API_KEY) {
    try {
      const build = await kv.get(`build:${siteId}`, { type: 'json' });
      if (build?.email) {
        // Escape ALL user inputs before injecting into HTML
        const safeName    = esc(name);
        const safeEmail   = esc(email);
        const safePhone   = esc(phone);
        const safeMessage = esc(message);

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: context.env.RESEND_FROM || 'Velocity Forms <forms@velocity.calyvent.com>',
            to: build.email,
            subject: `New contact form message from ${safeName}`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<h2 style="color:#1a2e1c">New Contact Form Submission</h2>
<table style="width:100%;border-collapse:collapse">
<tr><td style="padding:8px 0;color:#666;width:80px"><strong>Name</strong></td><td style="padding:8px 0">${safeName}</td></tr>
<tr><td style="padding:8px 0;color:#666"><strong>Email</strong></td><td style="padding:8px 0"><a href="mailto:${safeEmail}">${safeEmail}</a></td></tr>
${safePhone ? `<tr><td style="padding:8px 0;color:#666"><strong>Phone</strong></td><td style="padding:8px 0">${safePhone}</td></tr>` : ''}
</table>
<div style="margin:20px 0;padding:16px;background:#f5f5f0;border-radius:8px;white-space:pre-wrap">${safeMessage}</div>
<p style="color:#999;font-size:12px">Sent via your Velocity website contact form</p>
</div>`,
          }),
        });
      }
    } catch (_) {}
  }

  return jsonOk({ success: true, submission_id: submissionId });
}
