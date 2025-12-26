// src/workers/fulfillmentRetryWorker.js
import { prisma } from "../db/client.js";
import { createCjOrderFromFulfillmentOrder } from "../services/cjFulfillment.js";
import { pushLiveLog } from "../utils/liveLogs.js";

const RETRY_MINUTES = Number(process.env.CJ_RETRY_MINUTES || "15");
const INTERVAL_MS = Math.max(5, RETRY_MINUTES) * 60 * 1000;

/**
 * Retry failed / pending CJ fulfillment orders
 * - CJ only
 * - Safe + idempotent
 * - Designed for long-running servers
 */
export function startFulfillmentRetryWorker() {
  pushLiveLog(`🔁 CJ fulfillment retry every ${RETRY_MINUTES} minutes`);

  const tick = async () => {
    const candidates = await prisma.fulfillmentOrder.findMany({
      where: {
        supplier: "cj",
        status: {
          in: ["failed", "pending"],
        },
      },
      take: 20,
    });

    for (const fo of candidates) {
      try {
        pushLiveLog(
          `♻️ Retrying CJ fulfillment orderId=${fo.shopifyOrderId} (id=${fo.id})`
        );

        await createCjOrderFromFulfillmentOrder(fo.id);

        await prisma.fulfillmentOrder.update({
          where: { id: fo.id },
          data: {
            status: "ordered",
            lastError: null,
          },
        });

        pushLiveLog(
          `✅ CJ retry success orderId=${fo.shopifyOrderId}`
        );
      } catch (err) {
        const msg = err?.message || "Unknown error";

        await prisma.fulfillmentOrder.update({
          where: { id: fo.id },
          data: {
            status: "failed",
            lastError: msg.slice(0, 500),
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
