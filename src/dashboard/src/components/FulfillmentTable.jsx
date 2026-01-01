// src/components/FulfillmentTable.jsx
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
    <div className="tableWrap">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Order</th>
            <th>Supplier</th>
            <th>Status</th>
            <th>Sale</th>
            <th>Cost</th>
            <th>Profit</th>
            <th>Margin</th>
            <th>Tracking</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => {
            const sale = r.salePrice ?? null;
            const cost = r.supplierCost ?? null;
            const profit =
              sale !== null && cost !== null ? sale - cost : null;
            const margin =
              profit !== null && sale
                ? (profit / sale) * 100
                : null;

            return (
              <tr key={r.id}>
                <td className="mono">{r.shopifyOrderId}</td>

                <td>{r.supplier}</td>

                <td>
                  <StatusBadge status={r.status} />
                </td>

                <td>{sale !== null ? `$${sale.toFixed(2)}` : "—"}</td>

                <td>{cost !== null ? `$${cost.toFixed(2)}` : "—"}</td>

                <td>
                  {profit !== null ? (
                    <span
                      style={{
                        color: profit >= 0 ? "#16a34a" : "#dc2626",
                        fontWeight: 600,
                      }}
                    >
                      ${profit.toFixed(2)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>

                <td>
                  {margin !== null ? (
                    <span
                      style={{
                        color: margin >= 0 ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {margin.toFixed(1)}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>

                <td>{r.cjTrackingNumber || "—"}</td>

                <td>
                  {new Date(r.createdAt).toLocaleString()}
                </td>
              </tr>
            );
          })}
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
        textTransform: "capitalize",
      }}
    >
      {status}
    </span>
  );
}


