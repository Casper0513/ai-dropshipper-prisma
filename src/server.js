// src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { importKeyword } from "./pipeline.js";
import { runFullSync } from "./sync/stockPriceSync.js";
import { getProfitSummary } from "./sync/analytics.js";
import { log } from "./utils/logger.js";

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(cors());

// ----------------------------------------------------
// 🔍 HEALTH CHECK
// ----------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "AI Dropshipper",
    message: "Server running",
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------
// 🟦 PRODUCT IMPORT ENDPOINT
// POST /import
// Body example: { "keyword": "gym", "mode": "search", "markupPercent": 35 }
// ----------------------------------------------------
app.post("/import", async (req, res) => {
  try {
    const { keyword, mode, markupPercent, source } = req.body;

    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "Keyword is required" });
    }

    const result = await importKeyword(keyword.trim(), {
      markupPercent,
      mode,
      source: source || "dashboard"
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    log.error(`Import error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ----------------------------------------------------
// 🔄 AUTO-SYNC ENDPOINT
// POST /sync/run
// Runs stock + price sync, multi-source reliability, logs everything
// ----------------------------------------------------
app.post("/sync/run", async (req, res) => {
  try {
    log.info("🔄 Sync API triggered...");
    const result = await runFullSync();

    res.json({
      ok: true,
      message: "Sync completed",
      updatedCount: result.updatedCount,
      runId: result.runId
    });
  } catch (err) {
    log.error(`Sync error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ----------------------------------------------------
// 📊 PROFIT ANALYTICS API
// GET /api/analytics/profit
// Returns totals + per-keyword profit stats
// ----------------------------------------------------
app.get("/api/analytics/profit", async (req, res) => {
  try {
    const summary = await getProfitSummary();
    res.json({ ok: true, ...summary });
  } catch (err) {
    log.error(`Analytics error: ${err.message}`);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ----------------------------------------------------
// 🟧 START SERVER
// ----------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log.success(`AI Dropshipper server listening on port ${PORT}`);
});

export default app;
