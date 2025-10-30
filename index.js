import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json({ type: "application/json" })); // Parse JSON

const SHOPIFY_WEBHOOK_SECRET = "1639c322f17870f11c59c12cd78ca47b6b4c16dbebf7e48f5283b778fce19335";

// Verify webhook function
function verifyShopifyWebhook(req) {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const body = JSON.stringify(req.body); // must match the raw body that Shopify sent

  const digest = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(body, "utf8")
    .digest("base64");

  return digest === hmacHeader;
}

// Webhook endpoint
app.post("/webhooks/orders-create", async (req, res) => {
  try {
    const valid = verifyShopifyWebhook(req);
    if (!valid) {
      console.log("❌ Invalid webhook signature");
      return res.status(401).send("Invalid signature");
    }

    // ✅ Respond quickly to Shopify
    res.status(200).send("ok");

    // Access order data
    const order = req.body;
    console.log("✅ Order Created Webhook Received:");
    console.log(JSON.stringify(order, null, 2));

    // Example: you can get order id, total price, customer, etc.
    const orderId = order.id;
    const totalPrice = order.total_price;
    const customerEmail = order.customer?.email;

    console.log(`Order ID: ${orderId}`);
    console.log(`Total: ${totalPrice}`);
    console.log(`Customer: ${customerEmail}`);

    // Here you can call your external API or perform DB updates
  } catch (err) {
    console.error("Error processing webhook:", err);
    res.status(500).send("Error");
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
