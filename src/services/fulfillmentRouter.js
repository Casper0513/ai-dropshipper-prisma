// src/services/fulfillmentRouter.js
import { prisma } from "../db/client.js";

export async function routeFulfillment(shopifyOrder) {
  const results = [];

  for (const item of shopifyOrder.line_items || []) {
    const sku = item.sku || null;

    if (!sku) {
      results.push({
        lineItemId: String(item.id),
        supplier: "manual",
        fulfillmentMode: "manual",
        retryable: false,
        reason: "Missing SKU",
        variant: null,
      });
      continue;
    }

    const variant = await prisma.syncedVariant.findFirst({
      where: {
        sku,
        source: "cj",           // ✅ CJ ONLY
        deleted: false,
        cjProductId: { not: null },
        cjVariantId: { not: null },
      },
    });

    // ❌ If not a valid CJ product → BLOCK
    if (!variant) {
      results.push({
        lineItemId: String(item.id),
        supplier: "manual",
        fulfillmentMode: "manual",
        retryable: false,
        reason: "CJ mapping missing — order blocked",
        variant: null,
      });
      continue;
    }

    // ✅ CJ AUTO ONLY
    results.push({
      lineItemId: String(item.id),
      supplier: "cj",
      fulfillmentMode: "auto",
      retryable: true,
      reason: null,
      variant: {
        id: variant.id,
        sku: variant.sku,
        cjProductId: variant.cjProductId,
        cjVariantId: variant.cjVariantId,
      },
    });
  }

  return results;
}




