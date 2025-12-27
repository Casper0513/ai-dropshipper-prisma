// src/server.js
import express from "express";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

import { prisma } from "./db/client.js";
import { CONFIG } from "./config.js";
import { importKeyword } from "./pipeline.js";

import { startAutoSync, getAutoSyncStatus } from "./workers/autoSyncRunner.js";
import { attachLiveLogs } from "./utils/liveLogs.js";

import { routeFulfillment } from "./services/fulfillmentRouter.js";
import { createCjOrderFromFulfillmentOrder } from "./services/cjFulfillment.js";

import { startTrackingSyncWorker } from "./workers/trackingSyncWorker.js";
import { startFulfillmentRetryWorker } from "./workers/fulfillmentRetryWorker.js";

// --------------------------------
// App bootstrap
// --------------------------------
const app = express();
app.use(cors());

// IMPORTANT:
// - Webhook route will use express.raw()
// - Everything else uses express.json()
app.use(express.json());

// --------------------------------
// Shopify webhook verification
// --------------------------------
function verifyShopifyWebhook(req, rawBody) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const digest = crypto
    .createHmac("sha256", CONFIG.shopify.webhookSecret)
    .update(rawBody)
    .digest("base64");

  return digest === hmac;
}

// --------------------------------
// SHOPIFY WEBHOOK — ORDERS PAID
// --------------------------------
app.post(
  "/api/webhooks/shopify/orders-paid",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const rawBody = req.body.toString("utf8");

      if (!verifyShopifyWebhook(req, rawBody)) {
        return res.status(401).send("Invalid webhook");
      }

      const order = JSON.parse(rawBody);

      const routes = await routeFulfillment(order);

      for (const r of routes) {
        // Create fulfillment row
        const fo = await prisma.fulfillmentOrder.create({
          data: {
            shopifyOrderId: String(order.id),
            shopifyLineItemId: String(r.lineItemId),
            supplier: r.supplier, // "cj" | "amazon" | "aliexpress" | "manual"
            status:
              r.supplier === "cj" && r.fulfillmentMode === "auto"
                ? "pending"
                : "pending",
            // Optional: if you add these columns later, great:
            // shopifySku: r.variant?.sku ?? null,
            // metaJson: JSON.stringify({ ... })
          },
        });

        // If CJ auto → submit immediately (best-effort)
        if (r.supplier === "cj" && r.fulfillmentMode === "auto") {
          try {
            await createCjOrderFromFulfillmentOrder(fo.id);
          } catch (e) {
            // keep webhook 200; we’ll retry later
            console.error("CJ submit failed:", e.message);
            await prisma.fulfillmentOrder.update({
              where: { id: fo.id },
              data: { status: "failed" },
            });
          }
        }
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("Webhook handler error:", err);
      return res.status(500).send("Webhook error");
    }
  }
);

// --------------------------------
// Live logs (SSE)
// --------------------------------
attachLiveLogs(app);

// --------------------------------
// Paths (ESM safe)
// --------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------
// Dashboard (Vite build)
// --------------------------------
const dashboardDist = path.join(__dirname, "../dashboard/dist");

app.use("/dashboard", express.static(dashboardDist));

app.get("/dashboard", (_, res) => {
  res.sendFile(path.join(dashboardDist, "index.html"));
});

app.get("/", (_, res) => res.redirect("/dashboard"));

// --------------------------------
// API — IMPORT
// --------------------------------
app.post("/api/import", async (req, res) => {
  try {
    const { keyword, mode, markupPercent, source } = req.body;
    if (!keyword) return res.status(400).json({ error: "Missing keyword" });

    const result = await importKeyword(keyword, { mode, markupPercent, source });
    return res.json(result);
  } catch (err) {
    console.error("❌ Import error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// --------------------------------
// API — DASHBOARD DATA
// --------------------------------
app.get("/api/stats", async (_, res) => {
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

app.get("/api/runs", async (_, res) => {
  const runs = await prisma.run.findMany({
    orderBy: { startedAt: "desc" },
    take: 25,
  });
  res.json(runs);
});

app.get("/api/status/sources", (_, res) => {
  res.json({
    sources: [
      { name: "Amazon", status: "ok", lastSync: new Date(), message: "Operational" },
      { name: "AliExpress", status: "ok", lastSync: new Date(), message: "Operational" },
      { name: "Walmart", status: "ok", lastSync: "—", message: "Not active" },
      { name: "CJ Dropshipping", status: "ok", lastSync: new Date(), message: "Connected" },
    ],
  });
});

app.get("/api/profit", async (_, res) => {
  res.set({
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0",
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

// --------------------------------
// AUTO-SYNC STATUS (real)
// --------------------------------
app.get("/api/autosync/status", (_, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });

  res.json({
    enabled: true,
    running: autoSyncStatus.running,
    lastRunAt: autoSyncStatus.lastRunAt,
    nextRunAt: autoSyncStatus.nextRunAt,
    lastResult: autoSyncStatus.lastResult,
  });
});

// --------------------------------
// START SERVER
// --------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  startAutoSync();
  startTrackingSyncWorker();
  startFulfillmentRetryWorker();
  console.log("✅ Server running on port", PORT);
});

