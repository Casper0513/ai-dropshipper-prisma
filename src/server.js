import express from "express";
// src/server.js
import express from "express";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

import { prisma } from "./db/client.js";
import { CONFIG } from "./config.js";

import { importKeyword } from "./pipeline.js";
import { startAutoSync, autoSyncStatus } from "./workers/autoSyncRunner.js";

import { attachLiveLogs } from "./utils/liveLogs.js";
import { routeFulfillment } from "./services/fulfillmentRouter.js";
import { submitCJOrder } from "./services/cj.js";

// --------------------------------
// App bootstrap
// --------------------------------
const app = express();

// Shopify webhooks MUST use raw body
app.use(
  "/api/webhooks",
  express.raw({ type: "application/json" })
);

// Normal JSON everywhere else
app.use(express.json());
app.use(cors());

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
app.post("/api/webhooks/shopify/orders-paid", async (req, res) => {
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
        shopifyLineItemId: String(r.lineItemId),
        supplier: r.supplier,
        status:
          r.supplier === "cj" && r.fulfillmentMode === "auto"
            ? "ordered"
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
});

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
    if (!keyword) {
      return res.status(400).json({ error: "Missing keyword" });
    }

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
// AUTO-SYNC STATUS (FIXED)
// --------------------------------
app.get("/api/autosync/status", (_, res) => {
  res.json({
    enabled: true,
    running: autoSyncStatus.running,
    lastRunAt: autoSyncStatus.lastRunAt,
    lastSuccessAt: autoSyncStatus.lastSuccessAt,
    lastError: autoSyncStatus.lastError,
    lastResult: autoSyncStatus.lastError ? "error" : "success",
  });
});

// --------------------------------
// START SERVER
// --------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  startAutoSync();
  console.log("✅ Server running on port", PORT);
});
