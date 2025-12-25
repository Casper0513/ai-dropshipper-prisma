// src/workers/trackingSyncWorker.js
import { prisma } from "../db/client.js";
import { cjGetTracking } from "../services/cjClient.js";
import { shopifyGetFulfillmentOrders, shopifyCreateFulfillment } from "../services/shopifyFulfillment.js";
import { pushLiveLog } from "../utils/liveLogs.js";

/**
 * Poll CJ tracking numbers and push to Shopify.
 * - Runs every N minutes
 * - Looks for FulfillmentOrder rows where supplier=cj and status in (ordered, shipped)
 */
export function startTrackingSyncWorker() {
  const mins = Number(process.env.TRACKING_SYNC_MINUTES || "10");
  const intervalMs = Math.max(2, mins) * 60 * 1000;

  pushLiveLog(`📡 Tracking sync every ${mins} minutes`);

  const tick = async () => {
    const rows = await prisma.fulfillmentOrder.findMany({
      where: {
        supplier: "cj",
        cjTrackingNumber: { not: null },
        status: { in: ["ordered", "shipped"] },
      },
      take: 50,
    });

    for (const fo of rows) {
      try {
        const trackNo = fo.cjTrackingNumber;
        const resp = await cjGetTracking(trackNo);

        const data = resp?.data?.[0] || resp?.data || null;
        const statusText = data?.trackingStatus || data?.status || "";

        // If already delivered, mark delivered
        const delivered = String(statusText).toLowerCase().includes("delivered");

        // Push tracking into Shopify if we haven't yet
        if (!fo.shopifyFulfillmentSent) {
          const fulfillmentOrders = await shopifyGetFulfillmentOrders(fo.shopifyOrderId);
          const first = fulfillmentOrders?.[0];

          if (first?.id) {
            await shopifyCreateFulfillment(first.id, {
              number: trackNo,
              company: data?.lastMileCarrier || "CJ",
              url: undefined,
            });

            await prisma.fulfillmentOrder.update({
              where: { id: fo.id },
              data: { shopifyFulfillmentSent: true, status: delivered ? "delivered" : "shipped" },
            });

            pushLiveLog(`🚚 Tracking pushed to Shopify order=${fo.shopifyOrderId} track=${trackNo}`);
          }
        } else if (delivered && fo.status !== "delivered") {
          await prisma.fulfillmentOrder.update({
            where: { id: fo.id },
            data: { status: "delivered" },
          });
          pushLiveLog(`📦 Delivered order=${fo.shopifyOrderId} track=${trackNo}`);
        }
      } catch (e) {
        pushLiveLog(`⚠️ Tracking sync error order=${fo.shopifyOrderId}: ${e.message}`);
      }
    }
  };

  tick();
  setInterval(tick, intervalMs);
}
