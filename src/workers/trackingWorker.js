// src/workers/trackingWorker.js
import { prisma } from "../db/client.js";
import { cjGetTracking } from "../services/cjClient.js";
import { createShopifyFulfillment } from "../services/shopifyFulfillment.js";
import { pushLiveLog } from "../utils/liveLogs.js";

/**
 * Poll CJ tracking and push updates to Shopify
 * Safe to run on interval
 */
export async function syncCJTracking() {
  pushLiveLog("📦 Tracking sync started");

  // Only orders that have CJ tracking but are not completed
  const orders = await prisma.fulfillmentOrder.findMany({
    where: {
      supplier: "cj",
      cjTrackingNumber: { not: null },
      status: {
        notIn: ["delivered", "failed"],
      },
    },
  });

  for (const order of orders) {
    try {
      const tracking = await cjGetTracking(order.cjTrackingNumber);

      const events = tracking?.trackingList || [];
      if (!events.length) continue;

      const latest = events[events.length - 1];
      const statusText = latest?.status || "";

      let newStatus = order.status;

      if (/delivered/i.test(statusText)) newStatus = "delivered";
      else if (/shipped|in transit/i.test(statusText)) newStatus = "shipped";

      // Only update if status changed
      if (newStatus !== order.status) {
        pushLiveLog(
          `🚚 CJ update ${order.cjTrackingNumber}: ${order.status} → ${newStatus}`
        );

        await prisma.fulfillmentOrder.update({
          where: { id: order.id },
          data: {
            status: newStatus,
            updatedAt: new Date(),
          },
        });
      }

      // Create Shopify fulfillment once shipped
      if (newStatus === "shipped" && !order.shopifyFulfillmentId) {
        const fulfillment = await createShopifyFulfillment({
          orderId: order.shopifyOrderId,
          trackingNumber: order.cjTrackingNumber,
          trackingUrl: latest?.trackingUrl || null,
          carrier: "CJ Dropshipping",
        });

        if (fulfillment) {
          await prisma.fulfillmentOrder.update({
            where: { id: order.id },
            data: {
              shopifyFulfillmentId: String(fulfillment.id),
            },
          });

          pushLiveLog(
            `📨 Shopify fulfillment created for order ${order.shopifyOrderId}`
          );
        }
      }
    } catch (err) {
      pushLiveLog(
        `❌ Tracking error ${order.cjTrackingNumber}: ${err.message}`
      );
    }
  }

  pushLiveLog("✅ Tracking sync complete");
}

/**
 * Interval runner
 */
export function startTrackingWorker() {
  // Run every 15 minutes
  syncCJTracking().catch(console.error);
  setInterval(syncCJTracking, 15 * 60 * 1000);
}
