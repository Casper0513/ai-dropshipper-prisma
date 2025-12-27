import { useEffect, useState } from "react";

export default function FulfillmentTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/fulfillment");
      const json = await res.json();
      setRows(json.rows || []);
    } catch (e) {
      console.error("Fulfillment load error", e);
    } finally {
      setLoading(false);
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
      <h2>📦 Fulfillment</h2>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Order</th>
            <th>Supplier</th>
            <th>Status</th>
            <th>Tracking</th>
            <th>Retry</th>
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
              <td>
                {r.cjTrackingNumber || "—"}
              </td>
              <td>
                {r.lastError ? "❌" : "—"}
              </td>
              <td>
                {new Date(r.createdAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    pending: "#facc15",
    ordered: "#38bdf8",
    shipped: "#22c55e",
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
      }}
    >
      {status}
    </span>
  );
}
