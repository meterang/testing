import express from "express";
import crypto from "crypto";
import fetch from "node-fetch"; // make sure to install: npm install node-fetch

const app = express();
const SHOPIFY_WEBHOOK_SECRET =
  "1639c322f17870f11c59c12cd78ca47b6b4c16dbebf7e48f5283b778fce19335";

// Middleware to capture raw body for HMAC verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
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

  // Acknowledge immediately
  res.status(200).send("ok");

  const order = req.body;
  console.log("✅ Order Create Webhook Received:");
  console.log(JSON.stringify(order, null, 2));

  // Extract required fields
  const orderId = order.id;
  const email = order.email;
  const customerPhone = order.customer?.phone || order.billing_address?.phone || "";
customerPhone = customerPhone.replace(/\D/g, ""); // removes all non-numeric characters

  const lineItems = order.line_items || [];

  console.log(`Order ID: ${orderId}`);
  console.log(`Email: ${email}`);
  console.log(`Phone: ${customerPhone}`);

  // Prepare payload for Loyalytics API
  const payload = {
    mobile: customerPhone,
    transactionId: String(orderId),
    storeID: "TEST",
    points: 100, // adjust dynamically if needed
    billLineItems: {
      lineItems: lineItems.map((item) => ({
        stockNo: item.sku || "N/A",
        description: item.title,
        markdownFlag: "N",
        quantity: item.quantity,
        rate: item.price,
        value: item.price * item.quantity,
        discount: item.total_discount,
        amount: item.price * item.quantity,
        grossAmount: item.price * item.quantity,
        billNumber: String(orderId),
      })),
    },
  };

  console.log("📦 Payload to Loyalytics:", JSON.stringify(payload, null, 2));

  // Send to Loyalytics
  try {
    const response = await fetch(
      "https://api.loyalytics.ai/swan/dev/swan-test/redeem-points",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnQiOiJzd2FuLXRlc3QiLCJwdXJwb3NlIjoiYXBpLWF1dGgiLCJjb3VudHJ5IjoiIiwiaWF0IjoxNzYxODA5MDI5LCJleHAiOjE3NjE4OTU0Mjl9.IZw2J2TUCc1BlLh_Zl-YPxWa4EtUpxrgG3d6MgKU8XU",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.text();
    console.log("🎯 Loyalytics API Response:", result);
  } catch (error) {
    console.error("❌ Error calling Loyalytics API:", error);
  }
});

app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
