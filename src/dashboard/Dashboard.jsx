import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * If your API is same-origin, leave API_BASE = "".
 * If you ever host API elsewhere, set API_BASE = "https://your-api.com"
 */
const API_BASE = "";

/**
 * Optional auth:
 * - Put a token in localStorage: localStorage.setItem("ADMIN_TOKEN", "...")
 * - Dashboard will send it as `x-admin-token` on API requests + WS query param
 */
function getAdminToken() {
  return localStorage.getItem("ADMIN_TOKEN") || "";
}

async function apiGet(path) {
  try {
    const res = await fetch(API_BASE + path, {
      headers: getAdminToken() ? { "x-admin-token": getAdminToken() } : {},
    });
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
      headers: {
        "Content-Type": "application/json",
        ...(getAdminToken() ? { "x-admin-token": getAdminToken() } : {}),
      },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("POST", path, "failed:", err.message);
    return null;
  }
}

function Badge({ children }) {
  return <span className="badge">{children}</span>;
}

function Pill({ children, tone = "neutral" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

/* ---------------- Summary Cards ---------------- */

function SummaryCards({ stats, profit }) {
  const totalImported = stats?.totalImported ?? 0;
  const totalRuns = stats?.totalRuns ?? 0;
  const avgMarkup = stats?.avgMarkup ?? 0;

  const totalProfit = profit?.totalProfit ?? 0;
  const avgMargin = profit?.avgMargin ?? 0;

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
        <div className="card-sub">Recent activity</div>
      </div>

      <div className="card">
        <div className="card-title">Avg Markup</div>
        <div className="card-main">{Number(avgMarkup).toFixed(1)}%</div>
        <div className="card-sub">Pricing rules / overrides</div>
      </div>

      <div className="card">
        <div className="card-title">Estimated Profit</div>
        <div
          className={
            "card-main " + (totalProfit >= 0 ? "profit-positive" : "profit-negative")
          }
        >
          ${Number(totalProfit).toFixed(2)}
        </div>
        <div className="card-sub">
          Avg margin <span className="mini">{Number(avgMargin).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Sources ---------------- */

function SourceStatus({ sources }) {
  const items = sources || [];

  const dot = (status) => {
    if (status === "ok") return "dot ok";
    if (status === "warn") return "dot warn";
    return "dot bad";
  };

  return (
    <div className="grid3">
      {items.map((s) => (
        <div key={s.name} className="card">
          <div className="row between">
            <div className="card-title">{s.name}</div>
            <span className={dot(s.status)} />
          </div>
          <div className="card-sub">{s.message || "No recent errors"}</div>
          <div className="divider" />
          <div className="row between">
            <span className="mini">Last sync</span>
            <span className="mini">
              {s.lastSync ? new Date(s.lastSync).toLocaleString() : "n/a"}
            </span>
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="empty-state">
          No source status data yet. Backend route <code>/api/status/sources</code>{" "}
          may not be implemented (or returned empty).
        </div>
      )}
    </div>
  );
}

/* ---------------- Recent Runs ---------------- */

function RecentRuns({ runs }) {
  if (!runs || runs.length === 0) {
    return <div className="empty-state">No runs yet. Run your first import.</div>;
  }

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Keyword</th>
            <th>Source</th>
            <th>Mode</th>
            <th>Markup</th>
            <th>Created</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id || `${r.keyword}-${r.startedAt}`}>
              <td>{new Date(r.startedAt || r.createdAt || Date.now()).toLocaleString()}</td>
              <td className="mono">{r.keyword}</td>
              <td><Pill tone="neutral">{r.source || "unknown"}</Pill></td>
              <td className="mono">{r.mode || "search"}</td>
              <td>{Number(r.markupPercent ?? 0).toFixed(1)}%</td>
              <td>{r.createdCount ?? 0}</td>
              <td>
                <Pill
                  tone={
                    r.status === "success"
                      ? "ok"
                      : r.status === "error"
                      ? "bad"
                      : "neutral"
                  }
                >
                  {r.status || "unknown"}
                </Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Profit ---------------- */

function ProfitSection({ profit }) {
  const top = profit?.topProducts ?? [];
  const alerts = profit?.priceAlerts ?? [];

  return (
    <div className="section">
      <div className="section-header">
        <div>
          <h3>Profit & Price Signals</h3>
          <div className="mini">
            Uses your backend <code>/api/profit</code> if implemented.
          </div>
        </div>
        <Badge>Auto price alerts</Badge>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-title">Top Profitable</div>
          <div className="divider" />
          {top.length === 0 ? (
            <div className="empty-state">No profit data yet.</div>
          ) : (
            <div className="tableWrap">
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
                  {top.map((p) => (
                    <tr key={p.shopifyProductId || p.asin || p.id}>
                      <td>{p.title}</td>
                      <td>${Number(p.profit ?? 0).toFixed(2)}</td>
                      <td>{Number(p.margin ?? 0).toFixed(1)}%</td>
                      <td><Pill>{p.source || "amazon"}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Price Increase Alerts</div>
          <div className="divider" />
          {alerts.length === 0 ? (
            <div className="empty-state">No alerts.</div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Old</th>
                    <th>New</th>
                    <th>Δ</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.id || a.asin || a.title}>
                      <td>{a.title}</td>
                      <td>${Number(a.oldPrice ?? 0).toFixed(2)}</td>
                      <td>${Number(a.newPrice ?? 0).toFixed(2)}</td>
                      <td className={Number(a.changePercent ?? 0) > 0 ? "profit-negative" : "profit-positive"}>
                        {Number(a.changePercent ?? 0).toFixed(1)}%
                      </td>
                      <td><Pill>{a.source || "amazon"}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Import Form ---------------- */

function ImportForm({ onRunCompleted, onLog }) {
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState("search");
  const [markup, setMarkup] = useState("");
  const [source, setSource] = useState("amazon");
  const [running, setRunning] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setRunning(true);
    onLog?.(`▶ Import started: "${keyword.trim()}" [${mode} @ ${source}]`);

    const payload = {
      keyword: keyword.trim(),
      mode,
      source,
      markupPercent: markup ? Number(markup) : undefined,
    };

    const res = await apiPost("/api/import", payload);
    if (!res) {
      onLog?.(`❌ Import failed for "${keyword.trim()}"`);
    } else {
      onLog?.(`✅ Import finished: created ${res.createdCount ?? 0} products (runId=${res.runId ?? "n/a"})`);
      onRunCompleted?.();
    }

    setRunning(false);
  };

  return (
    <div className="card">
      <div className="row between">
        <div>
          <div className="card-title">Import Products</div>
          <div className="mini">Amazon / AliExpress / Walmart via your backend pipeline</div>
        </div>
        <Badge>Auto-sync ready</Badge>
      </div>

      <div className="divider" />

      <form onSubmit={submit} className="stack">
        <div className="grid4">
          <div className="field">
            <label>Keyword / ID</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder='e.g. "gym equipment"'
            />
          </div>

          <div className="field">
            <label>Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="search">Search</option>
              <option value="product-details">Product Details</option>
              <option value="product-offers">Product Offers</option>
            </select>
          </div>

          <div className="field">
            <label>Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="amazon">Amazon</option>
              <option value="aliexpress">AliExpress</option>
              <option value="walmart">Walmart</option>
            </select>
          </div>

          <div className="field">
            <label>Markup % (optional)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={markup}
              onChange={(e) => setMarkup(e.target.value)}
              placeholder="Default"
            />
          </div>
        </div>

        <button className="btn primary" type="submit" disabled={running}>
          {running ? "Running import..." : "Run Import"}
        </button>
      </form>
    </div>
  );
}

/* ---------------- Auto-sync Status (polling) ---------------- */

function AutoSyncStatus({ status, loading }) {
  const enabled = status?.enabled ?? false;
  const lastRunAt = status?.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : "n/a";
  const nextRunAt = status?.nextRunAt ? new Date(status.nextRunAt).toLocaleString() : "n/a";
  const lastResult = status?.lastResult || "unknown";

  return (
    <div className="card">
      <div className="row between">
        <div>
          <div className="card-title">Auto-sync</div>
          <div className="mini">
            Polled from <code>/api/autosync/status</code> every 5s
          </div>
        </div>
        <Pill tone={enabled ? "ok" : "bad"}>{enabled ? "Enabled" : "Disabled"}</Pill>
      </div>

      <div className="divider" />

      {loading ? (
        <div className="mini">Loading…</div>
      ) : (
        <div className="stack">
          <div className="row between">
            <span className="mini">Last run</span>
            <span className="mono mini">{lastRunAt}</span>
          </div>
          <div className="row between">
            <span className="mini">Next run</span>
            <span className="mono mini">{nextRunAt}</span>
          </div>
          <div className="row between">
            <span className="mini">Last result</span>
            <Pill tone={lastResult === "success" ? "ok" : lastResult === "error" ? "bad" : "neutral"}>
              {lastResult}
            </Pill>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Live Logs (WebSocket) ---------------- */

function LiveLogs({ lines, connected, onClear }) {
  return (
    <div className="card">
      <div className="row between">
        <div>
          <div className="card-title">Live Logs</div>
          <div className="mini">
            WebSocket <code>/ws/logs</code> (optional)
          </div>
        </div>
        <div className="row gap">
          <Pill tone={connected ? "ok" : "bad"}>{connected ? "Connected" : "Offline"}</Pill>
          <button className="btn sm" type="button" onClick={onClear}>Clear</button>
        </div>
      </div>

      <div className="divider" />

      <div className="log">
        {lines.length === 0 ? (
          <div className="empty-state">No logs yet.</div>
        ) : (
          lines.map((l, i) => (
            <div key={i} className="log-line">{l}</div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------- MAIN ---------------- */

export default function DashboardApp() {
  const [tab, setTab] = useState("overview");

  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [sources, setSources] = useState([]);
  const [profit, setProfit] = useState(null);

  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLoading, setSyncLoading] = useState(true);

  const [loading, setLoading] = useState(true);

  const [logLines, setLogLines] = useState([]);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);

  const pushLog = (line) => {
    setLogLines((prev) => [...prev.slice(-300), `${new Date().toLocaleTimeString()}  ${line}`]);
  };

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

  // Auto-sync polling
  useEffect(() => {
    let alive = true;

    async function poll() {
      setSyncLoading(true);
      const res = await apiGet("/api/autosync/status");
      if (!alive) return;
      setSyncStatus(res || { enabled: false, lastResult: "unknown" });
      setSyncLoading(false);
    }

    poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // WebSocket logs (optional)
  useEffect(() => {
    const token = getAdminToken();
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${proto}://${window.location.host}/ws/logs${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        pushLog("🟢 WebSocket connected");
      };

      ws.onmessage = (evt) => {
        const msg = String(evt.data || "");
        pushLog(msg);
      };

      ws.onclose = () => {
        setWsConnected(false);
        pushLog("🔴 WebSocket disconnected");
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      return () => {
        try { ws.close(); } catch {}
      };
    } catch (e) {
      setWsConnected(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshAll();
  }, []);

  const overview = (
    <>
      <SummaryCards stats={stats} profit={profit} />

      <div className="grid2" style={{ marginTop: "0.9rem" }}>
        <AutoSyncStatus status={syncStatus} loading={syncLoading} />
        <LiveLogs
          lines={logLines}
          connected={wsConnected}
          onClear={() => setLogLines([])}
        />
      </div>

      <div className="section">
        <div className="section-header">
          <div>
            <h3>Recent Import Runs</h3>
            <div className="mini">Latest activity</div>
          </div>
          <button className="btn sm" type="button" onClick={refreshAll} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <RecentRuns runs={runs} />
      </div>

      <ProfitSection profit={profit} />
    </>
  );

  const importTab = (
    <>
      <div className="grid2">
        <ImportForm onRunCompleted={refreshAll} onLog={pushLog} />
        <div className="card">
          <div className="card-title">Source Health</div>
          <div className="mini">
            From <code>/api/status/sources</code>
          </div>
          <div className="divider" />
          <SourceStatus sources={sources} />
        </div>
      </div>
    </>
  );

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-title">Dashboard</div>
          <div className="mini">Auto-sync · Profit · Multi-source</div>
        </div>

        <div className="nav">
          <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
            Overview
          </button>
          <button className={tab === "import" ? "active" : ""} onClick={() => setTab("import")}>
            Import & Sync
          </button>
        </div>

        <div className="side-footer">
          <div className="mini">API token (optional)</div>
          <TokenBox onSaved={() => pushLog("🔐 Token saved (localStorage)")}/>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h2>{tab === "overview" ? "Overview" : "Import & Sync"}</h2>
            <div className="mini">
              {wsConnected ? "Live logs online" : "Live logs offline"} ·{" "}
              Auto-sync: {syncStatus?.enabled ? "enabled" : "disabled"}
            </div>
          </div>

          <div className="row gap">
            <button className="btn sm" type="button" onClick={refreshAll} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh All"}
            </button>
          </div>
        </div>

        {tab === "overview" ? overview : importTab}
      </main>
    </div>
  );
}

/* ---------- Token input ---------- */

function TokenBox({ onSaved }) {
  const [val, setVal] = useState(getAdminToken());

  return (
    <div className="tokenBox">
      <input
        className="tokenInput"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="ADMIN_TOKEN (optional)"
      />
      <button
        className="btn sm"
        type="button"
        onClick={() => {
          localStorage.setItem("ADMIN_TOKEN", val.trim());
          onSaved?.();
          // reload so WS reconnects with token
          window.location.reload();
        }}
      >
        Save
      </button>
    </div>
  );
}
