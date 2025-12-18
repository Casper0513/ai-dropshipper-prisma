import { syncAllVariants } from "./syncWorker.js";

export const autoSyncStatus = {
  running: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
};

export function startAutoSync() {
  console.log("⏱ Auto-sync every 30 minutes");

  const runSync = async () => {
    console.log("🔄 Auto-sync started");
    autoSyncStatus.running = true;
    autoSyncStatus.lastRunAt = new Date();

    try {
      await syncAllVariants();
      autoSyncStatus.lastSuccessAt = new Date();
      autoSyncStatus.lastError = null;
      console.log("✅ Auto-sync completed");
    } catch (err) {
      autoSyncStatus.lastError = err.message;
      console.error("❌ Auto-sync failed:", err);
    } finally {
      autoSyncStatus.running = false;
    }
  };

  runSync(); // initial run
  setInterval(runSync, 30 * 60 * 1000);
}