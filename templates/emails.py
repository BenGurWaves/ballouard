"""
Cold email templates — built on best practices:

1. CAN-SPAM compliant (physical address, unsubscribe, honest subject lines)
2. Short (under 150 words), conversational, no corporate fluff
3. Personalized with business name and specific website issues
4. Value-first: lead with what you've already done for them
5. Low-friction CTA (reply vs. book a call)
6. 3-email cadence: initial → follow-up (3 days) → breakup (7 days)
"""

from __future__ import annotations

# ──────────────────────────────────────────────
# EMAIL 1: The "I Already Redesigned Your Site" opener
# ──────────────────────────────────────────────

INITIAL_SUBJECT_LINES = [
    "Quick question about {business_name}'s website",
    "I redesigned {business_name}'s website (just for fun)",
    "{first_name}, noticed something about your website",
    "Saw {business_name}'s site and had an idea",
]

INITIAL_EMAIL_PLAIN = """Hi {first_name},

I came across {business_name} while looking for {business_type}s in {city} and noticed your website could be working a lot harder for you.

So I went ahead and mocked up a redesigned version — just to show you what's possible. Here's a quick preview:

{preview_link}

(It's blurred for now — just to give you the vibe.)

A few things I spotted on your current site:
{issues_list}

No pressure at all — I just enjoy doing this. If you're curious to see the full design, just reply "send it" and I'll share the complete mockup.

{sender_name}
{agency_name}

{unsubscribe_line}
"""

INITIAL_EMAIL_HTML = """
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; color: #1a1a1a; line-height: 1.6;">
  <p>Hi {first_name},</p>

  <p>I came across <strong>{business_name}</strong> while looking for {business_type}s in {city} and noticed your website could be working a lot harder for you.</p>

  <p>So I went ahead and mocked up a redesigned version — just to show you what's possible. Here's a quick preview:</p>

  <p><a href="{preview_link}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">See the Preview →</a></p>

  <p style="color: #666; font-size: 13px;">(It's blurred for now — just to give you the vibe.)</p>

  <p>A few things I spotted on your current site:</p>
  {issues_html}

  <p>No pressure at all — I just enjoy doing this. If you're curious to see the full design, just reply <strong>"send it"</strong> and I'll share the complete mockup.</p>

  <p>{sender_name}<br><span style="color: #666;">{agency_name}</span></p>

  <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
  <p style="font-size: 11px; color: #999;">{unsubscribe_line}</p>
</div>
"""

# ──────────────────────────────────────────────
# EMAIL 2: Follow-up (3 days after Email 1)
# ──────────────────────────────────────────────

FOLLOWUP_SUBJECT_LINES = [
    "Re: {business_name}'s website redesign",
    "The mockup I made for {business_name}",
]

FOLLOWUP_EMAIL_PLAIN = """Hi {first_name},

Just bumping this up — I put together a free redesign preview for {business_name}'s website and wanted to make sure you saw it.

{preview_link}

Your current site is leaving money on the table, especially on mobile. Happy to walk you through what I'd change and why — no strings attached.

Just reply "interested" and I'll send over the full design.

{sender_name}

{unsubscribe_line}
"""

FOLLOWUP_EMAIL_HTML = """
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; color: #1a1a1a; line-height: 1.6;">
  <p>Hi {first_name},</p>

  <p>Just bumping this up — I put together a free redesign preview for <strong>{business_name}</strong>'s website and wanted to make sure you saw it.</p>

  <p><a href="{preview_link}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">See the Preview →</a></p>

  <p>Your current site is leaving money on the table, especially on mobile. Happy to walk you through what I'd change and why — no strings attached.</p>

  <p>Just reply <strong>"interested"</strong> and I'll send over the full design.</p>

  <p>{sender_name}</p>

  <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
  <p style="font-size: 11px; color: #999;">{unsubscribe_line}</p>
</div>
"""

# ──────────────────────────────────────────────
# EMAIL 3: Breakup (7 days after Email 2)
# ──────────────────────────────────────────────

BREAKUP_SUBJECT_LINES = [
    "Should I close your file, {first_name}?",
    "Last one from me about {business_name}'s site",
]

BREAKUP_EMAIL_PLAIN = """Hi {first_name},

I'll keep this short — I made a redesigned version of {business_name}'s website a while back, but I haven't heard from you.

Totally understand if the timing isn't right. I'll close out your file on my end, but the offer stands if you ever want to see it.

Just reply anytime and I'll send it over.

All the best,
{sender_name}

{unsubscribe_line}
"""

BREAKUP_EMAIL_HTML = """
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; color: #1a1a1a; line-height: 1.6;">
  <p>Hi {first_name},</p>

  <p>I'll keep this short — I made a redesigned version of <strong>{business_name}</strong>'s website a while back, but I haven't heard from you.</p>

  <p>Totally understand if the timing isn't right. I'll close out your file on my end, but the offer stands if you ever want to see it.</p>

  <p>Just reply anytime and I'll send it over.</p>

  <p>All the best,<br>{sender_name}</p>

  <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
  <p style="font-size: 11px; color: #999;">{unsubscribe_line}</p>
</div>
"""

# ──────────────────────────────────────────────
# EMAIL 4: Full demo reveal (sent when lead replies positively)
# ──────────────────────────────────────────────

DEMO_SUBJECT_LINES = [
    "Here's your full website redesign, {first_name}",
    "{business_name}'s new website — full preview inside",
]

DEMO_EMAIL_PLAIN = """Hi {first_name},

Awesome — here's the full redesign I put together for {business_name}:

{demo_link}

A few highlights:
{highlights_list}

If you like what you see and want to make this your actual website, I can have it live within a week.

Here's what the package includes:
- Fully custom, mobile-first design
- Fast hosting with SSL included
- SEO basics set up out of the box
- Google Business profile optimization
- 30 days of free support after launch

Want to move forward? I can send over a simple invoice — just reply and let me know.

{sender_name}
{agency_name}

{unsubscribe_line}
"""

DEMO_EMAIL_HTML = """
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; color: #1a1a1a; line-height: 1.6;">
  <p>Hi {first_name},</p>

  <p>Awesome — here's the full redesign I put together for <strong>{business_name}</strong>:</p>

  <p><a href="{demo_link}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">View Your New Website →</a></p>

  <p>A few highlights:</p>
  {highlights_html}

  <p>If you like what you see and want to make this your actual website, I can have it <strong>live within a week</strong>.</p>

  <p>Here's what the package includes:</p>
  <ul>
    <li>Fully custom, mobile-first design</li>
    <li>Fast hosting with SSL included</li>
    <li>SEO basics set up out of the box</li>
    <li>Google Business profile optimization</li>
    <li>30 days of free support after launch</li>
  </ul>

  <p>Want to move forward? I can send over a simple invoice — just reply and let me know.</p>

  <p>{sender_name}<br><span style="color: #666;">{agency_name}</span></p>

  <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;">
  <p style="font-size: 11px; color: #999;">{unsubscribe_line}</p>
</div>
"""

# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

CAN_SPAM_FOOTER = (
    "You're receiving this because I found your business online. "
    "Reply STOP to unsubscribe. "
    "{agency_name} · {agency_address}"
)


def format_issues_list(issues: list[str]) -> str:
    """Format issues as a plain-text bulleted list."""
    return "\n".join(f"  • {issue}" for issue in issues)


def format_issues_html(issues: list[str]) -> str:
    """Format issues as an HTML list."""
    items = "".join(f"<li>{issue}</li>" for issue in issues)
    return f'<ul style="color: #444;">{items}</ul>'
