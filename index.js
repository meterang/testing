import express from "express";
import crypto from "crypto";

const app = express();
const SHOPIFY_WEBHOOK_SECRET = "1639c322f17870f11c59c12cd78ca47b6b4c16dbebf7e48f5283b778fce19335";

// Middleware to capture raw body for HMAC verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString(); // store raw body as string
    },
  })
);

// Verify webhook function
function verifyShopifyWebhook(req) {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const digest = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody, "utf8")
    .digest("base64");
  return digest === hmacHeader;
}

// Webhook route
app.post("/webhooks/orders-create", async (req, res) => {
  const verified = verifyShopifyWebhook(req);
  if (!verified) {
    console.log("❌ Invalid webhook signature");
    return res.status(401).send("Invalid signature");
  }

  // Acknowledge receipt immediately
  res.status(200).send("ok");

  // Process the order
  const order = req.body;
  console.log("✅ Order Create Webhook Received:");
  console.log(JSON.stringify(order, null, 2));

  // Example: access order info
  const orderId = order.id;
  const totalPrice = order.total_price;
  console.log(`Order ID: ${orderId}, Total: ${totalPrice}`);
});

app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
