// src/workers/aliexpressFulfillmentWorker.js
import { prisma } from "../db/client.js";
import { pushLiveLog } from "../utils/liveLogs.js";

const INTERVAL_MINUTES = Number(
  process.env.ALIEXPRESS_WORKER_MINUTES || "10"
);

const INTERVAL_MS = Math.max(5, INTERVAL_MINUTES) * 60 * 1000;

/**
 * AliExpress fulfillment worker
 *
 * Responsibilities:
 * - Picks up pending AliExpress fallback orders
 * - Marks them as ordered (manual or future automation)
 * - Assigns tracking number (placeholder)
 * - Guarded against duplicates & terminal states
 */
export function startAliExpressFulfillmentWorker() {
  pushLiveLog(
    `🛒 AliExpress fulfillment worker running every ${INTERVAL_MINUTES} minutes`
  );

  const tick = async () => {
    let rows = [];

    try {
      rows = await prisma.fulfillmentOrder.findMany({
        where: {
          supplier: "aliexpress",
          status: "pending",
        },
        take: 20,
        orderBy: { createdAt: "asc" },
      });
    } catch (err) {
      pushLiveLog(`❌ AliExpress fetch failed: ${err.message}`);
      return;
    }

    for (const fo of rows) {
      const meta = safeJson(fo.metaJson);

      // --------------------------------------------------
      // 🛑 TERMINAL STATE GUARD
      // --------------------------------------------------
      if (["delivered", "cancelled", "returned"].includes(fo.status)) {
        continue;
      }

      // --------------------------------------------------
      // 🛑 FALLBACK GUARD (must be CJ → AliExpress)
      // --------------------------------------------------
      if (meta.fallback?.provider !== "aliexpress") {
        continue;
      }

      // --------------------------------------------------
      // 🔒 LOCK GUARD
      // --------------------------------------------------
      if (meta._aeLock === true) {
        continue;
      }

      // Acquire lock
      await prisma.fulfillmentOrder.update({
        where: { id: fo.id },
        data: {
          metaJson: JSON.stringify({
            ...meta,
            _aeLock: true,
            _aeLockAt: new Date().toISOString(),
          }),
        },
      });

      try {
        pushLiveLog(
          `🛒 [AliExpress] Claiming fulfillment order=${fo.shopifyOrderId}`
        );

        // --------------------------------------------------
        // ✅ MARK ORDERED (IDEMPOTENT)
        // --------------------------------------------------
        await prisma.fulfillmentOrder.update({
          where: { id: fo.id },
          data: {
            status: "ordered",
          },
        });

        pushLiveLog(
          `✅ [AliExpress] Marked ordered order=${fo.shopifyOrderId}`
        );

        // --------------------------------------------------
        // 🚚 ASSIGN TRACKING + SHIP
        // --------------------------------------------------
        const trackingNumber =
          "AE-" + Math.random().toString(36).substring(2, 12).toUpperCase();

        await prisma.fulfillmentOrder.update({
          where: { id: fo.id },
          data: {
            status: "shipped",
            cjTrackingNumber: trackingNumber, // reused column intentionally
          },
        });

        pushLiveLog(
          `🚚 [AliExpress] Shipped order=${fo.shopifyOrderId} tracking=${trackingNumber}`
        );
      } catch (err) {
        pushLiveLog(
          `❌ [AliExpress] Failed order=${fo.shopifyOrderId}: ${err.message}`
        );
      } finally {
        // --------------------------------------------------
        // 🔓 RELEASE LOCK
        // --------------------------------------------------
        const latest = await prisma.fulfillmentOrder.findUnique({
          where: { id: fo.id },
        });

        const latestMeta = safeJson(latest?.metaJson);

        if (latestMeta._aeLock) {
          delete latestMeta._aeLock;
          delete latestMeta._aeLockAt;

          await prisma.fulfillmentOrder.update({
            where: { id: fo.id },
            data: {
              metaJson: JSON.stringify(latestMeta),
            },
          });
        }
      }
    }
  };

  // ▶ Run immediately + interval
  tick();
  setInterval(tick, INTERVAL_MS);
}

/**
 * Safe JSON parse helper
 */
function safeJson(s) {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}


