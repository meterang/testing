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
  const data = req.body;
  console.log("data", data);
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
