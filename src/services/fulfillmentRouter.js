// src/services/fulfillmentRouter.js
import { prisma } from "../db/client.js";

/**
 * Decide how each Shopify line item should be fulfilled
 * - CJ → auto
 * - Everything else → manual (safe default)
 */
export async function routeFulfillment(shopifyOrder) {
  const results = [];

  for (const item of shopifyOrder.line_items || []) {
    const sku = item.sku || null;

    const variant = sku
      ? await prisma.syncedVariant.findFirst({
          where: {
            sku,
            deleted: false,
          },
        })
      : null;

    // ❌ No mapping found → manual handling
    if (!variant) {
      results.push({
        lineItemId: String(item.id),
        supplier: "manual",
        fulfillmentMode: "manual",
        reason: "No synced variant found",
      });
      continue;
    }

    // ✅ Supplier-based routing
    let fulfillmentMode = "manual";

    if (variant.source === "cj") {
      fulfillmentMode = "auto";
    }

    results.push({
      lineItemId: String(item.id),
      supplier: variant.source,
      fulfillmentMode,
      variant: {
        id: variant.id,
        sku: variant.sku,
        asin: variant.asin,
        shopifyProductId: variant.shopifyProductId,
        shopifyVariantId: variant.shopifyVariantId,
        cjProductId: variant.cjProductId || null,
        cjVariantId: variant.cjVariantId || null,
      },
    });
  }

  return results;
}

