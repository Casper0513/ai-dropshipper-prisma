// src/server.js
import express from "express";
import bodyParser from "body-parser";
import { CONFIG } from "./config.js";
import { importKeyword } from "./pipeline.js";
import { prisma } from "./db/client.js";
import { log } from "./utils/logger.js";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* -------------------------------------------------------
   HTML DASHBOARD RENDERING
---------------------------------------------------------*/
function renderDashboardHtml({ runs }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>AI Dropshipper Dashboard</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      line-height: 1.5;
    }
    h1 {
      margin-top: 0;
    }
    .container {
      max-width: 960px;
      margin: auto;
    }
    .card {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 25px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    label { font-weight: bold; margin-top: 10px; display: block; }
    input, select {
      width: 100%;
      padding: 10px;
      margin: 8px 0 15px 0;
      border-radius: 5px;
      border: 1px solid #ccc;
    }
    button.primary {
      background: #0070f3;
      color: #fff;
      padding: 10px 18px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 15px;
    }
    button.primary:hover {
      background: #0053ba;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th, td {
      padding: 10px;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #f0f0f0;
      text-align: left;
    }
    .status-success { color: green; font-weight: bold; }
    .status-error { color: red; font-weight: bold; }
    .status-running { color: orange; font-weight: bold; }
  </style>
</head>

<body>
<div class="container">

  <h1>AI Dropshipper Dashboard</h1>

  <!-- Run Import Card -->
  <div class="card">
    <h2>Run Import</h2>
    <form method="POST" action="/run-import">

      <label for="mode">Mode</label>
      <select name="mode" id="mode">
        <option value="search">Search (keywords → products)</option>
        <option value="product-details">Product details (ASINs → products)</option>
        <option value="product-offers">Product offers (ASINs → info only)</option>
        <option value="product-reviews">Product reviews (ASINs → enrichment)</option>
        <option value="product-sellers">Product sellers (ASINs → enrichment)</option>
        <option value="product-categories">Product categories (keyword → enrichment)</option>
      </select>

      <label for="keyword">Use configured keywords</label>
      <select name="keyword" id="keyword">
        <option value="__all__">(All configured keywords)</option>
        ${CONFIG.keywords.map(k => `<option value="${k}">${k}</option>`).join("")}
      </select>

      <label for="items">Custom keywords or ASINs (comma-separated; overrides above)</label>
      <input
        id="items"
        name="items"
        type="text"
        placeholder="e.g. wireless earbuds, B07PGL2ZSL"
      />

      <label for="markupPercent">Override markup % (optional)</label>
      <input
        id="markupPercent"
        name="markupPercent"
        type="number"
        step="1"
        placeholder="${CONFIG.pricing.markupPercent}"
      />

      <button class="primary" type="submit">Run import now</button>
      <p><small>
        - "Search" and "Product details" create Shopify products.<br>
        - Other modes fetch data only (safe to run).
      </small></p>
    </form>
  </div>

  <!-- Recent Runs -->
  <div class="card">
    <h2>Recent Runs</h2>
    <table>
      <tr>
        <th>Time</th>
        <th>Keyword/ASIN</th>
        <th>Mode</th>
        <th>Status</th>
        <th>Created</th>
        <th>Markup</th>
      </tr>

      ${runs
        .map(r => {
          const st =
            r.status === "success"
              ? "status-success"
              : r.status === "error"
              ? "status-error"
              : "status-running";

          return `
          <tr>
            <td>${new Date(r.startedAt).toLocaleString()}</td>
            <td>${r.keyword}</td>
            <td>${r.mode}</td>
            <td class="${st}">${r.status}</td>
            <td>${r.createdCount}</td>
            <td>${r.markupPercent}%</td>
          </tr>
        `;
        })
        .join("")}
    </table>
  </div>

</div>
</body>
</html>
`;
}

/* -------------------------------------------------------
   ROUTES
---------------------------------------------------------*/
app.get("/", (req, res) => res.redirect("/dashboard"));

app.get("/dashboard", async (req, res) => {
  const runs = await prisma.run.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
  });

  res.send(renderDashboardHtml({ runs }));
});

app.post("/run-import", async (req, res) => {
  const { keyword, markupPercent, mode, items } = req.body;

  const overrideMarkup = markupPercent ? parseFloat(markupPercent) : undefined;
  const activeMode = mode || CONFIG.mode || "search";

  // Calculate "targets"
  let targets = [];

  if (items && items.trim()) {
    // Custom comma-separated list takes full priority
    targets = items
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);
  } else if (!keyword || keyword === "__all__") {
    // Use all keywords in .env
    targets = CONFIG.keywords;
  } else {
    // Single selected keyword
    targets = [keyword];
  }

  for (const t of targets) {
    try {
      await importKeyword(t, {
        markupPercent: overrideMarkup,
        source: "dashboard",
        mode: activeMode,
      });
    } catch (err) {
      log.error("Import error:", err.message);
    }
  }

  res.redirect("/dashboard");
});

/* -------------------------------------------------------
   HEALTHCHECK
---------------------------------------------------------*/
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* -------------------------------------------------------
   START SERVER
---------------------------------------------------------*/
app.listen(CONFIG.server.port, () => {
  console.log(
    `AI Dropshipper server listening on port ${CONFIG.server.port}`
  );
});
