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
  // const customerPhone = order.customer?.phone || order.billing_address?.phone || "";
const customerPhone = 917487850484;
  let redeemedPoints = 0;

if (order.note_attributes && order.note_attributes.length > 0) {
  const pointsAttr = order.note_attributes.find(
    (attr) => attr.name?.toLowerCase() === "_redeemed_points"
  );
  if (pointsAttr && pointsAttr.value) {
    redeemedPoints = Number(pointsAttr.value) || 0;
  }
}

console.log(`🏆 Redeemed Points Found: ${redeemedPoints}`);


  const lineItems = order.line_items || [];

  console.log(`Order ID: ${orderId}`);
  console.log(`Email: ${email}`);
  console.log(`Phone: ${customerPhone}`);
  console.log(`RedeemedPoints: ${redeemedPoints}`);

  // Prepare payload for Loyalytics API
  const payload = {
    mobile: String(customerPhone),
    transactionId: String(orderId),
    storeID: "swanloyalytics",
    points: redeemedPoints, // adjust dynamically if needed
      "lineItems": [
            {
                "stockNo": "9111111",
                "description": "PURE SPA WATER LIQUID CLEANSING CREAM",
                "markdownFlag": "N",
                "quantity": 1,
                "rate": 30,
                "value": 30,
                "discount": 10,
                "amount": 28.57,
                "grossAmount": 30,
                "billNumber": "{{billNum}}"
            },
            {
                "stockNo": "9000001",
                "description": "PURE SPA WATER BUBBLE CLEANSING FOAM",
                "markdownFlag": "N",
                "quantity": 1,
                "rate": 70,
                "value": 70,
                "discount": 10,
                "amount": 68.1,
                "grossAmount": 70,
                "billNumber": "{{billNum}}"
            }
        ]
    
  };

  console.log("📦 Payload to Loyalytics:", JSON.stringify(payload, null, 2));
if(redeemedPoints > 0){
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
}else{
console.log("No redeem points");
}
});

app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});
