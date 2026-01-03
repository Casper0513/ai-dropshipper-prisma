// src/workers/aliexpressTrackingWorker.js
import { prisma } from "../db/client.js";
import { pushLiveLog } from "../utils/liveLogs.js";

const CHECK_MINUTES = Number(
  process.env.ALIEXPRESS_TRACKING_MINUTES || "60"
);

const INTERVAL_MS = Math.max(15, CHECK_MINUTES) * 60 * 1000;

/**
 * AliExpress tracking worker
 *
 * Rules:
 * - AliExpress only
 * - ordered → shipped (after delay)
 * - shipped → delivered (after delay)
 * - NO external API calls (safe fallback logic)
 */
export function startAliExpressTrackingWorker() {
  pushLiveLog(
    `📦 AliExpress tracking worker every ${CHECK_MINUTES} minutes`
  );

  const tick = async () => {
    let orders = [];

    try {
      orders = await prisma.fulfillmentOrder.findMany({
        where: {
          supplier: "aliexpress",
          status: { in: ["ordered", "shipped"] },
        },
        orderBy: { updatedAt: "asc" },
        take: 20,
      });
    } catch (err) {
      pushLiveLog(`❌ AliExpress tracking fetch failed: ${err.message}`);
      return;
    }

    const now = Date.now();

    for (const fo of orders) {
      try {
        const ageMinutes =
          (now - new Date(fo.updatedAt).getTime()) / 60000;

        // 🟡 ordered → shipped (after ~12h)
        if (fo.status === "ordered" && ageMinutes >= 720) {
          await prisma.fulfillmentOrder.update({
            where: { id: fo.id },
            data: { status: "shipped" },
          });

          pushLiveLog(
            `🚚 [AliExpress] Marked shipped order=${fo.shopifyOrderId}`
          );
        }

        // 🟢 shipped → delivered (after ~7 days)
        if (fo.status === "shipped" && ageMinutes >= 10080) {
          await prisma.fulfillmentOrder.update({
            where: { id: fo.id },
            data: { status: "delivered" },
          });

          pushLiveLog(
            `📬 [AliExpress] Delivered order=${fo.shopifyOrderId}`
          );
        }
      } catch (err) {
        pushLiveLog(
          `❌ AliExpress tracking error order=${fo.shopifyOrderId}: ${err.message}`
        );
      }
    }
  };

  // ▶ Run immediately, then on interval
  tick();
  setInterval(tick, INTERVAL_MS);
}
