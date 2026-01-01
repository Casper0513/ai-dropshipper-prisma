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
import {
  listFulfillmentOrders,
  getFulfillmentOrder,
} from "./services/fulfillmentApi.js";

import { startTrackingSyncWorker } from "./workers/trackingSyncWorker.js";
import { startFulfillmentRetryWorker } from "./workers/fulfillmentRetryWorker.js";

// --------------------------------
// App bootstrap
// --------------------------------
const app = express();
app.use(cors());

// --------------------------------
// IMPORTANT BODY PARSING RULES
// --------------------------------
// ❗ Shopify webhooks MUST use raw body
// ❗ Everything else uses JSON
app.use("/api/webhooks", express.raw({ type: "application/json" }));
app.use(express.json());

// --------------------------------
// Shopify webhook verification
// --------------------------------
function verifyShopifyWebhook(req, rawBody) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  if (!hmac) return false;

  const digest = crypto
    .createHmac("sha256", CONFIG.shopify.webhookSecret)
    .update(rawBody)
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(hmac)
  );
}

// --------------------------------
// SHOPIFY WEBHOOK — ORDERS PAID
// --------------------------------
app.post("/api/webhooks/shopify/orders-paid", async (req, res) => {
  try {
    const rawBody = req.body.toString("utf8");

    if (!verifyShopifyWebhook(req, rawBody)) {
      return res.status(401).send("Invalid webhook");
    }

    const order = JSON.parse(rawBody);
    const routes = await routeFulfillment(order);

    for (const r of routes) {
      const lineItem = order.line_items?.find(
        (i) => String(i.id) === r.lineItemId
      );

      // 💰 SALE PRICE (immutable, accounting-safe)
      const salePrice = lineItem
        ? Number(lineItem.price) * Number(lineItem.quantity || 1)
        : null;

      const fo = await prisma.fulfillmentOrder.create({
        data: {
          shopifyOrderId: String(order.id),
          shopifyLineItemId: String(r.lineItemId),
          supplier: r.supplier,
          status: "pending",

          // ✅ PROFIT INPUT
          salePrice,

          metaJson: JSON.stringify({
            sku: r.variant?.sku || null,
            quantity: lineItem?.quantity || 1,
            recipient: order.shipping_address || null,
          }),
        },
      });

      // CJ auto-submit (best-effort)
      if (r.supplier === "cj" && r.fulfillmentMode === "auto") {
        try {
          await createCjOrderFromFulfillmentOrder(fo.id);
        } catch (err) {
          console.error("CJ submit failed:", err.message);
          // retry worker will handle it
        }
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).send("Webhook error");
  }
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

// --------------------------------
// API — PROFIT (REAL, AT FULFILLMENT)
// --------------------------------
app.get("/api/profit", async (_, res) => {
  res.set({
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    Expires: "0",
  });

  const rows = await prisma.fulfillmentOrder.findMany({
    where: {
      profit: { not: null },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const totalProfit = rows.reduce(
    (sum, r) => sum + (r.profit || 0),
    0
  );

  const avgMargin =
    rows.length > 0
      ? rows.reduce(
          (sum, r) =>
            sum + ((r.profit || 0) / (r.salePrice || 1)) * 100,
          0
        ) / rows.length
      : 0;

  res.json({
    totalProfit,
    avgMargin,
    topProducts: rows.slice(0, 5),
    priceAlerts: [],
  });
});

// --------------------------------
// API — SOURCE STATUS (Dashboard)
// --------------------------------
app.get("/api/status/sources", async (_, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });

  res.json({
    sources: [
      {
        name: "Amazon",
        status: "ok",
        lastSync: new Date(),
        message: "Operational",
      },
      {
        name: "AliExpress",
        status: "ok",
        lastSync: new Date(),
        message: "Operational",
      },
      {
        name: "Walmart",
        status: "ok",
        lastSync: null,
        message: "Not active",
      },
      {
        name: "CJ Dropshipping",
        status: "ok",
        lastSync: new Date(),
        message: "Connected",
      },
    ],
  });
});

// --------------------------------
// API — PROFIT (Dashboard)
// --------------------------------
app.get("/api/profit", async (_, res) => {
  try {
    /**
     * Product-level profit (existing logic)
     */
    const products = await prisma.productLog.findMany({
      where: {
        finalPrice: { not: null },
        sourcePrice: { not: null },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    const enrichedProducts = products.map((p) => {
      const profit = p.finalPrice - p.sourcePrice;
      const margin =
        p.sourcePrice > 0 ? (profit / p.sourcePrice) * 100 : 0;

      return {
        ...p,
        profit,
        margin,
      };
    });

    /**
     * Fulfillment-level profit (NEW)
     * salePrice - supplierCost (if available later)
     */
    const fulfillments = await prisma.fulfillmentOrder.findMany({
      where: {
        salePrice: { not: null },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    const fulfillmentProfit = fulfillments.reduce(
      (sum, f) => sum + (f.salePrice || 0),
      0
    );

    res.json({
      totalProfit: enrichedProducts.reduce(
        (a, b) => a + (b.profit || 0),
        0
      ),
      avgMargin:
        enrichedProducts.length > 0
          ? enrichedProducts.reduce((a, b) => a + b.margin, 0) /
            enrichedProducts.length
          : 0,

      topProducts: enrichedProducts
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 5),

      priceAlerts: [],

      // Optional future use
      fulfillmentRevenue: fulfillmentProfit,
    });
  } catch (err) {
    console.error("Profit API error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------
// API — AUTO-SYNC STATUS (FIXES 304)
// --------------------------------
app.get("/api/autosync/status", (_, res) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  });

  res.json(getAutoSyncStatus());
});

// --------------------------------
// API — FULFILLMENT (Dashboard)
// --------------------------------
app.get("/api/fulfillment", async (req, res) => {
  try {
    
    // 🚫 Disable all caching (fixes 304 permanently)
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    });

    const limit = Number(req.query.limit || 50);
    const rows = await listFulfillmentOrders({ limit });
    res.json({ rows });
  } catch (err) {
    console.error("Fulfillment list error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Single fulfillment order
 */
app.get("/api/fulfillment/:id", async (req, res) => {
  try {
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    });

    const row = await getFulfillmentOrder(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Manual retry (CJ only)
 */
app.post("/api/fulfillment/:id/retry", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const fo = await prisma.fulfillmentOrder.findUnique({ where: { id } });
    if (!fo) return res.status(404).json({ error: "Not found" });

    if (fo.supplier !== "cj") {
      return res.status(400).json({ error: "Not a CJ fulfillment" });
    }

    await createCjOrderFromFulfillmentOrder(id);

    res.json({ ok: true });
  } catch (err) {
    console.error("Fulfillment retry error:", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Manual mark delivered (safe override)
 */
app.post("/api/fulfillment/:id/mark-delivered", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const updated = await prisma.fulfillmentOrder.update({
      where: { id },
      data: { status: "delivered" },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------
// START SERVER + WORKERS
// --------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  startAutoSync();
  startTrackingSyncWorker();
  startFulfillmentRetryWorker();
  console.log("✅ Server running on port", PORT);
});

