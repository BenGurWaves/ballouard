# Velocity — Digital Ateliers for Luxury Maisons

Bespoke website design and engineering for jewellers, watchmakers, tailors, and heritage brands. Built by Calyvent.

**Live:** [velocity.calyvent.com](https://velocity.calyvent.com)

---

## Architecture

Static website + Cloudflare Pages Functions + Supabase PostgreSQL.

```
velocity.calyvent.com
├── website/                    Static assets (served by CF Pages CDN)
│   ├── index.html              Homepage — public
│   ├── _onboard.html           Onboarding SPA shell (token-gated)
│   ├── _dashboard.html         Client dashboard SPA shell (email-gated)
│   ├── admin/index.html        Admin panel (ADMIN_SECRET gated)
│   ├── previews/               Prospect preview sites (15 live)
│   ├── 404.html                Custom error page
│   ├── _headers                Cache + security headers (all asset types)
│   ├── robots.txt              Blocks /admin, /onboard, /dashboard, /api
│   └── sitemap.xml
│
├── functions/                  Cloudflare Pages Functions (edge workers)
│   ├── _lib/
│   │   ├── supabase.js         Supabase REST client (service role)
│   │   ├── security.js         Timing-safe auth, rate limiting, input validation
│   │   └── helpers.js          CORS, JSON helpers
│   ├── onboard/[token].js      Serves onboard SPA (bypasses CF URL normalization)
│   ├── dashboard/[token].js    Serves dashboard SPA
│   ├── preview/[id].js         Serves KV-stored preview HTML
│   ├── admin/
│   │   └── client/[token].js   Full brief view (temp-token auth)
│   └── api/
│       ├── admin/
│       │   └── temp-token.js   Issues 5-min single-use view tokens
│       ├── leads/
│       │   ├── [token].js      GET/PATCH lead by token (public, rate-limited)
│       │   ├── create.js       Create lead (admin)
│       │   ├── list.js         List all leads (admin)
│       │   ├── admin-update.js Update quote/status/comment/site-link (admin)
│       │   ├── delete.js       Delete lead (admin, double-confirmed)
│       │   └── sync-sheet.js   Push lead data to Google Sheets webhook
│       ├── forms/submit.js     Contact form handler for preview sites
│       └── stripe/
│           ├── checkout.js     Create Stripe Checkout Session
│           └── webhook.js      Handle payment confirmation

└── wrangler.toml               CF Pages config (KV binding, public env vars)
```

---

## Onboarding Flow

Six-phase client brief form, accessed via unique UUID link sent by admin:

| Phase | Content |
|-------|---------|
| 0 — Welcome | Email verification (claims the link) |
| 1 — About You | Personal: name, email, phone |
| 2 — Your Business | Business name, type, email, phone, address, description |
| 3 — Strategic Vision | Inspiration, anti-inspiration, target audience |
| 4 — Visual DNA | Colors, typography, upgrade permission |
| 5 — Logistics | Mottos, assets, deadline, T&C agreement |
| 6 — Final Details | Domain choice, additional notes, submit |

---

## Client Dashboard

Token + email-gated portal showing:
- Project status timeline
- Live countdown on 24-hour edit window
- Quote display + Stripe payment
- Admin messages (expire 24h)
- Finished site link when delivered
- Auto-refreshes every 30s (pauses when tab hidden)

---

## Admin Panel

Secret-gated at `/admin`. Features:
- Lead feed sorted by deadline (auto-polls 20s)
- All client data: identity, business info, visual DNA, socials, address, inspiration
- Quote entry (freezes on payment)
- Status management → auto-emails on change
- Message-to-client with optional link (expires 24h on client side)
- Finished site link
- View Full Brief (opens temp-token-authenticated brief page with AI copy block)
- Delete with double confirmation

---

## Security

- **Timing-safe auth** — HMAC-based comparison, no timing leaks
- **Brute-force lockout** — 5 failed admin attempts = 15-minute IP block
- **Temp tokens** — single-use 5-minute tokens for brief viewing (permanent secret never in URL)
- **Rate limiting** on every endpoint (KV-backed, per IP)
- **Input validation** — length caps, URL sanitization on all user fields
- **DB hardening** — anon/authenticated roles fully revoked, service role only
- **Error sanitization** — internal details never reach clients
- **Content Security Policy** on all routes

---

## Environment Variables

Set in Cloudflare Pages → Settings → Environment Variables.

| Variable | Type | Description |
|----------|------|-------------|
| `SUPABASE_URL` | Var | `https://ppihdyxsegcllrsscbnt.supabase.co` |
| `SITE_URL` | Var | `https://velocity.calyvent.com` |
| `SUPABASE_SERVICE_KEY` | Secret | Supabase service role key |
| `ADMIN_SECRET` | Secret | Gates admin panel and all write routes |
| `STRIPE_SECRET_KEY` | Secret | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Secret | Stripe webhook signing secret |
| `RESEND_API_KEY` | Secret | Resend email API key |
| `SHEETS_WEBHOOK_URL` | Secret | Make.com webhook URL for Google Sheets sync |

---

## Database (Supabase — Glyph project)

Table: `velocity_leads`

Key columns: `id`, `token` (UUID, unique), `status`, `full_data` (JSONB), `client_name`, `client_email`, `personal_email`, `personal_phone`, `business_name`, `business_type`, `business_email`, `business_phone`, `business_address`, `quote_amount`, `is_paid`, `is_locked`, `first_submitted_at`, `submitted_at`, `terms_accepted`, `site_link`, `admin_comment`, `domain_choice`, `domain_name`.

RLS: Enabled. All anon/authenticated access revoked. Service role only.

---

## Emails (Resend — from client@calyvent.com)

Auto-sent on status change:
- **Accepted** — quote ready, dashboard link
- **In Progress** — work begun, brief locked
- **Completed** — site live, open link
- **Declined** — graceful, no reason given, door left open
- **Payment confirmed** — Stripe webhook triggers receipt

---

## Previews

15 prospect preview sites in `website/previews/`:
A. Caraceni, Holistic Health NYC, JAR, Kent & Haste, Liondale Medical, Michael Mansshardt, Moneybag Speaks (x2), MYSTMMXX, Orkin, Poehlmann Bresan, Pure Change, Taffin, The Integrative Medical Group, Vedic Astrology Guru, BenGurWaves, Hulsman Timepieces.

---

*Velocity by Calyvent — built fast, ranked forever, looks expensive.*
