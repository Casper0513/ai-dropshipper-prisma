// src/workers/fulfillmentRetryWorker.js
import { prisma } from "../db/client.js";
import { createCjOrderFromFulfillmentOrder } from "../services/cjFulfillment.js";
import { pushLiveLog } from "../utils/liveLogs.js";

const RETRY_MINUTES = Number(process.env.CJ_RETRY_MINUTES || "15");
const INTERVAL_MS = Math.max(5, RETRY_MINUTES) * 60 * 1000;

/**
 * Retry failed / pending CJ fulfillment orders
 * - CJ only
 * - Idempotent (never duplicates CJ orders)
 * - Safe for long-running servers
 */
export function startFulfillmentRetryWorker() {
  pushLiveLog(`🔁 CJ fulfillment retry every ${RETRY_MINUTES} minutes`);

  const tick = async () => {
    const candidates = await prisma.fulfillmentOrder.findMany({
      where: {
        supplier: "cj",
        status: { in: ["pending", "failed"] },
        cjOrderId: null, // ✅ NEVER retry if already created
      },
      take: 20,
      orderBy: { createdAt: "asc" },
    });

    for (const fo of candidates) {
      try {
        pushLiveLog(
          `♻️ Retrying CJ fulfillment orderId=${fo.shopifyOrderId} (id=${fo.id})`
        );

        await createCjOrderFromFulfillmentOrder(fo.id);

        // Status will be updated inside createCjOrderFromFulfillmentOrder
        pushLiveLog(
          `✅ CJ retry success orderId=${fo.shopifyOrderId}`
        );
      } catch (err) {
        const msg = err?.message || "Unknown error";

        // ⚠️ No lastError column — store error in metaJson instead
        await prisma.fulfillmentOrder.update({
          where: { id: fo.id },
          data: {
            status: "failed",
            metaJson: JSON.stringify({
              ...(fo.metaJson ? safeJson(fo.metaJson) : {}),
              lastRetryError: msg.slice(0, 500),
              lastRetryAt: new Date().toISOString(),
            }),
          },
        });

        pushLiveLog(
          `❌ CJ retry failed orderId=${fo.shopifyOrderId}: ${msg}`
        );
      }
    }
  };

  // Run immediately, then on interval
  tick();
  setInterval(tick, INTERVAL_MS);
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

