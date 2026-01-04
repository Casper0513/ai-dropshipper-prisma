import { useEffect, useState } from "react";

const MAX_RETRIES = 3;

export default function FulfillmentTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      const res = await fetch("/api/fulfillment", {
        headers: { "Cache-Control": "no-store" },
      });
      const json = await res.json();
      setRows(json.rows || []);
    } catch (e) {
      console.error("Fulfillment load error", e);
    } finally {
      setLoading(false);
    }
  }

  async function action(id, type) {
    try {
      setBusyId(id);

      const res = await fetch(`/api/fulfillment/${id}/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Action failed");
      }

      await load();
    } catch (e) {
      console.error(`Action ${type} failed`, e);
      alert(e.message);
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
    <div className="tableWrap">
      <table>
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
          {rows.map((r) => {
            const retryCount = r.retryCount || 0;

            // ----------------------------
            // 🔒 UI guardrails (DERIVED)
            // ----------------------------
            const isTerminal = r.status === "delivered";
            const isFallback =
              r.supplier === "aliexpress" &&
              retryCount >= MAX_RETRIES;

            const canRetry =
              r.supplier === "cj" &&
              r.status === "failed" &&
              retryCount < MAX_RETRIES &&
              !isTerminal;

            const canMarkOrdered =
              r.status === "pending" &&
              !isTerminal;

            const canMarkDelivered =
              (r.status === "ordered" || r.status === "shipped") &&
              !isTerminal;

            return (
              <tr key={r.id}>
                <td className="mono">{r.shopifyOrderId}</td>

                <td>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span>{r.supplier}</span>

                    {isFallback && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 6px",
                          borderRadius: 6,
                          background: "#fde68a",
                          fontWeight: 600,
                        }}
                        title="CJ retries exhausted → AliExpress fallback"
                      >
                        Fallback
                      </span>
                    )}
                  </div>
                </td>

                <td>
                  <StatusBadge status={r.status} />
                </td>

                <td>{r.cjTrackingNumber || "—"}</td>

                <td>
                  {typeof r.profit === "number"
                    ? `$${r.profit.toFixed(2)}`
                    : "—"}
                </td>

                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    {/* 🔁 Retry (CJ only, backend-enforced) */}
                    {canRetry && (
                      <button
                        className="btn sm"
                        disabled={busyId === r.id}
                        title={
                          r.lastRetryError
                            ? `Last error: ${r.lastRetryError}`
                            : "Retry CJ fulfillment"
                        }
                        onClick={() => action(r.id, "retry")}
                      >
                        🔁 Retry ({retryCount}/{MAX_RETRIES})
                      </button>
                    )}

                    {/* ✅ Mark Ordered */}
                    {canMarkOrdered && (
                      <button
                        className="btn sm"
                        disabled={busyId === r.id}
                        onClick={() => action(r.id, "mark-ordered")}
                      >
                        ✅ Ordered
                      </button>
                    )}

                    {/* 📦 Mark Delivered */}
                    {canMarkDelivered && (
                      <button
                        className="btn sm"
                        disabled={busyId === r.id}
                        onClick={() => action(r.id, "mark-delivered")}
                      >
                        📦 Delivered
                      </button>
                    )}
                  </div>
                </td>

                <td className="mini">
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







