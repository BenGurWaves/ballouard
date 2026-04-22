# CLAUDE.md - Velocity by Calyvent
# READ THIS BEFORE TOUCHING ANYTHING.

## What This Project Is
Static HTML + Cloudflare Pages Functions for a luxury web design agency.
Live: https://velocity.calyvent.com

Stack: static HTML/CSS/JS (NO framework, NO React, NO Next.js, NO Python, NO npm build)
Backend: Cloudflare Pages Functions (JS edge workers)
Database: Supabase PostgreSQL via REST API
Email: Resend | Payments: Stripe | Deploy: Cloudflare Pages

## NEVER TOUCH (live revenue infrastructure):
- website/_onboard.html + public/ + dist/ copies
- website/_dashboard.html + public/ + dist/ copies
- website/admin/index.html + dist/admin/ copy
- functions/ (entire directory)
- wrangler.toml

## REQUIRE EXPLICIT CONFIRMATION:
- website/styles.css
- website/public/index.html and dist/index.html
- website/public/terms.html and privacy.html
- functions/_lib/security.js and supabase.js

## MANDATORY SYNC after any change to _onboard, _dashboard, admin:
  cp website/_onboard.html website/public/_onboard.html
  cp website/_onboard.html website/dist/_onboard.html
  cp website/_dashboard.html website/public/_dashboard.html
  cp website/_dashboard.html website/dist/_dashboard.html
  cp website/admin/index.html website/dist/admin/index.html

## Rules for ALL AI Tools:
1. Rate limiting = Cloudflare WAF. Do NOT use KV-based rate limiting.
2. rateLimit() in security.js is a no-op stub. Never call it with undefined variables.
3. helpers.js in _lib/ is legacy dead code. Do not import from it.
4. All new functions import ONLY from security.js and supabase.js.
5. All HTML files need: <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=3">
6. Brand name: Velocity. by Calyvent
7. Admin contact: atelier@calyvent.com | Transactional: client@calyvent.com

## Environment Variables (Cloudflare Secrets):
SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_SECRET,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY,
SHEETS_WEBHOOK_URL, SITE_URL