// src/services/fulfillmentRouter.js
import { prisma } from "../db/client.js";

export async function routeFulfillment(shopifyOrder) {
  const results = [];

  for (const item of shopifyOrder.line_items || []) {
    const sku = item.sku || null;

    const variant = sku
      ? await prisma.syncedVariant.findFirst({ where: { sku } })
      : null;

    if (!variant) {
      results.push({
        lineItemId: item.id,
        supplier: "manual",
        reason: "No synced variant found",
      });
      continue;
    }

    results.push({
      lineItemId: item.id,
      supplier: variant.supplier || "manual",
      fulfillmentMode: variant.fulfillmentMode || "manual",
      variant,
    });
  }

  return results;
}
