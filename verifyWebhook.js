// verifyWebhook.js
import crypto from "crypto";

export function verifyShopifyWebhook(req, shopifyWebhookSecret) {
  // Shopify sends HMAC in 'x-shopify-hmac-sha256'
  const hmacHeader = req.get("x-shopify-hmac-sha256") || "";
  const rawBody = req.rawBody; // we will attach rawBody in server.js middleware

  const generatedHash = crypto
    .createHmac("sha256", shopifyWebhookSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmacHeader));
}
