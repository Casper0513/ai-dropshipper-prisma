// src/utils/liveLogs.js

let clients = [];

/**
 * Attach SSE endpoint to Express app
 */
export function attachLiveLogs(app) {
  app.get("/api/logs/live", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const clientId = Date.now();
    const client = { id: clientId, res };
    clients.push(client);

    // Initial message
    res.write(`data: 🟢 Connected to live logs\n\n`);

    req.on("close", () => {
      clients = clients.filter((c) => c.id !== clientId);
    });
  });
}

/**
 * Push a log line to all connected clients
 */
export function pushLiveLog(message) {
  const line =
    typeof message === "string"
      ? message
      : JSON.stringify(message);

  for (const c of clients) {
    try {
      c.res.write(`data: ${line}\n\n`);
    } catch {
      // Drop broken connections silently
    }
  }
}


/**
 * Push a log line to all connected clients
 */
export function pushLiveLog(message) {
  const line =
    typeof message === "string" ? message : JSON.stringify(message);

  for (const client of clients) {
    client.res.write(`data: ${line}\n\n`);
  }
}
