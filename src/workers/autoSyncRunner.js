// src/workers/autoSyncRunner.js
import { syncAllVariants } from "./syncWorker.js";

export const autoSyncStatus = {
  running: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null
};

export function startAutoSync() {
  console.log("⏱ Auto-sync every 30 minutes");

  const runSync = async () => {
    if (autoSyncStatus.running) return;

    autoSyncStatus.running = true;
    autoSyncStatus.lastRunAt = new Date();
    autoSyncStatus.lastError = null;

    console.log("🔄 Auto-sync started");

    try {
      await syncAllVariants();
      autoSyncStatus.lastSuccessAt = new Date();
    } catch (err) {
      console.error("❌ Auto-sync failed:", err);
      autoSyncStatus.lastError = err.message;
    } finally {
      autoSyncStatus.running = false;
    }
  };

  // Run immediately on boot
  runSync();

  // Run every 30 minutes
  setInterval(runSync, 30 * 60 * 1000);
}
