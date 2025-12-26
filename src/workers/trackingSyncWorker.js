// src/workers/trackingSyncWorker.js
import { prisma } from "../db/client.js";
import { cjGetTracking } from "../services/cjClient.js";
import { createShopifyFulfillment } from "../services/shopifyFulfillment.js";
import { pushLiveLog } from "../utils/liveLogs.js";

/**
 * Poll CJ tracking numbers and sync into Shopify
 * - SAFE: never double-fulfills
 * - Uses Shopify Order ID directly
 */
export function startTrackingSyncWorker() {
  const mins = Number(process.env.TRACKING_SYNC_MINUTES || "10");
  const intervalMs = Math.max(2, mins) * 60 * 1000;

  pushLiveLog(`📡 Tracking sync every ${mins} minutes`);

  const tick = async () => {
    const orders = await prisma.fulfillmentOrder.findMany({
      where: {
        supplier: "cj",
        cjTrackingNumber: { not: null },
        status: { in: ["ordered", "shipped"] },
      },
      take: 50,
    });

    for (const fo of orders) {
      try {
        const trackNo = fo.cjTrackingNumber;

        const resp = await cjGetTracking(trackNo);
        const info =
          resp?.data?.[0] ||
          resp?.data ||
          {};

        const statusText = String(
          info.trackingStatus || info.status || ""
        ).toLowerCase();

        const delivered =
          statusText.includes("delivered") ||
          statusText.includes("signed");

        // 🚚 Push tracking to Shopify ONCE
        if (!fo.shopifyFulfilled) {
          const fulfillment = await createShopifyFulfillment({
            orderId: fo.shopifyOrderId,
            trackingNumber: trackNo,
            trackingUrl: info.trackingUrl || undefined,
            carrier: info.lastMileCarrier || "CJ Dropshipping",
          });

          if (fulfillment) {
            await prisma.fulfillmentOrder.update({
              where: { id: fo.id },
              data: {
                shopifyFulfilled: true,
                status: delivered ? "delivered" : "shipped",
              },
            });

            pushLiveLog(
              `🚚 [CJ] Tracking pushed to Shopify order=${fo.shopifyOrderId} track=${trackNo}`
            );
          }
        } else if (delivered && fo.status !== "delivered") {
          await prisma.fulfillmentOrder.update({
            where: { id: fo.id },
            data: { status: "delivered" },
          });

          pushLiveLog(
            `📦 [CJ] Delivered Shopify order=${fo.shopifyOrderId}`
          );
        }
      } catch (err) {
        pushLiveLog(
          `⚠️ Tracking sync failed order=${fo.shopifyOrderId}: ${err.message}`
        );
      }
    }
  };

  tick();
  setInterval(tick, intervalMs);
}

