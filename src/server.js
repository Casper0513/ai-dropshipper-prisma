import express from "express";
import { CONFIG } from "./config.js";
import { importKeyword } from "./pipeline.js";
import { prisma } from "./db/client.js";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Healthcheck for Railway
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

function renderDashboardHtml({ runs }) {
  const keywordsHtml = CONFIG.keywords
    .map(k => `<span class="badge">${k}</span>`)
    .join("");

  const rows = runs.length
    ? runs
        .map(run => {
          return `
          <tr>
            <td>${run.startedAt.toISOString().replace("T", " ").slice(0, 19)}</td>
            <td>${run.keyword}</td>
            <td>${run.createdCount}</td>
            <td>${run.markupPercent}%</td>
            <td>${run.status}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="5" style="text-align:center;">No runs yet</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>AI Dropshipper Dashboard</title>
  <style>
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f6f6f7;
      color: #202223;
    }
    header {
      background: #111827;
      color: #f9fafb;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    header h1 {
      margin: 0;
      font-size: 20px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    header span.logo-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #22c55e;
    }
    main {
      max-width: 1000px;
      margin: 24px auto;
      padding: 0 16px 40px;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
      padding: 20px;
      margin-bottom: 16px;
    }
    .card h2 {
      margin-top: 0;
      font-size: 18px;
    }
    .badge {
      display: inline-block;
      background: #eff6ff;
      color: #1e3a8a;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 12px;
      margin: 2px;
    }
    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 8px;
    }
    .config-item {
      font-size: 13px;
      color: #4b5563;
    }
    label {
      display: block;
      font-size: 13px;
      margin-top: 8px;
      margin-bottom: 4px;
      font-weight: 500;
    }
    input, select, button {
      font: inherit;
    }
    input[type="number"],
    input[type="text"],
    select {
      width: 100%;
      padding: 7px 9px;
      border-radius: 8px;
      border: 1px solid #d1d5db;
      box-sizing: border-box;
    }
    button.primary {
      margin-top: 12px;
      background: #111827;
      color: #f9fafb;
      padding: 8px 16px;
      border-radius: 999px;
      border: none;
      cursor: pointer;
      font-weight: 500;
    }
    button.primary:hover {
      background: #030712;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 13px;
    }
    table thead {
      background: #f3f4f6;
    }
    table th, table td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
      text-align: left;
    }
    small {
      color: #6b7280;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <header>
    <h1><span class="logo-dot"></span> AI Dropshipper</h1>
    <div style="font-size:12px;opacity:0.8;">Shopify + RapidAPI + OpenAI</div>
  </header>

  <main>
    <section class="card">
      <h2>Overview</h2>
      <div class="config-grid">
        <div class="config-item">
          <strong>Keywords</strong><br />
          ${keywordsHtml || "<small>No KEYWORDS set in .env</small>"}
        </div>
        <div class="config-item">
          <strong>Import price range</strong><br />
          ${CONFIG.priceRange.minImport} – ${CONFIG.priceRange.maxImport} USD
        </div>
        <div class="config-item">
          <strong>Default markup</strong><br />
          +${CONFIG.pricing.markupPercent}% → ending ${CONFIG.pricing.roundTo || 0}
        </div>
        <div class="config-item">
          <strong>Image mode</strong><br />
          ${CONFIG.images.mode} ${CONFIG.images.mode === "proxy" ? "(" + CONFIG.images.proxyUrl + ")" : ""}
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Run Import</h2>
      <form method="POST" action="/run-import">
        <label for="keyword">Keyword / Collection</label>
        <select name="keyword" id="keyword">
          <option value="__all__">(All configured keywords)</option>
          ${CONFIG.keywords
            .map(k => `<option value="${k}">${k}</option>`)
            .join("")}
        </select>

        <label for="markupPercent">Override markup % (optional)</label>
        <input id="markupPercent" name="markupPercent" type="number" step="1" placeholder="${CONFIG.pricing.markupPercent}" />

        <button class="primary" type="submit">Run import now</button>
        <p><small>This will fetch products from RapidAPI, generate AI descriptions, and create Shopify products.</small></p>
      </form>
    </section>

    <section class="card">
      <h2>Recent runs</h2>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Keyword</th>
            <th># Products</th>
            <th>Markup</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

app.get("/", (req, res) => res.redirect("/dashboard"));

app.get("/dashboard", async (req, res) => {
  try {
    const runs = await prisma.run.findMany({
      orderBy: { startedAt: "desc" },
      take: 20
    });
    res.send(renderDashboardHtml({ runs }));
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).send("Dashboard error. Check server logs.");
  }
});

app.post("/run-import", async (req, res) => {
  const { keyword, markupPercent } = req.body;
  const overrideMarkup = markupPercent ? parseFloat(markupPercent) : undefined;

  const keywordsToRun =
    keyword === "__all__" || !keyword ? CONFIG.keywords : [keyword];

  for (const kw of keywordsToRun) {
    try {
      await importKeyword(kw, {
        markupPercent: overrideMarkup,
        source: "dashboard"
      });
    } catch (err) {
      console.error("Import error:", err);
    }
  }

  res.redirect("/dashboard");
});

app.listen(CONFIG.server.port, () => {
  console.log(`AI Dropshipper server listening on port ${CONFIG.server.port}`);
});
