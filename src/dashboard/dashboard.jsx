import "./Dashboard.css";

const { useState, useEffect } = React;

const API_BASE = "";

// Small helper to wrap fetch with JSON + error handling
async function apiGet(path) {
  try {
    const res = await fetch(API_BASE + path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("GET", path, "failed:", err.message);
    return null;
  }
}

async function apiPost(path, payload) {
  try {
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("POST", path, "failed:", err.message);
    return null;
  }
}

// --- Summary cards ---------------------------------------------------------

function SummaryCards({ stats, profit }) {
  const totalImported = stats?.totalImported ?? 0;
  const totalRuns = stats?.totalRuns ?? 0;
  const avgMarkup = stats?.avgMarkup ?? 0;
  const totalProfit = profit?.totalProfit ?? 0;
  const margin = profit?.avgMargin ?? 0;

  return (
    <div className="cards">
      <div className="card">
        <div className="card-title">Total Products Imported</div>
        <div className="card-main">{totalImported}</div>
        <div className="card-sub">Across all sources</div>
      </div>
      <div className="card">
        <div className="card-title">Import Runs</div>
        <div className="card-main">{totalRuns}</div>
        <div className="card-sub">Recent 30 days</div>
      </div>
      <div className="card">
        <div className="card-title">Avg Markup</div>
        <div className="card-main">{avgMarkup.toFixed(1)}%</div>
        <div className="card-sub">Configured in pricing rules</div>
      </div>
      <div className="card">
        <div className="card-title">Estimated Profit</div>
        <div
          className={
            "card-main " +
            (totalProfit >= 0 ? "profit-positive" : "profit-negative")
          }
        >
          ${totalProfit.toFixed(2)}
        </div>
        <div className="card-sub">
          Avg margin{" "}
          <span className="badge-small">{margin.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

// --- Source status cards (Amazon / AliExpress / Walmart) -------------------

function SourceStatus({ sources }) {
  const items = sources || [];

  const getDotClass = (status) => {
    if (status === "ok") return "status-dot status-ok";
    if (status === "warn") return "status-dot status-warn";
    return "status-dot status-bad";
  };

  return (
    <div className="sources">
      {items.map((s) => (
        <div key={s.name} className="source-card">
          <div className="source-head">
            <span>{s.name}</span>
            <span className={getDotClass(s.status)}></span>
          </div>
          <div className="status-text">
            {s.message || "No recent errors"}
          </div>
          <div className="pill" style={{ marginTop: "0.4rem" }}>
            Last sync: {s.lastSync ? new Date(s.lastSync).toLocaleString() : "n/a"}
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="empty-state">
          No source status data. Backend route <code>/api/status/sources</code>{" "}
          may not be implemented yet.
        </div>
      )}
    </div>
  );
}

// --- Import form -----------------------------------------------------------

function ImportForm({ onRunCompleted }) {
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState("search");
  const [markup, setMarkup] = useState("");
  const [source, setSource] = useState("amazon");
  const [isRunning, setIsRunning] = useState(false);
  const [logLines, setLogLines] = useState([]);

  const pushLog = (line) => {
    setLogLines((prev) => [...prev.slice(-80), line]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setIsRunning(true);
    pushLog(`▶ Import started: "${keyword}" [${mode} @ ${source}]`);

    const payload = {
      keyword: keyword.trim(),
      mode,
      markupPercent: markup ? Number(markup) : undefined,
      source, // let backend decide actual RapidAPI host based on this
    };

    const res = await apiPost("/api/import", payload);

    if (!res) {
      pushLog(`❌ Import failed for "${keyword}"`);
    } else {
      pushLog(
        `✅ Import finished: created ${res.createdCount ?? 0} products (runId=${res.runId ?? "n/a"})`
      );
      onRunCompleted && onRunCompleted();
    }

    setIsRunning(false);
  };

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h3>Import Products</h3>
          <small>
            Amazon, AliExpress & Walmart via DropBopp pipeline (AI descriptions,
            pricing rules, auto-sync).
          </small>
        </div>
        <div className="section-actions">
          <span className="tag">Auto-sync enabled</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field">
            <label>Keyword / ASIN / Product ID</label>
            <input
              placeholder='e.g. "gym equipment" or ASIN "B09XYZ123"'
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="search">Search</option>
              <option value="product-offers">Product Offers</option>
              <option value="product-details">Product Details</option>
            </select>
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="amazon">Amazon</option>
              <option value="aliexpress">AliExpress</option>
              <option value="walmart">Walmart</option>
            </select>
          </div>
          <div className="field" style={{ maxWidth: 140 }}>
            <label>Override Markup % (optional)</label>
            <input
              type="number"
              step="1"
              min="0"
              placeholder="Default"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
            />
          </div>
        </div>

        <button className="btn primary" type="submit" disabled={isRunning}>
          {isRunning ? "Running import..." : "Run Import"}
        </button>
      </form>

      <div style={{ marginTop: "0.7rem" }}>
        <div className="card-title">Activity Log</div>
        <div className="log">
          {logLines.length === 0 && (
            <div className="empty-state">No activity yet.</div>
          )}
          {logLines.map((line, idx) => (
            <div key={idx} className="log-line">
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Recent runs table -----------------------------------------------------

function RecentRuns({ runs }) {
  if (!runs || runs.length === 0) {
    return (
      <div className="empty-state">
        No runs yet. Use the form above to import your first batch.
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>When</th>
          <th>Keyword</th>
          <th>Source</th>
          <th>Markup</th>
          <th>Created</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id}>
            <td>{new Date(r.startedAt || r.createdAt).toLocaleString()}</td>
            <td>{r.keyword}</td>
            <td>
              <span className="tag-pill">
                {r.source || "unknown"}
              </span>
            </td>
            <td>{(r.markupPercent ?? 0).toFixed(1)}%</td>
            <td>{r.createdCount ?? 0}</td>
            <td>
              <span
                className={
                  "tag-pill " +
                  (r.status === "success"
                    ? "pill ok"
                    : r.status === "error"
                    ? "pill bad"
                    : "")
                }
              >
                {r.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --- Profit breakdown & alerts --------------------------------------------

function ProfitSection({ profit }) {
  const topProfitable = profit?.topProducts ?? [];
  const alerts = profit?.priceAlerts ?? [];

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h3>Profit & Price Signals</h3>
          <small>
            Estimated profits based on source price, your markup, and Shopify
            sales data (if wired).
          </small>
        </div>
        <div className="section-actions">
          <span className="tag">Auto price alerts</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.8rem" }}>
        <div>
          <div className="card-title">Top Profitable Products</div>
          {topProfitable.length === 0 ? (
            <div className="empty-state">
              No profit data yet. This relies on your backend `/api/profit`
              implementation.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Profit</th>
                  <th>Margin</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {topProfitable.map((p) => (
                  <tr key={p.shopifyProductId || p.asin}>
                    <td>{p.title}</td>
                    <td>${p.profit.toFixed(2)}</td>
                    <td>{p.margin.toFixed(1)}%</td>
                    <td>
                      <span className="tag-pill">
                        {p.source || "amazon"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="card-title">Price Increase Alerts</div>
          {alerts.length === 0 ? (
            <div className="empty-state">
              No recent alerts. Backend should push items where source price
              increased beyond your threshold.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Old Price</th>
                  <th>New Price</th>
                  <th>Delta</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.title}</td>
                    <td>${a.oldPrice.toFixed(2)}</td>
                    <td>${a.newPrice.toFixed(2)}</td>
                    <td
                      className={
                        a.newPrice > a.oldPrice
                          ? "profit-negative"
                          : "profit-positive"
                      }
                    >
                      {a.changePercent.toFixed(1)}%
                    </td>
                    <td>
                      <span className="tag-pill">
                        {a.source || "amazon"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Main Dashboard component ---------------------------------------------

function DashboardApp() {
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [sources, setSources] = useState([]);
  const [profit, setProfit] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshAll = async () => {
    setLoading(true);

    const [statsRes, runsRes, sourcesRes, profitRes] = await Promise.all([
      apiGet("/api/stats"),
      apiGet("/api/runs"),
      apiGet("/api/status/sources"),
      apiGet("/api/profit"),
    ]);

    setStats(statsRes || {});
    setRuns(runsRes?.runs || runsRes || []);
    setSources(sourcesRes?.sources || sourcesRes || []);
    setProfit(profitRes || {});

    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const overviewContent = (
    <>
      <SummaryCards stats={stats} profit={profit} />
      <div className="section">
        <div className="section-header">
          <div>
            <h3>Recent Import Runs</h3>
            <small>Latest activity across Amazon / AliExpress / Walmart</small>
          </div>
          <div className="section-actions">
            <button
              className="btn sm"
              type="button"
              onClick={refreshAll}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <RecentRuns runs={runs} />
      </div>
      <ProfitSection profit={profit} />
    </>
  );

  const importContent = (
    <>
      <ImportForm onRunCompleted={refreshAll} />
      <div className="section">
        <div className="section-header">
          <div>
            <h3>Source Health</h3>
            <small>
              Amazon, AliExpress, and Walmart sync status & last checks.
            </small>
          </div>
          <div className="section-actions">
            <button
              className="btn sm"
              type="button"
              onClick={refreshAll}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
        <SourceStatus sources={sources} />
      </div>
    </>
  );

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>
          DropBopp
          <br />
          <small>AI Dropshipping Console</small>
        </h1>
        <div className="nav">
          <button
            className={activeTab === "overview" ? "active" : ""}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={activeTab === "import" ? "active" : ""}
            onClick={() => setActiveTab("import")}
          >
            Import & Sync
          </button>
        </div>
        <div style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#6b7280" }}>
          <div>Auto-sync system</div>
          <div>Profit dashboard</div>
          <div>Multi-source reliability</div>
        </div>
      </aside>

      <main className="main">
        <div className="top-row">
          <div>
            <h2>
              {activeTab === "overview" ? "Overview" : "Import & Sync"}{" "}
            </h2>
            <div className="badge">
              Live · Shopify-connected · RapidAPI powered
            </div>
          </div>
          <button
            className="btn sm"
            type="button"
            onClick={refreshAll}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh All"}
          </button>
        </div>

        {activeTab === "overview" ? overviewContent : importContent}
      </main>
    </div>
  );
}

export default DashboardApp;
