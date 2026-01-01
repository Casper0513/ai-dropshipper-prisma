// src/services/aliexpressFulfillment.js
import { prisma } from "../db/client.js";
import { pushLiveLog } from "../utils/liveLogs.js";

/**
 * AliExpress fallback fulfillment
 *
 * Current behavior:
 * - NO auto order
 * - Marks fulfillment as routed to AliExpress
 * - Preserves profit accounting
 * - Safe + idempotent
 */
export async function createAliExpressOrderFromFulfillmentOrder(
  fulfillmentOrderId
) {
  const fo = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
  });

  if (!fo) throw new Error("FulfillmentOrder not found");

  // 🔒 Never override completed orders
  if (["ordered", "shipped", "delivered"].includes(fo.status)) {
    return fo;
  }

  const meta = safeJson(fo.metaJson);

  pushLiveLog(
    `🟡 [AliExpress] Fallback for Shopify ${fo.shopifyOrderId}`
  );

  const updated = await prisma.fulfillmentOrder.update({
    where: { id: fo.id },
    data: {
      supplier: "aliexpress",
      status: "pending", // manual fulfillment
      metaJson: JSON.stringify({
        ...meta,
        fallbackFrom: "cj",
        fallbackTo: "aliexpress",
        fallbackAt: new Date().toISOString(),
        fulfillmentMode: "manual",
      }),
    },
  });

  return updated;
}

/**
 * Safe JSON helper
 */
function safeJson(s) {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
