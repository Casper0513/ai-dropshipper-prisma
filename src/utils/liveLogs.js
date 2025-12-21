// src/utils/liveLogs.js
let listeners = [];
let buffer = [];

export function pushLog(message) {
  const entry = {
    ts: new Date().toISOString(),
    message
  };

  buffer.push(entry);
  buffer = buffer.slice(-200); // keep last 200 logs

  listeners.forEach(res => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  });
}

export function attachListener(res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  buffer.forEach(entry => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  });

  listeners.push(res);

  res.on("close", () => {
    listeners = listeners.filter(l => l !== res);
  });
}

