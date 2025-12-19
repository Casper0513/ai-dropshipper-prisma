export const liveLogs = [];

export function pushLog(message) {
  const entry = {
    message,
    time: new Date().toISOString(),
  };

  liveLogs.push(entry);

  // keep last 200 logs only
  if (liveLogs.length > 200) {
    liveLogs.shift();
  }

  console.log(message);
}
