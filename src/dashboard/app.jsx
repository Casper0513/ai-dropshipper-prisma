import "./dashboard.css";

/* ===============================
   DASHBOARD APP (MAIN COMPONENT)
================================ */

function DashboardApp() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>
          DropBopp
          <br />
          <small>AI Dropshipping Console</small>
        </h1>

        <div className="nav">
          <button className="active">Overview</button>
          <button>Import & Sync</button>
        </div>

        <div className="sidebar-footer">
          <div>Auto-sync system</div>
          <div>Profit dashboard</div>
          <div>Multi-source reliability</div>
        </div>
      </aside>

      <main className="main">
        <div className="top-row">
          <h2>Overview</h2>
          <span className="badge">Live</span>
        </div>

        <div className="cards">
          <div className="card">
            <div className="card-title">Products Imported</div>
            <div className="card-main">0</div>
          </div>

          <div className="card">
            <div className="card-title">Import Runs</div>
            <div className="card-main">0</div>
          </div>

          <div className="card">
            <div className="card-title">Estimated Profit</div>
            <div className="card-main profit-positive">$0.00</div>
          </div>
        </div>

        <div className="section">
          <h3>Status</h3>
          <div className="empty-state">
            Dashboard UI loaded successfully 🎉
          </div>
        </div>
      </main>
    </div>
  );
}

/* ===============================
   EXPORT
================================ */

export default function App() {
  return <DashboardApp />;
}


