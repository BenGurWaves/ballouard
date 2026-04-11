# Indosedap — Design & Theme Specification

Purpose: Build a clean, conversion-focused Shopify storefront that elevates Indosedap's Food & Beverages range, uses existing logo/colors, and captures first-party customer data.

1) Palette
- Primary: --brand-ink: #2b1e16 (deep espresso)
- Secondary: --brand-warm: #7a4b2a (roasted brown)
- Accent: --accent: #c99a68 (creamy highlight)
- Background: --bg: #fffdfa (warm off-white)

Use brand colors for CTAs, price highlights, and micro-interactions. Use whitespace liberally.

2) Typography
- Heading: a refined serif for product titles and hero (e.g., "Playfair Display" or "Merriweather").
- UI / Body: a neutral sans (e.g., "Inter" or "system-ui").
- Scale: H1 ~28–36px (desktop), H2 ~20–24px, body 16px mobile.

3) Components
- Hero (asymmetric): large image, generous left/right whitespace, product callout on right column.
- Product Card: single image, concise title, price, one primary CTA, small secondary link to marketplaces.
- Email Signup: prominent in-hero and footer; offer 10% off incentive. Hook to Klaviyo/Shopify Email.
- Post-Purchase Survey: short 1–3 question modal on the order status page.
- Modal: brand-colored, auto-close after 5s for previews; full accessible markup.

4) Conversion & Performance
- Critical CSS inlined for hero and product CTA.
- Images: serve WebP, use Shopify `img_url` filters with size hints.
- Minimize external JS; defer non-critical scripts.

5) Data & CRM
- Capture email on product pages and via checkout (Shopify native). Send to Klaviyo via gtag or Klaviyo JS/API.
- Send `order/create` webhook to CRM endpoint; include customer email, order ID, items, totals.

6) SEO & Analytics
- Titles & meta per product Liquid tags. Include structured data (JSON-LD) for products.
- Add GA4 and Facebook/Meta pixel snippets (placeholders in `layout/theme.liquid`).

7) Accessibility
- Ensure keyboard focus states, skip link, alt text on images, and accessible modal labeling.

8) Mobile-first Notes
- Single-column stacking up to 900px, streamlined CTAs, large tap targets (44px minimum).
