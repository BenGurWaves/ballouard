# Deployment & Handoff Checklist

1) Replace assets
- Swap `/assets/placeholder-logo.svg` with high-res SVG/PNG. Ensure logo filename matches or update `layout/theme.liquid`.

2) Theme settings
- Upload theme to Shopify (Upload as a theme or copy files into an existing theme via Theme Kit or Shopify CLI).
- Configure `config/settings_schema.json` values (marketplace URLs, logo, colors).

3) Analytics & Pixels
- Add GA4 Measurement ID and Meta Pixel ID to `layout/theme.liquid`.
- Add server-side purchase forwarding (optional) for more reliable events.

4) Email & CRM
- Install Klaviyo app and connect. Configure Klaviyo to ingest Shopify customers and use the `email_signup` snippet.
- Register `orders/create` and `orders/paid` webhooks and point to your CRM endpoint.

5) Post-purchase survey
- Add the contents of `snippets/post_purchase_survey.liquid` to Settings → Checkout → Order status page (Additional scripts). Replace `SURVEY_URL`.

6) Recommended Shopify apps
- Klaviyo (email automation), ReConvert or AfterSell (post-purchase upsell & surveys), Judge.me (reviews), Recharge (subscriptions), Littledata/Elevar (server-side analytics).

7) QA checklist
- Mobile responsiveness across devices
- Product schema JSON-LD present
- Email capture flows tested and appearing in Klaviyo/Shopify
- Checkout thank-you survey appears with order context
- Pixels show Purchase events in test orders

8) Launch steps
- Publish theme; create a test order; verify order webhooks and analytics; then promote to primary domain.
