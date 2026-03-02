# Gap Analysis — What's Built vs. What's Needed for Production

## What's Built (This Repo)

- Full 6-agent pipeline with shared database state
- Lead research with Google Places + PageSpeed auditing + email scraping
- Cold email outreach with 3-step cadence + LLM-personalized issues
- Blurred preview generation (screenshot → mockup → blur)
- Sales pipeline with reply classification + Stripe invoicing
- Web design agent that generates multi-page HTML/CSS sites
- Client success agent with WhatsApp/Telegram/email routing
- Pipeline orchestrator connecting all stages
- CLI interface for manual and continuous operation
- Webhook handlers for Stripe, email replies, WhatsApp, Telegram
- SQLite database with full data model
- CAN-SPAM compliant email templates
- Unit tests for models, scoring, and templates

## Gaps to Address Before Production

### 1. Email Deliverability (CRITICAL)

**Problem:** Sending cold emails directly via SendGrid will get you flagged as spam quickly.

**What's needed:**
- [ ] Separate sending domain (never use your primary domain for cold outreach)
- [ ] SPF, DKIM, DMARC DNS records configured on the sending domain
- [ ] Email warmup integration (Instantly, Mailreach, or similar) — 2-4 weeks before sending
- [ ] Email verification service (Hunter, NeverBounce) to validate addresses before sending
- [ ] Sender rotation across 2-3 mailboxes per domain
- [ ] Reduce daily limit from 50 to 35-40 per mailbox
- [ ] Plain-text-only option for initial cold emails (HTML triggers spam filters)
- [ ] Staggered send timing (random delays vs. rapid-fire)
- [ ] Consider using a dedicated cold email platform (Instantly, Smartlead) instead of SendGrid

### 2. Web Application Layer (CRITICAL)

**Problem:** The system needs HTTP endpoints for webhooks, preview hosting, and demo viewing.

**What's needed:**
- [ ] FastAPI or similar web framework for webhook endpoints
- [ ] Preview hosting — serve blurred/full mockup images at URLs
- [ ] Demo hosting — serve full HTML mockups at shareable URLs
- [ ] Stripe webhook endpoint (currently handler exists but no HTTP server)
- [ ] SendGrid Inbound Parse webhook for email replies
- [ ] WhatsApp/Telegram webhook receivers
- [ ] Optional: admin dashboard to monitor pipeline

### 3. Email Reply Detection (HIGH)

**Problem:** The system has reply processing logic but no way to receive inbound emails.

**What's needed:**
- [ ] SendGrid Inbound Parse integration (parses replies and hits your webhook)
- [ ] OR IMAP polling to check a shared inbox for replies
- [ ] Reply-to address configuration (dedicated inbox per sending identity)
- [ ] Thread matching — associate replies with the original lead

### 4. GitHub + Vercel Deployment (MEDIUM)

**Problem:** The Web Design Agent has placeholder implementations for repo creation and deployment.

**What's needed:**
- [ ] GitHub API integration to create repos and push site files
- [ ] Vercel API integration to create projects and deploy
- [ ] Custom domain setup per client (CNAME or Vercel subdomain)
- [ ] CI/CD pipeline for automatic deploys on changes

### 5. Content Quality & QA (MEDIUM)

**Problem:** LLM-generated websites need quality checks before delivery.

**What's needed:**
- [ ] Automated QA: run PageSpeed on the generated site
- [ ] Link checker on generated HTML
- [ ] Mobile viewport testing via Playwright
- [ ] Human review step before delivery (or at minimum, a staging URL for client review)
- [ ] Content review for hallucinated info (wrong phone numbers, addresses)

### 6. Scaling & Reliability (MEDIUM)

**Problem:** SQLite doesn't scale, and there's no retry/failure handling for API calls.

**What's needed:**
- [ ] PostgreSQL for production (SQLite is fine for dev/testing)
- [ ] Redis or similar for job queuing (replace the simple loop with proper task queue)
- [ ] Retry logic with exponential backoff for all API calls (partially there via tenacity dep)
- [ ] Rate limiting awareness for Google APIs, SendGrid, etc.
- [ ] Error alerting (Slack/email notifications on pipeline failures)
- [ ] Proper async task queue (Celery, Dramatiq, or similar)

### 7. Lead Quality Enrichment (LOW-MEDIUM)

**Problem:** Google Places data alone may not have emails or accurate contact info.

**What's needed:**
- [ ] Email enrichment service (Hunter.io, Apollo, Snov.io) when scraping doesn't find email
- [ ] Contact name enrichment (find the business owner's name)
- [ ] Social media presence check (LinkedIn, Facebook page)
- [ ] Yelp API as secondary data source
- [ ] Business license / registration data for contact details

### 8. Legal & Compliance (LOW-MEDIUM)

**Problem:** The system handles CAN-SPAM basics but could be more robust.

**What's needed:**
- [ ] Suppression list management (global unsubscribe list checked before every send)
- [ ] Configurable physical address (currently hardcoded in outreach agent)
- [ ] Rate limiting per recipient (never send more than 3 emails without a reply)
- [ ] CCPA data handling if targeting California businesses
- [ ] robots.txt checking before scraping websites
- [ ] Terms of service for when you start processing client data

### 9. Revenue Operations (LOW)

**Problem:** Basic Stripe integration, but no subscription management or recurring billing.

**What's needed:**
- [ ] Multiple pricing tiers configurable in the admin
- [ ] Hosting/maintenance subscription billing (monthly recurring after initial build)
- [ ] Referral tracking
- [ ] Revenue dashboards and metrics
- [ ] Contract/agreement generation (even simple terms of service acceptance)

### 10. Multi-Channel Outreach (LOW)

**Problem:** Current outreach is email-only. Adding channels would increase reply rates.

**What's needed:**
- [ ] LinkedIn outreach integration (connection requests + InMail)
- [ ] SMS outreach via Twilio (regulations permitting)
- [ ] Social media DM capability
- [ ] Coordinated multi-channel sequences (email → LinkedIn → email)

## Recommended Priority Order

1. **Email deliverability setup** — Without this, nothing works. Get domains, warmup, verification.
2. **Web app + webhook endpoints** — Needed for reply detection, preview hosting, payment callbacks.
3. **Email reply detection** — Critical for the pipeline to work end-to-end.
4. **GitHub/Vercel deployment** — Needed to actually deliver sites.
5. **Content QA** — Needed before you can confidently deliver AI-generated sites.
6. **PostgreSQL + job queue** — Needed once volume exceeds a few dozen leads/day.
7. **Everything else** — Iterate based on what bottlenecks appear first.
