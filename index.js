// server.js
import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { verifyShopifyWebhook } from "./verifyWebhook.js";

dotenv.config();

const {
  PORT = 3000,
  HOST,
  SHOPIFY_SHOP,
  SHOPIFY_ADMIN_API_ACCESS_TOKEN,
  SHOPIFY_WEBHOOK_SECRET
} = process.env;

const app = express();

// We need raw body for HMAC verification. Capture raw body and JSON parse separately.
app.use((req, res, next) => {
  let data = "";
  req.setEncoding("utf8");
  req.rawBody = "";
  req.on("data", (chunk) => {
    req.rawBody += chunk;
  });
  req.on("end", () => {
    try {
      // If content-type is json, parse and attach body
      if (req.headers["content-type"] && req.headers["content-type"].includes("application/json")) {
        try {
          req.body = JSON.parse(req.rawBody || "{}");
        } catch (e) {
          req.body = {};
        }
      }
    } catch (err) {
      req.body = {};
    }
    next();
  });
});

// ---------- Webhook route ----------
app.post("/webhooks/orders-create", async (req, res) => {
  try {
  	console.log("test order");
    // 1) Verify HMAC
    const valid = verifyShopifyWebhook(req, SHOPIFY_WEBHOOK_SECRET);
    if (!valid) {
      console.warn("Invalid webhook HMAC");
      return res.status(401).send("Invalid webhook signature");
    }

    // 2) Quick 200 so Shopify doesn't resend while we process (still process afterwards)
    res.status(200).send("ok");

    // 3) Process order (in background)
    const order = req.body;
    console.log("Incoming order webhook id:", order.id, "name:", order.name);

    // Decide how to obtain mobile number
    // preference: order.customer.phone -> order.billing_address.phone -> order.shipping_address.phone -> fallback
    const mobile =
      (order.customer && (order.customer.phone || order.customer.default_address?.phone)) ||
      (order.billing_address && order.billing_address.phone) ||
      (order.shipping_address && order.shipping_address.phone) ||
      null;

    // Prepare params for OTP API
    const payload = {
    "mobile": "917487850484",
    "transactionId": "6598745",
    "storeID": "TEST",
    "points": 100,
    "billLineItems": {
        "lineItems": [
            {
                "stockNo": "9111111",
                "description": "PURE SPA WATER LIQUID CLEANSING CREAM",
                "markdownFlag": "N",
                "quantity": 1,
                "rate": 30,
                "value": 30,
                "discount": 0,
                "amount": 28.57,
                "grossAmount": 30,
                "billNumber": "6598745"
            },
            {
                "stockNo": "9000001",
                "description": "PURE SPA WATER BUBBLE CLEANSING FOAM",
                "markdownFlag": "N",
                "quantity": 1,
                "rate": 70,
                "value": 70,
                "discount": 0,
                "amount": 68.1,
                "grossAmount": 70,
                "billNumber": "6598745"
            }
        ]
    }
};

    // 4) Call Generate OTP API
    const otpResponse = await fetch('https://api.loyalytics.ai/swan/dev/swan-test/redeem-points', {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnQiOiJzd2FuLXRlc3QiLCJwdXJwb3NlIjoiYXBpLWF1dGgiLCJjb3VudHJ5IjoiIiwiaWF0IjoxNzYxODA5MDI5LCJleHAiOjE3NjE4OTU0Mjl9.IZw2J2TUCc1BlLh_Zl-YPxWa4EtUpxrgG3d6MgKU8XU'
      },
      body: JSON.stringify(payload)
    });

    const text = await otpResponse.text(); // API might not return JSON
    // Log or persist response as needed
    console.log("Generate OTP API response status:", otpResponse.status, "body:", text);
  } catch (err) {
    console.error("Error handling webhook:", err);
    // Do NOT change response status if already sent. If verification failed earlier, responded 401.
  }
});

// ---------- Optional: endpoint to register webhook (call manually or during install) ----------
// app.post("/register-order-webhook", express.json(), async (req, res) => {
//   // This endpoint calls Shopify Admin API to register the webhook for this shop.
//   // It requires SHOPIFY_ADMIN_API_ACCESS_TOKEN and SHOPIFY_SHOP in .env
//   if (!SHOPIFY_ADMIN_API_ACCESS_TOKEN || !SHOPIFY_SHOP) {
//     return res.status(400).json({ error: "Missing shop or admin token in .env" });
//   }

//   const webhookUrl = `${HOST}/webhooks/orders-create`;

//   const createResponse = await fetch(`https://${SHOPIFY_SHOP}/admin/api/2024-10/webhooks.json`, {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       "X-Shopify-Access-Token": SHOPIFY_ADMIN_API_ACCESS_TOKEN
//     },
//     body: JSON.stringify({
//       webhook: {
//         topic: "orders/create",
//         address: webhookUrl,
//         format: "json"
//       }
//     })
//   });

//   const body = await createResponse.json();
//   res.status(createResponse.status).json(body);
// });

app.get("/", (req, res) => res.send("Shopify OTP webhook server running"));

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Public webhook endpoint (expected): ${HOST}/webhooks/orders-create`);
});
