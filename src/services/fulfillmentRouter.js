// src/services/fulfillmentRouter.js
import { prisma } from "../db/client.js";

/**
 * Decide how each Shopify line item should be fulfilled
 *
 * Priority:
 *  1) CJ (auto)
 *     - Falls back to AliExpress/manual if CJ IDs missing
 *  2) AliExpress (manual for now, auto-ready later)
 *  3) Manual fallback
 *
 * Used by:
 *  - Shopify webhook (orders/paid)
 *  - Dashboard fulfillment table
 *  - Fulfillment retry worker
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

    /**
     * ❌ No synced variant → manual handling
     */
    if (!variant) {
      results.push({
        lineItemId: String(item.id),
        supplier: "manual",
        fulfillmentMode: "manual",
        retryable: false,
        reason: "No synced variant found",
        variant: null,
      });
      continue;
    }

    let supplier = "manual";
    let fulfillmentMode = "manual";
    let retryable = false;
    let reason = null;

    /**
     * ✅ CJ AUTO (preferred)
     * Requires CJ product + variant IDs
     */
    if (
      variant.source === "cj" &&
      variant.cjProductId &&
      variant.cjVariantId
    ) {
      supplier = "cj";
      fulfillmentMode = "auto";
      retryable = true;
    }

    /**
     * ⚠️ CJ selected but mapping incomplete → fallback
     */
    else if (variant.source === "cj") {
      supplier = "aliexpress";
      fulfillmentMode = "manual";
      retryable = true;
      reason = "CJ mapping incomplete, fell back to AliExpress";
    }

    /**
     * AliExpress → manual (auto-ready later)
     */
    else if (variant.source === "aliexpress") {
      supplier = "aliexpress";
      fulfillmentMode = "manual";
      retryable = true;
    }

    /**
     * Amazon / Walmart / unknown → manual
     */
    else {
      supplier = variant.source || "manual";
      fulfillmentMode = "manual";
      retryable = false;
    }

    results.push({
      lineItemId: String(item.id),
      supplier,
      fulfillmentMode,
      retryable,
      reason,

      variant: {
        id: variant.id,
        sku: variant.sku,
        asin: variant.asin,
        source: variant.source,

        shopifyProductId: variant.shopifyProductId,
        shopifyVariantId: variant.shopifyVariantId,

        cjProductId: variant.cjProductId || null,
        cjVariantId: variant.cjVariantId || null,
      },
    });
  }

  return results;
}



