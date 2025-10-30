import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();

const app = express();

// Middlewares
app.use(express.json());
app.use(cookieParser());

// ✅ Root route
app.get("/", (req, res) => {
  res.send("🚀 Node local server is running on port " + "3000");
});

// ✅ Example API route
app.post("/api/discount", async (req, res) => {
  try {
    const { points } = req.body;

    // Example external API call
    const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Discount Created", points }),
    });

    const data = await response.json();
    res.json({ success: true, message: "Discount created successfully", data });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// ✅ Example GET route for testing
app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from local Node server!" });
});

// Start server
app.listen(3000, () => {
  console.log(`✅ Server running on http://localhost:${3000}`);
});
