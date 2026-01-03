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
    const retryCount = Number(meta.retryCount || 0);
    const fallbackProvider = meta.fallback?.provider || null;

    const isCj = fo.supplier === "cj";
    const isFallback = Boolean(fallbackProvider);

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

      // 🔁 RETRY / FALLBACK INFO
      retryCount,
      lastRetryError: meta.lastRetryError || null,
      lastRetryAt: meta.lastRetryAt || null,

      fallbackProvider,
      isFallback,

      // 🧠 UI DECISION FLAGS (IMPORTANT)
      canRetry:
        isCj &&
        !isFallback &&
        fo.status === "failed" &&
        !fo.cjOrderId,

      canAutoFulfill:
        isCj &&
        !isFallback &&
        fo.status === "pending" &&
        !fo.cjOrderId,

      createdAt: fo.createdAt,
      updatedAt: fo.updatedAt,
    };
  });
}

/**
 * Get single fulfillment order (detail view / future)
 */
export async function getFulfillmentOrder(id) {
  const fo = await prisma.fulfillmentOrder.findUnique({
    where: { id: Number(id) },
  });

  if (!fo) return null;

  const meta = safeJson(fo.metaJson);
  const retryCount = Number(meta.retryCount || 0);
  const fallbackProvider = meta.fallback?.provider || null;

  return {
    ...fo,
    retryCount,
    lastRetryError: meta.lastRetryError || null,
    lastRetryAt: meta.lastRetryAt || null,
    fallbackProvider,
    isFallback: Boolean(fallbackProvider),
  };
}


