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
import { startAliExpressFulfillmentWorker } from "./workers/aliexpressFulfillmentWorker.js";
import { startAliExpressTrackingWorker } from "./workers/aliexpressTrackingWorker.js";

// --------------------------------
// App bootstrap
// --------------------------------
const app = express();
app.use(cors());

// --------------------------------
// IMPORTANT BODY PARSING RULES
// --------------------------------
app.use("/api/webhooks", express.raw({ type: "application/json" }));
app.use(express.json());

// --------------------------------
// 🔒 Guardrail helpers
// --------------------------------
const CJ_MAX_RETRIES = Number(process.env.CJ_MAX_RETRIES || "3");

function noStore(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  });
}

function safeJson(s) {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

function isTerminal(status) {
  return status === "delivered";
}

function canTransition(from, to) {
  const allowed = new Set([
    "pending->ordered",
    "pending->failed",
    "failed->ordered",
    "ordered->shipped",
    "ordered->delivered",
    "shipped->delivered",
  ]);
  return allowed.has(`${from}->${to}`);
}

async function loadFoOr404(id) {
  const fo = await prisma.fulfillmentOrder.findUnique({
    where: { id: Number(id) },
  });
  if (!fo) {
    const err = new Error("Not found");
    err.statusCode = 404;
    throw err;
  }
  return fo;
}

function enforceFoGuardrails(fo, action) {
  const meta = safeJson(fo.metaJson);

  // ⛔ Terminal lock
  if (isTerminal(fo.status)) {
    throw Object.assign(
      new Error("Fulfillment already delivered"),
      { statusCode: 409 }
    );
  }

  // ⛔ Profit block
  if (meta.blockedReason === "NEGATIVE_PROFIT") {
    throw Object.assign(
      new Error("Order blocked due to negative profit"),
      { statusCode: 409 }
    );
  }

  // ⛔ CJ retry rules
  if (action === "retry") {
    if (fo.supplier !== "cj") {
      throw Object.assign(
        new Error("Retry is CJ-only"),
        { statusCode: 400 }
      );
    }
    if (fo.cjOrderId) {
      throw Object.assign(
        new Error("CJ order already exists"),
        { statusCode: 409 }
      );
    }
    if (meta.retryCount >= CJ_MAX_RETRIES) {
      throw Object.assign(
        new Error("Retry limit reached"),
        { statusCode: 409 }
      );
    }
    if (meta.fallback?.provider === "aliexpress") {
      throw Object.assign(
        new Error("Order already fell back to AliExpress"),
        { statusCode: 409 }
      );
    }

    // ✅ ADD: retry lock parity with worker
    if (meta._retryLock === true) {
      throw Object.assign(
        new Error("Fulfillment retry already in progress"),
        { statusCode: 409 }
      );
    }
  }

  // ✅ ADD: prevent CJ actions after AliExpress fallback
  if (
    action === "mark-ordered" &&
    meta.fallback?.provider === "aliexpress" &&
    fo.supplier === "cj"
  ) {
    throw Object.assign(
      new Error("CJ fulfillment disabled after AliExpress fallback"),
      { statusCode: 409 }
    );
  }

  return meta;
}

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

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

// --------------------------------
// SHOPIFY WEBHOOK — ORDERS PAID
// --------------------------------
app.post("/api/webhooks/shopify/orders-paid", async (req, res) => {
  try {
    const rawBody = req.body.toString("utf8");

    if (!verifyShopifyWebhook(req, rawBody)) {
      console.warn("❌ Invalid Shopify webhook signature");
      return res.status(401).send("Invalid webhook");
    }

    console.log("✅ Shopify webhook verified");

    const order = JSON.parse(rawBody);
    const routes = await routeFulfillment(order);

    for (const r of routes) {
      const lineItem = order.line_items?.find(
        (i) => String(i.id) === r.lineItemId
      );

      const salePrice = lineItem
        ? Number(lineItem.price) * Number(lineItem.quantity || 1)
        : null;

      const fo = await prisma.fulfillmentOrder.create({
        data: {
          shopifyOrderId: String(order.id),
          shopifyLineItemId: String(r.lineItemId),
          supplier: r.supplier,
          status: "pending",
          salePrice,
          metaJson: JSON.stringify({
            sku: r.variant?.sku || null,
            quantity: lineItem?.quantity || 1,
            recipient: order.shipping_address || null,
          }),
        },
      });

      if (r.supplier === "cj" && r.fulfillmentMode === "auto") {
        try {
          await createCjOrderFromFulfillmentOrder(fo.id);
        } catch (err) {
          console.error("CJ submit failed:", err.message);
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
// Paths
// --------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------
// Dashboard
// --------------------------------
const dashboardDist = path.join(__dirname, "../dashboard/dist");
app.use("/dashboard", express.static(dashboardDist));
app.get("/dashboard", (_, res) =>
  res.sendFile(path.join(dashboardDist, "index.html"))
);
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
    res.status(500).json({ error: err.message });
  }
});

// --------------------------------
// API — DASHBOARD STATS
// --------------------------------
app.get("/api/stats", async (_, res) => {
  noStore(res);

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
  noStore(res);
  const runs = await prisma.run.findMany({
    orderBy: { startedAt: "desc" },
    take: 25,
  });
  res.json(runs);
});

// --------------------------------
// API — AUTO-SYNC STATUS
// --------------------------------
app.get("/api/autosync/status", (_, res) => {
  noStore(res);
  res.json(getAutoSyncStatus());
});

// --------------------------------
// API — SOURCE STATUS (Dashboard)
// --------------------------------
app.get("/api/status/sources", (_, res) => {
  noStore(res);

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
        name: "CJ Dropshipping",
        status: "ok",
        lastSync: new Date(),
        message: "Connected",
      },
      {
        name: "Walmart",
        status: "inactive",
        lastSync: null,
        message: "Disabled",
      },
    ],
  });
});

// --------------------------------
// API — FULFILLMENT
// --------------------------------
app.get("/api/fulfillment", async (req, res) => {
  noStore(res);
  const rows = await listFulfillmentOrders({
    limit: Number(req.query.limit || 50),
  });
  res.json({ rows });
});

app.get("/api/fulfillment/:id", async (req, res) => {
  noStore(res);
  const row = await getFulfillmentOrder(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

app.post("/api/fulfillment/:id/retry", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fo = await loadFoOr404(id);
    enforceFoGuardrails(fo, "retry");

    await createCjOrderFromFulfillmentOrder(id);
    res.json({ ok: true });
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message || "Retry failed" });
  }
});

app.post("/api/fulfillment/:id/mark-ordered", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fo = await loadFoOr404(id);
    enforceFoGuardrails(fo, "mark-ordered");

    if (!canTransition(fo.status, "ordered")) {
      return res.status(409).json({ error: "Invalid status transition" });
    }

    const updated = await prisma.fulfillmentOrder.update({
      where: { id },
      data: { status: "ordered" },
    });

    res.json(updated);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message });
  }
});

app.post("/api/fulfillment/:id/approve", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fo = await loadFoOr404(id);
    enforceFoGuardrails(fo, "approve");

    const updated = await prisma.fulfillmentOrder.update({
      where: { id },
      data: { status: "ordered" },
    });

    res.json(updated);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message });
  }
});

app.post("/api/fulfillment/:id/mark-delivered", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fo = await loadFoOr404(id);
    enforceFoGuardrails(fo, "mark-delivered");

    if (!canTransition(fo.status, "delivered")) {
      return res.status(409).json({ error: "Invalid status transition" });
    }

    const updated = await prisma.fulfillmentOrder.update({
      where: { id },
      data: { status: "delivered" },
    });

    res.json(updated);
  } catch (err) {
    res
      .status(err.statusCode || 500)
      .json({ error: err.message });
  }
});

// --------------------------------
// API — PROFIT (AUTHORITATIVE)
// --------------------------------
app.get("/api/profit", async (_, res) => {
  noStore(res);

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
    recent: rows.map((r) => ({
      orderId: r.shopifyOrderId,
      profit: r.profit,
      salePrice: r.salePrice,
      supplierCost: r.supplierCost,
      createdAt: r.createdAt,
    })),
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
  startAliExpressFulfillmentWorker();
  startAliExpressTrackingWorker();
  console.log("✅ Server running on port", PORT);
});




