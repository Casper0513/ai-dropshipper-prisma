import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { prisma } from "./db/client.js";
import { runImportPipeline } from "./pipeline/importPipeline.js"; // your existing pipeline

const app = express();

// ESM path helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// ------------------------------------------------------
// 📌 STATIC FILES (Dashboard + Public Assets)
// ------------------------------------------------------
app.use(express.static(path.join(__dirname, "../public")));

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});


// ------------------------------------------------------
// 📌 DASHBOARD APIs
// ------------------------------------------------------

// ----- Summary Cards API -----
app.get("/api/stats/summary", async (req, res) => {
  try {
    const totalProducts = await prisma.productLog.count();
    const runsCount = await prisma.run.count();

    const revenueAgg = await prisma.productLog.aggregate({
      _sum: { finalPrice: true }
    });

    const profitAgg = await prisma.productLog.aggregate({
      _sum: { finalPrice: true, sourcePrice: true }
    });

    const totalRevenue = revenueAgg._sum.finalPrice || 0;
    const totalCost = profitAgg._sum.sourcePrice || 0;
    const totalProfit = totalRevenue - totalCost;

    res.json({
      totalProducts,
      totalRevenue,
      totalProfit,
      totalRuns: runsCount
    });
  } catch (err) {
    console.error("Summary Error:", err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

// ----- Runs Table -----
app.get("/api/stats/runs", async (req, res) => {
  try {
    const runs = await prisma.run.findMany({
      orderBy: { id: "desc" },
      take: 20
    });

    res.json(runs);
  } catch (err) {
    console.error("Runs Error:", err);
    res.status(500).json({ error: "Failed to load runs" });
  }
});

// ----- Top Products -----
app.get("/api/stats/top-products", async (req, res) => {
  try {
    const products = await prisma.productLog.findMany({
      orderBy: { finalPrice: "desc" },
      take: 20
    });

    res.json(products);
  } catch (err) {
    console.error("Top Products Error:", err);
    res.status(500).json({ error: "Failed to load top products" });
  }
});


// ------------------------------------------------------
// 📌 IMPORT ENDPOINT — used for your dashboard triggers
// ------------------------------------------------------
app.post("/api/import", async (req, res) => {
  try {
    const { keyword, markupPercent = null } = req.body;
    if (!keyword) return res.status(400).json({ error: "Keyword required" });

    const result = await runImportPipeline(keyword, markupPercent);

    res.json({
      success: true,
      result
    });
  } catch (err) {
    console.error("Import Error:", err);
    res.status(500).json({ error: "Import failed" });
  }
});


// ------------------------------------------------------
// 📌 AUTO-SYNC SYSTEM (price + stock refresh)
// ------------------------------------------------------

// Runs every 10 minutes
setInterval(async () => {
  try {
    console.log("🔄 Running auto-sync job...");

    const products = await prisma.productLog.findMany();

    // You can expand this later (Amazon, Walmart, AliExpress)
    for (const product of products) {
      // placeholder — does not modify anything yet
    }

    console.log("✅ Auto-sync completed.");
  } catch (err) {
    console.error("Auto-sync failed:", err);
  }
}, 1000 * 60 * 10);


// ------------------------------------------------------
// 📌 START SERVER
// ------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

