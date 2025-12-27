// src/workers/autoSyncRunner.js
import { syncAllVariants } from "./syncWorker.js";

const INTERVAL_MS = 30 * 60 * 1000;

/**
 * Shared in-memory auto-sync status
 * Safe for single Railway container
 */
const autoSyncState = {
  enabled: true,
  running: false,
  lastRunAt: null,
  nextRunAt: null,
  lastResult: "unknown", // success | error | unknown
  lastSuccessAt: null,
  lastError: null,
};

let intervalStarted = false;

/**
 * Start the auto-sync scheduler
 */
export function startAutoSync() {
  // Prevent duplicate intervals (Railway hot reload safe)
  if (intervalStarted) return;
  intervalStarted = true;

  console.log("⏱ Auto-sync every 30 minutes");

  const runSync = async () => {
    if (autoSyncState.running) return;

    autoSyncState.running = true;
    autoSyncState.lastRunAt = new Date();
    autoSyncState.lastError = null;
    autoSyncState.lastResult = "unknown";

    console.log("🔄 Auto-sync started");

    try {
      await syncAllVariants();
      autoSyncState.lastSuccessAt = new Date();
      autoSyncState.lastResult = "success";
    } catch (err) {
      console.error("❌ Auto-sync failed:", err);
      autoSyncState.lastError = err?.message || "Unknown error";
      autoSyncState.lastResult = "error";
    } finally {
      autoSyncState.running = false;
      autoSyncState.nextRunAt = new Date(Date.now() + INTERVAL_MS);
    }
  };

  // Run immediately on boot
  runSync();

  // Schedule future runs
  autoSyncState.nextRunAt = new Date(Date.now() + INTERVAL_MS);
  setInterval(runSync, INTERVAL_MS);
}

/**
 * Public, immutable snapshot for dashboard
 */
export function getAutoSyncStatus() {
  return {
    enabled: autoSyncState.enabled,
    running: autoSyncState.running,
    lastRunAt: autoSyncState.lastRunAt,
    nextRunAt: autoSyncState.nextRunAt,
    lastResult: autoSyncState.lastResult,
    lastSuccessAt: autoSyncState.lastSuccessAt,
    lastError: autoSyncState.lastError,
  };
}



