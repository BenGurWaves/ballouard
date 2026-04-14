/**
 * GET /admin/client/:token?s=ADMIN_SECRET
 * Full brief page — auth via query param (browser window.open can't set headers)
 */
import { getSupabase } from '../../_lib/supabase.js';

function isAdmin(request, env) {
  const url = new URL(request.url);
  const qs  = url.searchParams.get('s') || '';
  const hdr = request.headers.get('X-Admin-Secret') || '';
  return (qs && qs === env.ADMIN_SECRET) || (hdr && hdr === env.ADMIN_SECRET);
}

export async function onRequestGet(context) {
  if (!isAdmin(context.request, context.env)) {
    return new Response('Unauthorized — open this link from the admin panel.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  const sb = getSupabase(context.env);
  if (!sb) return new Response('Supabase not configured', { status: 500 });

  const token = context.params.token;
  const rows  = await sb.select('velocity_leads', `token=eq.${token}&select=*`);
  if (!rows.length) return new Response('Not found', { status: 404 });

  const lead = rows[0];
  const p1   = (lead.full_data && lead.full_data.phase1) || {};
  const p2   = (lead.full_data && lead.full_data.phase2) || {};
  const p3   = (lead.full_data && lead.full_data.phase3) || {};
  const p4   = (lead.full_data && lead.full_data.phase4) || {};
  const p5   = (lead.full_data && lead.full_data.phase5) || {};

  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const row = (k, v) => v ? `<tr><td style="padding:6px 16px 6px 0;color:#888;font-size:13px;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 0;font-size:13px;color:#e8ddd3;vertical-align:top">${esc(String(v))}</td></tr>` : '';
  const section = (title, rows) => rows ? `<div style="margin:0 0 32px"><div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#C49C7B;margin-bottom:10px">${title}</div><table style="border-collapse:collapse;width:100%">${rows}</table></div>` : '';

  const insp = (p2.inspiration||[]).filter(i=>i.url).map(i=>`<div style="margin-bottom:10px;padding:10px;background:rgba(255,255,255,.03);border:1px solid rgba(222,200,181,.07)"><div style="font-size:12px;color:#C49C7B">${esc(i.url)}</div><div style="font-size:12px;color:#888;margin-top:4px">${esc(i.notes||'—')}</div></div>`).join('');
  const anti = (p2.anti_inspiration||[]).filter(i=>i.url).map(i=>`<div style="margin-bottom:10px;padding:10px;background:rgba(255,255,255,.03);border:1px solid rgba(222,200,181,.07)"><div style="font-size:12px;color:#c08080">${esc(i.url)}</div><div style="font-size:12px;color:#888;margin-top:4px">${esc(i.notes||'—')}</div></div>`).join('');
  const socials = (p1.socials||[]).map(s=>`<a href="${esc(s)}" target="_blank" style="color:#C49C7B;font-size:12px;display:block;margin-bottom:4px">${esc(s)}</a>`).join('');

  const aiBrief = `CLIENT: ${lead.client_name||p1.full_name||''}
COMPANY: ${p1.company_name||''}
EMAIL: ${lead.client_email||p1.email||''}
PHONE: ${p1.phone||''}
DEADLINE: ${lead.due_date||''}
STATUS: ${lead.status}

BUSINESS CONTEXT:
${p1.context||''}

WHO IS THIS SITE FOR:
${p2.target_customer||''}

INSPIRATION SITES:
${(p2.inspiration||[]).map(i=>`- ${i.url}${i.notes?' ('+i.notes+')':''}`).join('\n')}

ANTI-INSPIRATION (AVOID):
${(p2.anti_inspiration||[]).map(i=>`- ${i.url}${i.notes?' ('+i.notes+')':''}`).join('\n')}

COLORS:
Background: ${p3.color_background||''}
Secondary: ${p3.color_secondary||''}
Accent: ${p3.color_accent||''}
Additional: ${p3.colors_extra||''}

TYPOGRAPHY: ${p3.fonts||''}
UPGRADE PERMISSION: ${lead.upgrade_permission?'YES — team has full creative latitude':'NO — follow client specs'}

MOTTOS/TAGLINES: ${p4.mottos||''}
COPYRIGHT: ${p4.copyright||''}
STARTING POINT: ${p4.starting_point||''}
EXISTING SITE: ${p4.existing_url||''}
ASSETS: ${p4.assets_links||''}

SOCIALS: ${(p1.socials||[]).join(', ')}
INCLUDE SOCIAL ICONS: ${p1.include_socials?'Yes':'No'}

DOMAIN: ${
  lead.domain_choice==='client_provides'?'Client provides and connects own domain':
  lead.domain_choice==='client_has_needs_setup'?`Client has domain (${lead.domain_name||'TBD'}) — Velocity to configure`:
  lead.domain_choice==='velocity_provides'?`Velocity to register: ${lead.domain_name||'TBD'}`:
  'Not specified'
}

ADDITIONAL NOTES: ${p5.additional_notes||''}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brief — ${esc(lead.client_name||p1.full_name||'Client')} — Velocity Admin</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0D0C09;color:#DEC8B5;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased}
.topbar{background:rgba(13,12,9,.96);border-bottom:1px solid rgba(222,200,181,.07);padding:14px 40px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.brand{font-family:'Instrument Serif',Georgia,serif;font-size:1rem;color:#DEC8B5}.brand em{font-style:normal;color:#C49C7B}
.back{font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;color:#565250;text-decoration:none;transition:color .2s}.back:hover{color:#DEC8B5}
.wrap{max-width:820px;margin:0 auto;padding:48px 40px 80px}
.hero{font-family:'Instrument Serif',Georgia,serif;font-size:clamp(2.5rem,5vw,4.5rem);font-weight:400;letter-spacing:-.04em;line-height:1;color:#DEC8B5;margin-bottom:8px}
.sub{font-size:.72rem;color:#565250;letter-spacing:.1em;margin-bottom:40px}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:48px}
.badge{display:inline-flex;font-size:.55rem;letter-spacing:.14em;text-transform:uppercase;padding:.28rem .7rem;border:1px solid}
.ai-block{background:rgba(196,156,123,.05);border:1px solid rgba(196,156,123,.15);padding:20px;margin-bottom:40px;position:relative}
.ai-label{font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:#C49C7B;margin-bottom:12px}
.ai-text{font-size:.75rem;color:#8a8680;line-height:1.85;white-space:pre-wrap;font-family:'Inter',sans-serif}
.copy-btn{position:absolute;top:14px;right:14px;font-size:.56rem;letter-spacing:.12em;text-transform:uppercase;color:#C49C7B;border:1px solid rgba(196,156,123,.25);padding:.28rem .7rem;background:transparent;cursor:pointer;transition:border-color .2s}
.copy-btn:hover{border-color:#C49C7B}
</style>
</head>
<body>
<div class="topbar">
  <a class="brand" href="/">Velocity<em>.</em></a>
  <a class="back" href="/admin">&#8592; Back to Admin</a>
</div>
<div class="wrap">
  <div class="hero">${esc(lead.client_name||p1.full_name||'Unnamed')}<span style="color:#C49C7B">.</span></div>
  <div class="sub">${esc(lead.client_email||p1.email||'')}${lead.submitted_at?' &mdash; Submitted '+new Date(lead.submitted_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}):' &mdash; Not yet submitted'}</div>
  <div class="badges">
    <span class="badge" style="color:#C49C7B;border-color:rgba(196,156,123,.3)">${lead.status||'pending'}</span>
    ${lead.is_paid?'<span class="badge" style="color:#8fc98f;border-color:rgba(143,201,143,.3)">Paid</span>':''}
    ${lead.upgrade_permission?'<span class="badge" style="color:#C49C7B;border-color:rgba(196,156,123,.2)">Upgrade Approved</span>':''}
    ${lead.quote_amount?`<span class="badge" style="color:#DEC8B5;border-color:rgba(222,200,181,.13)">${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(lead.quote_amount/100)}</span>`:''}
  </div>

  <div class="ai-block">
    <div class="ai-label">AI Build Brief &mdash; Copy &amp; Paste</div>
    <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('aibf').textContent);this.textContent='Copied';setTimeout(()=>this.textContent='Copy',2000)">Copy</button>
    <pre class="ai-text" id="aibf">${esc(aiBrief)}</pre>
  </div>

  ${section('Identity', row('Full Name',lead.client_name||p1.full_name)+row('Company',p1.company_name)+row('Email',lead.client_email||p1.email)+row('Phone',p1.phone)+row('Deadline',lead.due_date)+row('Submitted',lead.submitted_at?new Date(lead.submitted_at).toLocaleString():''))}
  ${p1.context?section('Business Context',`<tr><td colspan="2" style="font-size:13px;color:#e8ddd3;line-height:1.8;padding:6px 0;white-space:pre-wrap">${esc(p1.context)}</td></tr>`):''}
  ${p2.target_customer?section('Who Is This Site For',`<tr><td colspan="2" style="font-size:13px;color:#e8ddd3;line-height:1.8;padding:6px 0;white-space:pre-wrap">${esc(p2.target_customer)}</td></tr>`):''}
  ${insp?`<div style="margin:0 0 32px"><div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#C49C7B;margin-bottom:10px">Inspiration</div>${insp}</div>`:''}
  ${anti?`<div style="margin:0 0 32px"><div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#C49C7B;margin-bottom:10px">Anti-Inspiration</div>${anti}</div>`:''}
  ${section('Visual DNA', row('Background',p3.color_background)+row('Secondary',p3.color_secondary)+row('Accent',p3.color_accent)+row('Additional Palette',p3.colors_extra)+row('Typography',p3.fonts)+row('Upgrade Permission',lead.upgrade_permission?'Yes — full creative latitude':'No — follow specs'))}
  ${section('Logistics', row('Mottos/Taglines',p4.mottos)+row('Copyright',p4.copyright)+row('Starting Point',p4.starting_point)+row('Existing URL',p4.existing_url)+row('Assets',p4.assets_links))}
  ${socials?section('Socials',`<tr><td colspan="2" style="padding:6px 0">${socials}${row('Show Icons',p1.include_socials?'Yes':'No')}</td></tr>`):''}
  ${section('Domain', row('Setup',
    lead.domain_choice==='client_provides'?'Client has domain — connects themselves':
    lead.domain_choice==='client_has_needs_setup'?'Client has domain — Velocity to configure':
    lead.domain_choice==='velocity_provides'?'Velocity to register':
    lead.domain_choice||'—'
  )+row('Domain Name',lead.domain_name))}
  ${p5.additional_notes?section('Additional Notes',`<tr><td colspan="2" style="font-size:13px;color:#e8ddd3;line-height:1.8;padding:6px 0;white-space:pre-wrap">${esc(p5.additional_notes)}</td></tr>`):''}
  ${lead.site_link?`<div style="margin:0 0 32px"><div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#C49C7B;margin-bottom:10px">Finished Site</div><a href="${esc(lead.site_link)}" target="_blank" style="color:#C49C7B;font-size:14px">${esc(lead.site_link)}</a></div>`:''}
</div>
</body></html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
