import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { startAutoSync, getAutoSyncStatus } from "./workers/autoSyncRunner.js";

// API imports
import { importKeyword } from "./pipeline.js";
import { prisma } from "./db/client.js";
import { attachLiveLogs } from "./utils/liveLogs.js";


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ===============================
// SHOPIFY WEBHOOK — ORDERS PAID
// ===============================
import crypto from "crypto";
import { routeFulfillment } from "./services/fulfillmentRouter.js";
import { submitCJOrder } from "./services/cj.js";
import { prisma } from "./db/client.js";

function verifyShopifyWebhook(req, rawBody) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const digest = crypto
    .createHmac("sha256", CONFIG.shopify.webhookSecret)
    .update(rawBody)
    .digest("base64");
  return digest === hmac;
}

app.post(
  "/api/webhooks/shopify/orders-paid",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const rawBody = req.body.toString();

    if (!verifyShopifyWebhook(req, rawBody)) {
      return res.status(401).send("Invalid webhook");
    }

    const order = JSON.parse(rawBody);

    const routes = await routeFulfillment(order);

    for (const r of routes) {
      await prisma.fulfillmentOrder.create({
        data: {
          shopifyOrderId: String(order.id),
          supplier: r.supplier,
          status:
            r.supplier === "cj" && r.fulfillmentMode === "auto"
              ? "submitted"
              : "pending",
        },
      });

      if (r.supplier === "cj" && r.fulfillmentMode === "auto") {
        await submitCJOrder({
          order,
          lineItems: order.line_items,
        });
      }
    }

    res.sendStatus(200);
  }
);

// ✅ Attach SSE live logs endpoint
attachLiveLogs(app);

app.get("/api/logs/live", (req, res) => {
res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (msg) => {
    res.write(`data: ${msg}\n\n`);
  };

  liveLogs.subscribe(send);

  req.on("close", () => {
    liveLogs.unsubscribe(send);
  });
});

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// DASHBOARD (Vite build output)
// ===============================
const dashboardDist = path.join(__dirname, "../dashboard/dist");

app.use("/dashboard", express.static(dashboardDist));

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(dashboardDist, "index.html"));
});

// Root redirect
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// ===============================
// API — IMPORT PRODUCTS
// ===============================
app.post("/api/import", async (req, res) => {
  try {
    const { keyword, mode, markupPercent, source } = req.body;
    if (!keyword) return res.status(400).json({ error: "Missing keyword" });

    const result = await importKeyword(keyword, {
      mode,
      markupPercent,
      source,
    });

    res.json(result);
  } catch (err) {
    console.error("❌ Import error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// API — DASHBOARD DATA
// ===============================
app.get("/api/stats", async (req, res) => {
  const [totalRuns, totalImported] = await Promise.all([
    prisma.run.count(),
    prisma.productLog.count(),
  ]);

  const avgMarkup = await prisma.run.aggregate({
    _avg: { markupPercent: true },
  });

  res.json({
    totalRuns,
    totalImported,
    avgMarkup: avgMarkup._avg.markupPercent || 0,
  });
});

app.get("/api/runs", async (req, res) => {
  const runs = await prisma.run.findMany({
    orderBy: { startedAt: "desc" },
    take: 25,
  });
  res.json(runs);
});

app.get("/api/status/sources", async (req, res) => {
  res.json({
    sources: [
      { name: "Amazon", status: "ok", lastSync: new Date(), message: "Operational" },
      { name: "AliExpress", status: "ok", lastSync: new Date(), message: "Operational" },
      { name: "Walmart", status: "ok", lastSync: new Date(), message: "Operational" },
    ],
  });
});

app.get("/api/profit", async (req, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
  
  const products = await prisma.productLog.findMany({
    where: {
      finalPrice: { not: null },
      sourcePrice: { not: null },
    },
    take: 20,
  });

  const enriched = products.map((p) => {
    const profit = p.finalPrice - p.sourcePrice;
    const margin = p.sourcePrice > 0 ? (profit / p.sourcePrice) * 100 : 0;
    return { ...p, profit, margin };
  });

  res.json({
    totalProfit: enriched.reduce((a, b) => a + b.profit, 0),
    avgMargin: enriched.length
      ? enriched.reduce((a, b) => a + b.margin, 0) / enriched.length
      : 0,
    topProducts: enriched.sort((a, b) => b.profit - a.profit).slice(0, 5),
    priceAlerts: [],
  });
});

app.get("/api/autosync/status", (req, res) => {
  res.json(getAutoSyncStatus);
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  startAutoSync();
  console.log("✅ Server running on port", PORT);
});
