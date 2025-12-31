// src/components/FulfillmentTable.jsx
export default function FulfillmentTable({
  rows = [],
  loading = false,
  onRetry,
}) {
  if (loading) {
    return <p className="mini">Loading fulfillment…</p>;
  }

  if (!rows.length) {
    return (
      <div className="empty-state">
        No fulfillment orders yet.
      </div>
    );
  }

  return (
    <div className="tableWrap">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Order</th>
            <th>Supplier</th>
            <th>Status</th>
            <th>Tracking</th>
            <th>Action</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => {
            const retryable =
              r.supplier === "cj" &&
              (r.status === "failed" || r.status === "pending") &&
              !r.cjOrderId;

            return (
              <tr key={r.id}>
                <td className="mono">{r.shopifyOrderId}</td>

                <td>
                  <Pill>{r.supplier}</Pill>
                </td>

                <td>
                  <StatusBadge status={r.status} />
                </td>

                <td className="mono">
                  {r.cjTrackingNumber || "—"}
                </td>

                <td>
                  {retryable ? (
                    <button
                      className="btn sm"
                      onClick={() => onRetry?.(r.id)}
                    >
                      Retry
                    </button>
                  ) : (
                    "—"
                  )}
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

/* ---------- Helpers ---------- */

function Pill({ children }) {
  return (
    <span className="pill neutral">
      {children}
    </span>
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

