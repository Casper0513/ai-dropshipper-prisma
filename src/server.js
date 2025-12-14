import express from "express";
import cors from "cors";
import path from "path";
import { startAutoSync } from "./workers/autoSyncRunner.js";

// 🔗 IMPORT YOUR PIPELINE + DB
import { importKeyword } from "./pipeline.js";
import { prisma } from "./db/client.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ===============================
// DASHBOARD (STATIC)
// ===============================
app.use("/dashboard", express.static("src/dashboard"));

app.get("/dashboard", (req, res) => {
  res.sendFile(path.resolve("src/dashboard/dashboard.html"));
});

app.get("/", (req, res) => {
  res.redirect("/dashboard/dashboard.html");
});

// ===============================
// API — IMPORT PRODUCTS
// ===============================
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
        lastSync: new Date(),
        message: "Operational",
      },
    ],
  });
});

app.get("/api/profit", async (req, res) => {
  const products = await prisma.productLog.findMany({
    where: {
      finalPrice: { not: null },
      sourcePrice: { not: null },
    },
    take: 20,
  });

  const enriched = products.map((p) => {
    const profit = (p.finalPrice || 0) - (p.sourcePrice || 0);
    const margin =
      p.sourcePrice > 0 ? (profit / p.sourcePrice) * 100 : 0;

    return {
      ...p,
      profit,
      margin,
    };
  });

  res.json({
    totalProfit: enriched.reduce((a, b) => a + b.profit, 0),
    avgMargin:
      enriched.length > 0
        ? enriched.reduce((a, b) => a + b.margin, 0) / enriched.length
        : 0,
    topProducts: enriched.sort((a, b) => b.profit - a.profit).slice(0, 5),
    priceAlerts: [],
  });
});

// ===============================
// START SERVER
// ===============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // Start background workers
  startAutoSync();
  console.log("✅ Server running on port", PORT);
});
