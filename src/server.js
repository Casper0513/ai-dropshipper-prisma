import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { startAutoSync } from "./workers/autoSyncRunner.js";
import { importKeyword } from "./pipeline.js";
import { prisma } from "./db/client.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve built Vite dashboard
app.use(
  "/dashboard",
  express.static(path.resolve(__dirname, "../dashboard/dist"))
);

app.get("/dashboard", (req, res) => {
  res.sendFile(
    path.resolve(__dirname, "../dashboard/dist/index.html")
  );
});

// Root redirect
app.get("/", (req, res) => {
  res.redirect("/dashboard");
});

// ================= API ROUTES =================

app.post("/api/import", async (req, res) => {
  try {
    const result = await importKeyword(req.body.keyword, req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stats", async (_, res) => {
  const totalRuns = await prisma.run.count();
  const totalImported = await prisma.productLog.count();
  res.json({ totalRuns, totalImported });
});

// ================= START =================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  startAutoSync();
  console.log("✅ Server running on port", PORT);
});
