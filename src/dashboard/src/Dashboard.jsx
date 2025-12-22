import "./Dashboard.css";
import React, { useEffect, useRef, useState } from "react";

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
  } catch {
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
  } catch {
    return null;
  }
}

function Badge({ children }) {
  return <span className="badge">{children}</span>;
}

function Pill({ children, tone = "neutral" }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

/* ---------------- Live Logs (SSE) ---------------- */

function LiveLogs({ lines, connected, onClear }) {
  return (
    <div className="card">
      <div className="row between">
        <div>
          <div className="card-title">Live Logs</div>
          <div className="mini">Server-Sent Events</div>
        </div>
        <div className="row gap">
          <Pill tone={connected ? "ok" : "bad"}>
            {connected ? "Connected" : "Offline"}
          </Pill>
          <button className="btn sm" type="button" onClick={onClear}>
            Clear
          </button>
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
  const [logsConnected, setLogsConnected] = useState(false);
  const esRef = useRef(null);

  const pushLog = (line) => {
    setLogLines((prev) => [
      ...prev.slice(-300),
      `${new Date().toLocaleTimeString()}  ${line}`,
    ]);
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

  /* ---------- Auto-sync polling ---------- */
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

  /* ---------- Live logs via SSE ---------- */
  useEffect(() => {
    const es = new EventSource("/api/logs/live");
    esRef.current = es;

    es.onopen = () => {
      setLogsConnected(true);
      pushLog("🟢 Live logs connected");
    };

    es.onmessage = (evt) => {
      pushLog(String(evt.data || ""));
    };

    es.onerror = () => {
      setLogsConnected(false);
      pushLog("🔴 Live logs disconnected");
      es.close();
    };

    return () => {
      es.close();
    };
  }, []);

  useEffect(() => {
    refreshAll();
  }, []);

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
          <TokenBox onSaved={() => pushLog("🔐 Token saved")} />
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h2>{tab === "overview" ? "Overview" : "Import & Sync"}</h2>
            <div className="mini">
              Live logs: {logsConnected ? "online" : "offline"} · Auto-sync:{" "}
              {syncStatus?.enabled ? "enabled" : "disabled"}
            </div>
          </div>
        </div>

        {tab === "overview" && (
          <>
            <div className="grid2">
              <LiveLogs
                lines={logLines}
                connected={logsConnected}
                onClear={() => setLogLines([])}
              />
            </div>
          </>
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
        type="button"
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
