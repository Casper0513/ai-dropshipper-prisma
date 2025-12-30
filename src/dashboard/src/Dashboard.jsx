import "./Dashboard.css";
import React, { useEffect, useRef, useState } from "react";
import FulfillmentTable from "./components/FulfillmentTable";

/**
 * API base (same-origin)
 */
const API_BASE = "";

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

/* ---------------- UI helpers ---------------- */

function Badge({ children }) {
  return <span className="badge">{children}</span>;
}

function Pill({ children, tone = "neutral" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

/* ---------------- Dashboard ---------------- */

export default function DashboardApp() {
  const [tab, setTab] = useState("overview");

  const [stats, setStats] = useState({});
  const [runs, setRuns] = useState([]);
  const [sources, setSources] = useState([]);
  const [profit, setProfit] = useState({});
  const [fulfillment, setFulfillment] = useState([]);

  const [syncStatus, setSyncStatus] = useState(null);
  const [syncLoading, setSyncLoading] = useState(true);

  const [loading, setLoading] = useState(true);

  const [logLines, setLogLines] = useState([]);
  const [logsConnected, setLogsConnected] = useState(false);
  const sseRef = useRef(null);

  const pushLog = (line) => {
    setLogLines((prev) => [
      ...prev.slice(-300),
      `${new Date().toLocaleTimeString()}  ${line}`,
    ]);
  };

  /* ---------------- Data loading ---------------- */

  const refreshAll = async () => {
    setLoading(true);

    const [
      statsRes,
      runsRes,
      sourcesRes,
      profitRes,
      fulfillmentRes,
    ] = await Promise.all([
      apiGet("/api/stats"),
      apiGet("/api/runs"),
      apiGet("/api/status/sources"),
      apiGet("/api/profit"),
      apiGet("/api/fulfillment"),
    ]);

    setStats(statsRes || {});
    setRuns(runsRes?.runs || runsRes || []);
    setSources(sourcesRes?.sources || sourcesRes || []);
    setProfit(profitRes || {});
    setFulfillment(fulfillmentRes?.rows || []);

    setLoading(false);
  };

  /* ---------------- Fulfillment retry ---------------- */

  const retryFulfillment = async (id) => {
    await apiPost(`/api/fulfillment/${id}/retry`);
    pushLog(`♻️ Retry requested for fulfillment ${id}`);
    refreshAll();
  };

  /* ---------------- Auto-sync polling ---------------- */

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

  /* ---------------- Live logs (SSE) ---------------- */

  useEffect(() => {
    const token = getAdminToken();
    const url = `/api/logs/live${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    try {
      const es = new EventSource(url);
      sseRef.current = es;

      es.onopen = () => {
        setLogsConnected(true);
        pushLog("🟢 Live logs connected");
      };

      es.onmessage = (evt) => {
        if (evt.data) pushLog(evt.data);
      };

      es.onerror = () => {
        setLogsConnected(false);
        pushLog("🔴 Live logs disconnected");
        try { es.close(); } catch {}
      };

      return () => {
        try { es.close(); } catch {}
      };
    } catch {
      setLogsConnected(false);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, []);

  /* ---------------- Views ---------------- */

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-title">Dashboard</div>
          <div className="mini">Auto-sync · Profit · Fulfillment</div>
        </div>

        <div className="nav">
          <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
            Overview
          </button>
          <button className={tab === "import" ? "active" : ""} onClick={() => setTab("import")}>
            Import & Sync
          </button>
          <button className={tab === "fulfillment" ? "active" : ""} onClick={() => setTab("fulfillment")}>
            Fulfillment
          </button>
        </div>

        <div className="side-footer">
          <TokenBox onSaved={() => pushLog("🔐 Token saved")} />
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h2>{tab === "fulfillment" ? "Fulfillment" : tab === "import" ? "Import & Sync" : "Overview"}</h2>
            <div className="mini">
              {logsConnected ? "Live logs online" : "Live logs offline"} · Auto-sync:{" "}
              {syncStatus?.enabled ? "enabled" : "disabled"}
            </div>
          </div>
          <button className="btn sm" onClick={refreshAll} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh All"}
          </button>
        </div>

        {tab === "fulfillment" && (
          <div className="section">
            <div className="section-header">
              <div>
                <h3>Fulfillment</h3>
                <div className="mini">Shopify → CJ → Delivered</div>
              </div>
            </div>

            <FulfillmentTable
              rows={fulfillment}
              onRetry={retryFulfillment}
            />
          </div>
        )}
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
        onClick={() => {
          localStorage.setItem("ADMIN_TOKEN", val.trim());
          onSaved?.();
          window.location.reload();
        }}
      >
        Save
      </button>
    </div>
  );
}


