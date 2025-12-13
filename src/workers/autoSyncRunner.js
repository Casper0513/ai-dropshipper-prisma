import { syncAllVariants } from "./syncWorker.js";

const ENABLE_AUTO_SYNC = process.env.ENABLE_AUTO_SYNC === "true";
const INTERVAL_MINUTES = Number(process.env.AUTO_SYNC_INTERVAL || 30);

let running = false;

async function runSync() {
  if (!ENABLE_AUTO_SYNC) {
    console.log("⏸ Auto-sync disabled");
    return;
  }

  if (running) {
    console.log("⏭ Sync already running, skipping");
    return;
  }

  running = true;
  console.log("🔄 Auto-sync started");

  try {
    await syncAllVariants();
    console.log("✅ Auto-sync finished");
  } catch (err) {
    console.error("❌ Auto-sync failed:", err);
  } finally {
    running = false;
  }
}

export function startAutoSync() {
  console.log(`⏱ Auto-sync every ${INTERVAL_MINUTES} minutes`);

  // Run once shortly after boot
  setTimeout(runSync, 15_000);

  // Run repeatedly
  setInterval(runSync, INTERVAL_MINUTES * 60 * 1000);
}
