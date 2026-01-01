import { useEffect, useState } from "react";

export default function FulfillmentTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const res = await fetch("/api/fulfillment", { cache: "no-store" });
      const json = await res.json();
      setRows(json.rows || []);
    } catch (e) {
      console.error("Fulfillment load error", e);
    } finally {
      setLoading(false);
    }
  }

  async function retry(id) {
    setBusyId(id);
    try {
      await fetch(`/api/fulfillment/${id}/retry`, { method: "POST" });
      await load();
    } catch (e) {
      alert("Retry failed");
    } finally {
      setBusyId(null);
    }
  }

  async function markDelivered(id) {
    if (!confirm("Mark this order as delivered?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/fulfillment/${id}/mark-delivered`, {
        method: "POST",
      });
      await load();
    } catch (e) {
      alert("Failed to mark delivered");
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <p>Loading fulfillment…</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3>📦 Fulfillment</h3>
        <button className="btn sm" onClick={load}>
          Refresh
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Order</th>
            <th>Supplier</th>
            <th>Status</th>
            <th>Tracking</th>
            <th>Profit</th>
            <th>Actions</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.shopifyOrderId}</td>
              <td>{r.supplier}</td>

              <td>
                <StatusBadge status={r.status} />
              </td>

              <td>{r.cjTrackingNumber || "—"}</td>

              <td>
                {typeof r.profit === "number"
                  ? `$${r.profit.toFixed(2)}`
                  : "—"}
              </td>

              <td style={{ display: "flex", gap: 6 }}>
                {r.supplier === "cj" &&
                  (r.status === "failed" || r.status === "pending") && (
                    <button
                      className="btn sm"
                      disabled={busyId === r.id}
                      onClick={() => retry(r.id)}
                    >
                      Retry
                    </button>
                  )}

                {r.status !== "delivered" && (
                  <button
                    className="btn sm"
                    disabled={busyId === r.id}
                    onClick={() => markDelivered(r.id)}
                  >
                    Delivered
                  </button>
                )}
              </td>

              <td>{new Date(r.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Status Badge ---------------- */

function StatusBadge({ status }) {
  const colors = {
    pending: "#fde047",
    ordered: "#7dd3fc",
    shipped: "#4ade80",
    delivered: "#16a34a",
    failed: "#ef4444",
  };

  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 6,
        background: colors[status] || "#999",
        color: "#000",
        fontWeight: 600,
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}



