// src/utils/liveLogs.js

/**
 * In-memory SSE clients
 * NOTE: This is process-local (fine for Railway single instance)
 */
const clients = new Set();

/**
 * Attach SSE endpoint to Express app
 * Endpoint: GET /api/logs/live
 */
export function attachLiveLogs(app) {
  app.get("/api/logs/live", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Register client
    clients.add(res);

    // Initial ping
    res.write(`data: 🟢 Live logs connected\n\n`);

    // Cleanup on disconnect
    req.on("close", () => {
      clients.delete(res);
    });
  });
}

/**
 * Push a log line to all connected clients
 * Safe, idempotent, never throws
 */
export function pushLiveLog(message) {
  if (!clients.size) return;

  const line =
    typeof message === "string"
      ? message
      : JSON.stringify(message);

  for (const res of clients) {
    try {
      res.write(`data: ${line}\n\n`);
    } catch {
      clients.delete(res);
    }
  }
}


