Indosedap — Shopify theme starter

Quick notes
- Replace `assets/placeholder-logo.svg` with your high-res logo (same filename).
- Add GA4 & Facebook Pixel IDs in `layout/theme.liquid` where indicated.
- Replace sample products in `templates/product.liquid` with real product Liquid loops when integrating into Shopify.

Files
- `layout/theme.liquid` — base layout + analytics snippets
- `templates/product.liquid` — sales-ready product page example
- `snippets/email_signup.liquid` — email capture form (Klaviyo/Shopify-ready)
- `snippets/modal.liquid` — modal + `openModal()` implementation
- `assets/styles.css` — mobile-first CSS and coffee palette variables
- `assets/placeholder-logo.svg` — placeholder logo (replace)
- `config/settings_schema.json` — theme settings (logo, colors)

Extras included:
- `DESIGN_SPEC.md` — design guidance and component rules
- `DEPLOYMENT.md` — deployment & handoff checklist
- `docs/analytics_and_crm.md` — analytics, pixel, and webhook examples
- `snippets/post_purchase_survey.liquid` — order-status survey snippet
- `snippets/marketplace_badges.liquid` — reusable marketplace links

Install
1. Upload this folder as a theme to Shopify (or copy files into an existing theme).
2. Replace placeholders (logo, GA/Pixel IDs, product data).
3. Enable forms/app integrations per README notes.
