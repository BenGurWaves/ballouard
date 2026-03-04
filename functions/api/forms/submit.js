/**
 * POST /api/forms/submit
 * Receives contact form submissions from generated websites.
 * Stores in KV and optionally forwards via email (Resend/Mailgun).
 *
 * Body: { site_id, name, email, phone?, message }
 * Headers: X-Site-Id (alternative to body.site_id)
 */
import { json, err, corsPreflightResponse, getKV, generateId } from '../../_lib/helpers.js';

// Simple rate-limit: max 5 submissions per IP per 10 minutes
async function checkRateLimit(kv, ip) {
  const key = `ratelimit:form:${ip}`;
  const data = await kv.get(key, { type: 'json' }).catch(() => null);
  const now = Date.now();
  if (!data) return { allowed: true, count: 1 };
  // Clean entries older than 10 min
  const recent = (data.timestamps || []).filter(t => now - t < 600_000);
  if (recent.length >= 5) return { allowed: false, count: recent.length };
  return { allowed: true, count: recent.length + 1, timestamps: recent };
}

export async function onRequestPost(context) {
  const kv = getKV(context.env);
  if (!kv) return err('Storage not configured', 500);

  let body;
  try { body = await context.request.json(); } catch { return err('Invalid JSON'); }

  const siteId = (body.site_id || context.request.headers.get('X-Site-Id') || '').trim();
  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const phone = (body.phone || '').trim();
  const message = (body.message || '').trim();

  if (!name) return err('Name is required');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Valid email is required');
  if (!message) return err('Message is required');
  if (message.length > 5000) return err('Message too long (max 5000 characters)');

  // Honeypot check — generated forms include a hidden field named "website"
  if (body.website) return json({ success: true }); // silently discard spam

  // Rate limiting
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateCheck = await checkRateLimit(kv, ip);
  if (!rateCheck.allowed) return err('Too many submissions. Please try again later.', 429);

  // Update rate limit counter
  const rlKey = `ratelimit:form:${ip}`;
  const timestamps = [...(rateCheck.timestamps || []), Date.now()];
  await kv.put(rlKey, JSON.stringify({ timestamps }), { expirationTtl: 600 });

  // Build submission record
  const submissionId = generateId();
  const submission = {
    id: submissionId,
    site_id: siteId || 'unknown',
    name,
    email,
    phone: phone || null,
    message,
    ip,
    submitted_at: new Date().toISOString(),
  };

  // Store individual submission
  await kv.put(`form:${submissionId}`, JSON.stringify(submission), { expirationTtl: 86400 * 180 });

  // Append to site's submissions list (keep last 200)
  const listKey = siteId ? `form_submissions:${siteId}` : 'form_submissions:unlinked';
  try {
    const list = (await kv.get(listKey, { type: 'json' })) || [];
    list.unshift({ id: submissionId, name, email, submitted_at: submission.submitted_at });
    if (list.length > 200) list.length = 200;
    await kv.put(listKey, JSON.stringify(list), { expirationTtl: 86400 * 365 });
  } catch {}

  // Also store in a global submissions feed for admin
  try {
    const globalKey = 'admin:form_submissions';
    const global = (await kv.get(globalKey, { type: 'json' })) || [];
    global.unshift({ id: submissionId, site_id: siteId || 'unknown', name, email, submitted_at: submission.submitted_at });
    if (global.length > 500) global.length = 500;
    await kv.put(globalKey, JSON.stringify(global), { expirationTtl: 86400 * 365 });
  } catch {}

  // Email notification (if configured)
  // Look up the site owner's email from the build record
  if (siteId && context.env.RESEND_API_KEY) {
    try {
      const build = await kv.get(`build:${siteId}`, { type: 'json' });
      if (build?.email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${context.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: context.env.RESEND_FROM || 'Velocity Forms <forms@velocity.calyvent.com>',
            to: build.email,
            subject: `New contact form message from ${name}`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
<h2 style="color:#1a2e1c">New Contact Form Submission</h2>
<table style="width:100%;border-collapse:collapse">
<tr><td style="padding:8px 0;color:#666;width:80px"><strong>Name</strong></td><td style="padding:8px 0">${name}</td></tr>
<tr><td style="padding:8px 0;color:#666"><strong>Email</strong></td><td style="padding:8px 0"><a href="mailto:${email}">${email}</a></td></tr>
${phone ? `<tr><td style="padding:8px 0;color:#666"><strong>Phone</strong></td><td style="padding:8px 0"><a href="tel:${phone}">${phone}</a></td></tr>` : ''}
</table>
<div style="margin:20px 0;padding:16px;background:#f5f5f0;border-radius:8px;white-space:pre-wrap">${message}</div>
<p style="color:#999;font-size:12px">Sent via your Velocity website contact form</p>
</div>`,
          }),
        });
      }
    } catch {} // Don't fail the submission if email fails
  }

  return json({ success: true, submission_id: submissionId });
}

export async function onRequestOptions() {
  return corsPreflightResponse();
}
