// src/services/fulfillmentApi.js
import { prisma } from "../db/client.js";

/**
 * Get recent fulfillment orders for dashboard
 */
export async function listFulfillmentOrders({ limit = 50 } = {}) {
  return prisma.fulfillmentOrder.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      shopifyOrderId: true,
      shopifyLineItemId: true,
      supplier: true,
      status: true,
      cjOrderId: true,
      cjTrackingNumber: true,
      shopifyFulfillmentSent: true,
      metaJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Get single fulfillment order
 */
export async function getFulfillmentOrder(id) {
  return prisma.fulfillmentOrder.findUnique({
    where: { id: Number(id) },
  });
}
