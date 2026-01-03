// src/services/fulfillmentApi.js
import { prisma } from "../db/client.js";

/**
 * Safely parse metaJson
 */
function safeJson(s) {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

/**
 * Get recent fulfillment orders for dashboard
 */
export async function listFulfillmentOrders({ limit = 50 } = {}) {
  const rows = await prisma.fulfillmentOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((fo) => {
    const meta = safeJson(fo.metaJson);

    return {
      id: fo.id,
      shopifyOrderId: fo.shopifyOrderId,
      shopifyLineItemId: fo.shopifyLineItemId,

      supplier: fo.supplier,
      status: fo.status,

      cjOrderId: fo.cjOrderId,
      cjTrackingNumber: fo.cjTrackingNumber,
      shopifyFulfillmentSent: fo.shopifyFulfillmentSent,

      // 💰 PROFIT DATA
      salePrice: fo.salePrice,
      supplierCost: fo.supplierCost,
      shippingCost: fo.shippingCost,
      profit: fo.profit,

      // 🔁 RETRY METADATA (from metaJson)
      retryCount: meta.retryCount || 0,
      lastRetryError: meta.lastRetryError || null,
      lastRetryAt: meta.lastRetryAt || null,

      createdAt: fo.createdAt,
      updatedAt: fo.updatedAt,
    };
  });
}

/**
 * Get single fulfillment order
 */
export async function getFulfillmentOrder(id) {
  const fo = await prisma.fulfillmentOrder.findUnique({
    where: { id: Number(id) },
  });

  if (!fo) return null;

  const meta = safeJson(fo.metaJson);

  return {
    ...fo,
    retryCount: meta.retryCount || 0,
    lastRetryError: meta.lastRetryError || null,
    lastRetryAt: meta.lastRetryAt || null,
  };
}

