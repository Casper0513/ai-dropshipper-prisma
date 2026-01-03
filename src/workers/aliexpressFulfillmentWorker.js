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
 * - Never touches CJ orders
 * - Never duplicates fulfillment
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
      try {
        pushLiveLog(
          `🛒 [AliExpress] Claiming fulfillment order=${fo.shopifyOrderId}`
        );

        // 🔒 Mark as ordered (manual fulfillment for now)
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
        // ➕ ADD: Assign tracking number + mark shipped
        // --------------------------------------------------
        const trackingNumber =
          "AE-" + Math.random().toString(36).substring(2, 12).toUpperCase();

        await prisma.fulfillmentOrder.update({
          where: { id: fo.id },
          data: {
            status: "shipped",
            cjTrackingNumber: trackingNumber, // reused column (intentional)
          },
        });

        pushLiveLog(
          `🚚 [AliExpress] Shipped order=${fo.shopifyOrderId} tracking=${trackingNumber}`
        );
      } catch (err) {
        pushLiveLog(
          `❌ [AliExpress] Failed order=${fo.shopifyOrderId}: ${err.message}`
        );
      }
    }
  };

  // ▶ Run immediately + interval
  tick();
  setInterval(tick, INTERVAL_MS);
}

