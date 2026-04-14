/**
 * PATCH /api/leads/admin-update — Admin only.
 * Handles: quote_amount, status, admin_comment, site_link
 * Also triggers Resend email on status change.
 */
import { getSupabase, isAdmin, jsonRes, errRes, optionsRes } from '../../_lib/supabase.js';

const VALID_STATUSES = ['pending','accepted','in_progress','declined','completed'];

const STATUS_EMAIL = {
  accepted: {
    subject: 'Your Velocity project has been accepted.',
    body: (name) => `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:48px 28px;background:#0D0C09;color:#DEC8B5">
      <div style="font-family:Georgia,serif;font-size:20px;margin-bottom:32px;color:#DEC8B5">Velocity<span style="color:#C49C7B">.</span></div>
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;color:#DEC8B5;margin:0 0 16px">Good news, ${name}.</h1>
      <p style="font-size:14px;color:#8a8680;line-height:1.8;margin:0 0 24px">We've reviewed your brief and we're moving forward. Your quote is ready — log in to your dashboard to review and confirm payment.</p>
      <p style="font-size:12px;color:#565250;margin:32px 0 0">Velocity by Calyvent &mdash; <a href="https://velocity.calyvent.com" style="color:#C49C7B">velocity.calyvent.com</a></p>
    </div>`
  },
  in_progress: {
    subject: 'Your Velocity project is now in progress.',
    body: (name) => `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:48px 28px;background:#0D0C09;color:#DEC8B5">
      <div style="font-family:Georgia,serif;font-size:20px;margin-bottom:32px;color:#DEC8B5">Velocity<span style="color:#C49C7B">.</span></div>
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;color:#DEC8B5;margin:0 0 16px">We're building, ${name}.</h1>
      <p style="font-size:14px;color:#8a8680;line-height:1.8;margin:0 0 24px">Your project is now in active development. Your brief is locked to protect scope. We'll be in touch with progress updates. For any changes, reply to this email.</p>
      <p style="font-size:12px;color:#565250;margin:32px 0 0">Velocity by Calyvent &mdash; <a href="https://velocity.calyvent.com" style="color:#C49C7B">velocity.calyvent.com</a></p>
    </div>`
  },
  completed: {
    subject: 'Your Velocity project is complete.',
    body: (name, siteLink) => `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:48px 28px;background:#0D0C09;color:#DEC8B5">
      <div style="font-family:Georgia,serif;font-size:20px;margin-bottom:32px;color:#DEC8B5">Velocity<span style="color:#C49C7B">.</span></div>
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;color:#DEC8B5;margin:0 0 16px">It's live, ${name}.</h1>
      <p style="font-size:14px;color:#8a8680;line-height:1.8;margin:0 0 24px">Your site is complete and live.${siteLink ? ` View it here: <a href="${siteLink}" style="color:#C49C7B">${siteLink}</a>` : ' Log in to your dashboard for the link.'}</p>
      <p style="font-size:12px;color:#565250;margin:32px 0 0">Velocity by Calyvent &mdash; <a href="https://velocity.calyvent.com" style="color:#C49C7B">velocity.calyvent.com</a></p>
    </div>`
  },
  declined: {
    subject: 'An update on your Velocity enquiry.',
    body: (name) => `<div style="font-family:-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:48px 28px;background:#0D0C09;color:#DEC8B5">
      <div style="font-family:Georgia,serif;font-size:20px;margin-bottom:32px;color:#DEC8B5">Velocity<span style="color:#C49C7B">.</span></div>
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;color:#DEC8B5;margin:0 0 16px">Thank you for reaching out, ${name}.</h1>
      <p style="font-size:14px;color:#8a8680;line-height:1.8;margin:0 0 24px">After reviewing your brief, we've determined that this particular project isn't the right fit for our studio at this time. This is not a reflection of your project's quality — we're selective about the work we take on to ensure every client receives our full attention.</p>
      <p style="font-size:14px;color:#8a8680;line-height:1.8;margin:0 0 24px">We wish you the best with your project and hope our paths cross again in the future.</p>
      <p style="font-size:12px;color:#565250;margin:32px 0 0">Velocity by Calyvent &mdash; <a href="https://velocity.calyvent.com" style="color:#C49C7B">velocity.calyvent.com</a></p>
    </div>`
  },
};

export async function onRequestOptions() { return optionsRes(); }

export async function onRequestPatch(context) {
  if (!isAdmin(context.request, context.env)) return errRes('Unauthorized', 401);
  const sb = getSupabase(context.env);
  if (!sb) return errRes('Supabase not configured', 500);

  let body;
  try { body = await context.request.json(); } catch { return errRes('Invalid JSON'); }

  const { token, quote_amount, status, admin_comment, site_link } = body;
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
      patch.admin_comment.link = body.admin_comment_link || null;
    }
  }
  if (site_link !== undefined) {
    patch.site_link = site_link || null;
  }

  if (!Object.keys(patch).length) return errRes('Nothing to update');

  const updated = await sb.update('velocity_leads', `token=eq.${token}`, patch);

  // Send status change email via Resend
  let emailResult = null;
  if (status && status !== prevStatus && context.env.RESEND_API_KEY) {
    const tpl = STATUS_EMAIL[status];
    if (tpl) {
      const p1 = (lead.full_data && lead.full_data.phase1) || {};
      const name = lead.client_name || p1.full_name || 'there';
      const email = lead.client_email || p1.email;
      const siteLink = patch.site_link || lead.site_link;
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
              html: tpl.body(name, siteLink),
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

  return jsonRes({ success: true, lead: Array.isArray(updated) ? updated[0] : updated, email: emailResult });
}
