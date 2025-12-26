// src/workers/autoSyncRunner.js
import { syncAllVariants } from "./syncWorker.js";

const INTERVAL_MS = 30 * 60 * 1000;

/**
 * Shared in-memory status
 * (safe for single Railway container)
 */
export const autoSyncStatus = {
  enabled: true,
  running: false,
  lastRunAt: null,
  nextRunAt: null,
  lastResult: "unknown", // success | error | unknown
  lastSuccessAt: null,
  lastError: null,
};

let intervalStarted = false;

export function startAutoSync() {
  // 🛑 Prevent double intervals on hot reload / Railway restart
  if (intervalStarted) return;
  intervalStarted = true;

  console.log("⏱ Auto-sync every 30 minutes");

  const runSync = async () => {
    if (autoSyncStatus.running) return;

    autoSyncStatus.running = true;
    autoSyncStatus.lastRunAt = new Date();
    autoSyncStatus.lastError = null;
    autoSyncStatus.lastResult = "unknown";

    console.log("🔄 Auto-sync started");

    try {
      await syncAllVariants();
      autoSyncStatus.lastSuccessAt = new Date();
      autoSyncStatus.lastResult = "success";
    } catch (err) {
      console.error("❌ Auto-sync failed:", err);
      autoSyncStatus.lastError = err?.message || "Unknown error";
      autoSyncStatus.lastResult = "error";
    } finally {
      autoSyncStatus.running = false;
      autoSyncStatus.nextRunAt = new Date(Date.now() + INTERVAL_MS);
    }
  };

  // ▶ Run once on boot
  runSync();

  // ⏲ Schedule future runs
  autoSyncStatus.nextRunAt = new Date(Date.now() + INTERVAL_MS);
  setInterval(runSync, INTERVAL_MS);
}

/**
 * Dashboard-safe status getter
 * (never expose internals directly)
 */
export function getAutoSyncStatus() {
  return {
    enabled: autoSyncStatus.enabled,
    running: autoSyncStatus.running,
    lastRunAt: autoSyncStatus.lastRunAt,
    nextRunAt: autoSyncStatus.nextRunAt,
    lastResult: autoSyncStatus.lastResult,
  };
}


