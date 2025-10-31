import express from "express";
import crypto from "crypto";
import fetch from "node-fetch"; // make sure to install: npm install node-fetch
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const SHOPIFY_WEBHOOK_SECRET =
  "1639c322f17870f11c59c12cd78ca47b6b4c16dbebf7e48f5283b778fce19335";

app.use(cookieParser());
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

const {
  SHOPIFY_API_KEY,
  SHOPIFY_API_SECRET,
  SCOPES,
  HOST,
  PORT = 3000,
} = process.env;

// Verify webhook function
function verifyShopifyWebhook(req) {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const digest = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(req.rawBody, "utf8")
    .digest("base64");
  return digest === hmacHeader;
}
let accessToken = null;
let activeShop = null;

app.get("/auth", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop parameter");
 
  const state = crypto.randomBytes(8).toString("hex");
 
  const isProduction = process.env.NODE_ENV === "production";
 
  res.cookie("state", state, {
    httpOnly: true,
    secure: isProduction, // only true in production
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
 
  console.log("Generated state:", state);
 
  const redirectUri = `${HOST}/auth/callback`;
  const installUrl =
    `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}` +
    `&scope=${SCOPES}` +
    `&state=${state}` +
    `&redirect_uri=${redirectUri}`;
 
  console.log("Redirecting to:", installUrl);
  res.redirect(installUrl);
});
 
// Step 2: OAuth callback
app.get("/auth/callback", async (req, res) => {
  const { shop, hmac, code, state } = req.query;
  const stateCookie = req.cookies.state;
 
  console.log("State from cookie:", stateCookie);
  console.log("State from query:", state);
 
  if (state !== stateCookie)
    return res.status(403).send("State mismatch — possible CSRF attack.");
 
  // Verify HMAC
  const params = { ...req.query };
  delete params.signature;
  delete params.hmac;
 
  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
 
  const generatedHmac = crypto
    .createHmac("sha256", SHOPIFY_API_SECRET)
    .update(message)
    .digest("hex");
 
  if (generatedHmac !== hmac) {
    console.error("HMAC check failed!");
    return res.status(400).send("HMAC validation failed.");
  }
 
  // Exchange temporary code for a permanent access token
  try {
    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: SHOPIFY_API_KEY,
          client_secret: SHOPIFY_API_SECRET,
          code,
        }),
      }
    );
 
    const tokenData = await tokenResponse.json();
 
    if (!tokenData.access_token) {
      console.error("Token fetch failed:", tokenData);
      return res.status(400).json({ error: "Failed to get access token" });
    }
 
    console.log("✅ Access Token:", tokenData.access_token);
    accessToken = tokenData.access_token;
    res.send("✅ App installed successfully! Token generated in console.");
  } catch (err) {
    console.error("Error getting token:", err);
    res.status(500).send("Server error while fetching token.");
  }
});
 
app.listen(3000, () =>
  console.log("🚀 Shopify OAuth app running on http://localhost:3000")
);
// const SHOP = "swanloyalytics.myshopify.com";
const ADMIN_TOKEN = accessToken;
app.post("/webhooks/discounts/create", async (req, res) => {
  const { discountCode, discountValue } = req.body;

  try {
    // Get all price rules
    const rulesResp = await axios.get(
      `https://${SHOP}/admin/api/2024-10/price_rules.json`,
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    // Search for existing discount code
    for (const rule of rulesResp.data.price_rules) {
      const codesResp = await axios.get(
        `https://${SHOP}/admin/api/2024-10/price_rules/${rule.id}/discount_codes.json`,
        {
          headers: {
            "X-Shopify-Access-Token": ADMIN_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      const found = codesResp.data.discount_codes.find(
        (c) => c.code.toUpperCase() === discountCode.toUpperCase()
      );
      if (found) {
        console.log("✅ Discount already exists:", found.code);
        return res.json({
          success: true,
          message: "Discount already exists",
          discount_code: found.code,
        });
      }
    }

    // Create a new price rule
    const priceRuleResp = await axios.post(
      `https://${SHOP}/admin/api/2024-10/price_rules.json`,
      {
        price_rule: {
          title: `Loyalty ${discountValue} Off`,
          target_type: "line_item",
          target_selection: "all",
          allocation_method: "across",
          value_type: "fixed_amount",
          value: `-${discountValue}`,
          customer_selection: "all",
          starts_at: new Date().toISOString(),
        },
      },
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const priceRuleId = priceRuleResp.data.price_rule.id;

    // Create discount code
    const discountResp = await axios.post(
      `https://${SHOP}/admin/api/2024-10/price_rules/${priceRuleId}/discount_codes.json`,
      { discount_code: { code: discountCode } },
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    return res.json({
      success: true,
      message: "Discount created successfully",
      discount_code: discountResp.data.discount_code.code,
    });
  } catch (error) {
    console.error("❌ Discount creation error:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create discount",
      error: error.response?.data || error.message,
    });
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
