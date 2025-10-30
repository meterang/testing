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
app.get("/auth/callback", async (req, res) => {
  const { shop, hmac, code, state } = req.query;
  const stateCookie = req.cookies.state;

  if (state !== stateCookie) return res.status(403).send("State mismatch");

  // Verify HMAC
  const params = { ...req.query };
  delete params.hmac;
  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join("&");
  const generatedHmac = crypto
    .createHmac("sha256", "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")
    .update(message)
    .digest("hex");

  if (generatedHmac !== hmac) return res.status(400).send("HMAC validation failed");

  // Exchange code for access token
  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: b775c7726e4b417239a13da36151620d,
      client_secret: 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,
      code
    })
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    return res.status(400).json({ error: "Failed to get access token" });
  }

  accessToken = tokenData.access_token;
  console.log("✅ Admin Token:", accessToken);

  res.send("✅ App installed and token generated successfully!");
});

app.post("/apps/loyalty/api/createDiscount", async (req, res) => {
  try {
    const { points } = req.body;
    if (!accessToken) throw new Error("Access token not available");
    if (!points) throw new Error("Points missing");

    const discountCode = `LOYALTY-${points}`;
    const discountValue = points;

    const response = await fetch(`https://${req.query.shop}/admin/api/2024-07/price_rules.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        price_rule: {
          title: discountCode,
          target_type: "line_item",
          target_selection: "all",
          allocation_method: "across",
          value_type: "fixed_amount",
          value: `-${discountValue}`,
          customer_selection: "all",
          starts_at: new Date().toISOString()
        }
      })
    });

    const data = await response.json();
    const ruleId = data.price_rule?.id;
    if (!ruleId) throw new Error("Failed to create price rule");

    // Create discount code for rule
    const codeRes = await fetch(`https://${req.query.shop}/admin/api/2024-07/price_rules/${ruleId}/discount_codes.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ discount_code: { code: discountCode } })
    });

    const codeData = await codeRes.json();
    if (!codeData.discount_code?.code) throw new Error("Failed to create discount code");

    res.json({ success: true, discount_code: discountCode });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});
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
  // console.log(JSON.stringify(order, null, 2));

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

  // console.log("📦 Payload to Loyalytics:", JSON.stringify(payload, null, 2));
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
