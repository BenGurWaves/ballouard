/**
 * PATCH /api/leads/admin-update — Admin only.
 * Handles: quote_amount, status, admin_comment, site_link
 * Also triggers Resend email on status change.
 */
import { getSupabase } from '../../_lib/supabase.js';
import { checkAdminAuth, rateLimit, validateLength, safeUrl, secureJson, secureErr, secureOptions } from '../../_lib/security.js';

const VALID_STATUSES = ['outreach','responded','onboarding_sent','pending','scope_sent','accepted','paid','in_progress','completed','declined','archived'];

// Shared email shell
function emailShell(innerHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
</head>
<body style="margin:0;padding:0;background:#0D0C09;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0D0C09">
<tr><td align="center" style="padding:52px 24px 64px">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px">

<!-- Wordmark -->
<tr><td style="padding:0 0 44px">
  <span style="font-family:Georgia,'Times New Roman',serif;font-size:17px;font-weight:400;color:#DEC8B5;letter-spacing:-.025em">Velocity<span style="color:#C49C7B">.</span></span>
</td></tr>

<!-- Rule -->
<tr><td style="background:rgba(222,200,181,.08);height:1px;padding:0;font-size:0;line-height:0">&nbsp;</td></tr>

<!-- Body -->
<tr><td style="padding:40px 0 0">
${innerHtml}
</td></tr>

<!-- Footer rule -->
<tr><td style="background:rgba(222,200,181,.05);height:1px;padding:0;font-size:0;line-height:0;margin-top:40px">&nbsp;</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 0 0">
  <p style="font-size:11px;color:#3a3835;letter-spacing:.05em;margin:0;line-height:1.8">Velocity by Calyvent &mdash; velocity.calyvent.com</p>
  <p style="font-size:11px;color:#3a3835;letter-spacing:.04em;margin:8px 0 0;line-height:1.8">&copy; 2026 Calyvent. All rights reserved.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function ctaButton(label, url) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:32px 0">
<tr><td style="background:#DEC8B5">
  <a href="${url}" style="display:block;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#0D0C09;text-decoration:none;padding:13px 30px;font-weight:500">${label} &rarr;</a>
</td></tr>
</table>`;
}

function h1(text) {
  return `<h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;color:#DEC8B5;letter-spacing:-.035em;margin:0 0 22px;line-height:1.12">${text}</h1>`;
}

function p(text, style = '') {
  return `<p style="font-size:13px;color:#8a8680;line-height:1.95;margin:0 0 18px;${style}">${text}</p>`;
}

function small(text) {
  return `<p style="font-size:12px;color:#565250;line-height:1.8;margin:0 0 8px">${text}</p>`;
}

const STATUS_EMAIL = {
  accepted: {
    subject: 'Your project has been accepted.',
    body: (name, dashUrl) => emailShell(`
      ${h1('Good news,<br>' + name + '.')}
      ${p('Your brief has been reviewed. We’re moving forward.')}
      ${p('A custom quote is waiting for you on your dashboard. Review it at your convenience — once you’re ready, a single click confirms your project and puts you in queue.')}
      ${ctaButton('Review Quote & Confirm', dashUrl)}
      ${small('Questions? Reply directly to this email.')}
      ${small('You have 24 hours from your original submission to edit your brief if anything needs adjusting.')}
    `)
  },
  in_progress: {
    subject: 'Your project is in progress.',
    body: (name, dashUrl) => emailShell(`
      ${h1('Work has<br>begun, ' + name + '.')}
      ${p('Your project is now in active development. We have everything we need.')}
      ${p('Your brief is locked to keep the scope clean and the work focused. If anything important has changed, reply to this email and we’ll discuss it.')}
      ${p('We’ll be in touch with updates. In the meantime, you can track your project status on your dashboard.')}
      ${ctaButton('View Project Status', dashUrl)}
      ${small('Estimated timeline is based on the deadline you provided in your brief.')}
    `)
  },
  completed: {
    subject: 'Your website is live.',
    body: (name, dashUrl, siteLink) => emailShell(`
      ${h1('It’s live,<br>' + name + '.')}
      ${p('Your website is complete and live on the web. This is the moment everything was building toward.')}
      ${siteLink
        ? `${p('Your site is live at:')}
           <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px">
           <tr><td style="background:rgba(196,156,123,.08);border:1px solid rgba(196,156,123,.18);padding:14px 20px">
             <a href="${siteLink}" style="font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#C49C7B;text-decoration:none;letter-spacing:-.01em">${siteLink} &#8599;</a>
           </td></tr></table>`
        : `${p('Log in to your dashboard to access the link to your finished site.')}`
      }
      ${p('It has been a pleasure. Your dashboard will remain active if you ever need to reference your brief or get back in touch.')}
      ${ctaButton('Open Dashboard', dashUrl)}
      ${small('Thank you for choosing Velocity.')}
    `)
  },
  declined: {
    subject: 'An update on your Velocity enquiry.',
    body: (name) => emailShell(`
      ${h1('Thank you<br>for reaching out.')}
      ${p('We’ve taken time to carefully review your brief. After consideration, we’ve decided not to move forward with this particular project.')}
      ${p('This is not a reflection on your work or your idea. We take on a deliberately small number of projects at any given time, and we only commit when we’re confident we can give the work the attention it deserves.')}
      ${p('We hope you find the right partner for it. If your circumstances change or you have a future project that might be a better fit, we’re always open to a conversation.')}
      ${small('You’re welcome to reply to this email if you have questions.')}
    `)
  },
};

export async function onRequestOptions() { return secureOptions(); }

export async function onRequestPatch(context) {

  const auth = await checkAdminAuth(context.request, context.env);
  if (auth.locked) return secureErr('Too many failed attempts. Try again in 15 minutes.', 429);
  if (!auth.ok)    return secureErr('Unauthorized', 401);
  const sb = getSupabase(context.env);
  if (!sb) return secureErr('Service unavailable', 503);

  let body;
  try { body = await context.request.json(); } catch { return errRes('Invalid JSON'); }

  const { token, quote_amount, status, admin_comment, site_link, scope_text, scope_sent_at } = body;
  if (!token) return errRes('token required');

  const patch = {};
  let prevStatus = null;

  // Fetch current lead for email / name
  const rows = await sb.select('velocity_leads', `token=eq.${token}&select=status,client_email,client_name,full_data,site_link`);
  if (!rows.length) return errRes('Not found', 404);
  const lead = rows[0];
  prevStatus = lead.status;

  if (quote_amount !== undefined) {
    const amt = parseInt(quote_amount, 10);
    if (isNaN(amt) || amt < 0) return errRes('Invalid quote_amount');
    patch.quote_amount = amt;
  }
  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) return errRes('Invalid status');
    patch.status = status;
    // Lock brief when in_progress or beyond
    if (['in_progress','completed','declined'].includes(status)) {
      patch.is_locked = true;
    }
  }
  if (admin_comment !== undefined || body.admin_comment_link !== undefined) {
    if (admin_comment !== undefined) {
      patch.admin_comment = admin_comment
        ? { text: admin_comment, created_at: new Date().toISOString() }
        : null;
    } else {
      // Only link is being updated — fetch existing comment to merge
      const existing = lead.admin_comment || {};
      if (existing.text) {
        patch.admin_comment = { ...existing };
      }
    }
    if (body.admin_comment_link !== undefined && patch.admin_comment) {
      patch.admin_comment.link = body.admin_comment_link ? safeUrl(body.admin_comment_link) : null;
    }
  }
  if (scope_text !== undefined) { patch.scope_text = scope_text || null; }
  if (scope_sent_at !== undefined) { patch.scope_sent_at = scope_sent_at || null; }
    if (site_link !== undefined) {
    patch.site_link = site_link ? safeUrl(site_link) : null;
  }

  if (!Object.keys(patch).length) return errRes('Nothing to update');

  const updated = await sb.update('velocity_leads', `token=eq.${token}`, patch);

  // Auto-sync to Google Sheets on status change
  if (status && context.env.SHEETS_WEBHOOK_URL && context.env.ADMIN_SECRET) {
    try {
      context.waitUntil(fetch(new URL(context.request.url).origin + '/api/leads/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': context.env.ADMIN_SECRET },
        body: JSON.stringify({ token }),
      }));
    } catch (_) {}
  }

  // Send status change email via Resend
  let emailResult = null;
  if (status && status !== prevStatus && context.env.RESEND_API_KEY) {
    const tpl = STATUS_EMAIL[status];
    if (tpl) {
      const p1 = (lead.full_data && lead.full_data.phase1) || {};
      const name = lead.client_name || p1.full_name || 'there';
      const email = lead.client_email || p1.email;
      const siteLink = patch.site_link || lead.site_link;
      const base = context.env.SITE_URL || 'https://velocity.calyvent.com';
      const dashboardUrl = `${base}/dashboard/${token}`;
      const fromAddr = context.env.RESEND_FROM_EMAIL
        ? `Velocity <${context.env.RESEND_FROM_EMAIL}>`
        : `Velocity <client@calyvent.com>`;
      if (email) {
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${context.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: fromAddr,
              to: [email],
              subject: tpl.subject,
              html: tpl.body(name, dashboardUrl, siteLink),
            }),
          });
          const emailData = await emailRes.json();
          emailResult = emailRes.ok
            ? { sent: true, id: emailData.id }
            : { sent: false, error: emailData.message || emailData.name || JSON.stringify(emailData) };
        } catch (emailErr) {
          emailResult = { sent: false, error: String(emailErr) };
        }
      } else {
        emailResult = { sent: false, error: 'No email address on lead' };
      }
    }
  }

  return secureJson({ success: true, lead: Array.isArray(updated) ? updated[0] : updated, email: emailResult });
}
