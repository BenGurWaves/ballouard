# Analytics, Pixel & CRM integration

1) GA4 (client-side)
- Add your GA4 Measurement ID in `layout/theme.liquid` where indicated. Use gtag.js snippet. For enhanced ecommerce, send purchase events server-side or via GTM.

Example (replace G-XXXX):
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments)}
  gtag('js', new Date());
  gtag('config', 'G-XXXX');
</script>

2) Facebook / Meta Pixel
- Paste the Pixel base code in `layout/theme.liquid`. Fire `Purchase` events on the order status page using Liquid order variables.

3) Klaviyo / Email
- Use Klaviyo Web Tracking snippet or the Klaviyo JS SDK to capture on-site email signups. For immediate integration, post the email capture form to Shopify Contact endpoint, then use Klaviyo's backend sync to import customers.

4) Webhooks → CRM
- Register a webhook in Shopify Admin (Settings → Notifications → Webhooks) for `orders/create` and `orders/paid`.
- Send to your CRM endpoint (example below). Use HMAC verification.

Example Node/Express receiver (verify HMAC):

```js
const express = require('express');
const crypto = require('crypto');
const app = express();
app.use(express.json({type: 'application/json'}));
app.post('/shopify/webhook', (req, res) => {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const hash = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('base64');
  if(hash !== hmac) return res.status(401).send('invalid');
  // process order data: req.body
  res.status(200).send('ok');
});

app.listen(3000);
```

5) Server-side analytics (recommended)
- To avoid adblock blocking, mirror purchase events server-side to GA4 Measurement Protocol and to Klaviyo via API.
